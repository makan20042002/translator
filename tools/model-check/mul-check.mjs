// Does the multilingual OPUS-MT pair (mul-en / en-mul) really handle Persian? Prints what comes out.
import { pipeline, env } from '@huggingface/transformers';
import { SAMPLES } from './samples.mjs';
env.cacheDir = process.argv[2]; env.allowLocalModels = false;
const mulEn = await pipeline('translation', 'Xenova/opus-mt-mul-en', { dtype: 'q8', device: 'cpu' });
for (const [l, t] of [['fa', SAMPLES.fa], ['ar', SAMPLES.ar], ['tr', SAMPLES.tr]]) console.log('mul-en', l, '->', (await mulEn(t, { max_new_tokens: 100 }))[0].translation_text);
const enMul = await pipeline('translation', 'Xenova/opus-mt-en-mul', { dtype: 'q8', device: 'cpu' });
for (const tag of ['>>pes<<', '>>fas<<', '>>prs<<', '>>tur<<', '>>ara<<', '>>deu<<']) {
  try { console.log('en-mul', tag, '->', (await enMul(tag + ' ' + SAMPLES.en, { max_new_tokens: 100 }))[0].translation_text); } catch (e) { console.log('en-mul', tag, 'ERROR', e.message); }
}
