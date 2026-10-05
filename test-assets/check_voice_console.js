const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_debug_test';

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
    'http://localhost:8080/index.html'
  ]);

  try {
    const wsUrl = await waitForCdp();
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.addEventListener('message', evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[Console]', msg.params.type, msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.log('[Exception]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
        }
      } catch {}
    });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
    await new Promise(r => setTimeout(r, 1500));

    const check = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          activeTab: document.querySelector('.tab.on')?.id,
          hasVoiceBtn: !!document.querySelector('#tabs button[data-tab="voice"]'),
          voiceTabExists: !!document.getElementById('tab-voice')
        };
      })()`,
      returnByValue: true
    });
    console.log('Page state:', check.result.value);

    // Switch to voice tab
    const voiceSwitch = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(() => {
        try {
          const btn = document.querySelector('#tabs button[data-tab="voice"]');
          btn.click();
          return {
            activeTab: document.querySelector('.tab.on')?.id,
            voiceState: typeof voiceState !== 'undefined' ? voiceState : 'undefined',
            pttBtnExists: !!document.getElementById('vPttBtn')
          };
        } catch(e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      returnByValue: true
    });
    console.log('Voice switch state:', voiceSwitch.result.value);

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
