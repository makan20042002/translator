'use strict';
// Text tab: typing, translating with keyboard and mouse, engine fallback,
// history, and the address-bar hand-off used by the extension's "Open in App".
const { test, expect, onlyEngines, mouseClick, VALID_KEY } = require('../support/fixtures');

test.describe('Web app: Text tab', () => {
  test.describe('with only Google switched on', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('typed text is translated with Ctrl+Enter, line breaks are kept, and the result is saved in History', async ({ app }) => {
      const { page, stub, errors } = app;
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Good morning');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('How are you today?');
      await expect(page.locator('#tCount')).toContainText('32 characters');
      await page.keyboard.press('Control+Enter');
      await expect(page.locator('#tOut')).toHaveValue('[fa] Good morning\n\n[fa] How are you today?');
      await expect(page.locator('#tMeta')).toContainText('Google Translate (web)');

      // The request really went to Google's address, with each non-empty line separately.
      const calls = stub.calls('clients5.google.com');
      expect(calls.length).toBe(1);
      const sent = new URLSearchParams(calls[0].body).getAll('q');
      expect(sent).toEqual(['Good morning', 'How are you today?']);
      expect(calls[0].query).toContain('tl=fa');

      await mouseClick(page, page.locator('#tabs button[data-tab="hist"]'));
      const item = page.locator('#hList .item').first();
      await expect(item).toContainText('Good morning');
      await expect(item).toContainText('[fa] Good morning');
      // Clicking a history entry puts it back into the Text tab.
      await mouseClick(page, page.locator('#tabs button[data-tab="text"]'));
      await mouseClick(page, page.locator('#tClear'));
      await expect(page.locator('#tIn')).toHaveValue('');
      await mouseClick(page, page.locator('#tabs button[data-tab="hist"]'));
      await mouseClick(page, item.locator('.a'));
      await expect(page.locator('#tab-text')).toBeVisible();
      await expect(page.locator('#tIn')).toHaveValue('Good morning\n\nHow are you today?');
      expect(errors).toEqual([]);
    });

    test('Copy puts the translation on the clipboard', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Copy me');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tOut')).toHaveValue('[fa] Copy me');
      await mouseClick(page, page.locator('#tCopy'));
      await expect(page.locator('#toasts')).toContainText('Copied');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('[fa] Copy me');
    });

    test('opening the app with ?text=…&src=…&tgt=… (what the extension\'s "Open in App" does) fills the Text tab', async ({ app }) => {
      // The extension card and popup link to `<web app>/?text=…&src=…&tgt=…`.
      const { page, stub } = app;
      await page.goto(stub.appOrigin + '/?text=' + encodeURIComponent('Hello from the extension') + '&src=en&tgt=fa');
      await expect(page.locator('#tabs button').first()).toBeVisible();
      await expect(page.locator('#tIn'), 'the text passed in the address should appear in the source box').toHaveValue('Hello from the extension', { timeout: 3000 });
    });

    test('when the only engine is rate-limited (HTTP 429), the user gets an answer or an error within 30 seconds', async ({ app }) => {
      test.setTimeout(60_000);
      const { page, stub } = app;
      stub.failHost('clients5.google.com', 429);
      stub.failHost('translate.googleapis.com', 429);
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Rate limited');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tGo')).toBeDisabled();
      // Either the button comes back with an error message, or a result appears.
      await expect(page.locator('#tGo'), 'Translate button should be usable again (with an error shown) instead of retrying forever')
        .toBeEnabled({ timeout: 30_000 })
        .catch(async e => {
          const n = stub.calls('translate.googleapis.com').length + stub.calls('clients5.google.com').length;
          throw new Error(`${e.message}\nThe app sent ${n} requests in 30 s and was still retrying.`);
        });
    });
  });

  test.describe('with Gemini first and Google second (Smart mode)', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'smart' } } });

    test('Gemini is used when it works', async ({ app }) => {
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Use the AI engine');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tOut')).toHaveValue('[fa] Use the AI engine');
      await expect(page.locator('#tMeta')).toContainText('Google Gemini');
      const g = stub.calls('generativelanguage.googleapis.com');
      expect(g.length).toBe(1);
      // The key travels in a header, not in the address.
      expect(g[0].headers['x-goog-api-key']).toBe(VALID_KEY);
      expect(g[0].query).not.toContain(VALID_KEY);
      expect(stub.calls('clients5.google.com').length).toBe(0);
    });

    test('when Gemini fails, Google takes over and the user is told', async ({ app }) => {
      const { page, stub } = app;
      stub.failHost('generativelanguage.googleapis.com', 500);
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Fall back please');
      await mouseClick(page, page.locator('#tGo'));
      await expect(page.locator('#tOut')).toHaveValue('[fa] Fall back please');
      await expect(page.locator('#tMeta')).toContainText('Google Translate (web)');
      await expect(page.locator('#toasts')).toContainText('Google Gemini failed');
      expect(stub.calls('generativelanguage.googleapis.com').length).toBeGreaterThan(0);
      expect(stub.calls('clients5.google.com').length).toBe(1);
    });
  });

  test.describe('with Both mode (Fast first, then better)', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'both' } } });

    test('starts Fast and Smart together, displays Fast result first with Fast label, then replaces calmly with Gemini', async ({ app }) => {
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Dual translation');
      await mouseClick(page, page.locator('#tGo'));

      // Replaces with Gemini eventually
      await expect(page.locator('#tOut')).toHaveValue('[fa] Dual translation');
      await expect(page.locator('#tMeta')).toContainText('Google Gemini');

      // Both engines were called concurrently
      expect(stub.calls('clients5.google.com').length).toBe(1);
      expect(stub.calls('generativelanguage.googleapis.com').length).toBe(1);
    });

    test('if user copies Fast result before Smart finishes, Show improved button appears without overwriting under hands', async ({ app }) => {
      const { page, stub } = app;
      // Delay Gemini slightly to allow user to copy Fast result
      stub.delayHost('generativelanguage.googleapis.com', 300);

      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Do not overwrite');
      await mouseClick(page, page.locator('#tGo'));

      // Wait for Fast result to appear
      await expect(page.locator('#tOut')).toHaveValue('[fa] Do not overwrite');
      // Copy Fast result
      await mouseClick(page, page.locator('#tCopy'));

      // Show improved button should appear once Gemini completes
      const showBtn = page.locator('#tShowImproved');
      await expect(showBtn).toBeVisible({ timeout: 5000 });
      expect(await page.locator('#tOut').inputValue()).toBe('[fa] Do not overwrite');

      // Clicking Show improved updates output
      await mouseClick(page, showBtn);
      await expect(page.locator('#tOut')).toHaveValue('[fa] Do not overwrite');
      await expect(page.locator('#tMeta')).toContainText('Google Gemini');
      await expect(showBtn).not.toBeVisible();
    });

    test('if AI engine fails, keeps Fast result and informs user in one line', async ({ app }) => {
      const { page, stub } = app;
      stub.failHost('generativelanguage.googleapis.com', 500);

      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Keep the fast version');
      await mouseClick(page, page.locator('#tGo'));

      await expect(page.locator('#tOut')).toHaveValue('[fa] Keep the fast version');
      await expect(page.locator('#tMeta')).toContainText('Fast');
      await expect(page.locator('#tMeta')).toContainText('AI unavailable');
      expect(stub.calls('clients5.google.com').length).toBe(1);
    });
  });

  test.describe('with Fast mode selected', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), tMode: 'fast' } } });

    test('Fast mode calls only non-AI engine and labels output Fast', async ({ app }) => {
      const { page, stub } = app;
      await mouseClick(page, page.locator('#tIn'));
      await page.keyboard.type('Only fast engine');
      await mouseClick(page, page.locator('#tGo'));

      await expect(page.locator('#tOut')).toHaveValue('[fa] Only fast engine');
      await expect(page.locator('#tMeta')).toContainText('Fast');
      expect(stub.calls('clients5.google.com').length).toBe(1);
      expect(stub.calls('generativelanguage.googleapis.com').length).toBe(0);
    });
  });
});

