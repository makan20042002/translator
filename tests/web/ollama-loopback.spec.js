'use strict';
const { test, expect, mouseClick, chooseFile } = require('../support/fixtures');

test.describe('Ollama alternate loopback address fallback', () => {
  test('when localhost:11434 refuses connection but 127.0.0.1:11434 answers, Document picker lists model as Ready', async ({ app }) => {
    const { page } = app;

    // Localhost refuses connection immediately
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));

    // 127.0.0.1 responds with model list
    await page.route('http://127.0.0.1:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] })
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#dEngineSel');
    const option = picker.locator('option[value="ollama:qwen2.5:7b"]');
    await expect(option).toBeAttached({ timeout: 5000 });

    const optionText = await option.textContent();
    expect(optionText).toContain('Ready');
    expect(optionText).not.toContain('Needs Ollama running');

    await picker.selectOption('ollama:qwen2.5:7b');
    const readyCheck = await page.evaluate(async () => {
      return await checkDocEngineReady('ollama:qwen2.5:7b');
    });
    expect(readyCheck.ready).toBe(true);
  });

  test('when both localhost and 127.0.0.1 refuse connection, Document tab shows unchanged Ollama is not running message', async ({ app, files, stub }) => {
    const { page } = app;

    // Both loopback endpoints refuse connection
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:11434/**', route => route.abort('connectionrefused'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#dEngineSel');
    await picker.selectOption('ollama');

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Ollama is not running. Start Ollama, then try again.');
    await expect(progText.locator('a')).toContainText('Engines & keys');
    await expect(page.locator('#dGo')).toBeEnabled();
    expect(stub.calls().length).toBe(0);
  });
});
