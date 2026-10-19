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
});
