'use strict';
/**
 * Local stand-ins for everything MAKAN Translate talks to over the network.
 *
 * Three servers are started on free ports on 127.0.0.1:
 *
 *  1. appServer   - serves the repository folder (index.html, sw.js, ...) the
 *                   same way a plain web host would, plus test pages under
 *                   /__test/. Records every request, including the
 *                   POST /api/sync_keys that index.html sends.
 *  2. proxyServer - the browser is started with --proxy-server pointing here.
 *                   HTTPS requests arrive as CONNECT tunnels and are handed to
 *                   the providerServer below. Nothing leaves this machine.
 *  3. providerServer - an HTTPS server with a throw-away self-signed
 *                   certificate that imitates the provider endpoints the app
 *                   calls (Google, MyMemory, Gemini, OpenAI-compatible
 *                   providers, Anthropic, the jsDelivr CDN for JSZip, fonts).
 *
 * The "translations" it returns are fake but predictable: "[fa] Hello" for
 * "Hello" into Persian. That is enough to check that the app sends the right
 * text, puts the answers in the right places and handles errors; it says
 * nothing about translation quality of the real services.
 */
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const selfsigned = require('selfsigned');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STRICT_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TEST_PAGES = path.resolve(__dirname, '..', 'pages');
const JSZIP_FILE = require.resolve('jszip/dist/jszip.min.js');

const VALID_KEY = 'stub-valid-key';
const BAD_KEY = 'stub-bad-key';
/** Any key that starts with VALID_KEY is accepted, so tests can give each provider its own key. */
const isValidKey = k => typeof k === 'string' && k.includes(VALID_KEY);  // includes: Google's new keys look like "AQ.<...>"

/** Gemini models the stub offers; null = the default realistic list. */
let geminiModels = null;
/** Gemini models that answer 503 "high demand" (what the real service does when a model is overloaded). */
let geminiBusy = [];
const DEFAULT_GEMINI_MODELS = [
  ['gemini-2.5-flash', ['generateContent', 'streamGenerateContent']],
  ['gemini-2.5-flash-lite', ['generateContent']],
  ['gemini-2.5-pro', ['generateContent']],
  ['gemini-2.5-flash-preview-tts', ['generateContent', 'streamGenerateContent']],
  ['gemini-embedding-001', ['embedContent']],
  ['imagen-4.0-generate-001', ['predict']]
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.srt': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

/** The fake translation used everywhere. */
function fakeTranslate(text, tgt) {
  return `[${tgt || '??'}] ${text}`;
}

/** 0.4 s of a 440 Hz tone as 16-bit little-endian PCM, the format Gemini TTS returns. */
function makePcm(sampleRate = 24000, seconds = 0.4) {
  const n = Math.floor(sampleRate * seconds);
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), i * 2);
  return buf;
}
const PCM_B64 = makePcm().toString('base64');

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.concat(chunks)));
  });
}

function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS'
  }, extraHeaders));
  res.end(body);
}

