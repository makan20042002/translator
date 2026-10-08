'use strict';
// ITEM 1: Translation Memory store backed by IndexedDB.
const { test, expect } = require('../support/fixtures');

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
