'use strict';

const { test, expect, inShadow, dragSelect, pressM } = require('../support/ext-fixtures');

async function mockWorkerBridge(ext, { reachable = true, rejectPing = false } = {}) {
  const sw = await ext.worker();
  await sw.evaluate(({ reachable, rejectPing }) => {
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
        if (!url.includes('/__makan/')) {
          return self._realFetch(input, init);
        }

        const method = (init.method || 'GET').toUpperCase();
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

        // Real Chrome attaches Origin on non-GET requests from service workers
        const origin = headers['origin'] || (method !== 'GET' ? self.location.origin : '');
        if (origin) {
          headers['origin'] = origin;
        }

        let body = null;
        try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch {}
        self._bridgeRequests.push({ url, method, headers, body });

        // Strict validation: GET ping without Origin -> 403
        if (url.includes('/__makan/ping') && method === 'GET') {
          if (!origin || !origin.startsWith('chrome-extension://')) {
            return new Response(JSON.stringify({ error: 'Forbidden: Extension origin required' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // Strict validation: any /__makan/* request must have extension origin and X-Makan-Open: 1
        if (!origin || !origin.startsWith('chrome-extension://') || headers['x-makan-open'] !== '1') {
          return new Response(JSON.stringify({ error: 'Forbidden: Untrusted caller' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Simulate ping failure when requested
        if (rejectPing && url.includes('/__makan/ping')) {
          return new Response(JSON.stringify({ error: 'Forbidden: Ping check rejected' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (url.includes('/__makan/ping')) {
          if (method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ app: 'makan-translate', v: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (url.includes('/__makan/open')) {
          if (method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ ok: true, via: 'exe' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response('Not found', { status: 404 });
      };
    }
  }, { reachable, rejectPing });
}

test.describe('Extension: Open in App via desktop app bridge (POST ping)', () => {

  test('clicking Open in App with strict fake bridge makes POST ping and open calls, shows note, and opens no new tab', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: true, rejectPing: false });
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
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    const requests = await sw.evaluate(() => self._bridgeRequests);
    const pingReq = requests.find(r => r.url.includes('/__makan/ping'));
    expect(pingReq).toBeTruthy();
    expect(pingReq.method).toBe('POST');
    expect(pingReq.headers['x-makan-open']).toBe('1');
    expect(pingReq.headers['origin']).toMatch(/^chrome-extension:\/\//);

    const openReq = requests.find(r => r.url.includes('/__makan/open'));
    expect(openReq).toBeTruthy();
    expect(openReq.method).toBe('POST');
    expect(openReq.headers['x-makan-open']).toBe('1');
    expect(openReq.headers['origin']).toMatch(/^chrome-extension:\/\//);
    expect(openReq.body).toBeTruthy();
    expect(openReq.body.text).toContain('First item in the list of things');

    // No new browser tab opened
    await page.waitForTimeout(2000);
    expect(ext.context.pages().length).toBe(initialPagesCount);
  });

  test('when the fake bridge answers 403 to the ping, the extension opens the web app link in a new tab (fallback)', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: true, rejectPing: true });
    const page = ext.article;
    const expectedText = (await page.locator('#li1').innerText()).trim();

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

    const params = new URLSearchParams(url.hash.slice(1));
    expect(params.get('text')).toBe(expectedText);
    expect(params.get('src')).toBeTruthy();
    expect(params.get('tgt')).toBeTruthy();
    await newPage.close();
  });
});
