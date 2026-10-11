'use strict';
// Every tab opens without console errors, and the interface switches between
// English (left-to-right) and Persian (right-to-left).
const { test, expect, mouseClick } = require('../support/fixtures');

const TABS = [
  ['text', 'Text'], ['sub', 'Subtitle'], ['doc', 'Document'], ['voice', 'Voice'],
  ['cmp', 'Compare'], ['gls', 'Glossary'], ['hist', 'History']
];

test.describe('Web app: tabs', () => {
  test('every tab opens with a real mouse click and shows its panel, with no console errors', async ({ app }) => {
    const { page, errors } = app;
    for (const [id, label] of TABS) {
      const btn = page.locator(`#tabs button[data-tab="${id}"]`);
      await expect(btn).toHaveText(label);
      await mouseClick(page, btn);
      await expect(page.locator(`#tab-${id}`)).toBeVisible();
      await expect(btn).toHaveClass(/\bon\b/);
      // Only the chosen panel is visible.
      for (const [other] of TABS) if (other !== id) await expect(page.locator(`#tab-${other}`)).toBeHidden();
    }
    // The settings window opens and closes too.
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
    await mouseClick(page, page.locator('#closeSet'));
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);
    await page.waitForTimeout(800); // let late timers (service worker, key sync) run
    expect(errors, 'console errors while opening tabs').toEqual([]);
  });
});

test.describe('Web app: interface language', () => {
  test('every interface text the page uses exists in both English and Persian', async ({ app }) => {
    const { page } = app;
    const missing = await page.evaluate(async () => {
      const htmlSrc = await (await fetch('index.html')).text();
      const scriptUrls = Array.from(document.querySelectorAll('script[src]'))
        .map(s => s.getAttribute('src'))
        .filter(s => s && s.startsWith('js/'));
      let allSrc = htmlSrc;
      for (const s of scriptUrls) {
        allSrc += '\n' + await (await fetch(s)).text();
      }
      const used = new Set();
      for (const m of allSrc.matchAll(/data-tp?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
      for (const m of allSrc.matchAll(/\bL\('([A-Za-z0-9_]+)'\)/g)) used.add(m[1]);
      // I18N is the app's own table of interface texts.
      return { en: [...used].filter(k => !(k in I18N.en)), fa: [...used].filter(k => !(k in I18N.fa)) };
    });
    expect(missing, 'text keys with no English / Persian wording (the raw key name is shown instead)').toEqual({ en: [], fa: [] });
  });

  test('the Ask AI answer-language menu shows a readable first choice', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));
    await mouseClick(page, page.locator('#vTabAsk'));
    await expect(page.locator('#vAskLang option').first()).not.toHaveText('vAskLangAuto');
  });

  test('switches to Persian (right-to-left) and back to English (left-to-right); choice survives a reload', async ({ app }) => {
    const { page, errors } = app;
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#uiLang')).toHaveText('فارسی');

    await mouseClick(page, page.locator('#uiLang'));
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'fa');
    await expect(page.locator('#tabs button[data-tab="text"]')).toHaveText('متن');
    await expect(page.locator('#tabs button[data-tab="sub"]')).toHaveText('زیرنویس');
    await expect(page.locator('#openSet')).toHaveText('موتورها و کلیدها');
    await expect(page.locator('#uiLang')).toHaveText('English');
    // The page really lays out right-to-left: the first tab sits to the right of the second.
    const first = await page.locator('#tabs button[data-tab="text"]').boundingBox();
    const second = await page.locator('#tabs button[data-tab="sub"]').boundingBox();
    expect(first.x).toBeGreaterThan(second.x);

    await page.reload();
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#tabs button[data-tab="text"]')).toHaveText('متن');

    await mouseClick(page, page.locator('#uiLang'));
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(page.locator('#tabs button[data-tab="text"]')).toHaveText('Text');
    const a = await page.locator('#tabs button[data-tab="text"]').boundingBox();
    const b = await page.locator('#tabs button[data-tab="sub"]').boundingBox();
    expect(a.x).toBeLessThan(b.x);
    expect(errors).toEqual([]);
  });
});
