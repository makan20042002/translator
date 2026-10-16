'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Document tab Ollama in Offline mode', () => {
  test('with Offline mode ON and Ollama running, Document engine picker shows Ollama Ready and does not say Ollama is not running', async ({ app }) => {
    const { page } = app;

    // Stub Ollama to answer with one model
    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    // Turn Offline mode ON
    const offBtn = page.locator('#offBtn');
    await mouseClick(page, offBtn);
    await expect(offBtn).toHaveClass(/\bon\b/);

    // Navigate to Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // Choose Ollama from the picker
    const picker = page.locator('#dEngineSel');
    const option = picker.locator('option[value="ollama:gemma4:12b"]');
    await expect(option).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:gemma4:12b');

    // Verify option text indicates Ready and not "Needs Ollama running"
    const optionText = await option.textContent();
    expect(optionText).toContain('Ready');
    expect(optionText).not.toContain('Needs Ollama running');

    // Verify checkDocEngineReady reports ready: true
    const readyCheck = await page.evaluate(async () => {
      return await checkDocEngineReady('ollama:gemma4:12b');
    });
    expect(readyCheck.ready).toBe(true);

    // Verify "Ollama is not running" text does not appear anywhere
    await expect(page.locator('#dProgText')).not.toContainText('Ollama is not running');
    await expect(page.locator('body')).not.toContainText('Ollama is not running');
    await expect(page.locator('body')).not.toContainText('Ollama در حال اجرا نیست');
  });
});
