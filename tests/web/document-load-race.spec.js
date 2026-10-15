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
    const progEl = document.getElementById('dProgText');
    const chipEl = document.getElementById('dStatusChip');
    const dGo = document.getElementById('dGo');

    window.__docLog = [];
    window.__docLog.initial = {
      text: progEl ? progEl.textContent : null,
      chipClass: chipEl ? chipEl.className : null
    };
    window.__docLogStart = performance.now();
    window.__docClickTime = null;

    if (window.__docClickHandler && dGo) {
      dGo.removeEventListener('click', window.__docClickHandler, true);
      dGo.removeEventListener('pointerdown', window.__docClickHandler, true);
    }

    const markClick = () => {
      if (window.__docClickTime === null) {
        window.__docClickTime = performance.now();
        if (Array.isArray(window.__docLog)) {
          for (const ev of window.__docLog) {
            if (typeof ev._time === 'number') {
              ev.t = Math.round(ev._time - window.__docClickTime);
            }
          }
        }
      }
    };
    window.__docClickHandler = markClick;

    if (dGo) {
      dGo.addEventListener('pointerdown', markClick, { capture: true });
      dGo.addEventListener('click', markClick, { capture: true });
    }

    if (window.__docObserver) {
      window.__docObserver.disconnect();
    }
    const obs = new MutationObserver(() => {
      const now = performance.now();
      const clickTime = window.__docClickTime;
      const t = clickTime !== null
        ? Math.round(now - clickTime)
        : Math.round(now - window.__docLogStart);
      window.__docLog.push({
        t,
        _time: now,
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
  return page.evaluate(() => {
    const raw = window.__docLog || [];
    const clickTime = window.__docClickTime;
    const startTime = window.__docLogStart;
    const events = raw.map(e => ({
      t: clickTime !== null ? Math.round(e._time - clickTime) : (typeof e.t === 'number' ? e.t : Math.round(e._time - startTime)),
      text: e.text,
      chipClass: e.chipClass
    }));
    return {
      initial: raw.initial ? { ...raw.initial } : null,
      events
    };
  });
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
      const statusChip = page.locator('#dStatusChip');
      let log = await getDocLog(page);
      await expect(progText, 'iteration ' + i + ' initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': #dProgText contains Tried:').toContainText('Tried:');

      // Assert from timeline that "Tried:" appeared at least once after click and never reverted to "Ready to translate" / "آماده ترجمه"
      log = await getDocLog(page);
      const postClickTried = log.events.find(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
      expect(postClickTried, 'iteration ' + i + ' initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': at least one event containing Tried: after click').toBeDefined();

      const firstTriedIdx = log.events.findIndex(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
      expect(firstTriedIdx >= 0, 'iteration ' + i + ' initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': Tried: appeared at least once after click').toBe(true);

      const eventsAfterFirstTried = log.events.slice(firstTriedIdx + 1);
      const reverted = eventsAfterFirstTried.find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
      expect(reverted, 'iteration ' + i + ' initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': no entry after Tried: contains Ready to translate').toBeUndefined();

      const idleReturned = eventsAfterFirstTried.find(e => e.chipClass && e.chipClass.includes('idle'));
      expect(idleReturned, 'iteration ' + i + ' initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': chip class must not return to idle').toBeUndefined();

      // Poll #dProgText for 2 seconds and require that it contains "Tried:" and never goes back to "Ready to translate"
      const start = Date.now();
      while (Date.now() - start < 2000) {
        const text = await progText.textContent();
        const currentChipClass = await statusChip.getAttribute('class');
        const currentLog = await getDocLog(page);
        expect(text, 'iteration ' + i + ' initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': #dProgText retains Tried:').toContain('Tried:');
        expect(text, 'iteration ' + i + ' initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': #dProgText does not revert to Ready to translate').not.toContain('Ready to translate');
        expect(currentChipClass, 'iteration ' + i + ' initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': chip class does not return to idle').not.toContain('idle');
        await page.waitForTimeout(100);
      }

      const finalLog = await getDocLog(page);
      const finalPostClickTried = finalLog.events.find(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
      expect(finalPostClickTried, 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': at least one event containing Tried: after click in final log').toBeDefined();

      const finalFirstTriedIdx = finalLog.events.findIndex(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
      expect(finalFirstTriedIdx >= 0, 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': Tried: appeared at least once after click in final log').toBe(true);

      const finalEventsAfterFirstTried = finalLog.events.slice(finalFirstTriedIdx + 1);
      const finalReverted = finalEventsAfterFirstTried.find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
      expect(finalReverted, 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': no entry after Tried: contains Ready to translate in final log').toBeUndefined();

      const finalIdleReturned = finalEventsAfterFirstTried.find(e => e.chipClass && e.chipClass.includes('idle'));
      expect(finalIdleReturned, 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': chip class must not return to idle in final log').toBeUndefined();

      const finalText = await progText.textContent();
      const finalChipClass = await statusChip.getAttribute('class');
      expect(finalText, 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': final #dProgText contains Tried:').toContain('Tried:');
      expect(finalChipClass, 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': final chip class contains error').toContain('error');

      const calls = appCalls(stub);
      expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'iteration ' + i + ' initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': zero engine requests').toEqual([]);
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
    const statusChip = page.locator('#dStatusChip');
    let log = await getDocLog(page);
    await expect(progText, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': #dProgText contains Tried:').toContainText('Tried:');

    log = await getDocLog(page);
    const postClickTried = log.events.find(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
    expect(postClickTried, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': at least one event containing Tried: after click').toBeDefined();

    const firstTriedIdx = log.events.findIndex(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
    expect(firstTriedIdx >= 0, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': Tried: appeared at least once after click').toBe(true);

    const eventsAfterFirstTried = log.events.slice(firstTriedIdx + 1);
    const reverted = eventsAfterFirstTried.find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
    expect(reverted, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': no entry after Tried: contains Ready to translate').toBeUndefined();

    const idleReturned = eventsAfterFirstTried.find(e => e.chipClass && e.chipClass.includes('idle'));
    expect(idleReturned, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': chip class must not return to idle').toBeUndefined();

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      const currentChipClass = await statusChip.getAttribute('class');
      const currentLog = await getDocLog(page);
      expect(text, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': #dProgText retains Tried:').toContain('Tried:');
      expect(text, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': #dProgText does not revert to Ready to translate').not.toContain('Ready to translate');
      expect(currentChipClass, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': chip class does not return to idle').not.toContain('idle');
      await page.waitForTimeout(100);
    }

    const finalLog = await getDocLog(page);
    const finalPostClickTried = finalLog.events.find(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
    expect(finalPostClickTried, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': at least one event containing Tried: after click in final log').toBeDefined();

    const finalFirstTriedIdx = finalLog.events.findIndex(e => e.t >= 0 && e.text && e.text.includes('Tried:'));
    expect(finalFirstTriedIdx >= 0, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': Tried: appeared at least once after click in final log').toBe(true);

    const finalEventsAfterFirstTried = finalLog.events.slice(finalFirstTriedIdx + 1);
    const finalReverted = finalEventsAfterFirstTried.find(e => e.text && (e.text.includes('Ready to translate') || e.text.includes('آماده ترجمه')));
    expect(finalReverted, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': no entry after Tried: contains Ready to translate in final log').toBeUndefined();

    const finalIdleReturned = finalEventsAfterFirstTried.find(e => e.chipClass && e.chipClass.includes('idle'));
    expect(finalIdleReturned, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': chip class must not return to idle in final log').toBeUndefined();

    const finalText = await progText.textContent();
    const finalChipClass = await statusChip.getAttribute('class');
    expect(finalText, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': final #dProgText contains Tried:').toContain('Tried:');
    expect(finalChipClass, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': final chip class contains error').toContain('error');

    const calls = appCalls(stub);
    expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': zero engine requests').toEqual([]);
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
    const statusChip = page.locator('#dStatusChip');
    let log = await getDocLog(page);
    await expect(progText, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': contains Persian failure lead').toContainText('موتورهای امتحان‌شده:');
    await expect(progText, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': contains Persian reason').toContainText('خاموش در موتورها و کلیدها');

    log = await getDocLog(page);
    const isPersianTried = text => text && (text.includes('موتورهای امتحان‌شده') || text.includes('موتورهای امتحانشده'));
    const postClickTried = log.events.find(e => e.t >= 0 && isPersianTried(e.text));
    expect(postClickTried, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': Persian failure line appeared at least once after click').toBeDefined();

    const firstTriedIdx = log.events.findIndex(e => e.t >= 0 && isPersianTried(e.text));
    expect(firstTriedIdx >= 0, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': Persian failure line appeared at least once after click').toBe(true);

    const eventsAfterFirstTried = log.events.slice(firstTriedIdx + 1);
    const reverted = eventsAfterFirstTried.find(e => e.text && (e.text.includes('آماده ترجمه') || e.text.includes('Ready to translate')));
    expect(reverted, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': no entry after failure line contains ready text').toBeUndefined();

    const idleReturned = eventsAfterFirstTried.find(e => e.chipClass && e.chipClass.includes('idle'));
    expect(idleReturned, 'initial: ' + JSON.stringify(log.initial) + ' timeline: ' + JSON.stringify(log.events) + ': chip class must not return to idle').toBeUndefined();

    const start = Date.now();
    while (Date.now() - start < 2000) {
      const text = await progText.textContent();
      const currentChipClass = await statusChip.getAttribute('class');
      const currentLog = await getDocLog(page);
      expect(text, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': retains Persian failure lead').toContain('موتورهای امتحان‌شده:');
      expect(text, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': does not revert to Persian ready text').not.toContain('آماده ترجمه');
      expect(text, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': does not revert to English ready text').not.toContain('Ready to translate');
      expect(currentChipClass, 'initial: ' + JSON.stringify(currentLog.initial) + ' timeline: ' + JSON.stringify(currentLog.events) + ': chip class does not return to idle').not.toContain('idle');
      await page.waitForTimeout(100);
    }

    const finalLog = await getDocLog(page);
    const finalPostClickTried = finalLog.events.find(e => e.t >= 0 && isPersianTried(e.text));
    expect(finalPostClickTried, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': Persian failure line appeared at least once after click in final log').toBeDefined();

    const finalFirstTriedIdx = finalLog.events.findIndex(e => e.t >= 0 && isPersianTried(e.text));
    expect(finalFirstTriedIdx >= 0, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': Persian failure line appeared at least once after click in final log').toBe(true);

    const finalEventsAfterFirstTried = finalLog.events.slice(finalFirstTriedIdx + 1);
    const finalReverted = finalEventsAfterFirstTried.find(e => e.text && (e.text.includes('آماده ترجمه') || e.text.includes('Ready to translate')));
    expect(finalReverted, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': no entry after failure line contains ready text in final log').toBeUndefined();

    const finalIdleReturned = finalEventsAfterFirstTried.find(e => e.chipClass && e.chipClass.includes('idle'));
    expect(finalIdleReturned, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': chip class must not return to idle in final log').toBeUndefined();

    const finalText = await progText.textContent();
    const finalChipClass = await statusChip.getAttribute('class');
    expect(finalText, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': final #dProgText contains Persian failure lead').toContain('موتورهای امتحان‌شده:');
    expect(finalChipClass, 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': final chip class contains error').toContain('error');

    const calls = appCalls(stub);
    expect(calls.map(c => c.url || (c.host ? `${c.method} https://${c.host}${c.path}${c.query || ''}` : JSON.stringify(c))), 'initial: ' + JSON.stringify(finalLog.initial) + ' timeline: ' + JSON.stringify(finalLog.events) + ': zero engine requests').toEqual([]);
  });
});
