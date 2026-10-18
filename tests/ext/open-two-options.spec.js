'use strict';

const { test, expect, inShadow, dragSelect, pressM, openRealPopup } = require('../support/ext-fixtures');

async function mockWorkerBridge(ext, { reachable = true } = {}) {
  const sw = await ext.worker();
  await sw.evaluate(({ reachable }) => {
    self._bridgeRequests = [];
    if (!self._realFetch) self._realFetch = self.fetch;

    self.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/__makan/') && !url.includes(':50505')) {
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

      let body = null;
      try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch {}
      self._bridgeRequests.push({ url, method, headers, body });

      if (!reachable) {
        throw new Error('Connection refused (fake exe inactive)');
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  }, { reachable });
}

test.describe('Extension: Open in Windows app and Open in browser side by side', () => {

  test('Selection card renders both choices in EN with one-line descriptions', async ({ ext }) => {
    const page = ext.article;
    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openApp = inShadow(page, '#makanOpenApp');
    const openBrowser = inShadow(page, '#makanOpenBrowser');

    await expect(openApp).toBeVisible();
    await expect(openBrowser).toBeVisible();

    const appText = (await openApp.innerText()).trim();
    const browserText = (await openBrowser.innerText()).trim();

    expect(appText).toContain('Open in Windows app');
    expect(browserText).toContain('Open in browser');

    const appDesc = inShadow(page, '#makanOpenApp ~ .makan-open-desc');
    const browserDesc = inShadow(page, '#makanOpenBrowser ~ .makan-open-desc');

    expect(await appDesc.innerText()).toContain('all features, OCR, offline models');
    expect(await browserDesc.innerText()).toContain('opens the web app at the Web App URL');
  });

  test('Selection card renders both choices in FA with Persian labels and descriptions', async ({ ext }) => {
    await ext.patchConfig({ ui: 'fa' });
    const page = ext.article;
    await page.reload();

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openApp = inShadow(page, '#makanOpenApp');
    const openBrowser = inShadow(page, '#makanOpenBrowser');

    await expect(openApp).toBeVisible();
    await expect(openBrowser).toBeVisible();

    const appText = (await openApp.innerText()).trim();
    const browserText = (await openBrowser.innerText()).trim();

    expect(appText).toContain('باز کردن در برنامه ویندوز');
    expect(browserText).toContain('باز کردن در مرورگر');

    const appDesc = inShadow(page, '#makanOpenApp ~ .makan-open-desc');
    const browserDesc = inShadow(page, '#makanOpenBrowser ~ .makan-open-desc');

    expect(await appDesc.innerText()).toContain('تمام امکانات، OCR، مدل‌های آفلاین');
    expect(await browserDesc.innerText()).toContain('باز کردن برنامه تحت وب');
  });

  test('Popup renders both choices in EN and FA', async ({ ext }) => {
    const popup = await openRealPopup(ext);

    // EN check
    const appTitleEn = await popup.eval(`document.querySelector('#pOpenWebApp .p-open-title')?.textContent.trim()`);
    const browserTitleEn = await popup.eval(`document.querySelector('#pOpenBrowser .p-open-title')?.textContent.trim()`);
    const appDescEn = await popup.eval(`document.getElementById('pOpenAppDesc')?.textContent.trim()`);
    const browserDescEn = await popup.eval(`document.getElementById('pOpenBrowserDesc')?.textContent.trim()`);

    expect(appTitleEn).toBe('Open in Windows app');
    expect(browserTitleEn).toBe('Open in browser');
    expect(appDescEn).toBe('all features, OCR, offline models');
    expect(browserDescEn).toContain('opens the web app at the Web App URL');

    // Toggle to FA
    await popup.click('#pLangToggle');
    const appTitleFa = await popup.eval(`document.querySelector('#pOpenWebApp .p-open-title')?.textContent.trim()`);
    const browserTitleFa = await popup.eval(`document.querySelector('#pOpenBrowser .p-open-title')?.textContent.trim()`);
    const appDescFa = await popup.eval(`document.getElementById('pOpenAppDesc')?.textContent.trim()`);
    const browserDescFa = await popup.eval(`document.getElementById('pOpenBrowserDesc')?.textContent.trim()`);

    expect(appTitleFa).toBe('باز کردن در برنامه ویندوز');
    expect(browserTitleFa).toBe('باز کردن در مرورگر');
    expect(appDescFa).toBe('تمام امکانات، OCR، مدل‌های آفلاین');
    expect(browserDescFa).toContain('باز کردن برنامه تحت وب');

    await popup.close();
  });

  test('Clicking "Open in browser" opens Web App URL with hash and makes NO request to port 50505', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: true });
    const page = ext.article;

    // Monitor all requests on the context
    const requestedPort50505 = [];
    ext.context.on('request', (req) => {
      if (req.url().includes('50505')) {
        requestedPort50505.push(req.url());
      }
    });

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openBrowserBtn = inShadow(page, '#makanOpenBrowser');
    const newPagePromise = ext.context.waitForEvent('page');
    await openBrowserBtn.click();

    const newPage = await newPagePromise;
    expect(newPage).toBeTruthy();
    await newPage.waitForLoadState('domcontentloaded');

    const targetUrl = new URL(newPage.url());
    expect(targetUrl.port).not.toBe('50505');
    expect(targetUrl.hash).toContain('text=');
    expect(targetUrl.hash).toContain('tgt=fa');

    // Assert NO request was made to port 50505
    const sw = await ext.worker();
    const bridgeReqs = await sw.evaluate(() => self._bridgeRequests || []);
    expect(bridgeReqs.length, 'Bridge requests when clicking Open in browser').toBe(0);
    expect(requestedPort50505.length, 'Context requests to 50505 when clicking Open in browser').toBe(0);

    await newPage.close();
  });

  test('Clicking "Open in App" still pings the exe port first', async ({ ext }) => {
    await mockWorkerBridge(ext, { reachable: true });
    const page = ext.article;

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openAppBtn = inShadow(page, '#makanOpenApp');
    await openAppBtn.click();

    // Verify bridge received ping request on port 50505
    const sw = await ext.worker();
    await expect.poll(async () => {
      const reqs = await sw.evaluate(() => self._bridgeRequests || []);
      return reqs.length;
    }, { timeout: 10_000 }).toBeGreaterThan(0);

    const requests = await sw.evaluate(() => self._bridgeRequests);
    const pingReq = requests.find(r => r.url.includes('/__makan/ping') || r.url.includes('/__makan/open'));
    expect(pingReq).toBeTruthy();
    expect(pingReq.headers['x-makan-open']).toBe('1');
  });

});
