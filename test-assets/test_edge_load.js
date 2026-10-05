const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const extPath = path.resolve('extension');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\edge_ext_test';

const proc = spawn(edgePath, [
  '--remote-debugging-port=9897',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9897/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    console.log('Edge Targets:', list.map(t => ({ type: t.type, title: t.title, url: t.url })));
  } catch (e) {
    console.error(e);
  } finally {
    proc.kill();
  }
}, 2500);
