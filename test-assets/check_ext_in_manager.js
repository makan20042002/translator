const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('extension');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_dev_click';

const proc = spawn(chromePath, [
  '--remote-debugging-port=9896',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9896/json', res => {
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
          const itemList = mgr?.shadowRoot?.querySelector('extensions-item-list');
          const items = itemList?.shadowRoot ? Array.from(itemList.shadowRoot.querySelectorAll('extensions-item')) : [];
          return items.map(it => ({
            id: it.id,
            name: it.shadowRoot?.querySelector('#name')?.textContent,
            desc: it.shadowRoot?.querySelector('#description')?.textContent
          }));
        })()`,
        returnByValue: true
      }
    }));

    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 2) {
        console.log('Items in chrome://extensions:', d.result?.result?.value);
        ws.close();
        proc.kill();
      }
    });

  } catch (e) {
    console.error(e);
    proc.kill();
  }
}, 2000);
