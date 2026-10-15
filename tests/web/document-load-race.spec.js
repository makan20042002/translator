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

async function installDocLog(page) {
  await page.evaluate(() => {
    window.__docLog = [];
    window.__docLogStart = performance.now();
    const progEl = document.getElementById('dProgText');
    const chipEl = document.getElementById('dStatusChip');
    window.__docLog.push({
      t: 0,
      text: progEl ? progEl.textContent : null,
      chipClass: chipEl ? chipEl.className : null
    });
    if (window.__docObserver) {
      window.__docObserver.disconnect();
    }
    const obs = new MutationObserver(() => {
      window.__docLog.push({
        t: Math.round(performance.now() - window.__docLogStart),
        text: progEl ? progEl.textContent : null,
        chipClass: chipEl ? chipEl.className : null
      });
    });
    if (progEl) obs.observe(progEl, { childList: true, characterData: true, subtree: true });
    if (chipEl) obs.observe(chipEl, { attributes: true, attributeFilter: ['class'] });
    window.__docObserver = obs;
  });
}

async function getDocLog(page) {
  return page.evaluate(() => window.__docLog || []);
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

      await installDocLog(page);
      await mouseClick(page, page.locator('#dGo'));

      const progText = page.locator('#dProgText');
      await expect(progText, 'iteration ' + i + ' timeline: ' + JSON.stringify(await getDocLog(page)) + ': #dProgText contains Tried:').toContainText('Tried:');

      // Assert from timeline that "Tried:" appeared at least once and never reverted to "Ready to translate" / "آماده ترجمه"
      let log = await getDocLog(page);
      const triedIdx = log.findIndex(e => e.text && e.text.includes('Tried:'));
      expect(triedIdx >= 0, 'iteration ' + i + ' timeline: ' + JSON.stringify(log) + ': Tried: appeared at least once').toBe(true);
      const reverted = log.slice(triedIdx + 1).find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
      expect(reverted, 'iteration ' + i + ' timeline: ' + JSON.stringify(log) + ': no entry after Tried: contains Ready to translate').toBeUndefined();

      // Poll #dProgText for 2 seconds and require that it contains "Tried:" and never goes back to "Ready to translate"
      const start = Date.now();
      while (Date.now() - start < 2000) {
        const text = await progText.textContent();
        const currentLog = await getDocLog(page);
        expect(text, 'iteration ' + i + ' timeline: ' + JSON.stringify(currentLog) + ': #dProgText retains Tried:').toContain('Tried:');
        expect(text, 'iteration ' + i + ' timeline: ' + JSON.stringify(currentLog) + ': #dProgText does not revert to Ready to translate').not.toContain('Ready to translate');
        await page.waitForTimeout(100);
      }

      const finalLog = await getDocLog(page);
      const finalTriedIdx = finalLog.findIndex(e => e.text && e.text.includes('Tried:'));
      expect(finalTriedIdx >= 0, 'iteration ' + i + ' timeline: ' + JSON.stringify(finalLog) + ': Tried: appeared at least once in final log').toBe(true);
      const finalReverted = finalLog.slice(finalTriedIdx + 1).find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
      expect(finalReverted, 'iteration ' + i + ' timeline: ' + JSON.stringify(finalLog) + ': no entry after Tried: contains Ready to translate in final log').toBeUndefined();

      const calls = appCalls(stub);
      expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'iteration ' + i + ' timeline: ' + JSON.stringify(finalLog) + ': zero engine requests').toEqual([]);
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

    await installDocLog(page);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText, 'timeline: ' + JSON.stringify(await getDocLog(page)) + ': #dProgText contains Tried:').toContainText('Tried:');

    let log = await getDocLog(page);
    const triedIdx = log.findIndex(e => e.text && e.text.includes('Tried:'));
    expect(triedIdx >= 0, 'timeline: ' + JSON.stringify(log) + ': Tried: appeared at least once').toBe(true);
    const reverted = log.slice(triedIdx + 1).find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
    expect(reverted, 'timeline: ' + JSON.stringify(log) + ': no entry after Tried: contains Ready to translate').toBeUndefined();

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      const currentLog = await getDocLog(page);
      expect(text, 'timeline: ' + JSON.stringify(currentLog) + ': #dProgText retains Tried:').toContain('Tried:');
      expect(text, 'timeline: ' + JSON.stringify(currentLog) + ': #dProgText does not revert to Ready to translate').not.toContain('Ready to translate');
      await page.waitForTimeout(100);
    }

    const finalLog = await getDocLog(page);
    const finalTriedIdx = finalLog.findIndex(e => e.text && e.text.includes('Tried:'));
    expect(finalTriedIdx >= 0, 'timeline: ' + JSON.stringify(finalLog) + ': Tried: appeared at least once in final log').toBe(true);
    const finalReverted = finalLog.slice(finalTriedIdx + 1).find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
    expect(finalReverted, 'timeline: ' + JSON.stringify(finalLog) + ': no entry after Tried: contains Ready to translate in final log').toBeUndefined();

    const calls = appCalls(stub);
    expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'timeline: ' + JSON.stringify(finalLog) + ': zero engine requests').toEqual([]);
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

    await installDocLog(page);
    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText, 'timeline: ' + JSON.stringify(await getDocLog(page)) + ': contains Persian failure lead').toContainText('موتورهای امتحان‌شده:');
    await expect(progText, 'timeline: ' + JSON.stringify(await getDocLog(page)) + ': contains Persian reason').toContainText('خاموش در موتورها و کلیدها');

    let log = await getDocLog(page);
    const triedIdx = log.findIndex(e => e.text && e.text.includes('موتورهای امتحان‌شده:'));
    expect(triedIdx >= 0, 'timeline: ' + JSON.stringify(log) + ': Persian failure line appeared at least once').toBe(true);
    const reverted = log.slice(triedIdx + 1).find(e => e.text && (e.text.includes('آماده ترجمه') || e.text.includes('Ready to translate')));
    expect(reverted, 'timeline: ' + JSON.stringify(log) + ': no entry after failure line contains ready text').toBeUndefined();

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      const currentLog = await getDocLog(page);
      expect(text, 'timeline: ' + JSON.stringify(currentLog) + ': retains Persian failure lead').toContain('موتورهای امتحان‌شده:');
      expect(text, 'timeline: ' + JSON.stringify(currentLog) + ': does not revert to Persian ready text').not.toContain('آماده ترجمه');
      expect(text, 'timeline: ' + JSON.stringify(currentLog) + ': does not revert to English ready text').not.toContain('Ready to translate');
      await page.waitForTimeout(100);
    }

    const finalLog = await getDocLog(page);
    const finalTriedIdx = finalLog.findIndex(e => e.text && e.text.includes('موتورهای امتحان‌شده:'));
    expect(finalTriedIdx >= 0, 'timeline: ' + JSON.stringify(finalLog) + ': Persian failure line appeared at least once in final log').toBe(true);
    const finalReverted = finalLog.slice(finalTriedIdx + 1).find(e => e.text && (e.text.includes('آماده ترجمه') || e.text.includes('Ready to translate')));
    expect(finalReverted, 'timeline: ' + JSON.stringify(finalLog) + ': no entry after failure line contains ready text in final log').toBeUndefined();

    const calls = appCalls(stub);
    expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'timeline: ' + JSON.stringify(finalLog) + ': zero engine requests').toEqual([]);
  });
});
