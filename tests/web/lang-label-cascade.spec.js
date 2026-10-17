'use strict';

/**
 * ITEM 1: Language label cascade test across 7 themes
 * For Voice tab, Screen tab, and Text tab:
 * Asserts that the computed color of every label.lang-picker-lbl:
 * - for the six non-makan-lab themes: equals the computed color of var(--muted)
 *   read from getComputedStyle(document.documentElement).getPropertyValue('--muted') through a probe element.
 * - for makan-lab: equals today's computed cascade value ('rgb(132, 150, 176)' from .unified-lang-picker .lang-picker-lbl: var(--muted, #8ea3bf)).
 * Uses window.__tc from tests/support/color-helpers.js to parse colors.
 */

const { test, expect, mouseClick } = require('../support/fixtures');
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

const TABS = [
  { id: 'voice', btn: '#tabs button[data-tab="voice"]', root: '#tab-voice' },
  { id: 'screen', btn: '#tabs button[data-tab="screen"]', root: '#tab-screen' },
  { id: 'text', btn: '#tabs button[data-tab="text"]', root: '#tab-text' }
];

// Makan Lab computed value from current cascade:
// .unified-lang-picker .lang-picker-lbl sets var(--muted, #8ea3bf) where --muted is #8496B0 = rgb(132, 150, 176)
const MAKAN_LAB_EXPECTED_COLOR = 'rgb(132, 150, 176)';

test('every label.lang-picker-lbl in Voice, Screen and Text tabs computes to var(--muted) in non-makan-lab themes and preserves makan-lab', async ({ app }) => {
  const { page } = app;

  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  const allViolations = [];
  let totalLabelsTested = 0;

  for (const themeId of THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(50);

    for (const tab of TABS) {
      await mouseClick(page, page.locator(tab.btn));
      await page.waitForTimeout(50);

      const tabResult = await page.evaluate(({ currentTheme, rootSel, tabName, makanLabExpected }) => {
        const root = document.querySelector(rootSel);
        if (!root) return { violations: [], count: 0 };

        // Normalize expected color for this theme
        let expectedRgb;
        let expectedStr;

        if (currentTheme === 'makan-lab') {
          expectedStr = makanLabExpected;
          expectedRgb = window.__tc.parse(makanLabExpected);
        } else {
          // Read var(--muted) through a probe element to normalize browser formatting
          const mutedVal = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
          const probe = document.createElement('div');
          probe.style.color = mutedVal;
          document.body.appendChild(probe);
          expectedStr = getComputedStyle(probe).color;
          expectedRgb = window.__tc.parse(expectedStr);
          probe.remove();
        }

        const labels = Array.from(root.querySelectorAll('label.lang-picker-lbl'));
        const violations = [];

        for (const lbl of labels) {
          const actualStr = getComputedStyle(lbl).color;
          const actualRgb = window.__tc.parse(actualStr);

          const matches = actualRgb && expectedRgb &&
            actualRgb.r === expectedRgb.r &&
            actualRgb.g === expectedRgb.g &&
            actualRgb.b === expectedRgb.b;

          if (!matches) {
            violations.push({
              theme: currentTheme,
              tab: tabName,
              text: (lbl.textContent || '').trim().slice(0, 30),
              actualColor: actualStr,
              expectedColor: expectedStr
            });
          }
        }

        return {
          violations,
          count: labels.length
        };
      }, {
        currentTheme: themeId,
        rootSel: tab.root,
        tabName: tab.id,
        makanLabExpected: MAKAN_LAB_EXPECTED_COLOR
      });

      totalLabelsTested += tabResult.count;
      allViolations.push(...tabResult.violations);
    }
  }

  // Ensure all tabs and themes actually had labels to test
  expect(totalLabelsTested).toBeGreaterThanOrEqual(42);
  expect(allViolations).toEqual([]);
});
