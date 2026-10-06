'use strict';
// Fast mode tries each non-AI engine in turn; Both mode still shows the Smart result when Fast fails.
const { test, expect, onlyEngines, mouseClick } = require('../support/fixtures');
const { VALID_KEY } = require('../support/stub-server');

const GOOGLE_HOSTS = ['clients5.google.com', 'translate.googleapis.com'];

async function translate(page, text) {
  await mouseClick(page, page.locator('#tIn'));
  await page.keyboard.type(text);
  await mouseClick(page, page.locator('#tGo'));
}

test.describe('Web app: Fast engine chain', () => {
  test.describe('Fast mode', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'mymemory']), tMode: 'fast', src: 'en', tgt: 'fa' } } });

    test('when Google web is unreachable, MyMemory answers', async ({ app }) => {
      const { page, stub } = app;
      for (const h of GOOGLE_HOSTS) stub.failHost(h, 'drop');
      await translate(page, 'Try the next one');
      await expect(page.locator('#tOut')).toHaveValue('[fa] Try the next one', { timeout: 20_000 });
      await expect(page.locator('#tMeta')).toContainText('MyMemory');
      expect(stub.calls('api.mymemory.translated.net').length).toBeGreaterThan(0);
    });

    test('when every Fast engine fails the user gets a plain message and can try again', async ({ app }) => {
      const { page, stub } = app;
      for (const h of [...GOOGLE_HOSTS, 'api.mymemory.translated.net']) stub.failHost(h, 'drop');
      await translate(page, 'Nothing works');
      await expect(page.locator('#toasts')).toContainText(/unreachable|network|blocked/i, { timeout: 20_000 });
      await expect(page.locator('#tGo')).toBeEnabled();
    });
  });

  test.describe('Both mode', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google', 'mymemory'], { gemini: VALID_KEY }), tMode: 'both', src: 'en', tgt: 'fa' } } });

    test('Fast fails completely: the Smart result is shown, with a one-line note', async ({ app }) => {
      const { page, stub } = app;
      for (const h of [...GOOGLE_HOSTS, 'api.mymemory.translated.net']) stub.failHost(h, 'drop');
      await translate(page, 'Smart still works');
      await expect(page.locator('#tOut')).toHaveValue('[fa] Smart still works', { timeout: 20_000 });
      await expect(page.locator('#tMeta')).toContainText('Google Gemini');
      await expect(page.locator('#tMeta .fast-failed')).toContainText(/Fast engines failed/);
    });
  });
});
