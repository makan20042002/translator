'use strict';

/**
 * tests/web/version-consistency.spec.js
 * Validates that the application version is identical across all components:
 * - Version shown in About window (EN and FA)
 * - Version in bug report subject and diagnostics body
 * - translator/package.json version
 * - extension/manifest.json, manifest.chrome.json, and manifest.firefox.json versions
 */

const fs = require('fs');
const path = require('path');
const { test, expect, mouseClick } = require('../support/fixtures');

test.describe('Version Consistency (ITEM 1)', () => {

  test('version in About window, bug report, package.json, and manifests are all identical', async ({ app }) => {
    const { page } = app;

    // 1. Read files directly from disk
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const pkgVersion = pkg.version;

    const manifestPath = path.resolve(__dirname, '../../extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const manifestVersion = manifest.version;

    const chromeManifestPath = path.resolve(__dirname, '../../extension/manifest.chrome.json');
    const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
    const chromeManifestVersion = chromeManifest.version;

    const firefoxManifestPath = path.resolve(__dirname, '../../extension/manifest.firefox.json');
    const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));
    const firefoxManifestVersion = firefoxManifest.version;

    // 2. Read version in About window (English)
    await mouseClick(page, page.locator('#creditsBtn'));
    await expect(page.locator('#creditsBox')).toBeVisible();

    const aboutVersionLocator = page.locator('#aboutVersion');
    await expect(aboutVersionLocator).toBeVisible();
    const aboutTextEn = await aboutVersionLocator.textContent();
    expect(aboutTextEn).toBe('Version ' + pkgVersion);

    const aboutMatchEn = aboutTextEn.match(/\d+\.\d+\.\d+/);
    expect(aboutMatchEn).toBeTruthy();
    const aboutVersionEn = aboutMatchEn[0];

    // 3. Read version in About window (Persian)
    await mouseClick(page, page.locator('#uiLang'));
    const aboutTextFa = await aboutVersionLocator.textContent();
    expect(aboutTextFa).toBe('نسخه ' + pkgVersion);

    const aboutMatchFa = aboutTextFa.match(/\d+\.\d+\.\d+/);
    expect(aboutMatchFa).toBeTruthy();
    const aboutVersionFa = aboutMatchFa[0];

    // Switch back to English
    await mouseClick(page, page.locator('#uiLang'));

    // 4. Read version in Bug report subject and body
    const aboutBugBtn = page.locator('#aboutBugReportBtn');
    await mouseClick(page, aboutBugBtn);
    const modal = page.locator('#bugReportModal');
    await expect(modal).toBeVisible();

    const mailtoLink = page.locator('#bugSendEmail');
    const href = await mailtoLink.getAttribute('href');
    expect(href).toBeTruthy();

    const parsed = new URL(href);
    const subject = parsed.searchParams.get('subject') || '';
    const body = parsed.searchParams.get('body') || '';

    const subjectMatch = subject.match(/v(\d+\.\d+\.\d+)/);
    expect(subjectMatch).toBeTruthy();
    const bugSubjectVersion = subjectMatch[1];

    const bodyMatch = body.match(/App Version:\s*(\d+\.\d+\.\d+)/);
    expect(bodyMatch).toBeTruthy();
    const bugBodyVersion = bodyMatch[1];

    // 5. Assert all versions are identical to the single source of truth
    expect(pkgVersion).toBe('1.0.0');
    expect(aboutVersionEn).toBe(pkgVersion);
    expect(aboutVersionFa).toBe(pkgVersion);
    expect(bugSubjectVersion).toBe(pkgVersion);
    expect(bugBodyVersion).toBe(pkgVersion);
    expect(manifestVersion).toBe(pkgVersion);
    expect(chromeManifestVersion).toBe(pkgVersion);
    expect(firefoxManifestVersion).toBe(pkgVersion);

    await page.keyboard.press('Escape');
  });

});
