// MAKAN Translate — offline models (translation + speech recognition), run off the main thread.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
import { collapseRepeats, looksRunaway, maxTokensFor } from './asr-guard.js';
env.allowLocalModels = false;            // models come from the Hugging Face hub once, then from the browser cache

// Used when the page does not say which model it wants (older pages): the original two models.
const DEFAULT_TR = { repo: 'Xenova/nllb-200-distilled-600M', kind: 'nllb' };
const OLD_GPU = { encoder_model: 'fp32', decoder_model_merged: 'q4' };
const TURBO_GPU = { encoder_model: 'fp16', decoder_model_merged: 'q4' };
const defaultAsr = name => name === 'large-v3-turbo'
  ? { repo: 'onnx-community/whisper-large-v3-turbo', gpu: TURBO_GPU }
  : { repo: 'Xenova/whisper-' + name, gpu: name === 'base' || name === 'small' ? OLD_GPU : null };

const loaded = {};
const REPO_OK = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;     // owner/name only, nothing else is ever fetched
const checkRepo = spec => { if (!spec || !REPO_OK.test(spec.repo)) throw new Error('unknown model'); return spec; };
function gpuRepo(spec) {
  return typeof spec.gpuRepo === 'string' && REPO_OK.test(spec.gpuRepo) ? spec.gpuRepo : spec.repo;
}
const progress = (p, repo) => postMessage({ type: 'progress', p, repo });

async function evictExcept(keepRepo) {
  for (const k of Object.keys(loaded)) {
    if (keepRepo && (k === keepRepo || k.startsWith(keepRepo + '_'))) continue;
    const p = loaded[k]; delete loaded[k];
    try { const inst = await p; if (typeof inst?.dispose === 'function') await inst.dispose(); } catch {}
  }
}

const get = async (task, spec) => {
  if (loaded[spec.repo]) return loaded[spec.repo];
  await evictExcept(spec.repo);
  return (loaded[spec.repo] = pipeline(task, spec.repo, {
    dtype: 'q8',
    progress_callback: p => progress(p, spec.repo)
  }).catch(e => { delete loaded[spec.repo]; throw e; }));
};

const getAsr = async (spec, forceWasm = false) => {
  const model = spec.repo;
  const key = model + (forceWasm ? '_wasm' : '');
  if (loaded[key]) return loaded[key];

  await evictExcept(model);

  // If switching to WASM fallback, dispose the previous WebGPU instance for this model to free GPU memory
  if (forceWasm && loaded[model]) {
    const p = loaded[model]; delete loaded[model];
    try { const inst = await p; if (typeof inst?.dispose === 'function') await inst.dispose(); } catch {}
  }

  if (!forceWasm && spec.gpu) {
    try {
      return (loaded[key] = await pipeline('automatic-speech-recognition', gpuRepo(spec), {
        device: 'webgpu',
        dtype: typeof spec.gpu === 'boolean' ? 'fp32' : spec.gpu,
        progress_callback: p => progress(p, model)
      }));
    } catch (gpuErr) {
      delete loaded[key];
    }
  }
  return (loaded[key] = await pipeline('automatic-speech-recognition', model, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: p => progress(p, model)
  }).catch(e => { delete loaded[key]; throw e; }));
};

async function detectWhisperLang(w, audio, candidateLangs) {
  try {
    const processor = w.processor;
    const model = w.model;
    const cfg = model?.generation_config;
    if (!processor || !model || !cfg?.lang_to_id || !cfg?.decoder_start_token_id) return null;

    const id_to_lang = {};
    for (const [k, v] of Object.entries(cfg.lang_to_id)) {
      const m = k.match(/<\|(\w+)\|>/);
      if (m) id_to_lang[v] = m[1];
    }

    const slice = audio.length > 16000 * 30 ? audio.subarray(0, 16000 * 30) : audio;
    const inputs = await processor(slice);
    const outDet = await model.generate({
      inputs: inputs.input_features,
      decoder_input_ids: [[cfg.decoder_start_token_id]],
      max_new_tokens: 1
    });
    const tokens = outDet.tolist ? outDet.tolist()[0] : Array.from(outDet.data || []);
    const langTokenId = Number(tokens[tokens.length - 1]);
    const detected = id_to_lang[langTokenId];

    if (candidateLangs && candidateLangs.length) {
      const c = candidateLangs.map(l => l.split('-')[0].toLowerCase());
      if (detected && c.includes(detected)) return detected;
      return detected || c[0];
    }
    return detected || null;
  } catch (e) {
    console.warn('Whisper language detection failed:', e);
    return null;
  }
}

