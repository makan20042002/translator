const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Makan\\.gemini\\antigravity-ide\\brain\\f145b85e-b75c-42f2-bbe9-1a16606313b4';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

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

async function getPageTarget(port = 9225) {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error('Could not connect to Chrome debugging port');
}

async function captureConfig(prefix, { w, h, lang }) {
  console.log(`\nCapturing ${prefix} at ${w}x${h} [${lang}]...`);
  const profileDir = path.join(__dirname, `chrome_prof_${w}_${lang}`);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9225',
    `--window-size=${w},${h}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8080/'
  ], { stdio: 'ignore' });

  try {
    await sleep(1500);
    const wsUrl = await getPageTarget(9225);
    const client = new CDPClient(wsUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: w <= 500
    });

    await sleep(500);

    // Wait for page functions to be available
    await client.send('Runtime.evaluate', {
      expression: `new Promise(resolve => {
        const iv = setInterval(() => {
          if (typeof boot === 'function' && typeof loadSubs === 'function') {
            clearInterval(iv);
            resolve(true);
          }
        }, 50);
      })`,
      awaitPromise: true
    });

    // Set UI language and load subtitle
    const evalRes = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          if ('${lang}' === 'fa') {
            ui = 'fa';
            boot();
          } else {
            ui = 'en';
            boot();
          }
          // Switch to Subtitle tab
          document.querySelector('[data-tab="sub"]').click();

          // Load SRT file
          const srt = ${JSON.stringify(srtContent)};
          const file = new File([srt], 'sample_movie.srt', { type: 'text/plain' });
          await loadSubs(file);

          return { count: cues ? cues.length : -1, activeTab: document.querySelector('.tab.on')?.id };
        } catch(e) {
          return { err: e.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Eval result:', evalRes.result?.value);

    // Wait for layout
    await sleep(600);

    // Capture screenshot
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const filename = `${prefix}_${w}_${lang}.png`;
    const localPath = path.join(SCREENSHOT_DIR, filename);
    const artifactPath = path.join(ARTIFACTS_DIR, filename);

    fs.writeFileSync(localPath, buffer);
    fs.writeFileSync(artifactPath, buffer);
    console.log(`Saved screenshot to ${localPath} and ${artifactPath} (${buffer.length} bytes)`);

    client.close();
  } finally {
    try { chromeProc.kill('SIGKILL'); } catch {}
    await sleep(400);
  }
}

async function run(prefix = 'before') {
  const configs = [
    { w: 1366, h: 900, lang: 'en' },
    { w: 1366, h: 900, lang: 'fa' },
    { w: 1920, h: 1080, lang: 'en' },
    { w: 1920, h: 1080, lang: 'fa' },
    { w: 390, h: 844, lang: 'en' },
    { w: 390, h: 844, lang: 'fa' },
  ];

  for (const cfg of configs) {
    try {
      await captureConfig(prefix, cfg);
    } catch (e) {
      console.error(`Error on config ${cfg.w} ${cfg.lang}:`, e);
    }
  }
  console.log(`Finished ${prefix} screenshots.`);
}

const prefix = process.argv[2] || 'before';
run(prefix).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
