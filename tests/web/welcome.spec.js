'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

async function openSettings(page) {
  await mouseClick(page, page.locator('#openSet'));
  await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
}

test.describe('Web app: Welcome Wizard (Stage 4)', () => {
  test('can reopen wizard from Settings and navigate steps', async ({ app }) => {
    const { page } = app;
    await openSettings(page);

    // Wizard button exists in Settings -> Engines
    const reopenBtn = page.locator('#btnReopenWelcome');
    await expect(reopenBtn).toBeVisible();

    // Clicking reopen opens welcome wizard overlay
    await mouseClick(page, reopenBtn);
    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveClass(/\bon\b/);

    // Step 1: Language selection is shown
    await expect(page.locator('#welcomeStep1')).toBeVisible();
    await expect(page.locator('#welcomeStep2')).toBeHidden();

    // Select English language card
    const enCard = page.locator('#welcomeStep1 [data-choice-lang="en"]');
    await mouseClick(page, enCard);
    await expect(enCard).toHaveClass(/\bactive\b/);
    const enRadio = page.locator('#welcomeStep1 input[name="welcomeLang"][value="en"]');
    await expect(enRadio).toBeChecked();

    // Click Next to advance to Step 2
    const nextBtn = page.locator('#welcomeNextBtn');
    await mouseClick(page, nextBtn);

    // Step 2 is now visible
    await expect(page.locator('#welcomeStep1')).toBeHidden();
    await expect(page.locator('#welcomeStep2')).toBeVisible();

    // Step indicator dot 2 is active, dot 1 is passed
    const dot1 = page.locator('#welcomeStepIndicator .step-dot[data-step="1"]');
    const dot2 = page.locator('#welcomeStepIndicator .step-dot[data-step="2"]');
    await expect(dot1).toHaveClass(/\bpassed\b/);
    await expect(dot2).toHaveClass(/\bactive\b/);
  });

  test('engine selection displays conditional privacy disclosure', async ({ app }) => {
    const { page } = app;
    // Open wizard directly via helper
    await page.evaluate(() => window.openWelcomeWizard(2));

    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#welcomeStep2')).toBeVisible();

    const offlineCard = page.locator('#welcomeStep2 [data-choice-engine="offline"]');
    const ollamaCard = page.locator('#welcomeStep2 [data-choice-engine="ollama"]');
    const onlineCard = page.locator('#welcomeStep2 [data-choice-engine="online"]');
    const privacyText = page.locator('#welcomePrivacyText');
    const privacyNotice = page.locator('#welcomePrivacyNotice');

    const cat = await page.evaluate(() => MODEL_CATALOG);
    const nllb = cat.models.find(m => m.id === 'tr-nllb-600');
    await page.evaluate(async ({ repo, files, fNames }) => {
      store.set('mdl', {
        'tr-nllb-600': { at: Date.now(), files: fNames }
      });
      store.set('nllb', true);
      if ('caches' in self) {
        const c = await caches.open('transformers-cache');
        for (const [name, size] of files) {
          await c.put(`https://huggingface.co/${repo}/resolve/main/${name}`, new Response(new Uint8Array(8), { headers: { 'content-length': String(size) } }));
        }
      }
      if (typeof mcScan === 'function') await mcScan();
    }, {
      repo: nllb.repo,
      files: nllb.files,
      fNames: nllb.files.map(f => f[0]).filter(f => f.endsWith('.onnx') || f.endsWith('.onnx_data') || f.endsWith('.txt'))
    });
    await page.route('http://localhost:11434/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'translategemma:4b' }], data: [{ id: 'translategemma:4b' }] })
    }));

    // Offline engine selected: local privacy notice
    await mouseClick(page, offlineCard);
    await expect(privacyText).toHaveText(/stays on this (device|PC)|Everything stays on this device/i);
    await expect(privacyNotice).toHaveClass(/\blocal\b/);

    // Ollama engine selected: local privacy notice
    await mouseClick(page, ollamaCard);
    await expect(privacyText).toHaveText(/stays on this (device|PC)|Everything stays on this device/i);
    await expect(privacyNotice).toHaveClass(/\blocal\b/);

    // Online engine selected: cloud notice
    await mouseClick(page, onlineCard);
    await expect(privacyText).toHaveText(/sent only to the selected provider|Online engine/i);
    await expect(privacyNotice).not.toHaveClass(/\blocal\b/);
  });

  test('step progress is resumable from localStorage', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => {
      localStorage.setItem('welcome_step', '3');
      localStorage.setItem('welcome_test', '1');
      localStorage.removeItem('welcome_done');
    });

    // Reopen wizard with step from localStorage
    await page.evaluate(() => {
      const s = parseInt(localStorage.getItem('welcome_step') || '1', 10);
      window.openWelcomeWizard(s);
    });

    // Step 3 is directly visible
    await expect(page.locator('#welcomeStep3')).toBeVisible();
    await expect(page.locator('#welcomeStep1')).toBeHidden();
    await expect(page.locator('#welcomeStep2')).toBeHidden();

    const dot3 = page.locator('#welcomeStepIndicator .step-dot[data-step="3"]');
    await expect(dot3).toHaveClass(/\bactive\b/);
  });

  test('skip button marks welcome_done and closes wizard', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(1));
    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeVisible();

    const skipBtn = page.locator('#welcomeSkipBtn');
    await mouseClick(page, skipBtn);

    await expect(overlay).toBeHidden();
    const isDone = await page.evaluate(() => localStorage.getItem('welcome_done'));
    expect(isDone).toBe('1');
  });

  test('completing wizard applies settings and finishes', async ({ app }) => {
    const { page } = app;
    await page.evaluate(() => window.openWelcomeWizard(5));

    await expect(page.locator('#welcomeStep5')).toBeVisible();
    const finishBtn = page.locator('#welcomeFinishBtn');
    await expect(finishBtn).toBeVisible();

    await mouseClick(page, finishBtn);

    const overlay = page.locator('#welcomeOverlay');
    await expect(overlay).toBeHidden();
    const isDone = await page.evaluate(() => localStorage.getItem('welcome_done'));
    expect(isDone).toBe('1');
  });
});
