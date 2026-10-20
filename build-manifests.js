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
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
const VERSION = PKG.version;

function syncVersionJs(ver) {
  const versionFile = path.join(ROOT_DIR, 'js', 'version.js');
  const content = `// Single version source of truth (written from package.json by build scripts)\n(function () {\n  'use strict';\n  var v = '${ver}';\n  if (typeof window !== 'undefined') window.MAKAN_VERSION = v;\n  if (typeof self !== 'undefined') self.MAKAN_VERSION = v;\n})();\n`;
  fs.writeFileSync(versionFile, content, 'utf-8');
}
syncVersionJs(VERSION);

const BASE_MANIFEST = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf-8'));
BASE_MANIFEST.version = VERSION;
fs.writeFileSync(path.join(EXT_DIR, 'manifest.json'), JSON.stringify(BASE_MANIFEST, null, 2) + '\n');

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

// The two offline dictionary packs (made from Wiktionary, CC BY-SA) travel inside the extension, with their credits.
const BUNDLED_PAIRS = ['en-fa', 'fa-en'];   // only these travel inside the extension; the others stay out so it does not grow with every pack
function copyDictionary(outDir) {
  const all = require('./build-dict-list').writeList();
  const list = { ...all, packs: all.packs.filter(p => BUNDLED_PAIRS.includes(p.id)) };
  fs.mkdirSync(path.join(outDir, 'dict'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'dict', 'packs.json'), JSON.stringify(list, null, 2) + '\n');
  for (const pack of list.packs) {
    const pair = pack.id;
    const src = path.join(ROOT_DIR, 'dict', pack.dir);
    if (!fs.existsSync(src)) { console.warn('⚠️  dictionary pack missing:', src); continue; }
    const dest = path.join(outDir, 'dict', pair, path.basename(pack.dir));
    copyDirRecursive(src, dest);
    const credits = path.join(ROOT_DIR, 'dict', pair, 'credits.txt');
    if (fs.existsSync(credits)) { fs.mkdirSync(path.join(outDir, 'dict', pair), { recursive: true }); fs.copyFileSync(credits, path.join(outDir, 'dict', pair, 'credits.txt')); }
  }
}

function buildFirefox() {
  console.log('📦 Building Firefox Manifest & Package...');
  const outDir = path.join(DIST_DIR, 'firefox');
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  // In Firefox, offscreen document is not supported/needed (Audio is supported directly in background event page)
  copyDirRecursive(EXT_DIR, outDir, ['offscreen.html', 'offscreen.js']);
  copyDictionary(outDir);

  const manifest = JSON.parse(JSON.stringify(BASE_MANIFEST));

  // Firefox MV3 background uses background.scripts (event page); load engine.js first
  manifest.background = {
    scripts: ['engine.js', 'dictionary.js', 'background.js']
  };

  // Firefox does not support chrome.offscreen API, and notifications is dropped
  manifest.permissions = manifest.permissions.filter(p => p !== 'offscreen' && p !== 'notifications');

  // Firefox already hides the extension's address behind a random id per profile, and does not know use_dynamic_url
  (manifest.web_accessible_resources || []).forEach(w => { delete w.use_dynamic_url; });

  // Strict Firefox store compliance
  manifest.browser_specific_settings = {
    gecko: {
      id: 'makan-translate@makanlab.tech',
      strict_min_version: '115.0',
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
  copyDictionary(outDir);

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

  (manifest.web_accessible_resources || []).forEach(w => {
    w.use_dynamic_url = true;
  });

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
