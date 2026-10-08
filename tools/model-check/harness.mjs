// Shared by the browser checks: serves the app from this folder, opens it in Chromium, and answers
// requests to huggingface.co and cdn.jsdelivr.net with the real files (fetched once with curl and kept
// on disk; big files are streamed from a local address, which Playwright's own fulfil cannot do).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../..');
const { chromium } = createRequire(root + '/')('playwright-core');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };

export async function openApp(cacheDir = path.join(os.tmpdir(), 'model-route-cache')) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/__cache/')) {
      const [h, q] = req.url.slice(9).split('?'); const f = path.join(cacheDir, h);
      if (!/^[0-9a-f]{40}$/.test(h) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': new URLSearchParams(q).get('type') || 'application/octet-stream', 'content-length': fs.statSync(f).size, 'access-control-allow-origin': '*' });
      return fs.createReadStream(f).pipe(res);
    }
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-length': fs.statSync(f).size });
    fs.createReadStream(f).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const requested = [];
  const fetched = url => {
    const f = path.join(cacheDir, createHash('sha1').update(url).digest('hex'));
    if (!fs.existsSync(f)) { execFileSync('curl', ['-sS', '-L', '--fail', '--retry', '3', '-m', '1500', '-o', f + '.part', url], { stdio: 'inherit' }); fs.renameSync(f + '.part', f); }
    return f;
  };
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'model-check-profile-'));   // also how this run's processes are told apart from others
  const ctx = await chromium.launchPersistentContext(profile, { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'], serviceWorkers: 'block' });
  await ctx.route(url => !/^(http:\/\/127\.0\.0\.1|https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\/|data:|blob:)/.test(url.href), r => r.abort());
  await ctx.route(/^https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, async route => {
    const url = route.request().url(); requested.push(url);
    try {
      const f = fetched(url), clean = url.split('?')[0];
      const type = clean.endsWith('.json') ? 'application/json' : (/\.m?js$/.test(clean) || /\/transformers@[\d.]+$/.test(clean)) ? 'text/javascript' : clean.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
      await route.fulfill({ status: 302, headers: { location: `${origin}/__cache/${path.basename(f)}?type=${encodeURIComponent(type)}`, 'access-control-allow-origin': '*' } });
    } catch (e) { await route.fulfill({ status: 404, body: String(e.message), headers: { 'access-control-allow-origin': '*' } }); }
  });
  const page = await ctx.newPage();
  page.on('crash', () => console.error('[bc] PAGE CRASHED'));
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const rssKB = () => {                      // all Chromium processes of this run
    let sum = 0;
    for (const p of fs.readdirSync('/proc').filter(x => /^\d+$/.test(x))) {
      try { if (!fs.readFileSync(`/proc/${p}/cmdline`, 'utf8').includes(profile)) continue;
        sum += +fs.readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]; } catch {}
    }
    return sum;
  };
  let peak = 0; const tick = setInterval(() => { peak = Math.max(peak, rssKB()); }, 250);
  return {
    page, ctx, origin, requested, errors,
    peakMB: (reset = true) => { const v = Math.round(peak / 1024); if (reset) peak = 0; return v; },
    close: async () => { clearInterval(tick); await ctx.close(); server.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  };
}
