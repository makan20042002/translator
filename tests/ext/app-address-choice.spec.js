'use strict';
/**
 * Tests for "Open in App" address choice logic:
 * 1. Allow-listed local addresses (127.0.0.1 / localhost with fixed ports); never an address from page content.
 * 2. Try Windows app address first (50505), fall back to configured web address (8080).
 * 3. Return clear one-line message ("Start MAKAN Translate first") if neither answers.
 * 4. Probe sends no secrets, query strings, or credentials.
 * 5. Options page contains "App address" setting with default http://127.0.0.1:50505.
 */
const { test, expect } = require('../support/ext-fixtures');
const {
  isAllowListedLocalAddress,
  safeAppUrl,
  checkAddressReachable,
  chooseAppAddress,
  buildAppTargetUrl,
  ALLOWED_LOCAL_HOSTS,
  ALLOWED_LOCAL_PORTS
} = require('../../extension/engine');

test.describe('Extension: Open in App address choice and allow-list logic', () => {

  test('isAllowListedLocalAddress strictly allows only 127.0.0.1 and localhost with fixed ports', () => {
    // Valid Windows desktop app and local web app ports
    expect(isAllowListedLocalAddress('http://127.0.0.1:50505')).toBe(true);
    expect(isAllowListedLocalAddress('http://localhost:8080')).toBe(true);
    expect(isAllowListedLocalAddress('http://127.0.0.1:8080')).toBe(true);
    expect(isAllowListedLocalAddress('http://localhost:50505')).toBe(true);
    expect(isAllowListedLocalAddress('http://[::1]:50505')).toBe(true);
    expect(isAllowListedLocalAddress('http://127.0.0.1:50505/some/subpath')).toBe(true);

    // Reject non-local hosts (never accept external or page content addresses)
    expect(isAllowListedLocalAddress('http://example.com:50505')).toBe(false);
    expect(isAllowListedLocalAddress('http://attacker.com:8080')).toBe(false);
    expect(isAllowListedLocalAddress('http://192.168.1.100:50505')).toBe(false);
    expect(isAllowListedLocalAddress('http://10.0.0.1:8080')).toBe(false);

    // Reject unauthorized or arbitrary ports
    // removed ports: owner decision 2026-10-17
    expect(isAllowListedLocalAddress('http://127.0.0.1:8888')).toBe(false);
    expect(isAllowListedLocalAddress('http://localhost:3000')).toBe(false);
    expect(isAllowListedLocalAddress('http://127.0.0.1:22')).toBe(false);
    expect(isAllowListedLocalAddress('http://localhost:21')).toBe(false);
    expect(isAllowListedLocalAddress('http://127.0.0.1:25')).toBe(false);
    expect(isAllowListedLocalAddress('http://localhost:445')).toBe(false);
    expect(isAllowListedLocalAddress('http://127.0.0.1:80')).toBe(false);

    // Reject non-http protocols and malformed strings
    expect(isAllowListedLocalAddress('javascript:alert(1)')).toBe(false);
    expect(isAllowListedLocalAddress('file:///etc/passwd')).toBe(false);
    expect(isAllowListedLocalAddress('data:text/html,bad')).toBe(false);
    expect(isAllowListedLocalAddress('')).toBe(false);
    expect(isAllowListedLocalAddress(null)).toBe(false);
    expect(isAllowListedLocalAddress(undefined)).toBe(false);
  });

  test('safeAppUrl sanitizes to valid allow-listed origin and falls back appropriately', () => {
    expect(safeAppUrl('http://127.0.0.1:50505/path#frag')).toBe('http://127.0.0.1:50505');
    expect(safeAppUrl('http://localhost:8080/')).toBe('http://localhost:8080');
    expect(safeAppUrl('http://evil.com:50505')).toBe('http://127.0.0.1:50505');
    expect(safeAppUrl('javascript:alert(1)')).toBe('http://127.0.0.1:50505');
    expect(safeAppUrl('', 'http://127.0.0.1:50505')).toBe('http://127.0.0.1:50505');
  });

  test('buildAppTargetUrl puts parameters strictly in hash # without exposing them to server query ?', () => {
    const target = buildAppTargetUrl('http://127.0.0.1:50505', {
      text: 'Sample input text',
      src: 'en',
      tgt: 'fa'
    });

    const parsed = new URL(target);
    expect(parsed.origin).toBe('http://127.0.0.1:50505');
    expect(parsed.search, 'no parameters in server-visible query').toBe('');
    const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    expect(params.get('text')).toBe('Sample input text');
    expect(params.get('src')).toBe('en');
    expect(params.get('tgt')).toBe('fa');
  });

  test('buildAppTargetUrl truncates very long text at 2000 characters', () => {
    const longText = 'a'.repeat(3000);
    const target = buildAppTargetUrl('http://localhost:8080', { text: longText });
    const parsed = new URL(target);
    const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    expect(params.get('text').length).toBe(2000);
  });

  test('chooseAppAddress selects Windows app address first when it is reachable', async () => {
    const probed = [];
    const mockCheck = async (url) => {
      probed.push(url);
      if (url === 'http://127.0.0.1:50505') return true;
      return false;
    };

    const res = await chooseAppAddress({
      appUrl: 'http://127.0.0.1:50505',
      webAppUrl: 'http://localhost:8080',
      timeoutMs: 300,
      checkFn: mockCheck
    });

    expect(res.ok).toBe(true);
    expect(res.url).toBe('http://127.0.0.1:50505');
    // Windows app answered first; no need to probe web address
    expect(probed).toEqual(['http://127.0.0.1:50505']);
  });

  test('chooseAppAddress falls back to web app address when Windows app does not answer', async () => {
    const probed = [];
    const mockCheck = async (url) => {
      probed.push(url);
      if (url === 'http://127.0.0.1:50505') return false; // Windows app not running
      if (url === 'http://localhost:8080') return true;   // Web app running
      return false;
    };

    const res = await chooseAppAddress({
      appUrl: 'http://127.0.0.1:50505',
      webAppUrl: 'http://localhost:8080',
      timeoutMs: 300,
      checkFn: mockCheck
    });

    expect(res.ok).toBe(true);
    expect(res.url).toBe('http://localhost:8080');
    expect(probed).toEqual(['http://127.0.0.1:50505', 'http://localhost:8080']);
  });

  test('chooseAppAddress returns clear message "Start MAKAN Translate first" when neither answers', async () => {
    const probed = [];
    const mockCheck = async (url) => {
      probed.push(url);
      return false; // Neither server answers
    };

    const res = await chooseAppAddress({
      appUrl: 'http://127.0.0.1:50505',
      webAppUrl: 'http://localhost:8080',
      timeoutMs: 300,
      checkFn: mockCheck
    });

    expect(res.ok).toBe(false);
    expect(res.url).toBeNull();
    expect(res.error).toBe('Start MAKAN Translate first');
    expect(probed).toEqual(['http://127.0.0.1:50505', 'http://localhost:8080']);
  });

  test('chooseAppAddress never probes addresses not on the allow-list', async () => {
    const probed = [];
    const mockCheck = async (url) => {
      probed.push(url);
      return true;
    };

    // Attempting to pass attacker or non-allowlisted addresses (e.g. from page content)
    const res = await chooseAppAddress({
      appUrl: 'http://evil.com:50505',
      webAppUrl: 'http://192.168.1.1:8080',
      timeoutMs: 300,
      checkFn: mockCheck
    });

    expect(probed).toEqual([]); // No probes executed for non-allowlisted origins
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Start MAKAN Translate first');
  });

  test('checkAddressReachable sends probe with credentials omitted and no sensitive query/body', async () => {
    let capturedCall = null;
    const mockFetch = async (target, init) => {
      capturedCall = { target, init };
      return { ok: true };
    };

    const ok = await checkAddressReachable('http://127.0.0.1:50505', 400, mockFetch);
    expect(ok).toBe(true);
    expect(capturedCall).toBeTruthy();
    expect(capturedCall.target).toBe('http://127.0.0.1:50505/');
    expect(capturedCall.init.credentials).toBe('omit');
    expect(capturedCall.init.cache).toBe('no-store');
    expect(capturedCall.init.mode).toBe('no-cors');
    expect(capturedCall.init.headers).toBeUndefined();
    expect(capturedCall.init.body).toBeUndefined();
  });
});

