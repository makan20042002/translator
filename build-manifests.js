/**
 * MAKAN Translate - Multi-Browser Manifest & Package Builder
 * Generates browser-optimized manifests and release distributions for Chrome/Edge and Firefox.
 * 
 * Usage:
 *   node build-manifests.js           # Builds both Chrome/Edge and Firefox distributions
 *   node build-manifests.js firefox   # Builds Firefox distribution
 *   node build-manifests.js chrome    # Builds Chrome/Edge distribution
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const EXT_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BASE_MANIFEST = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf-8'));

const IGNORED_FILES = ['manifest.json', 'manifest.chrome.json', 'manifest.firefox.json', '.DS_Store', 'Thumbs.db'];

function copyDirRecursive(src, dest, ignoreFiles = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreFiles.includes(entry.name) || IGNORED_FILES.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, ignoreFiles);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildFirefox() {
  console.log('📦 Building Firefox Manifest & Package...');
  const outDir = path.join(DIST_DIR, 'firefox');
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  // In Firefox, offscreen document is not supported/needed (Audio is supported directly in background event page)
  copyDirRecursive(EXT_DIR, outDir, ['offscreen.html', 'offscreen.js']);

  const manifest = JSON.parse(JSON.stringify(BASE_MANIFEST));

  // Firefox MV3 background uses background.scripts (event page); load engine.js first
  manifest.background = {
    scripts: ['engine.js', 'background.js']
  };

  // Firefox does not support chrome.offscreen API, and notifications is dropped
  manifest.permissions = manifest.permissions.filter(p => p !== 'offscreen' && p !== 'notifications');

  // Strict Firefox store compliance
  manifest.browser_specific_settings = {
    gecko: {
      id: 'makan-translate@makanlab.tech',
      strict_min_version: '142.0',
      data_collection_permissions: {
        required: ['websiteContent']
      }
    }
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(EXT_DIR, 'manifest.firefox.json'), JSON.stringify(manifest, null, 2));
  console.log('✅ Firefox build ready at: dist/firefox/ (and extension/manifest.firefox.json)');
}

function buildChrome() {
  console.log('📦 Building Chrome/Edge Manifest & Package...');
  const outDir = path.join(DIST_DIR, 'chrome');
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  copyDirRecursive(EXT_DIR, outDir);

  const manifest = JSON.parse(JSON.stringify(BASE_MANIFEST));

  // Chrome MV3 background requires service_worker
  manifest.background = {
    service_worker: 'background.js'
  };

  // Remove Firefox-specific gecko settings for clean Chrome Web Store submission
  delete manifest.browser_specific_settings;

  // Ensure Chrome MV3 offscreen & scripting permissions are intact, no notifications
  manifest.permissions = manifest.permissions.filter(p => p !== 'notifications');
  if (!manifest.permissions.includes('offscreen')) manifest.permissions.push('offscreen');
  if (!manifest.permissions.includes('scripting')) manifest.permissions.push('scripting');

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(EXT_DIR, 'manifest.chrome.json'), JSON.stringify(manifest, null, 2));
  console.log('✅ Chrome/Edge build ready at: dist/chrome/ (and extension/manifest.chrome.json)');
}

const target = (process.argv[2] || 'all').toLowerCase();
if (target === 'firefox') {
  buildFirefox();
} else if (target === 'chrome' || target === 'edge') {
  buildChrome();
} else {
  buildFirefox();
  buildChrome();
}
