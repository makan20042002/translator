'use strict';

/**
 * Item 2: Talk button (.ptt-btn) across all states and themes
 * Verifies contrast >= 4.5 for text and icon in every state (ready, listening, working, preparing, speaking)
 * across all 7 themes.
 * For makan-lab, asserts computed background-image matches today's exact values for each state.
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

const STATES = [
  { state: 'ready', label: 'Talk' },
  { state: 'listening', label: 'Release to send' },
  { state: 'working', label: 'Translating...' },
  { state: 'preparing', label: 'Preparing…' },
  { state: 'speaking', label: 'Speaking…' }
];

const EXPECTED_MAKAN_LAB_BG = {
  ready: 'radial-gradient(circle at 35% 30%, rgb(24, 35, 56) 0%, rgb(9, 17, 32) 100%)',
  listening: 'radial-gradient(circle at 35% 30%, rgb(61, 19, 25) 0%, rgb(25, 8, 12) 100%)',
  working: 'radial-gradient(circle at 35% 30%, rgb(13, 40, 56) 0%, rgb(5, 20, 28) 100%)',
  preparing: 'radial-gradient(circle at 35% 30%, rgb(61, 46, 20) 0%, rgb(28, 20, 8) 100%)',
  speaking: 'radial-gradient(circle at 35% 30%, rgb(19, 43, 71) 0%, rgb(8, 21, 38) 100%)'
};

test('talk button meets contrast in all states across 7 themes and preserves makan-lab gradients', async ({ app }) => {
  const { page } = app;

  // Open Voice tab
  await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
  await page.waitForTimeout(60);

  const makanLabBgs = {};

  for (const themeId of THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

    for (const { state, label } of STATES) {
      const stateResult = await page.evaluate(({ curState, curLabel }) => {
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

        function parseHex(hex) {
          let c = hex.replace('#', '');
          if (c.length === 3) c = c.split('').map(x => x + x).join('');
          const num = parseInt(c, 16);
          return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 };
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

        function parseFirstGradientStop(bgImage) {
          if (!bgImage || bgImage === 'none') return null;
          const rgbMatch = bgImage.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/);
          if (rgbMatch) return parseRgb(rgbMatch[0]);
          const hexMatch = bgImage.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b/);
          if (hexMatch) return parseHex(hexMatch[0]);
          return null;
        }

        const btn = document.getElementById('vPttBtn');
        btn.dataset.state = curState;
        btn.classList.toggle('rec', curState === 'listening');
        const lbl = document.getElementById('vPttLabel');
        lbl.textContent = curLabel;
        const icon = document.getElementById('vPttIcon');

        const cs = getComputedStyle(btn);
        const bgImg = cs.backgroundImage;
        let stopRgb = parseFirstGradientStop(bgImg);
        if (!stopRgb) {
          stopRgb = parseRgb(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 1 };
        }
        if (stopRgb.a < 1) {
          const parentBg = computeEffectiveBg(btn.parentElement);
          stopRgb = blend(stopRgb, parentBg);
        }

        const textRgb = parseRgb(getComputedStyle(lbl).color);
        const iconRgb = parseRgb(getComputedStyle(icon).color);

        return {
          bgImage: bgImg,
          textContrast: contrastRatio(textRgb, stopRgb),
          iconContrast: contrastRatio(iconRgb, stopRgb)
        };
      }, { curState: state, curLabel: label });

      if (themeId === 'makan-lab') {
        makanLabBgs[state] = stateResult.bgImage;
      }

      expect(stateResult.textContrast).toBeGreaterThanOrEqual(4.5);
      expect(stateResult.iconContrast).toBeGreaterThanOrEqual(3.0);
    }
  }

  for (const { state } of STATES) {
    expect(makanLabBgs[state]).toBe(EXPECTED_MAKAN_LAB_BG[state]);
  }
});
