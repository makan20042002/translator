/**
 * MAKAN Translate - Extension Engine Module
 * Manifest V3 compatible, zero build step.
 * Never logs or prints API keys.
 */

(function(root) {
'use strict';

// Supported languages
const LANGS = [
  ['en', 'English', 'انگلیسی'],
  ['fa', 'فارسی · Persian', 'فارسی'],
  ['ar', 'العربية · Arabic', 'عربی'],
  ['tr', 'Türkçe · Turkish', 'ترکی'],
  ['de', 'Deutsch · German', 'آلمانی'],
  ['fr', 'Français · French', 'فرانسوی'],
  ['es', 'Español · Spanish', 'اسپانیایی'],
  ['it', 'Italiano · Italian', 'ایتالیایی'],
  ['pt', 'Português · Portuguese', 'پرتغالی'],
  ['ru', 'Русский · Russian', 'روسی'],
  ['zh-CN', '简体中文 · Chinese (Simplified)', 'چینی ساده'],
  ['zh-TW', '繁體中文 · Chinese (Traditional)', 'چینی سنتی'],
  ['ja', '日本語 · Japanese', 'ژاپنی'],
  ['ko', '한국어 · Korean', 'کره‌ای'],
  ['hi', 'हिन्दी · Hindi', 'هندی'],
  ['ur', 'اردو · Urdu', 'اردو'],
  ['ku', 'Kurdî · Kurdish', 'کردی'],
  ['az', 'Azərbaycanca · Azerbaijani', 'آذربایجانی'],
  ['ps', 'پښتو · Pashto', 'پشتو'],
  ['tg', 'Тоҷикӣ · Tajik', 'تاجیکی'],
  ['hy', 'Հայերեն · Armenian', 'ارمنی'],
  ['nl', 'Nederlands · Dutch', 'هلندی'],
  ['sv', 'Svenska · Swedish', 'سوئدی'],
  ['no', 'Norsk · Norwegian', 'نروژی'],
  ['da', 'Dansk · Danish', 'دانمارکی'],
  ['fi', 'Suomi · Finnish', 'فنلاندی'],
  ['pl', 'Polski · Polish', 'لهستانی'],
  ['uk', 'Українська · Ukrainian', 'اوکراینی'],
  ['cs', 'Čeština · Czech', 'چکی'],
  ['ro', 'Română · Romanian', 'رومانیایی'],
  ['hu', 'Magyar · Hungarian', 'مجاری'],
  ['el', 'Ελληνικά · Greek', 'یونانی'],
  ['he', 'עبری · Hebrew', 'عبری'],
  ['id', 'Indonesia · Indonesian', 'اندونزیایی'],
  ['ms', 'Melayu · Malay', 'مالایی'],
  ['th', 'ไทย · Thai', 'تایلندی'],
  ['vi', 'Tiếng Việt · Vietnamese', 'ویتنامی'],
  ['bn', 'বাংলা · Bengali', 'بنگالی']
];

const langName = c => c === 'auto' ? 'the detected language' : ((LANGS.find(l => l[0] === c) || [])[1] || c).split(' · ').pop();
const isRtlLang = l => ['fa', 'ar', 'he', 'ur', 'ps', 'sd', 'ug'].some(c => l === c || (l && l.startsWith(c + '-')));

// Engine registry
const ENG = {
  google: { name: 'Google Translate', tier: 'free', items: 40, chars: 1800 },
  mymemory: { name: 'MyMemory', tier: 'free', items: 1, chars: 450 },
  gemini: { name: 'Google Gemini', tier: 'freekey', ai: 1, key: 1, model: 'gemini-2.5-flash', url: 'https://aistudio.google.com/apikey' },
  groq: { name: 'Groq', tier: 'freekey', ai: 1, key: 1, base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', url: 'https://console.groq.com/keys' },
  openrouter: { name: 'OpenRouter', tier: 'freekey', ai: 1, key: 1, base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', url: 'https://openrouter.ai/keys' },
  mistral: { name: 'Mistral AI', tier: 'freekey', ai: 1, key: 1, base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', url: 'https://console.mistral.ai/api-keys/' },
  cerebras: { name: 'Cerebras', tier: 'freekey', ai: 1, key: 1, base: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b', url: 'https://cloud.cerebras.ai/' },
  openai: { name: 'OpenAI', tier: 'paid', ai: 1, key: 1, base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', url: 'https://platform.openai.com/api-keys' },
  claude: { name: 'Anthropic Claude', tier: 'paid', ai: 1, key: 1, model: 'claude-haiku-4-5', url: 'https://console.anthropic.com/settings/keys' },
  ollama: { name: 'Ollama (Local AI)', tier: 'local', ai: 1, off: 1, base: 'http://localhost:11434/v1', model: 'gemma3', url: 'https://ollama.com/download' },
  custom: { name: 'Custom Server (LM Studio / OpenAI-compatible)', tier: 'custom', ai: 1, model: '' }
};

const DEF_ORDER = ['gemini', 'openrouter', 'mistral', 'cerebras', 'openai', 'claude', 'ollama', 'custom', 'google', 'mymemory', 'groq'];

const DEFAULT_CFG = {
  order: DEF_ORDER.slice(),
  eng: {
    google: { on: true, key: '', model: '', base: '' },
    mymemory: { on: true, key: '', model: '', base: '' },
    gemini: { on: true, key: '', model: 'gemini-2.5-flash', base: '' },
    groq: { on: false, key: '', model: 'llama-3.3-70b-versatile', base: 'https://api.groq.com/openai/v1' },
    openrouter: { on: true, key: '', model: 'meta-llama/llama-3.3-70b-instruct:free', base: 'https://openrouter.ai/api/v1' },
    mistral: { on: true, key: '', model: 'mistral-small-latest', base: 'https://api.mistral.ai/v1' },
    cerebras: { on: true, key: '', model: 'gpt-oss-120b', base: 'https://api.cerebras.ai/v1' },
    openai: { on: true, key: '', model: 'gpt-4o-mini', base: 'https://api.openai.com/v1' },
    claude: { on: true, key: '', model: 'claude-haiku-4-5', base: '' },
    ollama: { on: true, key: '', model: 'gemma3', base: 'http://localhost:11434/v1' },
    custom: { on: false, key: '', model: '', base: 'http://localhost:1234/v1' }
  },
  src: 'auto',
  tgt: 'fa',
  tone: 'neutral',
  subStyle: 'film',
  subject: '',
  trigger: 'auto', // 'auto' | 'alt' | 'never'
  dictLookup: true, // double-click word lookup
  disabledSites: [],
  ui: 'en',
  glossary: [],
  webAppUrl: 'http://localhost:8080',
  tts: {
    rate: 1.0,
    preferGemini: false,
    geminiVoice: 'Kore',
    model: 'gemini-2.5-flash-preview-tts',
    voices: {}
  }
};

// Make a settings object safe to use. Anything unexpected (an engine this extension does not know,
// a language code containing markup, a web address that is not http/https) is replaced by the previous
// valid value, or by the default. Used when settings are loaded and when a settings file is imported.
const LANG_CODE_RE = /^(auto|[a-z]{2,3}(-[A-Za-z0-9]{2,8})?)$/;
const isStr = v => typeof v === 'string';
function safeHttpUrl(u, fallback) {
  try { const x = new URL(String(u)); if (x.protocol === 'http:' || x.protocol === 'https:') return String(u).trim(); } catch {}
  return fallback;
}
function sanitizeConfig(raw, previous) {
  const prev = previous || DEFAULT_CFG;
  const src = raw && typeof raw === 'object' ? raw : {};
  const pick = (v, ok, key) => (ok(v) ? v : (ok(prev[key]) ? prev[key] : DEFAULT_CFG[key]));
  const cfg = Object.assign({}, DEFAULT_CFG, src);
  cfg.src = pick(src.src, v => isStr(v) && LANG_CODE_RE.test(v), 'src');
  cfg.tgt = pick(src.tgt, v => isStr(v) && LANG_CODE_RE.test(v) && v !== 'auto', 'tgt');
  cfg.tone = pick(src.tone, v => ['neutral', 'technical', 'formal', 'film'].includes(v), 'tone');
  cfg.trigger = pick(src.trigger, v => ['auto', 'alt', 'never'].includes(v), 'trigger');
  cfg.ui = pick(src.ui, v => v === 'en' || v === 'fa', 'ui');
  cfg.dictLookup = typeof src.dictLookup === 'boolean' ? src.dictLookup : (typeof prev.dictLookup === 'boolean' ? prev.dictLookup : true);
  cfg.webAppUrl = safeHttpUrl(src.webAppUrl, safeHttpUrl(prev.webAppUrl, DEFAULT_CFG.webAppUrl));
  cfg.edgeHintOff = src.edgeHintOff === true;
  cfg.subject = isStr(src.subject) ? src.subject : '';
  cfg.subStyle = ['film', 'neutral', 'formal'].includes(src.subStyle) ? src.subStyle : DEFAULT_CFG.subStyle;
  cfg.disabledSites = Array.isArray(src.disabledSites) ? src.disabledSites.filter(isStr) : [];
  cfg.glossary = Array.isArray(src.glossary) ? src.glossary.filter(g => g && isStr(g.s) && isStr(g.t)).map(g => ({ s: g.s, t: g.t })) : [];
  // Engines: only the ones this extension knows, each in the same simple shape.
  const order = Array.isArray(src.order) ? src.order.filter(id => isStr(id) && ENG[id]) : [];
  cfg.order = order.filter((id, i) => order.indexOf(id) === i);
  DEF_ORDER.forEach(id => { if (!cfg.order.includes(id)) cfg.order.push(id); });
  const engIn = src.eng && typeof src.eng === 'object' ? src.eng : {};
  cfg.eng = {};
  DEF_ORDER.forEach(id => {
    const e = engIn[id] && typeof engIn[id] === 'object' ? engIn[id] : {};
    const d = DEFAULT_CFG.eng[id] || {};
    const merged = {
      on: typeof e.on === 'boolean' ? e.on : (d.on !== undefined ? d.on : true),
      key: isStr(e.key) ? e.key : '',
      model: isStr(e.model) ? e.model : (ENG[id].model || ''),
      base: isStr(e.base) ? e.base : (ENG[id].base || '')
    };
    merged.base = providerBase(id, merged);
    cfg.eng[id] = merged;
  });
  const t = src.tts && typeof src.tts === 'object' ? src.tts : {};
  cfg.tts = Object.assign({}, DEFAULT_CFG.tts, t);
  cfg.tts.voices = Object.assign({}, DEFAULT_CFG.tts.voices, t.voices && typeof t.voices === 'object' ? t.voices : {});
  return cfg;
}

// Helper: load config from chrome.storage.local
async function loadConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('makan_cfg');
    if (data && data.makan_cfg) return sanitizeConfig(data.makan_cfg);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CFG));
}

// Helper: save config to chrome.storage.local
async function saveConfig(cfg) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ makan_cfg: cfg });
  }
}

