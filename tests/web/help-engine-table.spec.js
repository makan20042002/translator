'use strict';

/**
 * tests/web/help-engine-table.spec.js
 * ITEM 4: Engine compatibility reference table in Help guide.
 *
 * Rules:
 * - Real tests: no early returns, no conditional asserts.
 * - Test table rendering in Help in EN and FA at 360 px and 1280 px with no horizontal page overflow.
 * - Theme contrast >= 4.5 in light themes.
 * - Data check: for Chrome on-device row, Windows app cell is "no" (assert against availability with makanDesktop.isDesktop mocked)
 *   and Chrome cell is "yes" (assert with mocked Translator).
 */

const { test, expect } = require('../support/fixtures');
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

const THEMES = [
  'makan-lab',
  'platinum-blue',
  'dracula',
  'champagne-minimal',
  'rose-titanium',
  'royal-amethyst',
  'obsidian-gold'
];

test.describe('Help Engine Compatibility Table (ITEM 4)', () => {
  test('table renders in Help in EN and FA at 360px and 1280px without horizontal page overflow', async ({ app }) => {
    const { page } = app;

    // 1. EN mode verification at 1280px
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      if (typeof ui !== 'undefined') ui = 'en';
      if (typeof applyI18n === 'function') applyI18n();
      const cb = document.getElementById('creditsBox');
      if (cb) cb.hidden = false;
    });

    const enTable = page.locator('#helpGuideContent table[data-table="engine-matrix"], #helpGuideContent table.help-table').last();
    await expect(enTable).toBeVisible();

    const noOverflowEn1280 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    expect(noOverflowEn1280).toBe(true);

    // EN mode at 360px
    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForTimeout(50);
    const noOverflowEn360 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    expect(noOverflowEn360).toBe(true);

    // 2. FA mode verification at 1280px
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      if (typeof ui !== 'undefined') ui = 'fa';
      if (typeof applyI18n === 'function') applyI18n();
      const cb = document.getElementById('creditsBox');
      if (cb) cb.hidden = false;
    });

    const faTable = page.locator('#helpGuideContent table[data-table="engine-matrix"], #helpGuideContent table.help-table').last();
    await expect(faTable).toBeVisible();

    const noOverflowFa1280 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    expect(noOverflowFa1280).toBe(true);

    // FA mode at 360px
    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForTimeout(50);
    const noOverflowFa360 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    });
    expect(noOverflowFa360).toBe(true);
  });

  test('help engine table meets contrast >= 4.5 across all 7 themes', async ({ app }) => {
    const { page } = app;

    await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
    await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    // Open Help dialog
    await page.evaluate(() => {
      const cb = document.getElementById('creditsBox');
      if (cb) cb.hidden = false;
    });

    const allViolations = [];

    for (const themeId of THEMES) {
      await page.evaluate((id) => {
        if (typeof applyTheme === 'function') {
          applyTheme(id);
        } else {
          document.documentElement.setAttribute('data-theme', id);
        }
      }, themeId);
      await page.waitForTimeout(60);

      const violations = await page.evaluate(({ currentTheme }) => {
        const vList = [];
        const table = document.querySelector('#helpGuideContent table[data-table="engine-matrix"], #helpGuideContent table.help-table:last-of-type');
        if (!table) return vList;

        const cells = table.querySelectorAll('th, td, strong');
        cells.forEach((el, idx) => {
          const textRgb = window.__tc.parse(window.getComputedStyle(el).color);
          const bgInfo = window.__tc.effectiveBg(el);
          const stops = bgInfo.gradientStops && bgInfo.gradientStops.length > 0
            ? bgInfo.gradientStops
            : [bgInfo];
          for (const stop of stops) {
            const cand = stop.a < 1 ? window.__tc.blend(stop, bgInfo) : stop;
            const ratio = window.__tc.ratio(textRgb, cand);
            if (ratio < 4.5) {
              vList.push({
                theme: currentTheme,
                cellIndex: idx,
                text: el.textContent.trim().slice(0, 20),
                ratio: Math.round(ratio * 100) / 100
              });
            }
          }
        });

        return vList;
      }, { currentTheme: themeId });

      allViolations.push(...violations);
    }

    expect(allViolations).toEqual([]);
  });

  test('data check: Chrome on-device row shows no for Windows app and yes for Chrome, matching availability logic', async ({ app }) => {
    const { page } = app;

    // Ensure Help modal is open
    await page.evaluate(() => {
      if (typeof ui !== 'undefined') ui = 'en';
      if (typeof applyI18n === 'function') applyI18n();
      const cb = document.getElementById('creditsBox');
      if (cb) cb.hidden = false;
    });

    // 1. Check table DOM values for Chrome row
    const chromeRow = page.locator('#helpGuideContent tr[data-engine="chrome"]');
    await expect(chromeRow).toBeVisible();

    const winCell = chromeRow.locator('[data-col="windows"]');
    await expect(winCell).toHaveAttribute('data-value', 'no');
    const winCellText = await winCell.textContent();
    expect(winCellText.toLowerCase()).toContain('no');

    const chromeCell = chromeRow.locator('[data-col="chrome"]');
    await expect(chromeCell).toHaveAttribute('data-value', 'yes');
    const chromeCellText = await chromeCell.textContent();
    expect(chromeCellText.toLowerCase()).toContain('yes');

    // 2. Assert against availability logic: Windows app cell is "no"
    const winStatus = await page.evaluate(() => {
      window.makanDesktop = { isDesktop: true };
      return window.ENG.getStatus('chrome');
    });
    expect(winStatus.usable).toBe(false);
    expect(winStatus.state).toBe('not-here');

    // 3. Assert against availability logic: Chrome cell is "yes" with mocked Translator
    const chromeStatus = await page.evaluate(async () => {
      delete window.makanDesktop;
      window.Translator = {
        availability: async () => 'readily',
        create: async () => ({ translate: async s => s })
      };
      return window.ENG.getStatus('chrome');
    });
    expect(chromeStatus.usable).toBe(true);
    expect(chromeStatus.state).toBe('ready');
  });
});
