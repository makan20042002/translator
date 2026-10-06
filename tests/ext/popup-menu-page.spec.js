'use strict';
// Extension: real toolbar popup, right-click menu, whole-page translation.
const { test, expect, inShadow, dragSelect, pressM, rightClick, openRealPopup, expectNoExtensionErrors } = require('../support/ext-fixtures');

const ARTICLE = '/__test/article.html';

test.describe('Extension: toolbar popup (the real popup, opened with chrome.action.openPopup)', () => {
  test('translates typed text', async ({ ext, stub }) => {
    const popup = await openRealPopup(ext);
    await popup.waitFor(`document.getElementById('pTgtLang').value === 'fa'`);
    await popup.click('#pInputText');
    await popup.type('Hello from the popup');
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent === '[fa] Hello from the popup'`);
    expect(await popup.eval(`document.getElementById('pOutputEngine').textContent`)).toBe('Google Translate');
    expect(await popup.eval(`document.getElementById('pOutputText').dir`)).toBe('rtl');
    expect(await popup.eval(`document.getElementById('pSiteLabel').textContent`)).toBe('Enabled on site');
    expect(popup.consoleErrors).toEqual([]);
    expect(stub.calls('clients5.google.com')).toHaveLength(1);
    await popup.close();
    await expectNoExtensionErrors(ext);
  });

  test('"Translate Page" translates the page in the tab, and "Show Original" restores it', async ({ ext }) => {
    const page = ext.article;
    const popup = await openRealPopup(ext);
    await popup.click('#pPageTransBtn');
    await expect(page.locator('#p1')).toHaveText('[fa] The quick brown fox jumps over the lazy dog near the river bank.');
    await expect(page.locator('#li2')).toHaveText('[fa] Second item in the list of things.');
    await expect(page.locator('#p1')).toHaveAttribute('dir', 'rtl');
    await expect(inShadow(page, '.makan-top-banner')).toContainText('Page translated to FA');
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(page.locator('#p1')).toHaveText('The quick brown fox jumps over the lazy dog near the river bank.');
    await expect(page.locator('#p1')).not.toHaveAttribute('dir', 'rtl');
    await expect(inShadow(page, '.makan-top-banner')).toHaveCount(0);
  });
});

test.describe('Extension: right-click menu', () => {
  test('"Translate with MAKAN" works on a tab that was open before the extension was loaded', async ({ ext }) => {
    // ext.article was opened first; the extension was installed afterwards.
    const page = ext.article;
    await dragSelect(page, '#li1');
    await rightClick(page, '#li1');
    await ext.clickContextMenu('makan-translate-sel', page.url(), 'First item in the list of things.');
    await expect(inShadow(page, '.makan-card .makan-result-text')).toHaveText('[fa] First item in the list of things.');
    await expectNoExtensionErrors(ext);
  });

  test('"Translate with MAKAN" injects the extension into a tab that does not have it yet', async ({ ext, stub }) => {
    // Turn the extension off, open a tab, turn it back on. Chrome does not put
    // the content script into tabs that were opened while it was off.
    const mgr = await ext.context.newPage();
    await mgr.goto('chrome://extensions');
    await mgr.evaluate(id => new Promise(r => chrome.management.setEnabled(id, false, r)), ext.id);
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + ARTICLE + '?opened-while-off');
    await mgr.evaluate(id => new Promise(r => chrome.management.setEnabled(id, true, r)), ext.id);
    await mgr.close();
    await page.bringToFront();
    await page.waitForTimeout(500);
    expect(await page.locator('#makan-translate-root').count(), 'content script present before the menu is used').toBe(0);
    await dragSelect(page, '#li2');
    await rightClick(page, '#li2');
    await ext.clickContextMenu('makan-translate-sel', page.url(), 'Second item in the list of things.');
    await expect(inShadow(page, '.makan-card .makan-result-text')).toHaveText('[fa] Second item in the list of things.');
  });

  test('"Translate entire page" translates and "Show Original" restores the text', async ({ ext }) => {
    const page = ext.article;
    await rightClick(page, '#p1');
    await ext.clickContextMenu('makan-translate-page', page.url());
    await expect(page.locator('#title')).toHaveText('[fa] A simple article for testing');
    await expect(page.locator('#p1')).toHaveText('[fa] The quick brown fox jumps over the lazy dog near the river bank.');
    // Hovering a translated paragraph shows the original (move away first so the mouse really enters it).
    await page.mouse.move(5, 5);
    await page.locator('#p1').hover();
    await expect(inShadow(page, '.makan-tooltip')).toContainText('The quick brown fox');
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(page.locator('#title')).toHaveText('A simple article for testing');
    await expect(page.locator('#p1')).toHaveText('The quick brown fox jumps over the lazy dog near the river bank.');
    await expectNoExtensionErrors(ext);
  });

  test('"Show Original" brings back links and bold text inside translated paragraphs', async ({ ext }) => {
    const page = ext.article;
    await ext.clickContextMenu('makan-translate-page', page.url());
    await expect(page.locator('#p2')).toContainText('[fa]');
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(page.locator('#p2')).toHaveText('This paragraph has a useful link and some bold words inside it.');
    await expect(page.locator('#p2 a#link1'), 'the link inside the paragraph').toHaveCount(1);
    await expect(page.locator('#p2 b#bold1'), 'the bold text inside the paragraph').toHaveCount(1);
  });

  test('the page banner names the engine that was actually used', async ({ ext }) => {
    // Default order starts with Gemini, which has no key, so Google does the work.
    const page = ext.article;
    await ext.clickContextMenu('makan-translate-page', page.url());
    await expect(inShadow(page, '.makan-top-banner')).toContainText('Page translated');
    await expect(inShadow(page, '.makan-top-banner')).toContainText(/google/i);
  });

  test('when every engine fails, the page banner says so instead of "Page translated"', async ({ ext, stub }) => {
    const page = ext.article;
    for (const h of ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net']) stub.failHost(h, 503);
    await ext.clickContextMenu('makan-translate-page', page.url());
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).not.toContainText('Translating', { timeout: 20_000 });
    await expect(page.locator('#p1')).toHaveText('The quick brown fox jumps over the lazy dog near the river bank.');
    await expect(banner, 'nothing was translated').not.toContainText('Page translated');
  });
});

test.describe('Extension: after the extension is reloaded', () => {
  test('selecting text in a tab that was already open still translates', async ({ ext }) => {
    const page = ext.article;
    await ext.inExtension(() => { setTimeout(() => chrome.runtime.reload(), 50); });
    await page.waitForTimeout(2500);
    await ext.worker();
    const roots = await page.locator('#makan-translate-root').count();
    test.info().annotations.push({ type: 'copies of the extension UI layer in the tab after reload', description: String(roots) });
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-card .makan-result-text').last()).toHaveText('[fa] First item in the list of things.');
  });
});

test.describe('Extension: what web pages can and cannot do', () => {
  test('a web page cannot make the extension translate it without the user asking', async ({ ext, stub }) => {
    const page = ext.article;
    stub.clearLog();
    await page.evaluate(() => document.dispatchEvent(new Event('__makan_page_translate_action')));
    await page.waitForTimeout(2000);
    expect(stub.calls().filter(c => ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net', 'generativelanguage.googleapis.com'].includes(c.host)).map(c => c.host + c.path), 'translation requests started by the page itself').toEqual([]);
    await expect(page.locator('#p1')).toHaveText('The quick brown fox jumps over the lazy dog near the river bank.');
  });
});
