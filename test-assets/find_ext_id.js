const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_inspect';

const chrome = spawn(chromePath, [
  '--remote-debugging-port=9227',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=' + extPath,
  '--disable-extensions-except=' + extPath,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const prefPath = path.join(tmpDir, 'Default', 'Preferences');
    if (fs.existsSync(prefPath)) {
      const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      const extSettings = prefs.extensions?.settings || {};
      for (const [id, data] of Object.entries(extSettings)) {
        if (data.path && data.path.toLowerCase().includes('extension')) {
          console.log('[FOUND EXTENSION ID]:', id, 'Name:', data.manifest?.name);
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    chrome.kill();
  }
}, 3000);
