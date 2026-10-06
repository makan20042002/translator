'use strict';
// Subtitle tab: "Change file" and "Close file".
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, onlyEngines, mouseClick, chooseFile } = require('../support/fixtures');

const GOOGLE_HOSTS = ['clients5.google.com', 'translate.googleapis.com'];

function otherSrt() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'makan-srt-')), 'other.srt');
  fs.writeFileSync(f, '1\n00:00:01,000 --> 00:00:02,000\nOnly line\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n');
  return f;
}

test.describe('Web app: Subtitle tab file controls', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  async function open(page, files) {
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    await expect(page.locator('#sWork')).toBeVisible();
    await expect(page.locator('#cues .cue')).toHaveCount(5);
  }

  test('Change file replaces the lines and the progress, and the same file can be chosen again', async ({ app, files }) => {
    const { page } = app;
    await open(page, files);
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines', { timeout: 20_000 });
    await chooseFile(page, page.locator('#sChangeFile'), otherSrt());
    await expect(page.locator('#sInfo')).toHaveText('other · 0/2 lines');
    await expect(page.locator('#cues .cue')).toHaveCount(2);
    await expect(page.locator('#sBar')).toHaveCSS('width', '0px');
    await chooseFile(page, page.locator('#sChangeFile'), files.srt);
    await expect(page.locator('#sInfo')).toHaveText('sample · 0/5 lines');
  });

  test('Change file while a translation is running: the old translation stops and does not write into the new file', async ({ app, files, stub }) => {
    const { page } = app;
    await open(page, files);
    for (const h of GOOGLE_HOSTS) stub.delayHost(h, 2500);
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sStop')).toBeVisible();
    await chooseFile(page, page.locator('#sChangeFile'), otherSrt());
    await expect(page.locator('#sInfo')).toHaveText('other · 0/2 lines');
    await expect(page.locator('#sGo')).toBeEnabled({ timeout: 10_000 });
    await page.waitForTimeout(3500);
    await expect(page.locator('#sInfo')).toHaveText('other · 0/2 lines');
    await expect(page.locator('#cues .cue .tr').first()).toHaveText('');
  });

  test('Close file without a translation goes straight back to the drop zone', async ({ app, files }) => {
    const { page } = app;
    await open(page, files);
    await mouseClick(page, page.locator('#sCloseFile'));
    await expect(page.locator('#sWork')).toBeHidden();
    await expect(page.locator('#sDrop')).toBeVisible();
    await expect(page.locator('#cues .cue')).toHaveCount(0);
    // And a file can be opened again, even the same one.
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    await expect(page.locator('#sInfo')).toHaveText('sample · 0/5 lines');
  });

  test('Close file with translated lines asks once, then discards them', async ({ app, files }) => {
    const { page } = app;
    await open(page, files);
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines', { timeout: 20_000 });
    await mouseClick(page, page.locator('#sCloseFile'));
    await expect(page.locator('#sWork'), 'first click must not close').toBeVisible();
    await expect(page.locator('#sCloseFileText')).toContainText('again');
    await mouseClick(page, page.locator('#sCloseFile'));
    await expect(page.locator('#sWork')).toBeHidden();
    await expect(page.locator('#sDrop')).toBeVisible();
  });

  test('Close file while translating stops the translation and leaves the buttons usable', async ({ app, files, stub }) => {
    const { page } = app;
    await open(page, files);
    for (const h of GOOGLE_HOSTS) stub.delayHost(h, 2500);
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sStop')).toBeVisible();
    await mouseClick(page, page.locator('#sCloseFile'));
    await expect(page.locator('#sDrop')).toBeVisible();
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    await expect(page.locator('#sGo')).toBeEnabled({ timeout: 10_000 });
    await expect(page.locator('#sStop')).toBeHidden();
  });
});
