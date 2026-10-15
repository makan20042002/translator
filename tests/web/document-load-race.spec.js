'use strict';
const { test, expect, mouseClick, chooseFile, onlyEngines } = require('../support/fixtures');

// Chromium's own background traffic (sign-in check and device check-in) carries no app data.
function appCalls(stub) {
  return stub.calls().filter(c => c.host !== 'accounts.google.com' && c.host !== 'android.clients.google.com');
}

async function ensureOfflineOn(page) {
  const offBtn = page.locator('#offBtn');
  const isAlreadyOn = await offBtn.evaluate(el => el.classList.contains('on'));
  if (!isAlreadyOn) {
    await mouseClick(page, offBtn);
  }
}

test.describe('Document tab load race condition under rapid clicks', () => {
  test.use({
    appOptions: {
      seed: {
        cfg: Object.assign(onlyEngines(['google', 'mymemory', 'ollama', 'nllb']), { offline: true }),
        src: 'en',
        tgt: 'fa'
      }
    }
  });

  test.setTimeout(90000);

  test('rapid click on #dGo immediately after file chooser shows Tried: and never reverts to Ready to translate across 8 iterations', async ({ app, files, stub }) => {
    const { page } = app;
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    for (let i = 0; i < 8; i++) {
      if (i === 0 || i % 2 === 0) {
        await page.goto(stub.appUrl);
        await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      }

      await ensureOfflineOn(page);

      const offBtn = page.locator('#offBtn');
      await expect(offBtn, 'iteration ' + i + ': #offBtn has on class').toHaveClass(/\bon\b/);
      const netPill = page.locator('#docEngineText .doc-engine-net-pill');
      await expect(netPill, 'iteration ' + i + ': net indicator is offline').toHaveClass(/\boffline\b/);

      stub.clearLog();

      if (i === 0 || i % 2 === 0) {
        await chooseFile(page, page.locator('#dDrop'), files.txt);
      } else {
        await chooseFile(page, page.locator('#dChangeFile'), files.txt);
      }

      await mouseClick(page, page.locator('#dGo'));

      const progText = page.locator('#dProgText');
      await expect(progText, 'iteration ' + i + ': #dProgText contains Tried:').toContainText('Tried:');

      // Poll #dProgText for 2 seconds and require that it contains "Tried:" and never goes back to "Ready to translate"
      const start = Date.now();
      while (Date.now() - start < 2000) {
        const text = await progText.textContent();
        expect(text, 'iteration ' + i + ': #dProgText retains Tried:').toContain('Tried:');
        expect(text, 'iteration ' + i + ': #dProgText does not revert to Ready to translate').not.toContain('Ready to translate');
        await page.waitForTimeout(100);
      }

      const calls = appCalls(stub);
      expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'iteration ' + i + ': zero engine requests').toEqual([]);
    }
  });

  test('variant where a second file is chosen right after the first', async ({ app, files, stub }) => {
    const { page } = app;
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await ensureOfflineOn(page);

    await expect(page.locator('#offBtn')).toHaveClass(/\bon\b/);
    await expect(page.locator('#docEngineText .doc-engine-net-pill')).toHaveClass(/\boffline\b/);

    stub.clearLog();

    // Choose first file, then immediately choose second file
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await chooseFile(page, page.locator('#dChangeFile'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('Tried:');

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      expect(text).toContain('Tried:');
      expect(text).not.toContain('Ready to translate');
      await page.waitForTimeout(100);
    }

    const calls = appCalls(stub);
    expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c)))).toEqual([]);
  });

  test('Persian run shows Persian failure line and never reverts to ready text', async ({ app, files, stub }) => {
    const { page } = app;
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await ensureOfflineOn(page);
    await mouseClick(page, page.locator('#uiLang'));

    await expect(page.locator('#offBtn')).toHaveClass(/\bon\b/);
    await expect(page.locator('#docEngineText .doc-engine-net-pill')).toHaveClass(/\boffline\b/);

    stub.clearLog();

    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('موتورهای امتحان‌شده:');
    await expect(progText).toContainText('خاموش در موتورها و کلیدها');

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      expect(text).toContain('موتورهای امتحان‌شده:');
      expect(text).not.toContain('آماده ترجمه');
      expect(text).not.toContain('Ready to translate');
      await page.waitForTimeout(100);
    }

    const calls = appCalls(stub);
    expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c)))).toEqual([]);
  });
});
