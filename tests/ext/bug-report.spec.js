'use strict';

/**
 * tests/ext/bug-report.spec.js
 * Comprehensive tests for extension bug reporting and diagnostics (ITEM 2).
 */

const { test, expect, openRealPopup, expectNoExtensionErrors } = require('../support/ext-fixtures');
const { watchConsole, mouseClick } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test.describe('Extension: Bug Report & Diagnostics (ITEM 2)', () => {

  test('manifest permissions invariant: Chrome and Firefox manifests have no new permissions', () => {
    const baseManifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'extension', 'manifest.json'), 'utf-8'));
    const expectedPerms = ['storage', 'contextMenus', 'activeTab', 'scripting'];

    // Base manifest permissions
    expect(baseManifest.permissions).toEqual(expectedPerms);
    expect(baseManifest.host_permissions).toEqual(['http://*/*', 'https://*/*']);

    // Check generated Chrome manifest
    const chromeManifestPath = path.join(REPO_ROOT, 'dist', 'chrome', 'manifest.json');
    if (fs.existsSync(chromeManifestPath)) {
      const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf-8'));
      // Chromium build may include 'offscreen'
      const allowedChromePerms = new Set([...expectedPerms, 'offscreen']);
      for (const p of chromeManifest.permissions) {
        expect(allowedChromePerms.has(p), `Unexpected permission in Chrome build: ${p}`).toBe(true);
      }
    }

    // Check generated Firefox manifest
    const ffManifestPath = path.join(REPO_ROOT, 'dist', 'firefox', 'manifest.json');
    if (fs.existsSync(ffManifestPath)) {
      const ffManifest = JSON.parse(fs.readFileSync(ffManifestPath, 'utf-8'));
      for (const p of ffManifest.permissions) {
        expect(expectedPerms.includes(p), `Unexpected permission in Firefox build: ${p}`).toBe(true);
      }
    }
  });

  test('options page has Report a bug button in About section and opens mailto link', async ({ ext }) => {
    const options = await ext.context.newPage();
    const consoleLines = [];
    watchConsole(options, consoleLines);
    await options.goto(ext.url('options.html'));

    const cardCredits = options.locator('#cardCredits');
    await expect(cardCredits).toBeVisible();

    const btnReportBug = options.locator('#btnReportBug');
    await expect(btnReportBug).toBeVisible();
    await expect(btnReportBug).toContainText('Report a bug');

    // Intercept navigation/window.open or mock click to verify mailto URL
    const mailtoTarget = await options.evaluate(() => {
      return new Promise((resolve) => {
        const origCreate = document.createElement;
        document.createElement = function (tag) {
          const el = origCreate.call(document, tag);
          if (tag.toLowerCase() === 'a') {
            const origClick = el.click;
            el.click = function () {
              resolve(el.href);
              document.createElement = origCreate;
            };
          }
          return el;
        };
        document.getElementById('btnReportBug').click();
      });
    });

    expect(mailtoTarget).toBeTruthy();
    expect(mailtoTarget.startsWith('mailto:makan20042002@gmail.com')).toBe(true);
    expect(mailtoTarget).toContain('subject=MAKAN%20Translate%20bug%20report%20v1.0.0');

    const parsed = new URL(mailtoTarget);
    const body = parsed.searchParams.get('body');
    expect(body).toBeTruthy();
    expect(body.length).toBeLessThan(1800);
    expect(body).toContain('Extension Version: 1.0.0');
    expect(body).toContain('Browser / OS:');
    expect(body).toContain('Enabled Engines:');

    await options.close();
  });

  test('popup footer has small Report a bug link', async ({ ext }) => {
    const popup = await openRealPopup(ext);
    const bugLink = await popup.eval(`Boolean(document.getElementById('pReportBugLink'))`);
    expect(bugLink).toBe(true);

    const linkText = await popup.eval(`document.getElementById('pReportBugLink').textContent.trim()`);
    expect(linkText).toBe('Report a bug');

    await popup.close();
  });

  test('fake keys, custom server URLs, and selected text never appear in extension diagnostics', async ({ ext }) => {
    const FAKE_KEY = 'AIzaSyFAKEKEY000000000000000000000000000';
    const CUSTOM_SERVER = 'http://10.0.0.99:9999/v1';

    // Seed configuration with fake key and custom server
    await ext.patchConfig({
      eng: {
        gemini: { on: true, key: FAKE_KEY },
        custom: { on: true, base: CUSTOM_SERVER }
      },
      appUrl: 'http://127.0.0.1:9999' // non-default app URL should become 'custom'
    });

    const options = await ext.context.newPage();
    await options.goto(ext.url('options.html'));

    const mailtoTarget = await options.evaluate(() => {
      return new Promise((resolve) => {
        const origCreate = document.createElement;
        document.createElement = function (tag) {
          const el = origCreate.call(document, tag);
          if (tag.toLowerCase() === 'a') {
            el.click = function () {
              resolve(el.href);
              document.createElement = origCreate;
            };
          }
          return el;
        };
        document.getElementById('btnReportBug').click();
      });
    });

    expect(mailtoTarget).not.toContain(FAKE_KEY);
    expect(mailtoTarget).not.toContain('10.0.0.99');
    expect(mailtoTarget).not.toContain('9999');

    const parsed = new URL(mailtoTarget);
    const body = parsed.searchParams.get('body');
    expect(body).toContain('App Address Host: custom');
    expect(body).not.toContain(FAKE_KEY);
    expect(body).not.toContain(CUSTOM_SERVER);

    await options.close();
  });

  test('recent errors with fake Bearer tokens and keys are redacted in extension report', async ({ ext }) => {
    // Seed error in background/storage
    await ext.context.serviceWorkers()[0]?.evaluate(() => {
      if (typeof recordBgError === 'function') {
        recordBgError('Failed with Bearer secret-token-123456 and AIzaSyFAKEKEY000000000000000000000000000 and sk-proj-FAKEPROJKEY00000000000000000000 and gsk_FAKEGROQKEY00000000000000000000 at http://api.internal/v1?query=leak');
      }
    });

    const options = await ext.context.newPage();
    await options.goto(ext.url('options.html'));

    const mailtoTarget = await options.evaluate(() => {
      return new Promise((resolve) => {
        const origCreate = document.createElement;
        document.createElement = function (tag) {
          const el = origCreate.call(document, tag);
          if (tag.toLowerCase() === 'a') {
            el.click = function () {
              resolve(el.href);
              document.createElement = origCreate;
            };
          }
          return el;
        };
        document.getElementById('btnReportBug').click();
      });
    });

    const parsed = new URL(mailtoTarget);
    const body = parsed.searchParams.get('body');
    expect(body).toContain('Bearer [REDACTED_TOKEN]');
    expect(body).toContain('[REDACTED_KEY]');
    expect(body).toContain('[REDACTED_URL]');
    expect(body).not.toContain('[REDACTED_KEY]0');
    expect(body).not.toContain('secret-token-123456');
    expect(body).not.toContain('AIzaSyFAKEKEY000000000000000000000000000');
    expect(body).not.toContain('sk-proj-FAKEPROJKEY00000000000000000000');
    expect(body).not.toContain('gsk_FAKEGROQKEY00000000000000000000');
    expect(body).not.toContain('http://api.internal');
    expect(body).not.toContain('query=leak');

    await options.close();
  });

});
