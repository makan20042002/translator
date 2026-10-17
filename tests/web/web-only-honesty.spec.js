'use strict';

/**
 * tests/web/web-only-honesty.spec.js
 * Verifies honesty of desktop-only features in the plain web browser vs desktop app:
 * - In plain browser (no desktop host):
 *     1. Screen Translator header button (#btnScreenTrans) is hidden.
 *     2. Screen Translator settings in Settings (#screenTransSettingsBlock) is hidden.
 *     3. Screen tab primary capture button (#tabScreenLaunchBtn) is disabled with a visible notice (#screenBrowserBanner) in both EN and FA.
 *     4. Subtitles tab video-to-subtitles button (#subVideoBtn) is disabled with a visible helper note in both EN and FA.
 *     5. Python ASR helper settings show an explicit honesty notice (#helperHonestyNotice) in both EN and FA.
 *     6. Media tab "save next to file" option (.mt-pv-nextrow) is hidden without a desktop filesystem host.
 * - With desktop host fixture (window.makanDesktop injected):
 *     1. Screen Translator button (#btnScreenTrans) is visible.
 *     2. Screen Translator settings (#screenTransSettingsBlock) is visible.
 *     3. Screen tab primary capture button (#tabScreenLaunchBtn) is enabled.
 *     4. Browser banner (#screenBrowserBanner) is hidden.
 */

const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Web-only Honesty Controls (ITEM 4)', () => {
  test('in plain browser, desktop-only features are hidden or disabled with clear explanations in EN and FA', async ({ app }) => {
    const { page } = app;

    // --- English Mode ---
    // 1. Header button is hidden in browser
    await expect(page.locator('#btnScreenTrans')).toBeHidden();

    // 2. Settings: Screen Translator block is hidden
    await page.locator('#openSet').click();
    await expect(page.locator('#screenTransSettingsBlock')).toBeHidden();

    // 3. Helper honesty notice in Settings
    const helperNotice = page.locator('#helperHonestyNotice');
    await expect(helperNotice).toContainText('Python ASR Helper requires running the local helper server');
    await page.locator('#closeSet').click();

    // 4. Screen tab: capture button disabled, browser banner visible with explanation
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(page.locator('#screenBrowserBanner')).toBeVisible();
    await expect(page.locator('#screenBrowserBanner')).toContainText('Native screen capture requires the MAKAN Windows desktop app');
    await expect(page.locator('#tabScreenLaunchBtn')).toBeDisabled();
    const titleAttr = await page.locator('#tabScreenLaunchBtn').getAttribute('title');
    expect(titleAttr).toContain('Native screen capture requires');

    // 5. Subtitles tab: subVideoBtn is disabled with speech helper note
    await page.locator('#tabs button[data-tab="sub"]').click();
    await expect(page.locator('#subVideoBtn')).toBeDisabled();
    await expect(page.locator('.sub-video-note')).toBeVisible();
    await expect(page.locator('.sub-video-note')).toContainText('Requires the local speech helper desktop app');

    // 6. Media tab: save next to file is hidden
    await page.locator('#tabs button[data-tab="media"]').click();
    await expect(page.locator('.mt-pv-nextrow')).toBeHidden();

    // --- Switch to Persian (FA) Mode ---
    await page.locator('#uiLang').selectOption('fa');

    // Verify Screen tab in Persian
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(page.locator('#screenBrowserBanner')).toBeVisible();
    await expect(page.locator('#screenBrowserBanner')).toContainText('عکس‌برداری مستقیم از صفحه به برنامه ویندوز MAKAN نیاز دارد');
    await expect(page.locator('#tabScreenLaunchBtn')).toBeDisabled();

    // Verify Subtitles tab in Persian
    await page.locator('#tabs button[data-tab="sub"]').click();
    await expect(page.locator('#subVideoBtn')).toBeDisabled();
    await expect(page.locator('.sub-video-note')).toContainText('نیاز به دستیار گفتار محلی دارد');

    // Verify Helper notice in Persian
    await page.locator('#openSet').click();
    await expect(page.locator('#helperHonestyNotice')).toContainText('دستیار گفتار پایتون نیاز به اجرای سرور کمکی محلی');
    await page.locator('#closeSet').click();
  });

  test('with desktop host fixture, the desktop features become available and enabled', async ({ app }) => {
    const { page, context } = app;

    // Inject the standard desktop API mock
    await context.addInitScript(() => {
      window.makanDesktop = {
        isDesktop: true,
        startScreenTranslator: () => {},
        getOcrLanguages: () => Promise.resolve([
          { tag: 'en-US', displayName: 'English (United States)', nativeName: 'English' },
          { tag: 'fa-IR', displayName: 'Persian', nativeName: 'فارسی' }
        ]),
        getOcrEngines: () => Promise.resolve([
          { id: 'windows', name: 'Windows Media OCR', available: true }
        ]),
        getScreenTransConfig: () => Promise.resolve({
          enabled: true,
          hotkey: 'CommandOrControl+Shift+S',
          targetLang: 'fa',
          ocrLang: 'en-US',
          ocrEngine: 'windows'
        }),
        saveScreenTransConfig: () => Promise.resolve({ ok: true }),
        onExecuteScreenTranslation: () => {},
        sendScreenTranslationResponse: () => {},
        onLoadTranslationInput: () => {}
      };
    });

    await page.reload();

    // 1. Header Screen Translator button is visible in desktop mode
    await expect(page.locator('#btnScreenTrans')).toBeVisible();

    // 2. Settings: Screen Translator block is visible in desktop mode
    await page.locator('#openSet').click();
    await expect(page.locator('#screenTransSettingsBlock')).toBeVisible();
    await page.locator('#closeSet').click();

    // 3. Screen tab: banner is hidden and capture button is enabled
    await page.locator('#tabs button[data-tab="screen"]').click();
    await expect(page.locator('#screenBrowserBanner')).toBeHidden();
    await expect(page.locator('#tabScreenLaunchBtn')).toBeEnabled();
  });
});
