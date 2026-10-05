const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const srtContent = fs.readFileSync(path.join(__dirname, 'sample_movie.srt'), 'utf8');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.callbacks = new Map();
    this.ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function testOne() {
  const profileDir = path.join(__dirname, 'test_prof');
  const chromeProc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--window-size=1366,900',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8080/'
  ], { stdio: 'ignore' });

  try {
    await sleep(1500);
    const res = await fetch('http://127.0.0.1:9226/json');
    const list = await res.json();
    const page = list.find(t => t.type === 'page');
    const client = new CDPClient(page.webSocketDebuggerUrl);
    await client.ready();

    await client.send('Page.enable');
    const r = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const btn = document.querySelector('[data-tab="sub"]');
          btn.click();
          const srt = ${JSON.stringify(srtContent)};
          const file = new File([srt], 'sample_movie.srt', { type: 'text/plain' });
          await loadSubs(file);
          return {
            cuesCount: cues ? cues.length : -1,
            html: document.getElementById('cues')?.innerHTML?.slice(0, 100),
            tabOn: document.querySelector('.tab.on')?.id
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Test result:', JSON.stringify(r));

    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('test-assets/screenshots/test_sub.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved test_sub.png');
    client.close();
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

testOne().catch(console.error);