// Error text from a provider is shown on screen and logged; it must never carry the key we sent.
function redact(text, secrets) {
  let s = String(text ?? '');
  for (const k of secrets) if (k && String(k).length >= 8) s = s.split(String(k)).join('[key hidden]');
  return s;
}
function secretsOf(opt) {
  const out = [];
  for (const [k, v] of Object.entries((opt && opt.headers) || {})) {
    if (/^(x-goog-api-key|x-api-key)$/i.test(k)) out.push(v);
    else if (/^authorization$/i.test(k)) out.push(String(v).replace(/^Bearer\s+/i, ''));
  }
  return out;
}

// A key may only go to its own provider. Fixed providers always use the address written in ENG;
// only Ollama and Custom have an address the user can set.
function providerBase(id, e) {
  return (ENG[id] && ENG[id].base && id !== 'custom' && id !== 'ollama') ? ENG[id].base : ((e && e.base) || '');
}

// Map errors to plain words (key missing, key rejected, provider unreachable from this network, rate limited, model not found)
function toPlainReason(err) {
  if (!err) return '';
  const msg = String(err.message || err.rawMessage || err || '').toLowerCase();
  const status = err.status || 0;

  if (/key missing|needs? key|no api key|needkey|key is missing|not configured/i.test(msg)) {
    return 'key missing';
  }
  if (status === 401 || /invalid.*key|key.*not.*valid|api.?key.*not.*valid|api_key_invalid|bad api key|unauthorized|permission_denied|unregistered caller/i.test(msg)) {
    return 'key rejected';
  }
  if (status === 429 || /quota|resource_exhausted|rate limit|too many requests/i.test(msg)) {
    return 'rate limited';
  }
  if (status === 503 || /high demand|overloaded|currently experiencing/i.test(msg)) {
    return 'provider busy (high demand), try again in a moment';
  }
  if (status === 404 || /is not found for api version|model.*not.*found/i.test(msg)) {
    return 'model not found';
  }
  if ((status === 403 && /region|country|geograph|forbidden|access denied|not supported in your/i.test(msg)) ||
      /provider unreachable|network error|connection blocked|failed to fetch|netblocked/i.test(msg)) {
    return 'provider unreachable from this network';
  }
  return err.message || '';
}

