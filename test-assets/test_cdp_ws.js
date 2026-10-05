const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_cdp_test_' + Date.now();

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

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = new Map();

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
  const proc = spawn(chromePath, [
    '--remote-debugging-port=9444',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    'about:blank'
  ]);

  try {
    let ver = null;
    for (let i = 0; i < 40; i++) {
      try {
        ver = await getJson('http://127.0.0.1:9444/json/version');
        if (ver && ver.webSocketDebuggerUrl) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    console.log('Browser version info:', ver.Browser);

    const client = new CDPClient(ver.webSocketDebuggerUrl);
    await client.ready();

    // Query targets
    const targetsRes = await client.send('Target.getTargets');
    console.log('All CDP Targets from browser:', targetsRes.targetInfos.map(t => ({ type: t.type, title: t.title, url: t.url })));

    const extSw = targetsRes.targetInfos.find(t => t.url.includes('background.js'));
    console.log('Extension service worker target:', extSw);

    let extId = null;
    if (extSw) {
      const match = extSw.url.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) extId = match[1];
    }
    console.log('Found extension ID:', extId);

    client.close();
  } finally {
    proc.kill();
  }
}

main().catch(console.error);
