'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('App boot and tabs stability: no page errors', () => {

  test('load the app, listen to pageerror, verify clean boot and tab navigation without errors', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];

    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    // Reload with pageerror listener attached from early boot
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify boot completed successfully (did not crash in applyI18n / updateDocEngineInfo)
    // Target and source language selects should be populated (not empty or '??')
    const tgt = page.locator('#tgt');
    await expect(tgt).toBeVisible();
    const tgtVal = await tgt.inputValue();
    expect(tgtVal).toBeTruthy();
    expect(tgtVal).not.toBe('??');

    const src = page.locator('#src');
    await expect(src).toBeVisible();
    const srcVal = await src.inputValue();
    expect(srcVal).toBeTruthy();

    // Text tab engine picker should be mounted
    const textPicker = page.locator('#textEnginePickerHost .engine-picker');
    await expect(textPicker, 'Text tab engine picker should mount on boot').toBeVisible();

    // 2. Iterate through every main tab and verify no errors
    const tabButtons = await page.locator('#tabs button[data-tab]').all();
    expect(tabButtons.length).toBeGreaterThan(0);

    for (const btn of tabButtons) {
      const tabName = await btn.getAttribute('data-tab');
      await mouseClick(page, btn);
      await page.waitForTimeout(60);

      // Verify specific tab requirements on relevant tabs
      if (tabName === 'doc') {
        const docPicker = page.locator('#docEnginePickerHost .engine-picker');
        await expect(docPicker, 'Document tab engine picker should be mounted').toBeVisible();
        const docEngineText = page.locator('#docEngineText');
        await expect(docEngineText).not.toHaveText('');
        await expect(docEngineText).not.toContainText('??');
      } else if (tabName === 'cmp') {
        const checks = page.locator('#cmpEngines .eng-check');
        const count = await checks.count();
        expect(count, 'Compare tab should build engine checkboxes').toBeGreaterThan(0);
      }
    }

    // 3. Open settings and switch settings tabs without errors
    const openSet = page.locator('#openSet');
    if (await openSet.isVisible()) {
      await mouseClick(page, openSet);
      await page.waitForTimeout(60);

      const setTabs = await page.locator('#setTabsNav [role="tab"]').all();
      for (const sTab of setTabs) {
        await mouseClick(page, sTab);
        await page.waitForTimeout(50);
      }

      const closeSet = page.locator('#closeSet');
      if (await closeSet.isVisible()) {
        await mouseClick(page, closeSet);
        await page.waitForTimeout(50);
      }
    }

    // 4. Assert zero page errors occurred across load, boot, and all tabs
    expect(pageErrors, `Expected zero page errors, but received:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('Document tab displays valid engine and mode info without reference errors', async ({ app }) => {
    const { page } = app;
    const pageErrors = [];

    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Switch to Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const docPicker = page.locator('#docEnginePickerHost .engine-picker');
    await expect(docPicker).toBeVisible();

    const pickerSelect = page.locator('#docEnginePickerHost .engine-picker-select');
    await expect(pickerSelect).toBeVisible();

    const engineText = page.locator('#docEngineText');
    await expect(engineText).not.toHaveText('');
    await expect(engineText).not.toContainText('??');

    expect(pageErrors).toEqual([]);
  });
});
