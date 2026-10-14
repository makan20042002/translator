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
  let expectedSegments = 0;
  // In MAKAN Translate, a segment is any paragraph with at least 2 consecutive letters (hasWords: /\p{L}{2,}/u).
  // Non-letter or single-letter cells (such as numeric sets, reps, and durations) are intentionally preserved as-is.
  const hasWords = s => /\p{L}{2,}/u.test(s);

  for (let t = 0; t < 20; t++) {
    const headerTexts = ['Exercise', 'Sets', 'Reps', 'Rest'];
    headerTexts.forEach(txt => { if (hasWords(txt)) expectedSegments++; });
    const rows = [
      new d.TableRow({
        children: headerTexts.map(txt => new d.TableCell({ children: [new d.Paragraph(txt)] }))
      })
    ];
    for (let r = 0; r < 4; r++) {
      const rowTexts = [`Movement ${r + 1}`, `${r + 3}`, '10-12', '60s'];
      rowTexts.forEach(txt => { if (hasWords(txt)) expectedSegments++; });
      rows.push(new d.TableRow({
        children: rowTexts.map(txt => new d.TableCell({ children: [new d.Paragraph(txt)] }))
      }));
    }
    tables.push(new d.Table({ rows }));
  }

  const doc = new d.Document({ sections: [{ children: tables }] });
  const buffer = await d.Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return { totalCells: 400, expectedSegments };
}

