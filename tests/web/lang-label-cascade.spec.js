'use strict';

/**
 * ITEM 1: Language label cascade test across 7 themes
 * For Voice tab, Screen tab, and Text tab:
 * Asserts that the computed color of every label.lang-picker-lbl:
 * - for the six non-makan-lab themes: equals the computed color of var(--muted)
 *   read directly from the label via getComputedStyle(lbl).getPropertyValue('--muted')
 *   and normalized through a probe element appended to lbl.parentElement.
 *   Also asserts that the normalized --muted seen by the labels in platinum-blue equals rgb(69, 93, 119)
 *   and in champagne-minimal equals rgb(101, 84, 63).
 * - for makan-lab:
 *   - Text tab: rgb(80, 100, 130) from .trans-bar label:not(.switch-lbl) setting var(--faint) = #506482
 *   - Voice & Screen tabs: rgb(132, 150, 176) from .unified-lang-picker .lang-picker-lbl setting var(--muted) = #8496B0
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

// Makan Lab expected colors verified against git show bbc74b4:css/theme.css and js/themes.js:
// 1. Text tab: .trans-bar label:not(.switch-lbl) sets color: var(--faint, #64748b).
//    In makan-lab, js/themes.js defines Faint as #506482 = rgb(80, 100, 130).
// 2. Voice & Screen tabs: .unified-lang-picker .lang-picker-lbl sets color: var(--muted, #8ea3bf).
//    In makan-lab, js/themes.js defines Muted as #8496B0 = rgb(132, 150, 176).
const MAKAN_LAB_TEXT_EXPECTED = 'rgb(80, 100, 130)';
const MAKAN_LAB_VOICE_SCREEN_EXPECTED = 'rgb(132, 150, 176)';

test('every label.lang-picker-lbl in Voice, Screen and Text tabs computes to var(--muted) in non-makan-lab themes and preserves makan-lab', async ({ app }) => {
  const { page } = app;

  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  const allViolations = [];
  let totalLabelsTested = 0;
  const seenMutedByTheme = {};

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

      const tabResult = await page.evaluate(({ currentTheme, rootSel, tabName, textExpected, voiceScreenExpected }) => {
        const root = document.querySelector(rootSel);
        if (!root) return { violations: [], count: 0, normalizedMuted: '' };

        const labels = Array.from(root.querySelectorAll('label.lang-picker-lbl'));
        const violations = [];
        let firstNormalizedMuted = '';

        for (const lbl of labels) {
          let expectedStr;
          let expectedRgb;

          if (currentTheme === 'makan-lab') {
            expectedStr = (tabName === 'text') ? textExpected : voiceScreenExpected;
            expectedRgb = window.__tc.parse(expectedStr);
          } else {
            // Read custom property --muted from the label itself (inherits from body/.app-shell)
            const mutedVal = getComputedStyle(lbl).getPropertyValue('--muted').trim();
            const probe = document.createElement('div');
            probe.style.color = mutedVal;
            lbl.parentElement.appendChild(probe);
            expectedStr = getComputedStyle(probe).color;
            expectedRgb = window.__tc.parse(expectedStr);
            probe.remove();

            if (!firstNormalizedMuted) {
              firstNormalizedMuted = expectedStr;
            }

            // Verify light theme overrides match expected tokens
            if (currentTheme === 'platinum-blue' && expectedStr !== 'rgb(69, 93, 119)') {
              violations.push({
                theme: currentTheme,
                tab: tabName,
                text: (lbl.textContent || '').trim().slice(0, 30),
                issue: `platinum-blue --muted override must equal rgb(69, 93, 119), received ${expectedStr}`
              });
            } else if (currentTheme === 'champagne-minimal' && expectedStr !== 'rgb(101, 84, 63)') {
              violations.push({
                theme: currentTheme,
                tab: tabName,
                text: (lbl.textContent || '').trim().slice(0, 30),
                issue: `champagne-minimal --muted override must equal rgb(101, 84, 63), received ${expectedStr}`
              });
            }
          }

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
          count: labels.length,
          normalizedMuted: firstNormalizedMuted
        };
      }, {
        currentTheme: themeId,
        rootSel: tab.root,
        tabName: tab.id,
        textExpected: MAKAN_LAB_TEXT_EXPECTED,
        voiceScreenExpected: MAKAN_LAB_VOICE_SCREEN_EXPECTED
      });

      if (tabResult.normalizedMuted && !seenMutedByTheme[themeId]) {
        seenMutedByTheme[themeId] = tabResult.normalizedMuted;
      }

      totalLabelsTested += tabResult.count;
      allViolations.push(...tabResult.violations);
    }
  }

  // Ensure all tabs and themes actually had labels to test (7 themes * 3 tabs * at least 2 labels = >= 42)
  expect(totalLabelsTested).toBeGreaterThanOrEqual(42);
  expect(allViolations).toEqual([]);

  // Explicitly assert that the normalized --muted seen by labels equals expected override colors
  expect(seenMutedByTheme['platinum-blue']).toBe('rgb(69, 93, 119)');
  expect(seenMutedByTheme['champagne-minimal']).toBe('rgb(101, 84, 63)');
});
