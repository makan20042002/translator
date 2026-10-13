'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Welcome Wizard: Privacy claims, 5-step flow, and responsiveness', () => {
  test('false case 1: Smart with Ollama unreachable displays honest requirement and no local privacy claim', async ({ app }) => {
    const { page } = app;
    // Ensure Ollama network requests are completely unreachable
    await page.route('http://localhost:11434/**', route => route.abort());

    // Clear any AI keys so it tests pure Ollama fallback
    await page.evaluate(() => {
      if (typeof cfg !== 'undefined' && cfg.eng) {
        if (cfg.eng.gemini) cfg.eng.gemini.key = '';
        if (cfg.eng.groq) cfg.eng.groq.key = '';
        if (cfg.eng.openrouter) cfg.eng.openrouter.key = '';
      }
      window.openWelcomeWizard(2);
    });

    const smartCard = page.locator('#welcomeStep2 [data-choice-engine="ollama"]');
    const privacyNotice = page.locator('#welcomePrivacyNotice');
    const privacyText = page.locator('#welcomePrivacyText');

    await mouseClick(page, smartCard);

    // Honest notice stating Ollama is required
    await expect(privacyText).toHaveText(/Needs Ollama running|نیاز به اجرای برنامه Ollama دارد/i);
    await expect(privacyNotice).not.toHaveClass(/\blocal\b/);

    // Verify "stays on this device" or "stays on this PC" does NOT appear anywhere in the dialog
    const modalText = await page.locator('#welcomeOverlay').innerText();
    expect(modalText).not.toMatch(/stays on this (device|PC)/i);
    expect(modalText).not.toMatch(/در همین رایانه/i);
  });

  test('false case 2: Offline with model not downloaded shows honest needs download line', async ({ app }) => {
    const { page } = app;
    // Clear downloaded models in store
    await page.evaluate(() => {
      store.set('mdl', {});
      window.openWelcomeWizard(2);
    });

    const offlineCard = page.locator('#welcomeStep2 [data-choice-engine="offline"]');
    const privacyNotice = page.locator('#welcomePrivacyNotice');
    const privacyText = page.locator('#welcomePrivacyText');

    await mouseClick(page, offlineCard);

    // Honest line stating model is needed
    await expect(privacyText).toHaveText(/Needs the offline model \(not downloaded yet\)|نیاز به دانلود مدل آفلاین دارد/i);
    await expect(privacyNotice).not.toHaveClass(/\blocal\b/);
  });

  test('online choice shows text is sent to provider', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(2));

    const onlineCard = page.locator('#welcomeStep2 [data-choice-engine="online"]');
    const privacyNotice = page.locator('#welcomePrivacyNotice');
    const privacyText = page.locator('#welcomePrivacyText');

    await mouseClick(page, onlineCard);

    await expect(privacyText).toHaveText(/sent only to the selected provider|ارائه‌دهنده/i);
    await expect(privacyNotice).not.toHaveClass(/\blocal\b/);
  });

  test('true local claims only appear when model is ready or Ollama is reachable', async ({ app }) => {
    const { page } = app;
    // Seed NLLB model as downloaded
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const nllb = cat.models.find(m => m.id === 'tr-nllb-600');
    await page.evaluate(({ nllbFiles }) => {
      store.set('mdl', {
        'tr-nllb-600': { at: 1, files: nllbFiles }
      });
    }, {
      nllbFiles: nllb.files.map(f => f[0]).filter(f => f.endsWith('.onnx'))
    });

    // Stub Ollama reachable endpoint
    await page.route('http://localhost:11434/api/tags', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'translategemma:4b' }] })
    }));

    await page.evaluate(() => window.openWelcomeWizard(2));

    const offlineCard = page.locator('#welcomeStep2 [data-choice-engine="offline"]');
    const smartCard = page.locator('#welcomeStep2 [data-choice-engine="ollama"]');
    const privacyNotice = page.locator('#welcomePrivacyNotice');
    const privacyText = page.locator('#welcomePrivacyText');

    // Offline card with seeded model
    await mouseClick(page, offlineCard);
    await expect(privacyText).toHaveText(/stays on this (device|PC)|همین رایانه/i);
    await expect(privacyNotice).toHaveClass(/\blocal\b/);

    // Smart card with reachable Ollama
    await mouseClick(page, smartCard);
    await expect(privacyText).toHaveText(/stays on this (device|PC)|همین رایانه/i);
    await expect(privacyNotice).toHaveClass(/\blocal\b/);
  });

  test('Item 4: Step 4 How it works pane, 5 dots, and resume from step 4 after reload', async ({ app }) => {
    const { page } = app;
    // 5 step dots exist in indicator
    await page.evaluate(() => window.openWelcomeWizard(1));
    const dots = page.locator('#welcomeStepIndicator .step-dot');
    await expect(dots).toHaveCount(5);

    // Open Step 4 How it works
    await page.evaluate(() => window.openWelcomeWizard(4));
    const stepHow = page.locator('#welcomeStepHow');
    await expect(stepHow).toBeVisible();

    // Verify 4 cards explaining how the app works
    const howCards = page.locator('#welcomeStepHow .welcome-how-card');
    await expect(howCards).toHaveCount(4);

    // Verify resume from step 4
    await page.evaluate(() => localStorage.setItem('welcome_step', '4'));
    await page.reload();
    await page.evaluate(() => {
      // simulate first run or open from stored step
      const saved = window.getSavedWelcomeStep();
      window.openWelcomeWizard(saved);
    });
    await expect(page.locator('#welcomeStepHow')).toBeVisible();

    // Skip at step 4 closes wizard and leaves app usable
    const skipBtn = page.locator('#welcomeSkipBtn');
    await mouseClick(page, skipBtn);
    await expect(page.locator('#welcomeOverlay')).toBeHidden();
    const isDone = await page.evaluate(() => localStorage.getItem('welcome_done'));
    expect(isDone).toBe('1');
  });

  test('responsiveness: no horizontal scroll at 360px viewport in Persian and English', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 360, height: 720 });

    // 1. In Persian (RTL)
    await page.evaluate(() => {
      store.set('ui', 'fa');
      if (typeof ui !== 'undefined') ui = 'fa';
      applyI18n();
      window.openWelcomeWizard(4);
    });

    const isNoOverflowFa = await page.evaluate(() => {
      const modal = document.querySelector('.welcome-modal');
      return modal.scrollWidth <= modal.clientWidth + 2 &&
             document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
    });
    expect(isNoOverflowFa).toBe(true);

    // 2. In English (LTR)
    await page.evaluate(() => {
      store.set('ui', 'en');
      if (typeof ui !== 'undefined') ui = 'en';
      applyI18n();
      window.openWelcomeWizard(4);
    });

    const isNoOverflowEn = await page.evaluate(() => {
      const modal = document.querySelector('.welcome-modal');
      return modal.scrollWidth <= modal.clientWidth + 2 &&
             document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
    });
    expect(isNoOverflowEn).toBe(true);
  });
});
