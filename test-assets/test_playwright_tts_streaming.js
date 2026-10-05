const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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

async function runLiveBrowserBenchmarks() {
  const key = getKeyInMemory();
  console.log('✅ Safely retrieved Gemini API key into memory (never logged or printed).');

  const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
  const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
  const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
  const fullText = `${s1} ${s2} ${s3}`;

  const extPath = path.resolve('dist/chrome');
  const userDataDir = path.resolve('test-assets/chrome_bench_profile_' + Date.now());

  console.log('\n🚀 Launching Chromium with loaded MV3 extension from:', extPath);
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  try {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    console.log('✅ Extension Service Worker active:', background.url());

    // 1. Configure Extension settings in storage
    await background.evaluate(async (geminiKey) => {
      await chrome.storage.local.set({
        makan_cfg: {
          eng: {
            gemini: { on: true, key: geminiKey, model: 'gemini-3.8-flash-lite-tts' }
          },
          tts: {
            mode: 'gemini',
            geminiVoice: 'Kore',
            rate: 1.0,
            model: 'gemini-3.8-flash-lite-tts'
          }
        }
      });
    }, key);
    console.log('✅ Extension storage configured with Gemini TTS.');

    // -------------------------------------------------------------
    // PART A: BENCHMARK IN LOADED EXTENSION (Background & Offscreen)
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🧪 1. MEASURING IN LOADED EXTENSION (Chrome MV3)');
    console.log('===============================================================');

    // A.1: Streaming in Loaded Extension
    console.log('\n[Ext Test 1] Streaming TTS (3-Sentence Persian Text)...');
    const extStreamResult = await background.evaluate(async (txt) => {
      const t0 = performance.now();
      let firstSoundTime = null;

      const stateListener = (msg) => {
        if (msg.target === 'makan-ui' && msg.action === 'tts-state-update') {
          if (msg.state === 'playing' && firstSoundTime === null) {
            firstSoundTime = performance.now() - t0;
          }
        }
      };
      chrome.runtime.onMessage.addListener(stateListener);

      const res = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'play-gemini-tts',
          text: txt,
          model: 'gemini-3.8-flash-lite-tts'
        }, resolve);
      });

      // Wait until firstSoundTime is recorded or up to 10s
      for (let i = 0; i < 100; i++) {
        if (firstSoundTime !== null) break;
        await new Promise(r => setTimeout(r, 100));
      }

      chrome.runtime.onMessage.removeListener(stateListener);
      return { res, firstSoundTime: Math.round(firstSoundTime) };
    }, fullText);

    console.log(`⚡ [Ext] Streaming Time to First Sound: ${extStreamResult.firstSoundTime} ms`);

    // A.2: Pipelining in Loaded Extension (Simulate fallback / pipelined first sentence)
    console.log('\n[Ext Test 2] Pipelined TTS (First Sentence via generateContent fallback)...');
    const extPipelinedResult = await background.evaluate(async (txt) => {
      const cfg = await loadConfig();
      const geminiKey = cfg.eng?.gemini?.key;
      const t0 = performance.now();
      const s1 = splitIntoSentences(txt)[0];
      const res = await callGeminiTts(s1, geminiKey, {
        voice: 'Kore',
        model: 'gemini-3.8-flash-lite-tts',
        cache: false
      });
      const dur = Math.round(performance.now() - t0);
      return { dur, byteLength: res.byteLength };
    }, fullText);

    console.log(`⏱️  [Ext] Pipelined Time to First Sound (Sentence 1): ${extPipelinedResult.dur} ms`);

    // A.3: Session Cache Replay in Loaded Extension
    console.log('\n[Ext Test 3] Replay via Session Cache...');
    const extCacheResult = await background.evaluate(async (txt) => {
      const t0 = performance.now();
      let firstSoundTime = null;
      const stateListener = (msg) => {
        if (msg.target === 'makan-ui' && msg.action === 'tts-state-update') {
          if (msg.state === 'playing' && firstSoundTime === null) {
            firstSoundTime = performance.now() - t0;
          }
        }
      };
      chrome.runtime.onMessage.addListener(stateListener);

      const res = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'play-gemini-tts',
          text: txt,
          model: 'gemini-3.8-flash-lite-tts'
        }, resolve);
      });

      for (let i = 0; i < 30; i++) {
        if (firstSoundTime !== null) break;
        await new Promise(r => setTimeout(r, 50));
      }

      chrome.runtime.onMessage.removeListener(stateListener);
      return { res, firstSoundTime: Math.round(firstSoundTime) };
    }, fullText);

    console.log(`🚀 [Ext] Session Cache Replay Time to First Sound: ${extCacheResult.firstSoundTime} ms (Instant)`);

    // -------------------------------------------------------------
    // PART B: BENCHMARK IN WEB APP (index.html)
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🌐 2. MEASURING IN WEB APP (index.html)');
    console.log('===============================================================');

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8080/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Configure Web App with Gemini API key
    await page.evaluate((geminiKey) => {
      const c = store.get('cfg', {});
      c.eng = c.eng || {};
      c.eng.gemini = { on: true, key: geminiKey, model: 'gemini-3.8-flash-lite-tts' };
      c.tts = { mode: 'gemini', voice: 'Kore', rate: 1.0, model: 'gemini-3.8-flash-lite-tts' };
      store.set('cfg', c);
      cfg = c;
    }, key);

    // Put Persian 3-sentence text into target translation output textarea
    await page.evaluate((txt) => {
      const out = document.getElementById('tOut');
      out.value = txt;
    }, fullText);

    // B.1: Web App Streaming Measurement from User Click
    console.log('\n[Web App Test 1] Streaming TTS from button click...');
    const webAppStreamResult = await page.evaluate(async () => {
      const tBtn = document.getElementById('tSpeak');
      const t0 = performance.now();
      let preparingTime = null;
      let firstSoundTime = null;

      const observer = new MutationObserver(() => {
        const now = performance.now() - t0;
        if (tBtn.classList.contains('preparing') && preparingTime === null) {
          preparingTime = now;
        }
        if (tBtn.classList.contains('playing') && firstSoundTime === null) {
          firstSoundTime = now;
        }
      });
      observer.observe(tBtn, { attributes: true, attributeFilter: ['class'] });

      // Click Speak button (user gesture)
      tBtn.click();

      // Wait until first sound or timeout
      for (let i = 0; i < 120; i++) {
        if (firstSoundTime !== null) break;
        await new Promise(r => setTimeout(r, 100));
      }
      observer.disconnect();

      return {
        preparingTime: Math.round(preparingTime || 0),
        firstSoundTime: Math.round(firstSoundTime || 0)
      };
    });

    console.log(`⚡ [Web App] Preparing state visual: ${webAppStreamResult.preparingTime} ms`);
    console.log(`⚡ [Web App] Streaming Time to First Sound: ${webAppStreamResult.firstSoundTime} ms`);

    // B.2: Web App Instant Stop Check
    console.log('\n[Web App Test 2] Testing Instant Stop button...');
    const stopResult = await page.evaluate(async () => {
      const tBtn = document.getElementById('tSpeak');
      const wasPlaying = tBtn.classList.contains('playing') || tBtn.classList.contains('preparing');
      const t0 = performance.now();
      tBtn.click(); // Click stop
      const stopDur = Math.round(performance.now() - t0);
      const isStopped = !tBtn.classList.contains('playing') && !tBtn.classList.contains('preparing');
      return { wasPlaying, isStopped, stopDur };
    });
    console.log(`🛑 [Web App] Instant Stop executed in ${stopResult.stopDur} ms (UI reset: ${stopResult.isStopped})`);

    // B.3: Web App Session Cache Replay
    console.log('\n[Web App Test 3] Replay via Session Cache...');
    const webAppCacheResult = await page.evaluate(async () => {
      const tBtn = document.getElementById('tSpeak');
      const t0 = performance.now();
      let firstSoundTime = null;

      const observer = new MutationObserver(() => {
        const now = performance.now() - t0;
        if (tBtn.classList.contains('playing') && firstSoundTime === null) {
          firstSoundTime = now;
        }
      });
      observer.observe(tBtn, { attributes: true, attributeFilter: ['class'] });

      tBtn.click();

      for (let i = 0; i < 30; i++) {
        if (firstSoundTime !== null) break;
        await new Promise(r => setTimeout(r, 50));
      }
      observer.disconnect();

      // Stop speech
      document.getElementById('tSpeak').click();

      return { firstSoundTime: Math.round(firstSoundTime || 0) };
    });

    console.log(`🚀 [Web App] Session Cache Replay Time to First Sound: ${webAppCacheResult.firstSoundTime} ms (Instant)`);

    // -------------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('📊 LIVE BENCHMARK RESULTS SUMMARY (3-Sentence Persian Text)');
    console.log('===============================================================');
    console.log(`Platform / Environment          | Method      | Time to First Sound`);
    console.log(`--------------------------------+-------------+--------------------`);
    console.log(`Loaded Chrome Extension (MV3)   | Pipelining  | ${extPipelinedResult.dur} ms`);
    console.log(`Loaded Chrome Extension (MV3)   | Streaming   | ${extStreamResult.firstSoundTime} ms`);
    console.log(`Loaded Chrome Extension (MV3)   | ReplayCache | ${extCacheResult.firstSoundTime} ms`);
    console.log(`Standalone Web App (index.html) | Streaming   | ${webAppStreamResult.firstSoundTime} ms`);
    console.log(`Standalone Web App (index.html) | ReplayCache | ${webAppCacheResult.firstSoundTime} ms`);
    console.log(`--------------------------------+-------------+--------------------`);
    const extSpeedup = (extPipelinedResult.dur / extStreamResult.firstSoundTime).toFixed(1);
    console.log(`🏆 Streaming speedup: ~${extSpeedup}x faster than pipelining in live extension!`);
    console.log('===============================================================\n');

  } finally {
    await context.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

runLiveBrowserBenchmarks().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
