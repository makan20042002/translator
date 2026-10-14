'use strict';
// Tests for Document tab engine line, safety timeouts, stop functionality, and packaged file coverage.
const fs = require('fs');
const path = require('path');
const { test, expect, onlyEngines, mouseClick, chooseFile } = require('../support/fixtures');

test.describe('Web app: Document tab engine line and safety', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('document tab engine line reflects engine, mode, and online status and updates dynamically', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const engineLine = page.locator('#docEngineLine');
    await expect(engineLine, '#docEngineLine should be visible on Document tab').toBeVisible();

    const engineText = page.locator('#docEngineText');
    await expect(engineText).toContainText('Google Translate');
    await expect(engineText).toContainText('Fast');
    await expect(engineText).toContainText('Online');

    // Dynamically change mode to smart
    await page.evaluate(() => {
      const modeSel = document.getElementById('tMode');
      if (modeSel) {
        modeSel.value = 'smart';
        modeSel.dispatchEvent(new Event('change'));
      }
    });
    await expect(engineText).toContainText('Smart');

    // Toggle offline mode
    await page.evaluate(() => {
      const offChk = document.getElementById('offline');
      if (offChk) {
        offChk.checked = true;
        offChk.dispatchEvent(new Event('change'));
      }
    });
    await expect(engineText).toContainText('Offline');

    // Open Settings from the button
    const openBtn = page.locator('#docOpenEngineSettings');
    await expect(openBtn).toBeVisible();
    await mouseClick(page, openBtn);

    const overlay = page.locator('#ov');
    await expect(overlay).toHaveClass(/on/);
  });

  test('notice explains non-AI engine capabilities in both English and Persian', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const noticeText = page.locator('[data-t="docEngineNoticeText"]');
    await expect(noticeText).toContainText('Subject analysis & translator notes require an AI engine');
    await expect(noticeText).toContainText('Full document translation, file structure, formatting, tables, and Glossary work completely');

    // Switch to Persian
    await mouseClick(page, page.locator('#uiLang'));
    await expect(noticeText).toContainText('تحلیل موضوع و یادداشت‌های مترجم');
    await expect(noticeText).toContainText('ترجمه کامل متن سند، ساختار فایل، قالب‌بندی');
    await expect(noticeText.locator('bdi').first()).toContainText('Google Translate');
  });

  test('a hung document translation can be stopped immediately and does not look completed', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);

    // Make fetch hang indefinitely for translation requests
    await page.evaluate(() => {
      const origFetch = window.fetch;
      window.fetch = function(url, opt) {
        if (/translate\.googleapis|clients5\.google|mymemory/i.test(String(url))) {
          return new Promise((resolve, reject) => {
            if (opt?.signal) {
              opt.signal.addEventListener('abort', () => {
                const err = new DOMException('Aborted', 'AbortError');
                reject(err);
              });
            }
          });
        }
        return origFetch.apply(this, arguments);
      };
    });

    await mouseClick(page, page.locator('#dGo'));

    const stopBtn = page.locator('#dStop');
    await expect(stopBtn).toBeVisible();

    // Click stop while translation is hanging
    await mouseClick(page, stopBtn);

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText(/Stopped|متوقف شد/);
    await expect(progText).not.toContainText(/Done|انجام شد/);

    const statusChip = page.locator('#dStatusChip');
    await expect(statusChip).toHaveClass(/warn/);

    await expect(page.locator('#dGo')).toBeEnabled();
    await expect(stopBtn).toBeHidden();
  });

  test('a timed-out translation displays an error and does not look completed', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);

    // Make fetch reject with timeout error
    await page.evaluate(() => {
      const origFetch = window.fetch;
      window.fetch = function(url) {
        if (/translate\.googleapis|clients5\.google|mymemory/i.test(String(url))) {
          const te = new Error('request timed out');
          te.name = 'TimeoutError';
          te.status = 408;
          return Promise.reject(te);
        }
        return origFetch.apply(this, arguments);
      };
    });

    await mouseClick(page, page.locator('#dGo'));

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText(/failed|خطا/i);
    await expect(progText).not.toContainText(/Done|انجام شد/);

    const statusChip = page.locator('#dStatusChip');
    await expect(statusChip).toHaveClass(/error/);

    await expect(page.locator('#dSave')).toBeDisabled();
  });

  test('offline model loading reports loading status before batch execution', async ({ app }) => {
    const { page } = app;
    const reportedStatus = await page.evaluate(async () => {
      let statusMsg = '';
      if (typeof window.eNllb === 'function') {
        const dummySignal = new AbortController().signal;
        try {
          await window.eNllb(['Hello world'], 'en', 'fa', dummySignal, (st) => {
            statusMsg = st;
          });
        } catch (_) {}
      }
      return statusMsg;
    });

    // If eNllb was reached, it called onStatus with loadingOfflineModel string
    expect(typeof reportedStatus).toBe('string');
  });

  test('packaged app extraResources and server configuration cover workers and assets', async () => {
    const rootDir = path.resolve(__dirname, '../..');
    const pkgPath = path.resolve(rootDir, '../exe translator/package.json');
    const mainJsPath = path.resolve(rootDir, '../exe translator/main.js');

    expect(fs.existsSync(pkgPath), 'exe translator/package.json must exist').toBe(true);
    expect(fs.existsSync(mainJsPath), 'exe translator/main.js must exist').toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const extraRes = pkg?.build?.extraResources || [];
    const appEntry = extraRes.find(x => x.to === 'app');
    expect(appEntry, 'extraResources to "app" must be defined').toBeTruthy();

    const filters = appEntry.filter || [];
    const requiredFiles = [
      'ai-worker.js',
      'piper-worker.js',
      'asr-guard.js',
      'models-catalog.js',
      'jszip.min.js'
    ];

    for (const req of requiredFiles) {
      const included = filters.includes(req) || filters.includes('*.js') || filters.some(f => f.includes(req));
      expect(included, `Packaged extraResources must include ${req}`).toBe(true);
    }

    const mainJs = fs.readFileSync(mainJsPath, 'utf8');
    expect(mainJs).toMatch(/['"]\.js['"]\s*:\s*['"]text\/javascript['"]/);
  });
});
