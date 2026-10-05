// MAKAN Translate — offline models (translation + speech recognition), run off the main thread.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;            // models come from the Hugging Face hub once, then from the browser cache

const TR = 'Xenova/nllb-200-distilled-600M';
const loaded = {};
const progress = p => postMessage({ type: 'progress', p });
const get = (task, model) => loaded[model] || (loaded[model] =
  pipeline(task, model, { dtype: 'q8', progress_callback: progress }).catch(e => { delete loaded[model]; throw e; }));
const WEBGPU_DTYPE = { encoder_model: 'fp32', decoder_model_merged: 'q4' };

const getAsr = async (modelName, forceWasm = false) => {
  const model = 'Xenova/whisper-' + modelName;
  const key = model + (forceWasm ? '_wasm' : '');
  if (loaded[key]) return loaded[key];
  if (!forceWasm) {
    try {
      return (loaded[key] = await pipeline('automatic-speech-recognition', model, {
        device: 'webgpu',
        dtype: WEBGPU_DTYPE,
        progress_callback: progress
      }));
    } catch (gpuErr) {
      delete loaded[key];
    }
  }
  return (loaded[key] = await pipeline('automatic-speech-recognition', model, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: progress
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

function isBrokenText(t) {
  if (!t || !t.trim()) return true;
  const s = t.trim();
  const words = s.split(/\s+/);
  if (words.length >= 8) {
    for (let i = 0; i <= words.length - 4; i++) {
      const phrase = words.slice(i, i + 4).join(' ');
      if (s.split(phrase).length - 1 >= 4) return true;
    }
  }
  if (/(.)\1{12,}/.test(s)) return true;
  return false;
}

self.onmessage = async ({ data: { id, cmd, a } }) => {
  try {
    let res = true;
    if (cmd === 'loadTr') await get('translation', TR);
    else if (cmd === 'translate') {
      const t = await get('translation', TR); res = [];
      for (const s of a.items) res.push((await t(s, { src_lang: a.src, tgt_lang: a.tgt, max_new_tokens: 256 }))[0].translation_text);
    }
    else if (cmd === 'loadAsr') await getAsr(a.model);
    else if (cmd === 'asr') {
      let w = await getAsr(a.model);
      let lang = a.lang;
      if (!lang || lang === 'auto') {
        lang = await detectWhisperLang(w, a.audio, a.langs);
      }
      const opts = { task: 'transcribe', chunk_length_s: 30 };
      if (lang) opts.language = lang;

      let o;
      try {
        o = await w(a.audio, opts);
      } catch (infErr) {
        console.warn('WebGPU inference failed, retrying with WASM:', infErr);
        w = await getAsr(a.model, true);
        o = await w(a.audio, opts);
      }

      let text = (typeof o === 'object' && o ? o.text : String(o || '')).trim();
      if (isBrokenText(text) && w.model?.device !== 'wasm') {
        console.warn('WebGPU output broken or empty, falling back to WASM:', text);
        w = await getAsr(a.model, true);
        const wasmOut = await w(a.audio, opts);
        text = (typeof wasmOut === 'object' && wasmOut ? wasmOut.text : String(wasmOut || '')).trim();
      }
      res = a.returnLang ? { text, lang } : text;
    }
    postMessage({ id, ok: true, res });
  } catch (e) {
    postMessage({ id, ok: false, err: String((e && e.message) || e) });
  }
};
