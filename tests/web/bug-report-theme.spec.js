'use strict';

/**
 * tests/web/bug-report-theme.spec.js
 * Validates theme integration, makan-lab locked values, and WCAG contrast (>= 4.5)
 * for the Bug Report dialog across themes (ITEM 1).
 */

const { test, expect, mouseClick } = require('../support/fixtures');
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');
const fs = require('fs');
const path = require('path');

const ORIGINAL_LOOK_PATH = path.resolve(__dirname, '../support/original-look.json');
const originalLook = JSON.parse(fs.readFileSync(ORIGINAL_LOOK_PATH, 'utf8'));

const ALL_7_THEMES = [
  'makan-lab',
  'platinum-blue',
  'dracula',
  'champagne-minimal',
  'rose-titanium',
  'royal-amethyst',
  'obsidian-gold'
];

const LIGHT_THEMES = ['platinum-blue', 'champagne-minimal'];

test.describe('Bug Report Dialog: Theme & Contrast Invariants', () => {

  test('makan-lab default theme locked values are preserved on the bug report dialog', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#creditsBtn'));
    await mouseClick(page, page.locator('#aboutBugReportBtn'));

    const modal = page.locator('#bugReportModal');
    await expect(modal).toBeVisible();

    // Verify root theme is makan-lab
    const rootTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(rootTheme).toBe('makan-lab');

    // Verify computed colors on the dialog match the locked makan-lab tokens
    const styles = await page.evaluate(() => {
      const modalEl = document.getElementById('bugReportModal');
      const cs = window.getComputedStyle(modalEl);
      const titleEl = document.getElementById('bugReportTitle');
      const titleCs = window.getComputedStyle(titleEl);
      const ctaBtn = document.getElementById('bugSendEmail');
      const ctaCs = window.getComputedStyle(ctaBtn);

      return {
        textColor: cs.color,
        titleColor: titleCs.color,
        ctaBg: ctaCs.backgroundColor
      };
    });

    // #F1F5F9 in rgb is rgb(241, 245, 249)
    expect(styles.textColor).toBe('rgb(241, 245, 249)');
    expect(styles.titleColor).toBe('rgb(241, 245, 249)');

    await page.keyboard.press('Escape');
    await mouseClick(page, page.locator('#creditsClose'));
  });

  test('bug report dialog elements meet WCAG contrast ratio >= 4.5 in all light themes', async ({ app }) => {
    const { page } = app;

    await page.addInitScript({ content: COLOR_HELPERS_SOURCE });
    await page.addScriptTag({ content: COLOR_HELPERS_SOURCE });
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });

    const allViolations = [];

    for (const themeId of LIGHT_THEMES) {
      // Apply theme
      await page.evaluate((id) => {
        if (typeof applyTheme === 'function') {
          applyTheme(id);
        } else {
          document.documentElement.setAttribute('data-theme', id);
        }
      }, themeId);
      await page.waitForTimeout(60);

      // Open dialog
      await mouseClick(page, page.locator('#creditsBtn'));
      await mouseClick(page, page.locator('#aboutBugReportBtn'));

      const scanResult = await page.evaluate(({ currentTheme }) => {
        const root = document.getElementById('bugReportModal');
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
                if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
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

          const textRgb = window.__tc.parse(window.getComputedStyle(el).color);
          const bgInfo = window.__tc.effectiveBg(el);
          if (!textRgb || !bgInfo) continue;

          const ratio = window.__tc.ratio(textRgb, bgInfo);
          if (ratio < 4.5) {
            violations.push({
              theme: currentTheme,
              selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
              text: node.textContent.trim().slice(0, 30),
              color: window.getComputedStyle(el).color,
              contrast: Math.round(ratio * 100) / 100
            });
          }
        }

        return violations;
      }, { currentTheme: themeId });

      allViolations.push(...scanResult);

      await page.keyboard.press('Escape');
      await mouseClick(page, page.locator('#creditsClose'));
      await page.waitForTimeout(40);
    }

    expect(allViolations).toEqual([]);
  });

  test('bug report dialog renders properly across all 7 themes', async ({ app }) => {
    const { page } = app;

    for (const themeId of ALL_7_THEMES) {
      await page.evaluate((id) => {
        if (typeof applyTheme === 'function') {
          applyTheme(id);
        } else {
          document.documentElement.setAttribute('data-theme', id);
        }
      }, themeId);

      await mouseClick(page, page.locator('#creditsBtn'));
      await mouseClick(page, page.locator('#aboutBugReportBtn'));

      const modal = page.locator('#bugReportModal');
      await expect(modal).toBeVisible();

      await expect(page.locator('#bugReportTitle')).toBeVisible();
      await expect(page.locator('#bugWhatHappened')).toBeVisible();
      await expect(page.locator('#bugWhatExpected')).toBeVisible();
      await expect(page.locator('#bugDiagPreview')).toBeVisible();
      await expect(page.locator('#bugSendEmail')).toBeVisible();
      await expect(page.locator('#bugCopyReport')).toBeVisible();

      await page.keyboard.press('Escape');
      await mouseClick(page, page.locator('#creditsClose'));
    }
  });

});
