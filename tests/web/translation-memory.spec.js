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
      'lastUsed',
      'corrected'
    ]);

    for (const key of Object.keys(record)) {
      expect(allowedKeys.has(key), `Field "${key}" must be an allowed field`).toBe(true);
    }
    expect(record.apiKey).toBeUndefined();
    expect(record.engine).toBeUndefined();
    expect(record.token).toBeUndefined();
  });

  test('collision safety: get compares stored normalized source text with requested text and treats a mismatch as a miss (Item 3)', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.clear();

      // Force hashText to always return the same hash, simulating a hash collision
      const originalHash = tm.hashText;
      tm.hashText = () => 'fixed_collision_hash_123';

      try {
        // Save first text
        await tm.put({
          sourceText: 'The quick brown fox',
          translatedText: 'روباه قهوه‌ای چابک',
          src: 'en',
          tgt: 'fa',
          modeClass: 'fast'
        });

        // Query for first text: should be a HIT
        const hitFirst = await tm.get({
          text: 'The quick brown fox',
          src: 'en',
          tgt: 'fa',
          modeClass: 'fast'
        });

        // Query for a different text forced to the exact same key: should be a MISS (null)
        const missCollision = await tm.get({
          text: 'A completely different sentence',
          src: 'en',
          tgt: 'fa',
          modeClass: 'fast'
        });

        // Also test normalized equivalence (e.g. extra whitespace matches)
        const hitNormalized = await tm.get({
          text: '   The   quick   brown   fox   ',
          src: 'en',
          tgt: 'fa',
          modeClass: 'fast'
        });

        return { hitFirst, missCollision, hitNormalized };
      } finally {
        tm.hashText = originalHash;
      }
    });

    // Verify first text returned successfully
    expect(result.hitFirst).not.toBeNull();
    expect(result.hitFirst.translatedText).toBe('روباه قهوه‌ای چابک');

    // Verify second different text forced to the same key is treated as a miss
    expect(result.missCollision).toBeNull();

    // Verify whitespace-normalized variation of the same text still matches
    expect(result.hitNormalized).not.toBeNull();
    expect(result.hitNormalized.translatedText).toBe('روباه قهوه‌ای چابک');
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
      await saveToMemory({ text: 'sample', translatedText: 'timeout: request timed out', modeClass: 'fast' });
      await saveToMemory({ text: 'sample', translatedText: 'Valid text', hasError: true, modeClass: 'fast' });
      await saveToMemory({ text: 'sample', translatedText: 'Rate limit exceeded', modeClass: 'fast' });
      return await tm.count();
    });
    expect(count).toBe(0);
  });

  test('a normal translation containing words like error, timeout, 429 or 503 is saved (Item 2)', async ({ app }) => {
    const { page } = app;
    const count = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.clear();
      // Normal translation that contains error/timeout/code words in normal context must be saved
      await saveToMemory({
        text: 'The server timeout was caused by error 503 on flight 429',
        translatedText: 'Handling a timeout and error in room 503 on flight 429',
        lines: ['The server timeout was caused by error 503 on flight 429'],
        out: ['Handling a timeout and error in room 503 on flight 429'],
        modeClass: 'fast',
        src: 'en',
        tgt: 'en'
      });
      return await tm.count();
    });
    expect(count).toBe(1);
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

