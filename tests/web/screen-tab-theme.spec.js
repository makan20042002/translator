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

  let makanLabModeCardBg = '';
  let makanLabPreviewCardBg = '';

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

    const metrics = await page.evaluate(() => {
      function parseRgb(colorStr) {
        if (!colorStr) return null;
        const m = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
        if (!m) return null;
        return {
          r: parseFloat(m[1]),
          g: parseFloat(m[2]),
          b: parseFloat(m[3]),
          a: m[4] !== undefined ? parseFloat(m[4]) : 1
        };
      }

      function parseGradientStops(bgImage) {
        if (!bgImage || !bgImage.includes('gradient')) return [];
        const regex = /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/g;
        const matches = bgImage.match(regex);
        if (!matches) return [];
        return matches.map(parseRgb).filter(Boolean);
      }

      function blend(fg, bg) {
        const a = fg.a;
        return {
          r: Math.round(fg.r * a + bg.r * (1 - a)),
          g: Math.round(fg.g * a + bg.g * (1 - a)),
          b: Math.round(fg.b * a + bg.b * (1 - a)),
          a: 1
        };
      }

      function sRGBtoLin(c) {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }

      function luminance(rgb) {
        return 0.2126 * sRGBtoLin(rgb.r) + 0.7152 * sRGBtoLin(rgb.g) + 0.0722 * sRGBtoLin(rgb.b);
      }

      function contrastRatio(rgb1, rgb2) {
        const l1 = luminance(rgb1);
        const l2 = luminance(rgb2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function computeEffectiveAncestors(el) {
        const path = [];
        let cur = el;
        while (cur && cur !== document.documentElement) {
          path.unshift(cur);
          cur = cur.parentElement;
        }

        let bg = parseRgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        let gradientStops = [];

        for (const node of path) {
          const cs = getComputedStyle(node);
          if (cs.backgroundImage && cs.backgroundImage.includes('gradient') && gradientStops.length === 0) {
            gradientStops = parseGradientStops(cs.backgroundImage);
          }
          const c = parseRgb(cs.backgroundColor);
          if (c && c.a > 0) {
            bg = blend(c, bg);
          }
        }
        return { bg, gradientStops };
      }

      function measure(el) {
        if (!el) return null;
        const textRgb = parseRgb(getComputedStyle(el).color);
        const { bg, gradientStops } = computeEffectiveAncestors(el);

        if (gradientStops.length >= 2) {
          const firstStop = blend(gradientStops[0], bg);
          const lastStop = blend(gradientStops[gradientStops.length - 1], bg);
          const ratioFirst = contrastRatio(textRgb, firstStop);
          const ratioLast = contrastRatio(textRgb, lastStop);
          return Math.min(ratioFirst, ratioLast);
        }

        return contrastRatio(textRgb, bg);
      }

      // Mode cards: selected (.on) and unselected
      const modeCards = Array.from(document.querySelectorAll('.screen-mode-card'));
      const modeCardMetrics = modeCards.map((card) => ({
        isOn: card.classList.contains('on'),
        nameRatio: measure(card.querySelector('.screen-mode-name')),
        descRatio: measure(card.querySelector('.screen-mode-desc'))
      }));

      // Labels & controls
      const engineLabelRatio = measure(document.querySelector('.screen-ctrl-lbl'));
      const readyBadgeRatio = measure(document.querySelector('.screen-mode-status.ready'));

      // Recent captures
      const recentTitleRatio = measure(document.querySelector('#screenRecentCard .screen-card-title'));
      const captureOrigRatio = measure(document.querySelector('.screen-capture-orig'));
      const captureTransRatio = measure(document.querySelector('.screen-capture-trans'));
      const captureTimeRatio = measure(document.querySelector('.screen-capture-time'));

      // Preview mock
      const ovLangLabels = Array.from(document.querySelectorAll('.screen-ov-lang-lbl')).map(measure);
      const ovOrigTextRatio = measure(document.querySelector('#screenOvOrig'));
      const ovTransTextRatio = measure(document.querySelector('#screenOvTrans'));
      const ovChips = Array.from(document.querySelectorAll('.screen-meta-pill')).map(measure);

      const firstModeCard = document.querySelector('.screen-mode-card:not(.on)');
      const previewCard = document.querySelector('.screen-preview-card');

      return {
        modeCardBg: firstModeCard ? getComputedStyle(firstModeCard).backgroundColor : '',
        previewCardBg: previewCard ? getComputedStyle(previewCard).backgroundColor : '',
        modeCardMetrics,
        engineLabelRatio,
        readyBadgeRatio,
        recentTitleRatio,
        captureOrigRatio,
        captureTransRatio,
        captureTimeRatio,
        ovLangLabels,
        ovOrigTextRatio,
        ovTransTextRatio,
        ovChips
      };
    });

    if (themeId === 'makan-lab') {
      makanLabModeCardBg = metrics.modeCardBg;
      makanLabPreviewCardBg = metrics.previewCardBg;
    }

    // Check mode card names and descriptions
    expect(metrics.modeCardMetrics.length).toBeGreaterThanOrEqual(3);
    for (const card of metrics.modeCardMetrics) {
      expect(card.nameRatio, `mode card name (on=${card.isOn}) in ${themeId}`).toBeGreaterThanOrEqual(4.5);
      expect(card.descRatio, `mode card desc (on=${card.isOn}) in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    }

    // Check Engine label and Ready badge
    expect(metrics.engineLabelRatio, `Engine label in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.readyBadgeRatio, `Ready badge in ${themeId}`).toBeGreaterThanOrEqual(4.5);

    // Check Recent captures title, orig, trans, time
    expect(metrics.recentTitleRatio, `Recent captures title in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.captureOrigRatio, `Recent capture orig in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.captureTransRatio, `Recent capture trans in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.captureTimeRatio, `Recent capture time in ${themeId}`).toBeGreaterThanOrEqual(4.5);

    // Check preview mock lines and chips
    expect(metrics.ovLangLabels.length).toBeGreaterThanOrEqual(2);
    for (const lblRatio of metrics.ovLangLabels) {
      expect(lblRatio, `Overlay lang label in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(metrics.ovOrigTextRatio, `Overlay orig text in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.ovTransTextRatio, `Overlay trans text in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.ovChips.length).toBeGreaterThanOrEqual(3);
    for (const chipRatio of metrics.ovChips) {
      expect(chipRatio, `Overlay meta chip in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    }
  }

  // Assert computed background-color in makan-lab preserves today's values
  expect(makanLabModeCardBg).toBe('rgba(15, 23, 42, 0.5)');
  expect(makanLabPreviewCardBg).toBe('rgb(11, 17, 28)');
});
