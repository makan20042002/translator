'use strict';
// What a web page (or its content script) can learn about, or do to, the extension's own files and pages.
const { test, expect } = require('../support/ext-fixtures');

test.describe('Extension: what a web page can learn about the extension', () => {
  test('the extension\'s files cannot be fetched by a web page (so a site cannot tell it is installed)', async ({ ext }) => {
    const page = ext.article;
    const result = await page.evaluate(async id => {
      const tryFetch = async path => { try { const r = await fetch(`chrome-extension://${id}/${path}`); return r.ok ? 'reachable' : 'status ' + r.status; } catch { return 'blocked'; } };
      return { css: await tryFetch('content.css'), icon: await tryFetch('icons/icon-16.png'), manifest: await tryFetch('manifest.json') };
    }, ext.id);
    expect(result).toEqual({ css: 'blocked', icon: 'blocked', manifest: 'blocked' });
  });

  test('the manifest lists no files as web accessible that nothing uses', async () => {
    const m = JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname, '../../dist/chrome/manifest.json'), 'utf8'));
    const listed = (m.web_accessible_resources || []).flatMap(w => w.resources);
    expect(listed).not.toContain('icons/*.png');
  });
});
