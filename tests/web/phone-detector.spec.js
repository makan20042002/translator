'use strict';

const { test, expect } = require('../support/fixtures');

test.describe('ITEM 1: Phone detector and is-phone html class', () => {
  test('desktop user agent at 360 px viewport does NOT have is-phone class', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 360, height: 740 });

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => (typeof window.isPhone === 'function' ? window.isPhone() : null));

    expect(isPhoneVal).toBe(false);
    expect(isPhoneClass).toBe(false);
  });

  test('desktop user agent at 1280 px viewport does NOT have is-phone class', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 900 });

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => (typeof window.isPhone === 'function' ? window.isPhone() : null));

    expect(isPhoneVal).toBe(false);
    expect(isPhoneClass).toBe(false);
  });

  test('Android phone user agent with userAgentData.mobile === true gives is-phone class', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 412, height: 915 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => window.isPhone());

    expect(isPhoneVal).toBe(true);
    expect(isPhoneClass).toBe(true);

    await context.close();
  });

  test('iPhone user agent gives is-phone class', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => window.isPhone());

    expect(isPhoneVal).toBe(true);
    expect(isPhoneClass).toBe(true);

    await context.close();
  });

  test('iPod user agent gives is-phone class', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 320, height: 568 },
      userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => window.isPhone());

    expect(isPhoneVal).toBe(true);
    expect(isPhoneClass).toBe(true);

    await context.close();
  });

  test('iPad is NOT a phone and does not get is-phone class', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 820, height: 1180 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: false
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => window.isPhone());

    expect(isPhoneVal).toBe(false);
    expect(isPhoneClass).toBe(false);

    await context.close();
  });

  test('Android tablet (Android without Mobile) is NOT a phone and does not get is-phone class', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 800, height: 1280 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      isMobile: false
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => window.isPhone());

    expect(isPhoneVal).toBe(false);
    expect(isPhoneClass).toBe(false);

    await context.close();
  });

  test('Windows desktop app (window.makanDesktop.isDesktop) is NEVER a phone even if mobile UA is injected', async ({ webBrowser, stub }) => {
    const context = await webBrowser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    await context.addInitScript(() => {
      window.makanDesktop = { isDesktop: true };
    });
    const page = await context.newPage();
    await page.goto(stub.appUrl);

    const isPhoneClass = await page.evaluate(() => document.documentElement.classList.contains('is-phone'));
    const isPhoneVal = await page.evaluate(() => window.isPhone());

    expect(isPhoneVal).toBe(false);
    expect(isPhoneClass).toBe(false);

    await context.close();
  });
});
