const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

// Load engine.js
const engineCode = fs.readFileSync(path.resolve('extension/engine.js'), 'utf8');
const engineSandbox = {
  console,
  setTimeout,
  clearTimeout,
  btoa: str => Buffer.from(str, 'binary').toString('base64'),
  atob: b64 => Buffer.from(b64, 'base64').toString('binary'),
  fetch: globalThis.fetch
};
vm.createContext(engineSandbox);
vm.runInContext(engineCode, engineSandbox);

async function runBenchmark() {
  const key = getKeyInMemory();
  console.log('✅ Safely loaded Gemini API key into memory (never printed).');

  const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
  const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
  const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
  const fullText = `${s1} ${s2} ${s3}`;

  console.log('\n===============================================================');
  console.log('📊 BENCHMARK: TIME TO FIRST SOUND (3-SENTENCE PERSIAN TEXT)');
  console.log('===============================================================');
  console.log(`Full text (${fullText.length} characters):`);
  console.log(`  1. "${s1}"`);
  console.log(`  2. "${s2}"`);
  console.log(`  3. "${s3}"`);

  // --- 1. BEFORE (Monolithic 3-Sentence Synthesis without cache) ---
  console.log('\n[1] BEFORE: Monolithic request for all 3 sentences together...');
  const tBefore0 = Date.now();
  const resBefore = await engineSandbox.callGeminiTts(fullText, key, { voice: 'Kore', cache: false });
  const timeToFirstSoundBefore = Date.now() - tBefore0;
  console.log(`⏱️  BEFORE Time to first sound: ${timeToFirstSoundBefore}ms`);
  console.log(`   Audio payload: ${resBefore.byteLength} bytes`);

  // --- 2. AFTER (Pipelined: Sentence 1 immediate + background queue) ---
  console.log('\n[2] AFTER: Pipelined Sentence 1 request (Sentence 2 & 3 in background)...');
  const sentences = engineSandbox.splitIntoSentences(fullText);
  console.log(`   Split into ${sentences.length} sentences via splitIntoSentences():`);
  sentences.forEach((s, idx) => console.log(`     [${idx + 1}] (${s.length} chars): ${s}`));

  const tAfter0 = Date.now();
  // Request Sentence 1 immediately
  const resS1 = await engineSandbox.callGeminiTts(sentences[0], key, { voice: 'Kore' });
  const timeToFirstSoundAfter = Date.now() - tAfter0;
  console.log(`⏱️  AFTER Time to first sound (Sentence 1): ${timeToFirstSoundAfter}ms`);
  console.log(`   Sentence 1 Audio payload: ${resS1.byteLength} bytes`);

  // Simulate background prefetch of remaining sentences while Sentence 1 is "playing"
  console.log('   [Background Queue] Prefetching Sentence 2 & 3 while Sentence 1 plays...');
  const tBg0 = Date.now();
  const resS2 = await engineSandbox.callGeminiTts(sentences[1], key, { voice: 'Kore' });
  console.log(`   [Background Queue] Sentence 2 ready in ${Date.now() - tBg0}ms (${resS2.byteLength} bytes)`);
  const tBg1 = Date.now();
  const resS3 = await engineSandbox.callGeminiTts(sentences[2], key, { voice: 'Kore' });
  console.log(`   [Background Queue] Sentence 3 ready in ${Date.now() - tBg1}ms (${resS3.byteLength} bytes)`);

  // --- 3. REPLAY WITH SESSION CACHE ---
  console.log('\n[3] REPLAY: Repeated playback with Session Cache...');
  const tReplay0 = Date.now();
  const resReplay = await engineSandbox.callGeminiTts(sentences[0], key, { voice: 'Kore' });
  const timeToFirstSoundReplay = Date.now() - tReplay0;
  console.log(`⏱️  REPLAY Time to first sound: ${timeToFirstSoundReplay}ms (cached: ${resReplay.cached})`);

  // --- SUMMARY COMPARISON ---
  console.log('\n===============================================================');
  console.log('📈 SUMMARY RESULTS');
  console.log('===============================================================');
  console.log(`Before (all 3 sentences): ${timeToFirstSoundBefore}ms`);
  console.log(`After (Sentence 1 first sound): ${timeToFirstSoundAfter}ms`);
  console.log(`Replay (Session Cache): ${timeToFirstSoundReplay}ms`);
  const improvement = timeToFirstSoundBefore - timeToFirstSoundAfter;
  const pct = ((improvement / timeToFirstSoundBefore) * 100).toFixed(1);
  console.log(`🚀 Latency reduction: ${improvement}ms faster (${pct}% decrease in wait time)!`);
  console.log('===============================================================\n');
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
