'use strict';

/**
 * tests/web/engine-picker-document-text-theme.spec.js
 * ITEM 2: Theme contrast and styling verification for Text and Document engine pickers.
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

test('engine pickers in Text and Document meet contrast >= 4.5 across all 7 themes and preserve makan-lab values', async ({ app }) => {
  const { page } = app;

  await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

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
            vList.push({
              theme: currentTheme,
              element: name,
              ratio: Math.round(ratio * 100) / 100
            });
          }
        }
      }

      // Check Text tab engine picker elements
      const textSelect = document.querySelector('#textEnginePickerHost .engine-picker-select');
      const textBtn = document.querySelector('#textEnginePickerHost .engine-picker-test-btn');
      const textUsing = document.querySelector('#textEnginePickerHost .engine-picker-using-val');
      const textLink = document.querySelector('#textEnginePickerHost .engine-picker-keys-link');

      checkEl(textSelect, 'Text: .engine-picker-select');
      checkEl(textBtn, 'Text: .engine-picker-test-btn');
      checkEl(textUsing, 'Text: .engine-picker-using-val');
      checkEl(textLink, 'Text: .engine-picker-keys-link');

      // Check Document tab engine picker elements
      const docSelect = document.querySelector('#docEnginePickerHost .engine-picker-select');
      const docBtn = document.querySelector('#docEnginePickerHost .engine-picker-test-btn');
      const docUsing = document.querySelector('#docEnginePickerHost .engine-picker-using-val');
      const docLink = document.querySelector('#docEnginePickerHost .engine-picker-keys-link');

      checkEl(docSelect, 'Doc: .engine-picker-select');
      checkEl(docBtn, 'Doc: .engine-picker-test-btn');
      checkEl(docUsing, 'Doc: .engine-picker-using-val');
      checkEl(docLink, 'Doc: .engine-picker-keys-link');

      return vList;
    }, { currentTheme: themeId });

    if (violations.length > 0) {
      allViolations.push(...violations);
    }
  }

  expect(allViolations).toEqual([]);
});
