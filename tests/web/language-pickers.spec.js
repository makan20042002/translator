'use strict';
const { test, expect } = require('../support/fixtures');

test.describe('Item 2: Unified Language Pickers Everywhere', () => {

  test('Text page: labels exist, selected value is visible with Persian + <bdi> English, detected appears only on real detection', async ({ app }) => {
    const { page } = app;
    await page.locator('#tabs button[data-tab="text"]').click();

    // 1. Labels exist for From and To
    const fromLbl = page.locator('#tab-text [data-picker-role="src"] .lang-picker-lbl');
    const toLbl = page.locator('#tab-text [data-picker-role="tgt"] .lang-picker-lbl');
    await expect(fromLbl).toBeVisible();
    await expect(toLbl).toBeVisible();

    // 2. Selected language is visible inside the box (Persian name + English in <bdi>)
    const srcDisplay = page.locator('#tab-text [data-picker-role="src"] .lang-picker-display');
    const tgtDisplay = page.locator('#tab-text [data-picker-role="tgt"] .lang-picker-display');
    await expect(srcDisplay).toBeVisible();
    await expect(tgtDisplay).toBeVisible();

    const srcEnBdi = srcDisplay.locator('bdi');
    const tgtEnBdi = tgtDisplay.locator('bdi');
    await expect(srcEnBdi).toBeVisible();
    await expect(tgtEnBdi).toBeVisible();

    // 3. Detected badge is hidden before translation
    const srcDetectedBadge = page.locator('#src-detected-badge');
    await expect(srcDetectedBadge).toBeHidden();

    // 4. Test real detection badge appearance via picker API
    await page.evaluate(() => {
      window.MakanLangPickers?.text?.setDetected('en');
    });
    await expect(srcDetectedBadge).toBeVisible();
    await expect(srcDetectedBadge).toContainText('English');

    // 5. Swap button uses detected language when source is Detect
    await page.locator('#swap').click();
    // After swap with detected 'en' and target 'fa', new src should be 'fa' and new tgt should be 'en'
    expect(await page.locator('#src').inputValue()).toBe('fa');
    expect(await page.locator('#tgt').inputValue()).toBe('en');
    // Detection badge is cleared after swap
    await expect(srcDetectedBadge).toBeHidden();
  });

  test('Voice page: unified language picker renders labels and visible Persian + <bdi> English', async ({ app }) => {
    const { page } = app;
    await page.locator('#tabs button[data-tab="voice"]').click();

    const fromLbl = page.locator('#tab-voice [data-picker-role="src"] .lang-picker-lbl');
    const toLbl = page.locator('#tab-voice [data-picker-role="tgt"] .lang-picker-lbl');
    await expect(fromLbl).toBeVisible();
    await expect(toLbl).toBeVisible();

    const srcDisplay = page.locator('#tab-voice [data-picker-role="src"] .lang-picker-display');
    const tgtDisplay = page.locator('#tab-voice [data-picker-role="tgt"] .lang-picker-display');
    await expect(srcDisplay).toBeVisible();
    await expect(tgtDisplay).toBeVisible();
    await expect(srcDisplay.locator('bdi')).toBeVisible();
    await expect(tgtDisplay.locator('bdi')).toBeVisible();

    // Detected badge appears only when set
    const vDetectedBadge = page.locator('#vSrc-detected-badge');
    await expect(vDetectedBadge).toBeHidden();
    await page.evaluate(() => {
      window.MakanLangPickers?.voice?.setDetected('fr');
    });
    await expect(vDetectedBadge).toBeVisible();
    await expect(vDetectedBadge).toContainText('French');
  });

  test('Screen, Subtitles, Documents, and Ask AI pages have unified language pickers with labels and <bdi>', async ({ app }) => {
    const { page } = app;

    // Screen tab
    await page.locator('#tabs button[data-tab="screen"]').click();
    const screenSrcDisplay = page.locator('#tab-screen [data-picker-role="src"] .lang-picker-display');
    const screenTgtDisplay = page.locator('#tab-screen [data-picker-role="tgt"] .lang-picker-display');
    await expect(screenSrcDisplay).toBeVisible();
    await expect(screenTgtDisplay).toBeVisible();
    await expect(screenSrcDisplay.locator('bdi')).toBeVisible();
    await expect(screenTgtDisplay.locator('bdi')).toBeVisible();

    // Subtitles tab
    await page.locator('#tabs button[data-tab="sub"]').click();
    const subSrcDisplay = page.locator('#tab-sub [data-picker-role="src"] .lang-picker-display');
    const subTgtDisplay = page.locator('#tab-sub [data-picker-role="tgt"] .lang-picker-display');
    await expect(subSrcDisplay).toBeVisible();
    await expect(subTgtDisplay).toBeVisible();
    await expect(subSrcDisplay.locator('bdi')).toBeVisible();

    // Documents tab
    await page.locator('#tabs button[data-tab="doc"]').click();
    const docSrcDisplay = page.locator('#tab-doc [data-picker-role="src"] .lang-picker-display');
    const docTgtDisplay = page.locator('#tab-doc [data-picker-role="tgt"] .lang-picker-display');
    await expect(docSrcDisplay).toBeVisible();
    await expect(docTgtDisplay).toBeVisible();
    await expect(docSrcDisplay.locator('bdi')).toBeVisible();

    // Ask AI (under Voice tab)
    await page.locator('#tabs button[data-tab="voice"]').click();
    await page.locator('#vTabAsk').click();
    const askDisplay = page.locator('#vAskView .lang-picker-display');
    await expect(askDisplay).toBeVisible();
    await expect(askDisplay.locator('bdi')).toBeVisible();
  });

  test('No horizontal scroll at 360 px width', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 360, height: 740 });
    await page.locator('#tabs button[data-tab="text"]').click();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify pickers on Text tab fit nicely within 360px viewport
    const langGrpBox = await page.locator('#tab-text .trans-lang-grp').boundingBox();
    expect(langGrpBox.width).toBeLessThanOrEqual(360);
  });

  test('detectRealLanguage returns null and never guesses English on numbers, symbols, Finglish, or unsure text', async ({ app }) => {
    const { page } = app;
    const results = await page.evaluate(() => {
      return {
        numeric: detectRealLanguage('12345'),
        punctuation: detectRealLanguage('...?!'),
        finglish: detectRealLanguage('salam chetori azizam'),
        english: detectRealLanguage('The quick brown fox jumps over the lazy dog'),
        persian: detectRealLanguage('سلام، حال شما چطور است؟'),
        french: detectRealLanguage('Bonjour tout le monde'),
        german: detectRealLanguage('Guten Morgen und willkommen'),
        ambiguous: detectRealLanguage('xyz 999')
      };
    });

    expect(results.numeric).toBeNull();
    expect(results.punctuation).toBeNull();
    expect(results.finglish).toBeNull();
    expect(results.ambiguous).toBeNull();
    expect(results.english).toBe('en');
    expect(results.persian).toBe('fa');
    expect(results.french).toBe('fr');
    expect(results.german).toBe('de');
  });
});
