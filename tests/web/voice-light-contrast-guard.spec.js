'use strict';

/**
 * Item 5: Comprehensive guard test for light themes on the Voice tab
 * In Platinum Blue and Champagne Minimal:
 * - Opens Voice tab with two bubbles and talk button in "working" state.
 * - Asserts that no visible text element inside #tab-voice has contrast < 4.5
 *   against its effective background (skipping opacity 0, display none, aria-hidden, disabled).
 */

const { test, expect, mouseClick } = require('../support/fixtures');

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

test('guard: all visible text elements inside Voice tab meet contrast >= 4.5 in light themes', async ({ app }) => {
  const { page } = app;

  // Open Voice tab
  await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
  await page.waitForTimeout(60);

  for (const themeId of LIGHT_THEMES) {
    // Apply light theme
    await page.evaluate((id) => {
      if (typeof applyTheme === 'function') {
        applyTheme(id);
      } else {
        document.documentElement.setAttribute('data-theme', id);
      }
    }, themeId);
    await page.waitForTimeout(60);

    // Setup two bubbles and set #vPttBtn to "working" state
    await page.evaluate(() => {
      const container = document.getElementById('bubbles');
      container.innerHTML = '';
      addBubble(container, 'a', 'Good morning, can you translate this document for me?', 'صبح بخیر، آیا می‌توانید این سند را برای من ترجمه کنید؟', 'en', 'fa', {
        stt: 'Whisper',
        engine: 'Gemini',
        voice: 'David',
        dur: '1.5s'
      });
      addBubble(container, 'b', 'بله حتماً، متن را برای من بفرستید.', 'Yes certainly, please send me the text.', 'fa', 'en', {
        stt: 'Whisper',
        engine: 'Groq',
        voice: 'Zira',
        dur: '1.1s'
      });

      const btn = document.getElementById('vPttBtn');
      btn.dataset.state = 'working';
      const lbl = document.getElementById('vPttLabel');
      lbl.textContent = 'Translating...';

      const statusLine = document.getElementById('vStatusLine');
      if (statusLine) statusLine.dataset.state = 'working';
      const statusText = document.getElementById('vStatusText');
      if (statusText) statusText.textContent = 'Translating...';
    });
    await page.waitForTimeout(60);

    // Audit every visible text node inside #tab-voice
    const auditResults = await page.evaluate(() => {
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

      const root = document.getElementById('tab-voice');
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

      const tested = [];
      const violations = [];
      const seenElements = new Set();

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const el = node.parentElement;
        if (seenElements.has(el)) continue;
        seenElements.add(el);

        const textRgb = parseRgb(getComputedStyle(el).color);
        const bgRgb = computeEffectiveBg(el);
        const ratio = contrastRatio(textRgb, bgRgb);

        const item = {
          tag: el.tagName.toLowerCase(),
          className: el.className,
          text: node.textContent.trim().slice(0, 30),
          ratio: Math.round(ratio * 100) / 100
        };
        tested.push(item);

        if (ratio < 4.5) {
          violations.push(item);
        }
      }

      return { testedCount: tested.length, violations };
    });

    expect(auditResults.testedCount).toBeGreaterThan(15);
    expect(auditResults.violations).toEqual([]);
  }
});
