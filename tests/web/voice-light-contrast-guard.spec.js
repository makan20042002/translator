'use strict';

/**
 * Item 5: Comprehensive guard test for light themes on the Voice tab
 * In Platinum Blue and Champagne Minimal:
 * - Opens Voice tab with two bubbles and talk button in "working" state.
 * - Asserts that no visible text element inside #tab-voice has contrast < 4.5
 *   against its effective background (skipping opacity 0, display none, aria-hidden, disabled).
 */

const { test, expect, mouseClick } = require('../support/fixtures');
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

test('guard: all visible text elements inside Voice tab meet contrast >= 4.5 in light themes', async ({ app }) => {
  const { page } = app;

  // Open Voice tab
  await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
  await page.waitForTimeout(60);

  // Inject shared color helpers
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });

  // Disable animations and transitions for stable measurement
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  const allViolations = [];
  let totalTested = 0;

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
        dur: '0.9s'
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
    const auditResults = await page.evaluate(({ currentTheme }) => {
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

        const textRgb = window.__tc.parse(getComputedStyle(el).color);
        const eff = window.__tc.effectiveBg(el);
        const stops = (eff.gradientStops && eff.gradientStops.length > 0) ? eff.gradientStops : [eff.bg];

        let worstRatio = Infinity;
        let worstStop = eff.bg;

        for (const stop of stops) {
          const effectiveStop = stop.a < 1 ? window.__tc.blend(stop, eff.bg) : stop;
          const ratio = window.__tc.ratio(textRgb, effectiveStop);
          if (ratio < worstRatio) {
            worstRatio = ratio;
            worstStop = effectiveStop;
          }
        }

        const item = {
          theme: currentTheme,
          selector: el.className ? '.' + el.className.split(/\s+/).join('.') : el.tagName.toLowerCase(),
          text: node.textContent.trim().slice(0, 30),
          color: getComputedStyle(el).color,
          bg: `rgb(${worstStop.r},${worstStop.g},${worstStop.b})`,
          contrast: Math.round(worstRatio * 100) / 100
        };
        tested.push(item);

        if (worstRatio < 4.5) {
          violations.push(item);
        }
      }

      return { testedCount: tested.length, violations };
    }, { currentTheme: themeId });

    totalTested += auditResults.testedCount;
    allViolations.push(...auditResults.violations);
  }

  expect(totalTested).toBeGreaterThan(15);
  expect(allViolations).toEqual([]);
});
