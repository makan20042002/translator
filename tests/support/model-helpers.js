'use strict';
// Shared by the model catalogue tests: fake "downloaded" models and small page helpers.
const { expect, mouseClick } = require('./fixtures');

const CACHE = 'transformers-cache';
const mb = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1048576)) + ' MB';

/** Put stand-in files for a model into the storage the model library uses. */
async function fakeDownloaded(page, repo, files) {
  await page.evaluate(async ({ CACHE, repo, files }) => {
    const c = await caches.open(CACHE);
    for (const [name, size] of files) {
      await c.put(`https://huggingface.co/${repo}/resolve/main/${name}`, new Response(new Uint8Array(8), { headers: { 'content-length': String(size) } }));
    }
  }, { CACHE, repo, files });
}
const cacheKeys = page => page.evaluate(async CACHE => (await (await caches.open(CACHE)).keys()).map(r => r.url), CACHE);
const openSettings = async page => { await mouseClick(page, page.locator('#openSet')); await expect(page.locator('#ov')).toHaveClass(/on/); };
const row = (page, id) => page.locator(`[data-mdl="${id}"]`);


module.exports = { CACHE, mb, fakeDownloaded, cacheKeys, openSettings, row };
