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

async function inspectStreamChunks() {
  const text = 'سلام، این یک آزمایش بررسی استریم صوتی است.';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:streamGenerateContent?alt=sse&key=${key}`;
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

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let chunkCount = 0;
  let firstChunkTime = null;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount++;
    if (!firstChunkTime) firstChunkTime = Date.now() - t0;
    const txt = decoder.decode(value, { stream: true });
    totalBytes += value.length;
    console.log(`Chunk #${chunkCount} at ${Date.now() - t0}ms, size ${value.length} bytes, snippet: ${txt.slice(0, 100).replace(/\n/g, ' ')}`);
  }

  console.log(`Stream complete: ${chunkCount} chunks, total raw bytes ${totalBytes}, first chunk arrived at ${firstChunkTime}ms!`);
}

inspectStreamChunks().catch(e => console.error(e));
