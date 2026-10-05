const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = path.resolve('dist/chrome');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_sw_inspect';

const proc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9447',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=' + extPath,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9447/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const swTarget = list.find(t => t.type === 'service_worker');
    if (!swTarget) {
      console.log('No service worker target in /json:', list);
      return;
    }
    console.log('Connecting to service worker debugger:', swTarget.webSocketDebuggerUrl);
    const ws = new WebSocket(swTarget.webSocketDebuggerUrl);
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

    const swCheck = await cdp('Runtime.evaluate', {
      expression: `(() => ({
        hasCallGeminiTts: typeof callGeminiTts !== "undefined",
        hasSplitIntoSentences: typeof splitIntoSentences !== "undefined",
        hasTtsSessionCache: typeof ttsSessionCache !== "undefined",
        hasStartPipelinedPlayback: typeof startPipelinedPlayback !== "undefined",
        hasBroadcastTtsState: typeof broadcastTtsState !== "undefined",
        sentencesTest: typeof splitIntoSentences === "function" ? splitIntoSentences("جمله اول. جمله دوم! جمله سوم؟") : []
      }))()`,
      returnByValue: true
    });
    console.log('Service Worker in-memory state:');
    console.dir(swCheck.result.value, { depth: null });

  } catch (e) {
    console.error('Error:', e);
  } finally {
    proc.kill();
  }
}, 2500);
