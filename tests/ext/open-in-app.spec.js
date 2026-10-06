'use strict';
// The extension's "Open in App" links must put the user's text after a "#", not in a "?" query.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup } = require('../support/ext-fixtures');

const parts = href => { const u = new URL(href); return { origin: u.origin, search: u.search, hash: new URLSearchParams(u.hash.replace(/^#/, '')) }; };

test.describe('Extension: "Open in App" links', () => {
  test('the card\'s link carries the text, source and target after a #, and nothing in the part a server sees', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible();
    const u = parts(await inShadow(page, '#makanOpenApp').getAttribute('href'));
    expect(u.origin).toBe('http://localhost:8080');
    expect(u.search, 'the "?" part of the address (sent to the server)').toBe('');
    expect(u.hash.get('text')).toBe('First item in the list of things.');
    expect(u.hash.get('tgt')).toBe('fa');
  });

  test('the popup\'s link does the same, and very long text is shortened', async ({ ext }) => {
    const popup = await openRealPopup(ext);
    await popup.click('#pInputText');
    await popup.eval(`(() => { const t = document.getElementById('pInputText'); t.value = 'Hello popup ' + 'x'.repeat(5000); })()`);
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent.startsWith('[fa] Hello popup')`);
    const href = await popup.eval(`document.getElementById('pOpenWebApp').href`);
    const u = parts(href);
    expect(u.search).toBe('');
    expect(u.hash.get('text')).toMatch(/^Hello popup x+$/);
    expect(u.hash.get('text').length, 'text carried in the address').toBeLessThanOrEqual(2000);
    await popup.close();
  });
});
