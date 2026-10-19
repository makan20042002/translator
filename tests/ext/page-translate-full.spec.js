'use strict';
// Extension: whole-page translation comprehensive test suite
const { test, expect, inShadow, rightClick } = require('../support/ext-fixtures');

const MESSY_PAGE = '/__test/messy.html';

test.describe('Extension: whole-page translation full suite', () => {
  test('a) translates all visible text blocks and attributes on a messy page and restores exact HTML on Show Original', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + MESSY_PAGE);
    await page.waitForLoadState('domcontentloaded');

    // Capture before translation state
    const beforeTitle = await page.title();
    const beforePlaceholder = await page.locator('#test-input').getAttribute('placeholder');
    const beforeBodyHtml = await page.locator('body').innerHTML();

    // Trigger page translation via context menu
    await rightClick(page, '#heading1');
    await ext.clickContextMenu('makan-translate-page', page.url());

    // Wait for translation banner
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to FA');

    // 1. Check what IS translated:
    // Headings, divs, spans, nav links, buttons, table cells
    await expect(page.locator('#heading1')).toHaveText('[fa] Main Heading');
    await expect(page.locator('#div1')).toHaveText('[fa] Text in a plain div');
    await expect(page.locator('#span1')).toHaveText('[fa] Standalone span text');
    await expect(page.locator('#nav-link1')).toHaveText('[fa] Nav Link One');
    await expect(page.locator('#nav-link2')).toHaveText('[fa] Nav Link Two');
    await expect(page.locator('#btn1')).toContainText('[fa] Click Me Now');
    await expect(page.locator('#th1')).toHaveText('[fa] Header Cell');
    await expect(page.locator('#td1')).toHaveText('[fa] Data Cell');

    // Sentence split by <a> and <b> translated as ONE unit
    await expect(page.locator('#split-p')).toHaveText('[fa] A sentence with a link and bold words inside.');

    // Document title
    await expect(page).toHaveTitle('[fa] Messy Test Page');

    // Attributes: placeholder, alt, title, aria-label
    await expect(page.locator('#test-input')).toHaveAttribute('placeholder', '[fa] Search here...');
    await expect(page.locator('#test-img')).toHaveAttribute('alt', '[fa] Logo image');
    await expect(page.locator('#test-img')).toHaveAttribute('title', '[fa] Image title tooltip');
    await expect(page.locator('#test-img')).toHaveAttribute('aria-label', '[fa] Graphic illustration');

    // Open shadow root text
    const shadowText = await page.evaluate(() => {
      const host = document.getElementById('shadow-host');
      return host?.shadowRoot?.getElementById('shadow-p')?.textContent;
    });
    expect(shadowText).toBe('[fa] Text inside open shadow root');

    // 2. Check what is NOT translated:
    // Hidden elements
    expect(await page.locator('#hidden-div').textContent()).toBe('Hidden div text');
    expect(await page.locator('#hidden-p').textContent()).toBe('Hidden p text');
    expect(await page.locator('#aria-hidden-p').textContent()).toBe('Aria hidden text');

    // Pre, code, contenteditable, input value
    expect(await page.locator('#pre-block').textContent()).toBe('code inside pre should not be translated');
    expect(await page.locator('#code-block').textContent()).toBe('inline code should not be translated');
    expect(await page.locator('#editable').textContent()).toBe('Editable text should be skipped');
    expect(await page.locator('#test-input').inputValue()).toBe('User input value');

    // Numbers-only text
    expect(await page.locator('#numbers-only').textContent()).toBe('12345 67890 #$@%');

    // Already in target language (fa)
    expect(await page.locator('#already-fa').textContent()).toBe('این یک جمله فارسی برای آزمایش است.');

    // 3. Show Original restores the page HTML exactly
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(banner).toHaveCount(0);

    // Verify title and placeholder restored
    expect(await page.title()).toBe(beforeTitle);
    expect(await page.locator('#test-input').getAttribute('placeholder')).toBe(beforePlaceholder);

    // Verify links and bold elements inside split-p are restored
    await expect(page.locator('#split-p a#inner-link')).toHaveCount(1);
    await expect(page.locator('#split-p b')).toHaveCount(1);
    await expect(page.locator('#btn1 em')).toHaveCount(1);

    // Verify exact innerHTML match for body
    const afterBodyHtml = await page.locator('body').innerHTML();
    expect(afterBodyHtml).toBe(beforeBodyHtml);

    await page.close();
  });

  test('b) translates viewport text first on a long page before off-screen text', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.evaluate(() => {
      document.body.innerHTML = '';
      const onScreen = document.createElement('div');
      onScreen.id = 'on-screen-container';
      for (let i = 1; i <= 20; i++) {
        const p = document.createElement('p');
        p.id = `top-p-${i}`;
        p.textContent = `On screen paragraph number ${i} visible near top.`;
        onScreen.appendChild(p);
      }
      document.body.appendChild(onScreen);

      const spacer = document.createElement('div');
      spacer.style.height = '15000px';
      document.body.appendChild(spacer);

      const offScreen = document.createElement('div');
      offScreen.id = 'off-screen-container';
      for (let i = 1; i <= 50; i++) {
        const p = document.createElement('p');
        p.id = `bottom-p-${i}`;
        p.textContent = `Distant off screen paragraph number ${i} far down.`;
        offScreen.appendChild(p);
      }
      document.body.appendChild(offScreen);
    });

    stub.clearLog();
    await ext.clickContextMenu('makan-translate-page', page.url());

    // Wait until Google translate receives the first request and first top paragraph is translated
    await page.waitForFunction(() => {
      const el = document.getElementById('top-p-1');
      return el && el.textContent.includes('[fa]');
    });

    const googleCalls = stub.calls('clients5.google.com');
    expect(googleCalls.length).toBeGreaterThanOrEqual(1);

    // The first request must contain top on-screen paragraphs, not bottom off-screen ones
    const firstCall = googleCalls[0];
    const form = new URLSearchParams(firstCall.body);
    const requestedTexts = form.getAll('q');

    const hasOnScreen = requestedTexts.some(t => t.includes('On screen paragraph'));
    const hasDistantOffScreen = requestedTexts.some(t => t.includes('Distant off screen paragraph'));

    expect(hasOnScreen).toBe(true);
    expect(hasDistantOffScreen).toBe(false);

    await page.close();
  });

  test('c) translates late-added content dynamically with MutationObserver and stops observing after Show Original', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.waitForLoadState('domcontentloaded');

    // Start whole page translation
    await ext.clickContextMenu('makan-translate-page', page.url());
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to FA');

    // 1. Add late content dynamically 1s after translation finishes
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'late-dynamic-p';
      p.textContent = 'This is dynamically loaded late paragraph text.';
      document.body.appendChild(p);
    });

    // MutationObserver debounces 300ms, rate guards, and translates the new node
    await expect(page.locator('#late-dynamic-p')).toHaveText('[fa] This is dynamically loaded late paragraph text.', { timeout: 10_000 });

    // 2. Click Show Original
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(banner).toHaveCount(0);

    // 3. Add more content after Show Original
    await page.evaluate(() => {
      const p2 = document.createElement('p');
      p2.id = 'post-restore-p';
      p2.textContent = 'This content was added after restoring original.';
      document.body.appendChild(p2);
    });

    // Wait 1.5 seconds to ensure no late translation occurs
    await page.waitForTimeout(1500);
    expect(await page.locator('#post-restore-p').textContent()).toBe('This content was added after restoring original.');

    await page.close();
  });

  test('i) deduplicates identical strings inside one request so repeated text is sent once', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1 id="test-title">Deduplication test heading</h1>
        <button class="action-btn">Download file</button>
        <button class="action-btn">Download file</button>
        <button class="action-btn">Download file</button>
        <button class="action-btn">Download file</button>
        <button class="action-btn">Download file</button>
      `;
    });

    stub.clearLog();
    await ext.clickContextMenu('makan-translate-page', page.url());

    await page.waitForFunction(() => {
      const btn = document.querySelector('.action-btn');
      return btn && btn.textContent.includes('[fa]');
    });

    // Check all 5 buttons were translated
    const btnTexts = await page.evaluate(() => Array.from(document.querySelectorAll('.action-btn')).map(b => b.textContent));
    expect(btnTexts).toEqual([
      '[fa] Download file',
      '[fa] Download file',
      '[fa] Download file',
      '[fa] Download file',
      '[fa] Download file'
    ]);

    // Check the request sent to Google: "Download file" should appear exactly ONCE
    const googleCalls = stub.calls('clients5.google.com');
    const allRequestedStrings = [];
    for (const call of googleCalls) {
      const form = new URLSearchParams(call.body);
      allRequestedStrings.push(...form.getAll('q'));
    }
    const downloadOccurrences = allRequestedStrings.filter(s => s === 'Download file');
    expect(downloadOccurrences.length).toBe(1);

    await page.close();
  });

  test('d) Stop keeps what is done and sends no more requests; changing the banner language re-translates from originals', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.evaluate(() => {
      // Create 60 paragraphs to ensure multiple batches
      const container = document.createElement('div');
      container.id = 'bulk-container';
      for (let i = 1; i <= 60; i++) {
        const p = document.createElement('p');
        p.id = `para-${i}`;
        p.textContent = `Paragraph text item number ${i} for stop and retranslate test.`;
        container.appendChild(p);
      }
      document.body.appendChild(container);
    });

    // Slow down the engine host slightly so we can click Stop during progress
    stub.delayHost('clients5.google.com', 400);

    await ext.clickContextMenu('makan-translate-page', page.url());

    // Wait for the stop button to appear in shadow DOM while translating
    const stopBtn = inShadow(page, '#makanStopBtn');
    await expect(stopBtn).toBeVisible({ timeout: 10_000 });

    // Click Stop button
    await stopBtn.click();

    // After stop, banner should indicate stopped and Show Original should appear
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toContainText('Translation stopped', { timeout: 10_000 });
    await expect(inShadow(page, '#makanStopBtn')).toHaveCount(0);
    await expect(inShadow(page, '#makanRestoreBtn')).toBeVisible();

    const callCountAfterStop = stub.calls('clients5.google.com').length;
    await page.waitForTimeout(1000);
    // Verify no new requests were sent
    expect(stub.calls('clients5.google.com').length).toBe(callCountAfterStop);

    // Stop keeps what was already done
    const firstP = await page.locator('#para-1').textContent();
    expect(firstP).toContain('[fa]');

    // Now test changing the banner language dropdown: re-translates from saved originals
    stub.resetModes();
    stub.clearLog();

    const langSelect = inShadow(page, '#makanBannerTgtSelect');
    await langSelect.selectOption('de');

    // Wait for re-translation to complete
    await expect(banner).toContainText('Page translated to DE', { timeout: 15_000 });

    // Verify element now has German translation
    expect(await page.locator('#para-1').textContent()).toContain('[de]');

    // Verify requests sent to the engine contained the ORIGINAL English text, NOT "[fa] ..."
    const deCalls = stub.calls('clients5.google.com');
    expect(deCalls.length).toBeGreaterThan(0);
    for (const call of deCalls) {
      const form = new URLSearchParams(call.body);
      for (const q of form.getAll('q')) {
        expect(q).not.toContain('[fa]');
        expect(q).toContain('Paragraph text item number');
      }
    }

    await page.close();
  });

  test('f) banner at 360 px in EN and FA fits cleanly without horizontal overflow and all buttons visible', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(stub.appOrigin + '/__test/article.html');

    // 1. Test EN banner at 360px
    await ext.clickContextMenu('makan-translate-page', page.url());
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to FA');

    // Verify all buttons and controls are visible
    await expect(inShadow(page, '#makanBannerStatus')).toBeVisible();
    await expect(inShadow(page, '#makanBannerTgtSelect')).toBeVisible();
    await expect(inShadow(page, '#makanRestoreBtn')).toBeVisible();
    await expect(inShadow(page, '#makanBannerClose')).toBeVisible();

    // Verify banner bounding box does not exceed viewport width (360px)
    const enBox = await banner.boundingBox();
    expect(enBox.width).toBeLessThanOrEqual(360);
    expect(enBox.x).toBeGreaterThanOrEqual(0);
    expect(enBox.x + enBox.width).toBeLessThanOrEqual(361);

    // Restore original to dismiss banner
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(banner).toHaveCount(0);

    // 2. Test FA banner at 360px
    await ext.patchConfig({ ui: 'fa' });
    await page.reload();
    await page.setViewportSize({ width: 360, height: 640 });

    await ext.clickContextMenu('makan-translate-page', page.url());
    const faBanner = inShadow(page, '.makan-top-banner');
    await expect(faBanner).toBeVisible({ timeout: 15_000 });

    // Verify banner has RTL dir attribute and Persian restore button text
    await expect(faBanner).toHaveAttribute('dir', 'rtl');
    await expect(inShadow(page, '#makanRestoreBtn')).toHaveText('نمایش متن اصلی');
    await expect(inShadow(page, '#makanBannerClose')).toBeVisible();

    // Verify banner bounding box does not overflow at 360px
    const faBox = await faBanner.boundingBox();
    expect(faBox.width).toBeLessThanOrEqual(360);
    expect(faBox.x).toBeGreaterThanOrEqual(0);
    expect(faBox.x + faBox.width).toBeLessThanOrEqual(361);

    await page.close();
  });

  test('e) RTL target sets dir=rtl and restores it; LTR target does not change dir', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1 id="rtl-h1">Sample Heading</h1>
        <p id="p-plain">Plain paragraph without dir attribute.</p>
        <p id="p-ltr" dir="ltr" style="text-align: left;">LTR paragraph with explicit left alignment.</p>
      `;
    });

    // 1. Translate to RTL (target fa)
    await ext.patchConfig({ tgt: 'fa' });
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to FA');

    // Check RTL direction and start alignment applied
    await expect(page.locator('#p-plain')).toHaveAttribute('dir', 'rtl');
    expect(await page.locator('#p-plain').evaluate(el => el.style.textAlign)).toBe('start');

    await expect(page.locator('#p-ltr')).toHaveAttribute('dir', 'rtl');
    expect(await page.locator('#p-ltr').evaluate(el => el.style.textAlign)).toBe('start');

    // 2. Click Show Original
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(banner).toHaveCount(0);

    // Verify p-plain has dir attribute removed and no inline text-align
    expect(await page.locator('#p-plain').getAttribute('dir')).toBeNull();
    expect(await page.locator('#p-plain').evaluate(el => el.style.textAlign)).toBe('');

    // Verify p-ltr has dir="ltr" and style text-align: left restored
    expect(await page.locator('#p-ltr').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('#p-ltr').evaluate(el => el.style.textAlign)).toBe('left');

    // 3. Translate to LTR (target de)
    await ext.patchConfig({ tgt: 'de' });
    await ext.clickContextMenu('makan-translate-page', page.url());
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to DE');

    // Verify LTR target does NOT change dir
    expect(await page.locator('#p-plain').getAttribute('dir')).toBeNull();
    expect(await page.locator('#p-ltr').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('#p-ltr').evaluate(el => el.style.textAlign)).toBe('left');

    await page.close();
  });

  test('g) offer bar: default OFF shows nothing and sends no request; when ON it appears for another language, sends nothing before click, and "Never for this site" is remembered after reload', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    stub.clearLog();

    // 1. Default OFF: load English page
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Verify offer bar is NOT shown and no translation requests were sent
    expect(await inShadow(page, '.makan-offer-bar').count()).toBe(0);
    expect(stub.calls('clients5.google.com')).toHaveLength(0);

    // 2. Turn ON offerPageTranslate
    await ext.patchConfig({ offerPageTranslate: true });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Offer bar appears because page is English and target is Persian (FA)
    const offerBar = inShadow(page, '.makan-offer-bar');
    await expect(offerBar).toBeVisible({ timeout: 10_000 });
    await expect(inShadow(page, '#makanOfferTranslate')).toBeVisible();
    await expect(inShadow(page, '#makanOfferNotNow')).toBeVisible();
    await expect(inShadow(page, '#makanOfferNever')).toBeVisible();

    // STRICT PRIVACY CHECK: NO network request sent before user clicks!
    expect(stub.calls('clients5.google.com')).toHaveLength(0);

    // 3. Click "Never for this site"
    await inShadow(page, '#makanOfferNever').click();
    await expect(offerBar).toHaveCount(0);

    // 4. Reload page: "Never for this site" must be remembered locally
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);

    // Offer bar does NOT appear after reload
    expect(await inShadow(page, '.makan-offer-bar').count()).toBe(0);
    // Still zero requests
    expect(stub.calls('clients5.google.com')).toHaveLength(0);

    await page.close();
  });

  test('h) with no click, the page is never translated (keeps page-attacks guarantee against programmatic events)', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    stub.clearLog();
    await ext.patchConfig({ offerPageTranslate: true });
    await page.goto(stub.appOrigin + '/__test/article.html');
    await page.waitForLoadState('domcontentloaded');

    const offerBar = inShadow(page, '.makan-offer-bar');
    await expect(offerBar).toBeVisible({ timeout: 10_000 });

    // Attack simulation: in-page script attempts to fake untrusted click on Translate button
    await page.evaluate(() => {
      const root = document.getElementById('makan-translate-root');
      const btn = root?.shadowRoot?.getElementById('makanOfferTranslate');
      if (btn) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });

    await page.waitForTimeout(1000);

    // Verification: untrusted script cannot trigger translation
    expect(stub.calls('clients5.google.com')).toHaveLength(0);
    const p1Text = await page.locator('#p1').textContent();
    expect(p1Text).not.toContain('[fa]');

    await page.close();
  });
});

