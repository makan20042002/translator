'use strict';

const { test, expect, inShadow, dragSelect, pressM, openRealPopup } = require('../support/ext-fixtures');

async function mockWorkerBridge(ext, { reachable = true } = {}) {
  const sw = await ext.worker();
  await sw.evaluate((reachable) => {
    self._bridgeRequests = [];
    if (!self._realFetch) self._realFetch = self.fetch;
    if (!reachable) {
      self.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/__makan/')) {
          throw new Error('Connection refused (fake exe inactive)');
        }
        return self._realFetch(input, init);
      };
    } else {
      self.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/__makan/ping')) {
          const headers = {};
          if (init.headers) {
            if (init.headers instanceof Headers) {
              init.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
            } else if (Array.isArray(init.headers)) {
              for (const [k, v] of init.headers) headers[k.toLowerCase()] = v;
            } else {
              for (const k of Object.keys(init.headers)) headers[k.toLowerCase()] = init.headers[k];
            }
          }
          self._bridgeRequests.push({ url, method: init.method || 'GET', headers });
          return new Response(JSON.stringify({ app: 'makan-translate', v: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (url.includes('/__makan/open')) {
          const headers = {};
          if (init.headers) {
            if (init.headers instanceof Headers) {
              init.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
            } else if (Array.isArray(init.headers)) {
              for (const [k, v] of init.headers) headers[k.toLowerCase()] = v;
            } else {
              for (const k of Object.keys(init.headers)) headers[k.toLowerCase()] = init.headers[k];
            }
          }
          let body = null;
          try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch {}
          self._bridgeRequests.push({ url, method: init.method || 'POST', headers, body });
          return new Response(JSON.stringify({ ok: true, via: 'exe' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return self._realFetch(input, init);
      };
    }
  }, reachable);
}

test.describe('Extension: Open in App via desktop app bridge', () => {

  test('selection card "Open in App" notifies bridge, shows in-card note, and does not open new tab', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: true });
    const page = ext.article;
    const initialPagesCount = ext.context.pages().length;

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openBtn = inShadow(page, '#makanOpenApp');
    await openBtn.click();

    // Shows in-card note
    const note = inShadow(page, '.makan-card-note');
    await expect(note).toBeVisible({ timeout: 5000 });
    await expect(note).toHaveText('Opened in MAKAN Translate');

    const sw = await ext.worker();
    await expect.poll(async () => {
      const reqs = await sw.evaluate(() => self._bridgeRequests || []);
      return reqs.length;
    }, { timeout: 10_000 }).toBeGreaterThan(0);

    const requests = await sw.evaluate(() => self._bridgeRequests);
    const openReq = requests.find(r => r.url.includes('/__makan/open'));
    expect(openReq).toBeTruthy();
    expect(openReq.headers['x-makan-open']).toBe('1');
    expect(openReq.body).toBeTruthy();
    expect(openReq.body.text).toContain('First item in the list of things');
    expect(openReq.body.src).toBeDefined();
    expect(openReq.body.tgt).toBeDefined();

    // No new browser tab opened
    await page.waitForTimeout(2000);
    expect(ext.context.pages().length).toBe(initialPagesCount);

    // Second case: Persian UI replaced by "در MAKAN Translate باز شد"
    await ext.patchConfig({ ui: 'fa' });
    await page.reload();
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openBtnFa = inShadow(page, '#makanOpenApp');
    await openBtnFa.click();

    const noteFa = inShadow(page, '.makan-card-note');
    await expect(noteFa).toBeVisible({ timeout: 5000 });
    await expect(noteFa).toHaveText('در MAKAN Translate باز شد');

    await page.waitForTimeout(2000);
    expect(ext.context.pages().length).toBe(initialPagesCount);
  });

  test('popup "Open in App" notifies bridge, displays confirmation, and does not open new tab', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: true });
    const initialPagesCount = ext.context.pages().length;

    const popup = await openRealPopup(ext);
    await popup.click('#pInputText');
    await popup.eval(`(() => { const t = document.getElementById('pInputText'); t.value = 'Popup bridge test'; t.dispatchEvent(new Event('input')); })()`);
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent.startsWith('[fa] Popup bridge test')`);

    await popup.click('#pOpenWebApp');

    // Wait for confirmation note in popup via popup API (not popup.locator)
    await popup.waitFor(`(() => {
      const msg = document.getElementById('pOpenAppMsg');
      return msg && msg.style.display !== 'none' && /Opened in MAKAN Translate|در MAKAN Translate باز شد/.test(msg.textContent);
    })()`, 5000);

    const sw = await ext.worker();
    await expect.poll(async () => {
      const reqs = await sw.evaluate(() => self._bridgeRequests || []);
      return reqs.length;
    }, { timeout: 10_000 }).toBeGreaterThan(0);

    const requests = await sw.evaluate(() => self._bridgeRequests);
    const openReq = requests.find(r => r.url.includes('/__makan/open'));
    expect(openReq).toBeTruthy();
    expect(openReq.headers['x-makan-open']).toBe('1');
    expect(openReq.body).toBeTruthy();
    expect(openReq.body.text).toBe('Popup bridge test');
    expect(openReq.body.src).toBeDefined();
    expect(openReq.body.tgt).toBeDefined();

    // No extra tab opened
    expect(ext.context.pages().length).toBe(initialPagesCount);
    await popup.close();
  });

  test('when bridge is unavailable, clicking "Open in App" falls back to opening new tab with web app href', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: false });
    const page = ext.article;

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openBtn = inShadow(page, '#makanOpenApp');
    const newPagePromise = ext.context.waitForEvent('page');
    await openBtn.click();

    const newPage = await newPagePromise;
    expect(newPage).toBeTruthy();
    await newPage.waitForLoadState('domcontentloaded');

    await expect.poll(() => newPage.url(), { timeout: 10_000 }).toContain('#');
    const url = new URL(newPage.url());
    expect(url.origin).not.toBe('http://127.0.0.1:50505');
    const cfg = await ext.getConfig();
    const expectedOrigin = new URL(cfg.webAppUrl || 'https://makanlab.tech').origin;
    expect(url.origin).toBe(expectedOrigin);
    expect(url.hash).toContain('text=');
    expect(url.hash).toContain('First%20item%20in%20the%20list%20of%20things');
    await newPage.close();
  });
});
