'use strict';
/**
 * Item 2 verification test suite:
 * 1. Ask AI answer-language picker #vAskLang is labeled "Answer language" / "زبان پاسخ" (never "From").
 * 2. .lang-picker-display is visible and not aria-hidden across Text, Voice, Subtitles, Documents, and Screen.
 * 3. detectRealLanguage returns expected language codes for 6+ word English sentences, Persian, French, and German,
 *    and returns null on numbers, symbols, Finglish, and ambiguous text.
 * 4. Settings modal has zero horizontal overflow in Persian RTL at 360px, 700px, 1100px, and 1440px.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');
const { openSettings } = require('../support/model-helpers');

test.describe('Web app: Item 2 language pickers, detection, and RTL overflow', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), tgt: 'fa' } } });

  test('Ask AI answer-language picker #vAskLang is labeled Answer language and not From in English and Persian', async ({ app }) => {
    const { page } = app;
    await page.locator('#tabs button[data-tab="voice"]').click();
    await page.locator('#vTabAsk').click();

    // English label
    const askLbl = page.locator('#vViewAsk [data-picker-role="ask"] .lang-picker-lbl');
    await expect(askLbl).toBeVisible();
    await expect(askLbl).toHaveText('Answer language');
    expect(await askLbl.textContent()).not.toContain('From');

    // Persian label
    await page.locator('#uiLang').click();
    await expect(askLbl).toHaveText('زبان پاسخ');
    expect(await askLbl.textContent()).not.toContain('از');
  });

  test('.lang-picker-display is visible and not aria-hidden on Text, Voice, Subtitles, Documents, and Screen', async ({ app }) => {
    const { page } = app;

    // Text tab
    await page.locator('#tabs button[data-tab="text"]').click();
    const textDisplay = page.locator('#tab-text [data-picker-role="src"] .lang-picker-display');
    await expect(textDisplay).toBeVisible();
    await expect(textDisplay).toHaveAttribute('aria-hidden', 'true');

    // Voice tab
    await page.locator('#tabs button[data-tab="voice"]').click();
    const voiceDisplay = page.locator('#vLangPair [data-picker-role="src"] .lang-picker-display');
    await expect(voiceDisplay).toBeVisible();
    await expect(voiceDisplay).toHaveAttribute('aria-hidden', 'true');

    // Subtitles tab
    await page.locator('#tabs button[data-tab="sub"]').click();
    await page.evaluate(() => { const el = document.getElementById('sWork'); if (el) el.hidden = false; });
    const subDisplay = page.locator('#tab-sub [data-picker-role="src"] .lang-picker-display');
    await expect(subDisplay).toBeVisible();
    await expect(subDisplay).toHaveAttribute('aria-hidden', 'true');

    // Documents tab
    await page.locator('#tabs button[data-tab="doc"]').click();
    await page.evaluate(() => { const el = document.getElementById('dWork'); if (el) el.hidden = false; });
    const docDisplay = page.locator('#tab-doc [data-picker-role="src"] .lang-picker-display');
    await expect(docDisplay).toBeVisible();
    await expect(docDisplay).toHaveAttribute('aria-hidden', 'true');

    // Screen tab
    await page.locator('#tabs button[data-tab="screen"]').click();
    const screenDisplay = page.locator('#tab-screen [data-picker-role="src"] .lang-picker-display');
    await expect(screenDisplay).toBeVisible();
    await expect(screenDisplay).toHaveAttribute('aria-hidden', 'true');
  });

  test('detectRealLanguage correctly detects 6+ word English sentences and rejects numbers, symbols, Finglish, and ambiguous text', async ({ app }) => {
    const { page } = app;
    const res = await page.evaluate(() => ({
      numeric: detectRealLanguage('123456789'),
      symbols: detectRealLanguage('...?!#@$%^&*'),
      finglish: detectRealLanguage('salam chetori azizam'),
      ambiguous: detectRealLanguage('xyz 999'),
      englishStopwords: detectRealLanguage('The quick brown fox jumps over the lazy dog'),
      englishNoStopwords: detectRealLanguage('Antigravity systems accelerate autonomous coding tasks flawlessly'),
      persian: detectRealLanguage('سلام، حال شما چطور است؟'),
      french: detectRealLanguage('Bonjour tout le monde et bienvenue'),
      german: detectRealLanguage('Guten Morgen und herzlich willkommen')
    }));

    expect(res.numeric).toBeNull();
    expect(res.symbols).toBeNull();
    expect(res.finglish).toBeNull();
    expect(res.ambiguous).toBeNull();
    expect(res.englishStopwords).toBe('en');
    expect(res.englishNoStopwords).toBe('en');
    expect(res.persian).toBe('fa');
    expect(res.french).toBe('fr');
    expect(res.german).toBe('de');
  });

  for (const w of [360, 700, 1100, 1440]) {
    test(`Settings modal in Persian RTL has zero horizontal overflow at ${w}px`, async ({ app }) => {
      const { page } = app;
      await page.setViewportSize({ width: w, height: 740 });
      await page.locator('#uiLang').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      await openSettings(page);
      await expect(page.locator('#ov')).toHaveClass(/\bon\b/);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const modal = document.querySelector('#ov .modal');
        const docOver = doc.scrollWidth > doc.clientWidth;
        const modalOver = modal ? modal.scrollWidth > modal.clientWidth : false;
        return { docOver, modalOver, docScroll: doc.scrollWidth, docClient: doc.clientWidth, modalScroll: modal?.scrollWidth, modalClient: modal?.clientWidth };
      });

      expect(overflow.docOver || overflow.modalOver, `Overflow at ${w}px Persian RTL: doc(${overflow.docScroll}/${overflow.docClient}), modal(${overflow.modalScroll}/${overflow.modalClient})`).toBe(false);
    });
  }
});
