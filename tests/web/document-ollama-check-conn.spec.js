'use strict';
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Document tab updates when Check connections succeeds', () => {
  test('Document picker transitions from Needs Ollama running to Ready after Check connections in Engines & keys', async ({ app }) => {
    const { page } = app;

    // Start with Ollama unreachable
    await page.route('**/api/tags', route => route.abort('connectionrefused'));
    await page.route('**/v1/**', route => route.abort('connectionrefused'));

    // Open Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // Picker shows "Needs Ollama running"
    const picker = page.locator('#dEngineSel');
    const notRunningOption = picker.locator('option[value="ollama"]');
    await expect(notRunningOption).toBeAttached({ timeout: 5000 });
    await expect(notRunningOption).toContainText('Needs Ollama running');

    // Ollama starts responding
    await page.unroute('**/api/tags');
    await page.route('**/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'llama3:8b' }] })
      });
    });

    // Open Engines & keys modal
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/\bon\b/);

    // Run "Check connections"
    await mouseClick(page, page.locator('#btnCheckConn'));

    // Ollama connection status turns to "works"
    const ollamaStatus = page.locator('#engList .eng[data-id="ollama"] .eng-status');
    await expect(ollamaStatus).toHaveText('works', { timeout: 15000 });

    // Close settings modal
    await mouseClick(page, page.locator('#btnSaveDone'));
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);

    // Verify Document picker now shows Ollama as Ready without reloading
    const readyOption = picker.locator('option[value="ollama:llama3:8b"]');
    await expect(readyOption).toBeAttached({ timeout: 5000 });
    await expect(readyOption).toContainText('Ready');
    await expect(readyOption).not.toContainText('Needs Ollama running');
  });
});
