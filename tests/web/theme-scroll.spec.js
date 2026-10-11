'use strict';
/**
 * Test for Theme & Responsive Layout:
 * - CSS theme variables exist and match MAKAN dark navy palette.
 * - Light theme data-theme="light" overrides variables cleanly.
 * - The page has zero horizontal scroll at 1100 px and 1280 px width, in English (LTR) and Persian (RTL).
 */
const { test, expect } = require('../support/fixtures');

test.describe('Web app: Theme & Responsive Layout', () => {
  test('theme variables are loaded and light theme switch works', async ({ app }) => {
    const { page } = app;
    const colors = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const darkBg = rootStyle.getPropertyValue('--bg').trim();
      const darkGrad = rootStyle.getPropertyValue('--grad').trim();
      const pri = rootStyle.getPropertyValue('--pri').trim();

      document.documentElement.setAttribute('data-theme', 'light');
      const lightStyle = getComputedStyle(document.documentElement);
      const lightBg = lightStyle.getPropertyValue('--bg').trim();
      document.documentElement.removeAttribute('data-theme');

      return { darkBg, darkGrad, pri, lightBg };
    });

    expect(colors.darkBg, 'default dark background is defined').toBeTruthy();
    expect(colors.darkGrad, 'mint-to-blue gradient is defined').toContain('#79F8C8');
    expect(colors.pri, 'primary button blue is defined').toBeTruthy();
    expect(colors.lightBg, 'light background is defined and different').not.toBe(colors.darkBg);
  });

  test('page has no horizontal scroll at 1100 px and 1280 px width, in English and in Persian', async ({ app }) => {
    const { page } = app;

    for (const width of [1280, 1100]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);

      // Check English (LTR)
      let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      let clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `no horizontal scroll at ${width}px (LTR)`).toBeLessThanOrEqual(clientWidth + 1);

      // Switch to Persian (RTL)
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'fa';
      });
      await page.waitForTimeout(100);

      scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `no horizontal scroll at ${width}px (RTL)`).toBeLessThanOrEqual(clientWidth + 1);

      // Restore LTR
      await page.evaluate(() => {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
      });
    }
  });
});
