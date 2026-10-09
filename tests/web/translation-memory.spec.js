'use strict';
// ITEM 1: Translation Memory store backed by IndexedDB.
const { test, expect, mouseClick, onlyEngines, VALID_KEY } = require('../support/fixtures');

test.describe('Web app: Translation Memory store (Item 1)', () => {
  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) {
        await window.TranslationMemory.clear();
      }
    });
  });

  test('put then get returns the same entry', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Good morning',
        translatedText: 'صبح بخیر',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: 'formal',
        subject: 'greetings'
      });
      return await tm.get({
        text: 'Good morning',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: 'formal',
        subject: 'greetings'
      });
    });

    expect(result).not.toBeNull();
    expect(result.sourceText).toBe('Good morning');
    expect(result.translatedText).toBe('صبح بخیر');
    expect(result.src).toBe('en');
    expect(result.tgt).toBe('fa');
    expect(result.modeClass).toBe('fast');
    expect(result.tone).toBe('formal');
    expect(result.subject).toBe('greetings');
    expect(typeof result.timestamp).toBe('number');
    expect(typeof result.lastUsed).toBe('number');
  });

  test('a different tone, subject, language or mode class is a miss', async ({ app }) => {
    const { page } = app;
    const checks = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Hello world',
        translatedText: 'سلام دنیا',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: 'casual',
        subject: 'general'
      });

      const baseQuery = {
        text: 'Hello world',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: 'casual',
        subject: 'general'
      };

      const diffTone = await tm.get({ ...baseQuery, tone: 'formal' });
      const diffSubject = await tm.get({ ...baseQuery, subject: 'medical' });
      const diffSrcLang = await tm.get({ ...baseQuery, src: 'fr' });
      const diffTgtLang = await tm.get({ ...baseQuery, tgt: 'de' });
      const diffModeClass = await tm.get({ ...baseQuery, modeClass: 'smart' });
      const exactMatch = await tm.get(baseQuery);

      return {
        diffTone,
        diffSubject,
        diffSrcLang,
        diffTgtLang,
        diffModeClass,
        exactMatch: exactMatch != null
      };
    });

    expect(checks.exactMatch).toBe(true);
    expect(checks.diffTone).toBeNull();
    expect(checks.diffSubject).toBeNull();
    expect(checks.diffSrcLang).toBeNull();
    expect(checks.diffTgtLang).toBeNull();
    expect(checks.diffModeClass).toBeNull();
  });

  test('text with extra spaces matches the normalized key', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: '   How    are   you   doing?   ',
        translatedText: 'حالت چطوره؟',
        src: 'en',
        tgt: 'fa',
        modeClass: 'smart',
        tone: '',
        subject: ''
      });

      return await tm.get({
        text: 'How are you doing?',
        src: 'en',
        tgt: 'fa',
        modeClass: 'smart',
        tone: '',
        subject: ''
      });
    });

    expect(result).not.toBeNull();
    expect(result.translatedText).toBe('حالت چطوره؟');
  });

  test('count reflects entries and clear empties the store', async ({ app }) => {
    const { page } = app;
    const { countBefore, countAfterPut, countAfterClear } = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.clear();
      const countBefore = await tm.count();

      await tm.put({ sourceText: 'One', translatedText: 'یک', src: 'en', tgt: 'fa', modeClass: 'fast' });
      await tm.put({ sourceText: 'Two', translatedText: 'دو', src: 'en', tgt: 'fa', modeClass: 'fast' });
      const countAfterPut = await tm.count();

      await tm.clear();
      const countAfterClear = await tm.count();

      return { countBefore, countAfterPut, countAfterClear };
    });

    expect(countBefore).toBe(0);
    expect(countAfterPut).toBe(2);
    expect(countAfterClear).toBe(0);
  });

  test('entry contains only allowed fields and never stores keys or engine settings', async ({ app }) => {
    const { page } = app;
    const record = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Safe entry test',
        translatedText: 'تست مدخل امن',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: 'formal',
        subject: 'security',
        apiKey: 'secret-key-12345',
        engine: 'google',
        token: 'token-abc'
      });
      return await tm.get({
        text: 'Safe entry test',
        src: 'en',
        tgt: 'fa',
        modeClass: 'fast',
        tone: 'formal',
        subject: 'security'
      });
    });

    expect(record).not.toBeNull();
    const allowedKeys = new Set([
      'key',
      'textHash',
      'src',
      'tgt',
      'modeClass',
      'tone',
      'subject',
      'sourceText',
      'translatedText',
      'timestamp',
      'lastUsed'
    ]);

    for (const key of Object.keys(record)) {
      expect(allowedKeys.has(key), `Field "${key}" must be an allowed field`).toBe(true);
    }
    expect(record.apiKey).toBeUndefined();
    expect(record.engine).toBeUndefined();
    expect(record.token).toBeUndefined();
  });
});

