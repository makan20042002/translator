'use strict';

const { test, expect, inShadow, rightClick, expectNoExtensionErrors } = require('../support/ext-fixtures');

test.describe('Extension: whole-page translation tooltip and screen button', () => {

  test('ITEM 1 - popup dimensions, viewport clamping, word wrapping, and hiding on mouseleave', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=tooltip-item1');
    await page.waitForLoadState('domcontentloaded');

    // Create a paragraph near the left edge and another near the bottom edge
    await page.evaluate(() => {
      const pLeft = document.createElement('p');
      pLeft.id = 'p-left-edge';
      pLeft.style.cssText = 'position:fixed;left:2px;top:100px;margin:0;width:160px;';
      pLeft.textContent = 'This is a left-edge paragraph with several words to test tooltip width and positioning.';
      document.body.appendChild(pLeft);

      const pBottom = document.createElement('p');
      pBottom.id = 'p-bottom-edge';
      pBottom.style.cssText = 'position:fixed;left:80px;bottom:6px;margin:0;width:160px;';
      pBottom.textContent = 'This is a bottom-edge paragraph positioned right near the bottom edge of the viewport.';
      document.body.appendChild(pBottom);
    });

    // Translate page via context menu
    await rightClick(page, '#title');
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#p-left-edge')).toContainText('[fa]');
    await expect(page.locator('#p-bottom-edge')).toContainText('[fa]');

    const tip = inShadow(page, '.makan-tooltip');

    // 1. Hover paragraph near left edge
    await page.mouse.move(0, 0);
    await page.locator('#p-left-edge').hover();
    await expect(tip).toBeVisible({ timeout: 5000 });

    const boxLeft = await tip.boundingBox();
    expect(boxLeft).toBeTruthy();
    expect(boxLeft.width).toBeGreaterThanOrEqual(200);
    expect(boxLeft.width).toBeLessThanOrEqual(340);

    const vp = await page.viewportSize();
    expect(boxLeft.x).toBeGreaterThanOrEqual(0);
    expect(boxLeft.x + boxLeft.width).toBeLessThanOrEqual(vp.width);
    expect(boxLeft.y).toBeGreaterThanOrEqual(0);
    expect(boxLeft.y + boxLeft.height).toBeLessThanOrEqual(vp.height);

    // Mouse leaves left element -> hidden after 100 ms
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await expect(tip).toBeHidden();

    // 2. Hover paragraph near bottom edge (flips above and stays inside viewport)
    await page.locator('#p-bottom-edge').hover();
    await expect(tip).toBeVisible({ timeout: 5000 });

    const boxBottom = await tip.boundingBox();
    expect(boxBottom).toBeTruthy();
    expect(boxBottom.width).toBeGreaterThanOrEqual(200);
    expect(boxBottom.width).toBeLessThanOrEqual(340);
    expect(boxBottom.x).toBeGreaterThanOrEqual(0);
    expect(boxBottom.x + boxBottom.width).toBeLessThanOrEqual(vp.width);
    expect(boxBottom.y).toBeGreaterThanOrEqual(0);
    expect(boxBottom.y + boxBottom.height).toBeLessThanOrEqual(vp.height);

    // Mouse leaves bottom element -> hidden after 100 ms
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await expect(tip).toBeHidden();

    await page.close();
    await expectNoExtensionErrors(ext);
  });

});
