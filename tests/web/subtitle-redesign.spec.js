'use strict';
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Web app: Subtitle tab redesign', () => {
  test.describe('Item 1: Page header and entry cards', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('header exists, #sDrop works, video card is disabled coming-soon without fake whisper, and no horizontal overflow at 360/700/1280 in EN and FA', async ({ app, files }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));

      // Header exists with title and subtitle
      await expect(page.locator('.sub-page-title')).toHaveText('Subtitles');
      await expect(page.locator('.sub-page-sub')).toBeVisible();
      // Subtitle only mentions supported formats .srt and .vtt, not .ass
      const subText = await page.locator('.sub-page-sub').textContent();
      expect(subText).toContain('.srt');
      expect(subText).toContain('.vtt');
      expect(subText).not.toContain('.ass');

      // Card 1: format chips only for supported formats
      const chips = page.locator('#sDrop .sub-chip');
      await expect(chips).toHaveCount(2);
      await expect(chips.nth(0)).toHaveText('SRT');
      await expect(chips.nth(1)).toHaveText('VTT');

      // Card 2: honest coming soon, disabled button, no Whisper claim
      const videoCard = page.locator('#sVideoCard');
      await expect(videoCard).toBeVisible();
      await expect(videoCard.locator('.sub-coming-soon-badge')).toContainText(/coming soon/i);
      await expect(videoCard.locator('button')).toBeDisabled();
      const videoCardText = await videoCard.textContent();
      expect(videoCardText).not.toMatch(/whisper/i);

      // Verify no horizontal overflow at 360, 700, 1280 in English and Persian
      for (const lang of ['en', 'fa']) {
        if (lang === 'fa') {
          await page.evaluate(() => {
            ui = 'fa';
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            applyI18n();
          });
        }
        for (const w of [360, 700, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });
          const dropBox = await page.locator('#sDrop').boundingBox();
          const strongBox = await page.locator('#sDrop strong').boundingBox();
          const videoBox = await page.locator('#sVideoCard').boundingBox();
          expect(dropBox, `sDrop exists at ${w}px in ${lang}`).toBeTruthy();
          expect(dropBox.x).toBeGreaterThanOrEqual(0);
          expect(dropBox.x + dropBox.width).toBeLessThanOrEqual(w + 1);
          expect(strongBox.x).toBeGreaterThanOrEqual(dropBox.x);
          expect(strongBox.x + strongBox.width).toBeLessThanOrEqual(dropBox.x + dropBox.width + 1);
          expect(videoBox.x).toBeGreaterThanOrEqual(0);
          expect(videoBox.x + videoBox.width).toBeLessThanOrEqual(w + 1);
        }
      }

      // Switch back to English and open a real file: #sDrop works, entry cards hide, #sWork shows
      await page.setViewportSize({ width: 1024, height: 800 });
      await page.evaluate(() => {
        ui = 'en';
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
        applyI18n();
      });
      await chooseFile(page, page.locator('#sDrop'), files.srt);
      await expect(page.locator('#sWork')).toBeVisible();
      await expect(page.locator('#sDrop')).toBeHidden();
      await expect(page.locator('#sVideoCard')).toBeHidden();
    });
  });
});
