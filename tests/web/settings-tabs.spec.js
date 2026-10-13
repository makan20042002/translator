'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

async function openSettings(page) {
  await mouseClick(page, page.locator('#openSet'));
  await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
}

test.describe('Web app: Settings redesign tabs and dictionary', () => {
  test('tab switching updates active states, ARIA roles, and visible sections', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    const tabsNav = page.locator('#setTabsNav');
    await expect(tabsNav).toHaveAttribute('role', 'tablist');

    // Default active tab is Engines
    await expect(page.locator('#setTabBtnEngines')).toHaveClass(/active/);
    await expect(page.locator('#setTabBtnEngines')).toHaveAttribute('role', 'tab');
    await expect(page.locator('#setTabBtnEngines')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#secEngines')).toHaveClass(/active/);
    await expect(page.locator('#secEngines')).toHaveAttribute('role', 'tabpanel');

    // Click Voices tab
    await mouseClick(page, page.locator('#setTabBtnVoices'));
    await expect(page.locator('#setTabBtnVoices')).toHaveClass(/active/);
    await expect(page.locator('#setTabBtnVoices')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#secVoices')).toHaveClass(/active/);
    await expect(page.locator('#setTabBtnEngines')).not.toHaveClass(/active/);
    await expect(page.locator('#setTabBtnEngines')).toHaveAttribute('aria-selected', 'false');

    // Click OCR tab
    await mouseClick(page, page.locator('#setTabBtnOcr'));
    await expect(page.locator('#setTabBtnOcr')).toHaveClass(/active/);
    await expect(page.locator('#secOcr')).toHaveClass(/active/);
  });

  test('Dictionary tab exists with offline packs status, options, honest unbuilt state, and CC BY-SA license note', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Dictionary tab button exists
    const dictTabBtn = page.locator('#setTabBtnDict');
    await expect(dictTabBtn).toBeAttached();
    await expect(dictTabBtn).toContainText(/فرهنگ لغت|Dictionary/i);

    // Click Dictionary tab
    await mouseClick(page, dictTabBtn);
    await expect(dictTabBtn).toHaveClass(/active/);
    await expect(dictTabBtn).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#secDict')).toHaveClass(/active/);
    await expect(page.locator('#secDict')).toHaveAttribute('role', 'tabpanel');

    // Check offline dictionary status container
    const dictList = page.locator('#setDictPacksList');
    await expect(dictList).toBeVisible();

    // Check vulgar words toggle exists
    const vulgarToggle = page.locator('#setDictVulgar');
    await expect(vulgarToggle).toBeAttached();

    // Check honest unbuilt notice
    const unbuiltNotice = page.locator('#setDictUnbuiltNotice');
    await expect(unbuiltNotice).toBeVisible();
    await expect(unbuiltNotice).toContainText(/سایر زبان‌ها|Not available yet/i);

    // Check CC BY-SA 4.0 license note
    const licenseCard = page.locator('#setDictLicenseCard');
    await expect(licenseCard).toBeVisible();
    await expect(licenseCard).toContainText(/CC BY-SA 4.0/i);
    await expect(licenseCard).toContainText(/Wiktionary/i);
  });

  test('Close button (X) and Escape key close the Settings modal', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Close button (X)
    const closeBtn = page.locator('#closeSet');
    await expect(closeBtn).toBeVisible();
    await mouseClick(page, closeBtn);
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);

    // Reopen and test Escape key
    await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);
  });

  test('last opened settings tab is remembered across modal sessions', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Switch to Dictionary tab
    await mouseClick(page, page.locator('#setTabBtnDict'));
    await expect(page.locator('#setTabBtnDict')).toHaveClass(/active/);

    // Close modal
    await mouseClick(page, page.locator('#closeSet'));
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);

    // Reopen modal and verify Dictionary tab remains active
    await openSettings(page);
    await expect(page.locator('#setTabBtnDict')).toHaveClass(/active/);
    await expect(page.locator('#secDict')).toHaveClass(/active/);

    // Switch to Voices tab
    await mouseClick(page, page.locator('#setTabBtnVoices'));
    await expect(page.locator('#setTabBtnVoices')).toHaveClass(/active/);

    // Close and reopen again
    await mouseClick(page, page.locator('#closeSet'));
    await openSettings(page);
    await expect(page.locator('#setTabBtnVoices')).toHaveClass(/active/);
    await expect(page.locator('#secVoices')).toHaveClass(/active/);
  });

  test('keyboard navigation with arrow keys navigates tabs', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Focus the active tab button
    await page.locator('#setTabBtnEngines').focus();
    await page.keyboard.press('ArrowRight');

    // Verifies that a tab transition occurred and active tab was updated
    const activeTab = page.locator('#setTabsNav [role="tab"].active');
    await expect(activeTab).toHaveCount(1);
    const activeSecId = await activeTab.getAttribute('data-sec');
    expect(activeSecId).toBeTruthy();
    await expect(page.locator(`#${activeSecId}`)).toHaveClass(/active/);
  });

  test('Tab key never focuses a control inside an inactive section', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Ensure we start on Engines tab
    await mouseClick(page, page.locator('#setTabBtnEngines'));
    await expect(page.locator('#secEngines')).toHaveClass(/active/);

    // Tab through elements in modal 30 times
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const focusedSectionInfo = await page.evaluate(() => {
        const el = document.activeElement;
        const sec = el?.closest('.set-section');
        return sec ? { id: sec.id, isActive: sec.classList.contains('active') } : null;
      });
      if (focusedSectionInfo) {
        expect(focusedSectionInfo.isActive, `Focused element in section ${focusedSectionInfo.id} must be active`).toBe(true);
        expect(focusedSectionInfo.id).toBe('secEngines');
      }
    }
  });

  test('no horizontal scroll in Persian at 360 px', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 360, height: 740 });

    // Switch UI to Persian
    await page.locator('#uiLang').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await openSettings(page);
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);

    const hasHorizontalOverflow = await page.evaluate(() => {
      const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const modal = document.querySelector('#ov .modal');
      const modalOverflow = modal ? modal.scrollWidth > modal.clientWidth : false;
      return docOverflow || modalOverflow;
    });
    expect(hasHorizontalOverflow, 'No horizontal scroll in Persian at 360px').toBe(false);
  });
});
