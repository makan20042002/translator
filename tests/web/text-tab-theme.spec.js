'use strict';

/**
 * Item 2: Text tab translate button kbd and voice label layout
 * Across all 7 themes:
 * - Asserts contrast >= 4.5 for kbd text against #tGo button fill.
 * - Asserts kbd background alpha < 0.5 (not a solid opaque light rectangle).
 * - Asserts that the Text tab voice label has title === full text.
 * - Asserts no horizontal overflow of the target card at 360px, 700px, and 1280px in EN and FA (RTL).
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

test('Text tab translate button kbd has high contrast and voice label does not overflow at 360px', async ({ app }) => {
  const { page } = app;

  // Open Text tab
  await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
  await page.waitForTimeout(60);

  for (const themeId of THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

    const buttonMetrics = await page.evaluate(() => {
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

      const tGo = document.getElementById('tGo');
      const kbd = tGo ? tGo.querySelector('kbd') : null;

      const tGoStyle = window.getComputedStyle(tGo);
      const kbdStyle = window.getComputedStyle(kbd);

      const kbdColor = parseRgb(kbdStyle.color);
      const kbdBg = parseRgb(kbdStyle.backgroundColor);

      let tGoFill = parseRgb(tGoStyle.backgroundColor);
      if ((!tGoFill || tGoFill.a === 0) && tGoStyle.backgroundImage && tGoStyle.backgroundImage.includes('gradient')) {
        const stops = parseGradientStops(tGoStyle.backgroundImage);
        if (stops.length > 0) {
          tGoFill = stops[0];
        }
      }
      if (!tGoFill || tGoFill.a === 0) {
        tGoFill = { r: 19, g: 102, b: 226, a: 1 };
      }

      const ratio = contrastRatio(kbdColor, tGoFill);

      return {
        contrast: ratio,
        kbdAlpha: kbdBg ? kbdBg.a : 1
      };
    });

    expect(buttonMetrics.contrast, `kbd text vs #tGo fill in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(buttonMetrics.kbdAlpha, `kbd background alpha in ${themeId}`).toBeLessThan(0.5);
  }

  // Verify voice label title === full text
  const labelData = await page.evaluate(() => {
    if (typeof updateCompactVoiceButtons === 'function') {
      updateCompactVoiceButtons();
    }
    const vu = document.getElementById('tVoiceUsed');
    if (vu) {
      vu.textContent = 'Voice: Microsoft David - English (United States)';
    }
    const cur = document.getElementById('tVoiceCurLabel');
    return {
      vuTitle: vu ? vu.getAttribute('title') : '',
      vuText: vu ? vu.textContent.trim() : '',
      curTitle: cur ? cur.getAttribute('title') : '',
      curText: cur ? cur.textContent.trim() : ''
    };
  });

  expect(labelData.vuTitle).toBe(labelData.vuText);
  expect(labelData.curTitle).toBe(labelData.curText);

  // Verify no horizontal overflow of the card at 360px, 700px, 1280px in EN and FA
  for (const width of [360, 700, 1280]) {
    for (const lang of ['en', 'fa']) {
      await page.setViewportSize({ width, height: 740 });
      await page.evaluate((l) => {
        document.documentElement.lang = l;
        document.documentElement.dir = (l === 'fa' ? 'rtl' : 'ltr');
        if (typeof setUILanguage === 'function') setUILanguage(l);
      }, lang);
      await page.waitForTimeout(50);

      const overflow = await page.evaluate(() => {
        const card = document.querySelector('.trans-card-target') || document.querySelector('.pane.trans-card:last-of-type');
        return {
          scrollWidth: card.scrollWidth,
          clientWidth: card.clientWidth,
          hasOverflow: card.scrollWidth > card.clientWidth
        };
      });

      expect(overflow.hasOverflow, `horizontal overflow at ${width}px in ${lang}`).toBe(false);
    }
  }
});
