'use strict';
/**
 * ITEM 1: Tests for ollamaStatus function in settings:
 * - ok: reachable, >=1 model
 * - noModels: reachable, empty list
 * - unreachable: nothing answered
 * - timeout: stub delayed 4 s must still be 'ok' with the 6 s default, and request exceeding timeout returns 'timeout'
 * - localhost failing + 127.0.0.1 answering -> 'ok'
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Web app: ollamaStatus honesty and host fallback', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['ollama']), src: 'en', tgt: 'fa' } } });

  test('status returns ok when Ollama answers with models', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{ name: 'translategemma:4b' }, { name: 'qwen3:8b' }]
        })
      });
    });

    const res = await page.evaluate(async () => {
      return await ollamaStatus();
    });

    expect(res.state).toBe('ok');
    expect(res.host).toBe('http://localhost:11434');
    expect(res.models).toEqual(['translategemma:4b', 'qwen3:8b']);
    expect(res.tried).toContain('http://localhost:11434');
  });

  test('status returns noModels when Ollama has no models installed', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] })
      });
    });

    const res = await page.evaluate(async () => {
      return await ollamaStatus();
    });

    expect(res.state).toBe('noModels');
    expect(res.host).toBe('http://localhost:11434');
    expect(res.models).toEqual([]);
    expect(res.tried).toContain('http://localhost:11434');
  });

  test('status returns unreachable when nothing answers on localhost or 127.0.0.1', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:11434/**', route => route.abort('connectionrefused'));

    const res = await page.evaluate(async () => {
      return await ollamaStatus({ timeoutMs: 1500 });
    });

    expect(res.state).toBe('unreachable');
    expect(res.host).toBeNull();
    expect(res.models).toEqual([]);
    expect(res.tried).toEqual(['http://localhost:11434', 'http://127.0.0.1:11434']);
  });

  test('stub delayed 4 s is ok with 6 s default, and request exceeding timeout returns timeout', async ({ app }) => {
    const { page } = app;
    // 1) 4 s delay must still be 'ok' with the 6 s default
    await page.route('http://localhost:11434/api/tags', async route => {
      await new Promise(r => setTimeout(r, 4000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'translategemma:4b' }] })
      });
    });

    const resDelayed = await page.evaluate(async () => {
      return await ollamaStatus({ timeoutMs: 6000 });
    });
    expect(resDelayed.state).toBe('ok');
    expect(resDelayed.models).toEqual(['translategemma:4b']);

    // 2) request exceeding timeout returns 'timeout'
    await page.unroute('http://localhost:11434/api/tags');
    await page.route('http://localhost:11434/**', async () => {
      // Hang indefinitely
      await new Promise(r => setTimeout(r, 10000));
    });

    const resTimeout = await page.evaluate(async () => {
      return await ollamaStatus({ timeoutMs: 800 });
    });
    expect(resTimeout.state).toBe('timeout');
    expect(resTimeout.host).toBeNull();
  });

  test('localhost failing and 127.0.0.1 answering returns ok', async ({ app }) => {
    const { page } = app;
    await page.route('http://localhost:11434/**', route => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:11434/api/tags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'gemma4:12b' }] })
      });
    });

    const res = await page.evaluate(async () => {
      return await ollamaStatus({ timeoutMs: 4000 });
    });

    expect(res.state).toBe('ok');
    expect(res.host).toBe('http://127.0.0.1:11434');
    expect(res.models).toEqual(['gemma4:12b']);
    expect(res.tried).toEqual(['http://localhost:11434', 'http://127.0.0.1:11434']);
  });
});
