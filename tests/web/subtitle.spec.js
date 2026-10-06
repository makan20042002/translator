'use strict';
// Subtitle tab: open an SRT file, translate, edit one line by hand, export SRT and VTT.
const { test, expect, onlyEngines, mouseClick, chooseFile, downloadOf } = require('../support/fixtures');

const SRT_TIME = /^(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})$/;
const VTT_TIME = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

/** Strict SRT reader: number line, timing line, one or more text lines, blank line. */
function parseSrtStrict(text) {
  const body = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const blocks = body.trim().split(/\n\n/);
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    if (!/^\d+$/.test(lines[0])) throw new Error(`cue ${i + 1}: first line is not a number: ${JSON.stringify(lines[0])}`);
    if (!SRT_TIME.test(lines[1])) throw new Error(`cue ${i + 1}: bad timing line: ${JSON.stringify(lines[1])}`);
    if (lines.length < 3 || !lines.slice(2).join('').trim()) throw new Error(`cue ${i + 1}: no text`);
    return { n: +lines[0], time: lines[1], text: lines.slice(2).join('\n') };
  });
}

/** Strict VTT reader: WEBVTT header, then cues of timing line + text. */
function parseVttStrict(text) {
  const body = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!body.startsWith('WEBVTT\n')) throw new Error('missing WEBVTT header');
  const blocks = body.slice('WEBVTT\n'.length).trim().split(/\n\n/);
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    const k = VTT_TIME.test(lines[0]) ? 0 : 1; // optional cue identifier
    if (!VTT_TIME.test(lines[k])) throw new Error(`cue ${i + 1}: bad timing line: ${JSON.stringify(lines[k])}`);
    return { time: lines[k], text: lines.slice(k + 1).join('\n') };
  });
}

const SOURCE_TIMES = [
  '00:00:01,000 --> 00:00:03,500', '00:00:04,000 --> 00:00:06,250', '00:00:07,000 --> 00:00:09,000',
  '00:00:10,120 --> 00:00:12,900', '01:02:03,004 --> 01:02:05,006'
];

test.describe('Web app: Subtitle tab', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('opens an SRT, translates it, keeps an edited line, and exports valid SRT and VTT with identical timings', async ({ app, files }) => {
    const { page, stub, errors } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));
    await chooseFile(page, page.locator('#sDrop'), files.srt);
    await expect(page.locator('#sWork')).toBeVisible();
    await expect(page.locator('#sInfo')).toHaveText('sample · 0/5 lines');
    await expect(page.locator('#cues .cue')).toHaveCount(5);
    await expect(page.locator('#cues .cue').nth(4).locator('.tm')).toHaveText('01:02:03 → 01:02:05');

    await mouseClick(page, page.locator('#sGo'));
    await expect(page.locator('#sInfo')).toHaveText('sample · 5/5 lines');
    await expect(page.locator('#cues .tr[data-i="0"]')).toHaveText('[fa] Hello there.');
    // A two-person dialogue cue keeps its two lines.
    await expect(page.locator('#cues .tr[data-i="2"]')).toHaveText('[fa] - I am going home.\n[fa] - Wait for me!', { useInnerText: true });
    // 6 units (cue 3 is split per speaker) went to Google in one request.
    const sent = new URLSearchParams(stub.calls('clients5.google.com')[0].body).getAll('q');
    expect(sent).toHaveLength(6);

    // Edit line 4 with the keyboard.
    const cue4 = page.locator('#cues .tr[data-i="3"]');
    await mouseClick(page, cue4);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('My own corrected line');
    await expect(cue4).toHaveText('My own corrected line');

    const srt = await downloadOf(page, () => mouseClick(page, page.locator('#sSrt')));
    expect(srt.name).toBe('sample.fa.srt');
    const srtCues = parseSrtStrict(srt.bytes.toString('utf8'));
    expect(srtCues.map(c => c.n)).toEqual([1, 2, 3, 4, 5]);
    expect(srtCues.map(c => c.time)).toEqual(SOURCE_TIMES);
    expect(srtCues[0].text).toBe('[fa] Hello there.');
    expect(srtCues[2].text).toBe('[fa] - I am going home.\n[fa] - Wait for me!');
    expect(srtCues[3].text).toBe('My own corrected line');
    expect(srtCues[4].text).toBe('[fa] The last line, after one hour.');

    const vtt = await downloadOf(page, () => mouseClick(page, page.locator('#sVtt')));
    expect(vtt.name).toBe('sample.fa.vtt');
    const vttCues = parseVttStrict(vtt.bytes.toString('utf8'));
    expect(vttCues.map(c => c.time)).toEqual(SOURCE_TIMES.map(t => t.replace(/,/g, '.')));
    expect(vttCues[3].text).toBe('My own corrected line');
    expect(errors).toEqual([]);
  });

  test('empty drop area layout is intact across widths from 360px to 1920px in English and Persian', async ({ app }) => {
    const { page } = app;
    await mouseClick(page, page.locator('#tabs button[data-tab="sub"]'));

    const widths = [360, 640, 1024, 1920];
    for (const lang of ['en', 'fa']) {
      if (lang === 'fa') {
        await page.evaluate(() => {
          ui = 'fa';
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'fa';
          applyI18n();
        });
      }
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: 800 });
        const dropBox = await page.locator('#sDrop').boundingBox();
        const strongBox = await page.locator('#sDrop strong').boundingBox();
        expect(dropBox, `sDrop exists at ${w}px in ${lang}`).toBeTruthy();
        expect(dropBox.x).toBeGreaterThanOrEqual(0);
        expect(dropBox.x + dropBox.width).toBeLessThanOrEqual(w + 1);
        expect(strongBox.x).toBeGreaterThanOrEqual(dropBox.x);
        expect(strongBox.x + strongBox.width).toBeLessThanOrEqual(dropBox.x + dropBox.width + 1);
      }
    }
  });
});
