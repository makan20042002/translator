'use strict';

/**
 * tests/support/prefix-server.js
 * A static server that serves dist/web strictly under the prefix /translate/app/
 * and returns 404 for any request outside this prefix.
 *
 * Used to verify subfolder deployment without network access.
 */

const os = require('os');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { buildWeb } = require('../../tools/build-web');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PREFIX = '/translate/app/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8'
};

function startPrefixServer(options = {}) {
  const isTemp = !options.webDir;
  const tempDir = isTemp ? fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-prefix-web-')) : null;
  const webDir = options.webDir || tempDir;

  // Always build a fresh copy of the web app into the target directory
  if (!options.noBuild) {
    buildWeb({ rootDir: REPO_ROOT, outDir: webDir });
  }

  const requests = [];

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = decodeURIComponent(parsed.pathname);

    requests.push({
      method: req.method,
      url: req.url,
      pathname,
      headers: req.headers
    });

    // Strictly enforce prefix: any request outside PREFIX receives 404
    if (!pathname.startsWith(PREFIX)) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Prefix-Error': 'Outside prefix /translate/app/'
      });
      res.end(`404 Not Found: Path ${pathname} is outside /translate/app/`);
      return;
    }

    // Strip prefix to locate target file in dist/web
    let relPath = pathname.slice(PREFIX.length);
    if (!relPath || relPath.endsWith('/')) {
      relPath += 'index.html';
    }

    const safeRel = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(webDir, safeRel);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${relPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    };

    if (relPath === 'sw.js') {
      headers['Service-Worker-Allowed'] = PREFIX;
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const origin = `http://127.0.0.1:${port}`;
      const baseUrl = `${origin}${PREFIX}`;

      resolve({
        server,
        port,
        origin,
        baseUrl,
        requests,
        webDir,
        close: () => new Promise((res, rej) => {
          server.close(err => {
            if (isTemp && tempDir && fs.existsSync(tempDir)) {
              try {
                fs.rmSync(tempDir, { recursive: true, force: true });
              } catch (_) {}
            }
            if (err) rej(err);
            else res();
          });
        })
      });
    });
    server.on('error', reject);
  });
}

module.exports = {
  startPrefixServer,
  PREFIX
};
