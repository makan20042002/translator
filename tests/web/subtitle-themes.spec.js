'use strict';

/**
 * Item 1: Theme-aware subtitle cards
 * Verifies contrast >= 4.5 for visible text elements of both cards (.sub-entry-card-drop and .sub-entry-card-video)
 * across all 7 themes against effective background (ancestor blending and gradient color stops).
 * Also asserts exact computed background-image of .sub-entry-card-drop for makan-lab.
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

test('subtitle entry cards meet contrast >= 4.5 across all 7 themes and preserve makan-lab values', async ({ app }) => {
  const { page } = app;

  // Open Subtitle tab
  await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
  await page.waitForTimeout(60);

  let makanLabDropBgImage = '';

  for (const themeId of THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

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

      function measureEl(el) {
        if (!el) return null;
        const textRgb = parseRgb(getComputedStyle(el).color);
        const { bg, gradientStops } = computeEffectiveAncestors(el);

        if (gradientStops.length >= 2) {
          // For gradients, test first and last color stop blended over base
          const firstStop = blend(gradientStops[0], bg);
          const lastStop = blend(gradientStops[gradientStops.length - 1], bg);
          const ratioFirst = contrastRatio(textRgb, firstStop);
          const ratioLast = contrastRatio(textRgb, lastStop);
          return {
            worst: Math.min(ratioFirst, ratioLast),
            ratioFirst,
            ratioLast
          };
        }

        const ratio = contrastRatio(textRgb, bg);
        return {
          worst: ratio,
          ratioFirst: ratio,
          ratioLast: ratio
        };
      }

      const dropCard = document.querySelector('.sub-entry-card-drop');
      const videoCard = document.querySelector('.sub-entry-card-video');

      const dropTitle = dropCard ? dropCard.querySelector('strong') : null;
      const dropHint = dropCard ? dropCard.querySelector('.hint') : null;
      const dropChips = dropCard ? Array.from(dropCard.querySelectorAll('.sub-chip')) : [];

      const videoTitle = videoCard ? videoCard.querySelector('strong') : null;
      const videoNote = videoCard ? videoCard.querySelector('.sub-video-note') : null;
      const videoBadge = videoCard ? videoCard.querySelector('.sub-coming-soon-badge') : null;

      return {
        dropBgImage: dropCard ? getComputedStyle(dropCard).backgroundImage : '',
        dropTitle: measureEl(dropTitle),
        dropHint: measureEl(dropHint),
        dropChips: dropChips.map(measureEl),
        videoTitle: measureEl(videoTitle),
        videoNote: measureEl(videoNote),
        videoBadge: measureEl(videoBadge)
      };
    });

    if (themeId === 'makan-lab') {
      makanLabDropBgImage = metrics.dropBgImage;
    }

    expect(metrics.dropTitle.worst, `dropTitle in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.dropHint.worst, `dropHint in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.dropChips.length, `dropChips in ${themeId}`).toBeGreaterThan(0);
    for (const chipMetrics of metrics.dropChips) {
      expect(chipMetrics.worst, `dropChip in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    }

    expect(metrics.videoTitle.worst, `videoTitle in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.videoNote.worst, `videoNote in ${themeId}`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.videoBadge.worst, `videoBadge in ${themeId}`).toBeGreaterThanOrEqual(4.5);
  }

  // Assert computed background-image for makan-lab matches today's exact gradient
  expect(makanLabDropBgImage).toContain('radial-gradient');
  expect(makanLabDropBgImage).toContain('rgba(14, 165, 233, 0.08)');
  expect(makanLabDropBgImage).toContain('rgba(9, 20, 40, 0.95)');
});
