'use strict';
// When a provider answers "too many requests" (HTTP 429): wait a little, try again a few times, then say so.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');

const GOOGLE_HOSTS = ['clients5.google.com', 'translate.googleapis.com'];
const googleCalls = stub => GOOGLE_HOSTS.reduce((n, h) => n + stub.calls(h).length, 0);

test.describe('Web app: a provider that says "too many requests" (HTTP 429)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  async function translate(page, text) {
    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type(text);
    await mouseClick(page, page.locator('#tGo'));
  }

  test('a limit that clears is waited out, and the translation then arrives', async ({ app }) => {
    test.setTimeout(60_000);
    const { page, stub } = app;
    // Google's two addresses both refuse the first two attempts, then work.
    for (const h of GOOGLE_HOSTS) stub.failHost(h, 429, 2);
    await translate(page, 'Be patient');
    await expect(page.locator('#toasts')).toContainText('429', { timeout: 15_000 });
    await expect(page.locator('#tOut')).toHaveValue('[fa] Be patient', { timeout: 40_000 });
    await expect(page.locator('#tGo')).toBeEnabled();
  });

  test('a limit that does not clear gives up after a few tries with a clear message', async ({ app }) => {
    test.setTimeout(60_000);
    const { page, stub } = app;
    for (const h of GOOGLE_HOSTS) stub.failHost(h, 429);
    await translate(page, 'Never works');
    await expect(page.locator('#tGo'), 'Translate button should be usable again').toBeEnabled({ timeout: 40_000 });
    await expect(page.locator('#toasts')).toContainText(/rate limit|too many requests/i);
    const tries = googleCalls(stub);
    expect(tries, 'requests made before giving up').toBeLessThanOrEqual(10);
    await page.waitForTimeout(6000);
    expect(googleCalls(stub), 'it must not keep trying after giving up').toBe(tries);
    await expect(page.locator('#tOut')).toHaveValue('');
  });

  test('Stop works while the app is waiting', async ({ app }) => {
    test.setTimeout(60_000);
    const { page, stub } = app;
    for (const h of GOOGLE_HOSTS) stub.failHost(h, 429);
    await translate(page, 'Stop me');
    await expect.poll(() => googleCalls(stub), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#tStop')).toBeVisible();
    await mouseClick(page, page.locator('#tStop'));
    await expect(page.locator('#tGo'), 'Translate button after pressing Stop during the wait').toBeEnabled({ timeout: 2000 });
  });
});
