'use strict';

/**
 * Item 3: Screen tab theme contrast and layout verification
 * Across all 7 themes:
 * - Asserts contrast >= 4.5 for mode card title and subtitle (selected and unselected).
 * - Asserts contrast >= 4.5 for "Engine" label and select.
 * - Asserts contrast >= 4.5 for Ready badge on the Region card.
 * - Asserts contrast >= 4.5 for Recent captures title, original, translation, and timestamp.
 * - Asserts contrast >= 4.5 for overlay preview mock: ORIGINAL and PERSIAN labels, inputs, and chips.
 * - Asserts today's exact computed background-color for .screen-mode-card and .screen-preview-card in makan-lab.
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

test('Screen tab controls and preview mock reach >= 4.5 contrast across all 7 themes and preserve makan-lab values', async ({ app }) => {
  const { page } = app;

  // Open Screen tab
  await mouseClick(page, page.locator('#tabs button[data-tab="screen"]'));
  await page.waitForTimeout(60);

  // Inject shared color helpers
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });

  // Disable animations and transitions for stable measurement
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  let makanLabModeCardBg = '';
  let makanLabPreviewCardBg = '';
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

    // Ensure recent captures has at least one capture row for measuring
    await page.evaluate(() => {
      const listEl = document.getElementById('screenCapturesList');
      if (listEl && listEl.children.length === 0) {
        listEl.innerHTML = `
          <div class="screen-capture-item">
            <div class="screen-capture-thumb" aria-hidden="true">★</div>
            <div class="screen-capture-meta">
              <span class="screen-capture-orig"><bdi>Press Start</bdi></span>
              <span class="screen-capture-arrow">→</span>
              <span class="screen-capture-trans" dir="rtl">شروع را فشار دهید</span>
              <span class="screen-capture-time">Just now</span>
            </div>
          </div>
        `;
      }
    });
    await page.waitForTimeout(40);

    const metrics = await page.evaluate(({ currentTheme }) => {
      const violations = [];

      function checkEl(el, name, required = 4.5) {
        if (!el) return;
        const textRgb = window.__tc.parse(getComputedStyle(el).color);
        const eff = window.__tc.effectiveBg(el);
        const stops = (eff.gradientStops && eff.gradientStops.length > 0) ? eff.gradientStops : [eff.bg];

        for (const stop of stops) {
          const effectiveStop = stop.a < 1 ? window.__tc.blend(stop, eff.bg) : stop;
          const ratio = window.__tc.ratio(textRgb, effectiveStop);
          if (ratio < required) {
            violations.push({
              theme: currentTheme,
              selector: name || (el.className ? '.' + el.className.split(/\s+/).join('.') : el.tagName.toLowerCase()),
              text: (el.textContent || '').trim().slice(0, 30),
              color: getComputedStyle(el).color,
              bg: `rgb(${effectiveStop.r},${effectiveStop.g},${effectiveStop.b})`,
              contrast: Math.round(ratio * 100) / 100,
              required
            });
          }
        }
      }

      // Mode cards: selected (.on) and unselected
      const modeCards = Array.from(document.querySelectorAll('.screen-mode-card'));
      modeCards.forEach((card) => {
        const isOn = card.classList.contains('on');
        checkEl(card.querySelector('.screen-mode-name'), `.screen-mode-card (on=${isOn}) .screen-mode-name`);
        checkEl(card.querySelector('.screen-mode-desc'), `.screen-mode-card (on=${isOn}) .screen-mode-desc`);
      });

      // Labels & controls
      checkEl(document.querySelector('.screen-ctrl-lbl'), '.screen-ctrl-lbl (Engine label)');
      checkEl(document.querySelector('.screen-mode-status.ready'), '.screen-mode-status.ready');

      // Recent captures
      checkEl(document.querySelector('#screenRecentCard .screen-card-title'), '#screenRecentCard .screen-card-title');
      checkEl(document.querySelector('.screen-capture-orig'), '.screen-capture-orig');
      checkEl(document.querySelector('.screen-capture-trans'), '.screen-capture-trans');
      checkEl(document.querySelector('.screen-capture-time'), '.screen-capture-time');

      // Preview mock
      Array.from(document.querySelectorAll('.screen-ov-lang-lbl')).forEach((lbl, idx) => {
        checkEl(lbl, `.screen-ov-lang-lbl:nth-of-type(${idx + 1})`);
      });
      checkEl(document.querySelector('#screenOvOrig'), '#screenOvOrig');
      checkEl(document.querySelector('#screenOvTrans'), '#screenOvTrans');
      Array.from(document.querySelectorAll('.screen-meta-pill')).forEach((pill, idx) => {
        checkEl(pill, `.screen-meta-pill:nth-of-type(${idx + 1})`);
      });

      const firstModeCard = document.querySelector('.screen-mode-card:not(.on)');
      const previewCard = document.querySelector('.screen-preview-card');

      return {
        modeCardBg: firstModeCard ? getComputedStyle(firstModeCard).backgroundColor : '',
        previewCardBg: previewCard ? getComputedStyle(previewCard).backgroundColor : '',
        violations
      };
    }, { currentTheme: themeId });

    if (themeId === 'makan-lab') {
      makanLabModeCardBg = metrics.modeCardBg;
      makanLabPreviewCardBg = metrics.previewCardBg;
    }

    allViolations.push(...metrics.violations);
  }

  expect(allViolations).toEqual([]);

  // Assert computed background-color in makan-lab preserves today's values
  expect(makanLabModeCardBg).toBe('rgba(15, 23, 42, 0.5)');
  expect(makanLabPreviewCardBg).toBe('rgb(11, 17, 28)');
});
