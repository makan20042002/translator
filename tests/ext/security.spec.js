'use strict';
// Extension security: where keys go, who may read them, and who may start a translation.
const { test, expect, inShadow, dragSelect, dblclickText, pressM, openRealPopup, inContentScriptWorld, expectNoExtensionErrors } = require('../support/ext-fixtures');
const { KEYS, findKeyLeaks, findKeysInText } = require('../support/key-leaks');
const { watchConsole, mouseClick } = require('../support/fixtures');

const KEY_ENGINES = Object.keys(KEYS);
const ALL_KEYS_CONFIG = { eng: Object.fromEntries(KEY_ENGINES.map(id => [id, { on: true, key: KEYS[id] }])) };

test.describe('Extension: API key safety', () => {
  test.use({ extOptions: { config: ALL_KEYS_CONFIG } });

  test('no key is sent to any host except its own provider, and none appears in an address, message or log', async ({ ext, stub }) => {
    test.setTimeout(150_000);
    const page = ext.article;
    const consoleLines = [];
    page.on('console', m => consoleLines.push(m.text()));

    // Card: selection translation (Gemini first), read-aloud, dictionary.
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
    await inShadow(page, '#makanSpeakBtn').click();
    await expect.poll(() => stub.calls('generativelanguage.googleapis.com').some(c => /streamGenerateContent/.test(c.path))).toBe(true);
    await page.keyboard.press('Escape');
    await dblclickText(page, '#p3');
    await expect(inShadow(page, '.makan-dict-word')).toHaveText('Serendipity');

    // Popup: translate once with every provider.
    const popup = await openRealPopup(ext);
    for (const id of KEY_ENGINES) {
      await popup.eval(`(() => { document.getElementById('pEngineSel').value = ${JSON.stringify(id)}; document.getElementById('pInputText').value = 'Hello ${id}'; document.getElementById('pOutputText').textContent = ''; })()`);
      await popup.click('#pTransBtn');
      await popup.waitFor(`document.getElementById('pOutputText').textContent.startsWith('[fa] Hello')`);
    }
    await popup.close();

    // Options page: Check connections.
    const options = await ext.context.newPage();
    watchConsole(options, ext.pageErrors);
    options.on('console', m => consoleLines.push(m.text()));
    await options.goto(ext.url('options.html'));
    await mouseClick(options, options.locator('#btnCheckConn'));
    await expect(options.locator('#optToasts')).toContainText(/Connections checked/, { timeout: 30_000 });
    const shown = await options.locator('#optToasts').innerText() + await options.locator('#optEngineList .opt-status-pill').allInnerTexts().then(a => a.join('\n'));

    expect(stub.log.filter(e => e.server === 'provider').length, 'plenty of provider requests happened').toBeGreaterThan(15);
    expect(findKeyLeaks(stub), 'keys sent to the wrong place').toEqual([]);
    expect(findKeysInText('console output', consoleLines.join('\n'))).toEqual([]);
    expect(findKeysInText('on-screen text', shown)).toEqual([]);
    await expectNoExtensionErrors(ext);
  });

  test('a provider that repeats the key in an error does not get it shown on the card', async ({ ext, stub }) => {
    // Each provider repeats the key it was sent (as some real providers do).
    const hostOf = { gemini: 'generativelanguage.googleapis.com', openrouter: 'openrouter.ai', mistral: 'api.mistral.ai', cerebras: 'api.cerebras.ai', openai: 'api.openai.com', claude: 'api.anthropic.com', groq: 'api.groq.com' };
    for (const [id, host] of Object.entries(hostOf)) stub.failHost(host, 400, Infinity, { error: { message: `Bad request, your key was ${KEYS[id]}` } });
    for (const h of ['clients5.google.com', 'translate.googleapis.com', 'api.mymemory.translated.net']) stub.failHost(h, 400, Infinity, { error: { message: 'Bad request' } });
    // Show every engine's error, not only the last one.
    await ext.patchConfig({ order: Object.keys(hostOf), eng: { google: { on: false }, mymemory: { on: false }, ollama: { on: false } } });
    await ext.article.reload();
    const popup = await openRealPopup(ext);
    const texts = [];
    for (const id of Object.keys(hostOf)) {
      await popup.eval(`(() => { document.getElementById('pEngineSel').value = ${JSON.stringify(id)}; document.getElementById('pInputText').value = 'Hello'; document.getElementById('pOutputText').textContent = ''; })()`);
      await popup.click('#pTransBtn');
      await popup.waitFor(`document.getElementById('pOutputText').textContent.includes('Translation failed')`);
      texts.push(await popup.eval(`document.getElementById('pOutputText').textContent`));
    }
    await popup.close();
    expect(texts.join('\n')).toContain('Bad request');
    expect(findKeysInText('the popup', texts.join('\n'))).toEqual([]);
  });

  test('a provider\'s address cannot be redirected by a saved setting, so its key cannot be sent elsewhere', async ({ ext, stub }) => {
    await ext.patchConfig({
      order: ['openai'],
      eng: Object.fromEntries(['gemini', 'openrouter', 'mistral', 'cerebras', 'claude', 'ollama', 'google', 'mymemory', 'groq'].map(id => [id, { on: false }]).concat([['openai', { on: true, key: KEYS.openai, base: 'https://evil.example.test/v1' }]]))
    });
    const page = ext.article;
    await page.reload();
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toHaveText('[fa] First item in the list of things.');
    expect(stub.log.filter(e => e.host.endsWith('.example.test')).map(e => e.host + e.path), 'requests to the redirected address').toEqual([]);
    expect(stub.calls('api.openai.com').length).toBeGreaterThan(0);
  });
});

