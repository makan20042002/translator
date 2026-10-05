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

const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
const fullText = `${s1} ${s2} ${s3}`;

async function callSingle(text, label) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${key}`;
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    })
  });
  const data = await resp.json();
  const dur = Date.now() - t0;
  const audioLen = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data?.length || 0;
  console.log(`[${label}] Completed in ${dur}ms (audio base64 len: ${audioLen})`);
  return dur;
}

async function runComparison() {
  console.log('=== Comparing Full 3-Sentence Text vs First Sentence Only ===');
  console.log('Full text length:', fullText.length, 'chars');
  console.log('Sentence 1 length:', s1.length, 'chars');

  console.log('\n--- Test 1: Full 3 Sentences in one request (Before) ---');
  const durBefore = await callSingle(fullText, 'Full 3 Sentences');

  console.log('\n--- Test 2: First Sentence only (After - Pipelined First Sound) ---');
  const durAfter = await callSingle(s1, 'Sentence 1 Only');

  console.log(`\nResults: Before = ${durBefore}ms, After = ${durAfter}ms. Improvement = ${durBefore - durAfter}ms faster (${((1 - durAfter / durBefore) * 100).toFixed(1)}% reduction in wait time!)`);
}

runComparison().catch(e => console.error(e));
