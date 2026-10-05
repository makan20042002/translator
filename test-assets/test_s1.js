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

async function testS1() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${key}`;
  const t0 = Date.now();
  console.log('Sending single sentence request...');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: s1 }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    }),
    signal: AbortSignal.timeout(20000)
  });
  console.log('Status:', resp.status);
  const data = await resp.json();
  const dur = Date.now() - t0;
  console.log(`Sentence 1 completed in ${dur}ms, audio length: ${data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data?.length}`);
}

testS1().catch(e => console.error('Caught:', e));
