'use strict';

/**
 * Item 3: Voice tab audit and voice picker label
 * For the two light themes (Platinum Blue and Champagne Minimal):
 * - Asserts contrast >= 4.5 for .v-status-line, .v-live-btn, .voice-privacy-note, and .v-space-hint.
 * - Asserts that the voice label element's title attribute equals its full text content.
 * - Asserts no horizontal overflow of the dock at 360px width in EN and FA (RTL).
 */

const { test, expect, mouseClick } = require('../support/fixtures');

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

test('voice tab contrast in light themes and voice label layout without overflow', async ({ app }) => {
  const { page } = app;

  // Open Voice tab
  await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
  await page.waitForTimeout(60);

  // 1. Contrast checks across light themes
  for (const themeId of LIGHT_THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

    const contrasts = await page.evaluate(() => {
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

      function measure(sel) {
        const el = document.querySelector(sel);
        const textRgb = parseRgb(getComputedStyle(el).color);
        const bgRgb = computeEffectiveBg(el);
        return contrastRatio(textRgb, bgRgb);
      }

      return {
        statusLine: measure('.v-status-line'),
        livePill: measure('.v-live-btn'),
        privacyChip: measure('.voice-privacy-note'),
        spaceHint: measure('.v-space-hint')
      };
    });

    expect(contrasts.statusLine).toBeGreaterThanOrEqual(4.5);
    expect(contrasts.livePill).toBeGreaterThanOrEqual(4.5);
    expect(contrasts.privacyChip).toBeGreaterThanOrEqual(4.5);
    expect(contrasts.spaceHint).toBeGreaterThanOrEqual(4.5);
  }

  // 2. Voice label element title attribute equals its full text content
  const labelData = await page.evaluate(() => {
    if (typeof updateCompactVoiceButtons === 'function') {
      updateCompactVoiceButtons();
    }
    const wrap = document.querySelector('.v-voice-label-wrap');
    const cur = document.querySelector('#vConvVoiceCurLabel');
    return {
      wrapTitle: wrap.getAttribute('title'),
      wrapText: wrap.textContent.trim(),
      curTitle: cur.getAttribute('title'),
      curText: cur.textContent.trim()
    };
  });

  expect(labelData.wrapTitle).toBe(labelData.wrapText);
  expect(labelData.curTitle).toBe(labelData.curText);

  // 3. No horizontal overflow of dock at 360px width in EN and FA (RTL)
  for (const lang of ['en', 'fa']) {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.evaluate((l) => {
      document.documentElement.lang = l;
      document.documentElement.dir = (l === 'fa' ? 'rtl' : 'ltr');
      if (typeof setUILanguage === 'function') setUILanguage(l);
    }, lang);
    await page.waitForTimeout(60);

    const overflowInfo = await page.evaluate(() => {
      const dock = document.querySelector('.v-bottom-dock') || document.querySelector('.v-action-dock');
      return {
        scrollWidth: dock.scrollWidth,
        clientWidth: dock.clientWidth,
        hasOverflow: dock.scrollWidth > dock.clientWidth
      };
    });

    expect(overflowInfo.hasOverflow).toBe(false);
  }
});
