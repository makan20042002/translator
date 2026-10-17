'use strict';

/**
 * tests/web/web-deploy-files.spec.js
 * Verifies deployment files and documentation for ITEM 3:
 * - .htaccess exists in build, contains HTTPS redirect, MIME types, cache rules, no placeholders.
 * - .htaccess.threads-optional exists, is separate and not named .htaccess, no placeholders.
 * - docs/WEB_DEPLOY.md exists, mentions public_html/translate/app/, OLLAMA_ORIGINS, and the 10 checks.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildWeb } = require('../../tools/build-web');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test.describe('Web Deploy Files & Guide (ITEM 3)', () => {
  let tempOutDir;

  test.beforeAll(() => {
    tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-deploy-test-'));
    buildWeb({ rootDir: REPO_ROOT, outDir: tempOutDir });
  });

  test.afterAll(() => {
    if (tempOutDir && fs.existsSync(tempOutDir)) {
      try { fs.rmSync(tempOutDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  test('.htaccess and .htaccess.threads-optional exist in the build and contain no placeholders', () => {
    const htaccessPath = path.join(tempOutDir, '.htaccess');
    const threadsPath = path.join(tempOutDir, '.htaccess.threads-optional');

    expect(fs.existsSync(htaccessPath), '.htaccess must exist in build output').toBe(true);
    expect(fs.existsSync(threadsPath), '.htaccess.threads-optional must exist in build output').toBe(true);

    // Verify threads file has distinct name and is NOT named .htaccess
    expect(path.basename(threadsPath)).toBe('.htaccess.threads-optional');
    expect(path.basename(threadsPath)).not.toBe('.htaccess');

    const htContent = fs.readFileSync(htaccessPath, 'utf-8');
    const threadsContent = fs.readFileSync(threadsPath, 'utf-8');

    // Neither file may contain placeholders like TODO or FIXME
    expect(htContent).not.toMatch(/\b(TODO|FIXME|XXX)\b/i);
    expect(threadsContent).not.toMatch(/\b(TODO|FIXME|XXX)\b/i);

    // .htaccess must contain HTTPS redirect, security headers, and MIME rules
    expect(htContent).toContain('RewriteCond %{HTTPS} off');
    expect(htContent).toContain('AddType application/wasm .wasm');
    expect(htContent).toContain('X-Content-Type-Options "nosniff"');
    expect(htContent).toContain('Permissions-Policy');

    // .htaccess.threads-optional must contain COOP and COEP headers
    expect(threadsContent).toContain('Cross-Origin-Opener-Policy "same-origin"');
    expect(threadsContent).toContain('Cross-Origin-Embedder-Policy "require-corp"');
  });

  test('docs/WEB_DEPLOY.md mentions public_html/translate/app/, OLLAMA_ORIGINS and the 10 checks', () => {
    const deployDocPath = path.join(REPO_ROOT, 'docs', 'WEB_DEPLOY.md');
    expect(fs.existsSync(deployDocPath), 'docs/WEB_DEPLOY.md must exist').toBe(true);

    const docText = fs.readFileSync(deployDocPath, 'utf-8');

    // Must mention target upload directory
    expect(docText).toContain('public_html/translate/app/');

    // Must mention Ollama origin configuration
    expect(docText).toContain('OLLAMA_ORIGINS');

    // Must mention all 10 checks clearly
    const tenChecks = [
      'HTTPS padlock',
      'Page loads',
      'A model download starts',
      'Microphone prompt works',
      'Offline reload works',
      'Media tab',
      'Extension Open in App fallback opens the hosted app',
      'Settings',
      'About/Help',
      'Service worker version'
    ];

    for (const chk of tenChecks) {
      expect(docText.toLowerCase()).toContain(chk.toLowerCase());
    }
  });
});
