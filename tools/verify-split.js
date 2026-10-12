'use strict';
// tools/verify-split.js
// Compares concatenated css/ and js/ files against the original inline CSS and JS
// from index.html in the commit immediately before Stage B.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Locate the commit that introduced CODE_MAP.md (the commit immediately before Stage B)
let baseCommit = '87a10a0';
try {
  const detected = execSync('git log -1 --grep="docs: add CODE_MAP.md" --format="%H"', { encoding: 'utf8' }).trim();
  if (detected) baseCommit = detected;
} catch {}

let origHtml;
try {
  origHtml = execSync(`git show ${baseCommit}:index.html`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
} catch (e) {
  console.error(`Failed to load index.html from commit ${baseCommit}:`, e.message);
  process.exit(1);
}

// Extract original inline CSS (<style>...</style>)
const origStyleMatch = origHtml.match(/<style>([\s\S]*?)<\/style>/);
if (!origStyleMatch) {
  console.error('Could not locate <style>...</style> in original index.html');
  process.exit(1);
}
const origCss = origStyleMatch[1];

// Extract original inline JS (the inline <script>...</script> before </body>)
const origScriptMatch = origHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!origScriptMatch) {
  console.error('Could not locate inline <script>...</script> in original index.html');
  process.exit(1);
}
const origJs = origScriptMatch[1];

// Read current index.html to verify <link> and <script> tags in exact load order
const currentHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Match <link rel="stylesheet" href="...">
const cssLinks = [];
const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
let m;
while ((m = linkRegex.exec(currentHtml)) !== null) {
  if (m[1].startsWith('css/')) cssLinks.push(m[1]);
}

// Expected JS modules in load order, including new modules like js/welcome.js
const EXPECTED_JS_MODULES = [
  'js/store.js',
  'js/i18n.js',
  'js/translate.js',
  'js/speech.js',
  'js/text.js',
  'js/subtitles.js',
  'js/documents.js',
  'js/voice.js',
  'js/compare.js',
  'js/settings.js',
  'js/models.js',
  'js/voice-picker.js',
  'js/init.js',
  'js/dictionary.js',
  'js/idioms.js',
  'js/screen.js',
  'js/welcome.js'
];

// Match <script src="...">
const jsScripts = [];
const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
while ((m = scriptRegex.exec(currentHtml)) !== null) {
  if (m[1].startsWith('js/')) jsScripts.push(m[1]);
}

// Verify that all expected modules exist
EXPECTED_JS_MODULES.forEach(mod => {
  if (!jsScripts.includes(mod)) {
    console.warn(`[verify-split] Note: ${mod} is in EXPECTED_JS_MODULES but not linked in index.html`);
  }
});

console.log('--- CSS SPLIT VERIFICATION ---');
console.log(`Discovered ${cssLinks.length} CSS link(s) in load order:`, cssLinks.join(', '));
const concatCss = cssLinks.map(href => {
  return fs.readFileSync(path.join(__dirname, '..', href), 'utf8').replace(/\r\n/g, '\n');
}).join('\n');

// Normalize whitespace between files for comparison (ignoring only whitespace between files):
const normOrigCss = origCss.replace(/\r\n/g, '\n').trim();
const normConcatCss = concatCss.trim();

let cssMatches = false;
if (normOrigCss === normConcatCss) {
  cssMatches = true;
  console.log(`✓ CSS match: OK (${normConcatCss.length} characters match original ${normOrigCss.length} characters verbatim)`);
} else {
  console.error('✗ CSS mismatch!');
  console.error(`  Original length: ${normOrigCss.length}, Concatenated length: ${normConcatCss.length}`);
}

console.log('\n--- JAVASCRIPT SPLIT VERIFICATION ---');
console.log(`Discovered ${jsScripts.length} JS script(s) in load order:`);
jsScripts.forEach((s, idx) => console.log(`  ${idx + 1}. ${s}`));

const concatJs = jsScripts.map(src => {
  return fs.readFileSync(path.join(__dirname, '..', src), 'utf8').replace(/\r\n/g, '\n');
}).join('\n');

const normOrigJs = origJs.replace(/\r\n/g, '\n').trim();
const normConcatJs = concatJs.trim();

let jsMatches = false;
if (normOrigJs === normConcatJs) {
  jsMatches = true;
  console.log(`✓ JavaScript match: OK (${normConcatJs.length} characters match original ${normOrigJs.length} characters verbatim)`);
} else {
  console.error('✗ JavaScript mismatch!');
  console.error(`  Original length: ${normOrigJs.length}, Concatenated length: ${normConcatJs.length}`);
}

if (cssMatches && jsMatches) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('VERIFY-SPLIT PASSED: All files match original code verbatim.');
  console.log('═══════════════════════════════════════════════════');
  process.exit(0);
} else {
  console.error('\n═══════════════════════════════════════════════════');
  console.error('VERIFY-SPLIT FAILED: Content differs from original.');
  console.error('═══════════════════════════════════════════════════');
  process.exit(1);
}