// HTTP request helper with error parsing
async function fx(url, opt, tries = 2) {
  let r;
  try {
    r = await fetch(url, opt);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const err = new Error('provider unreachable from this network');
    err.cause = e;
    throw err;
  }
  if (!r.ok) {
    let m = '';
    try {
      const j = await r.json();
      m = j.error?.message || j.message || JSON.stringify(j);
    } catch {
      m = await r.text();
    }
    const cleanMsg = redact(m || ('HTTP ' + r.status), secretsOf(opt));
    const err = new Error(cleanMsg);
    err.status = r.status;
    err.rawMessage = m;
    throw err;
  }
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('json')) return r.json();
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
}

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function preGloss(s, glossary = []) {
  if (!glossary || !glossary.length) return s;
  let out = s;
  for (const g of glossary) {
    if (!g.s || !g.t) continue;
    try {
      out = out.replace(new RegExp('(?<![\\p{L}\\p{N}])' + reEsc(g.s) + '(?![\\p{L}\\p{N}])', 'giu'), g.t);
    } catch {
      out = out.split(g.s).join(g.t);
    }
  }
  return out;
}

// Engine check
function isEngineUsable(id, cfg) {
  if (!ENG[id]) return false; // an engine this extension does not have (for example from a settings file made by the web app)
  const e = cfg.eng?.[id];
  if (!e || !e.on) return false;
  if (ENG[id].key && !e.key) return false;
  if (id === 'custom' && !e.base) return false;
  if (ENG[id].ai && !e.model) return false;
  return true;
}

// Build AI system prompt
function buildSysPrompt(src, tgt, tone = 'neutral', subject = '', glossary = [], subStyle = 'neutral') {
  let p = `You are a professional translator. Translate every string in the JSON array from ${langName(src)} to ${langName(tgt)}.`;
  
  if (subStyle === 'film') {
    p += ' STYLE: Natural spoken film and dialogue tone. Use colloquial modern expressions and contractions instead of stiff written prose.';
    if (tgt === 'fa' || tgt.startsWith('fa-')) {
      p += ' FOR PERSIAN: Use authentic spoken Persian (فارسی روان و محاوره‌ای): use spoken forms (e.g. "نمیدونم", "میخوام", "چی شده") where conversational.';
    }
  } else if (tone === 'technical') {
    p += ' TONE: Precise, high-level technical vocabulary suitable for software, engineering, and computer systems.';
  } else if (tone === 'formal') {
    p += ' TONE: Formal, polite, and literary language with standard grammar.';
  } else {
    p += ' TONE: Natural, modern, balanced conversational tone.';
  }

  if (subject) {
    p += ` DOMAIN / SUBJECT: ${subject}. Strictly use correct terminology for this domain.`;
  }

  const g = (glossary || []).filter(x => x.s && x.t);
  if (g.length) {
    p += ' MANDATORY GLOSSARY: ' + g.map(x => `"${x.s}" → "${x.t}"`).join('; ') + '.';
  }

  p += ' Keep HTML tags, markdown markers, numbers, placeholders and symbols intact. Reply with ONLY a JSON array of strings with the exact same count as input.';
  return p;
}

function parseAiJsonArray(txt, expectedLength) {
  const s = String(txt).replace(/```(?:json)?/g, '').trim();
  let v = null;
  try {
    const a = s.indexOf('['), b = s.lastIndexOf(']');
    v = JSON.parse(a >= 0 && b > a ? s.slice(a, b + 1) : s);
  } catch {}
  if (v && !Array.isArray(v) && typeof v === 'object') {
    v = Object.values(v).find(Array.isArray);
  }
  if (Array.isArray(v) && v.length === expectedLength) {
    return v.map(x => {
      if (x && typeof x === 'object' && ('text' in x || 't' in x)) return String(x.text ?? x.t ?? '');
      return typeof x === 'string' ? x : String(x ?? '');
    });
  }
  if (expectedLength === 1 && s) {
    return [s.replace(/^"|"$/g, '').trim()];
  }
  throw new Error('AI output array count did not match input');
}

// Google Free Translate
async function callGoogle(items, src, tgt, signal) {
  try {
    const body = new URLSearchParams();
    items.forEach(s => body.append('q', s));
    const j = await fx(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${src}&tl=${tgt}`, {
      method: 'POST',
      body,
      signal
    });
    const out = j.map(x => Array.isArray(x) ? x[0] : x);
    if (out.length === items.length && out.every(x => typeof x === 'string')) return out;
  } catch (e) {
    if (e.name === 'AbortError') throw e;
  }
  // Fallback endpoint
  const out = [];
  for (const s of items) {
    const j = await fx(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(s)}`, { signal });
    out.push((j[0] || []).map(x => x[0]).join(''));
  }
  return out;
}

// MyMemory Free Translate
async function callMyMemory(items, src, tgt, email = '', signal) {
  const out = [];
  for (const s of items) {
    const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=${src === 'auto' ? 'Autodetect' : src}|${tgt}` + (email ? `&de=${encodeURIComponent(email)}` : '');
    const j = await fx(u, { signal });
    const tx = j.responseData?.translatedText || '';
    if (+j.responseStatus !== 200 || j.quotaFinished || /MYMEMORY WARNING/i.test(tx)) {
      throw new Error(j.quotaFinished || /WARNING/i.test(tx) ? 'Daily limit reached' : (j.responseDetails || 'MyMemory error'));
    }
    out.push(tx);
  }
  return out;
}

