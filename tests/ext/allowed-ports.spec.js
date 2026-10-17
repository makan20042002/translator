'use strict';

const { test, expect } = require('../support/ext-fixtures');
const {
  ALLOWED_LOCAL_PORTS,
  isAllowListedLocalAddress,
  isAllowedAppUrl,
  sanitizeConfig,
  safeAppUrl,
  safeWebAppUrl,
  DEFAULT_CFG
} = require('../../extension/engine');

test.describe('Extension: Allowed local ports restriction', () => {
  test('ALLOWED_LOCAL_PORTS contains only 50505 and 8080', () => {
    expect([...ALLOWED_LOCAL_PORTS].sort()).toEqual(['50505', '8080']);
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

  test('sanitizeConfig falls back to default if removed port is used', () => {
    // When raw input specifies removed port 3000
    const cfg = sanitizeConfig({ appUrl: 'http://localhost:3000', webAppUrl: 'http://localhost:8888' });
    expect(cfg.appUrl).toBe('http://127.0.0.1:50505');
    expect(cfg.webAppUrl).toBe('http://localhost:8080');

    // When previous stored config had removed ports, it still falls back to default
    const prevWithOldPorts = {
      ...DEFAULT_CFG,
      appUrl: 'http://127.0.0.1:3000',
      webAppUrl: 'http://localhost:8000'
    };
    const sanitized = sanitizeConfig({}, prevWithOldPorts);
    expect(sanitized.appUrl).toBe('http://127.0.0.1:50505');
    expect(sanitized.webAppUrl).toBe('http://localhost:8080');

    // Valid ports 50505 and 8080 are retained
    const valid = sanitizeConfig({ appUrl: 'http://localhost:50505', webAppUrl: 'http://127.0.0.1:8080' });
    expect(valid.appUrl).toBe('http://localhost:50505');
    expect(valid.webAppUrl).toBe('http://127.0.0.1:8080');
  });

  test('Options page renders help text for allowed ports in EN and FA', async ({ ext }) => {
    const page = await ext.openOptions();
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
});
