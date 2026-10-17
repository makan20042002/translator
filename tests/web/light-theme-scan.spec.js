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
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

const TABS = [
  { id: 'text', btnSelector: '#tabs button[data-tab="text"]', rootSelector: '#tab-text' },
  { id: 'sub', btnSelector: '#tabs button[data-tab="sub"]', rootSelector: '#tab-sub' },
  { id: 'voice', btnSelector: '#tabs button[data-tab="voice"]', rootSelector: '#tab-voice' },
  { id: 'screen', btnSelector: '#tabs button[data-tab="screen"]', rootSelector: '#tab-screen' }
];

test('light theme contrast scan across Text, Subtitle, Voice, and Screen tabs meets >= 4.5', async ({ app }) => {
  const { page } = app;

  await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

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

          const textRgb = window.__tc.parse(window.getComputedStyle(el).color);
          const bgInfo = window.__tc.effectiveBg(el);
          if (!textRgb || !bgInfo) continue;

          const bgCandidates = [];
          if (bgInfo.gradientStops && bgInfo.gradientStops.length > 0) {
            for (const s of bgInfo.gradientStops) {
              bgCandidates.push(s.a < 1 ? window.__tc.blend(s, bgInfo) : s);
            }
          } else {
            bgCandidates.push(bgInfo);
          }

          for (const cand of bgCandidates) {
            const ratio = window.__tc.ratio(textRgb, cand);
            if (ratio < 4.5) {
              violations.push({
                tab: tabId,
                theme: currentTheme,
                selector: getSelector(el),
                text: node.textContent.trim().slice(0, 30),
                color: window.getComputedStyle(el).color,
                bg: `rgb(${cand.r},${cand.g},${cand.b})`,
                contrast: Math.round(ratio * 100) / 100
              });
            }
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
