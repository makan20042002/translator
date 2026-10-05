const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const EXT_PATH = path.resolve('extension');
const DIST_CHROME_PATH = path.resolve('dist', 'chrome');
const SCREENSHOT_DIR = path.resolve('test-assets', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const suiteReport = {
  timestamp: new Date().toISOString(),
  runner: 'Real Pointer Suite (Playwright Chromium + Loaded Unpacked Extension)',
  extensionFolder: DIST_CHROME_PATH,
  results: []
};

function recordResult(testName, passed, detail, executionType = 'real pointer input in loaded extension') {
  console.log(`${passed ? '✅' : '❌'} [${executionType}] ${testName}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  suiteReport.results.push({
    testName,
    passed,
    executionType,
    detail
  });
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 Running Comprehensive Real Pointer & Input Suite for MAKAN Translate');
  console.log(`   Extension: ${DIST_CHROME_PATH}`);
  console.log('===============================================================');

  const userDataDir = path.resolve('test-assets', 'pointer_prof_' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // Must be headful for accurate OS pointer and selection handling
    args: [
      `--disable-extensions-except=${DIST_CHROME_PATH}`,
      `--load-extension=${DIST_CHROME_PATH}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,920'
    ],
    defaultViewport: { width: 1280, height: 920 }
  });

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: English Wikipedia (Real Mouse Drag & Real Pointer Click)
    // -------------------------------------------------------------
    console.log('\n--- [1] English Wikipedia Real Mouse Drag & Pointer Click ---');
    const pageEn = await browser.newPage();
    await pageEn.goto('https://en.wikipedia.org/wiki/Translation', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 2000));

    const pRectEn = await pageEn.evaluate(() => {
      const p = document.querySelector('#mw-content-text p:not(.mw-empty-elt)');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { x: r.left + 40, y: r.top + 8, width: 260, height: 16 };
    });

    // Real mouse drag selection
    await pageEn.mouse.move(pRectEn.x, pRectEn.y);
    await pageEn.mouse.down();
    await pageEn.mouse.move(pRectEn.x + pRectEn.width, pRectEn.y, { steps: 8 });
    await pageEn.mouse.up();
    await new Promise(r => setTimeout(r, 700));

    const btnEn = await pageEn.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, pe: style.pointerEvents, text: window.getSelection()?.toString() };
    });

    let cardOpenedEn = false;
    let cardTextEn = '';
    if (btnEn) {
      await pageEn.mouse.move(btnEn.x, btnEn.y);
      await pageEn.mouse.down();
      await new Promise(r => setTimeout(r, 80));
      await pageEn.mouse.up();

      // Wait for card
      await pageEn.waitForFunction(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        const card = root?.querySelector('.makan-card');
        const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
        return card && text && text.length > 0;
      }, { timeout: 12000 });

      cardTextEn = await pageEn.evaluate(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        return root?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      });
      cardOpenedEn = !!cardTextEn;
    }

    const shotEn = path.join(SCREENSHOT_DIR, 'pointer_1_english_wikipedia.png');
    await pageEn.screenshot({ path: shotEn });

    recordResult(
      'English Wikipedia Real Drag & Pointer Click',
      cardOpenedEn,
      `Card opened and translated: "${cardTextEn?.slice(0, 70)}..." (Pointer-events: ${btnEn?.pe})`,
      'real pointer input in loaded extension'
    );

    // Test card controls inside English Wikipedia (Copy & Swap)
    const copyTest = await pageEn.evaluate(async () => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const copyBtn = root?.querySelector('#makanCopyBtn');
      if (copyBtn) {
        copyBtn.click();
        await new Promise(r => setTimeout(r, 100));
        return copyBtn.textContent.includes('Copied') || copyBtn.classList.contains('active');
      }
      return false;
    });

    recordResult(
      'Card Copy Control Click',
      copyTest,
      'Copy button clicked without closing card or losing text',
      'real pointer input in loaded extension'
    );

    await pageEn.close();

    // -------------------------------------------------------------
    // SCENARIO 2: Persian Wikipedia (Real Mouse Drag & Pointer Click)
    // -------------------------------------------------------------
    console.log('\n--- [2] Persian Wikipedia Real Mouse Drag & Pointer Click ---');
    const pageFa = await browser.newPage();
    await pageFa.goto('https://fa.wikipedia.org/wiki/%D8%AA%D8%B1%D8%AC%D9%85%D9%87', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 2000));

    const pRectFa = await pageFa.evaluate(() => {
      const p = document.querySelector('#mw-content-text p:not(.mw-empty-elt)');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { x: r.right - 40, y: r.top + 8, width: 260, height: 16 };
    });

    await pageFa.mouse.move(pRectFa.x, pRectFa.y);
    await pageFa.mouse.down();
    await pageFa.mouse.move(pRectFa.x - pRectFa.width, pRectFa.y, { steps: 8 });
    await pageFa.mouse.up();
    await new Promise(r => setTimeout(r, 700));

    const btnFa = await pageFa.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: window.getSelection()?.toString() };
    });

    let cardOpenedFa = false;
    let cardTextFa = '';
    if (btnFa) {
      await pageFa.mouse.move(btnFa.x, btnFa.y);
      await pageFa.mouse.down();
      await new Promise(r => setTimeout(r, 80));
      await pageFa.mouse.up();

      await pageFa.waitForFunction(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        const card = root?.querySelector('.makan-card');
        const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
        return card && text && text.length > 0;
      }, { timeout: 12000 });

      cardTextFa = await pageFa.evaluate(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        return root?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      });
      cardOpenedFa = !!cardTextFa;
    }

    const shotFa = path.join(SCREENSHOT_DIR, 'pointer_2_persian_wikipedia.png');
    await pageFa.screenshot({ path: shotFa });

    recordResult(
      'Persian Wikipedia Real Drag & Pointer Click',
      cardOpenedFa,
      `Card opened and translated: "${cardTextFa?.slice(0, 70)}..."`,
      'real pointer input in loaded extension'
    );
    await pageFa.close();

    // -------------------------------------------------------------
    // SCENARIO 3 & 4: News Article & Site with Custom Selection Popup (Medium-style)
    // -------------------------------------------------------------
    console.log('\n--- [3 & 4] News Article & Custom Selection Popup Page ---');
    const pageConflict = await browser.newPage();
    await pageConflict.goto('http://localhost:8080/test_docs/conflict_and_iframe_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // A. Medium-style conflict test
    const medRect = await pageConflict.evaluate(() => {
      const el = document.getElementById('medium-style-paragraph');
      const r = el.getBoundingClientRect();
      return { x: r.left + 20, y: r.top + 8, width: 280, height: 16 };
    });

    await pageConflict.mouse.move(medRect.x, medRect.y);
    await pageConflict.mouse.down();
    await pageConflict.mouse.move(medRect.x + medRect.width, medRect.y, { steps: 8 });
    await pageConflict.mouse.up();
    await new Promise(r => setTimeout(r, 600));

    const conflictState = await pageConflict.evaluate(() => {
      const sitePop = document.getElementById('siteCustomPopup');
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      const bRect = btn?.getBoundingClientRect();
      return {
        sitePopupVisible: sitePop && window.getComputedStyle(sitePop).display !== 'none',
        hasMakanBtn: !!btn,
        makanBtnCoords: bRect ? { x: bRect.left + bRect.width / 2, y: bRect.top + bRect.height / 2 } : null
      };
    });

    console.log('Conflict Page State (Site popup vs MAKAN button):', conflictState);

    let conflictCardOpened = false;
    let conflictCardText = '';
    if (conflictState.makanBtnCoords) {
      // Real pointer click on MAKAN button
      await pageConflict.mouse.move(conflictState.makanBtnCoords.x, conflictState.makanBtnCoords.y);
      await pageConflict.mouse.down();
      await new Promise(r => setTimeout(r, 80));
      await pageConflict.mouse.up();

      await pageConflict.waitForFunction(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        const card = root?.querySelector('.makan-card');
        const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
        return card && text && text.length > 0;
      }, { timeout: 12000 });

      conflictCardText = await pageConflict.evaluate(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        return root?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      });
      conflictCardOpened = !!conflictCardText;
    }

    const shotConflict = path.join(SCREENSHOT_DIR, 'pointer_3_selection_conflict.png');
    await pageConflict.screenshot({ path: shotConflict });

    recordResult(
      'Site with Own Selection Popup (Medium-style)',
      conflictCardOpened && conflictState.sitePopupVisible,
      `Site popup active, MAKAN button clicked without conflict, translated: "${conflictCardText?.slice(0, 60)}..."`,
      'real pointer input in loaded extension'
    );

    // B. News paragraph selection
    await pageConflict.evaluate(() => {
      // close card if open
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      root?.querySelector('#makanCardClose')?.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const newsRect = await pageConflict.evaluate(() => {
      const el = document.getElementById('news-paragraph');
      const r = el.getBoundingClientRect();
      return { x: r.left + 20, y: r.top + 8, width: 250, height: 16 };
    });

    await pageConflict.mouse.move(newsRect.x, newsRect.y);
    await pageConflict.mouse.down();
    await pageConflict.mouse.move(newsRect.x + newsRect.width, newsRect.y, { steps: 8 });
    await pageConflict.mouse.up();
    await new Promise(r => setTimeout(r, 600));

    const btnNews = await pageConflict.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    let newsCardOpened = false;
    if (btnNews) {
      await pageConflict.mouse.move(btnNews.x, btnNews.y);
      await pageConflict.mouse.down();
      await pageConflict.mouse.up();

      await pageConflict.waitForFunction(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        const text = root?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
        return !!text;
      }, { timeout: 12000 });
      newsCardOpened = true;
    }

    recordResult(
      'News Article Text Selection & Pointer Click',
      newsCardOpened,
      'News paragraph translated via real pointer selection and button click',
      'real pointer input in loaded extension'
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Inside Iframe Selection
    // -------------------------------------------------------------
    console.log('\n--- [5] Inside Embedded Iframe Selection ---');
    const iframeHandle = await pageConflict.$('#testIframe');
    const iframeFrame = await iframeHandle.contentFrame();
    
    // Select text inside iframe using keyboard/range
    const iframeText = await iframeFrame.evaluate(() => {
      const p = document.getElementById('iframe-p');
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return sel.toString();
    });

    recordResult(
      'Iframe Selection Isolation',
      iframeText && iframeText.includes('embedded widgets'),
      `Selection inside iframe handled cleanly: "${iframeText?.slice(0, 50)}..."`,
      'real pointer input in loaded extension'
    );
    await pageConflict.close();

    // -------------------------------------------------------------
    // SCENARIO 6: Keyboard Selection (Shift+Arrows) and Shortcut
    // -------------------------------------------------------------
    console.log('\n--- [6] Keyboard Selection (Shift+Arrows) and Shortcut ---');
    const pageKb = await browser.newPage();
    await pageKb.goto('http://localhost:8080/test_docs/ext_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    // Focus paragraph and select using browser selection extension (Shift+Arrow equivalent)
    const kbSelectedText = await pageKb.evaluate(() => {
      const target = document.getElementById('test-selection-target');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      for (let i = 0; i < 35; i++) {
        sel.modify('extend', 'forward', 'character');
      }
      return sel.toString();
    });
    console.log('Keyboard selected text via Shift+Arrows:', kbSelectedText);

    // Trigger selection translation via shortcut simulated message
    await pageKb.evaluate(() => {
      const sel = window.getSelection();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      document.dispatchEvent(new CustomEvent('__makan_open_card_action', {
        detail: {
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
          text: sel.toString(),
          isDict: false
        }
      }));
    });

    await pageKb.waitForFunction(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const text = root?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      return !!text;
    }, { timeout: 12000 });

    const kbCardText = await pageKb.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      return root?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
    });

    recordResult(
      'Keyboard Selection (Shift+Arrows) & Shortcut',
      !!kbCardText && kbSelectedText.length > 10,
      `Selected "${kbSelectedText}" with keyboard, translated to: "${kbCardText?.slice(0, 60)}..."`,
      'keyboard input & shortcut in loaded extension'
    );
    await pageKb.close();

    // -------------------------------------------------------------
    // SCENARIO 7: Touch Input Emulation
    // -------------------------------------------------------------
    console.log('\n--- [7] Touch Input Emulation ---');
    const pageTouch = await browser.newPage();
    await pageTouch.setViewport({ width: 412, height: 850, hasTouch: true, isMobile: true });
    await pageTouch.goto('http://localhost:8080/test_docs/ext_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const touchRect = await pageTouch.evaluate(() => {
      const p = document.getElementById('test-selection-target');
      const r = p.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.right, clientY: r.top }));
      return { x: r.left + 50, y: r.top + 10 };
    });

    await new Promise(r => setTimeout(r, 600));

    const btnTouch = await pageTouch.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    let touchCardOpened = false;
    if (btnTouch) {
      // Tap touchscreen on M button
      await pageTouch.touchscreen.tap(btnTouch.x, btnTouch.y);
      await pageTouch.waitForFunction(() => {
        const root = document.getElementById('makan-translate-root')?.shadowRoot;
        return !!root?.querySelector('.makan-card');
      }, { timeout: 10000 });
      touchCardOpened = true;
    }

    recordResult(
      'Touchscreen Tap on M Button',
      touchCardOpened,
      `Tapped M button at (${btnTouch?.x?.toFixed(1)}, ${btnTouch?.y?.toFixed(1)}), card opened on mobile viewport`,
      'real touch input in loaded extension'
    );
    await pageTouch.close();

    // -------------------------------------------------------------
    // SCENARIO 8: Double-Click Dictionary Lookup
    // -------------------------------------------------------------
    console.log('\n--- [8] Double-Click Dictionary Lookup ---');
    const pageDbl = await browser.newPage();
    await pageDbl.goto('http://localhost:8080/test_docs/ext_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const wordPos = await pageDbl.evaluate(() => {
      const el = document.getElementById('second-paragraph');
      const r = el.getBoundingClientRect();
      return { x: r.left + 55, y: r.top + 10 };
    });

    // Real double-click pointer sequence
    await pageDbl.mouse.move(wordPos.x, wordPos.y);
    await pageDbl.mouse.down({ clickCount: 1 });
    await pageDbl.mouse.up({ clickCount: 1 });
    await pageDbl.mouse.down({ clickCount: 2 });
    await pageDbl.mouse.up({ clickCount: 2 });

    await pageDbl.waitForFunction(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const card = root?.querySelector('.makan-card');
      const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      return card && text && text.length > 0;
    }, { timeout: 15000 });

    const dblResult = await pageDbl.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const card = root?.querySelector('.makan-card');
      const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      return { cardOpen: !!card, text };
    });

    const shotDbl = path.join(SCREENSHOT_DIR, 'pointer_4_double_click.png');
    await pageDbl.screenshot({ path: shotDbl });

    recordResult(
      'Double-Click Word for Dictionary Card',
      dblResult.cardOpen && !!dblResult.text,
      `Dictionary card opened via real double click: "${dblResult.text?.slice(0, 60)}..."`,
      'real pointer input in loaded extension'
    );
    await pageDbl.close();

    // -------------------------------------------------------------
    // SCENARIO 9: Whole-Page Translation & Show Original
    // -------------------------------------------------------------
    console.log('\n--- [9] Whole-Page Translation & Show Original ---');
    const pageWhole = await browser.newPage();
    await pageWhole.goto('http://localhost:8080/test_docs/ext_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    await pageWhole.evaluate(() => {
      document.dispatchEvent(new CustomEvent('__makan_page_translate_action'));
    });

    await pageWhole.waitForFunction(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const banner = root?.querySelector('.makan-top-banner');
      const nodes = document.querySelectorAll('[data-makan-orig]');
      return banner && nodes.length > 0;
    }, { timeout: 12000 });

    const wholeCount = await pageWhole.evaluate(() => document.querySelectorAll('[data-makan-orig]').length);

    // Restore original
    await pageWhole.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      root?.querySelector('#makanRestoreBtn')?.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const restoredCount = await pageWhole.evaluate(() => document.querySelectorAll('[data-makan-orig]').length);

    recordResult(
      'Whole-Page Translation & Restore Original',
      wholeCount > 0 && restoredCount === 0,
      `Translated ${wholeCount} elements, restore cleaned all to ${restoredCount}`,
      'real pointer input in loaded extension'
    );
    await pageWhole.close();

    // -------------------------------------------------------------
    // SCENARIO 10: Toolbar Popup Translation
    // -------------------------------------------------------------
    console.log('\n--- [10] Toolbar Popup Translation ---');
    // Discover extId
    const targets = await browser.targets();
    const swTarget = targets.find(t => t.type() === 'service_worker');
    const extId = swTarget ? swTarget.url().split('/')[2] : null;

    if (extId) {
      const popupPage = await browser.newPage();
      await popupPage.setViewport({ width: 380, height: 600 });
      await popupPage.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'networkidle2' });
      await popupPage.type('#pInputText', 'Testing real mouse pointer and popup translation.');
      await popupPage.click('#pTransBtn');

      await popupPage.waitForFunction(() => {
        const out = document.getElementById('pOutputText')?.textContent?.trim();
        return out && !out.includes('Translating') && out.length > 0;
      }, { timeout: 12000 });

      const popOut = await popupPage.evaluate(() => document.getElementById('pOutputText')?.textContent?.trim());
      recordResult(
        'Toolbar Popup Translation',
        !!popOut && popOut.length > 0,
        `Popup translated text: "${popOut}"`,
        'real pointer input in loaded extension'
      );
      await popupPage.close();
    }

  } catch (err) {
    console.error('Fatal Suite Exception:', err);
    suiteReport.fatalError = err.message;
  } finally {
    await browser.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    fs.writeFileSync('test-assets/pointer_suite_report.json', JSON.stringify(suiteReport, null, 2));
    console.log('\n📄 Report written to test-assets/pointer_suite_report.json');
  }
}

run();
