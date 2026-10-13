'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Item 5: Speak notice layout and Talk buttons unoccluded', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('speakNotice sits above the bottom dock and never occludes #vAskPttBtn or #vPttBtn at 360, 700, 1280 in EN and FA', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    for (const lang of ['en', 'fa']) {
      await page.evaluate(l => {
        ui = l;
        document.documentElement.dir = l === 'fa' ? 'rtl' : 'ltr';
        document.documentElement.lang = l;
        if (typeof applyI18n === 'function') applyI18n();
      }, lang);

      for (const w of [360, 700, 1280]) {
        await page.setViewportSize({ width: w, height: 800 });

        // Show speakNotice with both retry and close
        await page.evaluate(() => {
          showSpeakNotice('Microphone is blocked', () => {});
        });
        const speakNotice = page.locator('#speakNotice');
        await expect(speakNotice).toBeVisible();

        // 1. Check Ask AI Talk button (#vAskPttBtn)
        await mouseClick(page, page.locator('#vTabAsk'));
        const askBtn = page.locator('#vAskPttBtn');
        await expect(askBtn).toBeVisible();
        const askBox = await askBtn.boundingBox();
        expect(askBox, `#vAskPttBtn bounding box at ${w}px in ${lang}`).not.toBeNull();

        const askCheck = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          const btn = document.getElementById('vAskPttBtn');
          return el === btn || (btn && btn.contains(el));
        }, { x: askBox.x + askBox.width / 2, y: askBox.y + askBox.height / 2 });
        expect(askCheck, `#vAskPttBtn occluded by notice at ${w}px in ${lang}`).toBe(true);

        // 2. Check Conversation Talk button (#vPttBtn)
        await mouseClick(page, page.locator('#vTabConv'));
        const pttBtn = page.locator('#vPttBtn');
        await expect(pttBtn).toBeVisible();
        const pttBox = await pttBtn.boundingBox();
        expect(pttBox, `#vPttBtn bounding box at ${w}px in ${lang}`).not.toBeNull();

        const pttCheck = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          const btn = document.getElementById('vPttBtn');
          return el === btn || (btn && btn.contains(el));
        }, { x: pttBox.x + pttBox.width / 2, y: pttBox.y + pttBox.height / 2 });
        expect(pttCheck, `#vPttBtn occluded by notice at ${w}px in ${lang}`).toBe(true);

        // 3. Verify notice dismiss button works with real mouse click
        await mouseClick(page, page.locator('#speakNoticeClose'));
        await expect(speakNotice).toBeHidden();
      }
    }
  });
});
