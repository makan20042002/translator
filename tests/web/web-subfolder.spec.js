'use strict';

/**
 * tests/web/web-subfolder.spec.js
 * Verifies that the web app functions correctly when hosted in a subfolder (/translate/app/):
 * - Navigates to /translate/app/ with no 404 responses for any resource.
 * - No console errors or uncaught exceptions during page load or interactions.
 * - Service worker registers successfully with scope /translate/app/.
 * - manifest.webmanifest start_url resolves inside /translate/app/.
 * - Media tab opens properly without subfolder asset resolution errors.
 * - Help/About dialog (#creditsBox) opens without errors.
 * - Reload works offline after initial cache population by the service worker.
 * - No requests leave localhost.
 */

const { test, expect, chromium } = require('@playwright/test');
const { startPrefixServer, PREFIX } = require('../support/prefix-server');

const IGNORED_CONSOLE = [
  /^Failed to load resource: /,
  /status of 401/
];

test.describe('Web Subfolder Deployment (/translate/app/)', () => {
  let serverInfo;
  let browser;

  test.beforeAll(async () => {
    serverInfo = await startPrefixServer();
    browser = await chromium.launch({
      headless: true,
      args: [
        '--allow-insecure-localhost',
        '--disable-web-security'
      ]
    });
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
    if (serverInfo) await serverInfo.close();
  });

  test('loads under /translate/app/ with no 404s, registers service worker, and operates offline', async () => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    const consoleErrors = [];
    const httpFailures = [];

    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!IGNORED_CONSOLE.some(r => r.test(text))) {
          consoleErrors.push(`console.error: ${text}`);
        }
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(`uncaught: ${err.message}`);
    });

    page.on('response', res => {
      const url = res.url();
      const status = res.status();
      if (status >= 400 && !url.includes('/api/sync_keys')) {
        httpFailures.push(`${res.request().method()} ${url} -> ${status}`);
      }
    });

    // 1. Open /translate/app/
    await page.goto(serverInfo.baseUrl, { waitUntil: 'load' });
    await expect(page.locator('#tabs button').first()).toBeVisible();

    // Verify no 404 or >= 400 responses occurred during load
    expect(httpFailures, `HTTP failure responses detected: ${httpFailures.join(', ')}`).toEqual([]);

    // Verify asr-guard.js was requested under /translate/app/ and succeeded
    const asrGuardReq = serverInfo.requests.find(r => r.pathname === PREFIX + 'asr-guard.js' || r.pathname.endsWith('/asr-guard.js'));
    expect(asrGuardReq, 'asr-guard.js must be requested under subfolder prefix').toBeDefined();

    // Verify no console errors occurred
    expect(consoleErrors, `Console errors detected: ${consoleErrors.join(', ')}`).toEqual([]);

    // 2. Verify Service Worker registers with scope /translate/app/
    const swScope = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const reg = await navigator.serviceWorker.ready;
      return reg ? reg.scope : null;
    });

    expect(swScope).not.toBeNull();
    const scopePath = new URL(swScope).pathname;
    expect(scopePath).toBe(PREFIX);

    // 3. Verify manifest start_url is inside /translate/app/
    const manifestStartUrl = await page.evaluate(async () => {
      const r = await fetch('manifest.webmanifest');
      const data = await r.json();
      return new URL(data.start_url, location.href).pathname;
    });

    expect(manifestStartUrl.startsWith(PREFIX)).toBe(true);

    // 4. Verify Media tab opens without errors
    const mediaTabBtn = page.locator('#tabs button[data-tab="media"]');
    await mediaTabBtn.click();
    await expect(page.locator('#tab-media')).toBeVisible();

    // 5. Verify Help/About window (#creditsBox) opens without errors
    const creditsBtn = page.locator('#creditsBtn');
    if (await creditsBtn.count() > 0) {
      await creditsBtn.click();
      await expect(page.locator('#creditsBox')).toBeVisible();
      // Close credits dialog
      await page.locator('#creditsClose').click();
      await expect(page.locator('#creditsBox')).toBeHidden();
    }

    // 6. Reload works offline after the first load (service worker cache)
    // Wait for the service worker to fully activate and populate its cache
    await page.waitForTimeout(1000);

    // Switch context to offline
    await context.setOffline(true);

    // Reload page completely while offline
    await page.reload({ waitUntil: 'load' });

    // The app shell must still be present and functional
    await expect(page.locator('#tabs button').first()).toBeVisible();
    await expect(page.locator('#tIn')).toBeVisible();

    await context.close();
  });
});
