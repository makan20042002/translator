const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('extension');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_dev_click';

const proc = spawn(chromePath, [
  '--remote-debugging-port=9895',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9895/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    console.log('Targets:', list.map(t => ({ type: t.type, title: t.title, url: t.url })));
  } catch (e) {
    console.error(e);
  } finally {
    proc.kill();
  }
}, 2500);
