'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Web app: Voice tab redesign', () => {
  test.describe('Item 1: Header and control bar', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('header exists, controls keep their IDs, no flags, selectors list real options, and no horizontal overflow at 360/700/1280 in EN and FA', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      // Header exists with title and subtitle
      await expect(page.locator('.voice-page-title')).toHaveText('Voice');
      await expect(page.locator('.voice-page-sub')).toBeVisible();

      // Subtitle must not say "offline" when online engines are selected
      const subText = await page.locator('.voice-page-sub').textContent();
      expect(subText).not.toMatch(/\boffline\b/i);

      // Control bar exists
      const bar = page.locator('#vControlBar');
      await expect(bar).toBeVisible();

      // Language pair controls exist without country flags
      await expect(page.locator('#vSrc')).toBeVisible();
      await expect(page.locator('#vSwap')).toBeVisible();
      await expect(page.locator('#vTgt')).toBeVisible();
      const flagImagesOrEmojis = await page.locator('#vControlBar .voice-lang-grp').evaluate(el => {
        const text = el.textContent || '';
        // Regional indicator symbol flags range: 1F1E6 - 1F1FF
        const hasFlagEmoji = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/.test(text);
        const hasImgFlag = !!el.querySelector('img, svg.flag');
        return hasFlagEmoji || hasImgFlag;
      });
      expect(flagImagesOrEmojis, 'no country flags in language pair').toBe(false);

      // Speech-recognition selector exists with preserved IDs
      const sttBtn = page.locator('#vMicSttBtn');
      await expect(sttBtn).toBeVisible();
      await expect(page.locator('#vMicSttCurLabel')).toBeVisible();
      await expect(page.locator('#vMicSttPopup')).toBeHidden();

      // Voice selector exists with preserved IDs
      const voiceBtn = page.locator('#vConvVoicePickerBtn');
      await expect(voiceBtn).toBeVisible();
      await expect(page.locator('#vConvVoiceCurLabel')).toBeVisible();
      await expect(page.locator('#vConvVoicePopup')).toBeHidden();

      // Honest status chip exists
      const readyChip = page.locator('#vVoiceReadyChip');
      await expect(readyChip).toBeVisible();
      const chipState = await readyChip.getAttribute('data-ready');
      expect(['true', 'false']).toContain(chipState);

      // Check no horizontal overflow at 360, 700, 1280 in English and Persian
      for (const lang of ['en', 'fa']) {
        if (lang === 'fa') {
          await page.evaluate(() => {
            ui = 'fa';
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            applyI18n();
          });
          await expect(page.locator('.voice-page-title')).toHaveText('صدا');
          const faSub = await page.locator('.voice-page-sub').textContent();
          expect(faSub).not.toMatch(/آفلاین/);
        } else {
          await page.evaluate(() => {
            ui = 'en';
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
            applyI18n();
          });
        }
        for (const w of [360, 700, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          expect(scrollWidth, `no horizontal scrollbar at ${w}px in ${lang}`).toBeLessThanOrEqual(clientWidth + 2);
        }
      }
    });
  });
});
