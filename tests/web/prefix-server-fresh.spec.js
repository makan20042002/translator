'use strict';

/**
 * tests/web/prefix-server-fresh.spec.js
 * Verifies that tests/support/prefix-server.js always builds a fresh copy
 * into a unique temporary directory, never serves stale artifacts from
 * dist/web, and produces byte-identical files with matching BUILD_INFO.json.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { startPrefixServer, PREFIX } = require('../support/prefix-server');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        data: Buffer.concat(chunks)
      }));
    }).on('error', reject);
  });
}

test.describe('Prefix Server Fresh Build & Subfolder Integrity', () => {
  test('served /translate/app/js/translate.js is byte-identical to repo source, matching BUILD_INFO.json hash', async () => {
    const serverInfo = await startPrefixServer();
    try {
      // 1. Fetch js/translate.js from prefix server
      const servedRes = await httpGet(`${serverInfo.baseUrl}js/translate.js`);
      expect(servedRes.status).toBe(200);

      const repoTranslatePath = path.join(REPO_ROOT, 'js', 'translate.js');
      const repoTranslateBytes = fs.readFileSync(repoTranslatePath);

      // Byte-identical check
      expect(Buffer.compare(servedRes.data, repoTranslateBytes)).toBe(0);

      // 2. Fetch BUILD_INFO.json and verify catalog entry
      const buildInfoRes = await httpGet(`${serverInfo.baseUrl}BUILD_INFO.json`);
      expect(buildInfoRes.status).toBe(200);

      const buildInfo = JSON.parse(buildInfoRes.data.toString('utf8'));
      expect(Array.isArray(buildInfo.files)).toBe(true);

      const trEntry = buildInfo.files.find(f => f.file === 'js/translate.js');
      expect(trEntry).toBeDefined();

      const expectedSha256 = crypto.createHash('sha256').update(repoTranslateBytes).digest('hex');
      expect(trEntry.sha256).toBe(expectedSha256);
      expect(trEntry.size).toBe(repoTranslateBytes.length);

      // 3. Verify server serves from a temp directory outside repo's dist/web
      expect(serverInfo.webDir).toBeDefined();
      expect(serverInfo.webDir.startsWith(os.tmpdir())).toBe(true);
      expect(fs.existsSync(serverInfo.webDir)).toBe(true);
    } finally {
      await serverInfo.close();
      // Verify temp folder was cleaned up on close
      expect(fs.existsSync(serverInfo.webDir)).toBe(false);
    }
  });

  test('prefix server ignores stale or deliberately wrong dist/web in repo root', async () => {
    const repoDistWeb = path.join(REPO_ROOT, 'dist', 'web');
    const repoDistJsDir = path.join(repoDistWeb, 'js');
    const repoDistTranslate = path.join(repoDistJsDir, 'translate.js');

    const hadDistWeb = fs.existsSync(repoDistWeb);
    let originalDistTranslate = null;
    if (fs.existsSync(repoDistTranslate)) {
      originalDistTranslate = fs.readFileSync(repoDistTranslate);
    }

    try {
      // Plant a deliberately wrong stale build in dist/web
      fs.mkdirSync(repoDistJsDir, { recursive: true });
      fs.writeFileSync(repoDistTranslate, '// STALE DELIBERATELY WRONG TRANSLATE.JS\nimport("./asr-guard.js");', 'utf8');

      const serverInfo = await startPrefixServer();
      try {
        const servedRes = await httpGet(`${serverInfo.baseUrl}js/translate.js`);
        expect(servedRes.status).toBe(200);

        const servedText = servedRes.data.toString('utf8');
        expect(servedText).not.toContain('STALE DELIBERATELY WRONG');

        const repoSourceBytes = fs.readFileSync(path.join(REPO_ROOT, 'js', 'translate.js'));
        expect(Buffer.compare(servedRes.data, repoSourceBytes)).toBe(0);
      } finally {
        await serverInfo.close();
      }
    } finally {
      // Restore or clean up planted dist/web
      if (!hadDistWeb) {
        try { fs.rmSync(repoDistWeb, { recursive: true, force: true }); } catch (_) {}
      } else if (originalDistTranslate !== null) {
        fs.writeFileSync(repoDistTranslate, originalDistTranslate);
      }
    }
  });
});
