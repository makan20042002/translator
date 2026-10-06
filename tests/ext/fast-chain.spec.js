'use strict';
// Extension: Fast tries Google, then MyMemory; Both shows the Smart result when Fast fails.
const { test, expect, inShadow, dragSelect, pressM } = require('../support/ext-fixtures');
const { VALID_KEY } = require('../support/stub-server');

const NON_AI = ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net'];

test.describe('Extension: Fast chain', () => {
  test.describe('Fast', () => {
    test.use({ extOptions: { config: { transMode: 'fast', eng: { google: { on: true }, mymemory: { on: true } } } } });
    test('Google unreachable: MyMemory answers on the card', async ({ ext, stub }) => {
      for (const h of NON_AI.slice(0, 2)) stub.failHost(h, 'drop');
      const page = ext.article;
      await dragSelect(page, '#li1');
      await pressM(page);
      await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.', { timeout: 20_000 });
      await expect(inShadow(page, '#makanEnginePill')).toContainText('MyMemory');
    });
  });

  test.describe('Both', () => {
    test.use({ extOptions: { config: { transMode: 'both', eng: { gemini: { on: true, key: VALID_KEY }, google: { on: true }, mymemory: { on: true } } } } });
    test('Fast fails completely: the Smart result is shown with a one-line note', async ({ ext, stub }) => {
      for (const h of NON_AI) stub.failHost(h, 'drop');
      const page = ext.article;
      await dragSelect(page, '#li1');
      await pressM(page);
      await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.', { timeout: 20_000 });
      await expect(inShadow(page, '#makanEnginePill')).toContainText('Fast engines failed');
      await expect(inShadow(page, '#makanEnginePill')).toContainText('Google Gemini');
    });
  });
});
