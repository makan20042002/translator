// MAKAN Translate — guards for speech-recognition output (used by ai-worker.js).
// Whisper sometimes gets stuck and writes the same words again and again until it runs out of
// room. These helpers cut such a loop down to one copy and tell the worker when to try again.

// Longest phrase checked, in words. Real loops are almost always 1 to 8 words long.
const MAX_PHRASE = 8;
// A phrase must repeat this many times in a row before it counts as a loop. One-word repeats
// ("no no no", "very very very") are normal speech, so they need more.
const MIN_REPEATS_WORD = 6;
const MIN_REPEATS_PHRASE = 4;

// Cuts every loop of the same words repeated back to back down to one copy.
export function collapseRepeats(text) {
  let s = String(text || '').trim();
  if (!s) return '';
  const words = s.split(/\s+/);
  const key = w => w.replace(/[\p{P}\p{S}]+/gu, '').toLowerCase();
  const out = [];
  let i = 0;
  while (i < words.length) {
    let cut = false;
    for (let n = 1; n <= MAX_PHRASE && !cut; n++) {
      if (i + n * 2 > words.length) break;
      const need = n === 1 ? MIN_REPEATS_WORD : MIN_REPEATS_PHRASE;
      let reps = 1;
      while (i + (reps + 1) * n <= words.length) {
        let same = true;
        for (let k = 0; k < n; k++) if (key(words[i + k]) !== key(words[i + reps * n + k]) || !key(words[i + k])) { same = false; break; }
        if (!same) break;
        reps++;
      }
      if (reps >= need) {
        for (let k = 0; k < n; k++) out.push(words[i + k]);
        i += reps * n;
        cut = true;
      }
    }
    if (!cut) out.push(words[i++]);
  }
  s = out.join(' ');
  // Writing without spaces (Chinese, Japanese) and long runs of one character.
  s = s.replace(/([^\s\d])\1{11,}/gu, "$1$1$1");
  s = s.replace(/([^\s\d]{2,12}?)\1{5,}/gu, '$1');
  return s;
}

// True when the text is empty or looks like a runaway loop. audioSec (optional) also flags more
// words than anyone can speak in that time.
export function looksRunaway(text, audioSec) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (collapseRepeats(t) !== t) return true;
  if (audioSec && audioSec >= 2 && t.split(/\s+/).length / audioSec > 9) return true;
  return false;
}

// The most tokens worth allowing for this much audio. Speech rarely goes past 8 tokens a second
// (more in Persian and Arabic, which need more tokens per word); Whisper's own limit is 448.
export function maxTokensFor(audioSec) {
  const sec = Math.max(1, Math.min(30, audioSec || 30));
  return Math.min(440, Math.ceil(sec * 14) + 24);
}

// How long to wait before giving up on a transcription that shows no sign of life, in
// milliseconds. It grows with the length of the audio and with how slow the model is.
//   secPerAudioSec: measured seconds of work per second of audio for this model (see models-catalog.js)
//   needsLoad: the model is not in memory yet, so it still has to be read from storage and prepared
export function asrBudgetMs(audioSec, secPerAudioSec, needsLoad) {
  const work = (audioSec || 0) * Math.max(0.5, secPerAudioSec || 1) * 4;   // 4x slower than the test machine is still fine
  return Math.round(30000 + work * 1000 + (needsLoad ? 60000 : 0));
}