// ---- Gemini models: ask the key which models it can really use ----
// Model names change and differ between keys, so never trust a built-in name. The models endpoint tells us
// what this key can call; we rank those and try them in order. The key is sent in the x-goog-api-key header.
const geminiListCache = new Map(); // key -> { at, models } (kept in memory only)
async function listGeminiModels(key, signal) {
  const hit = geminiListCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.models;
  const out = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const j = await fx(url, { headers: { 'x-goog-api-key': key }, signal }, 1);
    for (const m of (j && j.models) || []) out.push({ name: String(m.name || '').replace(/^models\//, ''), methods: m.supportedGenerationMethods || [] });
    if (!j || !j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  geminiListCache.set(key, { at: Date.now(), models: out });
  return out;
}
// Best first: ordinary "flash" before "flash-lite" before "pro"; finished models before previews; newer before older.
function rankGeminiModels(models, kind) {
  const notText = /embedding|aqa|imagen|image|veo|live|native-audio|robotics|computer-use|learnlm|gemma|vision|tts/i;
  const usable = models.filter(m => kind === 'tts'
    ? /tts/i.test(m.name) && m.methods.some(x => /generateContent/i.test(x))
    : /^gemini-/.test(m.name) && !notText.test(m.name) && m.methods.includes('generateContent'));
  const tier = n => (/flash-lite|lite/i.test(n) ? 1 : /flash/i.test(n) ? 0 : /pro/i.test(n) ? 2 : 3);
  const version = n => { const x = /gemini-(\d+(?:\.\d+)?)/.exec(n); return x ? parseFloat(x[1]) : 0; };
  const preview = n => (/preview|exp/i.test(n) ? 1 : 0);
  return usable.map(m => m.name).sort((a, b) => tier(a) - tier(b) || preview(a) - preview(b) || version(b) - version(a) || a.localeCompare(b));
}
function geminiModelProblem(kind) {
  const err = new Error(kind === 'tts'
    ? 'model not found: this Gemini key cannot use any speech (read-aloud) model'
    : 'model not found: this Gemini key cannot use any translation model');
  err.status = 404; err.code = 'model-not-found';
  return err;
}
// The models to try, best first. A key problem (rejected, blocked) is reported as it is; if the list cannot be
// fetched for another reason (offline) we fall back to sensible names and let the real call report the problem.
async function geminiModelOrder(key, kind, configured, signal) {
  let models;
  try { models = await listGeminiModels(key, signal); }
  catch (e) {
    if (e.name === 'AbortError' || e.status === 400 || e.status === 401 || e.status === 403 || e.status === 429) throw e;
    return [configured, ...(kind === 'tts' ? ['gemini-2.5-flash-preview-tts'] : ['gemini-2.5-flash', 'gemini-flash-latest'])].filter((m, i, a) => m && a.indexOf(m) === i);
  }
  const ranked = rankGeminiModels(models, kind);
  if (!ranked.length) throw geminiModelProblem(kind);
  // The name shipped as our old default is not honoured as "chosen by the user": Google has retired it for new keys.
  const chosen = configured && configured !== 'gemini-2.5-flash' && ranked.includes(configured);
  return [...(chosen ? [configured] : []), ...ranked.filter(n => n !== configured || !chosen)];
}
// Models Google answered "not found" for with this key (e.g. "no longer available to new users"): skipped for 30 minutes.
const geminiBadModels = new Map();
const badKey = (key, m) => key.slice(-6) + '|' + m;
function isBadGeminiModel(key, m) { const t = geminiBadModels.get(badKey(key, m)); return !!t && Date.now() - t < 30 * 60 * 1000; }
// Run fn(modelName) with the best model, moving on to the next one when a model is not found or busy.
// Gives up after a few models or ~25 s, so the user gets a plain reason instead of a long silent wait.
async function withGeminiModel(key, kind, configured, fn, signal) {
  let order = await geminiModelOrder(key, kind, configured, signal);
  const good = order.filter(m => !isBadGeminiModel(key, m));
  if (good.length) order = good;
  // Alternate full-size and "lite" models: when the big ones are overloaded the small ones usually still answer.
  const lite = order.filter(m => /lite/i.test(m)), big = order.filter(m => !/lite/i.test(m));
  if (lite.length && big.length) { order = []; for (let i = 0; i < Math.max(lite.length, big.length); i++) { if (big[i]) order.push(big[i]); if (lite[i]) order.push(lite[i]); } }
  let last = null, busy = null;
  const t0 = Date.now();
  for (const m of order.slice(0, 5)) {
    if (last && Date.now() - t0 > 25000) break;
    try { return await fn(m); }
    catch (e) {
      if (e.name === 'AbortError') throw e;
      last = e;
      if (e.status === 404) { geminiBadModels.set(badKey(key, m), Date.now()); continue; }
      if (e.status === 429 || e.status === 503) busy = e;
      if (e.status === 429 || e.status === 503 || /not found|not supported|unavailable|high demand|overloaded/i.test(e.message || '')) continue;
      throw e;
    }
  }
  if (busy) throw busy; // overloaded or rate limited is the more useful thing to tell than "not found"
  if (last && last.status === 404) throw geminiModelProblem(kind);
  throw last || geminiModelProblem(kind);
}

// Single-key AI translation caller with exponential backoff on 429
async function callAi(id, items, o, cfg) {
  const e = cfg.eng[id];
  const sys = buildSysPrompt(o.src, o.tgt, o.tone, o.subject, cfg.glossary, o.subStyle);
  const user = JSON.stringify(items);
  const signal = o.signal;
  let txt = '';

  if (id === 'gemini') {
    const key = (e.key || '').trim();
    if (!key) throw new Error('key missing');
    const j = await withGeminiModel(key, 'text', e.model, m => fx(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.15, responseMimeType: 'application/json' }
        })
      }), signal);
    txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!txt) throw new Error(j.promptFeedback?.blockReason || 'Empty Gemini response');
  } else if (id === 'claude') {
    const j = await fx('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': e.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: e.model,
        max_tokens: 4000,
        system: sys,
        messages: [{ role: 'user', content: user }]
      })
    });
    txt = (j.content || []).map(c => c.text || '').join('');
  } else {
    // OpenAI-compatible providers: Groq, OpenRouter, Mistral, Cerebras, OpenAI, Ollama, Custom
    const h = { 'Content-Type': 'application/json' };
    if (e.key) h.Authorization = 'Bearer ' + e.key;
    const url = providerBase(id, e).replace(/\/+$/, '') + '/chat/completions';
    const j = await fx(url, {
      method: 'POST',
      signal,
      headers: h,
      body: JSON.stringify({
        model: e.model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0.2
      })
    });
    txt = j.choices?.[0]?.message?.content || '';
  }

  return parseAiJsonArray(txt, items.length);
}


// ---- Plain failure reasons and the last error of each engine (for the card, popup, Options and diagnostics) ----
const IN_EXTENSION_PAGE = typeof location !== 'undefined' && /^(chrome|moz)-extension:$/.test(location.protocol) || typeof importScripts === 'function';
const lastEngineErrors = {};
function recordEngineError(id, err) {
  const entry = { reason: toPlainReason(err) || String((err && err.message) || err || ''), time: new Date().toISOString() };
  lastEngineErrors[id] = entry;
  try { if (IN_EXTENSION_PAGE && root.chrome && chrome.storage && chrome.storage.local) chrome.storage.local.set({ makan_last_errors: lastEngineErrors }); } catch {}
}

