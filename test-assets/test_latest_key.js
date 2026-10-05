const fs = require('fs');

const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
const buf = fs.readFileSync(p);
const str = buf.toString('latin1');
const lastIdx = str.lastIndexOf('makan_cfg');
console.log('Last makan_cfg index:', lastIdx);

const jsonStart = str.indexOf('{', lastIdx);
let depth = 0;
let jsonEnd = -1;
for (let i = jsonStart; i < str.length; i++) {
  if (str[i] === '{') depth++;
  else if (str[i] === '}') {
    depth--;
    if (depth === 0) {
      jsonEnd = i + 1;
      break;
    }
  }
}

const cfg = JSON.parse(str.slice(jsonStart, jsonEnd));
console.log('Parsed latest config! Has gemini key:', !!cfg?.eng?.gemini?.key, 'Key len:', cfg?.eng?.gemini?.key?.length);
console.log('Prefer Gemini:', cfg?.tts?.preferGemini, 'Gemini voice:', cfg?.tts?.geminiVoice);

async function testRealKey() {
  const key = cfg.eng.gemini.key;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${key}`;
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'سلام' }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        }
      }
    })
  });
  console.log(`Real Gemini TTS call: HTTP ${resp.status} in ${Date.now() - t0}ms`);
  if (resp.status !== 200) {
    const txt = await resp.text();
    console.log('Error:', txt.slice(0, 150));
  } else {
    const data = await resp.json();
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    console.log('🎉 SUCCESS! Real Gemini Voice returned audio! Audio data length:', inlineData?.data?.length);
  }
}

testRealKey().catch(e => console.error(e));
