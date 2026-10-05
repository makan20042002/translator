const fs = require('fs');

function getKeyInMemory() {
  const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
  if (fs.existsSync(p)) {
    const str = fs.readFileSync(p, 'latin1');
    const lastIdx = str.lastIndexOf('makan_cfg');
    if (lastIdx !== -1) {
      const jsonStart = str.indexOf('{', lastIdx);
      let depth = 0, jsonEnd = -1;
      for (let i = jsonStart; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
          depth--;
          if (depth === 0) { jsonEnd = i + 1; break; }
        }
      }
      if (jsonEnd !== -1) {
        const cfg = JSON.parse(str.slice(jsonStart, jsonEnd));
        if (cfg.eng?.gemini?.key) return cfg.eng.gemini.key;
      }
    }
  }
  const ldbPath = 'C:\\Users\\Makan\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\Local Storage\\leveldb\\000241.ldb';
  if (fs.existsSync(ldbPath)) {
    const buf = fs.readFileSync(ldbPath);
    const m = buf.toString('latin1').match(/AIza[0-9A-Za-z-_]{35}/);
    if (m) return m[0];
  }
  throw new Error('API key not found');
}

async function runDirectComparison() {
  const key = getKeyInMemory();

  const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
  const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
  const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
  const fullText = `${s1} ${s2} ${s3}`;

  const model = 'gemini-3.8-flash-lite-tts';

  console.log('--- 1. Pipelining Sentence 1 (generateContent) ---');
  const tPipe0 = Date.now();
  const respPipe = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: s1 }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    })
  });
  const dataPipe = await respPipe.json();
  const timePipeFirstSound = Date.now() - tPipe0;
  if (!respPipe.ok || !dataPipe.candidates) {
    console.error('Pipelined S1 error response:', respPipe.status, JSON.stringify(dataPipe));
  } else {
    const pipeBytes = Buffer.from(dataPipe.candidates[0].content.parts[0].inlineData.data, 'base64').length;
    console.log(`Pipelined S1: First Sound Ready at ${timePipeFirstSound}ms (${pipeBytes} bytes)`);
  }

  console.log('\n--- 2. Streaming All 3 Sentences (streamGenerateContent) ---');
  const tStream0 = Date.now();
  const respStream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullText }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    })
  });

  const reader = respStream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamFirstChunkTime = null;
  let firstChunkBytes = 0;
  let totalChunks = 0;
  let totalStreamBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const data = JSON.parse(jsonStr);
        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          totalChunks++;
          const b = Buffer.from(inlineData.data, 'base64');
          totalStreamBytes += b.length;
          if (streamFirstChunkTime === null) {
            streamFirstChunkTime = Date.now() - tStream0;
            firstChunkBytes = b.length;
          }
        }
      } catch {}
    }
  }
  const streamTotalTime = Date.now() - tStream0;
  console.log(`Streaming All 3 Sentences: First Sound Ready at ${streamFirstChunkTime}ms (${firstChunkBytes} bytes in first chunk)`);
  console.log(`Streaming All 3 Sentences: Complete in ${streamTotalTime}ms (${totalChunks} chunks, ${totalStreamBytes} total bytes)`);

  console.log('\n--- 3. Streaming Sentence 1 Only (streamGenerateContent) ---');
  const tStreamS1_0 = Date.now();
  const respStreamS1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: s1 }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    })
  });

  const readerS1 = respStreamS1.body.getReader();
  buffer = '';
  let streamS1FirstChunkTime = null;
  while (true) {
    const { done, value } = await readerS1.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const data = JSON.parse(jsonStr);
        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data && streamS1FirstChunkTime === null) {
          streamS1FirstChunkTime = Date.now() - tStreamS1_0;
        }
      } catch {}
    }
  }
  console.log(`Streaming Sentence 1 Only: First Sound Ready at ${streamS1FirstChunkTime}ms`);

  console.log('\n--- Comparison Summary ---');
  console.log(`Pipelined Sentence 1 (generateContent): ${timePipeFirstSound}ms`);
  console.log(`Streaming Full Text (streamGenerateContent): ${streamFirstChunkTime}ms`);
  console.log(`Streaming Sentence 1 (streamGenerateContent): ${streamS1FirstChunkTime}ms`);
}

runDirectComparison().catch(e => console.error(e));
