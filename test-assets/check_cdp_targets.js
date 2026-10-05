const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_cdp_test';

const chrome = spawn(chromePath, [
  '--remote-debugging-port=9227',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=' + extPath,
  'about:blank'
]);

chrome.stderr.on('data', d => console.log('[CHROME STDERR]:', d.toString()));

async function check() {
  await new Promise(r => setTimeout(r, 1500));
  http.get('http://127.0.0.1:9227/json/version', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
      const v = JSON.parse(d);
      console.log('Browser:', v.Browser, 'WebSocketDebuggerUrl:', v.webSocketDebuggerUrl);

      const ws = new WebSocket(v.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' }));
      };
      ws.onmessage = e => {
        const res = JSON.parse(e.data);
        if (res.id === 1) {
          console.log('ALL CDP TARGETS:');
          res.result.targetInfos.forEach(t => console.log(' -', t.type, '|', t.title, '|', t.url));
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
