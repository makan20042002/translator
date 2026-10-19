'use strict';
// Extension: whole-page translation comprehensive test suite
const { test, expect, inShadow, rightClick } = require('../support/ext-fixtures');

const MESSY_PAGE = '/__test/messy.html';

test.describe('Extension: whole-page translation full suite', () => {
  test('a) translates all visible text blocks and attributes on a messy page and restores exact HTML on Show Original', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
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
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=b');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);
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
    await rightClick(page, '#top-p-1');
    await ext.clickContextMenu('makan-translate-page', page.url());

    // Wait until Google translate receives the first request and top-p-1 is translated before the page finishes
    await page.waitForFunction(() => {
      const el = document.getElementById('top-p-1');
      return el && el.textContent.includes('[fa]');
    });
    const bottomP50Text = await page.locator('#bottom-p-50').textContent();
    expect(bottomP50Text).not.toContain('[fa]');

    // Wait for the full page translation to complete
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to FA', { timeout: 15_000 });

    // Flatten all q values of all stub.calls('clients5.google.com') in request order
    const googleCalls = stub.calls('clients5.google.com');
    expect(googleCalls.length).toBeGreaterThanOrEqual(1);

    const allQ = [];
    for (const call of googleCalls) {
      const form = new URLSearchParams(call.body);
      allQ.push(...form.getAll('q'));
    }

    const onScreenIndices = [];
    const distantIndices = [];
    allQ.forEach((text, idx) => {
      if (text.includes('On screen paragraph')) onScreenIndices.push(idx);
      if (text.includes('Distant off screen paragraph')) distantIndices.push(idx);
    });

    expect(onScreenIndices.length).toBe(20);
    expect(distantIndices.length).toBe(50);

    // Assert that every on-screen text index is smaller than every Distant off screen text index
    for (const onIdx of onScreenIndices) {
      for (const offIdx of distantIndices) {
        expect(onIdx).toBeLessThan(offIdx);
      }
    }

    await page.close();
  });

  test('c) translates late-added content dynamically with MutationObserver and stops observing after Show Original', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=c');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);

    // Start whole page translation
    await rightClick(page, '#p1');
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
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=i');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);
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
    await rightClick(page, '#test-title');
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
    test.setTimeout(60_000);
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=d');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);
    await page.evaluate(() => {
      // Create 200 paragraphs with different text each to ensure several batches
      const container = document.createElement('div');
      container.id = 'bulk-container';
      for (let i = 1; i <= 200; i++) {
        const p = document.createElement('p');
        p.id = `para-${i}`;
        p.textContent = `Paragraph text item unique number ${i} for stop and retranslate test block.`;
        container.appendChild(p);
      }
      document.body.appendChild(container);
    });

    // Slow down the engine host so we can click Stop during progress
    stub.delayHost('clients5.google.com', 1200);

    await rightClick(page, '#para-1');
    await ext.clickContextMenu('makan-translate-page', page.url());

    // Wait for the stop button to appear in shadow DOM while translating
    const stopBtn = inShadow(page, '#makanStopBtn');
    await expect(stopBtn).toBeVisible({ timeout: 15_000 });

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
        expect(q).toContain('Paragraph text item unique number');
      }
    }

    await page.close();
  });

  test('f) banner at 360 px in EN and FA fits cleanly without horizontal overflow and all buttons visible', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(stub.appOrigin + '/__test/article.html?case=f');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);

    // 1. Test EN banner at 360px
    await rightClick(page, '#p1');
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
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);

    await rightClick(page, '#p1');
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
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await ext.patchConfig({ tgt: 'fa' });
    await page.goto(stub.appOrigin + '/__test/article.html?case=e');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);
    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1 id="rtl-h1">Sample Heading</h1>
        <p id="p-plain">Plain paragraph without dir attribute.</p>
        <p id="p-ltr" dir="ltr" style="text-align: left;">LTR paragraph with explicit left alignment.</p>
      `;
    });

    // 1. Translate to RTL (target fa)
    await rightClick(page, '#rtl-h1');
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
    stub.clearLog();
    await ext.patchConfig({ tgt: 'de' });
    await rightClick(page, '#rtl-h1');
    await ext.clickContextMenu('makan-translate-page', page.url());
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to DE');

    const deCalls = stub.calls('clients5.google.com');
    expect(deCalls.length).toBeGreaterThan(0);
    expect(deCalls[0].query).toContain('tl=de');

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
    await page.goto(stub.appOrigin + '/__test/article.html?case=g');
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
    await page.goto(stub.appOrigin + '/__test/article.html?case=h');
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

  test('j) translates placeholder, title, aria-label, alt on visible inputs and textareas without touching values, skips type=hidden, restores on Show Original', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=j');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);
    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1 id="item1-heading">Form Controls Attribute Translation</h1>
        <input type="text" id="t-input" placeholder="Search the catalog" value="Typed query text" title="Input tooltip" aria-label="Catalog search input">
        <textarea id="t-textarea" placeholder="Leave your feedback here" title="Textarea tooltip">User typed essay text</textarea>
        <input type="password" id="t-password" placeholder="Enter secret password" value="SuperSecretPassword123">
        <input type="hidden" id="t-hidden" placeholder="Hidden placeholder" value="hidden_value">
        <div id="t-editable" contenteditable="true" title="Editable area tooltip">User editable note draft</div>
      `;
    });

    stub.clearLog();
    await rightClick(page, '#item1-heading');
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated to FA');

    // 1. Translated attributes: placeholder, title, aria-label
    await expect(page.locator('#t-input')).toHaveAttribute('placeholder', '[fa] Search the catalog');
    await expect(page.locator('#t-input')).toHaveAttribute('title', '[fa] Input tooltip');
    await expect(page.locator('#t-input')).toHaveAttribute('aria-label', '[fa] Catalog search input');
    await expect(page.locator('#t-textarea')).toHaveAttribute('placeholder', '[fa] Leave your feedback here');
    await expect(page.locator('#t-textarea')).toHaveAttribute('title', '[fa] Textarea tooltip');
    await expect(page.locator('#t-password')).toHaveAttribute('placeholder', '[fa] Enter secret password');
    await expect(page.locator('#t-editable')).toHaveAttribute('title', '[fa] Editable area tooltip');

    // 2. Typed values and contents are NEVER touched!
    expect(await page.locator('#t-input').inputValue()).toBe('Typed query text');
    expect(await page.locator('#t-textarea').inputValue()).toBe('User typed essay text');
    expect(await page.locator('#t-password').inputValue()).toBe('SuperSecretPassword123');
    expect(await page.locator('#t-editable').textContent()).toBe('User editable note draft');

    // 3. Hidden input is completely skipped!
    expect(await page.locator('#t-hidden').getAttribute('placeholder')).toBe('Hidden placeholder');
    expect(await page.locator('#t-hidden').inputValue()).toBe('hidden_value');

    // 4. Show Original restores original attributes
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(banner).toHaveCount(0);

    expect(await page.locator('#t-input')).toHaveAttribute('placeholder', 'Search the catalog');
    expect(await page.locator('#t-input')).toHaveAttribute('title', 'Input tooltip');
    expect(await page.locator('#t-input')).toHaveAttribute('aria-label', 'Catalog search input');
    expect(await page.locator('#t-textarea')).toHaveAttribute('placeholder', 'Leave your feedback here');
    expect(await page.locator('#t-textarea')).toHaveAttribute('title', 'Textarea tooltip');
    expect(await page.locator('#t-password')).toHaveAttribute('placeholder', 'Enter secret password');
    expect(await page.locator('#t-editable')).toHaveAttribute('title', 'Editable area tooltip');

    // Values remain intact after restore
    expect(await page.locator('#t-input').inputValue()).toBe('Typed query text');
    expect(await page.locator('#t-textarea').inputValue()).toBe('User typed essay text');
    expect(await page.locator('#t-password').inputValue()).toBe('SuperSecretPassword123');
    expect(await page.locator('#t-editable').textContent()).toBe('User editable note draft');

    await page.close();
  });

  test('l) banner markup, controls and state transitions: Stop halts translation cleanly, language dropdown triggers re-translation from originals, and Show Original restores page', async ({ ext, stub }) => {
    test.setTimeout(60_000);
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=l');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);
    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1 id="item3-title">Banner Controls and Stop State Transition</h1>
        <div id="para-list"></div>
      `;
      const list = document.getElementById('para-list');
      for (let i = 1; i <= 200; i++) {
        const p = document.createElement('p');
        p.id = `item3-p-${i}`;
        p.textContent = `Paragraph sentence unique number ${i} for banner state test verification content block.`;
        list.appendChild(p);
      }
    });

    // Slow down engine so we can interact with Stop during translation
    stub.delayHost('clients5.google.com', 1200);
    stub.clearLog();

    await rightClick(page, '#item3-title');
    await ext.clickContextMenu('makan-translate-page', page.url());

    // Verify banner appears in shadow DOM with progress and Stop button
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const stopBtn = inShadow(page, '#makanStopBtn');
    await expect(stopBtn).toBeVisible({ timeout: 15_000 });
    await expect(inShadow(page, '#makanBannerStatus')).toBeVisible();

    // Click Stop button
    await stopBtn.click();

    // Stop must display stopped status, remove Stop button, and display Show Original button
    await expect(banner).toContainText('Translation stopped', { timeout: 10_000 });
    await expect(inShadow(page, '#makanStopBtn')).toHaveCount(0);
    const restoreBtn = inShadow(page, '#makanRestoreBtn');
    await expect(restoreBtn).toBeVisible();

    // Verify engine requests ceased
    const callsAfterStop = stub.calls('clients5.google.com').length;
    await page.waitForTimeout(800);
    expect(stub.calls('clients5.google.com').length).toBe(callsAfterStop);

    // Reset delays and stub logs
    stub.resetModes();
    stub.clearLog();

    // Change target language to FR using the banner select dropdown
    const langSelect = inShadow(page, '#makanBannerTgtSelect');
    await expect(langSelect).toBeVisible();
    await langSelect.selectOption('fr');

    // Retranslation finishes and banner updates
    await expect(banner).toContainText('Page translated to FR', { timeout: 15_000 });
    expect(await page.locator('#item3-p-1').textContent()).toContain('[fr]');

    // Requests sent for FR must contain original English text, not [fa]
    const frCalls = stub.calls('clients5.google.com');
    expect(frCalls.length).toBeGreaterThan(0);
    for (const call of frCalls) {
      const form = new URLSearchParams(call.body);
      for (const q of form.getAll('q')) {
        expect(q).not.toContain('[fa]');
      }
    }

    // Click Show Original
    await restoreBtn.click();
    await expect(banner).toHaveCount(0);
    expect(await page.locator('#item3-p-1').textContent()).toBe('Paragraph sentence unique number 1 for banner state test verification content block.');

    await page.close();
  });

  test('m) triggers page translation immediately after page.goto without prior click or delay on a fresh tab', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=m');

    // Immediately trigger translation without any click or artificial delay
    await ext.clickContextMenu('makan-translate-page', page.url());

    // Expect the banner to appear within a few seconds
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 12_000 });
    await expect(banner).toContainText('Page translated', { timeout: 12_000 });

    await page.close();
  });

  test('n) ext.waitForContentScript reliably confirms content script readiness before triggering translation', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=n');
    await page.waitForLoadState('domcontentloaded');

    await ext.waitForContentScript(page);
    await rightClick(page, '#p1');
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 12_000 });
    await expect(banner).toContainText('Page translated to FA', { timeout: 12_000 });

    await page.close();
  });

  test('p) banner lifecycle: immediate banner and Stop button presentation, transition to stopped and restore button, and close', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=p');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);

    stub.delayHost('clients5.google.com', 400);

    await rightClick(page, '#p1');
    await ext.clickContextMenu('makan-translate-page', page.url());

    // 1. Banner appears with status and stop button immediately
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    const status = inShadow(page, '#makanBannerStatus');
    await expect(status).toBeVisible();
    const stopBtn = inShadow(page, '#makanStopBtn');
    await expect(stopBtn).toBeVisible();

    // 2. Click stop button
    await stopBtn.click();
    await expect(status).toContainText('Translation stopped');
    await expect(inShadow(page, '#makanStopBtn')).toHaveCount(0);
    const restoreBtn = inShadow(page, '#makanRestoreBtn');
    await expect(restoreBtn).toBeVisible();

    // 3. Close banner
    await inShadow(page, '#makanBannerClose').click();
    await expect(banner).toHaveCount(0);

    await page.close();
  });

  test('q) ext.clickContextMenu resolves ambiguous tabs by preferring active tab in focused window', async ({ ext, stub }) => {
    // Both tabs navigate to the same URL
    const url = stub.appOrigin + '/__test/article.html?case=ambiguous';
    const page1 = await ext.context.newPage();
    await page1.goto(url);
    await page1.waitForLoadState('domcontentloaded');

    const page2 = await ext.context.newPage();
    await page2.goto(url);
    await page2.waitForLoadState('domcontentloaded');

    // With page2 brought to front, clickContextMenu targets active page2
    await page2.bringToFront();
    await page2.waitForFunction(() => document.visibilityState === 'visible');
    await rightClick(page2, '#p1');
    await ext.clickContextMenu('makan-translate-page', url);

    const banner2 = inShadow(page2, '.makan-top-banner');
    await expect(banner2).toBeVisible({ timeout: 12_000 });
    // page1 was in background and should NOT have received the action
    expect(await inShadow(page1, '.makan-top-banner').count()).toBe(0);

    await page1.close();
    await page2.close();
  });

  test('r) banner controls and attribute translation with language change and restore on dedicated tab', async ({ ext, stub }) => {
    test.setTimeout(60_000);
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=r');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);

    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1 id="r-title">Form and Banner Integration</h1>
        <p id="r-p">Original lead paragraph content.</p>
        <input type="text" id="r-input" placeholder="Type search keywords" value="typed user value" title="Search input title" aria-label="Search box">
        <textarea id="r-textarea" placeholder="Provide feedback notes" title="Feedback area">typed feedback content</textarea>
      `;
    });

    stub.clearLog();
    await rightClick(page, '#r-title');
    await ext.clickContextMenu('makan-translate-page', page.url());

    // 1. Banner appears with correct controls
    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(inShadow(page, '#makanBannerStatus')).toBeVisible();
    await expect(inShadow(page, '#makanBannerTgtSelect')).toBeVisible();
    await expect(inShadow(page, '#makanBannerClose')).toBeVisible();

    // Wait for translation to complete
    await expect(banner).toContainText('Page translated to FA', { timeout: 15_000 });
    await expect(inShadow(page, '#makanRestoreBtn')).toBeVisible();

    // 2. Element text and attributes are translated to FA, input values untouched
    expect(await page.locator('#r-p').textContent()).toContain('[fa]');
    await expect(page.locator('#r-input')).toHaveAttribute('placeholder', '[fa] Type search keywords');
    await expect(page.locator('#r-input')).toHaveAttribute('title', '[fa] Search input title');
    await expect(page.locator('#r-input')).toHaveAttribute('aria-label', '[fa] Search box');
    await expect(page.locator('#r-textarea')).toHaveAttribute('placeholder', '[fa] Provide feedback notes');
    expect(await page.locator('#r-input').inputValue()).toBe('typed user value');
    expect(await page.locator('#r-textarea').inputValue()).toBe('typed feedback content');

    // 3. Change language via dropdown to DE
    stub.clearLog();
    const langSelect = inShadow(page, '#makanBannerTgtSelect');
    await langSelect.selectOption('de');
    await expect(banner).toContainText('Page translated to DE', { timeout: 15_000 });

    // Attributes and paragraphs re-translate from originals to DE
    expect(await page.locator('#r-p').textContent()).toContain('[de]');
    await expect(page.locator('#r-input')).toHaveAttribute('placeholder', '[de] Type search keywords');
    await expect(page.locator('#r-input')).toHaveAttribute('title', '[de] Search input title');
    expect(await page.locator('#r-input').inputValue()).toBe('typed user value');

    // 4. Show Original restores original attributes and text
    await inShadow(page, '#makanRestoreBtn').click();
    await expect(banner).toHaveCount(0);
    expect(await page.locator('#r-p').textContent()).toBe('Original lead paragraph content.');
    await expect(page.locator('#r-input')).toHaveAttribute('placeholder', 'Type search keywords');
    await expect(page.locator('#r-input')).toHaveAttribute('title', 'Search input title');
    await expect(page.locator('#r-input')).toHaveAttribute('aria-label', 'Search box');
    await expect(page.locator('#r-textarea')).toHaveAttribute('placeholder', 'Provide feedback notes');
    expect(await page.locator('#r-input').inputValue()).toBe('typed user value');
    expect(await page.locator('#r-textarea').inputValue()).toBe('typed feedback content');

    await page.close();
  });
});