test.describe('Web app: Translation Memory settings (Item 1)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) {
        await window.TranslationMemory.clear();
      }
    });
  });

  test('switch off means no lookups and no saves', async ({ app }) => {
    const { page, stub } = app;

    // 1. Put an existing translation into memory while TM is on
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Switch off test sentence',
        translatedText: 'ترجمه از قبل ذخیره شده',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
    });

    // 2. Turn off the translation memory switch
    await page.evaluate(() => {
      const cfgObj = store.get('cfg', {});
      cfgObj.tm = false;
      store.set('cfg', cfgObj);
      if (typeof cfg !== 'undefined') cfg.tm = false;
    });

    // 3. Request translation for the sentence that exists in memory
    stub.clearLog();
    await page.locator('#tIn').fill('Switch off test sentence');
    await mouseClick(page, page.locator('#tGo'));

    // Output must come from engine, NOT from memory
    await expect(page.locator('#tOut')).toHaveValue('[fa] Switch off test sentence');
    await expect(page.locator('#tMeta')).not.toContainText(/از حافظه|from memory/);

    // 4. Request translation for a new sentence with switch off: it must not be saved
    stub.clearLog();
    await mouseClick(page, page.locator('#tClear'));
    await page.locator('#tIn').fill('Another sentence with switch off');
    await mouseClick(page, page.locator('#tGo'));
    await expect(page.locator('#tOut')).toHaveValue('[fa] Another sentence with switch off');

    const entry = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      return await tm.get({
        text: 'Another sentence with switch off',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
    });
    expect(entry).toBeNull();
  });

  test('clear empties the store and the count shows 0', async ({ app }) => {
    const { page } = app;

    // Put two entries into memory
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.clear();
      await tm.put({
        sourceText: 'Entry 1',
        translatedText: 'مدخل ۱',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
      await tm.put({
        sourceText: 'Entry 2',
        translatedText: 'مدخل ۲',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
    });

    // Open settings modal
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/on/);

    // Verify count shows 2
    await expect(page.locator('#tmCount')).toHaveText('2');

    // First click on Clear memory asks for confirmation
    const clearBtn = page.locator('#tmClearBtn');
    await mouseClick(page, clearBtn);
    await expect(clearBtn).toHaveClass(/confirming/);

    // Second click confirms and clears the store
    await mouseClick(page, clearBtn);

    // Verify count in UI is 0
    await expect(page.locator('#tmCount')).toHaveText('0');

    // Verify store in IndexedDB is empty
    const storeCount = await page.evaluate(async () => {
      return await window.TranslationMemory.count();
    });
    expect(storeCount).toBe(0);
  });

  test('the switch survives reload', async ({ app }) => {
    const { page } = app;

    // Open settings
    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/on/);

    // Default is checked
    const tmToggle = page.locator('#tmToggle');
    await expect(tmToggle).toBeChecked();

    // Toggle switch off
    await mouseClick(page, tmToggle);
    await expect(tmToggle).not.toBeChecked();

    // Close settings
    await mouseClick(page, page.locator('#closeSet'));
    await expect(page.locator('#ov')).not.toHaveClass(/on/);

    // Verify cfg.tm is false in store
    const cfgSaved = await page.evaluate(() => store.get('cfg', {}).tm);
    expect(cfgSaved).toBe(false);

    // Reload page
    await page.reload();

    // Verify switch survives reload in state and in settings modal
    const cfgAfterReload = await page.evaluate(() => store.get('cfg', {}).tm);
    expect(cfgAfterReload).toBe(false);

    await mouseClick(page, page.locator('#openSet'));
    await expect(page.locator('#ov')).toHaveClass(/on/);
    await expect(page.locator('#tmToggle')).not.toBeChecked();
  });

  test('window.store is undefined and settings/keys are not exposed on window (Item 1)', async ({ app }) => {
    const { page } = app;
    const check = await page.evaluate(() => ({
      hasWindowStore: typeof window.store !== 'undefined',
      hasWindowCfg: typeof window.cfg !== 'undefined',
      storeWorksDirectly: typeof store !== 'undefined' && typeof store.get === 'function'
    }));
    expect(check.hasWindowStore).toBe(false);
    expect(check.hasWindowCfg).toBe(false);
    expect(check.storeWorksDirectly).toBe(true);
  });
});

