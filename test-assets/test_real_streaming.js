const fs = require('fs');

const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
const buf = fs.readFileSync(p);
const str = buf.toString('latin1');
const lastIdx = str.lastIndexOf('makan_cfg');
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
const key = cfg.eng.gemini.key;

async function checkStreaming() {
  const text = 'سلام، این یک آزمایش بررسی استریم صوتی است.';
  console.log('Testing streamGenerateContent with real working key...');
  
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash']) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
      const t0 = Date.now();
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
          }
        })
      });
      console.log(`[${model}] streamGenerateContent => HTTP ${resp.status} in ${Date.now() - t0}ms`);
      if (resp.status !== 200) {
        const err = await resp.text();
        console.log(`   Error:`, err.slice(0, 160));
      } else {
        const body = await resp.text();
        console.log(`   Success stream! Length: ${body.length}`);
      }
    } catch (e) {
      console.log(`   Error:`, e.message);
    }
  }
}

checkStreaming().catch(e => console.error(e));
