'use strict';

/**
 * tests/web/engine-availability.spec.js
 * ITEM 1: Honest engine availability status and Chrome probe handling.
 */

const { test, expect } = require('../support/fixtures');

test.describe('Honest Engine Availability (ITEM 1)', () => {
  test('with makanDesktop.isDesktop mocked true before load, chrome is not-here and auto chain never starts with chrome', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 1280, height: 900 }
    });
    await context.addInitScript(() => {
      window.makanDesktop = { isDesktop: true };
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);
    await expect(page.locator('#tabs button').first()).toBeVisible();

    const status = await page.evaluate(() => window.ENG.getStatus('chrome'));
    expect(status.state).toBe('not-here');
    expect(status.usable).toBe(false);

    const autoChain = await page.evaluate(() => {
      return cfg.order.filter(id => (typeof usable === 'function' ? usable(id) : window.ENG.getStatus(id).usable));
    });
    expect(autoChain.length).toBeGreaterThan(0);
    expect(autoChain[0]).not.toBe('chrome');
    expect(autoChain.includes('chrome')).toBe(false);

    await context.close();
  });

  test('in normal page with hanging Translator.availability(), chrome is skipped after timeout and chain moves on', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 1280, height: 900 }
    });
    await context.addInitScript(() => {
      window.__chromeAvailTimeoutMs = 150;
      window.Translator = {
        availability: () => new Promise(() => {}),
        create: async () => ({
          translate: async s => '[chrome] ' + s
        })
      };
    });

    await context.route('https://clients5.google.com/translate_a/t*', async route => {
      const postData = route.request().postData() || '';
      const form = new URLSearchParams(postData);
      const qs = form.getAll('q');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(qs.map(s => '[google] ' + s))
      });
    });

    const page = await context.newPage();
    await page.goto(stub.appUrl);
    await expect(page.locator('#tabs button').first()).toBeVisible();

    // Prior to probe, in browser with window.Translator, chrome status is ready
    const initialStatus = await page.evaluate(() => window.ENG.getStatus('chrome'));
    expect(initialStatus.state).toBe('ready');
    expect(initialStatus.usable).toBe(true);

    // Run translation with auto chain where chrome comes before google
    const result = await page.evaluate(async () => {
      const res = await translateItems(['Hello world'], {
        engine: 'auto',
        src: 'en',
        tgt: 'fa'
      });
      const afterStatus = window.ENG.getStatus('chrome');
      return { res, afterStatus };
    });

    expect(result.res.out).toEqual(['[google] Hello world']);
    expect(result.afterStatus.usable).toBe(false);

    await context.close();
  });

  test('with mocked Translator that answers available, chrome stays usable', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 1280, height: 900 }
    });
    await context.addInitScript(() => {
      window.Translator = {
        availability: async () => 'available',
        create: async () => ({
          translate: async s => '[chrome-mock] ' + s
        })
      };
    });

    const page = await context.newPage();
    await page.goto(stub.appUrl);
    await expect(page.locator('#tabs button').first()).toBeVisible();

    const status = await page.evaluate(() => window.ENG.getStatus('chrome'));
    expect(status.state).toBe('ready');
    expect(status.usable).toBe(true);
    expect(status.reason).toBe('ready');

    await context.close();
  });

  test('reports needs-key, not-downloaded, and offline-blocked states accurately', async ({ app }) => {
    const { page } = app;

    const evaluation = await page.evaluate(() => {
      // 1. Keyless engine (Gemini without key)
      const geminiStatus = window.ENG.getStatus('gemini');

      // 2. Undownloaded NLLB (fresh browser has no downloaded models)
      const nllbStatus = window.ENG.getStatus('nllb');

      // 3. Offline mode turned on
      cfg.offline = true;
      const googleStatusOffline = window.ENG.getStatus('google');
      const nllbStatusOffline = window.ENG.getStatus('nllb');

      return {
        geminiStatus,
        nllbStatus,
        googleStatusOffline,
        nllbStatusOffline
      };
    });

    // Keyless engine
    expect(evaluation.geminiStatus.state).toBe('needs-key');
    expect(evaluation.geminiStatus.usable).toBe(false);
    expect(evaluation.geminiStatus.reason).toBe('needKey');

    // Undownloaded NLLB
    expect(evaluation.nllbStatus.state).toBe('not-downloaded');
    expect(evaluation.nllbStatus.usable).toBe(false);
    expect(evaluation.nllbStatus.reason).toBe('needDl');

    // Offline mode on -> Google is blocked by offline mode
    expect(evaluation.googleStatusOffline.state).toBe('offline-blocked');
    expect(evaluation.googleStatusOffline.usable).toBe(false);
    expect(evaluation.googleStatusOffline.reason).toBe('offlineBlocked');

    // Undownloaded NLLB remains not-downloaded because NLLB is offline-capable
    expect(evaluation.nllbStatusOffline.state).toBe('not-downloaded');
    expect(evaluation.nllbStatusOffline.usable).toBe(false);
  });

  test('window.ENG.getStatus is a function and equals ENG.getStatus', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(() => {
      return {
        hasWindowEng: typeof window.ENG !== 'undefined',
        isFunction: typeof window.ENG?.getStatus === 'function',
        equalsEngGetStatus: window.ENG?.getStatus === ENG?.getStatus,
        isSameObject: window.ENG === ENG
      };
    });
    expect(result.hasWindowEng).toBe(true);
    expect(result.isFunction).toBe(true);
    expect(result.equalsEngGetStatus).toBe(true);
    expect(result.isSameObject).toBe(true);
  });
});
