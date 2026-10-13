'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');
const { openSettings, activateSettingsTab } = require('../support/model-helpers');

test.describe('Item 3: Settings #dlTr button interactivity and tab attachment', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('clicking #dlTr in trModels tab remains stably attached and clickable with real mouse', async ({ app }) => {
    const { page } = app;
    await openSettings(page, 'trModels');

    const dlTr = page.locator('#dlTr');
    await expect(dlTr).toBeVisible();
    await expect(dlTr).toBeEnabled();

    // Verify it is firmly attached and interactable with mouseClick
    const box = await dlTr.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);

    // Clicking with mouse does not throw detachment error
    await mouseClick(page, dlTr);
    await expect(page.locator('#ov')).toBeVisible();
  });
});
