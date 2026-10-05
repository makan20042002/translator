const fs = require('fs');

const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
const str = fs.readFileSync(p, 'latin1');
const lastIdx = str.lastIndexOf('makan_cfg');
const jsonStart = str.indexOf('{', lastIdx);
let depth = 0, jsonEnd = -1;
for (let i = jsonStart; i < str.length; i++) {
  if (str[i] === '{') depth++;
  else if (str[i] === '}') {
    depth--;
    if (depth === 0) { jsonEnd = i + 1; break; }
  }
}
const cfg = JSON.parse(str.slice(jsonStart, jsonEnd));
const key = cfg.eng.gemini.key;

function splitIntoSentences(text) {
  const str = String(text || '').replace(/\s*\n+\s*/g, ' \n ').trim();
  if (!str) return [];
  const sentences = [];
  const re = /[^.!?؟؛\n]+(?:[.!?؟؛\n]+|$)/gu;
  let match;
  while ((match = re.exec(str)) !== null) {
    const s = match[0].trim();
    if (s) sentences.push(s);
  }
  if (sentences.length <= 1 && str.length > 200) {
    const clauseRe = /[^,،؛:\n]+(?:[,،؛:\n]+|$)/gu;
    const sub = [];
    while ((match = clauseRe.exec(str)) !== null) {
      const c = match[0].trim();
      if (c) sub.push(c);
    }
    if (sub.length > 1) return sub;
  }
  return sentences.length > 0 ? sentences : [str];
}

const ttsSessionCache = new Map();

function getTtsCacheKey(text, voice = 'Kore', rate = 1.0, model = 'gemini-3.8-flash-tts') {
  return `${model}|${voice}|${rate}|${String(text || '').trim()}`;
}

async function fetchSentenceTts(sentence, options = {}) {
  const cacheKey = getTtsCacheKey(sentence, options.voice, options.rate, options.model);
  if (ttsSessionCache.has(cacheKey)) {
    return { ...ttsSessionCache.get(cacheKey), cached: true };
  }

  const model = options.model || 'gemini-3.8-flash-tts';
  const voice = options.voice || 'Kore';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: sentence }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      }
    })
  });
  
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`TTS failed with HTTP ${resp.status}: ${errText.slice(0, 100)}`);
  }

  const data = await resp.json();
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) throw new Error('Empty audio');

  const dur = Date.now() - t0;
  const result = {
    audioData: inlineData.data,
    mimeType: inlineData.mimeType,
    dur,
    cached: false
  };

  ttsSessionCache.set(cacheKey, result);
  return result;
}

async function simulatePipelinedTts(text) {
  const sentences = splitIntoSentences(text);
  console.log(`Split text into ${sentences.length} sentences:`);
  sentences.forEach((s, i) => console.log(`  [Sentence ${i + 1}] (${s.length} chars): ${s}`));

  const t0 = Date.now();
  console.log('\n[Event: Preparing Voice] Showing preparing state on speaker button...');
  
  // 1. Dispatch sentence 1 immediately
  const s1Promise = fetchSentenceTts(sentences[0]);

  // 2. Queue remaining sentences in background
  const remainingPromises = sentences.slice(1).map(s => fetchSentenceTts(s));

  // 3. Await sentence 1
  const s1Result = await s1Promise;
  const timeToFirstSound = Date.now() - t0;
  console.log(`\n🎉 [Event: First Sound Start] Sentence 1 arrived in ${timeToFirstSound}ms! (Playing now...)`);
  console.log(`   Cached: ${s1Result.cached}, Audio bytes: ${s1Result.audioData.length}`);

  // 4. While sentence 1 is "playing", remaining sentences are arriving in background:
  for (let i = 0; i < remainingPromises.length; i++) {
    const res = await remainingPromises[i];
    console.log(`   [Background Queue] Sentence ${i + 2} ready in ${res.dur}ms (cached: ${res.cached})`);
  }

  const totalTime = Date.now() - t0;
  console.log(`\nAll sentences prepared and queued in ${totalTime}ms total.`);

  // 5. Test Cache on Replay:
  console.log('\n--- Testing Replay with Session Cache ---');
  const tReplay0 = Date.now();
  const replayRes = await fetchSentenceTts(sentences[0]);
  const replayTime = Date.now() - tReplay0;
  console.log(`Replay Sentence 1 took ${replayTime}ms (cached: ${replayRes.cached})! Instantaneous!`);

  return { timeToFirstSound, totalTime };
}

const threeSentences = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است. این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند. با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';

simulatePipelinedTts(threeSentences).catch(e => console.error(e));
