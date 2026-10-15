'use strict';
const { test, expect, onlyEngines, mouseClick, chooseFile } = require('../support/fixtures');

test.describe('Document tab with no usable engine in offline mode', () => {
  test.use({
    appOptions: {
      seed: {
        cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']),
        src: 'en',
        tgt: 'fa'
      }
    }
  });

  test('failure line stays visible for 3 seconds with error status and zero network requests in English and Persian', async ({ app, files, stub }) => {
    const { page } = app;

    // Isolate from local Ollama and remote hosts
    await page.route('**/api/tags', route => route.abort('connectionrefused'));
    await page.route('**/v1/**', route => route.abort('connectionrefused'));
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    // 1. English UI with Offline mode on
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const offBtn = page.locator('#offBtn');
    await mouseClick(page, offBtn);

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();

    const before = stub.calls().length;
    console.log('calls before click (en):', before);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    const chip = page.locator('#dStatusChip');
    const chipText = page.locator('#dStatusText');
    const goBtn = page.locator('#dGo');
    const saveBtn = page.locator('#dSave');

    // Poll several times across 3 seconds to verify failure line stays visible
    for (let i = 0; i < 6; i++) {
      await expect(progText).toContainText('Tried:');
      await expect(progText).toContainText('Chrome on-device (turned off in Engines & keys)');
      await expect(progText).toContainText('Choose an engine under Translate with, or open Engines & keys.');
      await expect(chip).toHaveClass(/error/);
      await expect(chipText).toHaveText(/Error/i);
      await expect(goBtn).toBeEnabled();
      await expect(saveBtn).toBeDisabled();
      await page.waitForTimeout(500);
    }

    // Verify 0 online requests sent
    expect(stub.calls().map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'calls before click: ' + before).toEqual([]);

    // 2. Persian UI
    await mouseClick(page, page.locator('#uiLang'));

    const beforeFa = stub.calls().length;
    console.log('calls before click (fa):', beforeFa);
    await mouseClick(page, goBtn);

    // Poll several times across 3 seconds in Persian
    for (let i = 0; i < 6; i++) {
      await expect(progText).toContainText('موتورهای امتحان‌شده:');
      await expect(progText).toContainText('خاموش در موتورها و کلیدها');
      await expect(progText).toContainText('یک موتور در «ترجمه با» انتخاب کنید یا «موتورها و کلیدها» را باز کنید.');
      await expect(chip).toHaveClass(/error/);
      await expect(chipText).toHaveText('خطا');
      await expect(goBtn).toBeEnabled();
      await expect(saveBtn).toBeDisabled();
      await page.waitForTimeout(500);
    }

    // Zero online requests sent throughout
    expect(stub.calls().map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'calls before click: ' + beforeFa).toEqual([]);
  });
});
