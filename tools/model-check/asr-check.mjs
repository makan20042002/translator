// Downloads one Whisper model and runs it on the two short clips, the way the app does in
// the browser without WebGPU (WASM path, q8). Prints one JSON line.
//   node asr-check.mjs <hf-model-id> [cacheDir]
import { pipeline, env } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const model = process.argv[2];
env.cacheDir = process.argv[3] || path.join(here, '.cache');
env.allowLocalModels = false;

function readWav16k(file) {                       // 16-bit PCM mono 16 kHz, header found by scanning
  const b = fs.readFileSync(file);
  let p = 12, data = null;
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'data') { data = b.subarray(p + 8, p + 8 + n); break; }
    p += 8 + n + (n & 1);
  }
  const out = new Float32Array(data.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}
let peak = 0;
const tick = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 100);
const mb = n => Math.round(n / 1048576);

const files = {};
const t0 = Date.now();
const asr = await pipeline('automatic-speech-recognition', model, {
  dtype: 'q8', device: 'cpu',
  progress_callback: p => { if (p.status === 'progress' && p.total) files[p.file] = p.total; }
});
const loadMs = Date.now() - t0;
const res = { model, downloadedMB: mb(Object.values(files).reduce((a, b) => a + b, 0)), files: Object.keys(files), loadSec: +(loadMs / 1000).toFixed(1), runs: [] };
for (const [lang, clip] of [['en', 'en-jfk-11s.wav'], ['fa', 'fa-fleurs-9s.wav']]) {
  const audio = readWav16k(path.join(here, 'clips', clip));
  const t = Date.now();
  const o = await asr(audio, { language: lang, task: 'transcribe', chunk_length_s: 30 });
  res.runs.push({ lang, clip, audioSec: +(audio.length / 16000).toFixed(1), sec: +((Date.now() - t) / 1000).toFixed(1), text: o.text.trim() });
}
res.peakRssMB = mb(peak);
clearInterval(tick);
console.log(JSON.stringify(res));
