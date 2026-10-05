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

const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر است.';

async function testBothModels() {
  for (const model of ['gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-tts']) {
    console.log(`\n--- Testing ${model} ---`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const t0 = Date.now();
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: s1 }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
          }
        })
      });
      const data = await resp.json();
      console.log(`[${model}] HTTP ${resp.status} in ${Date.now() - t0}ms`);
      if (resp.status === 200) {
        console.log(`   Audio bytes len: ${data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data?.length}`);
      } else {
        console.log(`   Error: ${data.error?.message?.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`[${model}] Caught: ${e.message}`);
    }
  }
}

testBothModels().catch(e => console.error(e));
