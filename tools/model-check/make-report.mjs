// Prints the tables used in docs/MODELS.md from results/*.jsonl (so no number is typed by hand).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const jl = f => fs.readFileSync(path.join(here, 'results', f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const br = Object.fromEntries(jl('browser.jsonl').map(r => [r.id, r]));
const node = Object.fromEntries(jl('asr-node.jsonl').map(r => [r.model, r]));
const g = {}; new Function('self', fs.readFileSync(path.join(here, '../../models-catalog.js'), 'utf8'))(g);
const cat = g.MODEL_CATALOG.models;
const REF = { en: 'And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.', fa: 'بیشتر دوران زندگی این خانواده یهودی در فضای باز گذشت.' };
const words = s => s.toLowerCase().replace(/[.,،؛!?؟]/g, '').split(/\s+/).filter(Boolean);
function wer(ref, hyp) {                                  // word error rate (edit distance over words)
  const a = words(ref), b = words(hyp), d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return Math.round(100 * d[a.length][b.length] / a.length);
}
const mb = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : Math.round(b / 1048576) + ' MB';
console.log('### Listening, in the real app (Chromium, WASM, 1 thread, no WebGPU)\n');
console.log('| Model | Download | Memory | Clip | Time (clip length) | Words wrong | Transcript |\n|---|---|---|---|---|---|---|');
for (const id of ['asr-tiny', 'asr-base', 'asr-small', 'asr-medium', 'asr-large-v3-turbo']) {
  const r = br[id], m = cat.find(x => x.id === id);
  if (!r || r.error) { console.log(`| ${id.replace('asr-', 'Whisper ')} | not listed | | | | | Browser run failed (see below) |`); continue; }
  for (const x of r.runs) console.log(`| ${m.name} | ${mb(m.bytes)} | ${mb(m.memMB * 1048576)} | ${x.lang === 'en' ? 'English' : 'Persian'} | ${x.sec} s (${x.audioSec} s) | ${wer(REF[x.lang], x.text)} % | ${x.text} |`);
}
console.log('\n### Same models under Node (native ONNX Runtime, several threads), for comparison\n');
console.log('| Model | English | Persian |\n|---|---|---|');
for (const [repo, r] of Object.entries(node)) console.log(`| ${repo} | ${r.runs[0].sec} s · ${wer(REF.en, r.runs[0].text)} % wrong | ${r.runs[1].sec} s · ${wer(REF.fa, r.runs[1].text)} % wrong |`);
console.log('\nReference texts:\n- English: ' + REF.en + '\n- Persian: ' + REF.fa);

const tnode = jl('translate-node.jsonl');
console.log('\n### Translation, in the real app (Chromium, WASM, 1 thread)\n');
console.log('Input sentences (same meaning in every language) are in `tools/model-check/samples.mjs`.\n');
console.log('| Model | Download | Memory | Pair | Time | Output |\n|---|---|---|---|---|---|');
for (const m of cat.filter(x => x.job === 'translate')) {
  const r = br[m.id]; if (!r || r.error) continue;
  for (const x of r.runs) console.log(`| ${m.name} | ${mb(m.bytes)} | ${mb(m.memMB * 1048576)} | ${x.pair.replace('>', ' → ')} | ${x.sec} s | ${x.output} |`);
}
console.log('\n### Models that were tried and are NOT in the app\n');
console.log('| Model | What happened |\n|---|---|');
for (const r of tnode.filter(x => /tc-big/.test(x.model))) console.log(`| ${r.model} (${r.downloadedMB} MB) | Runs, but the 8-bit file produces nonsense: \`${r.runs[0].output.slice(0, 90)}…\` |`);
console.log('\n### Voices, in the real app (Chromium, WASM, 1 thread; Offline mode on, no Gemini key, no device voice)\n');
console.log('| Voice | Download | Speech engine (once) | Memory | Chosen by the app | Name shown | Time to first sound | Audio |\n|---|---|---|---|---|---|---|---|');
for (const m of cat.filter(x => x.job === 'speak')) {
  const r = br[m.id]; if (!r || r.error) continue; const x = r.runs[0];
  console.log(`| ${m.name.en} | ${mb(m.bytes)} | ${mb(m.extraBytes)} | ${mb(m.memMB * 1048576)} | ${x.chosen} | ${x.label} | ${(x.firstSoundMs / 1000).toFixed(1)} s | ${x.audioSec} s |`);
}
