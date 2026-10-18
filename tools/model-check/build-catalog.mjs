// Builds ../../models-catalog.js (the list the app shows in Engines & keys → Offline).
//   node build-catalog.mjs
// Sizes come from the Hugging Face API (file sizes of exactly the files a test run downloaded).
// Speed and memory come from results/*.jsonl. A model with no successful run on file is left out.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WHISPER, TRANSLATE, PAIRS, VOICES } from './catalog-meta.mjs';
import { CODES } from './samples.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJsonl = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const results = [...readJsonl(path.join(here, 'results/asr-node.jsonl')), ...readJsonl(path.join(here, 'results/translate-node.jsonl'))];
const browser = readJsonl(path.join(here, 'results/browser.jsonl'));      // optional: memory measured in a real browser
const byRepo = Object.fromEntries(results.map(r => [r.model, r]));
const brById = Object.fromEntries(browser.map(r => [r.id, r]));          // the real app in Chromium, WASM, one thread

const api = {};
async function sizes(repo) {
  if (api[repo]) return api[repo];
  const r = await fetch(`https://huggingface.co/api/models/${repo}?blobs=true`);
  if (!r.ok) throw new Error(`${repo}: HTTP ${r.status}`);
  const d = await r.json();
  return api[repo] = Object.fromEntries(d.siblings.map(s => [s.rfilename, s.lfs?.size ?? s.size ?? 0]));
}
// Memory a model needs = the highest browser memory seen while it ran, minus an idle browser with the app open.
const baseline = fs.existsSync(path.join(here, 'results/baseline.json')) ? JSON.parse(fs.readFileSync(path.join(here, 'results/baseline.json'), 'utf8')).idleBrowserWithAppMB : 0;
const memOf = peak => Math.max(100, Math.round((peak - baseline) / 100) * 100);
const OLD_GPU = ['onnx/encoder_model.onnx', 'onnx/decoder_model_merged_q4.onnx'];
const skipped = [];

async function entry(base, job) {
  const run = byRepo[base.repo];
  const ok = run && run.runs?.length && run.runs.every(x => x.text ?? x.output) && !run.runs.some(x => /^ERROR/.test(x.output || ''));
  if (!ok) { skipped.push(base.repo); return null; }
  // The browser is where the app runs: a model that works under Node but not in Chromium is not offered.
  const br = brById[base.id];
  if (!process.argv.includes('--candidates') && browser.length && (!br || br.error || !br.runs?.length)) { skipped.push(base.id + ' (failed in the browser)'); return null; }
  const sz = await sizes(base.repo);
  // the files a test run downloaded: recorded in the result, or, for translation runs, read from the folder it filled
  const cacheDir = process.env.MODEL_CACHE;
  const listFile = path.join(here, 'results/file-lists.json');
  const known = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : {};
  const listDir = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listDir(path.join(d, e.name)).map(f => e.name + '/' + f) : [e.name]);
  if (!run.files && cacheDir && fs.existsSync(path.join(cacheDir, base.repo))) { known[base.repo] = listDir(path.join(cacheDir, base.repo)).sort(); fs.writeFileSync(listFile, JSON.stringify(known, null, 1)); }
  const names = run.files || known[base.repo];
  if (!names) throw new Error(base.repo + ': no file list (set MODEL_CACHE to the folder the test run used, once)');
  const fl = names.map(f => [f, sz[f]]);
  const bytes = fl.reduce((a, [, b]) => a + b, 0);
  const timed = (br?.runs?.length ? br.runs : run.runs).filter(x => x.audioSec);   // seconds of work per second of audio: browser run if there is one
  const sec = Math.max(...timed.map(x => x.sec / x.audioSec), 0);
  const memMB = memOf(br?.peakMB ?? run.peakRssMB);
  return { ...base, job, files: fl, bytes, memMB, memBy: br ? 'browser' : 'node', speed: job === 'listen' ? +sec.toFixed(2) : undefined, ran: { downloadedMB: run.downloadedMB } };
}

