'use strict';
// Tests verifying that document translation groups short snippets into far fewer
// requests, shows live pieces progress, allows immediate Stop, and keeps all tables.
const fs = require('fs');
const os = require('os');
const path = require('path');
const d = require('docx');
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');
const { openOffice, count } = require('../support/office');

async function createDocxWith20Tables(filePath) {
  const tables = [];
  // 20 tables, each with 1 header row (4 cells) and 4 data rows (4 cells each) = 20 cells per table = 400 snippets total.
  for (let t = 0; t < 20; t++) {
    const rows = [
      new d.TableRow({
        children: [
          new d.TableCell({ children: [new d.Paragraph('Exercise')] }),
          new d.TableCell({ children: [new d.Paragraph('Sets')] }),
          new d.TableCell({ children: [new d.Paragraph('Reps')] }),
          new d.TableCell({ children: [new d.Paragraph('Rest')] })
        ]
      })
    ];
    for (let r = 0; r < 4; r++) {
      rows.push(new d.TableRow({
        children: [
          new d.TableCell({ children: [new d.Paragraph(`Movement ${r + 1}`)] }),
          new d.TableCell({ children: [new d.Paragraph(`${r + 3}`)] }),
          new d.TableCell({ children: [new d.Paragraph('10-12')] }),
          new d.TableCell({ children: [new d.Paragraph('60s')] })
        ]
      }));
    }
    tables.push(new d.Table({ rows }));
  }

  const doc = new d.Document({ sections: [{ children: tables }] });
  const buffer = await d.Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
}

