'use strict';
/**
 * ITEM 3: Tests for keeping the Document cache fresh:
 * - start with stub down (Document shows needs-Ollama), switch stub to up, fire window focus event -> Document picker shows models as Ready without reloading
 * - successful Engines & keys test makes Document picker Ready; failed test sets it to false
 */
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Document tab Ollama cache freshness and focus refresh', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'ollama', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('focus event refreshes Document picker from needs-Ollama to Ready when Ollama comes up', async ({ app }) => {
    const { page } = app;

    // 1) Start with stub down
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:11434/**', route => route.abort('connectionrefused'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');

    // With stub down, models are not listed as Ready
    await expect(picker.locator('option[value^="ollama:"]')).toHaveCount(0);
    const ollamaOpt = picker.locator('option[value="ollama"]');
    await expect(ollamaOpt).toBeAttached();
    const optTextDown = await ollamaOpt.textContent();
    expect(optTextDown).toMatch(/Needs Ollama running|نیاز به اجرای Ollama/i);

    // 2) Switch stub to up
    await page.unroute('http://localhost:11434/**');
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{ name: 'translategemma:4b' }]
        })
      });
    });

    // 3) Fire window focus event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // 4) Document picker shows the models as Ready without reloading
    const modelOpt = picker.locator('option[value="ollama:translategemma:4b"]');
    await expect(modelOpt).toBeAttached({ timeout: 5000 });
    const textUp = await modelOpt.textContent();
    expect(textUp).toContain('Ready');
    expect(textUp).toContain('translategemma:4b');
  });

  test('successful Engines and keys test updates cachedOllamaModels and makes Document picker Ready', async ({ app }) => {
    const { page } = app;

    // Start with stub down
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:11434/**', route => route.abort('connectionrefused'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker.locator('option[value^="ollama:"]')).toHaveCount(0);

    // Switch stub to up
    await page.unroute('http://localhost:11434/**');
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{ name: 'qwen3:8b' }]
        })
      });
    });

    // Run connection test in Engines & keys
    const connResult = await page.evaluate(async () => {
      return await checkEngineConn('ollama');
    });
    expect(connResult.code).toBe('works');

    // Document picker is now Ready with the model option
    const modelOpt = picker.locator('option[value="ollama:qwen3:8b"]');
    await expect(modelOpt).toBeAttached({ timeout: 5000 });
    const optText = await modelOpt.textContent();
    expect(optText).toContain('Ready');
    expect(optText).toContain('qwen3:8b');

    // Failed test sets cachedOllamaModels to false
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    const failedResult = await page.evaluate(async () => {
      return await checkEngineConn('ollama');
    });
    expect(failedResult.code).not.toBe('works');

    const cached = await page.evaluate(() => window.cachedOllamaModels);
    expect(cached).toBe(false);
  });
});
