const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_nav_test_' + Date.now();

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('Spawning Chrome with extension and navigating to localhost:8080...');
  const proc = spawn(chromePath, [
    '--remote-debugging-port=9555',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    'http://localhost:8080'
  ]);

  try {
    let list = [];
    for (let i = 0; i < 40; i++) {
      try {
        list = await getJson('http://127.0.0.1:9555/json');
        if (list.length > 0) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    const pageTarget = list.find(t => t.type === 'page' && t.url.includes('8080'));
    console.log('Found page target:', pageTarget ? pageTarget.url : 'none');

    if (pageTarget) {
      const pageCdp = new CDP(pageTarget.webSocketDebuggerUrl);
      await pageCdp.ready();
      await new Promise(r => setTimeout(r, 2000));

      const evalRes = await pageCdp.send('Runtime.evaluate', {
        expression: `({
          loaded: !!window.__makanTranslateLoaded,
          root: !!document.getElementById('makan-translate-root'),
          shadow: !!document.getElementById('makan-translate-root')?.shadowRoot
        })`,
        returnByValue: true
      });
      console.log('Injected content script check:', evalRes.value);
      pageCdp.close();
    }

    // Check targets again for service worker
    const listAfter = await getJson('http://127.0.0.1:9555/json');
    console.log('Targets after load:', listAfter.map(t => ({ type: t.type, title: t.title, url: t.url })));

  } finally {
    proc.kill();
  }
}

main().catch(console.error);
