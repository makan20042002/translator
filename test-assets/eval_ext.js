const http = require('http');
const { spawn } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_dev_eval';

const proc = spawn(chromePath, [
  '--remote-debugging-port=9893',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9893/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'chrome://extensions' } }));
    await new Promise(r => setTimeout(r, 2000));

    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const mgr = document.querySelector('extensions-manager');
          if (!mgr) return 'No mgr';
          const sr = mgr.shadowRoot;
          if (!sr) return 'No sr';
          return Array.from(sr.querySelectorAll('*')).map(el => el.tagName + (el.id ? '#' + el.id : '')).join(', ');
        })()`,
        returnByValue: true
      }
    }));
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 2) {
        console.log('Extensions Elements response:', JSON.stringify(d));
        ws.close();
        proc.kill();
      }
    });
  } catch (e) {
    console.error(e);
    proc.kill();
  }
}, 2000);
