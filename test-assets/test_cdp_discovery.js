const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_cdp_test_' + Date.now();

async function getJson(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Launching Chrome with extension...');
  const proc = spawn(chromePath, [
    '--remote-debugging-port=9333',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    'about:blank'
  ]);

  try {
    let targets = [];
    for (let i = 0; i < 40; i++) {
      try {
        targets = await getJson(9333);
        if (targets.length > 0) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    console.log('Found targets:', targets.map(t => ({ id: t.id, type: t.type, title: t.title, url: t.url })));

    // Look for extension ID
    const sw = targets.find(t => t.url.includes('chrome-extension://'));
    let extId = null;
    if (sw) {
      const match = sw.url.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) extId = match[1];
    }
    console.log('Extension ID from SW:', extId);

    // If not found in sw, read preferences
    if (!extId) {
      const prefPath = path.join(tmpDir, 'Default', 'Preferences');
      if (fs.existsSync(prefPath)) {
        const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
        const settings = prefs.extensions?.settings || {};
        for (const [id, data] of Object.entries(settings)) {
          if (data.path && data.path.toLowerCase().includes('extension')) {
            extId = id;
            break;
          }
        }
      }
      console.log('Extension ID from Preferences:', extId);
    }

  } finally {
    proc.kill();
    console.log('Cleaned up chrome process.');
  }
}

main().catch(console.error);
