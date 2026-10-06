'use strict';
// Compact source / target language selectors in the selection card and the popup: same list as the web app,
// the last choice is remembered, and Swap keeps working.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup } = require('../support/ext-fixtures');

test.describe('Extension: language selectors', () => {
  test('the card has source and target selectors with the full language list; picking one translates again and is remembered', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
    const src = inShadow(page, '#makanSrcSel');
    const tgt = inShadow(page, '#makanTgtSel');
    await expect(src).toHaveValue('auto');
    await expect(tgt).toHaveValue('fa');
    expect(await tgt.locator('option').count(), 'languages offered').toBeGreaterThan(20);
    expect(await src.locator('option').first().textContent()).toMatch(/Auto/);

    // A real keyboard choice (page scripts' made-up events are ignored).
    await tgt.focus();
    await page.keyboard.type('German');
    await expect(tgt).toHaveValue('de');
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[de] First item in the list of things.');
    await expect(inShadow(page, '#makanPairPill')).toHaveText('AUTO → DE');
    await expect.poll(async () => (await ext.getConfig()).tgt, { message: 'remembered target language' }).toBe('de');

    // Swap still works and the selectors follow it.
    await inShadow(page, '#makanSwapBtn').click();
    await expect(src).toHaveValue('de');
    await expect(inShadow(page, '#makanPairPill')).toHaveText(/^DE → /);
    await expect.poll(async () => (await ext.getConfig()).src).toBe('de');
  });

  test('a new card starts with the remembered choice', async ({ ext }) => {
    await ext.patchConfig({ src: 'en', tgt: 'de' });
    const page = ext.article;
    await page.reload();
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '#makanTgtSel')).toHaveValue('de');
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[de] First item in the list of things.');
  });

  test('a page script cannot change the card\'s language or save one', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
    await page.evaluate(() => {
      const sel = document.querySelector('#makan-translate-root').shadowRoot.querySelector('#makanTgtSel');
      sel.value = 'de'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
    expect((await ext.getConfig()).tgt).toBe('fa');
  });

  test('the popup has selectors, remembers the last choice, and Swap works', async ({ ext }) => {
    let popup = await openRealPopup(ext);
    expect(await popup.eval(`document.getElementById('pTgtLang').options.length`)).toBeGreaterThan(20);
    await popup.eval(`(() => { const s = document.getElementById('pTgtLang'); s.value = 'de'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await expect.poll(async () => (await ext.getConfig()).tgt).toBe('de');
    await popup.close();
    popup = await openRealPopup(ext);
    expect(await popup.eval(`document.getElementById('pTgtLang').value`)).toBe('de');
    const before = await popup.eval(`[document.getElementById('pSrcLang').value, document.getElementById('pTgtLang').value]`);
    await popup.click('#pSwapLang');
    const after = await popup.eval(`[document.getElementById('pSrcLang').value, document.getElementById('pTgtLang').value]`);
    expect(after[1]).not.toBe(before[1]);
    expect(after[0]).toBe(before[1]);
    await popup.close();
  });
});
