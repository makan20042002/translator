'use strict';

/**
 * Web app: Theme Contrast Verification
 * Verifies that text colors meet WCAG contrast thresholds (>= 4.5:1 for normal text,
 * >= 3:1 for large text 18px+ or 14px bold+) across all 7 themes on key UI surfaces.
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

/**
 * Explicit allow-list for any element pair that has a lower contrast ratio due to
 * the theme's own official design tokens (do not change theme tokens; allow-list them).
 */
const ALLOW_LIST = {
  // Format: 'theme-id': ['selector', ...]
};

const SELECTORS = [
  { name: 'banner title', selector: '#pageTitle', setup: null },
  { name: 'tab line', selector: '.topbar-eyebrow', setup: null },
  {
    name: '#screenBtn',
    selector: '#btnScreenTrans',
    setup: (page) => page.evaluate(() => {
      const el = document.getElementById('btnScreenTrans');
      if (el) el.style.display = 'inline-flex';
    })
  },
  { name: 'offline chip (offBtn)', selector: '#offBtn', setup: null },
  { name: 'offline chip (statusPill)', selector: '#sidebarStatusPill', setup: null },
  { name: 'language toggle', selector: '#uiLang', setup: null },
  { name: 'search box', selector: '#topbarSearch', setup: null },
  {
    name: 'output card text',
    selector: '#tOut',
    setup: (page) => page.evaluate(() => {
      const el = document.getElementById('tOut');
      if (el) el.value = 'Sample translated text';
    })
  },
  { name: 'Copy button', selector: '#tCopy', setup: null },
  { name: 'Speak button', selector: '#tSpeak', setup: null },
  {
    name: 'voice label',
    selector: '#tVoiceUsed',
    setup: (page) => page.evaluate(() => {
      const el = document.getElementById('tVoiceUsed');
      if (el) el.textContent = 'Voice: Gemini (Kore)';
    })
  },
  { name: 'sidebar item', selector: '#tabs button[data-tab="text"]', setup: null },
  {
    name: 'Document tab progress text',
    selector: '#dProgText',
    setup: async (page) => {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await page.waitForTimeout(50);
    }
  },
  {
    name: 'Document tab status chip',
    selector: '#dStatusChip',
    setup: async (page) => {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await page.waitForTimeout(50);
    }
  },
  {
    name: 'Settings tab button',
    selector: '#setTabBtnEngines',
    setup: (page) => page.evaluate(() => {
      const modal = document.querySelector('.modal');
      const ov = document.querySelector('.ov');
      if (ov) ov.classList.add('on');
    })
  },
  {
    name: 'toast',
    selector: '.toast',
    setup: (page) => page.evaluate(() => {
      let toasts = document.getElementById('toasts');
      if (!toasts) {
        toasts = document.createElement('div');
        toasts.id = 'toasts';
        toasts.className = 'toasts';
        document.body.appendChild(toasts);
      }
      let toast = toasts.querySelector('.toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = 'Translation copied to clipboard';
        toasts.appendChild(toast);
      }
    })
  }
];

test.describe('Theme Contrast Tests across all 7 themes', () => {
  for (const themeId of THEMES) {
    test(`contrast verification for theme: ${themeId}`, async ({ app }) => {
      const { page } = app;

      // Apply theme
      await page.evaluate((id) => {
        if (typeof applyTheme === 'function') {
          applyTheme(id);
        } else {
          document.documentElement.setAttribute('data-theme', id);
        }
      }, themeId);
      await page.waitForTimeout(100);

      for (const item of SELECTORS) {
        if (item.setup) {
          await item.setup(page);
          await page.waitForTimeout(50);
        }

        const result = await page.evaluate(({ sel }) => {
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

          const el = document.querySelector(sel);
          if (!el) return { error: `Element not found: ${sel}` };

          const style = window.getComputedStyle(el);
          const textRgb = parseRgb(style.color);
          if (!textRgb) return { error: `Cannot parse text color: ${style.color}` };

          const fontSize = parseFloat(style.fontSize) || 14;
          const fontWeight = parseInt(style.fontWeight, 10) || (style.fontWeight === 'bold' ? 700 : 400);
          const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
          const requiredRatio = isLarge ? 3.0 : 4.5;

          // Walk up to find the first ancestor with an opaque background-color
          let current = el;
          let gradientStops = [];
          let opaqueBg = null;

          while (current && current !== document) {
            const curStyle = window.getComputedStyle(current);
            if (gradientStops.length === 0 && curStyle.backgroundImage && curStyle.backgroundImage.includes('gradient')) {
              gradientStops = parseGradientStops(curStyle.backgroundImage);
            }
            const bgRgb = parseRgb(curStyle.backgroundColor);
            if (bgRgb && bgRgb.a >= 0.99) {
              opaqueBg = bgRgb;
              break;
            }
            current = current.parentElement;
          }

          if (!opaqueBg) {
            const bodyStyle = window.getComputedStyle(document.body);
            opaqueBg = parseRgb(bodyStyle.backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
          }

          let worstContrast = Infinity;
          if (gradientStops.length > 0) {
            for (const stop of gradientStops) {
              const effectiveColor = stop.a < 1 ? blend(stop, opaqueBg) : stop;
              const ratio = contrastRatio(textRgb, effectiveColor);
              if (ratio < worstContrast) {
                worstContrast = ratio;
              }
            }
          } else {
            worstContrast = contrastRatio(textRgb, opaqueBg);
          }

          return {
            worstContrast: Math.round(worstContrast * 100) / 100,
            requiredRatio,
            fontSize,
            fontWeight,
            isLarge
          };
        }, { sel: item.selector });

        expect(result.error, `Error checking ${item.name} (${item.selector}) in theme ${themeId}`).toBeUndefined();

        const isAllowListed = ALLOW_LIST[themeId] && ALLOW_LIST[themeId].includes(item.selector);
        if (!isAllowListed) {
          expect(
            result.worstContrast,
            `Contrast for ${item.name} (${item.selector}) in theme "${themeId}" is ${result.worstContrast}:1, requires >= ${result.requiredRatio}:1 (font: ${result.fontSize}px, weight: ${result.fontWeight})`
          ).toBeGreaterThanOrEqual(result.requiredRatio);
        }
      }
    });
  }
});
