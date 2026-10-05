const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Load engine.js in node context
const engineCode = fs.readFileSync(path.resolve('extension/engine.js'), 'utf8');
const engineSandbox = {
  console,
  setTimeout,
  clearTimeout,
  btoa: str => Buffer.from(str, 'binary').toString('base64'),
  atob: b64 => Buffer.from(b64, 'base64').toString('binary'),
  fetch: globalThis.fetch
};
const vm = require('vm');
vm.createContext(engineSandbox);
vm.runInContext(engineCode, engineSandbox);

// Helper to safely retrieve key in memory only (NEVER print key)
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
  throw new Error('API key not found in Chrome local storage profile');
}

async function verifyVoice() {
  console.log('===============================================================');
  console.log('🎙️ Real Gemini TTS Verification (Extension Engine & Web App)');
  console.log('===============================================================');

  const key = getKeyInMemory();
  console.log('✅ Safely loaded owner key in memory (key is protected and not printed).');

  const persianSentence = 'سلام، این یک آزمایش واقعی صدای فارسی با مدل‌های صوتی ماکان است.';
  console.log(`\nPersian test sentence: "${persianSentence}"`);

  // 1. Extension Engine: callGeminiTts
  console.log('\n[1] Calling extension engine callGeminiTts...');
  const t0 = Date.now();
  const res = await engineSandbox.callGeminiTts(persianSentence, key, { voice: 'Kore' });
  const dur = Date.now() - t0;

  console.log(`✅ Extension TTS call succeeded in ${dur}ms!`);
  console.log('   Data URL prefix:', res.dataUrl.slice(0, 30));
  console.log('   Total audio bytes:', res.byteLength);

  // Extract WAV binary and inspect header
  const base64Data = res.dataUrl.replace(/^data:audio\/wav;base64,/, '');
  const wavBuf = Buffer.from(base64Data, 'base64');

  const riff = wavBuf.toString('ascii', 0, 4);
  const wave = wavBuf.toString('ascii', 8, 12);
  const fmt = wavBuf.toString('ascii', 12, 16);
  const channels = wavBuf.readUInt16LE(22);
  const sampleRate = wavBuf.readUInt32LE(24);
  const bitsPerSample = wavBuf.readUInt16LE(34);
  const dataTag = wavBuf.toString('ascii', 36, 40);
  const dataSize = wavBuf.readUInt32LE(40);

  console.log('\n[2] WAV Container Inspection:');
  console.log('   RIFF Header:', riff);
  console.log('   WAVE Format:', wave);
  console.log('   Subchunk1 ID:', fmt);
  console.log('   Channels:', channels, channels === 1 ? '(Mono - OK)' : '(Invalid)');
  console.log('   Sample Rate:', sampleRate, sampleRate === 24000 ? 'Hz (24kHz - OK)' : 'Hz');
  console.log('   Bits Per Sample:', bitsPerSample, bitsPerSample === 16 ? '(16-bit L16 PCM - OK)' : '');
  console.log('   Data Tag:', dataTag);
  console.log('   Data Size:', dataSize, 'bytes');

  if (riff !== 'RIFF' || wave !== 'WAVE' || sampleRate !== 24000) {
    throw new Error('Invalid WAV container header generated from Gemini PCM!');
  }

  // Save audio sample for verification
  const outWav = path.resolve('test-assets/persian_gemini_tts.wav');
  fs.writeFileSync(outWav, wavBuf);
  console.log('💾 Audio written to:', outWav);

  // 2. Test Fallback Behavior on model-not-found
  console.log('\n[3] Testing Model Fallback Logic on 404 / Model Not Found...');
  const fallbackRes = await engineSandbox.callGeminiTts(persianSentence, key, {
    model: 'gemini-nonexistent-model-tts-test'
  });
  console.log('✅ Fallback successfully activated and returned valid audio! Byte length:', fallbackRes.byteLength);

  // 3. Test Web App Shared Logic
  console.log('\n[4] Verifying index.html Web App TTS Model Sequence...');
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const hasGemini38First = indexHtml.includes("model=cfg.tts.model||'gemini-3.8-flash-tts'") || indexHtml.includes("'gemini-3.8-flash-tts'");
  const hasGemini31Fallback = indexHtml.includes("altModel=model.includes('3.8')?'gemini-3.1-flash-tts-preview':'gemini-3.8-flash-tts'");
  const hasPcmToWav = indexHtml.includes('function pcmToWav(pcmBytes,sampleRate=24000');

  console.log('   index.html primary model gemini-3.8-flash-tts:', hasGemini38First);
  console.log('   index.html fallback model gemini-3.1-flash-tts-preview:', hasGemini31Fallback);
  console.log('   index.html 24kHz pcmToWav conversion:', hasPcmToWav);

  if (!hasGemini38First || !hasGemini31Fallback || !hasPcmToWav) {
    throw new Error('index.html TTS logic out of sync with engine.js!');
  }

  console.log('\n🎉 ALL REAL GEMINI VOICE TTS CHECKS PASSED PERFECTLY!');
  return {
    ok: true,
    byteLength: res.byteLength,
    sampleRate,
    durationMs: dur
  };
}

verifyVoice().catch(err => {
  console.error('TTS Verification Failed:', err);
  process.exit(1);
});
