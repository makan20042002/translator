const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ptt_test';

async function waitForCdp(maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9225/json', r => {
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

async function main() {
  const chrome = spawn(chromePath, [
    '--remote-debugging-port=9225',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    'http://localhost:8080/index.html'
  ]);

  try {
    const wsUrl = await waitForCdp();
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise(r => ws.addEventListener('open', r));

    await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1366, height: 900, deviceScaleFactor: 1, mobile: false
    });

    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
    await new Promise(r => setTimeout(r, 1200));

    // Switch to Voice tab
    const evalRes = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button[data-tab="voice"]');
        if (btn) { btn.click(); return 'clicked'; }
        return 'not found';
      })()`,
      returnByValue: true
    });
    console.log('Voice tab click eval:', evalRes);
    await new Promise(r => setTimeout(r, 800));

    // Capture Conversation view with PTT button
    let shot = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('test-assets/screenshots/voice_conv_ptt.png', Buffer.from(shot.data, 'base64'));
    fs.writeFileSync('C:/Users/Makan/.gemini/antigravity-ide/brain/f145b85e-b75c-42f2-bbe9-1a16606313b4/voice_conv_ptt.png', Buffer.from(shot.data, 'base64'));

    // Switch to Ask AI view
    const askRes = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('vTabAsk');
        if (btn) { btn.click(); return 'clicked ask'; }
        return 'not found ask';
      })()`,
      returnByValue: true
    });
    console.log('Ask click eval:', askRes);
    await new Promise(r => setTimeout(r, 800));

    shot = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('test-assets/screenshots/voice_ask_ptt.png', Buffer.from(shot.data, 'base64'));
    fs.writeFileSync('C:/Users/Makan/.gemini/antigravity-ide/brain/f145b85e-b75c-42f2-bbe9-1a16606313b4/voice_ask_ptt.png', Buffer.from(shot.data, 'base64'));

    console.log('Voice screenshots captured successfully!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
