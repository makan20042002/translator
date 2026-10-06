'use strict';
// "Open in App" from the extension hands text to the web app. The text must travel after a "#" in the
// address, which the browser never sends to a server (a "?" part is sent to the server and ends up in its logs).
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Web app: text handed over from the extension', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });
  const hand = (stub, params) => `${stub.appOrigin}/#${new URLSearchParams(params).toString()}`;

  test('fills the Text tab, is removed from the address bar, is never sent to a server and is not translated by itself', async ({ app }) => {
    const { page, stub } = app;
    const secret = 'My private sentence about Tuesday';
    stub.clearLog();
    await page.goto(hand(stub, { text: secret, src: 'en', tgt: 'de' }));
    await expect(page.locator('#tIn')).toHaveValue(secret);
    await expect(page.locator('#src')).toHaveValue('en');
    await expect(page.locator('#tgt')).toHaveValue('de');
    await expect(page.locator('#tab-text')).toBeVisible();
    expect(page.url(), 'address after loading').toBe(stub.appOrigin + '/');
    const sentToServer = stub.log.filter(e => `${e.path}${e.query}${e.body}${JSON.stringify(e.headers)}`.includes('private') || `${e.path}${e.query}`.includes('Tuesday'));
    expect(sentToServer.map(e => `${e.method} ${e.host}${e.path}`), 'requests containing the text').toEqual([]);
    expect(stub.calls().filter(c => /translate|mymemory/.test(c.host)), 'translation requests the page made without being asked').toEqual([]);
    await page.reload();
    await expect(page.locator('#tIn'), 'after a reload the text is not put back').toHaveValue('');
  });

  test('ignores a language it does not know, limits very long text, and shows markup as plain text', async ({ app }) => {
    const { page, stub } = app;
    await page.goto(hand(stub, { text: '<img src=x onerror="document.title=1">' + 'a'.repeat(6000), src: 'zz', tgt: '"><b>' }));
    await expect(page.locator('#tIn')).toHaveValue(/^<img src=x onerror="document.title=1">a+$/);
    expect((await page.locator('#tIn').inputValue()).length).toBeLessThanOrEqual(5000);
    await expect(page.locator('#src')).toHaveValue('auto');
    await expect(page.locator('#tgt')).not.toHaveValue('"><b>');
    expect(await page.title()).not.toBe('1');
    expect(await page.locator('#tab-text img').count()).toBe(0);
  });
});
