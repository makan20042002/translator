'use strict';

/**
 * Item 3: Media tab theme contrast, makan-lab values, and RTL layout verification
 * Across all 7 themes:
 * - Checks contrast >= 4.5 for visible text and controls in platinum-blue and champagne-minimal.
 * - Asserts locked computed styles for makan-lab default theme.
 * - Checks RTL (Persian) layout has no horizontal overflow at 360 px and 1280 px width.
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

test('Media tab controls and text reach >= 4.5 contrast in light themes, preserve makan-lab values, and do not overflow in RTL', async ({ app }) => {
  const { page } = app;

  // 1. Open Media tab
  const mediaBtn = page.locator('#tabs button[data-tab="media"]');
  await expect(mediaBtn).toBeVisible();
  await mouseClick(page, mediaBtn);
  await page.waitForTimeout(60);

  // Inject shared color helpers
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  // Drop a tiny WAV file so all file cards and controls become visible and measurable
  await page.evaluate(async () => {
    function makeWavBytes(durationSec = 0.1, sampleRate = 8000) {
      const numSamples = Math.floor(durationSec * sampleRate);
      const dataSize = numSamples * 2;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      function writeStr(offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);
      return new Uint8Array(buffer);
    }
    const dropZone = document.querySelector('.mt-drop');
    if (dropZone) {
      const bytes = makeWavBytes(0.1, 8000);
      const file = new File([bytes], 'test-audio.wav', { type: 'audio/wav' });
      const dt = new DataTransfer();
      dt.items.add(file);
      dropZone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(100);

  let makanLabDropBg = '';
  let makanLabCardBg = '';
  let makanLabBtnBg = '';
  let makanLabBtnColor = '';
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

    const metrics = await page.evaluate(({ currentTheme }) => {
      const violations = [];

      function checkEl(el, name, required = 4.5) {
        if (!el) return;
        const text = (el.textContent || '').trim();
        if (!text) return;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return;

        const textRgb = window.__tc.parse(cs.color);
        const eff = window.__tc.effectiveBg(el);
        const stops = (eff.gradientStops && eff.gradientStops.length > 0) ? eff.gradientStops : [eff.bg];

        for (const stop of stops) {
          const effectiveStop = stop.a < 1 ? window.__tc.blend(stop, eff.bg) : stop;
          const ratio = window.__tc.ratio(textRgb, effectiveStop);
          if (ratio < required) {
            violations.push({
              theme: currentTheme,
              selector: name || (el.className ? '.' + el.className.split(/\s+/).join('.') : el.tagName.toLowerCase()),
              text: text.slice(0, 30),
              color: cs.color,
              bg: `rgb(${effectiveStop.r},${effectiveStop.g},${effectiveStop.b})`,
              contrast: Math.round(ratio * 100) / 100,
              required
            });
          }
        }
      }

      const dropEl = document.querySelector('.mt-drop');
      const cardEl = document.querySelector('.mt-card');
      const btnEl = document.querySelector('.mt-btn:not(.mt-btn-quiet)');

      // Check contrast for light themes (platinum-blue and champagne-minimal)
      if (currentTheme === 'platinum-blue' || currentTheme === 'champagne-minimal') {
        // Page header
        checkEl(document.querySelector('.media-page-title'), '.media-page-title');
        checkEl(document.querySelector('.media-page-sub'), '.media-page-sub');

        // Drop zone elements
        checkEl(document.querySelector('.mt-drop-title'), '.mt-drop-title');
        checkEl(document.querySelector('.mt-drop-or'), '.mt-drop-or');
        checkEl(document.querySelector('.mt-drop-formats'), '.mt-drop-formats');

        // Card titles and text
        document.querySelectorAll('.mt-card-title').forEach((el, i) => checkEl(el, `.mt-card-title[${i}]`));
        document.querySelectorAll('.mt-card-text').forEach((el, i) => checkEl(el, `.mt-card-text[${i}]`));

        // Labels
        document.querySelectorAll('.mt-info-label').forEach((el, i) => checkEl(el, `.mt-info-label[${i}]`));
        document.querySelectorAll('.mt-info-value').forEach((el, i) => checkEl(el, `.mt-info-value[${i}]`));
        document.querySelectorAll('.mt-asr-label').forEach((el, i) => checkEl(el, `.mt-asr-label[${i}]`));
        document.querySelectorAll('.mt-tr-label').forEach((el, i) => checkEl(el, `.mt-tr-label[${i}]`));
        document.querySelectorAll('.mt-pv-label').forEach((el, i) => checkEl(el, `.mt-pv-label[${i}]`));

        // Buttons
        document.querySelectorAll('.mt-btn').forEach((el, i) => {
          checkEl(el, `.mt-btn[${i}]`);
        });

        // Selects
        document.querySelectorAll('.mt-asr-lang, .mt-tr-src, .mt-tr-tgt, .mt-pv-show').forEach((el, i) => {
          checkEl(el, `select[${i}]`);
        });
      }

      return {
        dropBg: dropEl ? getComputedStyle(dropEl).backgroundColor : '',
        cardBg: cardEl ? getComputedStyle(cardEl).backgroundColor : '',
        btnBg: btnEl ? getComputedStyle(btnEl).backgroundColor : '',
        btnColor: btnEl ? getComputedStyle(btnEl).color : '',
        violations
      };
    }, { currentTheme: themeId });

    if (themeId === 'makan-lab') {
      makanLabDropBg = metrics.dropBg;
      makanLabCardBg = metrics.cardBg;
      makanLabBtnBg = metrics.btnBg;
      makanLabBtnColor = metrics.btnColor;
    }

    allViolations.push(...metrics.violations);
  }

  expect(allViolations).toEqual([]);

  // Assert computed styles in makan-lab preserve locked design tokens
  // Makan Lab: --panel is #071022 = rgb(7, 16, 34); --accent is #08A8FF = rgb(8, 168, 255); --on-accent is #040914 = rgb(4, 9, 20)
  expect(makanLabDropBg).toBe('rgb(7, 16, 34)');
  expect(makanLabCardBg).toBe('rgb(7, 16, 34)');
  expect(makanLabBtnBg).toBe('rgb(8, 168, 255)');
  expect(makanLabBtnColor).toBe('rgb(4, 9, 20)');

  // 2. RTL (Persian) responsiveness test: verify no horizontal overflow at 360 px and 1280 px width
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 740 });
    await page.evaluate(() => {
      document.documentElement.lang = 'fa';
      document.documentElement.dir = 'rtl';
      if (typeof setUILanguage === 'function') setUILanguage('fa');
      if (typeof applyI18n === 'function') applyI18n();
    });
    await page.waitForTimeout(60);

    const overflow = await page.evaluate(() => {
      const tab = document.getElementById('tab-media');
      const root = document.querySelector('.mt-root') || tab;
      return {
        tabScrollWidth: tab.scrollWidth,
        tabClientWidth: tab.clientWidth,
        tabHasOverflow: tab.scrollWidth > tab.clientWidth + 1,
        rootScrollWidth: root.scrollWidth,
        rootClientWidth: root.clientWidth,
        rootHasOverflow: root.scrollWidth > root.clientWidth + 1
      };
    });

    expect(overflow.tabHasOverflow, `tab-media has horizontal overflow at ${width}px in RTL`).toBe(false);
    expect(overflow.rootHasOverflow, `.mt-root has horizontal overflow at ${width}px in RTL`).toBe(false);
  }
});
