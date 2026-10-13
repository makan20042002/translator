'use strict';
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Item 6: Documents page layout and viewport bounds', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('Download button remains fully inside 900px viewport and unoccluded right after translation finishes', async ({ app, files }) => {
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 900 });
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const dSave = page.locator('#dSave');
    await expect(dSave).toBeEnabled({ timeout: 20_000 });

    const box = await dSave.boundingBox();
    expect(box, '#dSave bounding box').not.toBeNull();
    // Bounding box must be strictly within the 900px viewport
    expect(box.y + box.height).toBeLessThanOrEqual(900);

    const onTop = await page.evaluate(({ x, y }) => {
      const e = document.elementFromPoint(x, y);
      return e.id || e.className || e.tagName;
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(onTop).toBe('dSave');

    // Verify textarea height is generous (at least 110px)
    const taBox = await page.locator('#dIn').boundingBox();
    expect(taBox).not.toBeNull();
    expect(taBox.height).toBeGreaterThanOrEqual(110);
  });
});
