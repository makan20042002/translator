const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_test_nav';

const chrome = spawn(chromePath, [
  '--remote-debugging-port=9227',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  'about:blank'
]);

async function check() {
  await new Promise(r => setTimeout(r, 1200));
  http.get('http://127.0.0.1:9227/json', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', async () => {
      const list = JSON.parse(d);
      const page = list.find(t => t.type === 'page');
      if (!page) { chrome.kill(); return; }

      const ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'chrome://extensions' } }));
      };

      ws.onmessage = async e => {
        const msg = JSON.parse(e.data);
        if (msg.id === 2) {
          await new Promise(res => setTimeout(res, 1200));
          ws.send(JSON.stringify({
            id: 3,
            method: 'Runtime.evaluate',
            params: {
              expression: `
                const mgr = document.querySelector('extensions-manager');
                const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
                const items = list ? Array.from(list.shadowRoot.querySelectorAll('extensions-item')) : [];
                items.map(it => ({
                  id: it.id,
                  name: it.shadowRoot.querySelector('#name')?.textContent,
                  version: it.shadowRoot.querySelector('#version')?.textContent,
                  errors: it.shadowRoot.querySelector('#errors-button')?.textContent?.trim()
                }));
              `,
              returnByValue: true
            }
          }));
        } else if (msg.id === 3) {
          console.log('Extensions detected in Chrome:', JSON.stringify(msg.result?.value, null, 2));
          ws.close();
          chrome.kill();
        }
      };
    });
  });
}

check().catch(e => {
  console.error(e);
  chrome.kill();
});