test.describe('Web app: Translation Memory corrections (Item 2)', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test.beforeEach(async ({ app }) => {
    const { page } = app;
    await page.evaluate(async () => {
      if (window.TranslationMemory) {
        await window.TranslationMemory.clear();
      }
    });
  });

  test('the correction is returned instead of the engine result', async ({ app }) => {
    const { page, stub } = app;

    // 1. Enter text and translate via engine
    await page.locator('#tIn').fill('Source to be corrected');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('[fa] Source to be corrected');

    // 2. User edits the translation output
    const saveCorrectionBtn = page.locator('#tSaveCorrection');
    await expect(saveCorrectionBtn).toBeHidden();

    await page.locator('#tOut').fill('ویرایش دستی من برای این جمله');
    // Emitting input event reveals the save correction action
    await expect(saveCorrectionBtn).toBeVisible();

    // 3. Click "Save my correction"
    await mouseClick(page, saveCorrectionBtn);
    await expect(saveCorrectionBtn).toBeHidden();
    await expect(page.locator('#tMeta')).toContainText(/ویرایش شما|Your correction/);

    // 4. Clear output and re-translate: correction must be returned instead of engine result
    stub.clearLog();
    await page.locator('#tOut').fill('');
    await page.locator('#tMeta').evaluate(el => el.textContent = '');

    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('ویرایش دستی من برای این جمله');
    await expect(page.locator('#tMeta')).toContainText(/ویرایش شما|Your correction/);

    // Verify engine was NOT called because correction in memory answered
    const engineCalls = stub.calls('clients5.google.com').length + stub.calls('translate.googleapis.com').length;
    expect(engineCalls).toBe(0);

    // Verify stored record has corrected: true
    const entry = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      return await tm.get({
        text: 'Source to be corrected',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
    });
    expect(entry).not.toBeNull();
    expect(entry.corrected).toBe(true);
    expect(entry.translatedText).toBe('ویرایش دستی من برای این جمله');
  });

  test('a later engine result does not overwrite it', async ({ app }) => {
    const { page } = app;

    // Store a correction in translation memory
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Protected against engine overwrite',
        translatedText: 'ترجمه کاربر که هرگز نباید رونویسی شود',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        corrected: true
      });
    });

    // Simulate an engine result arriving later for the same key without corrected flag
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Protected against engine overwrite',
        translatedText: 'ترجمه جدید موتور که باید رد شود',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        corrected: false
      });
    });

    // Check that the stored record remains the user's correction
    const record = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      return await tm.get({
        text: 'Protected against engine overwrite',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
    });

    expect(record).not.toBeNull();
    expect(record.translatedText).toBe('ترجمه کاربر که هرگز نباید رونویسی شود');
    expect(record.corrected).toBe(true);

    // Request translation via UI: returns the user correction
    await page.locator('#tIn').fill('Protected against engine overwrite');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('ترجمه کاربر که هرگز نباید رونویسی شود');
    await expect(page.locator('#tMeta')).toContainText(/ویرایش شما|Your correction/);
  });

  test('it survives reload', async ({ app }) => {
    const { page } = app;

    // Save a user correction
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Persistent correction',
        translatedText: 'ترجمه اصلاح‌شده دائمی',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        corrected: true
      });
    });

    // Reload the page
    await page.reload();

    // Translate the source text
    await page.locator('#tIn').fill('Persistent correction');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('ترجمه اصلاح‌شده دائمی');
    await expect(page.locator('#tMeta')).toContainText(/ویرایش شما|Your correction/);

    const entry = await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      return await tm.get({
        text: 'Persistent correction',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast'
      });
    });
    expect(entry).not.toBeNull();
    expect(entry.corrected).toBe(true);
  });

  test('the badge differs', async ({ app }) => {
    const { page } = app;

    // 1. Put uncorrected translation into memory
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Badge test uncorrected',
        translatedText: 'ترجمه ماشینی ذخیره در حافظه',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        corrected: false
      });
    });

    // Translate uncorrected text
    await page.locator('#tIn').fill('Badge test uncorrected');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('ترجمه ماشینی ذخیره در حافظه');

    // Standard memory badge: has .pill-tm, does NOT have .pill-corrected, text contains "از حافظه" / "from memory"
    const memoryBadge = page.locator('#tMeta .pill-tm');
    await expect(memoryBadge).toBeVisible();
    await expect(memoryBadge).not.toHaveClass(/pill-corrected/);
    await expect(memoryBadge).toHaveText(/از حافظه|from memory/);

    // Snapshot uncorrected badge attributes while visible
    const memBadgeClass = await memoryBadge.getAttribute('class');
    const memBadgeText = await memoryBadge.textContent();

    // 2. Put corrected translation into memory
    await page.evaluate(async () => {
      const tm = window.TranslationMemory;
      await tm.put({
        sourceText: 'Badge test user correction',
        translatedText: 'ترجمه اصلاح‌شده کاربر',
        src: 'auto',
        tgt: 'fa',
        modeClass: 'fast',
        corrected: true
      });
    });

    // Translate corrected text
    await mouseClick(page, page.locator('#tClear'));
    await page.locator('#tIn').fill('Badge test user correction');
    await mouseClick(page, page.locator('#tGo'));

    await expect(page.locator('#tOut')).toHaveValue('ترجمه اصلاح‌شده کاربر');

    // Correction badge: has .pill-corrected, text contains "ویرایش شما" / "Your correction"
    const correctionBadge = page.locator('#tMeta .pill-corrected');
    await expect(correctionBadge).toBeVisible();
    await expect(correctionBadge).toHaveText(/ویرایش شما|Your correction/);

    // Snapshot corrected badge attributes
    const corrBadgeClass = await correctionBadge.getAttribute('class');
    const corrBadgeText = await correctionBadge.textContent();

    // The two badges must differ in class and text
    expect(memBadgeClass).not.toBe(corrBadgeClass);
    expect(memBadgeText).not.toBe(corrBadgeText);
  });
});


