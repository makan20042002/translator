'use strict';

/**
 * Item 1: Theme-aware conversation bubbles
 * Verifies contrast >= 4.5 for .bub-text, .bub-orig-text, .bub-speaker, .bub-time
 * and each .bub-tag for both .bub.a and .bub.b across all 7 themes.
 * Also asserts exact computed backgrounds for makan-lab.
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

test('conversation bubbles meet contrast >= 4.5 across all 7 themes and preserve makan-lab values', async ({ app }) => {
  const { page } = app;

  // Open Voice tab
  await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
  await page.waitForTimeout(60);

  let makanLabABg = '';
  let makanLabBBg = '';

  for (const themeId of THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

    // Create two bubbles in #bubbles using addBubble
    await page.evaluate(() => {
      const container = document.getElementById('bubbles');
      container.innerHTML = '';
      addBubble(container, 'a', 'Hello, how can I help you today?', 'سلام، چطور می‌توانم امروز کمکتان کنم؟', 'en', 'fa', {
        stt: 'Whisper',
        engine: 'Gemini',
        voice: 'David',
        dur: '1.4s'
      });
      addBubble(container, 'b', 'من می‌خواهم یک آزمایش انجام دهم.', 'I want to run an experiment.', 'fa', 'en', {
        stt: 'Whisper',
        engine: 'Groq',
        voice: 'Zira',
        dur: '0.9s'
      });
    });
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

      function computeEffectiveBg(el) {
        const path = [];
        let cur = el;
        while (cur && cur !== document.documentElement) {
          path.unshift(cur);
          cur = cur.parentElement;
        }
        let bg = parseRgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        for (const node of path) {
          const cs = getComputedStyle(node);
          const c = parseRgb(cs.backgroundColor);
          if (c && c.a > 0) {
            bg = blend(c, bg);
          }
        }
        return bg;
      }

      function measureEl(el) {
        const textRgb = parseRgb(getComputedStyle(el).color);
        const bgRgb = computeEffectiveBg(el);
        return contrastRatio(textRgb, bgRgb);
      }

      const bubA = document.querySelector('.bub.a');
      const bubB = document.querySelector('.bub.b');

      return {
        aBg: getComputedStyle(bubA).backgroundColor,
        bBg: getComputedStyle(bubB).backgroundColor,
        aText: measureEl(bubA.querySelector('.bub-text')),
        aOrig: measureEl(bubA.querySelector('.bub-orig-text')),
        aSpeaker: measureEl(bubA.querySelector('.bub-speaker')),
        aTime: measureEl(bubA.querySelector('.bub-time')),
        aTags: Array.from(bubA.querySelectorAll('.bub-tag')).map(measureEl),
        bText: measureEl(bubB.querySelector('.bub-text')),
        bOrig: measureEl(bubB.querySelector('.bub-orig-text')),
        bSpeaker: measureEl(bubB.querySelector('.bub-speaker')),
        bTime: measureEl(bubB.querySelector('.bub-time')),
        bTags: Array.from(bubB.querySelectorAll('.bub-tag')).map(measureEl)
      };
    });

    if (themeId === 'makan-lab') {
      makanLabABg = metrics.aBg;
      makanLabBBg = metrics.bBg;
    }

    expect(metrics.aText).toBeGreaterThanOrEqual(4.5);
    expect(metrics.aOrig).toBeGreaterThanOrEqual(4.5);
    expect(metrics.aSpeaker).toBeGreaterThanOrEqual(4.5);
    expect(metrics.aTime).toBeGreaterThanOrEqual(4.5);
    expect(metrics.aTags.length).toBeGreaterThan(0);
    for (const ratio of metrics.aTags) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }

    expect(metrics.bText).toBeGreaterThanOrEqual(4.5);
    expect(metrics.bOrig).toBeGreaterThanOrEqual(4.5);
    expect(metrics.bSpeaker).toBeGreaterThanOrEqual(4.5);
    expect(metrics.bTime).toBeGreaterThanOrEqual(4.5);
    expect(metrics.bTags.length).toBeGreaterThan(0);
    for (const ratio of metrics.bTags) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  }

  expect(makanLabABg).toBe('rgba(13, 27, 50, 0.85)');
  expect(makanLabBBg).toBe('rgba(16, 42, 82, 0.9)');
});
