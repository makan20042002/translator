'use strict';

/**
 * tests/web/engine-test-button.spec.js
 * ITEM 3: Test button next to engine picker.
 */

const { test, expect, mouseClick, chooseFile } = require('../support/fixtures');

test.describe('Engine Test Button (ITEM 3)', () => {

  test('success path with stubbed google endpoint shows translated text and time, and touches no history', async ({ app, files }) => {
    const { page, stub } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const select = picker.locator('.engine-picker-select');
    await select.selectOption('google');

    // Intercept Google endpoint
    await page.route('https://clients5.google.com/translate_a/t*', async route => {
      const postData = route.request().postData() || '';
      const form = new URLSearchParams(postData);
      const qs = form.getAll('q');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(qs.map(s => '[fa] ' + s))
      });
    });

    const testBtn = picker.locator('.engine-picker-test-btn');
    const statusEl = picker.locator('.engine-picker-status');

    // Initial history check
    const initialHist = await page.evaluate(() => store.get('hist', []));
    expect(initialHist).toEqual([]);

    await mouseClick(page, testBtn);

    await expect(statusEl).toBeVisible();
    await expect(statusEl).toContainText('[fa] Hello, how are you?');
    await expect(statusEl).toHaveText(/\(\d+\.\d+s\)/);

    // Assert nothing was written to History
    const afterHist = await page.evaluate(() => store.get('hist', []));
    expect(afterHist).toEqual([]);
  });

  test('failure path shows plain reason without leaking keys', async ({ app, files }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const select = picker.locator('.engine-picker-select');
    await select.selectOption('google');

    // Route Google to return 500 error
    await page.route('https://clients5.google.com/translate_a/t*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error'
      });
    });

    const testBtn = picker.locator('.engine-picker-test-btn');
    const statusEl = picker.locator('.engine-picker-status');

    await mouseClick(page, testBtn);

    await expect(statusEl).toBeVisible();
    const statusText = await statusEl.textContent();
    expect(statusText.length).toBeGreaterThan(0);
    // Secret pattern check: no API keys in status text
    expect(statusText).not.toMatch(/(?:AIza[0-9A-Za-z_-]{35}|(?:sk|gsk)_[a-zA-Z0-9_-]{20,})/);
  });

  test('clicking while running cancels test without sending second request', async ({ app, files }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const select = picker.locator('.engine-picker-select');
    await select.selectOption('google');

    let requestCount = 0;
    await page.route('https://clients5.google.com/translate_a/t*', async route => {
      requestCount++;
      // Delayed response so we can click again to cancel
      await new Promise(r => setTimeout(r, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['[fa] Hello, how are you?'])
      });
    });

    const testBtn = picker.locator('.engine-picker-test-btn');
    const statusEl = picker.locator('.engine-picker-status');

    // First click: starts test
    await mouseClick(page, testBtn);
    await expect(testBtn).toHaveText('Stop');

    // Second click: cancels running test
    await mouseClick(page, testBtn);
    await expect(testBtn).toHaveText('Test');
    await expect(statusEl).toContainText('Cancelled.');

    // Only one request was initiated before cancel
    expect(requestCount).toBe(1);
  });

  test('displays correct strings in EN and FA for Test button and status', async ({ app, files }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const testBtn = picker.locator('.engine-picker-test-btn');

    // EN mode
    await expect(testBtn).toHaveText('Test');

    // Switch to FA
    await page.locator('#uiLang').click();
    await expect(testBtn).toHaveText('آزمایش');
  });

  test('cancelling test in Persian interface displays Persian cancellation status', async ({ app, files }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    const picker = page.locator('#subEnginePickerHost .engine-picker');
    const select = picker.locator('.engine-picker-select');
    await select.selectOption('google');

    // Switch to FA
    await page.locator('#uiLang').click();

    await page.route('https://clients5.google.com/translate_a/t*', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['[fa] Hello, how are you?'])
      });
    });

    const testBtn = picker.locator('.engine-picker-test-btn');
    const statusEl = picker.locator('.engine-picker-status');

    await mouseClick(page, testBtn);
    await mouseClick(page, testBtn);
    await expect(statusEl).toContainText('لغو شد.');
  });
});
