'use strict';
// Subtitle tab: Translation Memory integration (Item 1).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');

function makeSrtFile(cues) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'makan-sub-tm-')), 'sub.srt');
  const body = cues.map((c, i) => `${i + 1}\n${c.time}\n${c.text}`).join('\n\n') + '\n';
  fs.writeFileSync(tmp, body, 'utf8');
  return tmp;
}

test.describe('Web app: Subtitle tab translation memory (Item 1)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) {
        await window.TranslationMemory.clear();
      }
    });
  });

  test('repeated lines make fewer engine calls', async ({ app, stub }) => {
    const { page } = app;
    const file = makeSrtFile([
      { time: '00:00:01,000 --> 00:00:02,000', text: 'Hello friend' },
      { time: '00:00:03,000 --> 00:00:04,000', text: 'How are you?' },
      { time: '00:00:05,000 --> 00:00:06,000', text: 'Hello friend' }
    ]);

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), file);
    await expect(page.locator('#sWork')).toBeVisible();

    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sub · 3/3 lines');

    // Run again with same file (all lines cached)
    stub.clearCalls();
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sub · 3/3 lines');

    // Zero engine calls on the second run because all 3 lines hit memory
    const calls = stub.calls('clients5.google.com');
    expect(calls.length).toBe(0);
    await expect(page.locator('#sProgText')).toContainText('from memory');
  });

  test('a re-run after a simulated failure translates only the missing lines', async ({ app, stub }) => {
    const { page } = app;
    const file = makeSrtFile([
      { time: '00:00:01,000 --> 00:00:02,000', text: 'Line one' },
      { time: '00:00:03,000 --> 00:00:04,000', text: 'Line two' }
    ]);

    // First, save only 'Line one' in memory to simulate a run where only the first line finished
    await page.evaluate(async () => {
      await window.TranslationMemory.put({
        sourceText: 'Line one',
        translatedText: '[fa] Line one',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: '',
        subStyle: 'film'
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), file);

    stub.clearCalls();
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sub · 2/2 lines');

    // Only 'Line two' was sent to Google
    const calls = stub.calls('clients5.google.com');
    expect(calls.length).toBe(1);
    const sent = new URLSearchParams(calls[0].body).getAll('q');
    expect(sent).toEqual(['Line two']);
    await expect(page.locator('#cues .tr[data-i="0"]')).toHaveText('[fa] Line one');
    await expect(page.locator('#cues .tr[data-i="1"]')).toHaveText('[fa] Line two');
  });

  test('different style is a miss', async ({ app, stub }) => {
    const { page } = app;
    const file = makeSrtFile([
      { time: '00:00:01,000 --> 00:00:02,000', text: 'Welcome home' }
    ]);

    // Put under 'film' style
    await page.evaluate(async () => {
      await window.TranslationMemory.put({
        sourceText: 'Welcome home',
        translatedText: '[film] Welcome home',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: '',
        subStyle: 'film'
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), file);

    // Switch style to 'formal'
    await page.locator('#subStyle').selectOption('formal');
    await page.locator('#subStyle').dispatchEvent('change');

    stub.clearCalls();
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sub · 1/1 lines');

    // Because style was formal, the film-style cache was a miss and called engine
    const calls = stub.calls('clients5.google.com');
    expect(calls.length).toBe(1);
  });

  test('an edited line is returned instead of the engine result', async ({ app, stub }) => {
    const { page } = app;
    const file = makeSrtFile([
      { time: '00:00:01,000 --> 00:00:02,000', text: 'Original line' }
    ]);

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), file);

    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#cues .tr[data-i="0"]')).toHaveText('[fa] Original line');

    // Edit the line in the table and blur
    const cell = page.locator('#cues .tr[data-i="0"]');
    await mouseClick(page, cell);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('My hand correction');
    await page.locator('#sInfo').click(); // blur
    await page.waitForTimeout(400);

    // Verify correction was stored in TM
    const tmEntry = await page.evaluate(async () => {
      return await window.TranslationMemory.get({
        text: 'Original line',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: '',
        subStyle: 'film'
      });
    });
    expect(tmEntry).not.toBeNull();
    expect(tmEntry.translatedText).toBe('My hand correction');
    expect(tmEntry.corrected).toBe(true);

    // Re-run: engine should not overwrite user's correction
    stub.clearCalls();
    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#cues .tr[data-i="0"]')).toHaveText('My hand correction');
    expect(stub.calls('clients5.google.com').length).toBe(0);
  });

  test('failed results are not saved', async ({ app, stub }) => {
    const { page } = app;
    const file = makeSrtFile([
      { time: '00:00:01,000 --> 00:00:02,000', text: 'Failing line' }
    ]);

    // Force network failure for Google Translate
    await page.route('**/translate_a/**', route => route.abort('failed'));
    await page.route('**/translate.googleapis.com/**', route => route.abort('failed'));

    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), file);

    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('.toast.err')).toBeVisible({ timeout: 15_000 });

    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(0);
  });

  test('output file is identical for the same engine results', async ({ app, files }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);

    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');

    const srt = await downloadOf(page, () => mouseClick(page, page.locator('#sSrt')));
    const text = srt.bytes.toString('utf8');
    expect(text).toContain('00:00:01,000 --> 00:00:03,500\n[fa] Hello there.');
    expect(text).toContain('01:02:03,004 --> 01:02:05,006\n[fa] The last line, after one hour.');
  });
});
