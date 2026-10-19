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
});
