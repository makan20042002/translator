const fs = require('fs');

const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
const buf = fs.readFileSync(p);
const str = buf.toString('latin1');
const idx = str.indexOf('makan_cfg');
if (idx === -1) {
  console.log('Not found');
  process.exit(1);
}
// extract json object starting at '{'
const jsonStart = str.indexOf('{', idx);
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

if (jsonEnd === -1) {
  console.log('Could not find json end');
  process.exit(1);
}

const cfgJson = str.slice(jsonStart, jsonEnd);
const cfg = JSON.parse(cfgJson);
console.log('Parsed config successfully!');
console.log('Has gemini key:', !!cfg?.eng?.gemini?.key, 'Key length:', cfg?.eng?.gemini?.key?.length);

async function testTts() {
  const key = cfg.eng.gemini.key;
  if (!key) {
    console.log('No key in config');
    return;
  }
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
  console.log(`TTS Response: ${resp.status} in ${Date.now() - t0}ms`);
  if (resp.status !== 200) {
    const txt = await resp.text();
    console.log('Error:', txt.slice(0, 150));
  } else {
    const data = await resp.json();
    console.log('Success! inlineData length:', data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data?.length);
  }
}

testTts().catch(e => console.error(e));
