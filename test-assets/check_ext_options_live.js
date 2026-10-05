const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('dist/chrome');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_opt_test2';

const proc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9446',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=' + extPath,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9446/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    function cdp(method, params = {}) {
      return new Promise((res, rej) => {
        const id = Math.floor(Math.random() * 1000000);
        const h = e => {
          const d = JSON.parse(e.data);
          if (d.id === id) {
            ws.removeEventListener('message', h);
            if (d.error) rej(d.error);
            else res(d.result);
          }
        };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const sw = list.find(t => t.type === 'service_worker');
    const extId = sw.url.split('/')[2];
    console.log('Navigating to chrome-extension://' + extId + '/options.html ...');

    await cdp('Page.navigate', { url: 'chrome-extension://' + extId + '/options.html' });
    await new Promise(r => setTimeout(r, 1500));

    const check = await cdp('Runtime.evaluate', {
      expression: `(() => ({
        title: document.title,
        hasTtsBtn: !!document.querySelector("#btnTestVoice"),
        hasEngine: typeof callGeminiTts !== "undefined",
        hasSentenceSplit: typeof splitIntoSentences !== "undefined",
        hasTtsSessionCache: typeof ttsSessionCache !== "undefined"
      }))()`,
      returnByValue: true
    });
    console.log('Options page state:', check.result.value);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    proc.kill();
  }
}, 2500);
