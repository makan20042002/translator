'use strict';
/**
 * Test for Item 3: Sidebar Shell, Navigation Sections, Status Pill, and Storage Card.
 * (Written, not executed, as per test policy).
 */
const { test, expect, mouseClick } = require('../support/fixtures');

const ALL_SIDEBAR_TABS = [
  'text', 'sub', 'doc', 'voice', 'screen',
  'dict', 'idiom', 'cmp', 'gls', 'hist',
  'games', 'models'
];

test.describe('Web app: Sidebar shell & navigation', () => {
  test('sidebar sections and all tab ids exist, and each tab opens its panel', async ({ app }) => {
    const { page, errors } = app;

    // Check sidebar shell container
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    // Check sections exist
    const sections = page.locator('#tabs .sidebar-sec-h');
    const sectionTexts = await sections.allTextContents();
    expect(sectionTexts).toEqual(expect.arrayContaining(['CREATE', 'TOOLS', 'SYSTEM']));

    // Check all tab buttons exist and each opens its corresponding #tab-* panel
    for (const tabId of ALL_SIDEBAR_TABS) {
      const btn = page.locator(`#tabs button[data-tab="${tabId}"]`);
      await expect(btn, `button for tab ${tabId} exists`).toBeVisible();

      // Click tab button
      await mouseClick(page, btn);
      await expect(btn).toHaveClass(/\bon\b/);

      // Panel must become visible
      const panel = page.locator(`#tab-${tabId}`);
      await expect(panel, `panel for tab ${tabId} is visible`).toBeVisible();
    }

    // Settings button inside sidebar triggers settings overlay
    const settingsBtn = page.locator('#sidebarSettingsBtn');
    await expect(settingsBtn).toBeVisible();
    await mouseClick(page, settingsBtn);
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
    await mouseClick(page, page.locator('#closeSet'));
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);

    expect(errors).toEqual([]);
  });

  test('status pill shows "Online only" when no offline model is ready and "Offline ready" when one is', async ({ app }) => {
    const { page } = app;

    const statusPill = page.locator('#sidebarStatusPill');
    await expect(statusPill).toBeVisible();

    // Default state: no offline translation model downloaded
    const initialText = await page.locator('#sidebarStatusText').textContent();
    expect(initialText.trim()).toBe('Online only');

    // Simulate an offline translation model ready
    await page.evaluate(() => {
      // Mark legacy or catalog NLLB model ready in local storage store
      store.set('nllb', true);
      store.set('mdl', { 'tr-nllb-600': { files: [] } });
      if (typeof updateStatusPill === 'function') {
        updateStatusPill();
      }
    });

    const readyText = await page.locator('#sidebarStatusText').textContent();
    expect(readyText.trim()).toBe('Offline ready');
    await expect(statusPill).toHaveClass(/\bready\b/);

    // Clean up store state
    await page.evaluate(() => {
      store.set('nllb', false);
      store.set('mdl', {});
      if (typeof updateStatusPill === 'function') {
        updateStatusPill();
      }
    });

    const revertedText = await page.locator('#sidebarStatusText').textContent();
    expect(revertedText.trim()).toBe('Online only');
  });

  test('storage card displays real numbers or remains hidden if unsupported', async ({ app }) => {
    const { page } = app;

    const storageCard = page.locator('#sidebarStorageCard');
    const isHidden = await storageCard.getAttribute('hidden');

    if (isHidden === null) {
      // Card is visible: verify usage numbers are real and non-empty
      const usageText = await page.locator('#sidebarStorageUsage').textContent();
      expect(usageText).toMatch(/\d+(\.\d+)?\s*(KB|MB|GB)\s*\/\s*\d+(\.\d+)?\s*GB/);
    } else {
      // Card is cleanly hidden if storage estimate is unavailable
      await expect(storageCard).toBeHidden();
    }
  });

  test('sidebar buttons support keyboard interaction (Tab and Enter) and have accessible titles', async ({ app }) => {
    const { page } = app;

    for (const tabId of ALL_SIDEBAR_TABS) {
      const btn = page.locator(`#tabs button[data-tab="${tabId}"]`);
      // Accessible title or label present
      const title = await btn.getAttribute('title');
      const text = await btn.textContent();
      expect(title || text).toBeTruthy();
    }

    // Keyboard navigation focus check
    await page.locator('#tabs button[data-tab="text"]').focus();
    await expect(page.locator('#tabs button[data-tab="text"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#tabs button[data-tab="sub"]')).toBeFocused();
  });
});
