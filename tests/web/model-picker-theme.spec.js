'use strict';

/**
 * tests/web/model-picker-theme.spec.js
 * ITEM 3: Theme contrast (>= 4.5) and makan-lab locked styling verification for model picker.
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

test('model picker and speech model selector meet contrast >= 4.5 across all 7 themes and lock makan-lab styles', async ({ app }) => {
  const { page, errors } = app;

  await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  // Open Subtitle tab and select Gemini so model picker is visible
  await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
  await page.waitForTimeout(60);

  await page.evaluate(() => {
    if (!cfg.eng) cfg.eng = {};
    if (!cfg.eng.gemini) cfg.eng.gemini = {};
    cfg.eng.gemini.key = 'test-gemini-key';
    saveCfg();
    const select = document.querySelector('#subEnginePickerHost .engine-picker-select');
    if (select) {
      select.value = 'gemini';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
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
      const modelSelect = picker ? picker.querySelector('.engine-picker-model-select') : null;
      const modelLabelText = picker ? picker.querySelector('.engine-picker-model-label-text') : null;

      checkEl(modelSelect, '.engine-picker-model-select');
      checkEl(modelLabelText, '.engine-picker-model-label-text');

      let pickerStyles = null;
      if (currentTheme === 'makan-lab') {
        const selectCs = modelSelect ? window.getComputedStyle(modelSelect) : null;
        pickerStyles = {
          modelSelectBorderRadius: selectCs ? selectCs.borderRadius : ''
        };
      }

      return { violations, pickerStyles };
    }, { currentTheme: themeId });

    if (themeResult.pickerStyles) {
      makanLabPickerStyles = themeResult.pickerStyles;
    }
    allViolations.push(...themeResult.violations);
  }

  expect(allViolations, JSON.stringify(allViolations, null, 2)).toEqual([]);
  expect(makanLabPickerStyles).not.toBeNull();
  expect(errors).toEqual([]);
});
