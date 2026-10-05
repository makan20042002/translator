const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('extension');
const tmpDir = path.resolve('test-assets/chrome_dev_toggle');

const proc = spawn(chromePath, [
  '--remote-debugging-port=9892',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9892/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'chrome://extensions' } }));
    await new Promise(r => setTimeout(r, 2000));

    // Toggle dev mode
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const mgr = document.querySelector('extensions-manager');
          const toolbar = mgr?.shadowRoot?.querySelector('cr-toolbar');
          const devMode = toolbar?.shadowRoot?.querySelector('#devMode');
          if (devMode) {
            devMode.click();
            return 'clicked devMode';
          }
          return 'devMode not found';
        })()`,
        returnByValue: true
      }
    }));

    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot after toggle
    ws.send(JSON.stringify({ id: 3, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 3) {
        fs.writeFileSync('test-assets/extensions_toggled.png', Buffer.from(d.result.data, 'base64'));
        console.log('Saved extensions_toggled.png');
        ws.close();
        proc.kill();
      }
    });
  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
