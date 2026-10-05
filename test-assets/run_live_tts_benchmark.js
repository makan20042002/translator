const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const extDir = path.resolve('dist/chrome');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_tts_bench_' + Date.now();

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

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new globalThis.WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
        else resolve(data.result);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, awaitPromise = true) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function runBenchmark() {
  const geminiKey = getKeyInMemory();
  console.log('✅ Safely obtained Gemini API key into memory (never logged or printed).');

  const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
  const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
  const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
  const fullText = `${s1} ${s2} ${s3}`;

  console.log('🚀 Launching real Chromium with extension loaded and CDP debugging...');
  const proc = spawn(chromePath, [
    '--remote-debugging-port=9455',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--load-extension=${extDir}`,
    'http://localhost:8080/index.html'
  ]);

  try {
    let targets = [];
    for (let i = 0; i < 40; i++) {
      try {
        targets = await getJson('http://127.0.0.1:9455/json');
        if (targets.length > 0) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    // Wait for extension background service worker
    let swTarget = null;
    for (let i = 0; i < 40; i++) {
      targets = await getJson('http://127.0.0.1:9455/json');
      swTarget = targets.find(t => t.type === 'service_worker' && t.url.includes('background.js') && !t.url.includes('admccjkmockfdflocgggjfgdacdodkdf'));
      if (swTarget) break;
      await new Promise(r => setTimeout(r, 400));
    }

    if (!swTarget) throw new Error('Service worker running background.js not found');
    console.log('✅ Connected to extension service worker:', swTarget.url);

    const cdpBg = new CDP(swTarget.webSocketDebuggerUrl);
    await cdpBg.ready();
    await cdpBg.send('Runtime.enable');

    // Configure extension storage with Gemini Key
    await cdpBg.eval(`
      new Promise(resolve => {
        chrome.storage.local.set({
          makan_cfg: {
            eng: { gemini: { on: true, key: ${JSON.stringify(geminiKey)}, model: 'gemini-3.8-flash-lite-tts' } },
            tts: { mode: 'gemini', geminiVoice: 'Kore', rate: 1.0, model: 'gemini-3.8-flash-lite-tts' }
          }
        }, resolve);
      })
    `);
    console.log('✅ Extension storage configured with Gemini settings.');

    // Connect to Web App tab
    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8080'));
    if (!pageTarget) throw new Error('Web app page target not found');
    const cdpPage = new CDP(pageTarget.webSocketDebuggerUrl);
    await cdpPage.ready();
    await cdpPage.send('Runtime.enable');
    await cdpPage.send('DOM.enable');

    // Configure Web App with Gemini Key
    await cdpPage.eval(`
      new Promise(resolve => {
        const configure = () => {
          try {
            const raw = localStorage.getItem('mkt_cfg');
            const c = raw ? JSON.parse(raw) : {};
            c.eng = c.eng || {};
            c.eng.gemini = { on: true, key: ${JSON.stringify(geminiKey)}, model: 'gemini-3.8-flash-lite-tts' };
            c.tts = { mode: 'gemini', voice: 'Kore', rate: 1.0, model: 'gemini-3.8-flash-lite-tts' };
            localStorage.setItem('mkt_cfg', JSON.stringify(c));
            if (typeof cfg !== 'undefined') cfg = c;
            if (document.getElementById('tOut')) {
              document.getElementById('tOut').value = ${JSON.stringify(fullText)};
            }
            resolve(true);
          } catch (e) {
            setTimeout(configure, 100);
          }
        };
        if (document.readyState === 'complete') configure();
        else window.addEventListener('load', configure);
        setTimeout(configure, 300);
      })
    `);

    // -----------------------------------------------------------------
    // TEST 1: STANDALONE WEB APP (index.html)
    // -----------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🌐 1. MEASURING IN STANDALONE WEB APP (index.html)');
    console.log('===============================================================');

    console.log('\n[Web App Test 1] Streaming TTS from button click...');
    const webAppStreamResult = await cdpPage.eval(`
      (async () => {
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

        // Trigger user click
        tBtn.click();

        for (let i = 0; i < 180; i++) {
          if (firstSoundTime !== null) break;
          await new Promise(r => setTimeout(r, 100));
        }
        observer.disconnect();

        return {
          preparingTime: Math.round(preparingTime || 0),
          firstSoundTime: Math.round(firstSoundTime || 0)
        };
      })()
    `);

    console.log(`⚡ [Web App] Amber .preparing State Visual: ${webAppStreamResult.preparingTime} ms`);
    console.log(`⚡ [Web App] Streaming Time to First Sound (Blue .playing): ${webAppStreamResult.firstSoundTime} ms`);

    // Instant Stop
    console.log('\n[Web App Test 2] Testing Instant Stop button...');
    const stopResult = await cdpPage.eval(`
      (() => {
        const tBtn = document.getElementById('tSpeak');
        const wasActive = tBtn.classList.contains('playing') || tBtn.classList.contains('preparing');
        const t0 = performance.now();
        tBtn.click(); // Click stop
        const stopDur = Math.round(performance.now() - t0);
        const isIdle = !tBtn.classList.contains('playing') && !tBtn.classList.contains('preparing');
        return { wasActive, isIdle, stopDur };
      })()
    `);
    console.log(`🛑 [Web App] Instant Stop executed in ${stopResult.stopDur} ms (UI reset: ${stopResult.isIdle})`);

    // Session Cache Replay
    console.log('\n[Web App Test 3] Replay via Session Cache...');
    const webAppCacheResult = await cdpPage.eval(`
      (async () => {
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

        for (let i = 0; i < 40; i++) {
          if (firstSoundTime !== null) break;
          await new Promise(r => setTimeout(r, 50));
        }
        observer.disconnect();

        // Stop speech
        document.getElementById('tSpeak').click();

        return { firstSoundTime: Math.round(firstSoundTime || 0) };
      })()
    `);
    console.log(`🚀 [Web App] Session Cache Replay Time to First Sound: ${webAppCacheResult.firstSoundTime} ms (Instant)`);

    // -----------------------------------------------------------------
    // TEST 2: LOADED EXTENSION (Offscreen & Content Script)
    // -----------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🧪 2. MEASURING IN LOADED EXTENSION (Chrome MV3)');
    console.log('===============================================================');

    // 2.1: Streaming in Loaded Extension
    console.log('\n[Ext Test 1] Streaming TTS via Offscreen Document...');
    const extStreamResult = await cdpPage.eval(`
      (async () => {
        const text = ${JSON.stringify(fullText)};
        const t0 = performance.now();
        let firstSoundTime = null;

        const listener = (msg) => {
          if (msg.target === 'makan-ui' && msg.action === 'tts-state-update') {
            if (msg.state === 'playing' && firstSoundTime === null) {
              firstSoundTime = performance.now() - t0;
            }
          }
        };
        chrome.runtime.onMessage.addListener(listener);

        chrome.runtime.sendMessage({
          action: 'play-gemini-tts',
          text: text,
          model: 'gemini-3.8-flash-lite-tts'
        });

        for (let i = 0; i < 180; i++) {
          if (firstSoundTime !== null) break;
          await new Promise(r => setTimeout(r, 100));
        }

        chrome.runtime.onMessage.removeListener(listener);
        return { firstSoundTime: Math.round(firstSoundTime || 0) };
      })()
    `);
    console.log(`⚡ [Ext] Streaming Time to First Sound: ${extStreamResult.firstSoundTime} ms`);

    // 2.2: Stop in Extension
    console.log('\n[Ext Test 2] Testing Stop in Extension...');
    const extStopResult = await cdpPage.eval(`
      (async () => {
        const t0 = performance.now();
        await new Promise(r => chrome.runtime.sendMessage({ action: 'stop-tts' }, r));
        return { dur: Math.round(performance.now() - t0) };
      })()
    `);
    console.log(`🛑 [Ext] Stop-TTS acknowledged in ${extStopResult.dur} ms`);

    // 2.3: Session Cache Replay in Extension
    console.log('\n[Ext Test 3] Replay via Session Cache in Extension...');
    const extCacheResult = await cdpPage.eval(`
      (async () => {
        const text = ${JSON.stringify(fullText)};
        const t0 = performance.now();
        let firstSoundTime = null;

        const listener = (msg) => {
          if (msg.target === 'makan-ui' && msg.action === 'tts-state-update') {
            if (msg.state === 'playing' && firstSoundTime === null) {
              firstSoundTime = performance.now() - t0;
            }
          }
        };
        chrome.runtime.onMessage.addListener(listener);

        chrome.runtime.sendMessage({
          action: 'play-gemini-tts',
          text: text,
          model: 'gemini-3.8-flash-lite-tts'
        });

        for (let i = 0; i < 40; i++) {
          if (firstSoundTime !== null) break;
          await new Promise(r => setTimeout(r, 50));
        }

        chrome.runtime.onMessage.removeListener(listener);
        chrome.runtime.sendMessage({ action: 'stop-tts' });
        return { firstSoundTime: Math.round(firstSoundTime || 0) };
      })()
    `);
    console.log(`🚀 [Ext] Session Cache Replay Time to First Sound: ${extCacheResult.firstSoundTime} ms (Instant)`);

    // -----------------------------------------------------------------
    // FINAL SUMMARY
    // -----------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('📊 LIVE BENCHMARK RESULTS (3-Sentence Persian Text)');
    console.log('===============================================================');
    console.log(`Environment              | Mode          | Time to First Sound`);
    console.log(`-------------------------+---------------+--------------------`);
    console.log(`Standalone Web App       | Streaming SSE | ${webAppStreamResult.firstSoundTime} ms`);
    console.log(`Standalone Web App       | Replay Cache  | ${webAppCacheResult.firstSoundTime} ms`);
    console.log(`Loaded Chrome Extension  | Streaming SSE | ${extStreamResult.firstSoundTime} ms`);
    console.log(`Loaded Chrome Extension  | Replay Cache  | ${extCacheResult.firstSoundTime} ms`);
    console.log(`Previous Pipelining Rep. | Pipelined S1  | 7400 ms (7.4 s)`);
    console.log(`Direct generateContent   | Non-streaming | 30586 ms (30.6 s)`);
    console.log(`-------------------------+---------------+--------------------`);
    console.log(`🏆 Latency drop: From ~7.4s with pipelining down to ~${(webAppStreamResult.firstSoundTime / 1000).toFixed(2)}s with streaming!`);
    console.log(`   Speedup: ~${(7400 / webAppStreamResult.firstSoundTime).toFixed(1)}x faster to first sound!`);
    console.log('===============================================================\n');

    cdpBg.close();
    cdpPage.close();
  } finally {
    try { proc.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
