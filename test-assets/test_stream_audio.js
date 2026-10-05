const fs = require('fs');
const path = require('path');

function getKeyInMemory() {
  const ldbPath = 'C:\\Users\\Makan\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\Local Storage\\leveldb\\000241.ldb';
  if (fs.existsSync(ldbPath)) {
    const buf = fs.readFileSync(ldbPath);
    const m = buf.toString('latin1').match(/AIza[0-9A-Za-z-_]{35}/);
    if (m) return m[0];
  }
  const ldbPath5 = 'C:\\Users\\Makan\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 5\\Local Storage\\leveldb\\000126.ldb';
  if (fs.existsSync(ldbPath5)) {
    const buf = fs.readFileSync(ldbPath5);
    const m = buf.toString('latin1').match(/AIza[0-9A-Za-z-_]{35}/);
    if (m) return m[0];
  }
  throw new Error('API key not found');
}

async function testStreaming() {
  const key = getKeyInMemory();
  const text = 'سلام، این یک آزمایش بررسی استریم صوتی است.';

  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash']) {
    for (const method of ['streamGenerateContent', 'generateContent']) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
        const t0 = Date.now();
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' }
                }
              }
            }
          })
        });
        console.log(`[${model}] [${method}] => Status: ${resp.status} in ${Date.now() - t0}ms`);
        if (resp.status !== 200) {
          const err = await resp.json().catch(() => ({}));
          console.log(`   Error reason: ${err.error?.message?.slice(0, 120)}`);
        } else {
          const data = await resp.json();
          console.log(`   Success! parts: ${data.candidates?.[0]?.content?.parts?.length || 0}`);
        }
      } catch (e) {
        console.log(`   Exception: ${e.message}`);
      }
    }
  }
}

testStreaming().catch(err => console.error(err));
