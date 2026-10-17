'use strict';
// Voice tab working timeout scales with text length for long inputs and rearms on Auto chain fallback.
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Web app: Voice tab working timeout scaling', () => {
  test('voiceWorkingLimitMs calculates correct timeout for various text lengths', async ({ app }) => {
    const { page } = app;
    const results = await page.evaluate(() => {
      const fn = window.voiceWorkingLimitMs;
      return {
        hasFn: typeof fn === 'function',
        hasRearm: typeof window.voiceChainRearm === 'function',
        len0: fn(0),
        len200: fn(200),
        len201: fn(201),
        len2000: fn(2000),
        len5000: fn(5000),
        len100000: fn(100000),
      };
    });

    expect(results.hasFn).toBe(true);
    expect(results.hasRearm).toBe(true);
    expect(results.len0).toBe(20000);
    expect(results.len200).toBe(20000);
    expect(results.len201).toBe(20025);
    expect(results.len2000).toBe(65000);
    expect(results.len5000).toBe(90000);
    expect(results.len100000).toBe(90000);
  });

  test('Voice tab stays in working state at 25s for 2000 chars and shows "Still translating…"', async ({ app }) => {
    const { page } = app;
    await page.clock.install();
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    await page.evaluate(() => {
      // Simulate initiating working state with long text limit (65000 ms)
      const limit = window.voiceWorkingLimitMs(2000);
      setVoiceState('working', 'Translating…');
      armWorking(limit);
    });

    const statusLine = page.locator('#vStatusLine');
    const statusText = page.locator('#vStatusText');

    await expect(statusLine).toHaveAttribute('data-state', 'working');
    await expect(statusText).toHaveText('Translating…');

    // Advance clock past 20s (e.g. 21s)
    await page.clock.fastForward(21000);

    // Should remain in working state, not ready, and show "Still translating…"
    await expect(statusLine).toHaveAttribute('data-state', 'working');
    await expect(statusText).toContainText('Still translating');

    // Advance clock past 25s (total 26s) - still working because limit is 65s
    await page.clock.fastForward(5000);
    await expect(statusLine).toHaveAttribute('data-state', 'working');

    // Test rearm resets the timer
    await page.evaluate(() => {
      window.voiceChainRearm();
    });
    await expect(statusLine).toHaveAttribute('data-state', 'working');

    // Advance past limit (65s total from rearm) -> should timeout and return to ready
    await page.clock.fastForward(66000);
    await expect(statusLine).toHaveAttribute('data-state', 'ready');
  });

  test('Voice tab times out at 20s for short text', async ({ app }) => {
    const { page } = app;
    await page.clock.install();
    await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

    await page.evaluate(() => {
      const limit = window.voiceWorkingLimitMs(50); // 20000 ms
      setVoiceState('working', 'Translating…');
      armWorking(limit);
    });

    const statusLine = page.locator('#vStatusLine');

    await expect(statusLine).toHaveAttribute('data-state', 'working');

    // Advance 21 seconds -> exceeds 20s limit -> times out and returns to ready
    await page.clock.fastForward(21000);
    await expect(statusLine).toHaveAttribute('data-state', 'ready');
  });
});
