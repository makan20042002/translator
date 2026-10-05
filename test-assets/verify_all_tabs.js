const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_tabs_verify';

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
    'http://localhost:8080/index.html'
  ]);

  try {
    const wsUrl = await waitForCdp();
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise(r => ws.addEventListener('open', r));

    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
    await new Promise(r => setTimeout(r, 1200));

    const res = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(async () => {
        const results = {};
        
        // 1. Text Tab translation
        document.querySelector('button[data-tab="text"]').click();
        $('tIn').value = 'Testing MAKAN Translate text engine.';
        $('src').value = 'en'; $('tgt').value = 'fa';
        await doText();
        results.text = { input: $('tIn').value, output: $('tOut').value };

        // 2. Compare Tab
        document.querySelector('button[data-tab="cmp"]').click();
        $('cIn').value = 'Quick comparison test.';
        results.compareReady = !!$('cGo');

        // 3. Glossary Tab
        document.querySelector('button[data-tab="gls"]').click();
        results.glossaryCount = glossary.length;

        // 4. History Tab
        document.querySelector('button[data-tab="hist"]').click();
        renderHist();
        results.historyItems = document.querySelectorAll('#hList .item').length;

        // 5. Document Tab
        document.querySelector('button[data-tab="doc"]').click();
        results.docReady = !$('dDrop').hidden;

        // 6. Subtitle Tab
        document.querySelector('button[data-tab="sub"]').click();
        results.subReady = !!$('sDrop');

        // 7. Settings dialog
        $('openSet').click();
        results.settingsOpen = $('ov').classList.contains('on');
        $('closeSet').click();

        return results;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Tabs verification results:');
    console.log(JSON.stringify(res.result.value, null, 2));
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
