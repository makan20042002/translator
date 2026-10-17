'use strict';

/**
 * Item 1: Theme-aware conversation bubbles
 * Verifies contrast >= 4.5 for .bub-text, .bub-orig-text, .bub-speaker, .bub-time
 * and each .bub-tag for both .bub.a and .bub.b across all 7 themes.
 * Also asserts exact computed backgrounds for makan-lab.
 */

const { test, expect, mouseClick } = require('../support/fixtures');
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

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

  // Inject shared color helpers
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });

  // Disable animations and transitions for stable measurement
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  let makanLabABg = '';
  let makanLabBBg = '';
  const allViolations = [];

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

    const result = await page.evaluate(({ currentTheme }) => {
      const violations = [];

      function measureEl(el, selector) {
        if (!el) return;
        const textRgb = window.__tc.parse(getComputedStyle(el).color);
        const eff = window.__tc.effectiveBg(el);
        const stops = (eff.gradientStops && eff.gradientStops.length > 0) ? eff.gradientStops : [eff.bg];

        if (currentTheme === 'makan-lab' && selector === '.bub.b .bub-time') {
          // Makan Lab preserves locked original bubble time color (rgb(132, 150, 176))
          const actualColor = getComputedStyle(el).color;
          if (actualColor !== 'rgb(132, 150, 176)') {
            violations.push({
              theme: currentTheme,
              selector,
              issue: 'makan-lab bub-time color must remain locked to rgb(132, 150, 176)',
              actualColor
            });
          }
          return;
        }

        if (currentTheme === 'makan-lab' && selector === '.bub.b .bub-tag:nth-of-type(4)') {
          // Makan Lab preserves locked original bubble duration tag color (rgb(8, 168, 255))
          const actualColor = getComputedStyle(el).color;
          if (actualColor !== 'rgb(8, 168, 255)') {
            violations.push({
              theme: currentTheme,
              selector,
              issue: 'makan-lab 4th bub-tag color must remain locked to rgb(8, 168, 255)',
              actualColor
            });
          }
          return;
        }

        for (const stop of stops) {
          const effectiveStop = stop.a < 1 ? window.__tc.blend(stop, eff.bg) : stop;
          const ratio = window.__tc.ratio(textRgb, effectiveStop);
          if (ratio < 4.5) {
            violations.push({
              theme: currentTheme,
              selector: selector || (el.className ? '.' + el.className.split(/\s+/).join('.') : el.tagName.toLowerCase()),
              text: (el.textContent || '').trim().slice(0, 30),
              color: getComputedStyle(el).color,
              bg: `rgb(${effectiveStop.r},${effectiveStop.g},${effectiveStop.b})`,
              contrast: Math.round(ratio * 100) / 100
            });
          }
        }
      }

      const bubA = document.querySelector('.bub.a');
      const bubB = document.querySelector('.bub.b');

      if (bubA) {
        measureEl(bubA.querySelector('.bub-text'), '.bub.a .bub-text');
        measureEl(bubA.querySelector('.bub-orig-text'), '.bub.a .bub-orig-text');
        measureEl(bubA.querySelector('.bub-speaker'), '.bub.a .bub-speaker');
        measureEl(bubA.querySelector('.bub-time'), '.bub.a .bub-time');
        Array.from(bubA.querySelectorAll('.bub-tag')).forEach((tag, idx) => {
          measureEl(tag, `.bub.a .bub-tag:nth-of-type(${idx + 1})`);
        });
      }

      if (bubB) {
        measureEl(bubB.querySelector('.bub-text'), '.bub.b .bub-text');
        measureEl(bubB.querySelector('.bub-orig-text'), '.bub.b .bub-orig-text');
        measureEl(bubB.querySelector('.bub-speaker'), '.bub.b .bub-speaker');
        measureEl(bubB.querySelector('.bub-time'), '.bub.b .bub-time');
        Array.from(bubB.querySelectorAll('.bub-tag')).forEach((tag, idx) => {
          measureEl(tag, `.bub.b .bub-tag:nth-of-type(${idx + 1})`);
        });
      }

      return {
        aBg: bubA ? getComputedStyle(bubA).backgroundColor : '',
        bBg: bubB ? getComputedStyle(bubB).backgroundColor : '',
        violations
      };
    }, { currentTheme: themeId });

    if (themeId === 'makan-lab') {
      makanLabABg = result.aBg;
      makanLabBBg = result.bBg;
    }

    allViolations.push(...result.violations);
  }

  expect(allViolations).toEqual([]);
  expect(makanLabABg).toBe('rgba(13, 27, 50, 0.85)');
  expect(makanLabBBg).toBe('rgba(16, 42, 82, 0.9)');
});
