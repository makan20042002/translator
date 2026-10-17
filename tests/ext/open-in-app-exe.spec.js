'use strict';

const http = require('http');
const { test, expect, inShadow, dragSelect, pressM, openRealPopup } = require('../support/ext-fixtures');

test.describe('Extension: Open in App via desktop app bridge', () => {
  let bridgeServer;
  let bridgePort;
  let receivedRequests = [];

  test.beforeAll(async () => {
    receivedRequests = [];
    await new Promise((resolve) => {
      bridgeServer = http.createServer((req, res) => {
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Makan-Open'
        };

        if (req.method === 'OPTIONS') {
          res.writeHead(204, corsHeaders);
          res.end();
          return;
        }

        if (req.url === '/__makan/ping' && req.method === 'GET') {
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ app: 'makan-translate', v: 1 }));
          return;
        }

        if (req.url === '/__makan/open' && req.method === 'POST') {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => {
            let body = null;
            try { body = JSON.parse(data); } catch {}
            receivedRequests.push({
              headers: req.headers,
              body
            });
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
          return;
        }

        res.writeHead(404, corsHeaders);
        res.end('Not found');
      });

      // Bind to 50505 if available, or an available port
      bridgeServer.once('error', () => {
        bridgeServer.listen(0, '127.0.0.1', () => {
          bridgePort = bridgeServer.address().port;
          resolve();
        });
      });
      bridgeServer.listen(50505, '127.0.0.1', () => {
        bridgePort = 50505;
        resolve();
      });
    });
  });

  test.afterAll(() => {
    if (bridgeServer) bridgeServer.close();
  });

  test('selection card "Open in App" notifies bridge, shows in-card note, and does not open new tab', async ({ ext }) => {
    await ext.patchConfig({ appUrl: `http://127.0.0.1:${bridgePort}` });
    const page = ext.article;
    const initialPagesCount = ext.context.pages().length;
    receivedRequests = [];

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openBtn = inShadow(page, '#makanOpenApp');
    await openBtn.click();

    await expect.poll(() => receivedRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const lastReq = receivedRequests[receivedRequests.length - 1];
    expect(lastReq.headers['x-makan-open']).toBe('1');
    expect(lastReq.body).toBeTruthy();
    expect(lastReq.body.text).toContain('First item in the list of things');

    // Shows in-card note
    const note = inShadow(page, '.makan-card-note');
    await expect(note).toBeVisible({ timeout: 5000 });
    await expect(note).toContainText(/Opened in MAKAN Translate|در MAKAN Translate باز شد/);

    // No new browser tab opened
    expect(ext.context.pages().length).toBe(initialPagesCount);
  });

  test('popup "Open in App" notifies bridge, displays confirmation, and does not open new tab', async ({ ext }) => {
    await ext.patchConfig({ appUrl: `http://127.0.0.1:${bridgePort}` });
    const initialPagesCount = ext.context.pages().length;
    receivedRequests = [];

    const popup = await openRealPopup(ext);
    await popup.click('#pInputText');
    await popup.eval(`(() => { const t = document.getElementById('pInputText'); t.value = 'Popup bridge test'; })()`);
    await popup.click('#pTransBtn');
    await popup.waitFor(`document.getElementById('pOutputText').textContent.startsWith('[fa] Popup bridge test')`);

    await popup.click('#pOpenWebApp');

    await expect.poll(() => receivedRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const lastReq = receivedRequests[receivedRequests.length - 1];
    expect(lastReq.headers['x-makan-open']).toBe('1');
    expect(lastReq.body.text).toBe('Popup bridge test');

    const msg = await popup.locator('#pOpenAppMsg');
    await expect(msg).toBeVisible({ timeout: 5000 });
    await expect(msg).toContainText(/Opened in MAKAN Translate|در MAKAN Translate باز شد/);

    // No extra tab opened
    expect(ext.context.pages().length).toBe(initialPagesCount);
    await popup.close();
  });

  test('when bridge is unavailable, clicking "Open in App" falls back to opening new tab with hash', async ({ ext }) => {
    // Configure an inactive port so ping fails
    await ext.patchConfig({ appUrl: 'http://127.0.0.1:50599' });
    const page = ext.article;

    await dragSelect(page, '#li1');
    await pressM(page);
    await expect(inShadow(page, '.makan-result-text')).toBeVisible({ timeout: 15_000 });

    const openBtn = inShadow(page, '#makanOpenApp');
    const newPagePromise = ext.context.waitForEvent('page');
    await openBtn.click();

    const newPage = await newPagePromise;
    expect(newPage).toBeTruthy();
    const url = new URL(newPage.url());
    expect(url.hash).toContain('text=');
    expect(url.hash).toContain('First%20item%20in%20the%20list%20of%20things');
    await newPage.close();
  });
});
