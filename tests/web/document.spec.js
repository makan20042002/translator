'use strict';
// Document tab: every supported format goes in, gets translated, comes out,
// and the output file is checked for structure (not just "a file appeared").
const fs = require('fs');
const ExcelJS = require('exceljs');
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');
const { openOffice, schemaOrderProblems, textsOf, count, findSoffice, libreOfficeOpens } = require('../support/office');
const { JSON_DOC } = require('../support/make-fixtures');

const soffice = findSoffice();

/** Upload `file` in the Document tab, press Translate file, and download the result. */
async function translateDocument(page, file, expectedSegments) {
  await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
  await chooseFile(page, page.locator('#dDrop'), file);
  await expect(page.locator('#dWork')).toBeVisible();
  await expect(page.locator('#dInfo')).toHaveText(`${expectedSegments} segments`);
  await mouseClick(page, page.locator('#dGo'));
  await expect(page.locator('#dSave')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('#dProgText')).toContainText('Done');
  // A "Done" message appears in the corner for about 4 s and can cover the
  // Download button (see the separate test below); wait for it like a user would.
  await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 10_000 });
  return downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
}

/**
 * Ask LibreOffice to open the translated file. First prove it can open the
 * original sample; if it cannot (not installed, or installed without
 * Writer / Calc / Impress), the check is reported as "not checked" rather
 * than blamed on the app.
 */
function checkWithLibreOffice(bytes, ext, originalFile) {
  if (!soffice) {
    test.info().annotations.push({ type: 'not checked', description: 'LibreOffice is not installed on this computer, so "opens in an office suite" was not checked.' });
    return;
  }
  const control = libreOfficeOpens(soffice, fs.readFileSync(originalFile), ext);
  if (!control.ok) {
    test.info().annotations.push({ type: 'not checked', description: `LibreOffice here cannot open even the original sample .${ext} (${control.detail}), so "opens in an office suite" was not checked.` });
    return;
  }
  const r = libreOfficeOpens(soffice, bytes, ext);
  test.info().annotations.push({ type: 'LibreOffice', description: r.detail });
  expect(r.ok, r.detail).toBe(true);
}

