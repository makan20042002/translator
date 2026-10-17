'use strict';
/**
 * Guard test: verifies that the extension test environment isolates the background
 * context from any real Ollama instance running on port 11434 (loopback), while
 * keeping the stub app server accessible via the proxy bypass list.
 */
const { test, expect } = require('../support/ext-fixtures');

test.describe('Extension: Ollama loopback isolation', () => {
  test('extension background context cannot reach loopback port 11434', async ({ ext }) => {
    const sw = await ext.worker();

    const res127 = await sw.evaluate(() =>
      fetch('http://127.0.0.1:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(res127).toBe('blocked');

    const resLocalhost = await sw.evaluate(() =>
      fetch('http://localhost:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(resLocalhost).toBe('blocked');

    // Also verify from extension page context
    const extPage127 = await ext.inExtension(() =>
      fetch('http://127.0.0.1:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(extPage127).toBe('blocked');

    const extPageLocalhost = await ext.inExtension(() =>
      fetch('http://localhost:11434/api/tags').then(() => 'reachable', () => 'blocked')
    );
    expect(extPageLocalhost).toBe('blocked');
  });

  test('stub app server is still reachable from the extension page via proxy bypass', async ({ ext, stub }) => {
    const status = await ext.inExtension(async (appOrigin) => {
      try {
        const res = await fetch(`${appOrigin}/index.html`);
        return res.ok ? 'reachable' : 'bad-status';
      } catch {
        return 'blocked';
      }
    }, stub.appOrigin);

    expect(status).toBe('reachable');

    // Also verify from service worker
    const swStatus = await (await ext.worker()).evaluate(async (appOrigin) => {
      try {
        const res = await fetch(`${appOrigin}/index.html`);
        return res.ok ? 'reachable' : 'bad-status';
      } catch {
        return 'blocked';
      }
    }, stub.appOrigin);

    expect(swStatus).toBe('reachable');
  });
});
