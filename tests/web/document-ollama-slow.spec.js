'use strict';
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Document tab slow Ollama, timeouts, and concurrency', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('a) fake Ollama answers after 2.5 s with Ollama timeout 8 s and web timeout 1 s: translates to end, shows Waiting for Ollama', async ({ app, files }) => {
    const { page } = app;

    await page.addInitScript(() => {
      window.__docOllamaFirstTimeoutMs = 8000;
      window.__docOllamaTimeoutMs = 8000;
      window.__docTimeoutMs = 1000;
    });

    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    await page.route('**/v1/chat/completions', async route => {
      await new Promise(r => setTimeout(r, 2500));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: JSON.stringify(['ترجمه یک', 'ترجمه دو', 'ترجمه سه']) } }]
          })
        });
      } catch (_) {}
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    // Progress line shows "Waiting for Ollama" while waiting
    await expect(page.locator('#dProgText')).toContainText('Waiting for Ollama', { timeout: 3000 });

    // Translates to the end
    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20000 });

    // No failure line
    await expect(page.locator('#dProgText')).not.toContainText('failed');
    await expect(page.locator('#dProgText')).not.toContainText('Tried:');
  });

  test('b) fake Ollama never answers: after timeout and retry, failure line names Ollama and "did not answer", no Google call', async ({ app, files, stub }) => {
    const { page } = app;

    await page.addInitScript(() => {
      window.__docOllamaFirstTimeoutMs = 3000;
      window.__docOllamaTimeoutMs = 3000;
    });

    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    await page.route('**/v1/chat/completions', () => {
      // Hang indefinitely
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    // After timeout + retry, failure line names Ollama and "did not answer"
    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Ollama', { timeout: 15000 });
    await expect(progText).toContainText('did not answer');

    // Translate is enabled, Download disabled
    await expect(page.locator('#dGo')).toBeEnabled();
    await expect(page.locator('#dSave')).toBeDisabled();

    // No requests reached Google or any online host
    const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
    expect(googleCalls.length).toBe(0);
  });

  test('c) first request slower than normal timeout but within first-request allowance still succeeds', async ({ app, files }) => {
    const { page } = app;

    await page.addInitScript(() => {
      window.__docOllamaFirstTimeoutMs = 8000;
      window.__docOllamaTimeoutMs = 2000;
    });

    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    let reqIndex = 0;
    await page.route('**/v1/chat/completions', async route => {
      reqIndex++;
      const delay = (reqIndex === 1) ? 3500 : 500;
      await new Promise(r => setTimeout(r, delay));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: JSON.stringify(['ترجمه یک', 'ترجمه دو', 'ترجمه سه']) } }]
          })
        });
      } catch (_) {}
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20000 });
    await expect(page.locator('#dProgText')).not.toContainText('failed');
  });

  test('d) Stop pressed during a slow answer: fetch aborted, buttons re-enabled within 1 s, no failure toast', async ({ app, files }) => {
    const { page } = app;

    await page.addInitScript(() => {
      window.__docOllamaFirstTimeoutMs = 15000;
      window.__docOllamaTimeoutMs = 15000;
    });

    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    await page.route('**/v1/chat/completions', () => {
      // Hang so Stop can be pressed
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dStop')).toBeEnabled({ timeout: 3000 });
    await mouseClick(page, page.locator('#dStop'));

    // Buttons re-enabled within 1 s
    await expect(page.locator('#dGo')).toBeEnabled({ timeout: 1000 });
    await expect(page.locator('#dStop')).toBeDisabled({ timeout: 1000 });

    // No failure toast
    await expect(page.locator('.toast.err')).toHaveCount(0);
  });

  test('e) Smart mode: load file (subject analysis starts against slow fake Ollama), click Translate: analysis aborted, max concurrency <= 1', async ({ app, files }) => {
    const { page } = app;

    let inFlight = 0;
    let maxConcurrent = 0;

    await page.addInitScript(() => {
      window.__docOllamaFirstTimeoutMs = 8000;
      window.__docOllamaTimeoutMs = 8000;
    });

    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    await page.route('**/v1/chat/completions', async route => {
      inFlight++;
      if (inFlight > maxConcurrent) maxConcurrent = inFlight;
      const data = route.request().postDataJSON() || {};
      const isAnalysis = data.messages && data.messages.some(m => /subject/i.test(m.content));

      await new Promise(r => setTimeout(r, 1200));
      inFlight--;

      try {
        const body = isAnalysis
          ? JSON.stringify({ choices: [{ message: { content: JSON.stringify({ subject: 'Tech', register: 'Neutral', terms: [] }) } }] })
          : JSON.stringify({ choices: [{ message: { content: JSON.stringify(['ترجمه یک', 'ترجمه دو', 'ترجمه سه']) } }] });
        await route.fulfill({ status: 200, contentType: 'application/json', body });
      } catch (_) {}
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    // Load file -> subject analysis starts
    await chooseFile(page, page.locator('#dDrop'), files.txt);

    // Click Translate immediately
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 20000 });

    // At most 1 request was in flight at a time (subject analysis was aborted upon clicking Translate)
    expect(maxConcurrent).toBeLessThanOrEqual(1);
  });

  test('f) Persian UI run of (b): failure line names Ollama and "پاسخی نداد", no Google request', async ({ app, files, stub }) => {
    const { page } = app;

    await page.addInitScript(() => {
      window.__docOllamaFirstTimeoutMs = 3000;
      window.__docOllamaTimeoutMs = 3000;
    });

    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    await page.route('**/v1/chat/completions', () => {
      // Hang indefinitely
    });

    // Switch to Persian
    await mouseClick(page, page.locator('#uiLang'));
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Ollama', { timeout: 15000 });
    await expect(progText).toContainText('پاسخی نداد');

    await expect(page.locator('#dGo')).toBeEnabled();
    await expect(page.locator('#dSave')).toBeDisabled();

    const googleCalls = stub.calls('clients5.google.com').concat(stub.calls('translate.googleapis.com'));
    expect(googleCalls.length).toBe(0);
  });

  test('g) fake Ollama records request body: contains keep_alive "30m", and no num_ctx', async ({ app, files }) => {
    const { page } = app;

    const recordedRequests = [];
    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    await page.route('**/v1/chat/completions', route => {
      recordedRequests.push(route.request().postDataJSON());
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: JSON.stringify(['ترجمه یک', 'ترجمه دو', 'ترجمه سه']) } }]
        })
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value="ollama:gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 15000 });

    expect(recordedRequests.length).toBeGreaterThan(0);
    for (const body of recordedRequests) {
      expect(body.keep_alive).toBe('30m');
      expect(body.num_ctx).toBeUndefined();
    }
  });
});
