'use strict';
/**
 * Guard test: verifies that the web app test environment isolates the browser
 * from any real Ollama instance running on port 11434 (loopback), while still
 * allowing tests to register their own page.route stubs for Ollama.
 */
const { test, expect } = require('../support/fixtures');

test.describe('Web app: Ollama loopback isolation', () => {
  test('loopback port 11434 is blocked by default across 127.0.0.1, localhost, and [::1]', async ({ app }) => {
    const { page } = app;
    const res127 = await page.evaluate(() =>
      fetch('http://127.0.0.1:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(res127).toBe('blocked');

    const resLocalhost = await page.evaluate(() =>
      fetch('http://localhost:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(resLocalhost).toBe('blocked');

    const resIpv6 = await page.evaluate(() =>
      fetch('http://[::1]:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(resIpv6).toBe('blocked');
  });

  test('a page.route stub for http://localhost:11434/api/tags still answers (page route takes precedence)', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'qwen3:8b' }] })
      });
    });

    const data = await page.evaluate(async () => {
      const res = await fetch('http://localhost:11434/api/tags');
      return res.json();
    });

    expect(data).toEqual({ models: [{ name: 'qwen3:8b' }] });
  });
});