// Turn any failure into one line of plain words. Never returns an empty string.
function plainFailure(raw) {
  let msg = String((raw && (raw.message || raw.error)) || raw || '').replace(/^(Error: )?(Translation failed: )+/i, '').trim();
  if (/content security policy|securitypolicyviolation|csp\b|refused to (connect|load|execute|apply)|blocked by this site/i.test(msg)) return "blocked by this site's security policy";
  if (/extension context invalidated|updated or reloaded/i.test(msg)) return 'the extension was updated or reloaded: refresh this page';
  if (/receiving end does not exist|could not establish connection|background (is )?not (running|reachable)|no answer from the extension/i.test(msg)) return 'the extension background did not answer: refresh this page';
  // The provider's status number may only survive inside the text (it crosses message boundaries as text).
  let status = (raw && raw.status) || 0;
  if (!status) { const m = /\bHTTP (\d{3})\b/i.exec(msg); if (m) status = +m[1]; }
  const plain = toPlainReason({ message: msg, status });
  const out = (plain || msg).replace(/^key missing$/i, 'key missing').trim();
  return out || 'unknown reason (use "Copy diagnostics" in Options and send it to the developer)';
}
// Reasons the user can fix in Options.
function failureNeedsOptions(reason) { return /key missing|key rejected|model not found|no usable|not configured|no engine/i.test(String(reason)); }

// Ask the extension's background and never lose the reason: a missing or silent answer becomes a plain message.
async function askBackground(msg) {
  try {
    if (!(root.chrome && chrome.runtime && chrome.runtime.sendMessage)) return { ok: false, error: 'the extension background did not answer: refresh this page' };
    const r = await chrome.runtime.sendMessage(msg);
    if (!r) return { ok: false, error: 'the extension background did not answer: refresh this page' };
    return r;
  } catch (e) {
    return { ok: false, error: plainFailure(e) };
  }
}

// Main translation coordinator with fallback chain and 429 backoff
async function translateItemsWithFallback(items, options = {}, cfg) {
  if (!items || !items.length) return { results: [], engineUsed: '', engineName: '' };
  
  const src = options.src || cfg.src || 'auto';
  const tgt = options.tgt || cfg.tgt || 'fa';
  const tone = options.tone || cfg.tone || 'neutral';
  const subject = options.subject || cfg.subject || '';
  const subStyle = options.subStyle || cfg.subStyle || 'neutral';

  let chain;
  if (options.mode === 'fast') {
    const nonAi = ['google', 'mymemory'].filter(id => !ENG[id]?.ai && isEngineUsable(id, cfg));
    chain = nonAi.length ? nonAi : ['google', 'mymemory'].filter(id => !ENG[id]?.ai);
  } else if (options.mode === 'smart') {
    const aiChain = (options.engine && options.engine !== 'auto' && ENG[options.engine]?.ai)
      ? [options.engine]
      : cfg.order.filter(id => ENG[id]?.ai && isEngineUsable(id, cfg));
    chain = aiChain;
  } else {
    chain = (options.engine && options.engine !== 'auto')
      ? [options.engine]
      : cfg.order.filter(id => isEngineUsable(id, cfg));
  }

  if (!chain.length) {
    if (options.mode === 'smart') {
      const hasMissingKey = cfg.order.some(id => ENG[id]?.ai && ENG[id]?.key && !cfg.eng?.[id]?.key);
      if (hasMissingKey) throw new Error('Translation failed: key missing');
    }
    throw new Error('No usable translation engine configured. Please configure an engine in MAKAN options.');
  }

  let lastError = null;
  for (let ci = 0; ci < chain.length; ci++) {
    const id = chain[ci];
    const isAi = !!ENG[id].ai;

    try {
      let results = [];
      if (isAi) {
        results = await callAi(id, items, { src, tgt, tone, subject, subStyle, signal: options.signal }, cfg);
      } else if (id === 'google') {
        const prepped = items.map(s => preGloss(s, cfg.glossary));
        results = await callGoogle(prepped, src, tgt, options.signal);
      } else if (id === 'mymemory') {
        const prepped = items.map(s => preGloss(s, cfg.glossary));
        results = await callMyMemory(prepped, src, tgt, cfg.mmEmail, options.signal);
      } else {
        continue;
      }

      return {
        results,
        engineUsed: id,
        engineName: ENG[id].name,
        src,
        tgt
      };
    } catch (err) {
      lastError = err;
      recordEngineError(id, err);
      const is429 = err.status === 429 || /429|resource_exhausted|rate limit|quota/i.test(err.message || '');
      
      if (is429) {
        if (ci + 1 < chain.length) {
          // Switch to next engine in chain
          continue;
        } else {
          // Wait and retry once if provider asked
          let waitSec = 3;
          const waitMatch = (err.message || '').match(/retry in (\d+(?:\.\d+)?)s/i) || (err.message || '').match(/retry after (\d+)/i);
          if (waitMatch) waitSec = Math.ceil(parseFloat(waitMatch[1]));
          await new Promise(r => setTimeout(r, waitSec * 1000));
          try {
            const results = isAi
              ? await callAi(id, items, { src, tgt, tone, subject, subStyle, signal: options.signal }, cfg)
              : await callGoogle(items, src, tgt, options.signal);
            return { results, engineUsed: id, engineName: ENG[id].name, src, tgt };
          } catch (retryErr) {
            lastError = retryErr;
          }
        }
      }
    }
  }

  const plain = toPlainReason(lastError);
  throw new Error(`Translation failed: ${plain || lastError?.message || 'All engines in chain failed'}`);
}