// A streamer is how the library reports each new token. We use it only to tell the page how far along we are.
function makeProgress(id, audioSec) {
  const chunks = audioSec <= 30 ? 1 : Math.ceil((audioSec - 5) / 20);   // 30 s windows that overlap by 5 s on each side
  let chunk = 0, tokens = 0, last = 0;
  const perChunkTokens = Math.max(8, Math.min(30, audioSec) * 3.5);        // typical, only used to draw the bar
  const post = (force) => {
    const now = Date.now();
    if (!force && now - last < 400) return;
    last = now;
    const within = Math.min(0.95, tokens / perChunkTokens);
    postMessage({ type: 'asr', id, chunk: Math.min(chunk + 1, chunks), chunks, frac: Math.min(0.99, (chunk + within) / chunks) });
  };
  return {
    start: () => post(true),
    streamer: { put() { tokens++; post(false); }, end() { chunk++; tokens = 0; post(true); } }
  };
}

self.onmessage = async ({ data: { id, cmd, a } }) => {
  try {
    let res = true;
    if (cmd === 'loadTr') await get('translation', checkRepo(a?.spec || DEFAULT_TR));
    else if (cmd === 'translate') {
      const spec = checkRepo(a.spec || DEFAULT_TR);
      const t = await get('translation', spec); res = [];
      const o = { max_new_tokens: 256 };
      if (spec.kind !== 'opus') { o.src_lang = a.src; o.tgt_lang = a.tgt; }   // single-pair models know their pair already
      for (const s of a.items) res.push((await t(s, o))[0].translation_text);
    }
    else if (cmd === 'unload') {
      for (const k of Object.keys(loaded)) if (k === a?.repo || k.startsWith((a?.repo || '') + '_')) {
        const p = loaded[k]; delete loaded[k];
        try { const inst = await p; if (typeof inst?.dispose === 'function') await inst.dispose(); } catch {}
      }
    }
    else if (cmd === 'stats') {
      const repos = Array.from(new Set(Object.keys(loaded).map(k => k.replace(/_wasm$/, ''))));
      res = repos;
      res.repos = repos;
      res.models = repos;
      res.count = repos.length;
    }
    else if (cmd === 'loadAsr') await getAsr(checkRepo(a.spec || defaultAsr(a.model)));
    else if (cmd === 'asr') {
      const spec = checkRepo(a.spec || defaultAsr(a.model));
      let w = await getAsr(spec);
      let lang = a.lang;
      if (!lang || lang === 'auto') {
        lang = await detectWhisperLang(w, a.audio, a.langs);
      }
      const audioSec = a.audio.length / 16000;
      const prog = makeProgress(id, audioSec);
      const opts = { task: 'transcribe', chunk_length_s: 30, max_new_tokens: maxTokensFor(audioSec), streamer: prog.streamer };
      if (lang) opts.language = lang;
      prog.start();

      let o;
      try {
        o = await w(a.audio, opts);
      } catch (infErr) {
        console.warn('WebGPU inference failed, retrying with WASM:', infErr);
        w = await getAsr(spec, true);
        o = await w(a.audio, opts);
      }

      const textOf = x => (typeof x === 'object' && x ? x.text : String(x || '')).trim();
      let text = textOf(o);
      if ((!text || looksRunaway(text, audioSec)) && w.model?.device !== 'wasm' && spec.gpu) {
        console.warn('WebGPU output broken or empty, falling back to WASM:', text);
        w = await getAsr(spec, true);
        text = textOf(await w(a.audio, opts));
      }
      if (text && looksRunaway(text, audioSec)) {
        // Stuck repeating itself: once more, with repeated phrases made unlikely. Keep whichever is not a loop.
        console.warn('Runaway repetition in transcript, retrying with a repetition penalty');
        const again = textOf(await w(a.audio, { ...opts, repetition_penalty: 1.3, no_repeat_ngram_size: 4 }));
        if (again && !looksRunaway(again, audioSec)) text = again;
      }
      text = collapseRepeats(text);
      postMessage({ type: 'asr', id, chunk: 1, chunks: 1, frac: 1 });
      res = a.returnLang ? { text, lang } : text;
    }
    postMessage({ id, ok: true, res });
  } catch (e) {
    postMessage({ id, ok: false, err: String((e && e.message) || e) });
  }
};
