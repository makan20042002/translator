'use strict';
/**
 * ITEM 4: Tests for synchronizing Ollama status across Text and Document tabs:
 * - with the stub up, the Text tab engine list and the Document engine list both show Ollama as available
 * - with it down both show the same unavailable state
 */
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Synchronized Ollama status across Text and Document tabs', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'ollama']), src: 'en', tgt: 'fa' } } });

  test('Text tab engine list and Document engine list both show Ollama as available when stub is up', async ({ app }) => {
    const { page } = app;

    // Stub up with available models
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{ name: 'translategemma:4b' }]
        })
      });
    });

    // Navigate to Document tab and trigger check
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const docPicker = page.locator('#dEngineSel');
    const docOllamaOpt = docPicker.locator('option[value="ollama:translategemma:4b"]');
    await expect(docOllamaOpt).toBeAttached({ timeout: 5000 });
    const docOptText = await docOllamaOpt.textContent();
    expect(docOptText).toContain('Ready');

    // Switch to Text tab
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    const textEngineSel = page.locator('#engine');
    const textOllamaOpt = textEngineSel.locator('option[value="ollama"]');
    await expect(textOllamaOpt).toBeAttached({ timeout: 5000 });
  });

  test('Text tab engine list and Document engine list both show Ollama as unavailable when stub is down', async ({ app }) => {
    const { page } = app;

    // Stub down
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:11434/**', route => route.abort('connectionrefused'));

    // Open Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const docPicker = page.locator('#dEngineSel');

    // Document engine list shows Ollama is unavailable
    await expect(docPicker.locator('option[value^="ollama:"]')).toHaveCount(0);
    const docOllamaOpt = docPicker.locator('option[value="ollama"]');
    await expect(docOllamaOpt).toBeAttached({ timeout: 5000 });
    const docOptText = await docOllamaOpt.textContent();
    expect(docOptText).toMatch(/Needs Ollama running|نیاز به اجرای Ollama/i);

    // Switch to Text tab
    await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
    const textEngineSel = page.locator('#engine');

    // Text tab engine list excludes Ollama since it is unavailable
    const textOllamaOpt = textEngineSel.locator('option[value="ollama"]');
    await expect(textOllamaOpt).toHaveCount(0);
  });
});
