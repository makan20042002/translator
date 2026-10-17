'use strict';

/**
 * Item 5: Theme contrast sweep across remaining tabs and modals
 * In Platinum Blue and Champagne Minimal:
 * Tests Document, Dictionary, Idioms, Compare, Glossary, History, Games, Model Hub,
 * Settings modal, and Welcome wizard.
 * Walks visible text elements and verifies contrast ratio >= 4.5 against effective background.
 * Collects ALL violations first, then asserts expect(violations).toEqual([]).
 */

const { test, expect, mouseClick } = require('../support/fixtures');

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

const OTHER_TABS = [
  { id: 'doc', btnSelector: '#tabs button[data-tab="doc"]', rootSelector: '#tab-doc' },
  { id: 'dict', btnSelector: '#tabs button[data-tab="dict"]', rootSelector: '#tab-dict' },
  { id: 'idiom', btnSelector: '#tabs button[data-tab="idiom"]', rootSelector: '#tab-idiom' },
  { id: 'cmp', btnSelector: '#tabs button[data-tab="cmp"]', rootSelector: '#tab-cmp' },
  { id: 'gls', btnSelector: '#tabs button[data-tab="gls"]', rootSelector: '#tab-gls' },
  { id: 'hist', btnSelector: '#tabs button[data-tab="hist"]', rootSelector: '#tab-hist' },
  { id: 'games', btnSelector: '#tabs button[data-tab="games"]', rootSelector: '#tab-games' },
  { id: 'models', btnSelector: '#tabs button[data-tab="models"]', rootSelector: '#tab-models' }
];