/** Find "from X to Y" in an AI system prompt and map Y back to a language code. */
const LANG_NAMES = {
  English: 'en', Persian: 'fa', Arabic: 'ar', Turkish: 'tr', German: 'de', French: 'fr', Spanish: 'es',
  Italian: 'it', Portuguese: 'pt', Russian: 'ru', Japanese: 'ja', Korean: 'ko'
};
function targetFromPrompt(prompt) {
  const m = /\bto ([A-Z][A-Za-z ()]+?)\.(?:\s|$)/.exec(prompt || '') || /targeting ([A-Z][A-Za-z ()]+?) \(/.exec(prompt || '');
  if (!m) return 'xx';
  return LANG_NAMES[m[1].trim()] || m[1].trim();
}

/**
 * Decide what an AI provider would answer, from the system prompt and the
 * user content. Returns plain text (what the model "said").
 */
function aiAnswer(system, user) {
  const all = `${system || ''}\n${user || ''}`;
  if (/real-time bilingual interpreter/i.test(all)) {
    const m = /between .*?\((\w[\w-]*)\) and .*?\((\w[\w-]*)\)/.exec(all);
    const a = m ? m[1] : 'en', b = m ? m[2] : 'fa';
    return JSON.stringify({ lang: a, transcript: 'hello from the fake microphone', translation: fakeTranslate('hello from the fake microphone', b) });
  }
  // Checked after the interpreter: its prompt also contains this phrase.
  if (/Transcribe the spoken audio/i.test(all)) return 'hello from the fake microphone';
  if (/Analyze this document sample/i.test(all)) {
    return JSON.stringify({ subject: 'Software / Testing', register: 'Technical / Specialized', terms: [{ s: 'cache', t: 'حافظه نهان' }] });
  }
  if (/terminology editor/i.test(all)) return JSON.stringify([{ s: 'cache', t: 'حافظه نهان', corrected: false }]);
  if (/dictionary lexicographer/i.test(all)) {
    const w = (/term "([^"]+)"/.exec(all) || [])[1] || 'word';
    return JSON.stringify({ word: w, phonetic: '/wɜːd/', pos: 'noun', translations: [fakeTranslate(w, 'fa'), 'second meaning'], definition: 'A stub definition.', examples: ['Example sentence.', '[fa] Example sentence.'] });
  }
  if (/voice assistant/i.test(all)) return 'This is the stub assistant answer.';
  // Translation: the user content is a JSON array of strings.
  let items = null;
  try { items = JSON.parse(user); } catch { /* not JSON */ }
  if (Array.isArray(items)) {
    const tgt = targetFromPrompt(system);
    if (/TRANSLATOR NOTES/.test(system || '')) {
      return JSON.stringify(items.map((s, i) => ({ text: fakeTranslate(String(s), tgt), note: i === 0 ? 'stub translator note' : null })));
    }
    return JSON.stringify(items.map(s => fakeTranslate(String(s), tgt)));
  }
  return 'Hi';
}

