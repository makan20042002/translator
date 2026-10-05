const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = 'c:\\Users\\Makan\\Desktop\\translator\\extension';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_scr';

const proc = spawn(chromePath, [
  '--remote-debugging-port=9890',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=' + extPath,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9890/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'chrome://extensions' } }));
    await new Promise(r => setTimeout(r, 2000));

    // Capture screenshot
    ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 2) {
        fs.writeFileSync('test-assets/extensions_page.png', Buffer.from(d.result.data, 'base64'));
        console.log('Saved extensions_page.png');
        ws.close();
        proc.kill();
      }
    });
  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
