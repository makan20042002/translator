'use strict';

/**
 * tests/web/build-web.spec.js
 * Validates tools/build-web.js:
 * - Generates clean runtime folder with only runtime dependencies.
 * - Out folder contains index.html, sw.js, manifest.webmanifest, models-catalog.js.
 * - Contains none of the forbidden folders (tests/, node_modules/, tools/, etc.).
 * - Contains no extension manifest or extension-only background/popup scripts.
 * - Every referenced file from index.html, CSS, JS, and sw.js exists in the output.
 * - BUILD_INFO.json accurately catalogues all files with matching sha256 and size.
 * - Secret-pattern detector refuses planted fake keys and leaks no key values.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { buildWeb, collectReferencedFiles, checkSecret } = require('../../tools/build-web');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test.describe('Build Web (tools/build-web.js)', () => {
  let tempOutDir;

  test.beforeAll(() => {
    tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-build-test-'));
    buildWeb({ rootDir: REPO_ROOT, outDir: tempOutDir });
  });

  test.afterAll(() => {
    if (tempOutDir && fs.existsSync(tempOutDir)) {
      try { fs.rmSync(tempOutDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  test('the output has index.html, sw.js, manifest, models-catalog.js', () => {
    expect(fs.existsSync(path.join(tempOutDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tempOutDir, 'sw.js'))).toBe(true);
    expect(fs.existsSync(path.join(tempOutDir, 'manifest.webmanifest'))).toBe(true);
    expect(fs.existsSync(path.join(tempOutDir, 'models-catalog.js'))).toBe(true);
  });

  test('has none of the forbidden folders or extension project files', () => {
    const forbiddenFolders = [
      'tests',
      'node_modules',
      'test-results',
      'test_docs',
      'tools',
      'helper',
      'backups',
      '.git'
    ];

    for (const folder of forbiddenFolders) {
      expect(fs.existsSync(path.join(tempOutDir, folder)), `forbidden folder should not exist: ${folder}`).toBe(false);
    }

    // Extension folder should never contain extension manifests or extension UI
    const forbiddenExtFiles = [
      'manifest.json',
      'manifest.chrome.json',
      'manifest.firefox.json',
      'background.js',
      'content.js',
      'content.css',
      'options.html',
      'options.js',
      'options.css',
      'popup.html',
      'popup.js',
      'popup.css',
      'offscreen.html',
      'offscreen.js'
    ];

    for (const extFile of forbiddenExtFiles) {
      expect(fs.existsSync(path.join(tempOutDir, 'extension', extFile)), `extension file should not exist: ${extFile}`).toBe(false);
    }

    // No developer markdown notes or env files
    const entries = fs.readdirSync(tempOutDir);
    expect(entries.includes('.env')).toBe(false);
    expect(entries.includes('TODO.md')).toBe(false);
    expect(entries.includes('PLAN.md')).toBe(false);
  });

  test('every local file referenced from index.html, CSS files, JS files, and sw.js exists in the output', () => {
    const referencedFiles = collectReferencedFiles(REPO_ROOT);
    expect(referencedFiles.length).toBeGreaterThan(15);

    for (const rel of referencedFiles) {
      const fullInOutput = path.join(tempOutDir, rel);
      expect(fs.existsSync(fullInOutput), `Referenced file missing in dist/web: ${rel}`).toBe(true);
    }
  });

  test('BUILD_INFO.json lists every file and its sha256 matches', () => {
    const buildInfoPath = path.join(tempOutDir, 'BUILD_INFO.json');
    expect(fs.existsSync(buildInfoPath)).toBe(true);

    const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'));
    expect(info.version).toBeDefined();
    expect(info.buildDate).toBeDefined();
    expect(Array.isArray(info.files)).toBe(true);
    expect(info.files.length).toBeGreaterThan(15);

    for (const item of info.files) {
      const targetPath = path.join(tempOutDir, item.path);
      expect(fs.existsSync(targetPath), `File in BUILD_INFO missing on disk: ${item.path}`).toBe(true);

      const diskBytes = fs.readFileSync(targetPath);
      const computedSha = crypto.createHash('sha256').update(diskBytes).digest('hex');
      expect(computedSha, `sha256 mismatch for ${item.path}`).toBe(item.sha256);
      expect(diskBytes.length, `size mismatch for ${item.path}`).toBe(item.size);
    }
  });

  test('the secret-pattern check refuses a planted fake key file in a temp copy (and prints no key value)', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-secret-check-'));
    try {
      const secretVal = 'AIzaSy' + 'FakeGoogleKeyForBuildWebTest1234567';
      const fakeFile = path.join(tempDir, 'fake-secret.js');
      fs.writeFileSync(fakeFile, `// leaked key\nconst KEY = "${secretVal}";\n`, 'utf-8');

      // Intercept console.error to verify no key value is leaked
      const errorLogs = [];
      const origError = console.error;
      console.error = (...args) => {
        errorLogs.push(args.join(' '));
      };

      let threw = false;
      let caughtError = null;
      try {
        checkSecret(fakeFile, 'fake-secret.js');
      } catch (err) {
        threw = true;
        caughtError = err;
      } finally {
        console.error = origError;
      }

      expect(threw, 'checkSecret must throw when a secret is detected').toBe(true);
      expect(caughtError.message).toContain('fake-secret.js');
      expect(caughtError.message).not.toContain(secretVal);

      // Verify printed console.error mentions the file path but NEVER the key value
      const printed = errorLogs.join('\n');
      expect(printed).toContain('fake-secret.js');
      expect(printed).not.toContain(secretVal);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  });
});