test.describe('Web app: Document batching and deduplication', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('groups short snippets into far fewer requests than 400, shows live pieces progress, and preserves all 20 tables', async ({ app }) => {
    test.setTimeout(60000);
    const { page } = app;
    const tempFile = path.join(os.tmpdir(), `test-20-tables-${Date.now()}.docx`);
    await createDocxWith20Tables(tempFile);

    try {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Set up request counter and progress capture on page
      await page.evaluate(() => {
        window.__translationRequests = 0;
        window.__progressTexts = [];
        const origFetch = window.fetch;
        window.fetch = async function(url, opt) {
          const strUrl = String(url);
          if (/clients5\.google|translate\.googleapis/i.test(strUrl)) {
            window.__translationRequests++;
            const prog = document.getElementById('dProgText')?.textContent;
            if (prog) window.__progressTexts.push(prog);
            // Return fake translated responses matching input items count
            if (opt?.method === 'POST' && opt?.body instanceof URLSearchParams) {
              const qCount = opt.body.getAll('q').length;
              const result = Array.from({ length: qCount }, (_, i) => `ترجمه ${i + 1}`);
              return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify([[["ترجمه شده", "original"]]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return origFetch.apply(this, arguments);
        };
      });

      await chooseFile(page, page.locator('#dDrop'), tempFile);
      await expect(page.locator('#dWork')).toBeVisible();
      await expect(page.locator('#dInfo')).toHaveText('400 segments');

      // Click Translate file
      await mouseClick(page, page.locator('#dGo'));

      // Wait until Done and download button enabled
      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 45000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);

      // Verify request count is far lower than 400
      const requestsCount = await page.evaluate(() => window.__translationRequests);
      expect(requestsCount, 'translation requests should be far lower than 400').toBeLessThanOrEqual(25);

      // Verify progress text changed and referenced pieces
      const progressList = await page.evaluate(() => window.__progressTexts);
      const pieceProg = progressList.some(txt => /pieces|بخش/.test(txt));
      expect(pieceProg, 'progress text must update with pieces').toBe(true);

      // Download translated docx and check that all 20 tables are preserved
      const dl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
      const office = await openOffice(dl.bytes);
      expect(office.problems, 'translated docx should have no XML schema problems').toEqual([]);

      const tableCount = count(office.parts['word/document.xml'], 'w:tbl');
      expect(tableCount, 'translated document must keep exactly 20 tables').toBe(20);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  test('Stop button works during document translation between requests', async ({ app }) => {
    test.setTimeout(60000);
    const { page } = app;
    const tempFile = path.join(os.tmpdir(), `test-stop-${Date.now()}.docx`);
    await createDocxWith20Tables(tempFile);

    try {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Add a slight delay to each translation request so Stop can be clicked between requests
      await page.evaluate(() => {
        const origFetch = window.fetch;
        window.fetch = async function(url, opt) {
          if (/clients5\.google|translate\.googleapis/i.test(String(url))) {
            await new Promise(r => setTimeout(r, 1200));
            if (opt?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            if (opt?.method === 'POST' && opt?.body instanceof URLSearchParams) {
              const qCount = opt.body.getAll('q').length;
              return new Response(JSON.stringify(Array.from({ length: qCount }, (_, i) => `ترجمه ${i}`)), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
          }
          return origFetch.apply(this, arguments);
        };
      });

      await chooseFile(page, page.locator('#dDrop'), tempFile);
      await expect(page.locator('#dWork')).toBeVisible();

      await mouseClick(page, page.locator('#dGo'));

      const stopBtn = page.locator('#dStop');
      await expect(stopBtn).toBeVisible();

      // Click Stop during execution
      await mouseClick(page, stopBtn);

      await expect(page.locator('#dGo')).toBeEnabled({ timeout: 5000 });
      await expect(page.locator('#dProgText')).toContainText(/Stopped|متوقف شد/);
      await expect(page.locator('#dProgText')).not.toContainText(/Done|انجام شد/);
      await expect(page.locator('#dStatusChip')).toHaveClass(/warn/);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  test('fake AI engine returning wrong number of parts falls back to 1-by-1 and translates every piece', async ({ app }) => {
    test.setTimeout(60000);
    const { page } = app;

    const tempTxt = path.join(os.tmpdir(), `test-ai-fallback-${Date.now()}.txt`);
    fs.writeFileSync(tempTxt, 'First sentence.\nSecond sentence.\nThird sentence.\nFourth sentence.\n');

    try {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      await page.evaluate(() => {
        const curCfg = JSON.parse(localStorage.getItem('mkt_cfg') || '{}');
        curCfg.order = ['gemini', 'google'];
        curCfg.eng = curCfg.eng || {};
        curCfg.eng.gemini = { on: true, key: 'fake-test-key', model: 'gemini-2.5-flash' };
        localStorage.setItem('mkt_cfg', JSON.stringify(curCfg));
        if (typeof cfg !== 'undefined') {
          cfg.order = curCfg.order;
          cfg.eng = curCfg.eng;
        }
      });

      await page.evaluate(() => {
        window.__batchAttempts = 0;
        window.__singleAttempts = 0;
        const origFetch = window.fetch;
        window.fetch = async function(url, opt) {
          const strUrl = String(url);
          if (/generativelanguage\.googleapis\.com/i.test(strUrl)) {
            let bodyObj = null;
            try { bodyObj = JSON.parse(opt?.body); } catch {}
            const userContent = bodyObj?.contents?.[0]?.parts?.[0]?.text;
            let items = [];
            try { items = JSON.parse(userContent); } catch {}

            if (items.length > 1) {
              window.__batchAttempts++;
              const mismatched = items.slice(0, Math.max(1, items.length - 2)).map(s => `[fa] ${s}`);
              const reply = {
                candidates: [{
                  content: {
                    parts: [{ text: JSON.stringify(mismatched) }]
                  }
                }]
              };
              return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else if (items.length === 1) {
              window.__singleAttempts++;
              const reply = {
                candidates: [{
                  content: {
                    parts: [{ text: JSON.stringify([`[fa] ${items[0]}`]) }]
                  }
                }]
              };
              return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
          }
          return origFetch.apply(this, arguments);
        };
      });

      await chooseFile(page, page.locator('#dDrop'), tempTxt);
      await expect(page.locator('#dWork')).toBeVisible();

      await mouseClick(page, page.locator('#dGo'));

      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 45000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);
      await expect(page.locator('#dStatusChip')).toHaveClass(/ok/);

      const batchAttempts = await page.evaluate(() => window.__batchAttempts);
      const singleAttempts = await page.evaluate(() => window.__singleAttempts);
      expect(batchAttempts, 'grouped batch must be attempted first').toBeGreaterThan(0);
      expect(singleAttempts, 'single items must be attempted after mismatch fallback').toBeGreaterThan(0);

      const dl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
      const content = dl.bytes.toString('utf8');
      expect(content).toContain('[fa] First sentence.');
      expect(content).toContain('[fa] Second sentence.');
      expect(content).toContain('[fa] Third sentence.');
      expect(content).toContain('[fa] Fourth sentence.');
    } finally {
      if (fs.existsSync(tempTxt)) fs.unlinkSync(tempTxt);
    }
  });

  test('TXT file and DOCX file complete translation with Download enabled', async ({ app, files }) => {
    test.setTimeout(60000);
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // Test TXT file
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dWork')).toBeVisible();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 30000 });
    await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);

    const txtDl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
    expect(txtDl.bytes.length).toBeGreaterThan(0);

    // Test DOCX file
    await chooseFile(page, page.locator('#dDrop'), files.docx);
    await expect(page.locator('#dWork')).toBeVisible();
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 30000 });
    await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);

    const docxDl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
    expect(docxDl.bytes.length).toBeGreaterThan(0);
  });
});

