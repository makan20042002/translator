'use strict';
/**
 * Shared test helper: collects page errors and console errors during page load
 * plus a switch through every main tab and Settings modal.
 */

async function recordErrorsAcrossAllTabs(page, options = {}) {
  const pageErrors = [];
  const consoleErrors = [];

  const onPageError = err => {
    pageErrors.push(err.message || String(err));
  };
  const onConsole = msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore network aborts from offline/stub tests
      if (!/^Failed to load resource: /i.test(text)) {
        consoleErrors.push(text);
      }
    }
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  // Reload page to observe clean boot
  if (options.reload !== false) {
    await page.reload();
    await page.waitForTimeout(300);
  }

  // Collect all tab buttons
  const tabButtons = await page.locator('#tabs button[data-tab]').all();
  for (const btn of tabButtons) {
    const tabName = await btn.getAttribute('data-tab');
    await btn.click();
    await page.waitForTimeout(60);
  }

  // Open settings and switch through settings tabs
  const openSet = page.locator('#openSet');
  if (await openSet.isVisible()) {
    await openSet.click();
    await page.waitForTimeout(60);

    const setTabs = await page.locator('#setTabsNav [role="tab"]').all();
    for (const sTab of setTabs) {
      await sTab.click();
      await page.waitForTimeout(50);
    }

    const closeSet = page.locator('#closeSet');
    if (await closeSet.isVisible()) {
      await closeSet.click();
      await page.waitForTimeout(50);
    }
  }

  // Cleanup listeners
  page.off('pageerror', onPageError);
  page.off('console', onConsole);

  return {
    pageErrors,
    consoleErrors,
    allErrors: [...pageErrors, ...consoleErrors]
  };
}

module.exports = { recordErrorsAcrossAllTabs };