const models = [];
for (const w of WHISPER) {
  const { key, ...rest } = w;
  const e = await entry({ ...rest, id: 'asr-' + key, key, kind: 'whisper' }, 'listen');
  if (!e) continue;
  if (w.gpu === 'old') {
    const sz = await sizes(w.repo);
    const small = e.files.filter(([f]) => !f.endsWith('.onnx'));
    e.gpu = { encoder_model: 'fp32', decoder_model_merged: 'q4' };
    e.gpuBytes = small.reduce((a, [, b]) => a + b, 0) + OLD_GPU.reduce((a, f) => a + (sz[f] || 0), 0);
    e.gpuFiles = [...small, ...OLD_GPU.map(f => [f, sz[f] || 0])];
    e.webgpu = 'optional';
  } else if (w.gpu === 'turbo') {
    const sz = await sizes(w.repo);
    const small = e.files.filter(([f]) => !f.endsWith('.onnx'));
    const TURBO_GPU = ['onnx/encoder_model_fp16.onnx', 'onnx/decoder_model_merged_q4.onnx'];
    e.gpu = { encoder_model: 'fp16', decoder_model_merged: 'q4' };
    e.gpuVerified = false;
    e.gpuBytes = small.reduce((a, [, b]) => a + b, 0) + TURBO_GPU.reduce((a, f) => a + (sz[f] || 0), 0);
    e.gpuFiles = [...small, ...TURBO_GPU.map(f => [f, sz[f] || 0])];
    e.webgpu = 'optional';
  } else { e.gpu = null; e.webgpu = 'none'; }
  delete e.memBy; models.push(e);
}
for (const t of [...TRANSLATE, ...PAIRS]) {
  const e = await entry(t, 'translate');
  if (!e) continue;
  e.webgpu = 'none';
  e.langs = e.langs; delete e.memBy; models.push(e);
}
// offline voices: listed only if the browser check downloaded the voice through the app and spoke with it
const vendor = path.join(here, '../../vendor/piper');
const extraBytes = fs.existsSync(vendor) ? fs.readdirSync(vendor).filter(f => /\.(js|wasm|data)$/.test(f)).reduce((a, f) => a + fs.statSync(path.join(vendor, f)).size, 0) : 0;
for (const v of process.env.NO_VOICES ? [] : VOICES) {      // NO_VOICES=1 builds the list without the offline voices
  const br = browser.filter(r => r.id === v.id && !r.error && r.runs?.[0]?.audioSec > 0).pop() || (process.argv.includes('--candidates') ? { peakMB: 0 } : null);   // --candidates: only to let browser-check run a voice that has no record yet
  if (!br) { skipped.push(v.id); continue; }
  const dir = v.path.split('/').slice(0, -1).join('/');
  const r = await fetch(`https://huggingface.co/api/models/rhasspy/piper-voices/tree/main/${dir}`);
  const tree = Object.fromEntries((await r.json()).map(x => [x.path, x.lfs?.size ?? x.size]));
  const files = [v.path + '.onnx', v.path + '.onnx.json'].map(f => [f, tree[f]]);
  if (files.some(f => !f[1])) throw new Error(v.id + ': file sizes missing from the API');
  models.push({ id: v.id, job: 'speak', kind: 'piper', name: v.name, repo: 'rhasspy/piper-voices', voice: v.path + '.onnx', lang: v.lang, langs: v.langs, good: v.good, licence: v.licence,
    files, bytes: files.reduce((a, [, b]) => a + b, 0), extraBytes, memMB: memOf(br.peakMB), webgpu: 'none', ran: { downloadedMB: Math.round(files[0][1] / 1048576) } });
}
const out = {
  generated: new Date().toISOString().slice(0, 10),
  codes: { m2m100: CODES.m2m100, mbart: CODES.mbart },
  models
};
fs.writeFileSync(path.join(here, '../../models-catalog.js'),
  '// Generated by tools/model-check/build-catalog.mjs: sizes from the Hugging Face API, speed and memory from test runs. Do not edit by hand.\n' +
  'self.MODEL_CATALOG = ' + JSON.stringify(out, null, 1).replace(/\n\s+/g, m => m.length > 1 && /\n\s+[\[\{"]/.test(m) ? m : m) + ';\n');
fs.writeFileSync(path.join(here, 'results/api-sizes.json'), JSON.stringify(api, null, 1));
console.log(models.length + ' models listed;', skipped.length ? 'left out (no successful run): ' + skipped.join(', ') : 'none left out');
for (const m of models) console.log(m.id.padEnd(18), String(Math.round(m.bytes / 1048576)).padStart(5), 'MB (run: ' + m.ran.downloadedMB + ')', m.gpuBytes ? 'gpu ' + Math.round(m.gpuBytes / 1048576) : '', 'mem', m.memMB, m.speed ?? '');
