'use strict';
/**
 * Tests for Ollama model manager in settings:
 * - list shows installed models
 * - choosing a model changes the one used
 * - pull shows progress and finishes
 * - cancel stops it
 * - unreachable server shows the message
 * - the choice survives reload
 * - speech models helper program notice
 */
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');

async function openSettings(page) {
  await mouseClick(page, page.locator('#openSet'));
  await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
}

test.describe('Web app: Ollama model manager in settings', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['ollama']), src: 'en', tgt: 'fa' } } });

  test('list shows installed models', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { name: 'translategemma:4b' },
            { name: 'qwen3:8b' }
          ]
        })
      });
    });

    await openSettings(page);
    const select = page.locator('#ollamaModelSel');
    await expect(select).toBeVisible();
    await expect(select.locator('option[value="translategemma:4b"]')).toHaveCount(1);
    await expect(select.locator('option[value="qwen3:8b"]')).toHaveCount(1);
  });

  test('choosing a model changes the one used', async ({ app }) => {
    const { page } = app;
    let requestedModel = null;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { name: 'translategemma:4b' },
            { name: 'qwen3:8b' }
          ]
        })
      });
    });
    await page.route('http://localhost:11434/v1/chat/completions', async route => {
      const postData = route.request().postDataJSON();
      requestedModel = postData?.model;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: 'صبح بخیر' } }]
        })
      });
    });

    await openSettings(page);
    await page.locator('#ollamaModelSel').selectOption('qwen3:8b');

    // Choice is saved to settings
    const stored = await page.evaluate(() => {
      const cfg = JSON.parse(localStorage.getItem('mkt_cfg') || '{}');
      return cfg?.eng?.ollama?.model;
    });
    expect(stored).toBe('qwen3:8b');

    // Close settings and run translation
    await mouseClick(page, page.locator('#closeSet'));
    await page.locator('#tIn').fill('Good morning');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).toHaveValue('صبح بخیر', { timeout: 15_000 });
    expect(requestedModel).toBe('qwen3:8b');
  });

  test('pull shows progress and finishes', async ({ app }) => {
    const { page } = app;
    let pullCalled = false;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] })
      });
    });
    await page.route('http://localhost:11434/api/pull', async route => {
      pullCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: '{"status":"pulling manifest"}\n{"status":"downloading","completed":500,"total":1000}\n{"status":"success"}\n'
      });
    });

    await openSettings(page);
    const recBtn = page.locator('#ollamaMgr [data-pull="translategemma:4b"]');
    await mouseClick(page, recBtn);

    expect(pullCalled).toBe(true);
    const progressBox = page.locator('#ollamaPullProgress');
    await expect(progressBox).toBeVisible();
    await expect(page.locator('#ollamaPullStatusText')).toContainText(/finished|completed|تمام/i, { timeout: 10_000 });
  });

  test('cancel stops it', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] })
      });
    });
    await page.route('http://localhost:11434/api/pull', async route => {
      // Hold request open so cancel can be tested
      await new Promise(resolve => setTimeout(resolve, 5000));
      route.abort();
    });

    await openSettings(page);
    await page.locator('#ollamaCustomModel').fill('custom-model:latest');
    await mouseClick(page, page.locator('#ollamaCustomPullBtn'));

    await expect(page.locator('#ollamaPullProgress')).toBeVisible();
    const cancelBtn = page.locator('#ollamaPullCancel');
    await mouseClick(page, cancelBtn);

    await expect(page.locator('#ollamaPullStatusText')).toContainText(/cancel|لغو/i, { timeout: 10_000 });
  });

  test('unreachable server shows the message', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => route.abort());
    await page.route('http://localhost:11434/v1/models', route => route.abort());

    await openSettings(page);
    const notice = page.locator('#ollamaUnreachableNotice');
    await expect(notice).toBeVisible({ timeout: 10_000 });
    await expect(notice).toContainText(/ollama serve/i);
    await expect(notice).toContainText(/OLLAMA_ORIGINS/i);
    // Must NOT recommend wildcard "*"
    const noticeText = await notice.textContent();
    expect(noticeText).not.toContain('OLLAMA_ORIGINS=*');
    expect(noticeText).not.toContain('OLLAMA_ORIGINS="*"');
    // Must recommend the app's actual origin and restarting Ollama after
    const appOrigin = await page.evaluate(() => window.location.origin);
    await expect(notice).toContainText(`OLLAMA_ORIGINS=${appOrigin}`);
    await expect(notice).toContainText(/restart|دوباره/i);
  });

  test('the choice survives reload', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { name: 'translategemma:4b' },
            { name: 'qwen3:8b' }
          ]
        })
      });
    });

    await openSettings(page);
    await page.locator('#ollamaModelSel').selectOption('qwen3:8b');
    await mouseClick(page, page.locator('#btnSaveDone'));

    // Reload page
    await page.reload();
    await openSettings(page);
    await expect(page.locator('#ollamaModelSel')).toHaveValue('qwen3:8b');
    const stored = await page.evaluate(() => {
      const cfg = JSON.parse(localStorage.getItem('mkt_cfg') || '{}');
      return cfg?.eng?.ollama?.model;
    });
    expect(stored).toBe('qwen3:8b');
  });

  test('shows notice that speech models require a separate helper program', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [] }) });
    });
    await openSettings(page);
    const asrNotice = page.locator('#ollamaAsrNotice');
    await expect(asrNotice).toBeVisible();
    await expect(asrNotice).toContainText(/Qwen3-ASR/i);
  });

  test('Ollama in cfg.order probes models when enabled, but makes zero requests when disabled', async ({ app }) => {
    const { page } = app;
    let tagsRequested = false;
    await page.route('**/api/tags', route => {
      tagsRequested = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'test-ollama:latest' }] })
      });
    });

    // 1. With Ollama in cfg.order and engine='auto', opening settings probes Ollama models
    await page.evaluate(() => {
      cfg.order = ['google', 'ollama'];
      cfg.eng.ollama.on = true;
      store.set('engine', 'auto');
      saveCfg();
    });
    await openSettings(page);
    await expect(page.locator('#ollamaModelSel option[value="test-ollama:latest"]')).toHaveCount(1);
    expect(tagsRequested).toBe(true);

    // 2. When Ollama is disabled, fetchOllamaModels makes zero requests
    tagsRequested = false;
    const res = await page.evaluate(async () => {
      cfg.eng.ollama.on = false;
      return await fetchOllamaModels();
    });
    expect(res).toBeNull();
    expect(tagsRequested).toBe(false);
  });
});
