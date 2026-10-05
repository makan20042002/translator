'use strict';
// Extension options page, and moving settings from the web app to the extension.
const { test, expect, inShadow, dragSelect, pressM, openRealPopup, expectNoExtensionErrors, VALID_KEY, BAD_KEY } = require('../support/ext-fixtures');
const { watchConsole, mouseClick, downloadOf } = require('../support/fixtures');

async function openOptions(ext) {
  const page = await ext.context.newPage();
  const errors = [];
  watchConsole(page, errors);
  await page.goto(ext.url('options.html'));
  await expect(page.locator('#optEngineList .opt-eng-row').first()).toBeVisible();
  return { page, errors };
}

const row = (page, id) => page.locator(`#optEngineList .opt-eng-row[data-id="${id}"]`);

async function typeKey(page, id, key) {
  const input = row(page, id).locator('input[data-prop="key"]');
  await mouseClick(page, input);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(key);
  await page.keyboard.press('Tab'); // the page saves on "change"
}

test.describe('Extension: options page', () => {
  test('opens without errors and saves behaviour settings', async ({ ext }) => {
    const { page, errors } = await openOptions(ext);
    await expect(page.locator('#optTitle')).toHaveText('Engines & Settings');
    await expect(page.locator('#optEngineList .opt-eng-row')).toHaveCount(11);
    await page.locator('#selDefaultTgt').selectOption('de');
    await expect(page.locator('#optToasts')).toContainText('Saved');
    await page.locator('#selTrigger').selectOption('alt');
    await mouseClick(page, page.locator('#chkDictLookup'));
    await expect.poll(async () => { const c = await ext.getConfig(); return [c.tgt, c.trigger, c.dictLookup]; }).toEqual(['de', 'alt', false]);
    // Persian interface switches the page to right-to-left.
    await mouseClick(page, page.locator('#optLangToggle'));
    await expect(page.locator('body')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#optLangToggle')).toHaveText('English');
    expect(errors).toEqual([]);
    await expectNoExtensionErrors(ext);
  });

  test('a typed Gemini key is saved, and "Check Connections" reports each engine', async ({ ext }) => {
    const { page, errors } = await openOptions(ext);
    await typeKey(page, 'gemini', VALID_KEY);
    await expect.poll(async () => (await ext.getConfig()).eng.gemini.key).toBe(VALID_KEY);
    await mouseClick(page, page.locator('#btnCheckConn'));
    await expect(page.locator('#optToasts')).toContainText(/Connections checked: \d+\/11 working/, { timeout: 30_000 });
    await expect(row(page, 'gemini').locator('.opt-status-pill')).toHaveText('Works');
    await expect(row(page, 'google').locator('.opt-status-pill')).toHaveText('Works');
    await expect(row(page, 'openai').locator('.opt-status-pill')).toHaveText('Key needed');
    await expect(row(page, 'ollama').locator('.opt-status-pill')).toHaveText('Ollama not running');
    await expect(page.locator('#optEngineList .opt-status-pill')).toHaveCount(11);
    expect(errors).toEqual([]);
  });

  test('a wrong Gemini key is reported as "Key rejected"', async ({ ext }) => {
    const { page } = await openOptions(ext);
    await typeKey(page, 'gemini', BAD_KEY);
    await mouseClick(page, page.locator('#btnCheckConn'));
    await expect(page.locator('#optToasts')).toContainText(/Connections checked/, { timeout: 30_000 });
    await expect(row(page, 'gemini').locator('.opt-status-pill'), 'Gemini answers "API key not valid" for a wrong key').toHaveText('Key rejected');
  });

  test('"Export Backup" downloads a settings file containing the saved settings', async ({ ext }) => {
    const { page } = await openOptions(ext);
    await typeKey(page, 'mistral', 'mistral-test-key');
    const file = await downloadOf(page, () => mouseClick(page, page.locator('#btnExportSettings')));
    expect(file.name).toBe('makan-translate-settings.json');
    const data = JSON.parse(file.bytes.toString('utf8'));
    expect(data.eng.mistral.key).toBe('mistral-test-key');
    expect(Array.isArray(data.order)).toBe(true);
  });

  test('settings exported from the web app ("Export for Extension") can be imported, and the extension still translates', async ({ ext, stub }) => {
    // 1. In the web app, save a Gemini key and press "Export for Extension".
    const web = await ext.context.newPage();
    await web.goto(stub.appUrl);
    await mouseClick(web, web.locator('#openSet'));
    const key = web.locator('#engList .eng[data-id="gemini"] input[data-f="key"]');
    await mouseClick(web, key);
    await web.keyboard.type(VALID_KEY);
    const exported = await downloadOf(web, () => mouseClick(web, web.locator('#btnExportForExt')));
    expect(exported.name).toBe('makan-settings.json');
    const fs = require('fs'), os = require('os'), path = require('path');
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'makan-exp-')), exported.name);
    fs.writeFileSync(tmp, exported.bytes);

    // 2. In the extension options, "Import Settings File".
    const { page } = await openOptions(ext);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), mouseClick(page, page.locator('#btnImportFile'))]);
    await chooser.setFiles(tmp);
    await expect(page.locator('#optToasts')).toContainText('imported successfully');
    await expect.poll(async () => (await ext.getConfig()).eng.gemini.key).toBe(VALID_KEY);

    // 3. Translate a selection on a web page.
    const article = ext.article;
    await article.bringToFront();
    await article.reload();
    await dragSelect(article, '#li1');
    await pressM(article);
    await expect(inShadow(article, '.makan-card .makan-card-body'), 'the card after importing web-app settings').toContainText('[fa] First item in the list of things.');
  });
});
