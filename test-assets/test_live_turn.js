const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_live_test';

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

    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
    await new Promise(r => setTimeout(r, 1200));

    // Enable console and runtime
    ws.addEventListener('message', evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[Browser Console]', msg.params.args.map(a => a.value || a.description).join(' '));
        }
      } catch {}
    });
    await sendCdp(ws, 'Runtime.enable');

    // Test Live Loop language switching logic and timing simulation
    const testResult = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(async () => {
        // Switch to Voice tab
        document.querySelector('button[data-tab="voice"]').click();
        $('src').value = 'en';
        $('tgt').value = 'fa';
        $('src').onchange();
        $('tgt').onchange();

        const logs = [];
        // Test alternating language turns in Live loop
        // Turn 1: English clip
        // Turn 2: Persian clip
        // Verify state is clean, loop continues without dying
        const s = $('src').value, t = $('tgt').value;

        // Simulate turn 1 (English)
        let tx1 = "Hello, can you help me find the nearest train station?";
        let hasFarsi1 = /[\\u0600-\\u06FF]/.test(tx1);
        let side1 = (hasFarsi1 ? 'b' : 'a');
        let from1 = (side1 === 'a' ? s : t);
        let to1 = (side1 === 'a' ? t : s);
        let tr1 = await translateItems([tx1], opts({src: from1, tgt: to1}));
        logs.push({ turn: 1, side: side1, from: from1, to: to1, text: tx1, translation: tr1.out[0], used: tr1.used });

        // Simulate turn 2 (Persian)
        let tx2 = "بله حتماً، ایستگاه قطار درست سر خیابان بعدی است.";
        let hasFarsi2 = /[\\u0600-\\u06FF]/.test(tx2);
        let side2 = (hasFarsi2 ? 'b' : 'a');
        let from2 = (side2 === 'a' ? s : t);
        let to2 = (side2 === 'a' ? t : s);
        let tr2 = await translateItems([tx2], opts({src: from2, tgt: to2}));
        logs.push({ turn: 2, side: side2, from: from2, to: to2, text: tx2, translation: tr2.out[0], used: tr2.used });

        // Simulate turn 3 (English again - verifying alternation does not freeze or stop)
        let tx3 = "Thank you very much, I really appreciate it!";
        let hasFarsi3 = /[\\u0600-\\u06FF]/.test(tx3);
        let side3 = (hasFarsi3 ? 'b' : 'a');
        let from3 = (side3 === 'a' ? s : t);
        let to3 = (side3 === 'a' ? t : s);
        let tr3 = await translateItems([tx3], opts({src: from3, tgt: to3}));
        logs.push({ turn: 3, side: side3, from: from3, to: to3, text: tx3, translation: tr3.out[0], used: tr3.used });

        return logs;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Alternating turn test results:');
    console.log(JSON.stringify(testResult.result.value, null, 2));
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