async function startStub() {
  const log = [];          // every request seen by any of the servers
  const modes = {};        // host -> { status, body, times } to force failures
  const record = (server, req, body) => {
    const u = new URL(req.url, `http://${req.headers.host || 'unknown'}`);
    const entry = {
      server, host: (req.headers.host || '').replace(/:\d+$/, ''), method: req.method, path: u.pathname, query: u.search,
      headers: req.headers, body: body ? body.toString('utf8') : '', time: Date.now()
    };
    log.push(entry);
    return entry;
  };

  /* ---------- provider (HTTPS) ---------- */
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'makan-test-stub' }], { days: 2, keySize: 2048 });

  async function providerHandler(req, res) {
    const body = await readBody(req);
    const e = record('provider', req, body);
    const host = e.host;
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});

    const forced = modes[host];
    if (forced && forced.delayMs) {
      await new Promise(r => setTimeout(r, forced.delayMs));
    }
    if (forced && forced.times > 0) {
      forced.times--;
      forced.hits = (forced.hits || 0) + 1;
      if (forced.status === 'drop') { req.socket.destroy(); return; }
      return sendJson(res, forced.status, forced.body || { error: { message: `stub forced HTTP ${forced.status}` } });
    }

    let json = null;
    try { json = body.length ? JSON.parse(body.toString('utf8')) : null; } catch { json = null; }
    const p = e.path;
    const q = new URL(req.url, 'http://x').searchParams;

    // --- static things the page loads from CDNs ---
    if (host === 'fonts.googleapis.com') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end('/* stub fonts */'); }
    if (host === 'fonts.gstatic.com') { res.writeHead(404); return res.end(); }
    if (host === 'cdn.jsdelivr.net') {
      if (/^\/npm\/jszip@3\.10\.1\/dist\/jszip\.min\.js$/.test(p)) {
        res.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' });
        return res.end(fs.readFileSync(JSZIP_FILE));
      }
      res.writeHead(404, { 'access-control-allow-origin': '*' }); return res.end('not available in the test stub');
    }

    // --- Google Translate (two endpoints) ---
    if (host === 'clients5.google.com' && p === '/translate_a/t') {
      const form = new URLSearchParams(body.toString('utf8'));
      const tgt = q.get('tl');
      return sendJson(res, 200, form.getAll('q').map(s => fakeTranslate(s, tgt)));
    }
    if (host === 'translate.googleapis.com' && p === '/translate_a/single') {
      const tgt = q.get('tl'), text = q.get('q') || '';
      return sendJson(res, 200, [[[fakeTranslate(text, tgt), text, null, null, 10]], null, q.get('sl') === 'auto' ? 'en' : q.get('sl')]);
    }
    // --- MyMemory ---
    if (host === 'api.mymemory.translated.net' && p === '/get') {
      const [, tgt] = (q.get('langpair') || '|').split('|');
      return sendJson(res, 200, { responseData: { translatedText: fakeTranslate(q.get('q') || '', tgt), match: 1 }, responseStatus: 200, quotaFinished: false });
    }

    // --- Google Gemini ---
    if (host === 'generativelanguage.googleapis.com') {
      const key = req.headers['x-goog-api-key'] || q.get('key') || '';
      if (!key) return sendJson(res, 403, { error: { code: 403, message: "Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API.", status: 'PERMISSION_DENIED' } });
      if (!isValidKey(key)) return sendJson(res, 400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] } });
      if (req.method === 'GET' && /^\/v1beta\/models\/?$/.test(p)) {
        return sendJson(res, 200, { models: (geminiModels || DEFAULT_GEMINI_MODELS.map(m => m[0])).map(n => ({ name: 'models/' + n, supportedGenerationMethods: (DEFAULT_GEMINI_MODELS.find(m => m[0] === n) || [, ['generateContent']])[1] })) });
      }
      const mm = p.match(/^\/v1beta\/models\/([^:/]+):/);
      if (mm && geminiBusy.includes(mm[1])) {
        return sendJson(res, 503, { error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } });
      }
      if (mm && !(geminiModels || DEFAULT_GEMINI_MODELS.map(m => m[0])).includes(mm[1])) {
        return sendJson(res, 404, { error: { code: 404, message: `models/${mm[1]} is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.`, status: 'NOT_FOUND' } });
      }
      const audio = json?.generationConfig?.responseModalities?.includes('AUDIO');
      if (/:streamGenerateContent$/.test(p)) {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' });
        const chunk = JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: PCM_B64 } }] } }] });
        // Four 0.4 s chunks, about 1.6 s of audio in total.
        let sent = 0;
        const next = () => { res.write(`data: ${chunk}\r\n\r\n`); if (++sent < 4) setTimeout(next, 40); else res.end(); };
        next();
        return;
      }
      if (/:generateContent$/.test(p)) {
        if (audio) return sendJson(res, 200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: PCM_B64 } }] } }] });
        const system = (json?.systemInstruction?.parts || []).map(x => x.text || '').join('');
        const contents = json?.contents || [];
        const userText = contents.map(c => (c.parts || []).map(x => x.text || '').join('')).join('\n');
        const lastUser = contents.length ? (contents[contents.length - 1].parts || []).map(x => x.text || '').join('') : '';
        const text = aiAnswer(system, contents.length > 1 ? userText : lastUser);
        return sendJson(res, 200, { candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });
      }
      return sendJson(res, 404, { error: { code: 404, message: `models/x is not found (stub path ${p})`, status: 'NOT_FOUND' } });
    }

    // --- Anthropic ---
    if (host === 'api.anthropic.com') {
      const key = req.headers['x-api-key'] || '';
      if (!isValidKey(key)) return sendJson(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      if (p === '/v1/models') return sendJson(res, 200, { data: [{ id: 'claude-haiku-4-5' }] });
      if (p === '/v1/messages') {
        const user = (json?.messages || []).map(m => typeof m.content === 'string' ? m.content : '').pop();
        return sendJson(res, 200, { type: 'message', role: 'assistant', content: [{ type: 'text', text: aiAnswer(json?.system, user) }] });
      }
    }

    // --- OpenAI-compatible providers ---
    const OPENAI_HOSTS = ['api.openai.com', 'api.groq.com', 'openrouter.ai', 'api.mistral.ai', 'api.cerebras.ai'];
    if (OPENAI_HOSTS.includes(host)) {
      const auth = req.headers.authorization || '';
      if (!isValidKey(auth.replace(/^Bearer /, ''))) return sendJson(res, 401, { error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', code: 'invalid_api_key' } });
      if (/\/models$/.test(p)) return sendJson(res, 200, { data: [{ id: 'stub-model' }] });
      if (/\/chat\/completions$/.test(p)) {
        const msgs = json?.messages || [];
        const system = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const user = msgs.filter(m => m.role !== 'system').map(m => m.content).pop() || '';
        return sendJson(res, 200, { choices: [{ index: 0, message: { role: 'assistant', content: aiAnswer(system, user) }, finish_reason: 'stop' }] });
      }
      if (/\/audio\/transcriptions$/.test(p)) return sendJson(res, 200, { text: 'hello from the fake microphone' });
    }

    return sendJson(res, 404, { error: { message: `stub: no imitation for ${host}${p}` } });
  }

  const providerServer = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    providerHandler(req, res).catch(err => { try { sendJson(res, 500, { error: { message: 'stub crashed: ' + err.message } }); } catch { /* ignore */ } });
  });

  /* ---------- proxy ---------- */
  const proxyServer = http.createServer(async (req, res) => {
    // Plain-http request through the proxy (absolute URL). Nothing in the
    // app uses plain http to the internet; answer 502 and record it.
    const body = await readBody(req);
    record('proxy-http', req, body);
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('test proxy: plain http to the internet is not imitated');
  });
  proxyServer.on('connect', (req, clientSocket, head) => {
    const [host] = String(req.url).split(':');
    log.push({ server: 'proxy-connect', host, method: 'CONNECT', path: req.url, headers: req.headers, body: '', time: Date.now() });
    const upstream = net.connect(providerServer.address().port, '127.0.0.1', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
  });

  /* ---------- app (the website) ---------- */
  const appServer = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const e = record('app', req, body);
    if (req.method === 'POST' && e.path === '/api/sync_keys') {
      return sendJson(res, 200, { ok: true });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let rel = decodeURIComponent(e.path);
    let base = REPO_ROOT;
    if (rel.startsWith('/__test/')) { base = TEST_PAGES; rel = rel.slice('/__test'.length); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found');
    }
    const headers = { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' };
    // strict.html imitates sites such as addons.mozilla.org: no inline styles or scripts, and every kind of
    // resource limited to the page's own address.
    if (/\/strict\.html$/.test(rel)) headers['content-security-policy'] = STRICT_CSP; // rel is the URL path (always '/'), unlike the file path on Windows
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
  });

  const listen = s => new Promise(r => s.listen(0, '127.0.0.1', r));
  await Promise.all([listen(providerServer), listen(proxyServer), listen(appServer)]);
  const sockets = new Set();
  for (const s of [providerServer, proxyServer, appServer]) s.on('connection', c => { sockets.add(c); c.on('close', () => sockets.delete(c)); });

  const appOrigin = `http://127.0.0.1:${appServer.address().port}`;
  return {
    VALID_KEY, BAD_KEY,
    appOrigin,
    appUrl: appOrigin + '/index.html',
    proxyUrl: `http://127.0.0.1:${proxyServer.address().port}`,
    log,
    /** Requests seen by the provider imitation (not counting the browser's CORS preflight checks), optionally only for one host. */
    calls(host) { return log.filter(e => e.server === 'provider' && e.method !== 'OPTIONS' && (!host || e.host === host)); },
    clearLog() { log.length = 0; },
    /** Make the next `times` requests to `host` fail with `status` ('drop' closes the connection). */
    failHost(host, status, times = Infinity, body) { modes[host] = { status, times, body, hits: 0 }; return modes[host]; },
    delayHost(host, ms) { modes[host] = Object.assign(modes[host] || {}, { delayMs: ms }); },
    /** Restrict the Gemini models this key can use (list of names, or null for the default list). */
    setGeminiModels(list) { geminiModels = list; },
    /** These Gemini models answer 503 "high demand". */
    setGeminiBusy(list) { geminiBusy = list; },
    resetModes() { for (const k of Object.keys(modes)) delete modes[k]; geminiModels = null; geminiBusy = []; },
    async close() {
      for (const c of sockets) c.destroy();
      await Promise.all([providerServer, proxyServer, appServer].map(s => new Promise(r => s.close(r))));
    }
  };
}

/** Command-line switches that send all of the browser's internet traffic to the stub. */
function chromiumNetworkArgs(stub) {
  return [
    `--proxy-server=${stub.proxyUrl}`,
    '--ignore-certificate-errors',
    // Stop Chromium's own background services from making noise in the logs.
    '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check'
  ];
}

module.exports = { startStub, chromiumNetworkArgs, fakeTranslate, VALID_KEY, BAD_KEY };
