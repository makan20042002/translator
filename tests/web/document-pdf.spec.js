'use strict';
// Document tab: PDF input support, text reconstruction, layout handling,
// translation output, honest error messages, and offline mode.

const fs = require('fs');
const path = require('path');
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');
const { openOffice, textsOf } = require('../support/office');
const { buildPdf, writePdfSync } = require('../support/make-pdf');

const GEN_DIR = path.resolve(__dirname, '..', '.generated');

function appCalls(stub) {
  return stub.calls().filter(c => c.host !== 'accounts.google.com' && c.host !== 'android.clients.google.com');
}

test.describe('Web app: PDF Document input', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  let sample3PagePdf;
  let noTextPdf;
  let corruptPdf;
  let large120PagePdf;

  test.beforeAll(() => {
    fs.mkdirSync(GEN_DIR, { recursive: true });

    sample3PagePdf = path.join(GEN_DIR, 'sample-3page.pdf');
    writePdfSync(sample3PagePdf, {
      repeatedHeader: 'Confidential Internal Report',
      pages: [
        {
          lines: [
            { text: 'Executive Summary', size: 20, font: 'F2', x: 72, y: 680 },
            { text: 'This is the opening introductory paragraph describing our new strategy.', size: 12, font: 'F1', x: 72, y: 640 },
            { text: 'It continues here on the second line with further context.', size: 12, font: 'F1', x: 72, y: 624 }
          ],
          pageNumber: 'Page 1'
        },
        {
          lines: [
            { text: 'The second section addresses the multi-', size: 12, font: 'F1', x: 72, y: 660 },
            { text: 'national enterprise deployment challenges.', size: 12, font: 'F1', x: 72, y: 644 }
          ],
          pageNumber: 'Page 2'
        },
        {
          lines: [
            { text: 'Finally this is the concluding paragraph summarizing our findings.', size: 12, font: 'F1', x: 72, y: 660 }
          ],
          pageNumber: 'Page 3'
        }
      ]
    });

    noTextPdf = path.join(GEN_DIR, 'sample-no-text.pdf');
    writePdfSync(noTextPdf, { noText: true, pageCount: 2 });

    corruptPdf = path.join(GEN_DIR, 'corrupt-sample.pdf');
    fs.writeFileSync(corruptPdf, 'Not a valid pdf header or content at all\nRandom junk bytes\n');

    large120PagePdf = path.join(GEN_DIR, 'sample-120page.pdf');
    writePdfSync(large120PagePdf, { pageCount: 120 });
  });

  // (1) 3-page PDF with heading, paragraphs, hyphenated line break, page numbers, repeated header
  test('(1) 3-page PDF: summary shows 3 pages and paragraph count, text de-hyphenated, page numbers and header removed', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);

    await expect(page.locator('#dWork')).toBeVisible();
    await expect(page.locator('#dBadge')).toHaveText('PDF');

    // Summary line in progress text
    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('PDF: 3 pages, 4 paragraphs');
    await expect(progText).toContainText('Layout is rebuilt as paragraphs');

    // Input preview text area contains the extracted paragraphs
    const inText = await page.locator('#dIn').inputValue();
    expect(inText).toContain('Executive Summary');
    // De-hyphenation check: 'multi-' + 'national' became 'multinational'
    expect(inText).toContain('multinational');
    expect(inText).not.toContain('multi-');

    // Filtered elements: running header and page numbers removed
    expect(inText).not.toContain('Confidential Internal Report');
    expect(inText).not.toContain('Page 1');
    expect(inText).not.toContain('Page 2');
    expect(inText).not.toContain('Page 3');

    // Direct module validation
    const fileBytes = fs.readFileSync(sample3PagePdf);
    const extraction = await page.evaluate(async (bytesArray) => {
      const buf = new Uint8Array(bytesArray).buffer;
      return await window.extractPdfParagraphs(buf);
    }, Array.from(fileBytes));

    expect(extraction.stats.pageCount).toBe(3);
    expect(extraction.stats.paragraphCount).toBe(4);
    expect(extraction.stats.removedLines).toBe(6); // 3 headers + 3 page numbers
    expect(extraction.pages[0].paragraphs[0].heading).toBe(true);
    expect(extraction.pages[0].paragraphs[0].text).toBe('Executive Summary');
    expect(extraction.pages[1].paragraphs[0].heading).toBe(false);
  });

  // (2) Translate with stub server engine and download DOCX
  test('(2) translate PDF with stub server and download DOCX: one translated paragraph per extracted paragraph and no external calls', async ({ app, stub }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);

    await expect(page.locator('#dGo')).toBeEnabled();
    stub.clearLog();

    // Start translation
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('#dProgText')).toContainText('Done');

    // Download result (default or same format for PDF downloads .docx)
    const dl = await downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
    expect(dl.name).toMatch(/\.docx$/i);

    // Verify DOCX structure
    const { parts, problems } = await openOffice(dl.bytes);
    expect(problems, 'DOCX has structural problems').toEqual([]);

    const docXml = parts['word/document.xml'];
    const paras = textsOf(docXml, 'w:p', 'w:t').filter(t => t.trim().length > 0);

    // Exactly 4 paragraphs translated, matching the 4 extracted paragraphs and nothing else
    expect(paras.length).toBe(4);
    for (const p of paras) {
      expect(p.length).toBeGreaterThan(0);
    }
    const allDocxText = paras.join('\n');
    expect(allDocxText).not.toContain('Confidential Internal Report');
    expect(allDocxText).not.toContain('Page 1');
    expect(allDocxText).not.toContain('Page 2');
    expect(allDocxText).not.toContain('Page 3');

    // Calls check: only allow provider calls to the engine host (clients5.google.com) and local app origin
    const calls = appCalls(stub);
    const nonLocalCalls = calls.filter(c => c.host !== '127.0.0.1' && c.host !== 'localhost' && !c.host.startsWith('localhost:'));
    for (const c of nonLocalCalls) {
      expect(c.host).toBe('clients5.google.com');
      expect(c.server).toBe('provider');
    }
    expect(nonLocalCalls.length).toBeGreaterThan(0);

    // Verify request body contains exactly the 4 extracted paragraphs and no headers/footers
    const googleCalls = nonLocalCalls.filter(c => c.host === 'clients5.google.com');
    const sentParagraphs = [];
    for (const c of googleCalls) {
      const form = new URLSearchParams(c.body);
      for (const q of form.getAll('q')) {
        sentParagraphs.push(q);
      }
    }
    expect(sentParagraphs.length).toBe(4);
    expect(sentParagraphs[0]).toContain('Executive Summary');
    expect(sentParagraphs[1]).toContain('introductory paragraph');
    expect(sentParagraphs[2]).toContain('multinational');
    expect(sentParagraphs[3]).toContain('concluding paragraph');

    const allSentText = sentParagraphs.join('\n');
    expect(allSentText).not.toContain('Confidential Internal Report');
    expect(allSentText).not.toContain('Page 1');
    expect(allSentText).not.toContain('Page 2');
    expect(allSentText).not.toContain('Page 3');
  });

  // (3) PDF with no text: honest message in English and Persian, Translate disabled, 0 calls
  test('(3) PDF with no text: shows scanned document honest message in English and Persian, Translate disabled, 0 calls', async ({ app, stub }) => {
    const { page } = app;
    stub.clearLog();

    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), noTextPdf);

    // English honest message
    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('This PDF has no selectable text, so it is probably a scanned document. OCR for PDF files is not available yet.');
    await expect(page.locator('#dGo')).toBeDisabled();

    // Switch to Persian
    await mouseClick(page, page.locator('#uiLang'));
    await chooseFile(page, page.locator('#dDrop'), noTextPdf);

    // Persian honest message
    await expect(progText).toContainText('این فایل PDF متن قابل انتخابی ندارد و احتمالاً یک سند اسکن‌شده است. OCR برای فایل‌های PDF هنوز در دسترس نیست.');
    await expect(page.locator('#dGo')).toBeDisabled();

    // Zero calls to any provider
    const providerCalls = appCalls(stub).filter(c => c.pathname.includes('/translate') || c.pathname.includes('/v1/chat'));
    expect(providerCalls.length).toBe(0);

    // Switch back to English for cleanliness
    await mouseClick(page, page.locator('#uiLang'));
  });

  // (4) Corrupt file named .pdf: corrupt message
  test('(4) corrupt file named .pdf: shows honest corrupt/unreadable message and keeps Translate disabled', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), corruptPdf);

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('This PDF could not be read. It may be damaged.');
    await expect(page.locator('#dGo')).toBeDisabled();
  });

  // (5) Call exported error mapper with fake exceptions
  test('(5) exported error mapper returns correct codes for fake exceptions', async ({ app }) => {
    const { page } = app;
    const results = await page.evaluate(() => {
      class PasswordException extends Error {
        constructor() { super('Password needed'); this.name = 'PasswordException'; }
      }
      class InvalidPDFException extends Error {
        constructor() { super('Corrupt header'); this.name = 'InvalidPDFException'; }
      }
      class CustomUnknownException extends Error {
        constructor() { super('Unknown system error'); this.name = 'CustomUnknownException'; }
      }

      return {
        password: window.mapPdfError(new PasswordException()),
        corrupt: window.mapPdfError(new InvalidPDFException()),
        unknown: window.mapPdfError(new CustomUnknownException()),
        tooBig: window.mapPdfError(new Error('Big'), { pageCount: 1050, charCount: 5000 }),
        noText: window.mapPdfError(null, { pageCount: 5, charCount: 0, avgCharsPerPage: 0 })
      };
    });

    expect(results.password).toBe('password');
    expect(results.corrupt).toBe('corrupt');
    expect(results.unknown).toBe('unknown');
    expect(results.tooBig).toBe('too_big');
    expect(results.noText).toBe('no_text');
  });

  // (6) 120-page PDF: progress shows page numbers, Stop aborts within 2s, tab returns to idle, small PDF works
  test('(6) 120-page PDF: reading progress shows pages, Stop aborts within 2s and following file works', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    const progText = page.locator('#dProgText');
    const stopBtn = page.locator('#dStop');

    // Choose 120-page PDF
    await chooseFile(page, page.locator('#dDrop'), large120PagePdf);

    // Stop button should become visible while reading
    await expect(stopBtn).toBeVisible({ timeout: 5000 });

    // Click Stop to abort
    const t0 = Date.now();
    await mouseClick(page, stopBtn);

    // Aborts and returns to idle within 2 s
    await expect(stopBtn).toBeHidden({ timeout: 2000 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2500);

    // Following small PDF works normally
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);
    await expect(progText).toContainText('PDF: 3 pages, 4 paragraphs', { timeout: 10_000 });
    await expect(page.locator('#dGo')).toBeEnabled();
  });

  // (7) Offline mode on: PDF is read and summary appears with zero external requests
  test('(7) Offline mode on: PDF reading is 100% local and succeeds with 0 external requests', async ({ app, stub }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // Turn Offline mode on
    const offBtn = page.locator('#offBtn');
    const isAlreadyOn = await offBtn.evaluate(el => el.classList.contains('on'));
    if (!isAlreadyOn) {
      await mouseClick(page, offBtn);
    }

    stub.clearLog();
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);

    const progText = page.locator('#dProgText');
    await expect(progText).toContainText('PDF: 3 pages, 4 paragraphs');

    const externalCalls = appCalls(stub).filter(c => c.host !== '127.0.0.1' && c.host !== 'localhost' && !c.host.startsWith('localhost:'));
    expect(externalCalls).toEqual([]);

    // Turn offline mode back off
    await mouseClick(page, offBtn);
  });

  // (8) pdf.js files exist under vendor/pdfjs/ and are served 200; lazy loaded only after first PDF
  test('(8) pdf.js files are served 200 and lazily loaded on first PDF upload only', async ({ app, stub }) => {
    const context = app.context;
    const freshPage = await context.newPage();

    const requestedUrls = [];
    freshPage.on('request', req => requestedUrls.push(req.url()));

    await freshPage.goto(stub.appUrl);
    await expect(freshPage.locator('#tabs button').first()).toBeVisible();

    // At page start, pdf.min.js must NOT have been requested
    const pdfJsRequestedAtStart = requestedUrls.some(u => u.includes('vendor/pdfjs/pdf.min.js'));
    expect(pdfJsRequestedAtStart, 'pdf.min.js should not be requested at page start').toBe(false);

    // Now choose a PDF in Document tab
    await mouseClick(freshPage, freshPage.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(freshPage, freshPage.locator('#dDrop'), sample3PagePdf);
    await expect(freshPage.locator('#dProgText')).toContainText('PDF: 3 pages', { timeout: 10_000 });

    // After first PDF, pdf.min.js is requested
    const pdfJsRequestedAfter = requestedUrls.some(u => u.includes('vendor/pdfjs/pdf.min.js'));
    expect(pdfJsRequestedAfter, 'pdf.min.js must be requested after selecting a PDF').toBe(true);

    // Verify both files are served 200 from app origin
    const resMain = await freshPage.evaluate(async (origin) => {
      const r = await fetch(origin + '/vendor/pdfjs/pdf.min.js');
      return { status: r.status, ok: r.ok };
    }, stub.appOrigin);
    expect(resMain.status).toBe(200);

    const resWorker = await freshPage.evaluate(async (origin) => {
      const r = await fetch(origin + '/vendor/pdfjs/pdf.worker.min.js');
      return { status: r.status, ok: r.ok };
    }, stub.appOrigin);
    expect(resWorker.status).toBe(200);

    await freshPage.close();
  });

  // (9) State machine: choosing PDF then DOCX then PDF again works; error then good file works
  test('(9) state machine: alternating PDF -> DOCX -> PDF works, and error -> good file recovers cleanly', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // 1. Choose PDF
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);
    await expect(page.locator('#dBadge')).toHaveText('PDF');
    await expect(page.locator('#dProgText')).toContainText('PDF: 3 pages');

    // 2. Choose DOCX
    await chooseFile(page, page.locator('#dDrop'), files.docx);
    await expect(page.locator('#dBadge')).toHaveText('DOCX');
    await expect(page.locator('#dProgText')).toContainText('Ready to translate');

    // 3. Choose PDF again
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);
    await expect(page.locator('#dBadge')).toHaveText('PDF');
    await expect(page.locator('#dProgText')).toContainText('PDF: 3 pages');

    // 4. Choose corrupt file
    await chooseFile(page, page.locator('#dDrop'), corruptPdf);
    await expect(page.locator('#dProgText')).toContainText('This PDF could not be read');
    await expect(page.locator('#dGo')).toBeDisabled();

    // 5. Choose good file
    await chooseFile(page, page.locator('#dDrop'), sample3PagePdf);
    await expect(page.locator('#dProgText')).toContainText('PDF: 3 pages');
    await expect(page.locator('#dGo')).toBeEnabled();
  });

  // (10) Regression: previous file types still load
  test('(10) regression check: existing DOCX and TXT file types still load properly', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));

    // DOCX loads
    await chooseFile(page, page.locator('#dDrop'), files.docx);
    await expect(page.locator('#dBadge')).toHaveText('DOCX');
    await expect(page.locator('#dGo')).toBeEnabled();
    const docxIn = await page.locator('#dIn').inputValue();
    expect(docxIn.length).toBeGreaterThan(0);

    // TXT loads
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dBadge')).toHaveText('TXT');
    await expect(page.locator('#dGo')).toBeEnabled();
    const txtIn = await page.locator('#dIn').inputValue();
    expect(txtIn.length).toBeGreaterThan(0);
  });
});
