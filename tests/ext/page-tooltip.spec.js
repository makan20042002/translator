'use strict';

const { test, expect, inShadow, rightClick, expectNoExtensionErrors } = require('../support/ext-fixtures');

test.describe('Extension: whole-page translation tooltip and screen button', () => {

  test('ITEM 1 - popup dimensions, viewport clamping, word wrapping, and hiding on mouseleave', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=tooltip-item1');
    await page.waitForLoadState('domcontentloaded');

    // Create a paragraph near the left edge and another near the bottom edge
    await page.evaluate(() => {
      const pLeft = document.createElement('p');
      pLeft.id = 'p-left-edge';
      pLeft.style.cssText = 'position:fixed;left:2px;top:100px;margin:0;width:160px;';
      pLeft.textContent = 'This is a left-edge paragraph with several words to test tooltip width and positioning.';
      document.body.appendChild(pLeft);

      const pBottom = document.createElement('p');
      pBottom.id = 'p-bottom-edge';
      pBottom.style.cssText = 'position:fixed;left:80px;bottom:6px;margin:0;width:160px;';
      pBottom.textContent = 'This is a bottom-edge paragraph positioned right near the bottom edge of the viewport.';
      document.body.appendChild(pBottom);
    });

    // Translate page via context menu
    await rightClick(page, '#title');
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#p-left-edge')).toContainText('[fa]');
    await expect(page.locator('#p-bottom-edge')).toContainText('[fa]');

    const tip = inShadow(page, '.makan-tooltip');

    // 1. Hover paragraph near left edge
    await page.mouse.move(0, 0);
    await page.locator('#p-left-edge').hover();
    await expect(tip).toBeVisible({ timeout: 5000 });

    const boxLeft = await tip.boundingBox();
    expect(boxLeft).toBeTruthy();
    expect(boxLeft.width).toBeGreaterThanOrEqual(200);
    expect(boxLeft.width).toBeLessThanOrEqual(340);

    const vp = await page.viewportSize();
    expect(boxLeft.x).toBeGreaterThanOrEqual(0);
    expect(boxLeft.x + boxLeft.width).toBeLessThanOrEqual(vp.width);
    expect(boxLeft.y).toBeGreaterThanOrEqual(0);
    expect(boxLeft.y + boxLeft.height).toBeLessThanOrEqual(vp.height);

    // Mouse leaves left element -> hidden after 100 ms
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await expect(tip).toBeHidden();

    // 2. Hover paragraph near bottom edge (flips above and stays inside viewport)
    await page.locator('#p-bottom-edge').hover();
    await expect(tip).toBeVisible({ timeout: 5000 });

    const boxBottom = await tip.boundingBox();
    expect(boxBottom).toBeTruthy();
    expect(boxBottom.width).toBeGreaterThanOrEqual(200);
    expect(boxBottom.width).toBeLessThanOrEqual(340);
    expect(boxBottom.x).toBeGreaterThanOrEqual(0);
    expect(boxBottom.x + boxBottom.width).toBeLessThanOrEqual(vp.width);
    expect(boxBottom.y).toBeGreaterThanOrEqual(0);
    expect(boxBottom.y + boxBottom.height).toBeLessThanOrEqual(vp.height);

    // Mouse leaves bottom element -> hidden after 100 ms
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await expect(tip).toBeHidden();

    await page.close();
    await expectNoExtensionErrors(ext);
  });

  test('ITEM 2 - closing banner stops hover popups; show original stops hover popups', async ({ ext, stub }) => {
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=tooltip-item2');
    await page.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page);

    // 1. Translate page, close banner via X, assert no popup on hover and text stays translated
    await rightClick(page, '#title');
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('Page translated', { timeout: 15_000 });
    const p1 = page.locator('#p1');
    await expect(p1).toContainText('[fa]');

    // Close the banner via the X (#makanBannerClose)
    const closeBtn = inShadow(page, '#makanBannerClose');
    await closeBtn.click();
    await expect(banner).toBeHidden();

    // Hover translated paragraph for 600 ms
    await p1.hover();
    await page.waitForTimeout(600);

    // Assert no popup element is visible; the paragraph text is still translated
    const tip = inShadow(page, '.makan-tooltip');
    await expect(tip).toBeHidden();
    await expect(p1).toContainText('[fa]');

    // 2. Also test: Show Original then hover: no popup
    const page2 = await ext.context.newPage();
    await page2.bringToFront();
    await page2.waitForFunction(() => document.visibilityState === 'visible');
    await page2.goto(stub.appOrigin + '/__test/article.html?case=tooltip-item2-restore');
    await page2.waitForLoadState('domcontentloaded');
    await ext.waitForContentScript(page2);

    await rightClick(page2, '#title');
    await ext.clickContextMenu('makan-translate-page', page2.url());

    const banner2 = inShadow(page2, '.makan-top-banner');
    await expect(banner2).toBeVisible({ timeout: 15_000 });
    await expect(banner2).toContainText('Page translated', { timeout: 15_000 });
    const p1Page2 = page2.locator('#p1');
    await expect(p1Page2).toContainText('[fa]');

    // Click Show Original (#makanRestoreBtn)
    const restoreBtn = inShadow(page2, '#makanRestoreBtn');
    await restoreBtn.click();
    await expect(p1Page2).not.toContainText('[fa]');

    // Hover paragraph for 600 ms: assert no popup
    await p1Page2.hover();
    await page2.waitForTimeout(600);
    const tip2 = inShadow(page2, '.makan-tooltip');
    await expect(tip2).toBeHidden();

    await page.close();
    await page2.close();
    await expectNoExtensionErrors(ext);
  });

  test('ITEM 3 - screen capture requirement line and button states in browser and desktop modes', async ({ ext, stub }) => {
    // 1. Web project (non-desktop): line and link are visible on the Screen tab and Capture button is disabled
    const pageWeb = await ext.context.newPage();
    await pageWeb.bringToFront();
    await pageWeb.goto(stub.appOrigin + '/index.html?case=screen-item3-web');
    await pageWeb.waitForLoadState('domcontentloaded');

    // Switch to Screen tab
    await pageWeb.locator('[data-tab="screen"]').click();
    await expect(pageWeb.locator('#tab-screen')).toBeVisible();

    // Verify line and link are visible and Capture button is disabled
    const reqLine = pageWeb.locator('#screenDesktopReqLine');
    const link = pageWeb.locator('#screenGetAppLink');
    const launchBtn = pageWeb.locator('#tabScreenLaunchBtn');

    await expect(reqLine).toBeVisible();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://makanlab.tech/');
    await expect(launchBtn).toBeDisabled();

    await pageWeb.close();

    // 2. Mocked as desktop: line is hidden and Capture button is enabled
    const pageDesktop = await ext.context.newPage();
    await pageDesktop.addInitScript(() => {
      window.makanDesktop = {
        isDesktop: true,
        startScreenTranslator: () => {}
      };
    });
    await pageDesktop.bringToFront();
    await pageDesktop.goto(stub.appOrigin + '/index.html?case=screen-item3-desktop');
    await pageDesktop.waitForLoadState('domcontentloaded');

    // Switch to Screen tab
    await pageDesktop.locator('[data-tab="screen"]').click();
    await expect(pageDesktop.locator('#tab-screen')).toBeVisible();

    // Verify line is hidden and Capture button is enabled
    const reqLineDesktop = pageDesktop.locator('#screenDesktopReqLine');
    const launchBtnDesktop = pageDesktop.locator('#tabScreenLaunchBtn');

    await expect(reqLineDesktop).toBeHidden();
    await expect(launchBtnDesktop).toBeEnabled();

    await pageDesktop.close();
    await expectNoExtensionErrors(ext);
  });

  test('ITEM 4 - tooltip on Persian RTL original text renders right-aligned with rtl direction', async ({ ext, stub }) => {
    await ext.patchConfig({ tgt: 'en' });
    const page = await ext.context.newPage();
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible');
    await page.goto(stub.appOrigin + '/__test/article.html?case=tooltip-rtl-fa');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      const pFa = document.createElement('p');
      pFa.id = 'p-fa-orig';
      pFa.style.cssText = 'position:fixed;left:100px;top:100px;margin:0;width:250px;';
      pFa.textContent = 'این یک متن نمونه فارسی برای بررسی جهت نمایش پاپ‌آپ است.';
      document.body.appendChild(pFa);
    });

    // Translate page via context menu
    await rightClick(page, '#title');
    await ext.clickContextMenu('makan-translate-page', page.url());

    const banner = inShadow(page, '.makan-top-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#p-fa-orig')).toContainText('[en]');

    const tip = inShadow(page, '.makan-tooltip');

    // Hover Persian paragraph
    await page.locator('#p-fa-orig').hover();
    await expect(tip).toBeVisible({ timeout: 5000 });

    // Assert computed text-align and direction
    const computed = await tip.evaluate((el) => {
      const txt = el.querySelector('.makan-tooltip-text');
      const csTip = window.getComputedStyle(el);
      const csTxt = txt ? window.getComputedStyle(txt) : csTip;
      return {
        tipDirection: csTip.direction,
        tipTextAlign: csTip.textAlign,
        txtDirection: csTxt.direction,
        txtTextAlign: csTxt.textAlign,
        txtFontFamily: csTxt.fontFamily
      };
    });

    expect(computed.tipDirection).toBe('rtl');
    expect(computed.tipTextAlign).toBe('right');
    expect(computed.txtDirection).toBe('rtl');
    expect(computed.txtTextAlign).toBe('right');
    expect(computed.txtFontFamily).toContain('Vazirmatn');

    await page.close();
    await expectNoExtensionErrors(ext);
  });

});

