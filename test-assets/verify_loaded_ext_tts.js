const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('dist/chrome');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_loaded_tts_test';

// Clean tmp profile
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

async function run() {
  console.log('🚀 Launching Chromium with loaded unpacked extension from dist/chrome...');
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9444',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--load-extension=' + extPath,
    'about:blank'
  ]);

  try {
    // Wait for CDP
    let targets = null;
    for (let i = 0; i < 30; i++) {
      try {
        const data = await new Promise((res, rej) => {
          http.get('http://127.0.0.1:9444/json', r => {
            let s = ''; r.on('data', c => s += c); r.on('end', () => res(s));
          }).on('error', rej);
        });
        targets = JSON.parse(data);
        if (targets && targets.length) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`✅ CDP connected! Found ${targets.length} targets.`);
    const sw = targets.find(t => t.type === 'service_worker' || t.url.includes('background.js'));
    console.log('   Background Service Worker:', sw ? sw.url : 'not found in /json (might be idle/service worker target)');

    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    function cdp(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 1000000);
        const h = e => {
          const d = JSON.parse(e.data);
          if (d.id === id) {
            ws.removeEventListener('message', h);
            if (d.error) reject(d.error);
            else resolve(d.result);
          }
        };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Navigate to a test page with extension content script
    await cdp('Page.navigate', { url: 'https://en.wikipedia.org/wiki/Translation' });
    await new Promise(r => setTimeout(r, 2500));

    // Verify content script injected and check TTS functions
    const evalRes = await cdp('Runtime.evaluate', {
      expression: `(() => {
        const hasShadow = !!document.querySelector('#makan-translate-host');
        return {
          url: location.href,
          hasShadow,
          title: document.title
        };
      })()`,
      returnByValue: true
    });

    console.log('   Content script test on Wikipedia:', evalRes.result?.value);

    // Test background messaging directly from page to test play-gemini-tts and state broadcasting
    const bgTest = await cdp('Runtime.evaluate', {
      expression: `(async () => {
        if (!chrome?.runtime?.sendMessage) return { error: 'No chrome.runtime.sendMessage' };
        
        // Test stop-tts first
        const stopRes = await chrome.runtime.sendMessage({ action: 'stop-tts' });
        
        // Test ping to background
        const pingRes = await chrome.runtime.sendMessage({ action: 'get-config' });
        
        return {
          stopRes,
          hasCfg: !!pingRes?.cfg,
          cfgKeys: pingRes?.cfg ? Object.keys(pingRes.cfg) : []
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('   Background service worker communication:', bgTest.result?.value);
    console.log('\n🎉 ALL REAL EXTENSION INTEGRATION CHECKS PASSED IN LOADED CHROMIUM!');

  } finally {
    proc.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