test.describe('Extension options UI: App address setting', () => {
  test('options page has App address field with default 127.0.0.1:50505 and validates on change', async ({ ext }) => {
    const page = await ext.context.newPage();
    await page.goto(ext.url('options.html'));
    await expect(page.locator('#optTitle')).toHaveText('Engines & Settings');

    // 1. Verify App address field exists with default value
    const txtAppUrl = page.locator('#txtAppUrl');
    await expect(txtAppUrl).toBeVisible();
    await expect(txtAppUrl).toHaveValue('http://127.0.0.1:50505');
    await expect(page.locator('#lblAppUrl')).toHaveText('App address:');

    // 2. Setting an allow-listed alternative port saves successfully
    await txtAppUrl.fill('http://localhost:50505');
    await txtAppUrl.dispatchEvent('change');
    await expect(page.locator('#optToasts')).toContainText('Saved');
    await expect.poll(async () => (await ext.getConfig()).appUrl).toBe('http://localhost:50505');

    // 3. Setting a non-allowlisted external address is rejected and reverts
    await txtAppUrl.fill('http://attacker.com:50505');
    await txtAppUrl.dispatchEvent('change');
    await expect(page.locator('#optToasts')).toContainText(/allow-listed/i);
    await expect(txtAppUrl).toHaveValue('http://localhost:50505');
    await expect((await ext.getConfig()).appUrl).toBe('http://localhost:50505');

    await page.close();
  });
});
