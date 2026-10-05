const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('extension');
const tmpDir = path.resolve('test-assets/chrome_dev_profile');

// Ensure tmpDir exists and pre-populate Default/Preferences with developer_mode: true
fs.mkdirSync(path.join(tmpDir, 'Default'), { recursive: true });
const prefPath = path.join(tmpDir, 'Default', 'Preferences');
const initialPrefs = {
  extensions: {
    ui: {
      developer_mode: true
    }
  }
};
fs.writeFileSync(prefPath, JSON.stringify(initialPrefs, null, 2));

console.log('Created pre-configured profile with developer_mode: true');

const proc = spawn(chromePath, [
  '--remote-debugging-port=9891',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  `--disable-extensions-except=${extPath}`,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9891/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'chrome://extensions' } }));
    await new Promise(r => setTimeout(r, 2000));

    ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 2) {
        fs.writeFileSync('test-assets/extensions_page_devmode.png', Buffer.from(d.result.data, 'base64'));
        console.log('Saved extensions_page_devmode.png');
        ws.close();
        proc.kill();
      }
    });
  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
