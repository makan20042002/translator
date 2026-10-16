'use strict';
/**
 * ITEM 2: Tests for Document tab Ollama readiness:
 * - with Offline mode ON and a stub that answers, Document engine "Ollama" is ready (no "not running" text anywhere)
 * - with the stub down the message contains the address
 * - with a slow stub it shows the timeout message, not "not running"
 */
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

test.describe('Document tab Ollama readiness check and messages', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'ollama', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('with Offline mode ON and a stub that answers, Document engine Ollama is ready with no not running text', async ({ app, files }) => {
    const { page } = app;

    // Fake Ollama answers with a model
    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'translategemma:4b' }] })
      });
    });

    // Turn Offline mode ON
    await mouseClick(page, page.locator('#offBtn'));
    await expect(page.locator('#offBtn')).toHaveClass(/\bon\b/);

    // Open Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const picker = page.locator('#dEngineSel');
    const opt = picker.locator('option[value="ollama:translategemma:4b"]');
    await expect(opt).toBeAttached({ timeout: 5000 });
    await picker.selectOption('ollama:translategemma:4b');

    // Engine line / picker shows Ready, not "not running"
    const optText = await opt.textContent();
    expect(optText).toContain('Ready');
    expect(optText).not.toMatch(/not running|در حال اجرا نیست/i);

    // checkDocEngineReady returns ready: true
    const check = await page.evaluate(async () => {
      return await checkDocEngineReady('ollama:translategemma:4b');
    });
    expect(check.ready).toBe(true);

    // Verify entire document tab contains no "not running" text
    const docTabText = await page.locator('#tab-doc').innerText();
    expect(docTabText).not.toMatch(/Ollama is not running|Needs Ollama running|در حال اجرا نیست/i);
  });

  test('with the stub down the message contains the address', async ({ app, files }) => {
    const { page } = app;

    // Make all Ollama routes abort
    await page.route('**/api/tags', route => route.abort('connectionrefused'));
    await page.route('**/v1/**', route => route.abort('connectionrefused'));

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await picker.selectOption('ollama');

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toBeVisible({ timeout: 6000 });

    // The message must contain the address tried (http://localhost:11434)
    const text = await progText.textContent();
    expect(text).toContain('http://localhost:11434');
    expect(text).toMatch(/Could not reach Ollama|ارتباط با Ollama/i);
  });

  test('with a slow stub it shows the timeout message, not not running', async ({ app, files }) => {
    const { page } = app;

    // Stub hangs indefinitely
    await page.route('**/api/tags', async () => {
      await new Promise(r => setTimeout(r, 10000));
    });
    await page.route('**/v1/**', async () => {
      await new Promise(r => setTimeout(r, 10000));
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await picker.selectOption('ollama');

    await chooseFile(page, page.locator('#dDrop'), files.txt);

    // Call checkDocEngineReady with a short timeout override or execute translation
    const check = await page.evaluate(async () => {
      // In tests, call checkDocEngineReady directly with a simulated small timeout
      return await checkDocEngineReady('ollama');
    });

    expect(check.ready).toBe(false);
    expect(check.msg).toContain('Ollama did not answer in time (it may be busy loading a model). Wait a moment and try again.');
    expect(check.msg).not.toContain('Ollama is not running');
  });
});
