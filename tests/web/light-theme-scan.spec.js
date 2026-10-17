'use strict';

/**
 * Item 4: Comprehensive light theme scan across four fixed tabs
 * In Platinum Blue and Champagne Minimal:
 * For each of Text, Subtitle, Voice (with two bubbles injected), and Screen tabs:
 * Walks every element with direct visible text (skipping hidden, disabled, opacity 0, aria-hidden,
 * and .screen-preview-card / .screen-scene-viewport children which have their own dark background),
 * measuring contrast against its effective background.
 * Collects ALL violations first, then asserts expect(violations).toEqual([]).
 */

const { test, expect, mouseClick } = require('../support/fixtures');

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

const TABS = [
  { id: 'text', btnSelector: '#tabs button[data-tab="text"]', rootSelector: '#tab-text' },
  { id: 'sub', btnSelector: '#tabs button[data-tab="sub"]', rootSelector: '#tab-sub' },
  { id: 'voice', btnSelector: '#tabs button[data-tab="voice"]', rootSelector: '#tab-voice' },
  { id: 'screen', btnSelector: '#tabs button[data-tab="screen"]', rootSelector: '#tab-screen' }
];

test('light theme contrast scan across Text, Subtitle, Voice, and Screen tabs meets >= 4.5', async ({ app }) => {
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

    for (const tab of TABS) {
      await mouseClick(page, page.locator(tab.btnSelector));
      await page.waitForTimeout(60);

      // Tab-specific setups
      if (tab.id === 'voice') {
        await page.evaluate(() => {
          const container = document.getElementById('bubbles');
          if (container && typeof addBubble === 'function') {
            container.innerHTML = '';
            addBubble(container, 'a', 'Hello, how can I help you today?', 'سلام، چطور می‌توانم امروز کمکتان کنم؟', 'en', 'fa', {
              stt: 'Whisper',
              engine: 'Gemini',
              voice: 'David',
              dur: '1.4s'
            });
            addBubble(container, 'b', 'من می‌خواهم یک سند را ترجمه کنم.', 'I want to translate a document.', 'fa', 'en', {
              stt: 'Whisper',
              engine: 'Groq',
              voice: 'Zira',
              dur: '0.9s'
            });
          }
        });
        await page.waitForTimeout(40);
      }

      if (tab.id === 'screen') {
        await page.evaluate(() => {
          const listEl = document.getElementById('screenCapturesList');
          if (listEl && listEl.children.length === 0) {
            listEl.innerHTML = `
              <div class="screen-capture-item">
                <div class="screen-capture-thumb" aria-hidden="true">★</div>
                <div class="screen-capture-meta">
                  <span class="screen-capture-orig"><bdi>Sample header text</bdi></span>
                  <span class="screen-capture-arrow">→</span>
                  <span class="screen-capture-trans" dir="rtl">متن سربرگ نمونه</span>
                  <span class="screen-capture-time">Just now</span>
                </div>
              </div>
            `;
          }
        });
        await page.waitForTimeout(40);
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
                // Skip preview mock's children (covered by item 3 and have their own dark mock bg)
                if (el.classList.contains('screen-scene-viewport') || el.classList.contains('screen-result-overlay')) {
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
              tab: tabId,
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
  }

  // All violations are collected so output shows every offending selector
  expect(allViolations).toEqual([]);
});
