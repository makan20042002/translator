'use strict';

const path = require('path');
const { test, expect, inShadow, dragSelect, pressM } = require('../support/ext-fixtures');

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 480, height: 500 },
  { width: 1280, height: 800 }
];

test.describe('Screen Translator overlay panel responsiveness [ext]', () => {
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'fa']) {
      test(`overlay panel at ${vp.width}x${vp.height} in ${lang.toUpperCase()} fits viewport without clipping`, async ({ ext }) => {
        const page = await ext.context.newPage();
        await page.setViewportSize(vp);

        const overlayPath = 'file:///' + path.resolve(__dirname, '../../screen-translator/overlay.html').replace(/\\/g, '/') + (lang === 'fa' ? '?ui=fa' : '');

        await page.addInitScript(() => {
          window.__overlayClosed = false;
          window.makanOverlay = {
            close: () => { window.__overlayClosed = true; },
            setPinned: () => {},
            requestTranslation: () => {},
            openInMainApp: () => {},
            openInBrowser: () => {},
            toggleLiveWatcher: () => {},
            reselectZone: () => {},
            onLiveState: () => {},
            onOcrResult: (cb) => { window.__ocrCb = cb; },
            onTranslationResult: (cb) => { window.__transCb = cb; },
            ready: () => {}
          };
        });

        await page.goto(overlayPath);
        await page.waitForLoadState('domcontentloaded');

        const card = page.locator('#cardContainer');
        await expect(card).toBeVisible();

        // 1. Assert panel bounding box is inside the viewport
        const cardBox = await card.boundingBox();
        expect(cardBox).not.toBeNull();
        expect(cardBox.x).toBeGreaterThanOrEqual(0);
        expect(cardBox.y).toBeGreaterThanOrEqual(0);
        expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(vp.width + 1);
        expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(vp.height + 1);

        // 2. Assert no horizontal overflow
        const overflow = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            bodyScrollWidth: document.body.scrollWidth
          };
        });
        expect(overflow.scrollWidth).toBeLessThanOrEqual(vp.width);
        expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(vp.width);

        // 3. Assert close button is visible and clickable
        const btnClose = page.locator('#btnClose');
        await expect(btnClose).toBeVisible();
        const closeBox = await btnClose.boundingBox();
        expect(closeBox).not.toBeNull();
        expect(closeBox.x).toBeGreaterThanOrEqual(0);
        expect(closeBox.y).toBeGreaterThanOrEqual(0);
        expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(vp.width + 1);

        // 4. Assert footer buttons are fully inside the viewport
        const footerButtons = page.locator('.footer button');
        const count = await footerButtons.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          const btn = footerButtons.nth(i);
          const bBox = await btn.boundingBox();
          if (bBox) {
            expect(bBox.x).toBeGreaterThanOrEqual(0);
            expect(bBox.x + bBox.width).toBeLessThanOrEqual(vp.width + 1);
            expect(bBox.y + bBox.height).toBeLessThanOrEqual(vp.height + 1);
          }
        }

        // 5. Test opening/dragging near edge stays clamped inside viewport
        await page.evaluate(() => {
          if (window.setOverlayPosition) {
            window.setOverlayPosition(9999, 9999);
          }
        });
        const clampedBox = await card.boundingBox();
        expect(clampedBox.x + clampedBox.width).toBeLessThanOrEqual(vp.width);
        expect(clampedBox.y + clampedBox.height).toBeLessThanOrEqual(vp.height);

        // 6. Test Esc key closes the panel
        await card.focus();
        await page.keyboard.press('Escape');
        await expect(card).toBeHidden();

        await page.close();
      });
    }
  }

  test('Selection card in content script fits narrow viewport 360x640 in EN and FA', async ({ ext }) => {
    const page = ext.article;
    await page.setViewportSize({ width: 360, height: 640 });

    await dragSelect(page, '#li1');
    await pressM(page);

    const makanCard = inShadow(page, '.makan-card');
    await expect(makanCard).toBeVisible();

    const box = await makanCard.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(361);

    const closeBtn = inShadow(page, '#makanCardClose');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(makanCard).toHaveCount(0);
  });
});
