'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Web app: Text tab redesign', () => {
  test.describe('Item 1: Page header and language bar', () => {
    test('all controls exist with identical IDs and labels', async ({ app }) => {
      const { page } = app;

      // Header exists with title and subtitle
      await expect(page.locator('.trans-page-title')).toHaveText('Translate');
      await expect(page.locator('.trans-page-sub')).toBeVisible();

      // Bar controls exist with preserved IDs
      await expect(page.locator('#src')).toBeVisible();
      await expect(page.locator('#swap')).toBeVisible();
      await expect(page.locator('#tgt')).toBeVisible();
      await expect(page.locator('#tMode')).toBeVisible();
      await expect(page.locator('#engine')).toBeVisible();
      await expect(page.locator('#tone')).toBeVisible();
      await expect(page.locator('#tSubject')).toBeVisible();
      await expect(page.locator('#tmToggle')).toBeVisible();

      // Check translation memory toggle default and interaction in the bar
      await expect(page.locator('#tmToggle')).toBeChecked();
      await mouseClick(page, page.locator('#tmToggle'));
      await expect(page.locator('#tmToggle')).not.toBeChecked();

      const cfgSaved = await page.evaluate(() => store.get('cfg', {}).tm);
      expect(cfgSaved).toBe(false);

      // Re-enable
      await mouseClick(page, page.locator('#tmToggle'));
      await expect(page.locator('#tmToggle')).toBeChecked();
    });

    test('bar does not cause horizontal overflow at 360, 700, and 1280px in English and Persian', async ({ app }) => {
      const { page } = app;
      const widths = [360, 700, 1280];

      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(50);

        for (const lang of ['en', 'fa']) {
          if (lang === 'fa') {
            await page.evaluate(() => {
              ui = 'fa';
              document.documentElement.dir = 'rtl';
              document.documentElement.lang = 'fa';
              applyI18n();
            });
            await expect(page.locator('.trans-page-title')).toHaveText('ترجمه');
          } else {
            await page.evaluate(() => {
              ui = 'en';
              document.documentElement.dir = 'ltr';
              document.documentElement.lang = 'en';
              applyI18n();
            });
            await expect(page.locator('.trans-page-title')).toHaveText('Translate');
          }

          await page.waitForTimeout(50);

          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          expect(scrollWidth, `no horizontal overflow at ${width}px in ${lang}`).toBeLessThanOrEqual(clientWidth + 1);

          // Bar itself is within viewport
          const barBox = await page.locator('.bar.trans-bar').boundingBox();
          expect(barBox).toBeTruthy();
          expect(barBox.x).toBeGreaterThanOrEqual(-1);
          expect(barBox.x + barBox.width).toBeLessThanOrEqual(width + 2);
        }
      }
    });
  });
});
