const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_debug_' + Date.now();

console.log('Testing extension at:', extPath);

// Check if all files in manifest exist
const manifest = JSON.parse(fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf8'));
console.log('Manifest name:', manifest.name);
console.log('Icons exist:');
for (const [k, v] of Object.entries(manifest.icons || {})) {
  console.log(`  ${k}: ${v} -> ${fs.existsSync(path.join(extPath, v))}`);
}
console.log('Service worker exists:', fs.existsSync(path.join(extPath, manifest.background.service_worker)));
console.log('Popup exists:', fs.existsSync(path.join(extPath, manifest.action.default_popup)));
console.log('Options exists:', fs.existsSync(path.join(extPath, manifest.options_ui.page)));
for (const cs of manifest.content_scripts || []) {
  for (const js of cs.js || []) {
    console.log(`Content script ${js} exists:`, fs.existsSync(path.join(extPath, js)));
  }
}

// Let's spawn chrome with stdout and stderr captured
const proc = spawn(chromePath, [
  '--remote-debugging-port=9777',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  `--load-extension=${extPath}`,
  '--enable-logging=stderr',
  '--v=1',
  'about:blank'
]);

proc.stdout.on('data', d => console.log('[CHROME STDOUT]', d.toString()));
proc.stderr.on('data', d => {
  const str = d.toString();
  if (str.includes('extension') || str.includes('Extension') || str.includes('error') || str.includes('Error')) {
    console.log('[CHROME STDERR]', str.trim());
  }
});

setTimeout(() => {
  // Check Preferences
  try {
    const prefFile = path.join(tmpDir, 'Default', 'Preferences');
    if (fs.existsSync(prefFile)) {
      const prefs = JSON.parse(fs.readFileSync(prefFile, 'utf8'));
      const settings = prefs.extensions?.settings || {};
      console.log('Preferences extensions settings keys:', Object.keys(settings));
      for (const [id, val] of Object.entries(settings)) {
        console.log(`- ${id}: path=${val.path}, name=${val.manifest?.name}`);
      }
    } else {
      console.log('Preferences file does not exist yet at:', prefFile);
    }
  } catch (e) {
    console.error('Error reading prefs:', e);
  } finally {
    proc.kill();
  }
}, 4000);
