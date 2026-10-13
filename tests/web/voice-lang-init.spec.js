'use strict';
const { test, expect } = require('../support/fixtures');

test.describe('Item 1: Language picker visible names on fresh load without interaction', () => {
  test('after fresh load, each page shows visible non-empty language names with <bdi> and aria-hidden decorative display', async ({ app }) => {
    const { page } = app;
    await page.reload();
    await page.waitForTimeout(300);

    // 1. Voice page (#vLangPair)
    await page.locator('#tabs button[data-tab="voice"]').click();
    const vSrcDisplay = page.locator('#vLangPair [data-picker-role="src"] .lang-picker-display');
    const vTgtDisplay = page.locator('#vLangPair [data-picker-role="tgt"] .lang-picker-display');
    await expect(vSrcDisplay).toBeVisible();
    await expect(vTgtDisplay).toBeVisible();
    await expect(vSrcDisplay).toHaveAttribute('aria-hidden', 'true');
    await expect(vTgtDisplay).toHaveAttribute('aria-hidden', 'true');

    // Both inner display texts and bdi tags must be non-empty and visible
    const vSrcInner = vSrcDisplay.locator('.lang-display-inner');
    const vTgtInner = vTgtDisplay.locator('.lang-display-inner');
    await expect(vSrcInner).toBeVisible();
    await expect(vTgtInner).toBeVisible();
    expect((await vSrcInner.textContent()).trim().length).toBeGreaterThan(0);
    expect((await vTgtInner.textContent()).trim().length).toBeGreaterThan(0);

    const vSrcBdi = vSrcDisplay.locator('bdi');
    const vTgtBdi = vTgtDisplay.locator('bdi');
    await expect(vSrcBdi).toBeVisible();
    await expect(vTgtBdi).toBeVisible();
    expect((await vSrcBdi.textContent()).trim().length).toBeGreaterThan(0);
    expect((await vTgtBdi.textContent()).trim().length).toBeGreaterThan(0);

    // Accessible select is correctly labelled
    const vSrcSel = page.locator('#vSrc');
    const vTgtSel = page.locator('#vTgt');
    await expect(vSrcSel).toHaveAttribute('aria-label', /source|مبدأ/i);
    await expect(vTgtSel).toHaveAttribute('aria-label', /target|مقصد/i);

    // Detected badge is NOT shown before detection
    const vBadge = page.locator('#vSrc-detected-badge');
    await expect(vBadge).toBeHidden();

    // 2. Text page
    await page.locator('#tabs button[data-tab="text"]').click();
    const tSrcDisplay = page.locator('#tab-text [data-picker-role="src"] .lang-picker-display');
    const tTgtDisplay = page.locator('#tab-text [data-picker-role="tgt"] .lang-picker-display');
    await expect(tSrcDisplay).toBeVisible();
    await expect(tTgtDisplay).toBeVisible();
    await expect(tSrcDisplay).toHaveAttribute('aria-hidden', 'true');
    await expect(tSrcDisplay.locator('bdi')).toBeVisible();
    expect((await tSrcDisplay.locator('bdi').textContent()).trim().length).toBeGreaterThan(0);

    // 3. Subtitles page (unhidden workspace)
    await page.locator('#tabs button[data-tab="sub"]').click();
    await page.evaluate(() => { const el = document.getElementById('sWork'); if (el) el.hidden = false; });
    const sSrcDisplay = page.locator('#tab-sub [data-picker-role="src"] .lang-picker-display');
    const sTgtDisplay = page.locator('#tab-sub [data-picker-role="tgt"] .lang-picker-display');
    await expect(sSrcDisplay).toBeVisible();
    await expect(sTgtDisplay).toBeVisible();
    await expect(sSrcDisplay).toHaveAttribute('aria-hidden', 'true');
    await expect(sSrcDisplay.locator('bdi')).toBeVisible();
    expect((await sSrcDisplay.locator('bdi').textContent()).trim().length).toBeGreaterThan(0);

    // 4. Documents page (unhidden workspace)
    await page.locator('#tabs button[data-tab="doc"]').click();
    await page.evaluate(() => { const el = document.getElementById('dWork'); if (el) el.hidden = false; });
    const dSrcDisplay = page.locator('#tab-doc [data-picker-role="src"] .lang-picker-display');
    const dTgtDisplay = page.locator('#tab-doc [data-picker-role="tgt"] .lang-picker-display');
    await expect(dSrcDisplay).toBeVisible();
    await expect(dTgtDisplay).toBeVisible();
    await expect(dSrcDisplay).toHaveAttribute('aria-hidden', 'true');
    await expect(dSrcDisplay.locator('bdi')).toBeVisible();
    expect((await dSrcDisplay.locator('bdi').textContent()).trim().length).toBeGreaterThan(0);

    // 5. Screen page
    await page.locator('#tabs button[data-tab="screen"]').click();
    const scrSrcDisplay = page.locator('#tab-screen [data-picker-role="src"] .lang-picker-display');
    const scrTgtDisplay = page.locator('#tab-screen [data-picker-role="tgt"] .lang-picker-display');
    await expect(scrSrcDisplay).toBeVisible();
    await expect(scrTgtDisplay).toBeVisible();
    await expect(scrSrcDisplay).toHaveAttribute('aria-hidden', 'true');
    await expect(scrSrcDisplay.locator('bdi')).toBeVisible();
    expect((await scrSrcDisplay.locator('bdi').textContent()).trim().length).toBeGreaterThan(0);
  });
});