test.describe('Web app: Document tab', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('the Download button can be clicked as soon as translation finishes (nothing covers it)', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await mouseClick(page, page.locator('#dGo'));
    await expect(page.locator('#dSave')).toBeEnabled();
    const box = await page.locator('#dSave').boundingBox();
    const onTop = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e.id || e.className || e.tagName; }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    test.info().annotations.push({ type: 'window size', description: '1280 x 900' });
    expect(onTop, 'element under the middle of the Download button right after "Done"').toBe('dSave');
  });

  test('TXT: every line translated, empty lines kept', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.txt, 3);
    expect(out.name).toBe('sample.fa.txt');
    const text = out.bytes.toString('utf8').replace(/^﻿/, '');
    expect(text.split('\n')).toEqual(['[fa] The first line of plain text.', '[fa] The second line.', '', '[fa] A line after an empty line.', '']);
    expect(app.errors).toEqual([]);
  });

  test('Markdown: headings, lists, quotes and links survive; code blocks are not translated', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.md, 5);
    expect(out.name).toBe('sample.fa.md');
    const lines = out.bytes.toString('utf8').replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe('# [fa] Project title');
    expect(lines[2]).toBe('[fa] A paragraph with **bold** words and a [link](https://example.com/page).');
    expect(lines[4]).toBe('- [fa] First list item');
    expect(lines[5]).toBe('- [fa] Second list item');
    expect(lines.slice(7, 10)).toEqual(['```js', 'const keepMe = "code is not translated";', '```']);
    expect(lines[11]).toBe('> [fa] A quoted sentence.');
    expect(app.errors).toEqual([]);
  });

  test('JSON: same keys, numbers and booleans; text values translated', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.json, 5);
    expect(out.name).toBe('sample.fa.json');
    const data = JSON.parse(out.bytes.toString('utf8').replace(/^﻿/, ''));
    expect(Object.keys(data)).toEqual(Object.keys(JSON_DOC));
    expect(data.count).toBe(42);
    expect(data.enabled).toBe(true);
    expect(data.empty).toBe('');
    expect(data.title).toBe('[fa] Welcome to the application');
    expect(data.menu).toEqual({ open: '[fa] Open file', save: '[fa] Save file', items: ['[fa] Cut text', '[fa] Copy text', 7] });
  });

  test('JSON: the downloaded file can be read by a strict JSON reader (no byte-order mark)', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.json, 5);
    const raw = out.bytes.toString('utf8');
    expect(raw.charCodeAt(0), 'first character of the file (65279 = invisible byte-order mark, which strict JSON readers reject)').not.toBe(0xfeff);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test('CSV: same rows and columns, numbers kept, a field with a comma stays quoted', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.csv, 7);
    expect(out.name).toBe('sample.fa.csv');
    const text = out.bytes.toString('utf8').replace(/^﻿/, '');
    expect(text.split('\n')).toEqual([
      '[fa] name,[fa] description,[fa] price',
      '[fa] Apple,"[fa] Fresh, red and sweet",1.25',
      '[fa] Bread,[fa] Whole wheat loaf,2.50'
    ]);
  });

  test('DOCX: valid file, same paragraphs and table, text translated, right-to-left set, footnote kept', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.docx, 8);
    expect(out.name).toBe('sample.fa.docx');
    const before = await openOffice(fs.readFileSync(files.docx));
    const after = await openOffice(out.bytes);
    expect(after.problems, 'XML well-formedness problems').toEqual([]);
    const b = before.parts['word/document.xml'], a = after.parts['word/document.xml'];
    expect(count(a, 'w:p')).toBe(count(b, 'w:p'));
    expect(count(a, 'w:tbl')).toBe(count(b, 'w:tbl'));
    expect(count(a, 'w:tc')).toBe(count(b, 'w:tc'));
    expect(count(a, 'w:footnoteReference')).toBe(1);
    const paras = textsOf(a, 'w:p', 'w:t').filter(Boolean);
    expect(paras).toEqual([
      '[fa] Quarterly report',
      '[fa] The system uses a cache to speed up reads.',
      '[fa] A second plain paragraph of text.',
      '[fa] Name', '[fa] Value', '[fa] Speed', '[fa] Very fast'
    ]);
    // Right-to-left for Persian: every translated paragraph and the table.
    expect(count(a, 'w:bidi')).toBe(7);
    // Whether the table is marked right-to-left, and with which element, is checked in the next test.
    // The footnote text was translated too.
    expect(textsOf(after.parts['word/footnotes.xml'], 'w:p', 'w:t').filter(Boolean)).toContain('[fa] An original footnote.');
    checkWithLibreOffice(out.bytes, 'docx', files.docx);
    expect(app.errors).toEqual([]);
  });

  test('DOCX: elements the app adds are in the order the Office file format requires', async ({ app, files }) => {
    const before = await openOffice(fs.readFileSync(files.docx));
    expect(schemaOrderProblems(before.parts['word/document.xml'], 'original word/document.xml'), 'the sample file itself is in order').toEqual([]);
    const out = await translateDocument(app.page, files.docx, 8);
    const after = await openOffice(out.bytes);
    const problems = [
      ...schemaOrderProblems(after.parts['word/document.xml'], 'word/document.xml'),
      ...schemaOrderProblems(after.parts['word/footnotes.xml'], 'word/footnotes.xml')
    ];
    expect(problems, 'elements out of schema order (Word may refuse or "repair" such files)').toEqual([]);
  });

  test('DOCX: tables are marked right-to-left with elements the Office format has (there is no w:tblBidi)', async ({ app, files }) => {
    // The Office format's table property for right-to-left is <w:bidiVisual/>. <w:tblBidi/> does not exist,
    // so Microsoft Word may report a file containing it as damaged (LibreOffice just ignores it).
    const out = await translateDocument(app.page, files.docx, 8);
    const after = await openOffice(out.bytes);
    const all = Object.entries(after.parts).filter(([n]) => /^word\/.*\.xml$/.test(n));
    const offenders = all.filter(([, xml]) => xml.includes('w:tblBidi')).map(([n]) => n);
    expect(offenders, 'parts of the .docx that contain w:tblBidi').toEqual([]);
    expect(count(after.parts['word/document.xml'], 'w:bidiVisual'), 'tables marked right-to-left with w:bidiVisual').toBe(1);
  });

  test('PPTX: valid file, same slides, text translated, right-to-left set', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.pptx, 4);
    expect(out.name).toBe('sample.fa.pptx');
    const before = await openOffice(fs.readFileSync(files.pptx));
    const after = await openOffice(out.bytes);
    expect(after.problems).toEqual([]);
    const slides = p => Object.keys(p).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
    expect(slides(after.parts)).toEqual(slides(before.parts));
    const texts = slides(after.parts).flatMap(n => textsOf(after.parts[n], 'a:p', 'a:t').filter(Boolean));
    expect(texts).toEqual(['[fa] Welcome slide title', '[fa] A short subtitle under the title', '[fa] First bullet point', '[fa] Second bullet point']);
    for (const n of slides(after.parts)) {
      const rtlParas = (after.parts[n].match(/<a:pPr[^>]*\brtl="1"/g) || []).length;
      expect(rtlParas, `${n}: paragraphs marked right-to-left`).toBe(textsOf(after.parts[n], 'a:p', 'a:t').filter(Boolean).length);
    }
    checkWithLibreOffice(out.bytes, 'pptx', files.pptx);
    expect(app.errors).toEqual([]);
  });

  test('XLSX: valid file, same sheets, formulas and numbers kept, text translated, sheets right-to-left', async ({ app, files }) => {
    const out = await translateDocument(app.page, files.xlsx, 6);
    expect(out.name).toBe('sample.fa.xlsx');
    const after = await openOffice(out.bytes);
    expect(after.problems).toEqual([]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out.bytes);
    expect(wb.worksheets.map(s => s.name)).toEqual(['Prices', 'Notes']);
    const s = wb.getWorksheet('Prices');
    expect(s.getCell('A1').value).toBe('[fa] Product');
    expect(s.getCell('A2').value).toBe('[fa] Green apple');
    expect(s.getCell('B2').value).toBe(3);
    expect(s.getCell('C2').value.formula).toBe('B2*2');
    expect(s.getCell('C3').value.formula).toBe('B3*2');
    expect(wb.getWorksheet('Notes').getCell('A1').value).toBe('[fa] Remember to check the totals');
    for (const n of Object.keys(after.parts).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
      expect(after.parts[n], `${n} should be right-to-left`).toMatch(/<sheetView[^>]*rightToLeft="1"/);
    }
    checkWithLibreOffice(out.bytes, 'xlsx', files.xlsx);
    expect(app.errors).toEqual([]);
  });
});