// Single-word dictionary lookup using an AI engine
async function lookupWordDictionary(word, options = {}, cfg) {
  const cleanWord = String(word || '').trim();
  const src = options.src || 'auto';
  const tgt = options.tgt || cfg.tgt || 'fa';

  // Find first usable AI engine
  const aiEngine = cfg.order.find(id => ENG[id].ai && isEngineUsable(id, cfg));
  
  if (!aiEngine) {
    // Fall back to direct translation
    const res = await translateItemsWithFallback([cleanWord], options, cfg);
    return {
      word: cleanWord,
      translation: res.results[0] || cleanWord,
      engineName: res.engineName,
      isDictionary: false
    };
  }

  const prompt = `You are an expert bilingual dictionary lexicographer.
Provide a concise, beautiful dictionary lookup for the term "${cleanWord}" targeting ${langName(tgt)} (Source: ${langName(src)}).

Return ONLY a valid JSON object in this exact schema:
{
  "word": "${cleanWord}",
  "phonetic": "IPA or pronunciation guide (e.g. /kæt/)",
  "pos": "Part of speech (e.g. noun, verb, adj)",
  "translations": ["Primary translation in ${langName(tgt)}", "Secondary translation"],
  "definition": "One short, precise definition sentence in ${langName(tgt)}",
  "examples": ["One natural example sentence in source language", "Matching translation in ${langName(tgt)}"]
}`;

  try {
    const e = cfg.eng[aiEngine];
    let txt = '';
    if (aiEngine === 'gemini') {
      const j = await withGeminiModel(e.key, 'text', e.model, m => fx(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': e.key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
          })
        }));
      txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    } else {
      const h = { 'Content-Type': 'application/json' };
      if (e.key) h.Authorization = 'Bearer ' + e.key;
      const url = providerBase(aiEngine, e).replace(/\/+$/, '') + '/chat/completions';
      const j = await fx(url, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          model: e.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        })
      });
      txt = j.choices?.[0]?.message?.content || '';
    }

    const clean = txt.replace(/```(?:json)?/g, '').trim();
    const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
    if (a >= 0 && b > a) {
      const parsed = JSON.parse(clean.slice(a, b + 1));
      parsed.isDictionary = true;
      parsed.engineName = ENG[aiEngine].name;
      return parsed;
    }
  } catch (e) {
    console.warn('AI dictionary lookup failed, falling back to basic translation:', e.message);
  }

  const res = await translateItemsWithFallback([cleanWord], options, cfg);
  return {
    word: cleanWord,
    translation: res.results[0] || cleanWord,
    engineName: res.engineName,
    isDictionary: false
  };
}

// Connection test helper for options page
async function testEngineConnection(id, cfg) {
  const d = ENG[id], e = cfg.eng?.[id];
  if (!d) return { code: 'err', text: 'Unknown engine' };
  if (!e) return { code: 'err', text: 'Not configured' };

  if (id === 'custom' && !(e.base || '').trim()) return { code: 'needsUrl', text: 'Needs URL' };
  if (id === 'google') {
    try {
      const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=hi');
      if (r.ok) return { code: 'works', text: 'Works' };
      return { code: 'netBlocked', text: 'Network blocked' };
    } catch {
      return { code: 'netBlocked', text: 'Network blocked' };
    }
  }
  if (id === 'mymemory') {
    try {
      const r = await fetch('https://api.mymemory.translated.net/get?q=hi&langpair=en|es');
      if (r.ok) return { code: 'works', text: 'Works' };
      return { code: 'netBlocked', text: 'Network blocked' };
    } catch {
      return { code: 'netBlocked', text: 'Network blocked' };
    }
  }
  if (id === 'ollama') {
    const base = (e.base || 'http://localhost:11434/v1').replace(/\/+$/, '');
    try {
      const r = await fetch(base + '/models');
      if (r.ok) return { code: 'works', text: 'Works' };
      return { code: 'localDown', text: 'Ollama not running' };
    } catch {
      return { code: 'localDown', text: 'Ollama not running' };
    }
  }

  // Key-based AI provider
  if (!e.key) return { code: 'needsKey', text: 'Key needed' };

  try {
    if (id === 'gemini') {
      await withGeminiModel(e.key, 'text', e.model, m => fx(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': e.key },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
        }));
      return { code: 'works', text: 'Works' };
    } else if (id === 'claude') {
      await fx('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': e.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: e.model || 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] })
      });
      return { code: 'works', text: 'Works' };
    } else {
      const h = { 'Content-Type': 'application/json' };
      if (e.key) h.Authorization = 'Bearer ' + e.key;
      const url = providerBase(id, e).replace(/\/+$/, '') + '/chat/completions';
      await fx(url, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ model: e.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 })
      });
      return { code: 'works', text: 'Works' };
    }
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (/401|invalid.*key|key.*not.*valid|api.?key.*not.*valid|unauthorized|api_key_invalid|bad api key|permission_denied|unregistered caller/i.test(msg)) {
      return { code: 'keyRejected', text: 'Key rejected' };
    }
    if (/429|quota/i.test(msg)) {
      return { code: 'works', text: 'Works (quota warning)' };
    }
    if (/not found|model not found/i.test(msg)) {
      return { code: 'modelNotFound', text: 'Model not found' };
    }
    return { code: 'netBlocked', text: 'Connection failed' };
  }
}

// Convert raw PCM to a valid WAV Blob / Uint8Array container
function pcmToWav(pcmBytes, sampleRate = 24000, numChannels = 1) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const totalDataLen = pcmBytes.byteLength;
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, totalDataLen + 36, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // 16 bits per sample
  writeStr(36, 'data');
  view.setUint32(40, totalDataLen, true);

  const wavBytes = new Uint8Array(44 + totalDataLen);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

// Split long text for speech into natural chunks
function splitTextForSpeech(text, maxLen = 180) {
  const str = String(text || '').replace(/\s*\n+\s*/g, ' ').trim();
  if (!str) return [];
  if (str.length <= maxLen) return [str];

  const chunks = [];
  const re = /[^.!?؟؛,\n]+[.!?؟؛,\n]*/g;
  let match;
  let current = '';

  while ((match = re.exec(str)) !== null) {
    const s = match[0].trim();
    if (!s) continue;
    if (current && (current.length + s.length + 1 > maxLen)) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? current + ' ' + s : s;
    }
    if (current.length >= maxLen) {
      chunks.push(current);
      current = '';
    }
  }
  if (current) chunks.push(current);

  // If any chunk is still larger than maxLen (e.g. no punctuation), hard split by words
  const result = [];
  for (const c of chunks) {
    if (c.length <= maxLen) {
      result.push(c);
    } else {
      const words = c.split(' ');
      let cur = '';
      for (const w of words) {
        if (cur && (cur.length + w.length + 1 > maxLen)) {
          result.push(cur);
          cur = w;
        } else {
          cur = cur ? cur + ' ' + w : w;
        }
      }
      if (cur) result.push(cur);
    }
  }
  return result.length ? result : [str.slice(0, maxLen)];
}

// Strictly pick a voice matching the spoken language.
// Never returns a voice from a different language!
function pickBestVoice(lang, voicesList, userPrefVoices = {}) {
  if (!voicesList || !voicesList.length || !lang) return null;
  const langBase = String(lang).split('-')[0].toLowerCase();

  // If user configured a specific voiceURI for this base language
  const prefURI = userPrefVoices[langBase];
  if (prefURI) {
    const found = voicesList.find(v => v.voiceURI === prefURI && v.lang && v.lang.toLowerCase().startsWith(langBase));
    if (found) return found;
  }

  // Filter ONLY voices matching this language
  const matching = voicesList.filter(v => v.lang && v.lang.toLowerCase().startsWith(langBase));
  if (!matching.length) return null; // CRITICAL: NEVER return a voice from another language

  // Score preferred voices
  const score = v => {
    let s = 0;
    const name = (v.name || '').toLowerCase();
    if (/natural|neural/i.test(name)) s += 4;
    if (/online/i.test(name)) s += 2;
    if (/google|microsoft/i.test(name)) s += 1;
    if (v.lang && v.lang.toLowerCase() === lang.toLowerCase()) s += 0.5;
    return s;
  };

  matching.sort((a, b) => score(b) - score(a));
  return matching[0] || null;
}

// Get clear informational message when voice is missing
function getNoVoiceMessage(lang, ui = 'en') {
  const langNameStr = langName(lang);
  if (ui === 'fa' || (lang === 'fa' && ui !== 'en')) {
    return `صدایی برای «${langNameStr}» در مرورگر نصب نیست. در تنظیمات ویندوز (Settings > Time & Language > Speech) بسته صوتی مربوطه را نصب کنید، یا در تنظیمات ماکان کلید Google Gemini را برای صدای طبیعی هوش مصنوعی فعال نمایید.`;
  }
  return `No browser voice installed for ${langNameStr}. Add a voice package in Windows Settings > Time & Language > Speech, or configure a free Google Gemini key in MAKAN Options for AI voice.`;
}

// Split text into natural sentence units for pipelined TTS
function splitIntoSentences(text) {
  const str = String(text || '').replace(/\s*\n+\s*/g, ' \n ').trim();
  if (!str) return [];
  const sentences = [];
  const re = /[^.!?؟؛\n]+(?:[.!?؟؛\n]+|$)/gu;
  let match;
  while ((match = re.exec(str)) !== null) {
    const s = match[0].trim();
    if (s) sentences.push(s);
  }
  if (sentences.length <= 1 && str.length > 220) {
    const clauseRe = /[^,،؛:\n]+(?:[,،؛:\n]+|$)/gu;
    const sub = [];
    while ((match = clauseRe.exec(str)) !== null) {
      const c = match[0].trim();
      if (c) sub.push(c);
    }
    if (sub.length > 1) return sub;
  }
  return sentences.length > 0 ? sentences : [str];
}

// In-memory session cache for synthesized TTS audio
const ttsSessionCache = new Map();

function getTtsCacheKey(text, voice = 'Kore', rate = 1.0, model = 'gemini') {
  return `${model}|${voice}|${rate}|${String(text || '').trim()}`;
}

// Call Gemini TTS with model fallback, PCM-to-WAV conversion, and session caching
// Never logs or exposes the API key
async function callGeminiTts(text, key, options = {}) {
  if (!key) throw new Error('Gemini API key is required for AI speech synthesis.');
  const GEM_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];
  const voice = GEM_VOICES.includes(options.voice) ? options.voice : 'Kore';
  const model = options.model || 'gemini-2.5-flash-preview-tts';
  const rate = options.rate || 1.0;

  const cacheKey = getTtsCacheKey(text, voice, rate, model);
  if (options.cache !== false && ttsSessionCache.has(cacheKey)) {
    return { ...ttsSessionCache.get(cacheKey), cached: true };
  }

  // Speech models this key can really use, best first (a built-in name may not exist for this key).
  const uniqueModels = (await geminiModelOrder(key, 'tts', options.model, options.signal)).slice(0, 5);

  const doFetch = async (m) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
    return await fx(url, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      })
    });
  };

  let resp = null;
  let lastErr = null;
  for (const m of uniqueModels) {
    try {
      resp = await doFetch(m);
      if (resp) break;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastErr = err;
      if (/not found|404|quota|429|unavailable|high demand/i.test(err.message || '')) {
        continue;
      }
      throw err;
    }
  }

  if (!resp) throw (lastErr || new Error('All Gemini TTS models unavailable'));

  const inlineData = resp.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) throw new Error('Gemini TTS returned empty audio data.');

  const bin = atob(inlineData.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const mime = inlineData.mimeType || '';
  let wavBytes;
  if (mime.includes('pcm') || mime.includes('l16')) {
    const m = mime.match(/rate=(\d+)/);
    const sampleRate = m ? parseInt(m[1], 10) : 24000;
    wavBytes = pcmToWav(bytes, sampleRate, 1);
  } else {
    wavBytes = bytes;
  }

  // Convert to base64 Data URL for MV3 transfer
  let binary = '';
  const len = wavBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  const base64 = btoa(binary);
  const result = {
    dataUrl: `data:audio/wav;base64,${base64}`,
    byteLength: wavBytes.byteLength,
    cached: false
  };

  if (options.cache !== false) {
    ttsSessionCache.set(cacheKey, result);
  }

  return result;
}

// Web Audio PCM gapless streaming player
class GeminiAudioStreamPlayer {
  constructor(options = {}) {
    this.rate = options.rate || 1.0;
    this.sampleRate = options.sampleRate || 24000;
    this.onFirstSound = options.onFirstSound || null;
    this.onEnded = options.onEnded || null;
    this.onError = options.onError || null;
    this.audioCtx = options.audioCtx || null;
    this.ownsCtx = false;
    this.nextPlayTime = 0;
    this.activeSources = new Set();
    this.isStopped = false;
    this.firstSoundReported = false;
    this.streamDone = false;
    this.allPcmChunks = [];
    this.totalPcmBytes = 0;
  }

  ensureContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = (typeof self !== 'undefined' && (self.AudioContext || self.webkitAudioContext)) ||
                            (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
      if (!AudioCtxClass) throw new Error('Web Audio AudioContext not supported');
      this.audioCtx = new AudioCtxClass({ sampleRate: this.sampleRate });
      this.ownsCtx = true;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  feedChunk(pcmBytes) {
    if (this.isStopped || !pcmBytes || !pcmBytes.byteLength) return;

    this.allPcmChunks.push(pcmBytes);
    this.totalPcmBytes += pcmBytes.byteLength;

    const ctx = this.ensureContext();
    const numSamples = Math.floor(pcmBytes.byteLength / 2);
    if (numSamples === 0) return;

    // Convert raw 16-bit linear PCM (little endian) to AudioBuffer normalized float32 [-1.0, 1.0]
    const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, numSamples);
    const audioBuf = ctx.createBuffer(1, numSamples, this.sampleRate);
    const channelData = audioBuf.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      channelData[i] = int16[i] / 32768.0;
    }

    const now = ctx.currentTime;
    // Buffer underrun handling: if the previous chunk ended before this chunk arrived,
    // wait slightly rather than glitching with a past or overlapping timestamp
    let startTime;
    if (this.nextPlayTime <= now) {
      startTime = now + 0.02; // smooth restart
    } else {
      startTime = this.nextPlayTime;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.playbackRate.value = this.rate;
    source.connect(ctx.destination);

    source.start(startTime);
    this.activeSources.add(source);

    const chunkDuration = audioBuf.duration / this.rate;
    this.nextPlayTime = startTime + chunkDuration;

    if (!this.firstSoundReported) {
      this.firstSoundReported = true;
      if (this.onFirstSound) {
        const delayMs = Math.max(0, (startTime - now) * 1000);
        setTimeout(() => {
          if (!this.isStopped && this.onFirstSound) this.onFirstSound();
        }, delayMs);
      }
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.streamDone && this.activeSources.size === 0 && !this.isStopped) {
        if (this.onEnded) this.onEnded();
      }
    };
  }

  endStream() {
    if (this.isStopped) return;
    this.streamDone = true;
    if (this.activeSources.size === 0) {
      if (this.onEnded) this.onEnded();
    }
  }

  getAssembledWavDataUrl() {
    if (!this.totalPcmBytes) return null;
    const merged = new Uint8Array(this.totalPcmBytes);
    let offset = 0;
    for (const chunk of this.allPcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const wavBytes = pcmToWav(merged, this.sampleRate, 1);
    let binary = '';
    const len = wavBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(wavBytes[i]);
    }
    return {
      dataUrl: `data:audio/wav;base64,${btoa(binary)}`,
      byteLength: wavBytes.byteLength
    };
  }

  stop() {
    this.isStopped = true;
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources.clear();
    this.nextPlayTime = 0;
    this.allPcmChunks = [];
    this.totalPcmBytes = 0;
  }
}

// Streaming Gemini TTS via Server-Sent Events with gapless AudioContext scheduling
async function streamGeminiTts(text, key, options = {}) {
  if (!key) throw new Error('Gemini API key is required for AI speech synthesis.');
  const GEM_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];
  const voice = GEM_VOICES.includes(options.voice) ? options.voice : 'Kore';
  const model = options.model || 'gemini-2.5-flash-preview-tts';
  const rate = options.rate || 1.0;

  const cacheKey = getTtsCacheKey(text, voice, rate, model);
  if (options.cache !== false && ttsSessionCache.has(cacheKey)) {
    const cached = ttsSessionCache.get(cacheKey);
    // Speaking text we already have audio for: play the saved audio through the player, instead of
    // returning without a sound (which left the Speak button waiting for an "ended" that never came).
    if (options.player && cached.dataUrl) {
      const bin = atob(cached.dataUrl.split(',')[1] || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pcm = bytes.subarray(44); // skip the 44-byte WAV header written by pcmToWav
      options.player.feedChunk(pcm);
      options.player.endStream();
      return { ok: true, chunks: 1, cached: true, model };
    }
    return { ...cached, cached: true };
  }

  // Speech models this key can really use, best first (a built-in name may not exist for this key).
  const uniqueModels = (await geminiModelOrder(key, 'tts', options.model, options.signal)).slice(0, 5);

  const player = options.player;
  let chunksReceived = 0;
  let lastErr = null;

  for (const m of uniqueModels) {
    if (options.signal?.aborted) throw new Error('Aborted');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`;
      const resp = await fetch(url, {
        method: 'POST',
        signal: options.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        })
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${redact(errText, [key]).slice(0, 140)}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (options.signal?.aborted) {
          reader.cancel().catch(() => {});
          throw new Error('Aborted');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(jsonStr); } catch { continue; }
          const inlineData = parsed.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (inlineData?.data) {
            chunksReceived++;
            const bin = atob(inlineData.data);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

            if (options.onChunk) {
              options.onChunk(bytes, chunksReceived === 1);
            }
            if (player) {
              player.feedChunk(bytes);
            }
          }
        }
      }

      if (chunksReceived > 0) {
        if (player) {
          player.endStream();
          const assembled = player.getAssembledWavDataUrl();
          if (assembled && options.cache !== false) {
            ttsSessionCache.set(cacheKey, { ...assembled, cached: false });
          }
          return { ok: true, chunks: chunksReceived, cached: false, model: m, assembled };
        }
        return { ok: true, chunks: chunksReceived, cached: false, model: m };
      }
      throw new Error(`No audio chunks received from model ${m}`);
    } catch (err) {
      if (err.name === 'AbortError' || options.signal?.aborted) throw err;
      lastErr = err;
      console.warn(`Streaming failed on model ${m}:`, err.message);
      if (/not found|404|quota|429|unavailable|high demand|empty/i.test(err.message || '')) {
        continue;
      }
      break;
    }
  }

  // Automatic fallback to pipelining if streaming fails
  if (options.fallback !== false) {
    console.warn('Falling back to pipelined Gemini TTS...');
    return await callGeminiTts(text, key, options);
  }

  throw (lastErr || new Error('Streaming Gemini TTS unavailable'));
}

