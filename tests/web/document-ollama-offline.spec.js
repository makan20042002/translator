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

    // Choose Ollama from the visible shared engine picker
    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    const option = picker.locator('option[value="ollama"]');
    await expect(option).toBeAttached({ timeout: 5000 });

    // Verify option text indicates Ready and not "Needs Ollama running"
    const optionText = await option.textContent();
    expect(optionText).toMatch(/ready/i);
    expect(optionText).not.toMatch(/needs.*running/i);

    await picker.selectOption('ollama');
    const modelPicker = page.locator('#docEnginePickerHost .engine-picker-model-select');
    await expect(modelPicker.locator('option[value="gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await modelPicker.selectOption('gemma4:12b');

    // Verify checkDocEngineReady reports ready: true
    const readyCheck = await page.evaluate(async () => {
      return await checkDocEngineReady('ollama');
    });
    expect(readyCheck.ready).toBe(true);

    // Verify "Ollama is not running" text does not appear anywhere
    await expect(page.locator('#dProgText')).not.toContainText('Ollama is not running');
    await expect(page.locator('body')).not.toContainText('Ollama is not running');
    await expect(page.locator('body')).not.toContainText('Ollama در حال اجرا نیست');
  });

  test('with Offline mode ON and Ollama not chosen anywhere, Document tab makes zero requests to port 11434 until Ollama is selected', async ({ app }) => {
    const { page } = app;
    const calls = [];
    await page.route(/(localhost|127\.0\.0\.1|\[::1\]):11434/, route => {
      calls.push(route.request().url());
      if (route.request().url().includes('/api/tags')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
        });
      } else {
        route.abort('connectionrefused');
      }
    });

    // Turn Offline mode ON
    const offBtn = page.locator('#offBtn');
    await mouseClick(page, offBtn);
    await expect(offBtn).toHaveClass(/\bon\b/);

    // Navigate to Document tab while Ollama is NOT chosen
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await expect(page.locator('#tab-doc')).toBeVisible();

    // Verify zero calls made to Ollama port 11434 while not chosen
    expect(calls).toEqual([]);

    // Now explicitly choose Ollama in Document picker
    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('ollama');

    // Model select should appear and become populated
    const modelPicker = page.locator('#docEnginePickerHost .engine-picker-model-select');
    await expect(modelPicker.locator('option[value="gemma4:12b"]')).toBeAttached({ timeout: 5000 });

    // Probing was allowed once explicitly chosen
    expect(calls.length).toBeGreaterThan(0);
  });

  test('with Offline mode ON and Ollama chosen, getEngineStatus and checkDocEngineReady agree that Ollama is ready', async ({ app }) => {
    const { page } = app;

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

    // Choose Ollama in Document picker
    const picker = page.locator('#docEnginePickerHost .engine-picker-select');
    await picker.selectOption('ollama');

    const modelPicker = page.locator('#docEnginePickerHost .engine-picker-model-select');
    await expect(modelPicker.locator('option[value="gemma4:12b"]')).toBeAttached({ timeout: 5000 });
    await modelPicker.selectOption('gemma4:12b');

    // Both getEngineStatus and checkDocEngineReady must agree that Ollama is ready
    const statusCheck = await page.evaluate(async () => {
      const getStatus = window.ENG.getStatus('ollama');
      const docReady = await checkDocEngineReady('ollama');
      const docModelReady = await checkDocEngineReady('ollama:gemma4:12b');
      return { getStatus, docReady, docModelReady };
    });

    expect(statusCheck.getStatus.usable).toBe(true);
    expect(statusCheck.getStatus.state).toBe('ready');
    expect(statusCheck.docReady.ready).toBe(true);
    expect(statusCheck.docModelReady.ready).toBe(true);
  });
});

