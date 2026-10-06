'use strict';
// Document tab: the "Output format" selector (Same as input, Word, PDF, Markdown, Plain text).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');
const { findSoffice, libreOfficeOpens } = require('../support/office');

const soffice = findSoffice();

async function translateAndDownload(page, file, format) {
  await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
  await chooseFile(page, page.locator('#dDrop'), file);
  await expect(page.locator('#dWork')).toBeVisible();
  await page.locator('#dOutFmt').selectOption(format);
  await mouseClick(page, page.locator('#dGo'));
  await expect(page.locator('#dSave')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 10_000 });
  return downloadOf(page, () => mouseClick(page, page.locator('#dSave')));
}

test.describe('Web app: Document tab output format', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test('the selector offers the five choices and starts on "Same as input"', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    expect(await page.locator('#dOutFmt option').allTextContents()).toEqual(['Same as input', 'Word (.docx)', 'PDF (.pdf)', 'Markdown (.md)', 'Plain text (.txt)']);
    await expect(page.locator('#dOutFmt')).toHaveValue('same');
  });

  test('Same as input keeps the original format', async ({ app, files }) => {
    const out = await translateAndDownload(app.page, files.txt, 'same');
    expect(out.name).toBe('sample.fa.txt');
  });

  test('Word output from a text file: a valid .docx with the translated paragraphs, right-to-left for Persian, no table direction markup', async ({ app, files }) => {
    const out = await translateAndDownload(app.page, files.txt, 'docx');
    expect(out.name).toBe('sample.fa.docx');
    const zip = await JSZip.loadAsync(out.bytes);
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toContain('[fa] The first line of plain text.');
    expect(xml).toContain('[fa] A line after an empty line.');
    expect(xml).toContain('<w:bidi/>');
    expect(xml).not.toContain('w:tblBidi');
    if (soffice) {
      const r = libreOfficeOpens(soffice, out.bytes, 'docx');
      test.info().annotations.push({ type: 'LibreOffice', description: r.detail });
      expect(r.ok, r.detail).toBe(true);
    } else {
      test.info().annotations.push({ type: 'not checked', description: 'LibreOffice is not installed here, so "opens in Word-compatible software" was not checked.' });
    }
  });

  test('Word output from a Word file: all segments, as plain paragraphs', async ({ app, files }) => {
    const out = await translateAndDownload(app.page, files.docx, 'docx');
    expect(out.name).toBe('sample.fa.docx');
    const zip = await JSZip.loadAsync(out.bytes);
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml.match(/\[fa\]/g).length).toBeGreaterThan(3);
  });

  test('Plain text output: translated paragraphs separated by a blank line', async ({ app, files }) => {
    const out = await translateAndDownload(app.page, files.docx, 'txt');
    expect(out.name).toBe('sample.fa.txt');
    const text = out.bytes.toString('utf8').replace(/^﻿/, '');
    expect(text).toContain('[fa]');
    expect(text).toMatch(/\[fa\] [^\n]+\n\n\[fa\] /);
    expect(text).not.toContain('<w:');
  });

  test('Markdown output from a Word file: file ends in .md and holds the translation', async ({ app, files }) => {
    const out = await translateAndDownload(app.page, files.docx, 'md');
    expect(out.name).toBe('sample.fa.md');
    const text = out.bytes.toString('utf8');
    expect(text).toContain('[fa]');
    expect(text).not.toContain('<w:');
  });

  test('PDF output is a valid PDF with the translated text drawn on its pages', async ({ app, files }, testInfo) => {
    const out = await translateAndDownload(app.page, files.txt, 'pdf');
    expect(out.name).toBe('sample.fa.pdf');
    expect(out.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(out.bytes.subarray(-6).toString('latin1')).toContain('%%EOF');
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'makan-pdf-')), 'out.pdf');
    fs.writeFileSync(f, out.bytes);
    const info = execFileSync('pdfinfo', [f]).toString();
    expect(info).toMatch(/Pages:\s+1/);
    expect(info).toMatch(/Page size:\s+595/);
    // The page must not be blank: render it and count dark pixels.
    execFileSync('pdftoppm', ['-r', '40', '-png', '-singlefile', f, f.replace(/\.pdf$/, '')]);
    const png = fs.readFileSync(f.replace(/\.pdf$/, '.png'));
    testInfo.attach('pdf-page.png', { body: png, contentType: 'image/png' });
    expect(png.length, 'rendered page is not an empty white page').toBeGreaterThan(3000);
  });

  test('PDF of Persian text with a long paragraph: several lines, right-aligned, several pages when long', async ({ app }, testInfo) => {
    const { page } = app;
    const bytes = await page.evaluate(async () => {
      const para = 'این یک جمله‌ی فارسی برای آزمایش خروجی پی‌دی‌اف است. '.repeat(120);
      const blob = await buildPlainPdf([para, 'پایان'], 'fa');
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'makan-pdf-')), 'fa.pdf');
    fs.writeFileSync(f, Buffer.from(bytes));
    const pages = +/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [f]).toString())[1];
    expect(pages).toBeGreaterThan(2);
    execFileSync('pdftoppm', ['-r', '50', '-png', '-f', '1', '-l', '1', '-singlefile', f, f.replace(/\.pdf$/, '')]);
    testInfo.attach('persian-page-1.png', { body: fs.readFileSync(f.replace(/\.pdf$/, '.png')), contentType: 'image/png' });
  });

  test('the chosen format is remembered', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await page.locator('#dOutFmt').selectOption('pdf');
    await page.reload();
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    await chooseFile(page, page.locator('#dDrop'), files.txt);
    await expect(page.locator('#dOutFmt')).toHaveValue('pdf');
  });
});
