'use strict';

/**
 * tests/web/asr-guard-loads.spec.js
 * Validates ITEM 5:
 * - asr-guard.js loads without any 404 in root hosting and subfolder hosting.
 * - asrGuard functions (collapseRepeats, looksRunaway, maxTokensFor, asrBudgetMs)
 *   are non-null and used by the transcription path.
 * - Runaway repeated-text output from a faked Whisper worker is collapsed
 *   to a single copy according to real asr-guard behavior.
 * - In /translate/app/ subfolder deployment, asr-guard.js returns status 200.
 */

const { test, expect } = require('../support/fixtures');
const { chromium } = require('@playwright/test');
const { startPrefixServer, PREFIX } = require('../support/prefix-server');

test.describe('ASR Guard Loading & Behavior (ITEM 5)', () => {
  test('asr-guard module loads without 404 and exports expected guard functions', async ({ app }) => {
    const { page } = app;

    const httpFailures = [];
    page.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('/api/sync_keys')) {
        httpFailures.push(`${res.request().method()} ${res.url()} -> ${res.status()}`);
      }
    });

    // Verify asrGuard promise resolves to real module on page
    const guardLoaded = await page.evaluate(async () => {
      const getGuard = window.getAsrGuard;
      if (!getGuard) return { ok: false, reason: 'window.getAsrGuard missing' };
      const g = await getGuard();
      if (!g) return { ok: false, reason: 'asrGuard resolved to null' };
      return {
        ok: true,
        hasCollapseRepeats: typeof g.collapseRepeats === 'function',
        hasLooksRunaway: typeof g.looksRunaway === 'function',
        hasMaxTokensFor: typeof g.maxTokensFor === 'function',
        hasAsrBudgetMs: typeof g.asrBudgetMs === 'function',
        sampleCollapse: g.collapseRepeats('Thank you. '.repeat(10)),
        sampleNormal: g.collapseRepeats('It was very very very good, no no no.')
      };
    });

    expect(guardLoaded.ok, guardLoaded.reason).toBe(true);
    expect(guardLoaded.hasCollapseRepeats).toBe(true);
    expect(guardLoaded.hasLooksRunaway).toBe(true);
    expect(guardLoaded.hasMaxTokensFor).toBe(true);
    expect(guardLoaded.hasAsrBudgetMs).toBe(true);
    expect(guardLoaded.sampleCollapse).toBe('Thank you.');
    expect(guardLoaded.sampleNormal).toBe('It was very very very good, no no no.');
    expect(httpFailures).toEqual([]);
  });

  test('transcription path collapses runaway repeated text from a faked Whisper worker', async ({ app }) => {
    const { page } = app;

    const result = await page.evaluate(async () => {
      // Mock worker that returns runaway repeated text
      class MockWhisperWorker {
        constructor() {
          this.onmessage = null;
        }
        postMessage(data) {
          const { id, cmd } = data;
          if (cmd === 'loadAsr') {
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 5);
          } else if (cmd === 'asr') {
            setTimeout(() => {
              this.onmessage?.({
                data: {
                  id,
                  ok: true,
                  res: {
                    text: 'and then we went home and then we went home and then we went home and then we went home and then we went home',
                    lang: 'en'
                  }
                }
              });
            }, 5);
          }
        }
        terminate() {}
      }

      window.Worker = MockWhisperWorker;

      // Invoke real rpc call in translate.js
      return await rpc('asr', {
        model: 'base',
        audio: new Float32Array(16000 * 3)
      });
    });

    expect(result).toBeDefined();
    const text = typeof result === 'object' ? result.text : result;
    expect(text).toBe('and then we went home');
  });

  test('subfolder deployment (/translate/app/) requests asr-guard.js with HTTP 200 and no 404', async () => {
    const serverInfo = await startPrefixServer();
    const browser = await chromium.launch({
      headless: true,
      args: ['--allow-insecure-localhost', '--disable-web-security']
    });

    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      const responses = [];
      const httpFailures = [];

      page.on('response', res => {
        const url = res.url();
        const status = res.status();
        responses.push({ url, status });
        if (status >= 400 && !url.includes('/api/sync_keys')) {
          httpFailures.push(`${res.request().method()} ${url} -> ${status}`);
        }
      });

      await page.goto(serverInfo.baseUrl, { waitUntil: 'load' });
      await expect(page.locator('#tabs button').first()).toBeVisible();

      // Zero HTTP failures
      expect(httpFailures).toEqual([]);

      // asr-guard.js must be requested and returned with 200
      const guardResp = responses.find(r => r.url.includes('asr-guard.js'));
      expect(guardResp, 'asr-guard.js must be in response list').toBeDefined();
      expect(guardResp.status).toBe(200);

      // Verify request logged by prefix-server
      const serverGuardReq = serverInfo.requests.find(r => r.pathname === PREFIX + 'asr-guard.js' || r.pathname.endsWith('/asr-guard.js'));
      expect(serverGuardReq, 'prefix server must record asr-guard.js request').toBeDefined();

      await context.close();
    } finally {
      await browser.close();
      await serverInfo.close();
    }
  });
});
