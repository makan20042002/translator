const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Makan\\.gemini\\antigravity-ide\\brain\\cdfe70cf-e518-4301-84dc-925638991df7';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function waitForCdp(port = 9225, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json`, r => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(data));
        }).on('error', reject);
      });
      const list = JSON.parse(res);
      const page = list.find(x => x.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP not reachable');
}

function sendCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = evt => {
      try {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function capture() {
  const configs = [
    { w: 1366, h: 800, lang: 'en' },
    { w: 1366, h: 800, lang: 'fa' },
    { w: 1920, h: 1080, lang: 'en' },
    { w: 1920, h: 1080, lang: 'fa' },
    { w: 390, h: 844, lang: 'en' },
    { w: 390, h: 844, lang: 'fa' }
  ];

  for (const cfg of configs) {
    console.log(`Capturing before ${cfg.w}x${cfg.h} [${cfg.lang}]...`);
    const tmpDir = path.join(__dirname, `chrome_prof_before_${cfg.w}_${cfg.lang}`);
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-port=9225',
      `--window-size=${cfg.w},${cfg.h}`,
      '--user-data-dir=' + tmpDir,
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      'http://localhost:8080/index.html'
    ]);

    try {
      const wsUrl = await waitForCdp(9225);
      const ws = new globalThis.WebSocket(wsUrl);
      await new Promise(r => ws.addEventListener('open', r));

      await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
        width: cfg.w,
        height: cfg.h,
        deviceScaleFactor: 1,
        mobile: cfg.w <= 500
      });

      await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
      await new Promise(r => setTimeout(r, 1200));

      await sendCdp(ws, 'Runtime.evaluate', {
        expression: `(() => {
          if ('${cfg.lang}' === 'fa') {
            ui = 'fa';
            store.set('ui', 'fa');
          } else {
            ui = 'en';
            store.set('ui', 'en');
          }
          boot();
          const btn = document.querySelector('#tabs button[data-tab="voice"]');
          if (btn) btn.click();
        })()`,
        returnByValue: true
      });

      await new Promise(r => setTimeout(r, 600));

      const shot = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
      const filename = `before_voice_${cfg.w}_${cfg.lang}.png`;
      fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), Buffer.from(shot.data, 'base64'));
      fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(shot.data, 'base64'));
      console.log(`Saved ${filename}`);
      ws.close();
    } finally {
      chrome.kill();
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

capture().then(() => console.log('All before screenshots captured successfully.')).catch(console.error);
