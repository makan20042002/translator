'use strict';
// "Engines & keys" window: entering keys, Check connections, and where keys go.
const { test, expect, onlyEngines, mouseClick, VALID_KEY, BAD_KEY } = require('../support/fixtures');

async function openSettings(page) {
  await mouseClick(page, page.locator('#openSet'));
  await expect(page.locator('#ov')).toHaveClass(/\bon\b/);
}

async function typeKey(page, engine, key) {
  const input = page.locator(`#engList .eng[data-id="${engine}"] input[data-f="key"]`);
  await mouseClick(page, input);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(key);
}

async function checkConnections(page) {
  await mouseClick(page, page.locator('#btnCheckConn'));
  await expect(page.locator('#checkConnSummary')).toHaveText(/^\d+\/\d+ works$/, { timeout: 30_000 });
  await expect(page.locator('#btnCheckConn')).toBeEnabled();
}

const statusOf = (page, engine) => page.locator(`#engList .eng[data-id="${engine}"] .eng-status`);

test.describe('Web app: Engines & keys', () => {
  test('opens, saves a typed Gemini key, and "Check connections" finishes with a status for every engine', async ({ app }) => {
    const { page, errors } = app;
    await page.route('http://localhost:11434/**', route => route.abort());
    await openSettings(page);
    const rows = page.locator('#engList .eng');
    const engineCount = await rows.count();
    expect(engineCount).toBe(13);
    await typeKey(page, 'gemini', VALID_KEY);
    await checkConnections(page);
    await expect(rows.locator('.eng-status')).toHaveCount(engineCount);
    await expect(statusOf(page, 'gemini')).toHaveText('works');
    await expect(statusOf(page, 'google')).toHaveText('works');
    await expect(statusOf(page, 'mymemory')).toHaveText('works');
    // Ollama is not running on this machine; it must say so rather than "works".
    await expect(statusOf(page, 'ollama')).not.toHaveText('works');
    await mouseClick(page, page.locator('#btnSaveDone'));
    await expect(page.locator('#ov')).not.toHaveClass(/\bon\b/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')));
    expect(stored.eng.gemini.key).toBe(VALID_KEY);
    // The key is kept after a reload and Gemini becomes available in the Engine menu.
    await page.reload();
    await expect(page.locator('#engine option[value="gemini"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('a wrong Gemini key is reported as "key rejected"', async ({ app }) => {
    const { page } = app;
    await openSettings(page);
    await typeKey(page, 'gemini', BAD_KEY);
    await checkConnections(page);
    await expect(statusOf(page, 'gemini')).toHaveText('key rejected');
  });

  test('a provider outage (HTTP 500) is not reported as "key rejected"', async ({ app }) => {
    const { page, stub } = app;
    await openSettings(page);
    await typeKey(page, 'gemini', VALID_KEY);
    stub.failHost('generativelanguage.googleapis.com', 500, Infinity, { error: { code: 500, message: 'Internal error encountered.', status: 'INTERNAL' } });
    await checkConnections(page);
    await expect(statusOf(page, 'gemini'), 'a server error says nothing about the key').not.toHaveText('key rejected');
  });

  test('API keys are not sent to the web app\'s own server', async ({ app }) => {
    // The footer promises: "Keys stay in your browser and are sent only to the provider you choose."
    const { page, stub } = app;
    await openSettings(page);
    await typeKey(page, 'gemini', VALID_KEY);
    await typeKey(page, 'groq', 'gsk_' + VALID_KEY);
    await mouseClick(page, page.locator('#btnSaveDone'));
    await page.reload();
    await page.waitForTimeout(1500);
    const leaks = stub.log.filter(e => e.server === 'app' && (e.body.includes(VALID_KEY) || e.query.includes(VALID_KEY)));
    expect(leaks.map(e => `${e.method} ${e.path} body=${e.body}`), 'requests to the web app\'s own server that contain an API key').toEqual([]);
  });

  test.describe('voice settings', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('"Silence wait" in Engines & keys is saved', async ({ app }) => {
      const { page } = app;
      await openSettings(page);
      // There are two elements with id="vSilenceWait"; this is the one inside the Engines & keys window.
      const sel = page.locator('#ov select#vSilenceWait');
      await expect(sel).toBeVisible();
      await sel.selectOption('1500');
      await mouseClick(page, page.locator('#btnSaveDone'));
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_cfg')).silenceWait);
      expect(stored, 'saved silence wait (ms)').toBe(1500);
    });
  });
});
