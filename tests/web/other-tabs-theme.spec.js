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
const { COLOR_HELPERS_SOURCE } = require('../support/color-helpers');

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
                area: tabId,
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

    // 2. Scan Settings modal
    await mouseClick(page, page.locator('#openSet'));
    await page.waitForTimeout(60);

    const settingsScan = await page.evaluate(({ currentTheme }) => {
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
              area: 'settings-modal',
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
              area: 'welcome-wizard',
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
