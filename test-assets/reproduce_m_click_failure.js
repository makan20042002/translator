const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const EXT_PATH = path.resolve('extension');
const USER_DATA_DIR = path.resolve('test-assets', 'repro_prof_' + Date.now());

async function repro() {
  console.log('===============================================================');
  console.log('🔍 Step 1: Reproduce M Button Click Failure with Real Pointer');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // Use visible headful browser for accurate pointer/selection behavior
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900'
    ],
    defaultViewport: { width: 1280, height: 900 }
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to English Wikipedia article...');
    await page.goto('https://en.wikipedia.org/wiki/Translation', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Find the first good paragraph
    const pRect = await page.evaluate(() => {
      const p = document.querySelector('#mw-content-text p:not(.mw-empty-elt)');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { x: r.left + 50, y: r.top + 10, width: Math.min(300, r.width - 60), height: 20 };
    });

    if (!pRect) {
      throw new Error('Could not find suitable paragraph on Wikipedia');
    }

    console.log('Dragging mouse to select sentence on Wikipedia:', pRect);
    // Real mouse drag selection
    await page.mouse.move(pRect.x, pRect.y);
    await page.mouse.down();
    await page.mouse.move(pRect.x + pRect.width, pRect.y, { steps: 10 });
    await page.mouse.up();

    // Wait for M button
    await new Promise(r => setTimeout(r, 800));

    const btnInfo = await page.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const sel = window.getSelection()?.toString();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        visible: r.width > 0 && r.height > 0,
        selectedText: sel
      };
    });

    console.log('Floating M button state after mouse drag selection:', btnInfo);
    if (!btnInfo || !btnInfo.visible) {
      console.log('❌ M button was not visible after drag selection!');
      await page.screenshot({ path: 'test-assets/screenshots/repro_no_button.png' });
      return;
    }

    await page.screenshot({ path: 'test-assets/screenshots/repro_1_button_shown.png' });

    const hitTest = await page.evaluate((coords) => {
      const root = document.getElementById('makan-translate-root');
      const shadow = root?.shadowRoot;
      const btn = shadow?.querySelector('.makan-btn-float');
      const topEl = document.elementFromPoint(coords.x, coords.y);
      const shadowTopEl = shadow?.elementFromPoint ? shadow.elementFromPoint(coords.x, coords.y) : null;
      return {
        rootStylePE: root ? window.getComputedStyle(root).pointerEvents : null,
        btnStylePE: btn ? window.getComputedStyle(btn).pointerEvents : null,
        documentHitElement: topEl ? `${topEl.tagName}.${topEl.className}` : null,
        shadowHitElement: shadowTopEl ? `${shadowTopEl.tagName}.${shadowTopEl.className}` : null
      };
    }, { x: btnInfo.x, y: btnInfo.y });
    console.log('Hit test before click:', JSON.stringify(hitTest, null, 2));

    // Now perform real mouse down and mouse up on the M button
    console.log(`Moving mouse to M button center (${btnInfo.x.toFixed(1)}, ${btnInfo.y.toFixed(1)}) and clicking...`);
    await page.mouse.move(btnInfo.x, btnInfo.y);
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 120));
    await page.mouse.up();

    // Wait to see what happens
    await new Promise(r => setTimeout(r, 1000));

    const stateAfterClick = await page.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      const card = root?.querySelector('.makan-card');
      const sel = window.getSelection()?.toString();
      return {
        hasBtn: !!btn,
        hasCard: !!card,
        cardVisible: card ? (card.getBoundingClientRect().width > 0) : false,
        cardText: card?.textContent?.trim()?.slice(0, 100),
        selectionText: sel
      };
    });

    console.log('\nState observed after real mouse click on M button:');
    console.log(JSON.stringify(stateAfterClick, null, 2));

    await page.screenshot({ path: 'test-assets/screenshots/repro_2_after_click.png' });

    if (!stateAfterClick.hasCard && !stateAfterClick.hasBtn) {
      console.log('\n🚨 BUG REPRODUCED CONFIRMED: Clicking the M button did nothing, the card never opened, and the button disappeared!');
    } else if (stateAfterClick.hasCard) {
      console.log('\nCard opened unexpectedly!');
    } else {
      console.log('\nOther state observed:', stateAfterClick);
    }
  } catch (err) {
    console.error('Repro Error:', err);
  } finally {
    await browser.close();
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
  }
}

repro();
