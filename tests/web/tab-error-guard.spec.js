'use strict';
const { test, expect } = require('../support/fixtures');
const { recordErrorsAcrossAllTabs } = require('../support/tab-error-guard');

test.describe('Web app: stability guard and language picker initialization', () => {

  test('load the app, switch through every tab, and open Settings with zero page errors or console errors', async ({ app }) => {
    const { page } = app;
    const { allErrors } = await recordErrorsAcrossAllTabs(page);
    expect(allErrors, `Expected zero errors across all tab switches, got:\n${allErrors.join('\n')}`).toEqual([]);
  });

  test('each page language picker is initialized with visible selected name text right after a fresh load with no interaction', async ({ app }) => {
    const { page } = app;
    await page.reload();
    await page.waitForTimeout(300);

    // 1. Text page
    await page.locator('#tabs button[data-tab="text"]').click();
    const textSrc = page.locator('#tab-text [data-picker-role="src"] .lang-picker-display .lang-display-inner');
    const textTgt = page.locator('#tab-text [data-picker-role="tgt"] .lang-picker-display .lang-display-inner');
    await expect(textSrc).toBeVisible();
    await expect(textTgt).toBeVisible();
    expect((await textSrc.textContent()).trim().length).toBeGreaterThan(0);
    expect((await textTgt.textContent()).trim().length).toBeGreaterThan(0);

    // 2. Voice page
    await page.locator('#tabs button[data-tab="voice"]').click();
    const voiceSrc = page.locator('#tab-voice [data-picker-role="src"] .lang-picker-display .lang-display-inner');
    const voiceTgt = page.locator('#tab-voice [data-picker-role="tgt"] .lang-picker-display .lang-display-inner');
    await expect(voiceSrc).toBeVisible();
    await expect(voiceTgt).toBeVisible();
    expect((await voiceSrc.textContent()).trim().length).toBeGreaterThan(0);
    expect((await voiceTgt.textContent()).trim().length).toBeGreaterThan(0);

    // 3. Subtitles page
    await page.locator('#tabs button[data-tab="sub"]').click();
    const subSrc = page.locator('#tab-sub [data-picker-role="src"] .lang-picker-display .lang-display-inner');
    const subTgt = page.locator('#tab-sub [data-picker-role="tgt"] .lang-picker-display .lang-display-inner');
    await expect(subSrc).toBeVisible();
    await expect(subTgt).toBeVisible();
    expect((await subSrc.textContent()).trim().length).toBeGreaterThan(0);
    expect((await subTgt.textContent()).trim().length).toBeGreaterThan(0);

    // 4. Documents page
    await page.locator('#tabs button[data-tab="doc"]').click();
    const docSrc = page.locator('#tab-doc [data-picker-role="src"] .lang-picker-display .lang-display-inner');
    const docTgt = page.locator('#tab-doc [data-picker-role="tgt"] .lang-picker-display .lang-display-inner');
    await expect(docSrc).toBeVisible();
    await expect(docTgt).toBeVisible();
    expect((await docSrc.textContent()).trim().length).toBeGreaterThan(0);
    expect((await docTgt.textContent()).trim().length).toBeGreaterThan(0);

    // 5. Screen page
    await page.locator('#tabs button[data-tab="screen"]').click();
    const scrSrc = page.locator('#tab-screen [data-picker-role="src"] .lang-picker-display .lang-display-inner');
    const scrTgt = page.locator('#tab-screen [data-picker-role="tgt"] .lang-picker-display .lang-display-inner');
    await expect(scrSrc).toBeVisible();
    await expect(scrTgt).toBeVisible();
    expect((await scrSrc.textContent()).trim().length).toBeGreaterThan(0);
    expect((await scrTgt.textContent()).trim().length).toBeGreaterThan(0);

    // 6. Ask AI (under Voice tab)
    await page.locator('#tabs button[data-tab="voice"]').click();
    await page.locator('#vTabAsk').click();
    const askDisplay = page.locator('#vAskView .lang-picker-display .lang-display-inner');
    await expect(askDisplay).toBeVisible();
    expect((await askDisplay.textContent()).trim().length).toBeGreaterThan(0);
  });
});
