// Transcribes a WAV file (any rate; resampled with ffmpeg first) with a Whisper model, to check that synthetic speech is intelligible.
//   node transcribe.mjs <hf-model> <wav> <lang> [cacheDir]
import { pipeline, env } from '@huggingface/transformers';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [, , model, wav, lang, cache] = process.argv;
if (cache) env.cacheDir = cache;
const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', wav, '-ar', '16000', '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const audio = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const asr = await pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: 'cpu' });
console.log(JSON.stringify({ model, lang, seconds: +(audio.length / 16000).toFixed(1), text: (await asr(audio, { language: lang, task: 'transcribe' })).text.trim() }));
