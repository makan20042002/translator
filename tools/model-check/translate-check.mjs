// Downloads one translation model and runs it on one fixed sentence per language, the way the
// app does in the browser (WASM, q8). Prints one JSON line.
//   node translate-check.mjs <hf-model-id> <kind> <pairs> [cacheDir]
//   kind: nllb | m2m100 | mbart | opus      pairs: e.g. en>fa,fa>en   (opus: exactly one pair)
import { pipeline, env } from '@huggingface/transformers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLES, CODES } from './samples.mjs';

const [, , model, kind, pairArg, cacheArg] = process.argv;
env.cacheDir = cacheArg || path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache');
env.allowLocalModels = false;

let peak = 0;
const tick = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 100);
const files = {};
const t0 = Date.now();
const tr = await pipeline('translation', model, {
  dtype: 'q8', device: 'cpu',
  progress_callback: p => { if (p.status === 'progress' && p.total) files[p.file] = p.total; }
});
const res = { model, kind, downloadedMB: Math.round(Object.values(files).reduce((a, b) => a + b, 0) / 1048576), loadSec: +((Date.now() - t0) / 1000).toFixed(1), runs: [] };
for (const pair of pairArg.split(',')) {
  const [s, t] = pair.split('>');
  const opts = { max_new_tokens: 128 };
  if (kind !== 'opus') { opts.src_lang = CODES[kind][s]; opts.tgt_lang = CODES[kind][t]; }
  const ts = Date.now();
  let out;
  try { out = (await tr(SAMPLES[s], opts))[0].translation_text; } catch (e) { out = 'ERROR: ' + e.message; }
  res.runs.push({ pair, input: SAMPLES[s], output: out, sec: +((Date.now() - ts) / 1000).toFixed(1) });
}
res.peakRssMB = Math.round(peak / 1048576);
clearInterval(tick);
console.log(JSON.stringify(res));