test.describe('Web app: Translation Memory in Text tab (Item 2)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) await window.TranslationMemory.clear();
    });
  });

  test('a second identical request makes zero engine calls and shows from memory badge', async ({ app }) => {
    const { page, stub } = app;

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Hello friend');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('[fa] Hello friend');
    const firstCalls = stub.calls('clients5.google.com').length;
    expect(firstCalls).toBeGreaterThanOrEqual(1);

    // Clear output to confirm memory refills it
    await page.locator('#tOut').fill('');
    await page.locator('#tMeta').evaluate(el => el.textContent = '');

    // Request the same text again
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('[fa] Hello friend');
    await expect(page.locator('#tMeta')).toContainText('from memory');
    await expect(page.locator('#tMeta .pill-tm')).toBeVisible();

    const secondCalls = stub.calls('clients5.google.com').length;
    expect(secondCalls).toBe(firstCalls); // Zero new engine calls!
  });

  test('a failed or empty engine result is not saved', async ({ app }) => {
    const { page, stub } = app;

    // Make the engine fail
    stub.failHost('clients5.google.com', 500);
    stub.failHost('translate.googleapis.com', 500);

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('This should fail completely');
    await mouseClick(page, page.locator('#tGo'));

    // Wait until translate button is enabled again (finishes failure handling)
    await expect(page.locator('#tGo')).toBeEnabled({ timeout: 15_000 });

    const entry = await page.evaluate(async () => {
      return await window.TranslationMemory.get({
        text: 'This should fail completely',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    expect(entry).toBeNull();
    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(0);
  });

  test('a stubbed HTTP 429 rate limit is not saved (Item 2)', async ({ app }) => {
    const { page, stub } = app;

    stub.failHost('clients5.google.com', 429);
    stub.failHost('translate.googleapis.com', 429);

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Rate limited 429 test text');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tGo')).toBeEnabled({ timeout: 15_000 });

    const entry = await page.evaluate(async () => {
      return await window.TranslationMemory.get({
        text: 'Rate limited 429 test text',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    expect(entry).toBeNull();
    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(0);
  });

  test('a stubbed HTTP 503 service unavailable is not saved (Item 2)', async ({ app }) => {
    const { page, stub } = app;

    stub.failHost('clients5.google.com', 503);
    stub.failHost('translate.googleapis.com', 503);

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Service unavailable 503 test text');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tGo')).toBeEnabled({ timeout: 15_000 });

    const entry = await page.evaluate(async () => {
      return await window.TranslationMemory.get({
        text: 'Service unavailable 503 test text',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    expect(entry).toBeNull();
    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(0);
  });

  test('a timed out or stopped request is not saved (Item 2)', async ({ app }) => {
    const { page, stub } = app;

    stub.delayHost('clients5.google.com', 10_000);
    stub.delayHost('translate.googleapis.com', 10_000);

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Timed out translation test text');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tStop')).toBeVisible();
    await mouseClick(page, page.locator('#tStop'));

    await expect(page.locator('#tGo')).toBeEnabled({ timeout: 15_000 });

    const entry = await page.evaluate(async () => {
      return await window.TranslationMemory.get({
        text: 'Timed out translation test text',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        tone: '',
        subject: ''
      });
    });

    expect(entry).toBeNull();
    const count = await page.evaluate(async () => await window.TranslationMemory.count());
    expect(count).toBe(0);
  });

  test('saveToMemory filters out 429, 503, timeout and error results directly (Item 2)', async ({ app }) => {
    const { page } = app;
    const count = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.clear();
      await saveToMemory({ text: 'sample', translatedText: 'HTTP 429 Too Many Requests', modeClass: 'fast' });
      await saveToMemory({ text: 'sample', translatedText: '503 Service Unavailable', modeClass: 'fast' });
      await saveToMemory({ text: 'sample', translatedText: 'Translation timed out', modeClass: 'fast' });
      await saveToMemory({ text: 'sample', translatedText: 'Valid text', hasError: true, modeClass: 'fast' });
      await saveToMemory({ text: 'sample', translatedText: 'Rate limit exceeded', modeClass: 'fast' });
      return await tm.count();
    });
    expect(count).toBe(0);
  });

  test('an IndexedDB failure does not break translation', async ({ app }) => {
    const { page } = app;

    // Simulate complete IndexedDB breakdown
    await page.evaluate(() => {
      if (window.TranslationMemory) {
        window.TranslationMemory.get = () => Promise.reject(new Error('IndexedDB corrupted'));
        window.TranslationMemory.put = () => Promise.reject(new Error('IndexedDB corrupted'));
      }
    });

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Translate despite IDB error');
    await mouseClick(page, page.locator('#tGo'));

    // Translation should still work normally with no error shown
    await expect(page.locator('#tOut')).toHaveValue('[fa] Translate despite IDB error');
    await expect(page.locator('#tMeta')).toContainText('Google Translate (web)');
  });
});

test.describe('Web app: Translation Memory in Both mode (Item 1)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'both' } } });

  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) await window.TranslationMemory.clear();
    });
  });

  test('Both mode, Smart fails: the smart key has no entry, and a later Smart-mode request for the same text calls the engine', async ({ app }) => {
    const { page, stub } = app;
    // Make Gemini (Smart) fail with HTTP 500, while Google (Fast) succeeds
    stub.failHost('generativelanguage.googleapis.com', 500);

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Dual test with Smart failure');
    await mouseClick(page, page.locator('#tGo'));

    // Wait for Fast result to be displayed and failure notice to appear
    await expect(page.locator('#tOut')).toHaveValue('[fa] Dual test with Smart failure');
    await expect(page.locator('#tGo')).toBeEnabled({ timeout: 15_000 });

    // Verify: fast key holds the Fast result, but smart key has no entry
    const entries = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      const fastEntry = await tm.get({
        text: 'Dual test with Smart failure',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
      const smartEntry = await tm.get({
        text: 'Dual test with Smart failure',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'smart'
      });
      return { fastEntry, smartEntry };
    });

    expect(entries.fastEntry).not.toBeNull();
    expect(entries.fastEntry.translatedText).toBe('[fa] Dual test with Smart failure');
    expect(entries.smartEntry).toBeNull();

    // Now restore Gemini, switch to Smart mode, and request the exact same text
    stub.resetModes();
    stub.clearLog();

    await page.evaluate(() => {
      $('tMode').value = 'smart';
      store.set('tMode', 'smart');
    });
    await page.locator('#tOut').fill('');
    await page.locator('#tMeta').evaluate(el => el.textContent = '');

    await mouseClick(page, page.locator('#tGo'));

    // Because smart key had no entry, it must call the engine
    await expect(page.locator('#tOut')).toHaveValue('[fa] Dual test with Smart failure');
    await expect(page.locator('#tMeta')).toContainText('Google Gemini');
    const geminiCalls = stub.calls('generativelanguage.googleapis.com').filter(c => c.method !== 'GET' && !c.body.includes('IDIOM_DETECT'));
    expect(geminiCalls.length).toBeGreaterThan(0);
  });

  test('Both mode, Smart succeeds: the fast key holds the Fast result and the smart key holds the Smart result', async ({ app }) => {
    const { page, stub } = app;

    await mouseClick(page, page.locator('#tIn'));
    await page.keyboard.type('Dual test with both succeeding');
    await mouseClick(page, page.locator('#tGo'));

    // Wait until Gemini completes and updates output
    await expect(page.locator('#tOut')).toHaveValue('[fa] Dual test with both succeeding');
    await expect(page.locator('#tMeta')).toContainText('Google Gemini');

    const entries = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      const fastEntry = await tm.get({
        text: 'Dual test with both succeeding',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
      const smartEntry = await tm.get({
        text: 'Dual test with both succeeding',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'smart'
      });
      return { fastEntry, smartEntry };
    });

    expect(entries.fastEntry).not.toBeNull();
    expect(entries.fastEntry.translatedText).toBe('[fa] Dual test with both succeeding');
    expect(entries.fastEntry.modeClass).toBe('fast');

    expect(entries.smartEntry).not.toBeNull();
    expect(entries.smartEntry.translatedText).toBe('[fa] Dual test with both succeeding');
    expect(entries.smartEntry.modeClass).toBe('smart');
  });
});

