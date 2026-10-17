'use strict';

/**
 * Item 1: Theme-aware subtitle cards
 * Verifies contrast >= 4.5 for visible text elements of both cards (.sub-entry-card-drop and .sub-entry-card-video)
 * across all 7 themes against effective background (ancestor blending and gradient color stops).
 * Also asserts exact computed background-image of .sub-entry-card-drop for makan-lab.
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

test('subtitle entry cards meet contrast >= 4.5 across all 7 themes and preserve makan-lab values', async ({ app }) => {
  const { page } = app;

  await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
  await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  // Open Subtitle tab
  await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
  await page.waitForTimeout(60);

  let makanLabDropBgImage = '';
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

    const themeResult = await page.evaluate(({ currentTheme }) => {
      const violations = [];

      function checkEl(el, name) {
        if (!el) return;
        const textRgb = window.__tc.parse(window.getComputedStyle(el).color);
        const bgInfo = window.__tc.effectiveBg(el);
        const stops = bgInfo.gradientStops && bgInfo.gradientStops.length > 0
          ? bgInfo.gradientStops
          : [bgInfo];
        for (const stop of stops) {
          const cand = stop.a < 1 ? window.__tc.blend(stop, bgInfo) : stop;
          const ratio = window.__tc.ratio(textRgb, cand);
          if (ratio < 4.5) {
            violations.push({
              theme: currentTheme,
              selector: name,
              text: el.textContent.trim().slice(0, 30),
              color: window.getComputedStyle(el).color,
              bg: `rgb(${cand.r},${cand.g},${cand.b})`,
              contrast: Math.round(ratio * 100) / 100
            });
          }
        }
      }

      const dropCard = document.querySelector('.sub-entry-card-drop');
      const videoCard = document.querySelector('.sub-entry-card-video');

      const dropTitle = dropCard ? dropCard.querySelector('strong') : null;
      const dropHint = dropCard ? dropCard.querySelector('.hint') : null;
      const dropChips = dropCard ? Array.from(dropCard.querySelectorAll('.sub-chip')) : [];

      const videoTitle = videoCard ? videoCard.querySelector('strong') : null;
      const videoNote = videoCard ? videoCard.querySelector('.sub-video-note') : null;
      const videoBadge = videoCard ? videoCard.querySelector('.sub-coming-soon-badge') : null;

      checkEl(dropTitle, '.sub-entry-card-drop strong');
      checkEl(dropHint, '.sub-entry-card-drop .hint');
      dropChips.forEach((chip, i) => checkEl(chip, `.sub-entry-card-drop .sub-chip[${i}]`));

      checkEl(videoTitle, '.sub-entry-card-video strong');
      checkEl(videoNote, '.sub-entry-card-video .sub-video-note');
      checkEl(videoBadge, '.sub-entry-card-video .sub-coming-soon-badge');

      return {
        dropBgImage: dropCard ? window.getComputedStyle(dropCard).backgroundImage : '',
        violations
      };
    }, { currentTheme: themeId });

    if (themeId === 'makan-lab') {
      makanLabDropBgImage = themeResult.dropBgImage;
    }

    allViolations.push(...themeResult.violations);
  }

  // Assert computed background-image for makan-lab matches today's exact gradient
  expect(makanLabDropBgImage).toContain('radial-gradient');
  expect(makanLabDropBgImage).toContain('rgba(14, 165, 233, 0.08)');
  expect(makanLabDropBgImage).toContain('rgba(9, 20, 40, 0.95)');

  expect(allViolations).toEqual([]);
});
