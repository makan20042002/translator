// Runs the self-hosted Piper worker in a real Chromium: downloads a voice, speaks a sentence, saves the audio.
//   node piper-check.mjs <voice-path-without-.onnx> <text> <out.wav> [cacheDir]
//   e.g. node piper-check.mjs fa/fa_IR/amir/medium/fa_IR-amir-medium "سلام" out.wav
import fs from 'node:fs';
import { openApp } from './harness.mjs';
const [, , voice, text, outFile, cacheDir] = process.argv;
const app = await openApp(cacheDir);
await app.page.goto(app.origin + '/index.html', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
const r = await app.page.evaluate(async ({ voice, text }) => {
  const w = new Worker('piper-worker.js');
  const t0 = performance.now(), ev = { dl: 0, firstAudio: null, parts: [] };
  let sent = 0, id = 0;
  const call = (cmd, a) => new Promise((res, rej) => {
    const my = ++id;
    const on = e => {
      const m = e.data;
      if (m.type === 'progress') { ev.dl = Math.max(ev.dl, m.loaded); return; }
      if (m.type === 'audio' && m.id === my) { if (ev.firstAudio === null) ev.firstAudio = performance.now(); ev.parts.push({ rate: m.rate, pcm: Array.from(m.pcm) }); return; }
      if (m.id === my) { w.removeEventListener('message', on); m.ok ? res(m.res) : rej(new Error(m.err)); }
    };
    w.addEventListener('message', on); w.postMessage({ id: my, cmd, a });
  });
  const spec = { path: voice + '.onnx' };
  await call('load', { voice: spec });
  const tLoaded = performance.now();
  ev.parts = [];
  ev.firstAudio = null;
  const t1 = performance.now();
  const res = await call('speak', { voice: spec, text });
  const t2 = performance.now();
  return { loadSec: (tLoaded - t0) / 1000, firstSoundSec: (ev.firstAudio - t1) / 1000, speakSec: (t2 - t1) / 1000, sentences: res.sentences, rate: ev.parts[0]?.rate, samples: ev.parts.map(p => p.pcm.length), pcm: ev.parts.flatMap(p => p.pcm) };
}, { voice, text });
const rate = r.rate, pcm = Int16Array.from(r.pcm, v => Math.max(-32768, Math.min(32767, Math.round(v * 32767))));
const wav = Buffer.alloc(44 + pcm.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
Buffer.from(pcm.buffer).copy(wav, 44);
fs.writeFileSync(outFile, wav);
const peak = pcm.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
console.log(JSON.stringify({ voice, text, loadSec: +r.loadSec.toFixed(1), firstSoundSec: +r.firstSoundSec.toFixed(2), speakSec: +r.speakSec.toFixed(2), audioSec: +(pcm.length / rate).toFixed(2), sentences: r.sentences, peakAmp: peak, browserPeakMB: app.peakMB(), hosts: [...new Set(app.requested.map(u => new URL(u).host))] , pageErrors: app.errors }));
await app.close();