// Export for service worker, browser window, and ES environments
if (root) {
  if (!root.LANGS) root.LANGS = LANGS;
  if (!root.ENG) root.ENG = ENG;
  if (!root.DEF_ORDER) root.DEF_ORDER = DEF_ORDER;
  if (!root.DEFAULT_CFG) root.DEFAULT_CFG = DEFAULT_CFG;
  root.loadConfig = loadConfig;
  root.sanitizeConfig = sanitizeConfig;
  root.geminiModelOrder = geminiModelOrder;
  root.withGeminiModel = withGeminiModel;
  root.rankGeminiModels = rankGeminiModels;
  root.safeHttpUrl = safeHttpUrl;
  root.saveConfig = saveConfig;
  root.translateItemsWithFallback = translateItemsWithFallback;
  root.lookupWordDictionary = lookupWordDictionary;
  root.testEngineConnection = testEngineConnection;
  root.isEngineUsable = isEngineUsable;
  root.isRtlLang = isRtlLang;
  root.langName = langName;
  root.pcmToWav = pcmToWav;
  root.splitTextForSpeech = splitTextForSpeech;
  root.splitIntoSentences = splitIntoSentences;
  root.pickBestVoice = pickBestVoice;
  root.getNoVoiceMessage = getNoVoiceMessage;
  root.callGeminiTts = callGeminiTts;
  root.streamGeminiTts = streamGeminiTts;
  root.GeminiAudioStreamPlayer = GeminiAudioStreamPlayer;
  root.ttsSessionCache = ttsSessionCache;
  root.getTtsCacheKey = getTtsCacheKey;
  root.toPlainReason = toPlainReason;
  root.plainFailure = plainFailure;
  root.failureNeedsOptions = failureNeedsOptions;
  root.askBackground = askBackground;
  root.lastEngineErrors = lastEngineErrors;
  if (typeof module !== 'undefined' && module.exports) module.exports = root;
}

})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));


