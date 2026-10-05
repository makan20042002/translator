const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extPath = 'c:/Users/Makan/Desktop/translator/extension';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_load_ext_test';

async function test(arg) {
  console.log('Testing with arg:', arg);
  const proc = spawn(chromePath, [
    '--remote-debugging-port=9888',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    arg,
    'about:blank'
  ]);

  try {
    let list = [];
    for (let i = 0; i < 20; i++) {
      try {
        const res = await new Promise((res, rej) => {
          http.get('http://127.0.0.1:9888/json', r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
          }).on('error', rej);
        });
        list = JSON.parse(res);
        if (list.length > 0) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    const page = list.find(t => t.type === 'page');
    if (page) {
      const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
      await new Promise(r => ws.addEventListener('open', r));
      
      // Navigate to a test page
      const navPromise = new Promise(r => {
        ws.addEventListener('message', function h(e) {
          const d = JSON.parse(e.data);
          if (d.id === 1) {
            ws.removeEventListener('message', h);
            r(d.result);
          }
        });
      });
      ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'http://localhost:8080/' } }));
      await navPromise;
      await new Promise(r => setTimeout(r, 2000));

      const evalPromise = new Promise(r => {
        ws.addEventListener('message', function h(e) {
          const d = JSON.parse(e.data);
          if (d.id === 2) {
            ws.removeEventListener('message', h);
            r(d.result);
          }
        });
      });
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: `({
            extLoaded: !!window.__makanTranslateLoaded,
            hasRoot: !!document.getElementById('makan-translate-root')
          })`,
          returnByValue: true
        }
      }));
      const evalRes = await evalPromise;
      console.log('Result:', evalRes?.result?.value);
      ws.close();
    }
  } finally {
    proc.kill();
  }
}

async function main() {
  await test(`--load-extension=${extPath}`);
}

main().catch(console.error);
