// MAKAN Translate — offline voices (Piper), run off the main thread.
// Everything this worker runs is in vendor/piper/ next to the app: no script is loaded from another website.
// Only the voice files themselves (data, not code) are downloaded, once, from Hugging Face.
importScripts('vendor/piper/ort.wasm.min.js', 'vendor/piper/piper_phonemize.js');

const BASE = new URL('vendor/piper/', self.location.href).href;
ort.env.wasm.wasmPaths = BASE;
ort.env.wasm.numThreads = 1;          // more threads need a page served with special headers that normal hosting does not send
ort.env.wasm.proxy = false;

const CACHE = 'transformers-cache';   // the same browser storage as the other models, so the totals in Engines & keys include voices
const VOICES = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const PATH_OK = /^[a-z]{2}\/[a-z]{2}_[A-Z]{2}\/[a-z_]+\/(x_low|low|medium|high)\/[A-Za-z_]+-[a-z_]+-(x_low|low|medium|high)\.onnx(\.json)?$/;
const sessions = {};

const post = m => postMessage(m);

// A file from storage, or downloaded (with progress) and stored.
async function file(path, id) {
  if (!PATH_OK.test(path)) throw new Error('unknown voice file');
  const url = VOICES + path, cache = await caches.open(CACHE);
  const hit = await cache.match(url);
  if (hit) return hit;
  const r = await fetch(url);
  if (!r.ok) throw new Error('voice download failed: HTTP ' + r.status);
  const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); loaded += value.length;
    post({ type: 'progress', id, file: path, loaded, total: total || loaded });
  }
  const blob = new Blob(parts);
  await cache.put(url, new Response(blob, { headers: { 'content-length': String(blob.size), 'content-type': r.headers.get('content-type') || 'application/octet-stream' } }));
  return cache.match(url);
}

async function load(voice, id) {
  if (sessions[voice.path]) return sessions[voice.path];
  const cfg = await (await file(voice.path + '.json', id)).json();
  const model = await (await file(voice.path, id)).arrayBuffer();
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  return sessions[voice.path] = { session, cfg };
}

// Text to phoneme ids with the bundled espeak-ng; one list per sentence.
async function phonemize(text, espeakVoice) {
  const out = [];
  const mod = await createPiperPhonemize({
    print: line => { try { out.push(JSON.parse(line).phoneme_ids); } catch {} },
    printErr: () => {},
    locateFile: f => BASE + f
  });
  mod.callMain(['-l', espeakVoice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
  return out;
}

async function say(ids, v, speaker) {
  const c = v.cfg, inf = c.inference || {};
  const feeds = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
    scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, inf.length_scale ?? 1, inf.noise_w ?? 0.8]))
  };
  if (Object.keys(c.speaker_id_map || {}).length) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(speaker || 0)]));
  const { output } = await v.session.run(feeds);
  return output.data;                   // Float32Array of samples
}

self.onmessage = async ({ data: { id, cmd, a } }) => {
  try {
    let res = true;
    if (cmd === 'load') await load(a.voice, id);
    else if (cmd === 'unload') { delete sessions[a.voice.path]; }
    else if (cmd === 'speak') {
      const v = await load(a.voice, id);
      const sentences = await phonemize(a.text, v.cfg.espeak.voice);
      const t0 = Date.now();
      for (let i = 0; i < sentences.length; i++) {
        const pcm = await say(sentences[i], v, a.speaker);
        post({ type: 'audio', id, index: i, last: i === sentences.length - 1, rate: v.cfg.audio.sample_rate, pcm, ms: Date.now() - t0 });
      }
      res = { sentences: sentences.length };
    }
    post({ id, ok: true, res });
  } catch (e) {
    post({ id, ok: false, err: String((e && e.message) || e) });
  }
};
