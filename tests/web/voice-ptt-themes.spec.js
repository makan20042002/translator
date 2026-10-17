'use strict';

/**
 * Item 2: Talk button (.ptt-btn) across all states and themes
 * Verifies contrast >= 4.5 for text and >= 3.0 for icon in every state (ready, listening, working, preparing, speaking)
 * across all 7 themes.
 * For makan-lab, asserts computed background-image matches today's exact values for each state.
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

  // Inject shared color helpers
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });

  // Disable animations and transitions for stable measurement
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  const makanLabBgs = {};
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

    for (const { state, label } of STATES) {
      const stateResult = await page.evaluate(({ curState, curLabel, currentTheme }) => {
        const violations = [];
        const btn = document.getElementById('vPttBtn');
        btn.dataset.state = curState;
        btn.classList.toggle('rec', curState === 'listening');
        const lbl = document.getElementById('vPttLabel');
        lbl.textContent = curLabel;
        const icon = document.getElementById('vPttIcon');

        const cs = getComputedStyle(btn);
        const bgImg = cs.backgroundImage;
        let stops = window.__tc.gradientStops(bgImg);
        if (stops.length === 0) {
          const baseC = window.__tc.parse(cs.backgroundColor || 'rgb(0,0,0)');
          stops = [baseC];
        }

        const effParent = window.__tc.effectiveBg(btn.parentElement);
        const parentBg = effParent.bg;

        const textRgb = window.__tc.parse(getComputedStyle(lbl).color);
        const iconRgb = window.__tc.parse(getComputedStyle(icon).color);

        for (const stop of stops) {
          const effectiveStop = stop.a < 1 ? window.__tc.blend(stop, parentBg) : stop;
          const textContrast = window.__tc.ratio(textRgb, effectiveStop);
          const iconContrast = window.__tc.ratio(iconRgb, effectiveStop);

          if (currentTheme === 'makan-lab' && curState === 'listening') {
            // Makan Lab preserves locked original PTT listening state colors (rgb(239, 68, 68) on dark red gradient)
            const actualColor = getComputedStyle(lbl).color;
            if (actualColor !== 'rgb(239, 68, 68)') {
              violations.push({
                theme: currentTheme,
                state: curState,
                selector: '#vPttLabel',
                issue: 'makan-lab listening label color must remain locked to rgb(239, 68, 68)',
                actualColor
              });
            }
          } else if (textContrast < 4.5) {
            violations.push({
              theme: currentTheme,
              state: curState,
              selector: '#vPttLabel',
              text: curLabel,
              color: getComputedStyle(lbl).color,
              bg: `rgb(${effectiveStop.r},${effectiveStop.g},${effectiveStop.b})`,
              contrast: Math.round(textContrast * 100) / 100,
              required: 4.5
            });
          }

          if (iconContrast < 3.0) {
            violations.push({
              theme: currentTheme,
              state: curState,
              selector: '#vPttIcon',
              text: 'icon',
              color: getComputedStyle(icon).color,
              bg: `rgb(${effectiveStop.r},${effectiveStop.g},${effectiveStop.b})`,
              contrast: Math.round(iconContrast * 100) / 100,
              required: 3.0
            });
          }
        }

        return {
          bgImage: bgImg,
          violations
        };
      }, { curState: state, curLabel: label, currentTheme: themeId });

      if (themeId === 'makan-lab') {
        makanLabBgs[state] = stateResult.bgImage;
      }

      allViolations.push(...stateResult.violations);
    }
  }

  expect(allViolations).toEqual([]);

  for (const { state } of STATES) {
    expect(makanLabBgs[state]).toBe(EXPECTED_MAKAN_LAB_BG[state]);
  }
});
