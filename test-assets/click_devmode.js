const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_dev_click';

const proc = spawn(chromePath, [
  '--remote-debugging-port=9894',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9894/json', res => {
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
          const tb = mgr?.shadowRoot?.querySelector('extensions-toolbar');
          const devToggle = tb?.shadowRoot?.querySelector('#devMode');
          if (devToggle) {
            devToggle.click();
            return 'Clicked #devMode in extensions-toolbar! devMode=' + devToggle.checked;
          }
          return 'No devMode in ' + tb?.tagName;
        })()`,
        returnByValue: true
      }
    }));

    ws.addEventListener('message', async e => {
      const d = JSON.parse(e.data);
      if (d.id === 2) {
        console.log('Click result:', d.result?.result?.value);
        await new Promise(r => setTimeout(r, 1000));
        ws.send(JSON.stringify({ id: 3, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      } else if (d.id === 3) {
        fs.writeFileSync('test-assets/devmode_clicked.png', Buffer.from(d.result.data, 'base64'));
        console.log('Saved devmode_clicked.png');
        ws.close();
        proc.kill();
      }
    });

  } catch (e) {
    console.error(e);
    proc.kill();
  }
}, 2000);
