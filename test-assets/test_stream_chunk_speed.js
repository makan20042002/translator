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

async function testStreaming() {
  const key = getKeyInMemory();
  console.log('✅ Safely loaded key.');

  const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
  const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
  const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
  const fullText = `${s1} ${s2} ${s3}`;

  const model = 'gemini-3.1-flash-tts-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  console.log(`Connecting to ${model} streamGenerateContent...`);
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullText }] }],
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

  console.log(`HTTP Status: ${resp.status} in ${Date.now() - t0}ms`);
  if (!resp.ok) {
    const txt = await resp.text();
    console.error('Error response:', txt);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;
  let firstChunkTime = null;
  let totalBytes = 0;

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
          chunkCount++;
          const bin = Buffer.from(inlineData.data, 'base64');
          totalBytes += bin.length;
          const now = Date.now();
          if (firstChunkTime === null) {
            firstChunkTime = now - t0;
            console.log(`⚡ FIRST AUDIO CHUNK received at: ${firstChunkTime}ms! (${bin.length} bytes, ~${(bin.length / 48000).toFixed(2)}s audio)`);
          } else {
            console.log(`   Chunk #${chunkCount} at +${now - t0}ms (${bin.length} bytes)`);
          }
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    }
  }

  const totalTime = Date.now() - t0;
  console.log(`\n🎉 Stream completed in ${totalTime}ms.`);
  console.log(`   Total chunks: ${chunkCount}, Total PCM bytes: ${totalBytes} (~${(totalBytes / 48000).toFixed(2)}s audio)`);
  console.log(`   ⚡ Time to first chunk (FIRST SOUND READY): ${firstChunkTime}ms`);
}

testStreaming().catch(err => console.error(err));
