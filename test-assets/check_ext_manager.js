const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_test_ui';

const chrome = spawn(chromePath, [
  '--remote-debugging-port=9227',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  'chrome://extensions'
]);

async function check() {
  await new Promise(r => setTimeout(r, 2000));
  http.get('http://127.0.0.1:9227/json', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', async () => {
      const list = JSON.parse(d);
      const page = list.find(t => t.url.includes('extensions'));
      if (!page) {
        console.log('No extensions page found:', list);
        chrome.kill();
        return;
      }
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              const mgr = document.querySelector('extensions-manager');
              const list = mgr ? mgr.shadowRoot.querySelector('extensions-item-list') : null;
              const items = list ? Array.from(list.shadowRoot.querySelectorAll('extensions-item')) : [];
              items.map(it => ({
                id: it.id,
                name: it.shadowRoot.querySelector('#name')?.textContent,
                version: it.shadowRoot.querySelector('#version')?.textContent,
                inspectUrl: it.shadowRoot.querySelector('#inspect-views a')?.textContent
              }));
            `,
            returnByValue: true
          }
        }));
      };
      ws.onmessage = e => {
        const res = JSON.parse(e.data);
        console.log('Extensions in chrome://extensions:', JSON.stringify(res.result?.value, null, 2));
        ws.close();
        chrome.kill();
      };
    });
  });
}

check().catch(e => {
  console.error(e);
  chrome.kill();
});
