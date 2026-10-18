'use strict';

/**
 * tests/web/engine-picker-theme.spec.js
 * ITEM 2: Theme contrast and makan-lab styling verification for engine picker.
 */

const { test, expect, mouseClick, chooseFile } = require('../support/fixtures');
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

test('engine picker elements meet contrast >= 4.5 across all 7 themes and preserve makan-lab values', async ({ app, files }) => {
  const { page } = app;

  await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  // Open Subtitle tab and load file so subtitle card and picker are visible
  await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
  await chooseFile(page, page.locator('#sDrop'), files.srt);
  await page.waitForTimeout(60);

  let makanLabPickerStyles = null;
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

    const themeResult = await page.evaluate(({ currentTheme }) => {
      const violations = [];

      function checkEl(el, name) {
        if (!el) return;
        const textRgb = window.__tc.parse(window.getComputedStyle(el).color);
        const bgInfo = window.__tc.effectiveBg(el);
        const stops = bgInfo.gradientStops && bgInfo.gradientStops.length > 0
          ? bgInfo.gradientStops
          : [bgInfo];
        for (const stop of stops) {
          const cand = stop.a < 1 ? window.__tc.blend(stop, bgInfo) : stop;
          const ratio = window.__tc.ratio(textRgb, cand);
          if (ratio < 4.5) {
            violations.push({
              theme: currentTheme,
              selector: name,
              text: el.textContent.trim().slice(0, 30),
              color: window.getComputedStyle(el).color,
              bg: `rgb(${cand.r},${cand.g},${cand.b})`,
              contrast: Math.round(ratio * 100) / 100
            });
          }
        }
      }

      const picker = document.querySelector('#subEnginePickerHost .engine-picker');
      const select = picker ? picker.querySelector('.engine-picker-select') : null;
      const testBtn = picker ? picker.querySelector('.engine-picker-test-btn') : null;
      const usingVal = picker ? picker.querySelector('.engine-picker-using-val') : null;
      const keysLink = picker ? picker.querySelector('.engine-picker-keys-link') : null;

      checkEl(select, '.engine-picker-select');
      checkEl(testBtn, '.engine-picker-test-btn');
      checkEl(usingVal, '.engine-picker-using-val');
      checkEl(keysLink, '.engine-picker-keys-link');

      let pickerStyles = null;
      if (currentTheme === 'makan-lab') {
        const selectCs = select ? window.getComputedStyle(select) : null;
        const testBtnCs = testBtn ? window.getComputedStyle(testBtn) : null;
        pickerStyles = {
          selectBorderRadius: selectCs ? selectCs.borderRadius : '',
          btnBorderRadius: testBtnCs ? testBtnCs.borderRadius : ''
        };
      }

      return { violations, pickerStyles };
    }, { currentTheme: themeId });

    if (themeResult.pickerStyles) {
      makanLabPickerStyles = themeResult.pickerStyles;
    }
    allViolations.push(...themeResult.violations);
  }

  expect(allViolations).toEqual([]);
  expect(makanLabPickerStyles).toBeTruthy();
  expect(makanLabPickerStyles.selectBorderRadius).toBeTruthy();
  expect(makanLabPickerStyles.btnBorderRadius).toBeTruthy();
});
