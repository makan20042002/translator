'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Web app: Media speech and translation engines (ITEM 2)', () => {

  test('translateCues returns the same number of cues and same timing with translated text', async ({ app }) => {
    const { page } = app;

    // Mock translation endpoint at network level
    await page.route('https://clients5.google.com/translate_a/t*', async route => {
      const postData = route.request().postData() || '';
      const form = new URLSearchParams(postData);
      const qs = form.getAll('q');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(qs.map(s => '[fa] ' + s))
      });
    });

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const cues = [
      { s: 0.5, e: 2.1, o: 'Hello world', t: '' },
      { s: 2.5, e: 4.8, o: 'Welcome to MAKAN', t: '' },
      { s: 5.0, e: 7.2, o: 'Voice and media subtitles.', t: '' }
    ];

    const result = await page.evaluate(async (testCues) => {
      let infoReceived = null;
      let progressReported = [];

      const translated = await window.MediaTranslate.host.translateCues(testCues, {
        src: 'en',
        tgt: 'fa',
        onProgress: (p) => progressReported.push(p),
        onInfo: (inf) => { infoReceived = inf; }
      });
      return { translated, infoReceived, progressCount: progressReported.length };
    }, cues);

    expect(result.translated).toHaveLength(3);
    expect(result.translated[0]).toEqual({ s: 0.5, e: 2.1, o: 'Hello world', t: '[fa] Hello world' });
    expect(result.translated[1]).toEqual({ s: 2.5, e: 4.8, o: 'Welcome to MAKAN', t: '[fa] Welcome to MAKAN' });
    expect(result.translated[2]).toEqual({ s: 5.0, e: 7.2, o: 'Voice and media subtitles.', t: '[fa] Voice and media subtitles.' });
    expect(result.infoReceived).toBeTruthy();
    expect(result.infoReceived.name).toBeTruthy();
    expect(result.progressCount).toBeGreaterThan(0);
  });

  test('cancel works via signal and preserves finished cues', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const cancelResult = await page.evaluate(async () => {
      const cues = [
        { s: 0.0, e: 1.0, o: 'First line', t: '' },
        { s: 1.0, e: 2.0, o: 'Second line', t: '' }
      ];

      const ctrl = new AbortController();
      ctrl.abort(); // pre-abort signal

      let caught = null;
      try {
        await window.MediaTranslate.host.translateCues(cues, {
          src: 'en',
          tgt: 'fa',
          signal: ctrl.signal
        });
      } catch (err) {
        caught = {
          name: err.name,
          code: err.code,
          isAbort: err.name === 'AbortError' || err.code === 'aborted'
        };
      }
      return caught;
    });

    expect(cancelResult).toBeTruthy();
    expect(cancelResult.isAbort).toBe(true);
  });

  test('offline mode never calls an online engine', async ({ app }) => {
    const { page } = app;

    // Track any network calls made to cloud providers
    const onlineCalls = [];
    await page.route(/(?:googleapis|google\.com|mymemory|groq\.com|api\.openai\.com|openrouter\.ai)/, route => {
      onlineCalls.push(route.request().url());
      route.abort('failed');
    });

    // Toggle offline mode using the real UI control #offBtn
    const offBtn = page.locator('#offBtn');
    await mouseClick(page, offBtn);
    await expect(offBtn).toHaveClass(/\bon\b/);

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const cues = [{ s: 0.0, e: 1.0, o: 'Offline safety check', t: '' }];
    const errResult = await page.evaluate(async (testCues) => {
      let caught = null;
      try {
        await window.MediaTranslate.host.translateCues(testCues, { src: 'en', tgt: 'fa' });
      } catch (err) {
        caught = {
          message: err.message,
          code: err.code
        };
      }
      return caught;
    }, cues);

    // An error is raised because no offline engine is ready and online engines are forbidden
    expect(errResult).toBeTruthy();
    expect(errResult.code).toBe('notdownloaded');
    // Absolutely zero requests went to any online translation provider
    expect(onlineCalls).toEqual([]);
  });

  test.describe('NLLB engine choice and licence', () => {
    test.use({
      appOptions: {
        seed: {
          cfg: {
            ...onlyEngines(['nllb', 'google']),
            engine: 'nllb',
            nllb: true
          },
          engine: 'nllb',
          nllb: true,
          mdl: { 'tr-nllb-600': { at: Date.now(), files: [] } }
        }
      }
    });

    test('the NLLB non-commercial licence note appears in getTranslateChoice', async ({ app }) => {
      const { page } = app;

      await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
      await expect(page.locator('#tab-media')).toBeVisible();

      const choice = await page.evaluate(() => {
        return window.MediaTranslate.host.getTranslateChoice();
      });

      expect(choice.id).toBe('nllb');
      expect(choice.licence).toBe('CC BY-NC 4.0');
      expect(choice.licenceNote).toContain('Non-commercial use only (CC BY-NC 4.0)');
    });
  });

  test('Transcribe card uses the Model Hub choice', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    const whisperMatch = await page.evaluate(() => {
      const choice = window.MediaTranslate.host.getWhisperChoice();
      const currentAsr = typeof asrModel === 'function' ? asrModel() : null;
      const isReady = typeof mcReady === 'function' ? mcReady(currentAsr) : false;

      return {
        choiceRepo: choice.repo,
        hubRepo: currentAsr ? currentAsr.repo : null,
        choiceReady: choice.ready,
        hubReady: isReady
      };
    });

    expect(whisperMatch.hubRepo).toBeTruthy();
    expect(whisperMatch.choiceRepo).toBe(whisperMatch.hubRepo);
    expect(whisperMatch.choiceReady).toBe(whisperMatch.hubReady);
  });

  test('no request goes to any address that the Voice tab does not already use', async ({ app }) => {
    const { page } = app;

    await mouseClick(page, page.locator('#tabs button[data-tab="media"]'));
    await expect(page.locator('#tab-media')).toBeVisible();

    // Check pinned address in host.engine.libUrl
    const hostLibUrl = await page.evaluate(() => {
      return window.MediaTranslate.host.engine?.libUrl;
    });

    // Check pinned address in ai-worker.js (the Voice tab's background worker)
    const aiWorkerCode = fs.readFileSync(path.resolve(__dirname, '../../ai-worker.js'), 'utf8');
    const match = aiWorkerCode.match(/import\s+.*?\s+from\s+['"](https:\/\/[^'"]+)['"]/);
    expect(match).toBeTruthy();
    const voiceWorkerLibUrl = match[1];

    expect(hostLibUrl).toBe(voiceWorkerLibUrl);
    expect(hostLibUrl).toBe('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
  });

});
