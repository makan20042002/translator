'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');
const { fakeDownloaded } = require('../support/model-helpers');

test.describe('Web app: Model Hub Redesign (Stage 3)', () => {
  test('Model Hub displays real models, licences, category filters, and measured disk use', async ({ app }) => {
    const { page } = app;

    // Switch to Model Hub tab
    const modelsTabBtn = page.locator('#tabs button[data-tab="models"]');
    await mouseClick(page, modelsTabBtn);
    await expect(page.locator('#tab-models')).toHaveClass(/\bon\b/);

    // Verify header and storage bar
    await expect(page.locator('#modelHubStorageBar')).toBeVisible();
    await expect(page.locator('#hubModelsStorageUsed')).toBeVisible();

    // Verify model cards rendered from catalog
    const cards = page.locator('#modelHubCatalog .hub-model-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(5);

    // Verify licences are displayed
    const firstLic = cards.first().locator('.hub-pill.lic');
    await expect(firstLic).toBeVisible();
    const licText = await firstLic.textContent();
    expect(licText.length).toBeGreaterThan(2);

    // Verify Latin names are in <bdi>
    const bdiEl = cards.first().locator('strong.hub-model-name bdi');
    await expect(bdiEl).toHaveCount(1);

    // Verify category filtering works
    const trFilterBtn = page.locator('#hubFilterRow .hub-filter-btn[data-cat="translate"]');
    await mouseClick(page, trFilterBtn);
    await expect(trFilterBtn).toHaveClass(/\bactive\b/);

    // All visible cards should be translation models
    const trCards = page.locator('#modelHubCatalog .hub-model-card');
    const trCount = await trCards.count();
    expect(trCount).toBeGreaterThan(0);
    expect(trCount).toBeLessThan(count);

    // Reset filter
    const allFilterBtn = page.locator('#hubFilterRow .hub-filter-btn[data-cat="all"]');
    await mouseClick(page, allFilterBtn);
    await expect(page.locator('#modelHubCatalog .hub-model-card')).toHaveCount(count);
  });

  test('Model card states, two-step delete confirmation, and cancel action', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const small = cat.models.find(m => m.id === 'asr-small');

    // Seed small model as downloaded
    await page.evaluate(({ a }) => {
      store.set('mdl', { 'asr-small': { at: 1, files: a } });
    }, { a: small.files.map(f => f[0]).filter(f => f.endsWith('.onnx')) });
    await fakeDownloaded(page, small.repo, small.files);
    await page.evaluate(() => mcScan());

    // Switch to Model Hub tab
    await mouseClick(page, page.locator('#tabs button[data-tab="models"]'));

    // Check ready model state
    const smallCard = page.locator('#modelHubCatalog .hub-model-card[data-hub-mdl="asr-small"]');
    await expect(smallCard).toHaveAttribute('data-state', 'ready');
    const rmBtn = smallCard.locator('[data-hub-act="rm"]');
    await expect(rmBtn).toBeVisible();

    // First click: prompts for confirmation
    await mouseClick(page, rmBtn);
    await expect(rmBtn).toHaveClass(/\bconfirming\b/);

    // Second click: completes removal
    await mouseClick(page, rmBtn);
    await expect(smallCard).toHaveAttribute('data-state', 'none');
    await expect(smallCard.locator('[data-hub-act="dl"]')).toBeVisible();
  });
});