test.describe('Extension: the part that runs inside web pages gets no keys and no powers', () => {
  test.use({ extOptions: { config: ALL_KEYS_CONFIG } });

  /** Everything the content script (the code running inside each web page) can ask the extension, tried one by one. */
  const PROBE = `(async () => {
    const out = {};
    const ask = async msg => { try { return JSON.stringify(await chrome.runtime.sendMessage(msg)); } catch (e) { return 'ERR ' + e.message; } };
    out.getConfig = await ask({ action: 'get-config' });
    out.getPublicConfig = await ask({ action: 'get-public-config' });
    out.saveConfig = await ask({ action: 'save-config', cfg: { eng: { gemini: { key: 'attacker-key' } }, order: ['gemini'] } });
    out.toggleSite = await ask({ action: 'toggle-site-disabled', host: 'example.com' });
    out.testEngine = await ask({ action: 'test-engine', id: 'gemini' });
    out.testAll = await ask({ action: 'test-all-engines' });
    out.tabStatus = await ask({ action: 'check-tab-status' });
    out.inject = await ask({ action: 'inject-into-tab', tabId: 1 });
    out.fakeTtsState = await ask({ target: 'makan-background', action: 'tts-state', state: 'ended', token: 1 });
    try { out.storage = JSON.stringify(await chrome.storage.local.get('makan_cfg')); } catch (e) { out.storage = 'ERR ' + e.message; }
    return out;
  })()`;

  test('no answer the content script can get contains an API key, and it cannot read the extension\'s storage', async ({ ext }) => {
    const out = await inContentScriptWorld(ext, ext.article, PROBE);
    const everything = JSON.stringify(out);
    expect(findKeysInText('an answer given to the web page side', everything)).toEqual([]);
    expect(out.storage, 'the content script must not be able to read stored settings').not.toContain('makan_cfg');
    expect(JSON.parse(out.getPublicConfig)).toMatchObject({ ok: true });
    expect(JSON.parse(out.getPublicConfig).cfg.tgt).toBe('fa');
  });

  test('the content script cannot change settings, switch sites off, or use the extension\'s other tools', async ({ ext }) => {
    const before = await ext.getConfig();
    const out = await inContentScriptWorld(ext, ext.article, PROBE);
    for (const action of ['saveConfig', 'toggleSite', 'testEngine', 'testAll', 'tabStatus', 'inject']) {
      expect(JSON.parse(out[action]), `${action} from a web page's content script`).toMatchObject({ ok: false });
    }
    const after = await ext.getConfig();
    expect(after.eng.gemini.key, 'stored Gemini key after the attempt').toBe(KEYS.gemini);
    expect(after.disabledSites || []).toEqual(before.disabledSites || []);
    expect(after.order).toEqual(before.order);
  });
});