test.describe('Web app: Document batching and deduplication', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('groups short snippets into far fewer requests than 400, shows live pieces progress, and preserves all 20 tables', async ({ app }) => {
    test.setTimeout(60000);
    const { page } = app;
    const tempFile = path.join(os.tmpdir(), `test-20-tables-${Date.now()}.docx`);
    const { expectedSegments } = await createDocxWith20Tables(tempFile);

    try {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

      // Configure fake AI engine (Gemini)
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
        if (typeof fillEngines === 'function') fillEngines();
        const engSel = document.getElementById('engine');
        if (engSel) engSel.value = 'gemini';
        const tMode = document.getElementById('tMode');
        if (tMode) tMode.value = 'smart';
        if (typeof updateDocEngineInfo === 'function') updateDocEngineInfo();
      });

      // Set up request counter and progress capture on page for AI engine
      await page.evaluate(() => {
        window.__translationRequests = 0;
        window.__progressTexts = [];
        const origFetch = window.fetch;
        window.fetch = async function(url, opt) {
          const strUrl = String(url);
          if (/generativelanguage\.googleapis\.com/i.test(strUrl)) {
            if (/models\?pageSize=/i.test(strUrl)) {
              return new Response(JSON.stringify({
                models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            window.__translationRequests++;
            const prog = document.getElementById('dProgText')?.textContent;
            if (prog) window.__progressTexts.push(prog);

            let bodyObj = null;
            try { bodyObj = JSON.parse(opt?.body); } catch {}
            const userContent = bodyObj?.contents?.[0]?.parts?.[0]?.text;
            let items = [];
            try { items = JSON.parse(userContent); } catch {}

            const sysInst = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
            if (/expert translation and domain analysis assistant/i.test(sysInst)) {
              const analysis = {
                subject: 'Fitness & Health',
                register: 'Technical / Specialized',
                terms: [{ s: 'Exercise', t: 'تمرین' }]
              };
              return new Response(JSON.stringify({
                candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            // Return translated items preserving exact array indexing and order
            const translated = items.map(s => `[ترجمه] ${s}`);
            const reply = {
              candidates: [{
                content: {
                  parts: [{ text: JSON.stringify(translated) }]
                }
              }]
            };
            return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return origFetch.apply(this, arguments);
        };
      });

      await chooseFile(page, page.locator('#dDrop'), tempFile);
      await expect(page.locator('#dWork')).toBeVisible();
      await expect(page.locator('#dInfo')).toHaveText(`${expectedSegments} segments`);

      // Click Translate file
      await mouseClick(page, page.locator('#dGo'));

      // Wait until Done and download button enabled
      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 45000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);

      // Verify request count is far lower than snippet count (for 160 segments, batch size is up to 50)
      const requestsCount = await page.evaluate(() => window.__translationRequests);
      expect(requestsCount, 'AI translation requests should be far lower than number of snippets').toBeLessThanOrEqual(10);

      // Verify progress text changed and referenced pieces
      const progressList = await page.evaluate(() => window.__progressTexts);
      const pieceProg = progressList.some(txt => /pieces|بخش/.test(txt));
      expect(pieceProg, 'progress text must update with pieces').toBe(true);

      // Download translated docx and check that all 20 tables and translated order are preserved
      const dl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
      const office = await openOffice(dl.bytes);
      expect(office.problems, 'translated docx should have no XML schema problems').toEqual([]);

      const tableCount = count(office.parts['word/document.xml'], 'w:tbl');
      expect(tableCount, 'translated document must keep exactly 20 tables').toBe(20);

      const xml = office.parts['word/document.xml'];
      expect(xml).toContain('[ترجمه] Exercise');
      expect(xml).toContain('[ترجمه] Sets');
      expect(xml).toContain('[ترجمه] Reps');
      expect(xml).toContain('[ترجمه] Rest');
      expect(xml).toContain('[ترجمه] Movement 1');
      expect(xml).toContain('[ترجمه] Movement 4');

      // Verify ordering within the document: Movement 1 precedes Movement 2, etc.
      const idx1 = xml.indexOf('[ترجمه] Movement 1');
      const idx2 = xml.indexOf('[ترجمه] Movement 2');
      const idx3 = xml.indexOf('[ترجمه] Movement 3');
      const idx4 = xml.indexOf('[ترجمه] Movement 4');
      expect(idx1 < idx2 && idx2 < idx3 && idx3 < idx4, 'translated movement items must preserve sequential order').toBe(true);

      // Verify numeric formatting tokens are preserved
      expect(xml).toContain('10-12');
      expect(xml).toContain('60s');
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
        if (typeof fillEngines === 'function') fillEngines();
        const engSel = document.getElementById('engine');
        if (engSel) engSel.value = 'gemini';
        const tMode = document.getElementById('tMode');
        if (tMode) tMode.value = 'smart';
        if (typeof updateDocEngineInfo === 'function') updateDocEngineInfo();
      });

      await page.evaluate(() => {
        window.__batchAttempts = 0;
        window.__singleAttempts = 0;
        const origFetch = window.fetch;
        window.fetch = async function(url, opt) {
          const strUrl = String(url);
          if (/generativelanguage\.googleapis\.com/i.test(strUrl)) {
            if (/models\?pageSize=/i.test(strUrl)) {
              return new Response(JSON.stringify({
                models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            let bodyObj = null;
            try { bodyObj = JSON.parse(opt?.body); } catch {}
            const userContent = bodyObj?.contents?.[0]?.parts?.[0]?.text;
            let items = [];
            try { items = JSON.parse(userContent); } catch {}

            const sysInst = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
            if (/expert translation and domain analysis assistant/i.test(sysInst)) {
              const analysis = { subject: 'General', register: 'Neutral / Standard', terms: [] };
              return new Response(JSON.stringify({
                candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

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

  test('docx with tables, merged cells and nested paragraphs counts all text segments and translates them', async ({ app }) => {
    test.setTimeout(60000);
    const { page } = app;
    const tempFile = path.join(os.tmpdir(), `test-merged-nested-${Date.now()}.docx`);

    const hasWords = s => /\p{L}{2,}/u.test(s);
    let expectedSegments = 0;
    const snippets = [
      'Document Overview and Introduction',
      'Header Title In Merged Cell',
      'Nested Description In Same Cell',
      '12345',
      'First Column Detail Item',
      'Second Column Detail Item',
      'Final Summary Paragraph'
    ];
    snippets.forEach(s => { if (hasWords(s)) expectedSegments++; });

    const doc = new d.Document({
      sections: [{
        children: [
          new d.Paragraph(snippets[0]),
          new d.Table({
            rows: [
              new d.TableRow({
                children: [
                  new d.TableCell({
                    columnSpan: 2,
                    children: [
                      new d.Paragraph(snippets[1]),
                      new d.Paragraph(snippets[2])
                    ]
                  })
                ]
              }),
              new d.TableRow({
                children: [
                  new d.TableCell({
                    children: [
                      new d.Paragraph(snippets[3]),
                      new d.Paragraph(snippets[4])
                    ]
                  }),
                  new d.TableCell({
                    children: [
                      new d.Paragraph(snippets[5])
                    ]
                  })
                ]
              })
            ]
          }),
          new d.Paragraph(snippets[6])
        ]
      }]
    });

    const buffer = await d.Packer.toBuffer(doc);
    fs.writeFileSync(tempFile, buffer);

    try {
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await chooseFile(page, page.locator('#dDrop'), tempFile);
      await expect(page.locator('#dWork')).toBeVisible();

      // Ensure segment count matches only text snippets with words (pure numeric "12345" excluded)
      await expect(page.locator('#dInfo')).toHaveText(`${expectedSegments} segments`);

      await mouseClick(page, page.locator('#dGo'));
      await expect(page.locator('#dSave')).toBeEnabled({ timeout: 45000 });
      await expect(page.locator('#dProgText')).toContainText(/Done|انجام شد/);

      const dl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
      const office = await openOffice(dl.bytes);
      expect(office.problems, 'translated docx should have no XML schema problems').toEqual([]);

      const xml = office.parts['word/document.xml'];
      // Every text snippet with words must have been translated and written back in place
      expect(xml).toContain('[fa] Document Overview and Introduction');
      expect(xml).toContain('[fa] Header Title In Merged Cell');
      expect(xml).toContain('[fa] Nested Description In Same Cell');
      expect(xml).toContain('[fa] First Column Detail Item');
      expect(xml).toContain('[fa] Second Column Detail Item');
      expect(xml).toContain('[fa] Final Summary Paragraph');
      // The non-translatable numeric snippet must be kept intact in the document XML
      expect(xml).toContain('12345');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });
});

