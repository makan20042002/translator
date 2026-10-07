// Runs one catalogue model in a real Chromium, through the real app: opens Engines & keys,
// clicks Download on the model's row, then transcribes / translates through ai-worker.js.
// Appends one JSON line to results/browser.jsonl. Needs: npm ci in the repo root; internet via curl.
//   node browser-check.mjs <model-id> [cacheDir]       e.g.  asr-small   tr-nllb-600   tr-opus-en-de
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openApp, here, root } from './harness.mjs';

const id = process.argv[2];
const cacheDir = process.argv[3] || path.join(os.tmpdir(), 'model-route-cache');
fs.mkdirSync(cacheDir, { recursive: true });
const { SAMPLES } = await import('./samples.mjs');
const catalog = (() => { const g = {}; new Function('self', fs.readFileSync(path.join(root, 'models-catalog.js'), 'utf8'))(g); return g.MODEL_CATALOG; })();
const model = catalog.models.find(m => m.id === id);
if (!model) throw new Error('not in the catalogue: ' + id);

const app = await openApp(cacheDir);
const { page, requested } = app;
const errors = app.errors;
const log = (...a) => console.error('[bc]', ...a);
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(app.origin + '/index.html', { waitUntil: 'domcontentloaded' });
const peakMB = app.peakMB;

const out = { id, repo: model.repo, kind: model.kind };
log('open settings');
await page.click('#openSet');
await page.waitForSelector(`[data-mdl="${id}"]`);
out.rowBefore = await page.locator(`[data-mdl="${id}"]`).getAttribute('data-state');
const t0 = Date.now();
log('click download');
await page.click(`[data-mdl="${id}"] [data-act="dl"]`);
await page.waitForSelector(`[data-mdl="${id}"][data-state="ready"]`, { timeout: 25 * 60_000 });
out.downloadSec = +((Date.now() - t0) / 1000).toFixed(1);
out.rowAfter = await page.locator(`[data-mdl="${id}"] .mdl-h .meta`).innerText();
out.total = await page.locator('#mdlTotal').innerText();
out.dlPeakMB = peakMB();

function wav(file) {
  const b = fs.readFileSync(file); let p = 12, d = null;
  while (p < b.length - 8) { const n = b.readUInt32LE(p + 4); if (b.toString('ascii', p, p + 4) === 'data') { d = b.subarray(p + 8, p + 8 + n); break; } p += 8 + n + (n & 1); }
  return Array.from({ length: d.length >> 1 }, (_, i) => d.readInt16LE(i * 2) / 32768);
}
out.runs = [];
if (model.job === 'speak') {
  // Offline mode is on (so Gemini cannot be used) and there is no key: the app must pick this voice by itself and say its name.
  const text = { fa: 'سلام، این یک آزمایش صدا برای مترجم ماکان است.', en: 'Hello, this is a test of the offline voice.' }[model.lang];
  await page.evaluate(() => { cfg.offline = true; cfg.tts.mode = 'device'; });
  const r = await page.evaluate(async ({ text, lang }) => {
    const before = resolveVoice(lang).kind;
    let dur = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; this.addEventListener('loadedmetadata', () => { dur = this.duration; }); return play.call(this); };
    const t = performance.now();
    speak.last = '';
    await speak(text, lang);
    return { chosen: before, label: document.querySelector('.voice-used')?.textContent, totalSec: +((performance.now() - t) / 1000).toFixed(2), firstSoundMs: piperStats?.firstSoundMs, audioSec: +dur.toFixed(2),
      deviceVoices: ('speechSynthesis' in self ? speechSynthesis.getVoices() : []).filter(v => v.lang.toLowerCase().startsWith(lang)).length };
  }, { text, lang: model.lang });
  out.runs.push({ lang: model.lang, ...r });
} else if (model.job === 'listen') {
  await page.evaluate(k => { cfg.whisper = k; }, model.key);
  for (const [lang, clip] of [['en', 'en-jfk-11s.wav'], ['fa', 'fa-fleurs-9s.wav']]) {
    const audio = wav(path.join(here, 'clips', clip));
    const t = Date.now();
    const text = await page.evaluate(async ({ audio, lang }) => rpc('asr', { audio: new Float32Array(audio), lang, model: cfg.whisper, langs: [lang] }), { audio, lang });
    out.runs.push({ lang, audioSec: +(audio.length / 16000).toFixed(1), sec: +((Date.now() - t) / 1000).toFixed(1), text });
  }
} else {
  const [a, b] = model.kind === 'opus' ? model.pair : ['en', 'fa'];
  const pairs = model.kind === 'opus' ? [[a, b]] : [['en', 'fa'], ['fa', 'en'], ['en', 'ar'], ['en', 'tr'], ['de', 'en'], ['ru', 'en']];
  await page.evaluate(i => { cfg.trModel = i; cfg.trPair = i.startsWith('tr-opus'); }, id);
  for (const [s, t] of pairs) {
    const t0r = Date.now();
    const o = await page.evaluate(async ({ s, t, txt }) => eNllb([txt], s, t), { s, t, txt: SAMPLES[s] }).catch(e => 'ERROR ' + e.message);
    out.runs.push({ pair: `${s}>${t}`, sec: +((Date.now() - t0r) / 1000).toFixed(1), output: Array.isArray(o) ? o[0] : o });
  }
}
out.peakMB = peakMB();
out.requestedHosts = [...new Set(requested.map(u => new URL(u).host))];
out.pageErrors = errors.slice(0, 5);
fs.appendFileSync(path.join(here, 'results/browser.jsonl'), JSON.stringify(out) + '\n');
console.log(JSON.stringify(out, null, 1));
await app.close();
