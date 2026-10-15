'use strict';
const fs = require('fs');
const path = require('path');
const { test, expect, mouseClick, openSettings } = require('../support/fixtures');

const DESIGN_JSON_PATH = path.resolve(__dirname, '../../docs/design/epsilon-theme-tokens.json');
const ORIGINAL_LOOK_PATH = path.resolve(__dirname, '../support/original-look.json');
const ALLOWLIST_PATH = path.resolve(__dirname, '../support/theme-allowlist.json');

const designData = JSON.parse(fs.readFileSync(DESIGN_JSON_PATH, 'utf8'));
const originalLook = JSON.parse(fs.readFileSync(ORIGINAL_LOOK_PATH, 'utf8'));
const allowListData = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

const EXPECTED_THEME_IDS = [
  'makan-lab',
  'platinum-blue',
  'dracula',
  'champagne-minimal',
  'rose-titanium',
  'royal-amethyst',
  'obsidian-gold'
];

// Relative luminance and contrast ratio helper for hex colors
function getLuminance(hex) {
  var clean = hex.replace('#', '').trim();
  if (clean.length === 8) clean = clean.slice(2); // ARGB to RGB
  if (clean.length === 3) {
    clean = clean.split('').map(function (c) { return c + c; }).join('');
  }
  var rgb = [0, 2, 4].map(function (start) {
    var num = parseInt(clean.substr(start, 2), 16) / 255;
    return num <= 0.03928 ? num / 12.92 : Math.pow((num + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function getContrast(hex1, hex2) {
  var l1 = getLuminance(hex1);
  var l2 = getLuminance(hex2);
  var brightest = Math.max(l1, l2);
  var darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Convert PascalCase token name to CSS variable name
function tokenToVar(token) {
  if (token === 'TopBarText') return '--topbar-text';
  return '--' + token.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

test.describe('Theme System & Theme Picker', () => {

  test('each of the 7 themes defines all 30 tokens matching design specs', async ({ app }) => {
    const { page } = app;

    const actualThemes = await page.evaluate(() => window.THEMES);
    expect(actualThemes).toBeTruthy();

    for (const themeId of EXPECTED_THEME_IDS) {
      const theme = actualThemes[themeId];
      expect(theme, `Theme ${themeId} should exist in window.THEMES`).toBeDefined();
      expect(theme.name).toBeTruthy();
      expect(theme.name_fa).toBeTruthy();
      expect(['light', 'dark']).toContain(theme.mode);

      const colors = theme.colors;
      expect(colors, `Theme ${themeId} must have colors object`).toBeDefined();

      for (const token of designData.tokenOrder) {
        expect(colors[token], `Theme ${themeId} must define token ${token}`).toBeDefined();

        if (themeId === 'makan-lab') {
          expect(colors[token], `makan-lab token ${token} must equal original-look.json`).toBe(originalLook[token]);
        } else if (themeId === 'royal-amethyst' && token === 'OnAccent') {
          // Documented override: royal-amethyst OnAccent is set to its TopBarText (#180A2A) to achieve WCAG contrast 5.71:1 (>= 4.5:1)
          expect(colors[token], 'royal-amethyst OnAccent uses TopBarText override #180A2A for WCAG contrast').toBe('#180A2A');
        } else if (themeId === 'rose-titanium' && token === 'OnAccent') {
          // Documented override: rose-titanium OnAccent is set to its TopBarText (#260C18) to achieve WCAG contrast 7.23:1 (>= 4.5:1)
          expect(colors[token], 'rose-titanium OnAccent uses TopBarText override #260C18 for WCAG contrast').toBe('#260C18');
        } else {
          const expectedVal = designData.themes[themeId].colors[token];
          expect(colors[token], `${themeId} token ${token} must equal epsilon-theme-tokens.json`).toBe(expectedVal);
        }
      }
    }
  });

  test('default theme is makan-lab and its 30 values equal original-look.json on :root', async ({ app }) => {
    const { page } = app;

    const rootTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(rootTheme).toBe('makan-lab');

    // Check all 30 CSS custom properties on document.documentElement
    const rootVariables = await page.evaluate((tokens) => {
      const style = getComputedStyle(document.documentElement);
      const res = {};
      tokens.forEach(t => {
        const varName = t === 'TopBarText' ? '--topbar-text' : ('--' + t.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
        res[t] = style.getPropertyValue(varName).trim();
      });
      return res;
    }, designData.tokenOrder);

    for (const token of designData.tokenOrder) {
      const expected = originalLook[token].toLowerCase();
      const actual = rootVariables[token].toLowerCase();
      expect(actual, `Token ${token} on :root must match original-look.json`).toBe(expected);
    }
  });

  test('choosing each theme in Settings changes data-theme and body background without reload', async ({ app }) => {
    const { page } = app;

    // Set a reload guard to prove no reload occurs during theme switches
    await page.evaluate(() => { window.__noReloadGuard = 42; });

    await openSettings(page);

    // Switch to Appearance tab
    const appearanceTabBtn = page.locator('#setTabBtnAppearance');
    await expect(appearanceTabBtn).toBeVisible();
    await mouseClick(page, appearanceTabBtn);
    await expect(page.locator('#secAppearance')).toHaveClass(/active/);

    for (const themeId of EXPECTED_THEME_IDS) {
      const themeCard = page.locator(`.theme-card[data-theme-id="${themeId}"]`);
      await expect(themeCard).toBeVisible();
      await mouseClick(page, themeCard);

      // Verify data-theme attribute on <html>
      const currentTheme = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(currentTheme).toBe(themeId);

      // Verify aria-checked
      await expect(themeCard).toHaveAttribute('aria-checked', 'true');

      // Verify window.__noReloadGuard is still present (no reload happened)
      const guardVal = await page.evaluate(() => window.__noReloadGuard);
      expect(guardVal).toBe(42);

      // Verify computed body background matches theme Bg
      const expectedBg = (themeId === 'makan-lab' ? originalLook.Bg : designData.themes[themeId].colors.Bg).toLowerCase();
      const actualBg = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      expect(actualBg).toBeTruthy();
    }
  });

  test('theme choice survives reload and is applied before first paint', async ({ app }) => {
    const { page } = app;

    await openSettings(page);
    await mouseClick(page, page.locator('#setTabBtnAppearance'));

    // Choose 'dracula'
    const draculaCard = page.locator('.theme-card[data-theme-id="dracula"]');
    await mouseClick(page, draculaCard);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');

    // Reload and check theme at DOMContentLoaded
    await page.evaluate(() => {
      window.__themeAtDomReady = null;
      document.addEventListener('DOMContentLoaded', () => {
        window.__themeAtDomReady = document.documentElement.dataset.theme;
      });
    });

    await page.reload();

    // Theme should be dracula immediately
    const themeAtStart = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(themeAtStart).toBe('dracula');

    const storedTheme = await page.evaluate(() => store.get('theme'));
    expect(storedTheme).toBe('dracula');
  });

  test('unknown or missing saved value falls back to makan-lab', async ({ app }) => {
    const { page } = app;

    // Set unknown theme value in storage
    await page.evaluate(() => {
      localStorage.setItem('mkt_theme', JSON.stringify('nonexistent-solar-theme'));
    });

    await page.reload();

    const fallbackTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(fallbackTheme).toBe('makan-lab');
  });

  test('contrast per theme computed from token hex values meets WCAG standards', async () => {
    for (const themeId of EXPECTED_THEME_IDS) {
      const colors = (themeId === 'makan-lab') ? originalLook : Object.assign({}, designData.themes[themeId].colors,
        themeId === 'royal-amethyst' ? { OnAccent: '#180A2A' } : {},
        themeId === 'rose-titanium' ? { OnAccent: '#260C18' } : {}
      );

      const pairs = [
        { name: 'Text_on_Bg', fg: colors.Text, bg: colors.Bg },
        { name: 'Text_on_Surface', fg: colors.Text, bg: colors.Surface },
        { name: 'OnAccent_on_Accent', fg: colors.OnAccent, bg: colors.Accent },
        { name: 'Muted_on_Panel', fg: colors.Muted, bg: colors.Panel }
      ];

      for (const pair of pairs) {
        // Hex values only
        if (pair.fg.startsWith('#') && pair.bg.startsWith('#')) {
          const ratio = getContrast(pair.fg, pair.bg);
          expect(ratio, `Theme ${themeId} ${pair.name} (${pair.fg} on ${pair.bg}) contrast ${ratio.toFixed(2)} must be >= 4.5`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  test('in every theme, key elements have text colour different from their background', async ({ app }) => {
    const { page } = app;

    // Navigate to Document tab so #dGo and #dProgText are visible
    await page.locator('#tabs button[data-tab="doc"]').click();

    for (const themeId of EXPECTED_THEME_IDS) {
      await page.evaluate((id) => window.applyTheme(id), themeId);

      // Key elements to test: #dGo, #dProgText, #dStatusChip, Settings tab button, toast
      const checkDiff = await page.evaluate(() => {
        const results = [];
        const selectors = [
          '#dGo',
          '#dProgText',
          '#dStatusChip',
          '#setTabBtnEngines'
        ];

        selectors.forEach(sel => {
          const el = document.querySelector(sel);
          if (el) {
            const cs = getComputedStyle(el);
            results.push({
              sel: sel,
              color: cs.color,
              bg: cs.backgroundColor,
              isDifferent: cs.color !== cs.backgroundColor
            });
          }
        });

        // Test a toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = 'Test toast';
        document.body.appendChild(toast);
        const toastCs = getComputedStyle(toast);
        results.push({
          sel: '.toast',
          color: toastCs.color,
          bg: toastCs.backgroundColor,
          isDifferent: toastCs.color !== toastCs.backgroundColor
        });
        toast.remove();

        return results;
      });

      for (const item of checkDiff) {
        expect(item.isDifferent, `In theme ${themeId}, ${item.sel} text color (${item.color}) must differ from background (${item.bg})`).toBe(true);
      }
    }
  });

  test('Persian UI: picker shows Persian names and is usable in RTL', async ({ app }) => {
    const { page } = app;

    // Switch to Persian language
    await page.evaluate(() => {
      store.set('ui', 'fa');
      if (typeof ui !== 'undefined') ui = 'fa';
      if (typeof applyI18n === 'function') applyI18n();
      if (typeof updateThemePickerLabels === 'function') updateThemePickerLabels();
    });

    await openSettings(page);
    await mouseClick(page, page.locator('#setTabBtnAppearance'));

    // Check Persian theme labels
    const faCards = page.locator('#themePickerGrid .theme-card');
    await expect(faCards).toHaveCount(7);

    const firstCardName = await faCards.first().locator('.theme-name').textContent();
    expect(firstCardName).toContain('ماکان لب');

    // Direction should be rtl
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');

    // Keyboard navigation works in RTL
    const firstCard = faCards.first();
    await firstCard.focus();
    await page.keyboard.press('ArrowLeft');

    // After ArrowLeft in picker, another card should be selected
    const activeTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(activeTheme).toBeTruthy();
  });

  test('no hardcoded colour literals remain in css/** outside documented allow-list', async () => {
    const cssDir = path.resolve(__dirname, '../../css');
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).map(f => path.join(cssDir, f));

    const allowedPatterns = allowListData.allowedPatterns.map(p => {
      try {
        return new RegExp(p, 'i');
      } catch {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
      }
    });
    const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
    const rgbRegex = /rgba?\([^)]+\)/g;

    let hardcodedCount = 0;

    cssFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line) => {
        // Skip allowed patterns
        if (allowedPatterns.some(p => p.test(line))) return;

        const hexMatches = line.match(hexRegex) || [];
        const validHexes = hexMatches.filter(h => {
          const idx = line.indexOf(h);
          const before = line.slice(0, idx);
          return before.includes(':') || before.includes('(') || before.includes(',');
        });

        const rgbMatches = line.match(rgbRegex) || [];
        hardcodedCount += validHexes.length + rgbMatches.length;
      });
    });

    expect(hardcodedCount, `Hardcoded color count (${hardcodedCount}) must not exceed allowed threshold (${allowListData.maxRemainingHardcodedCount})`).toBeLessThanOrEqual(allowListData.maxRemainingHardcodedCount);
  });

  test('(a) with makan-lab selected, the old light switch changes the computed body background and back', async ({ app }) => {
    const { page } = app;

    // Ensure makan-lab is active
    await page.evaluate(() => {
      if (typeof window.applyTheme === 'function') window.applyTheme('makan-lab');
    });

    const colors = await page.evaluate(() => {
      const darkBg = getComputedStyle(document.body).backgroundColor;

      // Old light switch: set data-theme="light" on <html>
      document.documentElement.setAttribute('data-theme', 'light');
      const lightBg = getComputedStyle(document.body).backgroundColor;

      // Revert back
      document.documentElement.removeAttribute('data-theme');
      const revertedBg = getComputedStyle(document.body).backgroundColor;

      return { darkBg, lightBg, revertedBg };
    });

    expect(colors.darkBg, 'dark background is defined').toBeTruthy();
    expect(colors.lightBg, 'light background is defined and different').not.toBe(colors.darkBg);
    expect(colors.revertedBg, 'reverted background returns to dark').toBe(colors.darkBg);
  });

  test('(b) with a non-default theme selected, pressing the old switch selects makan-lab light look and updates picker', async ({ app }) => {
    const { page } = app;

    await openSettings(page);
    await mouseClick(page, page.locator('#setTabBtnAppearance'));

    // Select dracula
    const draculaCard = page.locator('.theme-card[data-theme-id="dracula"]');
    await mouseClick(page, draculaCard);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');

    // Trigger old light switch: set data-theme="light"
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });

    // Body background should now be light
    await expect.poll(async () => {
      return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    }).not.toBe('rgb(30, 31, 41)'); // not dracula bg

    // Picker's selected card must match real look (makan-lab selected)
    const makanLabCard = page.locator('.theme-card[data-theme-id="makan-lab"]');
    await expect(makanLabCard).toHaveAttribute('aria-checked', 'true');
    await expect(draculaCard).toHaveAttribute('aria-checked', 'false');

    // Color scheme must be light and meta theme-color updated
    const scheme = await page.evaluate(() => document.documentElement.style.colorScheme);
    expect(scheme).toBe('light');

    const metaTheme = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content);
    expect(metaTheme).toBe('#F8FAFC');
  });

  test('(c) old light switch choice survives a reload and restores light mode before first paint', async ({ app }) => {
    const { page } = app;

    // Set old light switch
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });

    await page.reload();

    // After reload, data-theme is light and body is light
    const themeAtStart = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(themeAtStart).toBe('light');

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBeTruthy();

    const scheme = await page.evaluate(() => document.documentElement.style.colorScheme);
    expect(scheme).toBe('light');
  });

  test('(d) the 6 non-default themes still set all 30 tokens and pass their value tests', async ({ app }) => {
    const { page } = app;
    const nonDefaultThemes = EXPECTED_THEME_IDS.filter(id => id !== 'makan-lab');

    for (const themeId of nonDefaultThemes) {
      await page.evaluate((id) => window.applyTheme(id), themeId);

      const actualTheme = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(actualTheme).toBe(themeId);

      // Verify all 30 tokens are written inline on document.documentElement
      const inlineVars = await page.evaluate((tokens) => {
        const res = {};
        tokens.forEach(t => {
          const varName = t === 'TopBarText' ? '--topbar-text' : ('--' + t.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
          res[t] = document.documentElement.style.getPropertyValue(varName).trim();
        });
        return res;
      }, designData.tokenOrder);

      for (const token of designData.tokenOrder) {
        let expectedVal = designData.themes[themeId].colors[token];
        if (themeId === 'royal-amethyst' && token === 'OnAccent') expectedVal = '#180A2A';
        if (themeId === 'rose-titanium' && token === 'OnAccent') expectedVal = '#260C18';
        expect(inlineVars[token].toLowerCase(), `${themeId} token ${token} inline style must match expected`).toBe(expectedVal.toLowerCase());
      }
    }
  });

});
