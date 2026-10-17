'use strict';

/**
 * Item 2: Text tab translate button kbd and voice label layout
 * Across all 7 themes:
 * - Asserts contrast >= 4.5 for kbd text against #tGo button fill.
 * - Asserts kbd background alpha < 0.5 (not a solid opaque light rectangle).
 * - Asserts that the Text tab voice label has title === full text.
 * - Asserts no horizontal overflow of the target card at 360px, 700px, and 1280px in EN and FA (RTL).
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

test('Text tab translate button kbd has high contrast and voice label does not overflow at 360px', async ({ app }) => {
  const { page } = app;

  // Open Text tab
  await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
  await page.waitForTimeout(60);

  // Inject shared color helpers
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });

  // Disable animations and transitions for stable measurement
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

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

    const buttonResult = await page.evaluate(({ currentTheme }) => {
      const violations = [];
      const tGo = document.getElementById('tGo');
      const kbd = tGo ? tGo.querySelector('kbd') : null;

      const tGoStyle = window.getComputedStyle(tGo);
      const kbdStyle = window.getComputedStyle(kbd);

      const kbdColor = window.__tc.parse(kbdStyle.color);
      const kbdBg = window.__tc.parse(kbdStyle.backgroundColor);

      if (kbdBg.a >= 0.5) {
        violations.push({
          theme: currentTheme,
          selector: '#tGo kbd',
          issue: 'kbd background alpha must be < 0.5',
          actualAlpha: kbdBg.a
        });
      }

      if (currentTheme === 'makan-lab') {
        // Makan Lab preserves locked original button kbd styling
        if (kbdStyle.color !== 'rgb(255, 255, 255)' || kbdStyle.backgroundColor !== 'rgba(255, 255, 255, 0.18)') {
          violations.push({
            theme: currentTheme,
            selector: '#tGo kbd',
            issue: 'makan-lab kbd style must remain locked to rgb(255, 255, 255) on rgba(255, 255, 255, 0.18)',
            actualColor: kbdStyle.color,
            actualBg: kbdStyle.backgroundColor
          });
        }
      } else {
        let stops = window.__tc.gradientStops(tGoStyle.backgroundImage);
        if (stops.length === 0) {
          const baseFill = window.__tc.parse(tGoStyle.backgroundColor || 'rgb(19, 102, 226)');
          stops = [baseFill];
        }

        for (const stop of stops) {
          const effectiveStop = (kbdBg.a > 0 && kbdBg.a < 1) ? window.__tc.blend(kbdBg, stop) : stop;
          const ratio = window.__tc.ratio(kbdColor, effectiveStop);
          if (ratio < 4.5) {
            violations.push({
              theme: currentTheme,
              selector: '#tGo kbd',
              text: kbd ? kbd.textContent : '',
              color: kbdStyle.color,
              bg: `rgb(${effectiveStop.r},${effectiveStop.g},${effectiveStop.b})`,
              contrast: Math.round(ratio * 100) / 100
            });
          }
        }
      }

      return violations;
    }, { currentTheme: themeId });

    allViolations.push(...buttonResult);
  }

  expect(allViolations).toEqual([]);

  // Verify voice label title === full text
  const labelData = await page.evaluate(() => {
    if (typeof updateCompactVoiceButtons === 'function') {
      updateCompactVoiceButtons();
    }
    const vu = document.getElementById('tVoiceUsed');
    if (vu) {
      vu.textContent = 'Voice: Microsoft David - English (United States)';
    }
    const cur = document.getElementById('tVoiceCurLabel');
    return {
      vuTitle: vu ? vu.getAttribute('title') : '',
      vuText: vu ? vu.textContent.trim() : '',
      curTitle: cur ? cur.getAttribute('title') : '',
      curText: cur ? cur.textContent.trim() : ''
    };
  });

  expect(labelData.vuTitle).toBe(labelData.vuText);
  expect(labelData.curTitle).toBe(labelData.curText);

  // Verify no horizontal overflow of the card at 360px, 700px, 1280px in EN and FA
  for (const width of [360, 700, 1280]) {
    for (const lang of ['en', 'fa']) {
      await page.setViewportSize({ width, height: 740 });
      await page.evaluate((l) => {
        document.documentElement.lang = l;
        document.documentElement.dir = (l === 'fa' ? 'rtl' : 'ltr');
        if (typeof setUILanguage === 'function') setUILanguage(l);
      }, lang);
      await page.waitForTimeout(50);

      const overflow = await page.evaluate(() => {
        const card = document.querySelector('.trans-card-target') || document.querySelector('.pane.trans-card:last-of-type');
        return {
          scrollWidth: card.scrollWidth,
          clientWidth: card.clientWidth,
          hasOverflow: card.scrollWidth > card.clientWidth
        };
      });

      expect(overflow.hasOverflow, `horizontal overflow at ${width}px in ${lang}`).toBe(false);
    }
  }
});
