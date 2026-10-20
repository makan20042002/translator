'use strict';

const { test, expect } = require('../support/ext-fixtures');
const {
  ALLOWED_LOCAL_PORTS,
  isAllowListedLocalAddress,
  isAllowedAppUrl,
  WEB_APP_URL,
  isAllowListedWebAppAddress,
  isAllowedWebAppUrl,
  safeWebAppUrl,
  buildAppTargetUrl,
  sanitizeConfig,
  safeAppUrl,
  DEFAULT_CFG
} = require('../../extension/engine');

test.describe('Extension: Allowed local ports and Web App URL restriction', () => {
  test('ALLOWED_LOCAL_PORTS contains only 50505 and 8080', () => {
    expect([...ALLOWED_LOCAL_PORTS].sort()).toEqual(['50505', '8080']);
  });

  test('default is the makanlab URL', () => {
    expect(DEFAULT_CFG.webAppUrl).toBe('https://makanlab.tech/translate/app/');
    expect(WEB_APP_URL).toBe('https://makanlab.tech/translate/app/');
  });

  test('allow-list accepts makanlab URL and rejects unauthorized domains, protocols, or paths', () => {
    expect(isAllowListedWebAppAddress('https://makanlab.tech/translate/app/')).toBe(true);
    expect(isAllowListedWebAppAddress('https://makanlab.tech/translate/app/index.html')).toBe(true);

    // Rejects evil domain
    expect(isAllowListedWebAppAddress('https://evil.example/translate/app/')).toBe(false);
    // Rejects domain spoofing
    expect(isAllowListedWebAppAddress('https://makanlab.tech.evil.com/translate/app/')).toBe(false);
    // Rejects non-https http
    expect(isAllowListedWebAppAddress('http://makanlab.tech/translate/app/')).toBe(false);
    // Rejects other paths
    expect(isAllowListedWebAppAddress('https://makanlab.tech/other')).toBe(false);
    expect(isAllowListedWebAppAddress('https://makanlab.tech/')).toBe(false);
  });

  test('target URL keeps the path', () => {
    const res = buildAppTargetUrl('https://makanlab.tech/translate/app/', {
      text: 'hello',
      src: 'auto',
      tgt: 'fa'
    });
    expect(res).toBe('https://makanlab.tech/translate/app/#text=hello&src=auto&tgt=fa');
  });

  test('localhost:8080 still works when set by hand', () => {
    expect(isAllowListedWebAppAddress('http://localhost:8080')).toBe(true);
    expect(isAllowListedWebAppAddress('http://127.0.0.1:8080')).toBe(true);

    const target = buildAppTargetUrl('http://localhost:8080', {
      text: 'hello',
      src: 'auto',
      tgt: 'fa'
    });
    expect(target).toBe('http://localhost:8080/#text=hello&src=auto&tgt=fa');

    const sanitized = sanitizeConfig({ webAppUrl: 'http://localhost:8080' });
    expect(sanitized.webAppUrl).toBe('http://localhost:8080');
  });

  test('isAllowListedLocalAddress accepts only allowed local ports', () => {
    expect(isAllowListedLocalAddress('http://127.0.0.1:50505')).toBe(true);
    expect(isAllowListedLocalAddress('http://localhost:50505')).toBe(true);
    expect(isAllowListedLocalAddress('http://127.0.0.1:8080')).toBe(true);
    expect(isAllowListedLocalAddress('http://localhost:8080')).toBe(true);

    // Removed ports must be rejected
    expect(isAllowListedLocalAddress('http://127.0.0.1:3000')).toBe(false);
    expect(isAllowListedLocalAddress('http://localhost:8888')).toBe(false);
    expect(isAllowListedLocalAddress('http://127.0.0.1:8000')).toBe(false);
    expect(isAllowListedLocalAddress('http://localhost:5173')).toBe(false);

    // Non-local hosts must be rejected
    expect(isAllowListedLocalAddress('http://example.com:50505')).toBe(false);
    expect(isAllowListedLocalAddress('http://example.com:8080')).toBe(false);
  });

  test('isAllowedAppUrl matches isAllowListedLocalAddress behavior', () => {
    expect(isAllowedAppUrl('http://127.0.0.1:50505')).toBe(true);
    expect(isAllowedAppUrl('http://localhost:8080')).toBe(true);
    expect(isAllowedAppUrl('http://localhost:3000')).toBe(false);
  });

  test('sanitizeConfig restricts appUrl to allowed ports and validates webAppUrl', () => {
    // When raw input specifies removed port 3000 for appUrl
    const cfg = sanitizeConfig({ appUrl: 'http://localhost:3000' });
    expect(cfg.appUrl).toBe('http://127.0.0.1:50505');

    // When previous stored config had removed port for appUrl, it falls back to default
    const prevWithOldPorts = {
      ...DEFAULT_CFG,
      appUrl: 'http://127.0.0.1:3000'
    };
    const sanitized = sanitizeConfig({}, prevWithOldPorts);
    expect(sanitized.appUrl).toBe('http://127.0.0.1:50505');

    // Valid ports 50505 and 8080 are retained for appUrl
    const valid = sanitizeConfig({ appUrl: 'http://localhost:50505' });
    expect(valid.appUrl).toBe('http://localhost:50505');

    // webAppUrl allows hosted and allowlisted local ports, rejecting invalid protocols and unauthorized domains
    const webHosted = sanitizeConfig({ webAppUrl: 'https://makanlab.tech/translate/app/' });
    expect(webHosted.webAppUrl).toBe('https://makanlab.tech/translate/app/');

    const webLocal = sanitizeConfig({ webAppUrl: 'http://localhost:8080' });
    expect(webLocal.webAppUrl).toBe('http://localhost:8080');

    const webInvalid = sanitizeConfig({ webAppUrl: 'javascript:alert(1)' });
    expect(webInvalid.webAppUrl).toBe(DEFAULT_CFG.webAppUrl);

    const webEvil = sanitizeConfig({ webAppUrl: 'https://evil.example/translate/app/' });
    expect(webEvil.webAppUrl).toBe(DEFAULT_CFG.webAppUrl);
  });

  test('Options page renders help text for allowed ports in EN and FA', async ({ ext }) => {
    const page = await ext.context.newPage();
    await page.goto(ext.url('options.html'));
    const help = page.locator('#helpAppUrl');
    await expect(help).toBeVisible();
    await expect(help).toContainText('50505');
    await expect(help).toContainText('8080');

    // Switch to FA
    await page.click('#optLangToggle');
    await expect(help).toContainText('۵۰۵۰۵');
    await expect(help).toContainText('۸۰۸۰');
    await page.close();
  });

  test('real unpatched engine.js rejects random ports in allow-list', () => {
    const randomPort = '49152';
    expect(ALLOWED_LOCAL_PORTS.has(randomPort)).toBe(false);
    expect(isAllowListedWebAppAddress(`http://127.0.0.1:${randomPort}`)).toBe(false);
    expect(isAllowListedWebAppAddress(`http://localhost:${randomPort}`)).toBe(false);
    expect(isAllowListedLocalAddress(`http://127.0.0.1:${randomPort}`)).toBe(false);
  });

  test('test copy engine.js differs from dist/chrome/engine.js only in the ALLOWED_LOCAL_PORTS line', async ({ ext, stub }) => {
    const fs = require('fs');
    const path = require('path');
    const distPath = path.resolve(__dirname, '..', '..', 'dist', 'chrome', 'engine.js');
    const copyPath = path.join(ext.path, 'engine.js');

    const distLines = fs.readFileSync(distPath, 'utf8').split('\n');
    const copyLines = fs.readFileSync(copyPath, 'utf8').split('\n');

    expect(copyLines.length).toBe(distLines.length);

    const diffs = [];
    for (let i = 0; i < distLines.length; i++) {
      const distLine = distLines[i].replace(/\r$/, '');
      const copyLine = copyLines[i].replace(/\r$/, '');
      if (distLine !== copyLine) {
        diffs.push({ line: i + 1, dist: distLine.trim(), copy: copyLine.trim() });
      }
    }

    expect(diffs.length).toBe(1);
    expect(diffs[0].dist).toBe("const ALLOWED_LOCAL_PORTS = new Set(['50505', '8080']);");
    const port = String(stub.appPort || new URL(stub.appOrigin).port);
    expect(diffs[0].copy).toBe(`const ALLOWED_LOCAL_PORTS = new Set(['50505', '8080', '${port}']);`);
  });

  test('patchEngineAllowedPorts throws a clear error if pattern is not found', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { patchEngineAllowedPorts } = require('../support/extension');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-test-err-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'engine.js'), '// no ports pattern here\nconst x = 1;\n', 'utf8');
      expect(() => patchEngineAllowedPorts(tmpDir, '12345')).toThrow(/Target pattern for ALLOWED_LOCAL_PORTS not found/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