test('contrast across remaining tabs, settings modal and welcome wizard meets >= 4.5 in light themes', async ({ app }) => {
  const { page } = app;

  const allViolations = [];

  for (const themeId of LIGHT_THEMES) {
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

    // 1. Scan remaining tabs
    for (const tab of OTHER_TABS) {
      await mouseClick(page, page.locator(tab.btnSelector));
      await page.waitForTimeout(50);

      // Model Hub: Ensure catalog renders if function exists
      if (tab.id === 'models') {
        await page.evaluate(() => {
          if (typeof renderModelHub === 'function') renderModelHub();
        });
        await page.waitForTimeout(50);
      }

      const scanResult = await page.evaluate(({ tabId, rootSel, currentTheme }) => {
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

        function parseFirstGradientStop(bgImage) {
          if (!bgImage || bgImage === 'none') return null;
          const rgbMatch = bgImage.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/);
          if (rgbMatch) return parseRgb(rgbMatch[0]);
          const hexMatch = bgImage.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b/);
          if (hexMatch) return parseHex(hexMatch[0]);
          return null;
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
            if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
              const stop = parseFirstGradientStop(cs.backgroundImage);
              if (stop) {
                bg = stop.a < 1 ? blend(stop, bg) : stop;
              }
            }
            const c = parseRgb(cs.backgroundColor);
            if (c && c.a > 0) {
              bg = blend(c, bg);
            }
          }
          return bg;
        }

        function getSelector(el) {
          if (!el) return '';
          if (el.id) return `#${el.id}`;
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          return `${tag}${cls}`;
        }

        const root = document.querySelector(rootSel);
        if (!root) return { violations: [], count: 0 };

        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              if (!node.textContent || !node.textContent.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              let el = node.parentElement;
              while (el && el !== document.documentElement) {
                if (el.hidden) return NodeFilter.FILTER_REJECT;
                if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
                  return NodeFilter.FILTER_REJECT;
                }
                if (el.getAttribute('aria-hidden') === 'true') {
                  return NodeFilter.FILTER_REJECT;
                }
                if (el.tagName === 'OPTION') {
                  return NodeFilter.FILTER_REJECT;
                }
                const cs = window.getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
                  return NodeFilter.FILTER_REJECT;
                }
                el = el.parentElement;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        const violations = [];
        const seen = new Set();
        let count = 0;

        while (walker.nextNode()) {
          const node = walker.currentNode;
          const el = node.parentElement;
          if (seen.has(el)) continue;
          seen.add(el);
          count++;

          const textRgb = parseRgb(getComputedStyle(el).color);
          const bgRgb = computeEffectiveBg(el);
          if (!textRgb || !bgRgb) continue;

          const ratio = contrastRatio(textRgb, bgRgb);
          if (ratio < 4.5) {
            violations.push({
              area: tabId,
              theme: currentTheme,
              selector: getSelector(el),
              text: node.textContent.trim().slice(0, 30),
              color: getComputedStyle(el).color,
              bg: `rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})`,
              contrast: Math.round(ratio * 100) / 100
            });
          }
        }

        return { violations, count };
      }, { tabId: tab.id, rootSel: tab.rootSelector, currentTheme: themeId });

      allViolations.push(...scanResult.violations);
    }

    // 2. Scan Settings modal
    await mouseClick(page, page.locator('#openSet'));
    await page.waitForTimeout(60);

    const settingsScan = await page.evaluate(({ currentTheme }) => {
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

      function parseFirstGradientStop(bgImage) {
        if (!bgImage || bgImage === 'none') return null;
        const rgbMatch = bgImage.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/);
        if (rgbMatch) return parseRgb(rgbMatch[0]);
        const hexMatch = bgImage.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b/);
        if (hexMatch) return parseHex(hexMatch[0]);
        return null;
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
          if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
            const stop = parseFirstGradientStop(cs.backgroundImage);
            if (stop) {
              bg = stop.a < 1 ? blend(stop, bg) : stop;
            }
          }
          const c = parseRgb(cs.backgroundColor);
          if (c && c.a > 0) {
            bg = blend(c, bg);
          }
        }
        return bg;
      }

      function getSelector(el) {
        if (!el) return '';
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        return `${tag}${cls}`;
      }

      const root = document.querySelector('#ov .modal');
      if (!root) return [];

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            let el = node.parentElement;
            while (el && el !== document.documentElement) {
              if (el.hidden) return NodeFilter.FILTER_REJECT;
              if (el.disabled || el.getAttribute('aria-disabled') === 'true') return NodeFilter.FILTER_REJECT;
              if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
              if (el.tagName === 'OPTION') return NodeFilter.FILTER_REJECT;
              const cs = window.getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
                return NodeFilter.FILTER_REJECT;
              }
              el = el.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const violations = [];
      const seen = new Set();

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const el = node.parentElement;
        if (seen.has(el)) continue;
        seen.add(el);

        const textRgb = parseRgb(getComputedStyle(el).color);
        const bgRgb = computeEffectiveBg(el);
        if (!textRgb || !bgRgb) continue;

        const ratio = contrastRatio(textRgb, bgRgb);
        if (ratio < 4.5) {
          violations.push({
            area: 'settings-modal',
            theme: currentTheme,
            selector: getSelector(el),
            text: node.textContent.trim().slice(0, 30),
            color: getComputedStyle(el).color,
            bg: `rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})`,
            contrast: Math.round(ratio * 100) / 100
          });
        }
      }

      return violations;
    }, { currentTheme: themeId });

    allViolations.push(...settingsScan);

    // Close settings modal
    await mouseClick(page, page.locator('#closeSet'));
    await page.waitForTimeout(50);

    // 3. Scan Welcome wizard
    await page.evaluate(() => {
      if (typeof openWelcomeWizard === 'function') {
        openWelcomeWizard(1);
      }
    });
    await page.waitForTimeout(60);

    const welcomeScan = await page.evaluate(({ currentTheme }) => {
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

      function parseFirstGradientStop(bgImage) {
        if (!bgImage || bgImage === 'none') return null;
        const rgbMatch = bgImage.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/);
        if (rgbMatch) return parseRgb(rgbMatch[0]);
        const hexMatch = bgImage.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b/);
        if (hexMatch) return parseHex(hexMatch[0]);
        return null;
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
          if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
            const stop = parseFirstGradientStop(cs.backgroundImage);
            if (stop) {
              bg = stop.a < 1 ? blend(stop, bg) : stop;
            }
          }
          const c = parseRgb(cs.backgroundColor);
          if (c && c.a > 0) {
            bg = blend(c, bg);
          }
        }
        return bg;
      }

      function getSelector(el) {
        if (!el) return '';
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        return `${tag}${cls}`;
      }

      const root = document.querySelector('.welcome-modal');
      if (!root) return [];

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            let el = node.parentElement;
            while (el && el !== document.documentElement) {
              if (el.hidden) return NodeFilter.FILTER_REJECT;
              if (el.disabled || el.getAttribute('aria-disabled') === 'true') return NodeFilter.FILTER_REJECT;
              if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
              if (el.tagName === 'OPTION') return NodeFilter.FILTER_REJECT;
              const cs = window.getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
                return NodeFilter.FILTER_REJECT;
              }
              el = el.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const violations = [];
      const seen = new Set();

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const el = node.parentElement;
        if (seen.has(el)) continue;
        seen.add(el);

        const textRgb = parseRgb(getComputedStyle(el).color);
        const bgRgb = computeEffectiveBg(el);
        if (!textRgb || !bgRgb) continue;

        const ratio = contrastRatio(textRgb, bgRgb);
        if (ratio < 4.5) {
          violations.push({
            area: 'welcome-wizard',
            theme: currentTheme,
            selector: getSelector(el),
            text: node.textContent.trim().slice(0, 30),
            color: getComputedStyle(el).color,
            bg: `rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})`,
            contrast: Math.round(ratio * 100) / 100
          });
        }
      }

      return violations;
    }, { currentTheme: themeId });

    allViolations.push(...welcomeScan);

    // Close welcome wizard
    await page.evaluate(() => {
      if (typeof closeWelcomeWizard === 'function') {
        closeWelcomeWizard();
      }
    });
    await page.waitForTimeout(40);
  }

  // All violations are collected so test output details all failures at once
  expect(allViolations).toEqual([]);
});
