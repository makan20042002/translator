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
        await askBtn.scrollIntoViewIfNeeded();
        const askBox = await askBtn.boundingBox();
        expect(askBox, `#vAskPttBtn bounding box at ${w}px in ${lang}`).not.toBeNull();

        const askCx = askBox.x + askBox.width / 2;
        const askCy = askBox.y + askBox.height / 2;
        const askCheck = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          const btn = document.getElementById('vAskPttBtn');
          const isTarget = el === btn || (btn && btn.contains(el));
          let desc = 'null (outside viewport)';
          let isNotice = false;
          if (el) {
            desc = el.tagName.toLowerCase();
            if (el.id) desc += '#' + el.id;
            if (el.className) desc += '.' + String(el.className).trim().replace(/\s+/g, '.');
            const notice = document.getElementById('speakNotice');
            isNotice = el === notice || (notice && notice.contains(el));
          }
          return { isTarget, desc, isNotice };
        }, { x: askCx, y: askCy });

        const askCause = askCheck.isNotice ? 'by notice' : `by <${askCheck.desc}>`;
        expect(
          askCheck.isTarget,
          `#vAskPttBtn occluded ${askCause} at (${askCx.toFixed(1)}, ${askCy.toFixed(1)}) box [x:${askBox.x.toFixed(1)}, y:${askBox.y.toFixed(1)}, w:${askBox.width.toFixed(1)}, h:${askBox.height.toFixed(1)}] at ${w}px in ${lang}`
        ).toBe(true);

        // 2. Check Conversation Talk button (#vPttBtn)
        await mouseClick(page, page.locator('#vTabConv'));
        const pttBtn = page.locator('#vPttBtn');
        await expect(pttBtn).toBeVisible();
        await pttBtn.scrollIntoViewIfNeeded();
        const pttBox = await pttBtn.boundingBox();
        expect(pttBox, `#vPttBtn bounding box at ${w}px in ${lang}`).not.toBeNull();

        const pttCx = pttBox.x + pttBox.width / 2;
        const pttCy = pttBox.y + pttBox.height / 2;
        const pttCheck = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          const btn = document.getElementById('vPttBtn');
          const isTarget = el === btn || (btn && btn.contains(el));
          let desc = 'null (outside viewport)';
          let isNotice = false;
          if (el) {
            desc = el.tagName.toLowerCase();
            if (el.id) desc += '#' + el.id;
            if (el.className) desc += '.' + String(el.className).trim().replace(/\s+/g, '.');
            const notice = document.getElementById('speakNotice');
            isNotice = el === notice || (notice && notice.contains(el));
          }
          return { isTarget, desc, isNotice };
        }, { x: pttCx, y: pttCy });

        const pttCause = pttCheck.isNotice ? 'by notice' : `by <${pttCheck.desc}>`;
        expect(
          pttCheck.isTarget,
          `#vPttBtn occluded ${pttCause} at (${pttCx.toFixed(1)}, ${pttCy.toFixed(1)}) box [x:${pttBox.x.toFixed(1)}, y:${pttBox.y.toFixed(1)}, w:${pttBox.width.toFixed(1)}, h:${pttBox.height.toFixed(1)}] at ${w}px in ${lang}`
        ).toBe(true);

        // 3. Verify notice dismiss button works with real mouse click
        await mouseClick(page, page.locator('#speakNoticeClose'));
        await expect(speakNotice).toBeHidden();
      }
    }
  });
});
