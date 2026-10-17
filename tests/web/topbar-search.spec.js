'use strict';

/**
 * Item 4: Search pill in the top bar
 * Verifies that at 1280x900 in EN and FA (RTL):
 * - The magnifier icon bounding box and the input text area do not intersect.
 * - Header height equals its CSS computed numeric height (68px).
 * - Input height is preserved at 38px.
 */

const { test, expect } = require('../support/fixtures');

test('search icon and text box do not intersect in EN and FA, header height is preserved', async ({ app }) => {
  const { page } = app;

  await page.setViewportSize({ width: 1280, height: 900 });

  for (const lang of ['en', 'fa']) {
    await page.evaluate((l) => {
      document.documentElement.lang = l;
      document.documentElement.dir = (l === 'fa' ? 'rtl' : 'ltr');
      if (typeof setUILanguage === 'function') setUILanguage(l);
    }, lang);
    await page.waitForTimeout(60);

    const metrics = await page.evaluate(() => {
      const icon = document.querySelector('.topbar-search-icon');
      const input = document.getElementById('topbarSearch');
      const header = document.getElementById('topbar');

      const iconRect = icon.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const inputStyle = window.getComputedStyle(input);

      const padLeft = parseFloat(inputStyle.paddingLeft);
      const padRight = parseFloat(inputStyle.paddingRight);

      // Text box within the input
      const textBox = {
        left: inputRect.left + padLeft,
        right: inputRect.right - padRight,
        top: inputRect.top,
        bottom: inputRect.bottom
      };

      const horizontalOverlap = Math.max(0, Math.min(iconRect.right, textBox.right) - Math.max(iconRect.left, textBox.left));
      const verticalOverlap = Math.max(0, Math.min(iconRect.bottom, textBox.bottom) - Math.max(iconRect.top, textBox.top));

      return {
        hasIntersection: horizontalOverlap > 0 && verticalOverlap > 0,
        horizontalOverlap,
        headerHeight: Math.round(headerRect.height),
        inputHeight: Math.round(parseFloat(inputStyle.height)),
        padInlineStart: parseFloat(inputStyle.paddingInlineStart)
      };
    });

    expect(metrics.hasIntersection).toBe(false);
    expect(metrics.horizontalOverlap).toBe(0);
    expect(metrics.padInlineStart).toBeGreaterThanOrEqual(36);
    expect(metrics.inputHeight).toBe(38);
    expect(metrics.headerHeight).toBe(68);
  }
});
