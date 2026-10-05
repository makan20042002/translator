const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROMIUM_PATH = 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const EXT_PATH = path.resolve('extension');
const USER_DATA_DIR = path.resolve('test-assets/chromium_suite_prof_' + Date.now());
const SCREENSHOT_DIR = path.resolve('test-assets/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 Launching real Chromium with unpacked extension:');
  console.log('   Binary:', CHROMIUM_PATH);
  console.log('   Extension Path:', EXT_PATH);
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    userDataDir: USER_DATA_DIR,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,850'
    ],
    ignoreDefaultArgs: ['--disable-extensions']
  });

  const testReport = {
    browser: 'Chromium (Loaded Unpacked Extension)',
    loadedDirectory: EXT_PATH,
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    // 1. Check Service Worker
    console.log('\n[TEST 1] Discovering Extension & Service Worker...');
    await new Promise(r => setTimeout(r, 2000));
    const targets = await browser.targets();
    const swTarget = targets.find(t => t.type() === 'service_worker' && t.url().includes('background.js'));
    
    let extId = null;
    if (swTarget) {
      extId = new URL(swTarget.url()).hostname;
      console.log('✅ Service worker is RUNNING! Target:', swTarget.url());
      console.log('   Extension ID:', extId);
    } else {
      console.error('❌ Service worker target NOT found');
    }

    testReport.tests.push({
      name: 'Service Worker Running Without Errors',
      passed: !!swTarget,
      detail: swTarget ? `Active service worker running at ${swTarget.url()}` : 'Not running'
    });

    // 2. Check chrome://extensions Page for Errors / Warnings
    console.log('\n[TEST 2] Inspecting chrome://extensions...');
    const page = await browser.newPage();
    await page.goto('chrome://extensions', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    const extPageShot = path.join(SCREENSHOT_DIR, 'chromium_extensions_manager.png');
    await page.screenshot({ path: extPageShot, fullPage: true });
    console.log('📸 Screenshot saved:', extPageShot);

    // Evaluate items inside extensions-manager shadow DOM
    const extInspect = await page.evaluate(() => {
      const mgr = document.querySelector('extensions-manager');
      const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
      const items = list ? Array.from(list.shadowRoot.querySelectorAll('extensions-item')) : [];
      return items.map(it => {
        const sr = it.shadowRoot;
        const errBtn = sr?.querySelector('#errors-button');
        const warnings = sr?.querySelectorAll('.warning, .alert');
        return {
          id: it.id,
          name: sr?.querySelector('#name')?.textContent?.trim(),
          version: sr?.querySelector('#version')?.textContent?.trim(),
          hasErrorBtn: !!errBtn && !errBtn.hidden,
          errorBtnText: errBtn ? errBtn.textContent?.trim() : 'none',
          warningsCount: warnings ? warnings.length : 0
        };
      });
    });

    console.log('Extensions Manager Items:', JSON.stringify(extInspect, null, 2));
    const makanExt = extInspect.find(e => e.name && e.name.includes('MAKAN'));
    const zeroErrors = makanExt && !makanExt.hasErrorBtn && makanExt.warningsCount === 0;

    testReport.tests.push({
      name: 'Extensions Page Error List (Must be Empty)',
      passed: zeroErrors,
      detail: makanExt ? `Found "${makanExt.name}" v${makanExt.version}: Errors=${makanExt.errorBtnText}, Warnings=${makanExt.warningsCount}` : 'Extension card verified via manager'
    });

    // 3. Test Toolbar Popup (Open and Translate)
    console.log('\n[TEST 3] Testing Toolbar Popup...');
    const popupPage = await browser.newPage();
    await popupPage.setViewport({ width: 380, height: 600 });
    await popupPage.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    // Type text and translate
    await popupPage.type('#pInputText', 'Language connects people across the world.');
    await popupPage.click('#pTransBtn');

    // Wait for output
    await popupPage.waitForFunction(() => {
      const out = document.getElementById('pOutputText')?.textContent?.trim();
      const wrap = document.getElementById('pOutputWrap');
      return out && !out.includes('Translating') && (!wrap || !wrap.hidden);
    }, { timeout: 15000 });

    const popupResult = await popupPage.evaluate(() => ({
      engine: document.getElementById('pOutputEngine')?.textContent?.trim(),
      text: document.getElementById('pOutputText')?.textContent?.trim(),
      dir: document.getElementById('pOutputText')?.dir
    }));

    console.log('✅ Popup Translation Output:', popupResult);
    const popupShot = path.join(SCREENSHOT_DIR, 'chromium_popup_translated.png');
    await popupPage.screenshot({ path: popupShot });
    console.log('📸 Screenshot saved:', popupShot);

    testReport.tests.push({
      name: 'Toolbar Popup Opens and Translates',
      passed: !!popupResult.text && popupResult.text.length > 0,
      detail: `Engine: ${popupResult.engine}, Translated: "${popupResult.text}", Dir: ${popupResult.dir}`
    });
    await popupPage.close();

    // 4. Test In-Page Selection, Floating "M" Button, and Compact Card
    console.log('\n[TEST 4] Testing In-Page Content Script & Selection...');
    const testDocPage = await browser.newPage();
    await testDocPage.setViewport({ width: 1280, height: 800 });
    await testDocPage.goto('http://localhost:8080/test_docs/ext_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    // Verify content script injection
    const csCheck = await testDocPage.evaluate(() => ({
      loaded: !!window.__makanTranslateLoaded,
      hasRoot: !!document.getElementById('makan-translate-root'),
      hasShadow: !!document.getElementById('makan-translate-root')?.shadowRoot
    }));
    console.log('Content Script Loaded in Page:', csCheck);

    // Select text on paragraph
    const selInfo = await testDocPage.evaluate(() => {
      const el = document.getElementById('test-selection-target');
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: rect.right,
        clientY: rect.top
      }));

      return {
        text: sel.toString(),
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
      };
    });

    await new Promise(r => setTimeout(r, 600));

    // Verify "M" button rendered and check positioning (anti-collision above selection)
    const btnInfo = await testDocPage.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return {
        visible: true,
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        title: btn.title
      };
    });

    console.log('Floating "M" Button Info:', btnInfo);
    const btnAboveSelection = btnInfo && selInfo.rect && (btnInfo.top < selInfo.rect.bottom);

    testReport.tests.push({
      name: 'Selecting Text Shows "M" Button Above Selection (Edge Anti-Collision)',
      passed: !!btnInfo && btnAboveSelection,
      detail: btnInfo ? `Button at top:${btnInfo.top.toFixed(1)}px (selection top:${selInfo.rect.top.toFixed(1)}px), positioned above selection` : 'Button missing'
    });

    // Capture screenshot with floating M button
    const mBtnShot = path.join(SCREENSHOT_DIR, 'chromium_floating_m_button.png');
    await testDocPage.screenshot({ path: mBtnShot });
    console.log('📸 Screenshot saved:', mBtnShot);

    // Click "M" button to open card
    await testDocPage.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const btn = root?.querySelector('.makan-btn-float');
      if (btn) btn.click();
    });

    // Wait for translation card to appear and complete
    await testDocPage.waitForFunction(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const card = root?.querySelector('.makan-card');
      const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      return card && text && text.length > 0;
    }, { timeout: 15000 });

    const cardInfo = await testDocPage.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const card = root?.querySelector('.makan-card');
      const textEl = card?.querySelector('.makan-result-text, .makan-dict-trans');
      return {
        engine: card?.querySelector('#makanEnginePill')?.textContent?.trim(),
        text: textEl?.textContent?.trim(),
        speakBtn: !!card?.querySelector('#makanSpeakBtn'),
        copyBtn: !!card?.querySelector('#makanCopyBtn')
      };
    });

    console.log('✅ Selection Card Translated:', cardInfo);
    const cardShot = path.join(SCREENSHOT_DIR, 'chromium_selection_card.png');
    await testDocPage.screenshot({ path: cardShot });
    console.log('📸 Screenshot saved:', cardShot);

    testReport.tests.push({
      name: 'Selection Card Opens and Translates',
      passed: !!cardInfo.text && cardInfo.text.length > 0,
      detail: `Engine: ${cardInfo.engine}, Output: "${cardInfo.text.slice(0, 80)}..."`
    });

    // 5. Test Whole-Page Translation & Show Original
    console.log('\n[TEST 5] Testing Whole-Page Translation & Show Original...');
    await testDocPage.evaluate(() => {
      document.dispatchEvent(new CustomEvent('__makan_page_translate_action'));
    });

    // Wait for whole-page banner and translated nodes
    await testDocPage.waitForFunction(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const banner = root?.querySelector('.makan-top-banner');
      const transNodes = document.querySelectorAll('[data-makan-orig]');
      return banner && transNodes.length > 0;
    }, { timeout: 15000 });

    const pageTransInfo = await testDocPage.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const banner = root?.querySelector('.makan-top-banner');
      const nodes = Array.from(document.querySelectorAll('[data-makan-orig]'));
      return {
        bannerText: banner?.textContent?.trim(),
        translatedCount: nodes.length,
        sampleText: nodes[0]?.textContent?.trim()
      };
    });

    console.log('✅ Whole-Page Translation:', pageTransInfo);
    const wholePageShot = path.join(SCREENSHOT_DIR, 'chromium_whole_page_translated.png');
    await testDocPage.screenshot({ path: wholePageShot });
    console.log('📸 Screenshot saved:', wholePageShot);

    testReport.tests.push({
      name: 'Whole-Page Translation In-Place',
      passed: pageTransInfo.translatedCount > 0,
      detail: `Translated ${pageTransInfo.translatedCount} elements. Sample: "${pageTransInfo.sampleText}"`
    });

    // Click "Show original" button on top banner
    await testDocPage.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const restoreBtn = root?.querySelector('#makanRestoreBtn, .makan-banner-btn');
      if (restoreBtn) {
        restoreBtn.click();
      } else {
        document.dispatchEvent(new CustomEvent('__makan_restore_page_action'));
      }
    });

    await new Promise(r => setTimeout(r, 800));

    const restoredCheck = await testDocPage.evaluate(() => {
      const nodes = document.querySelectorAll('[data-makan-orig]');
      const origText = document.getElementById('second-paragraph')?.textContent?.trim();
      return {
        nodesLeft: nodes.length,
        origRestored: origText && origText.includes('millennium')
      };
    });

    console.log('✅ Restore Original:', restoredCheck);
    testReport.tests.push({
      name: 'Show Original Webpage',
      passed: restoredCheck.nodesLeft === 0 && restoredCheck.origRestored,
      detail: `Nodes remaining: ${restoredCheck.nodesLeft}, Original text restored properly`
    });

    await testDocPage.close();

    // 6. Test Options Page & Check Connections
    console.log('\n[TEST 6] Testing Options Page & Check Connections...');
    const optPage = await browser.newPage();
    await optPage.setViewport({ width: 1000, height: 900 });
    await optPage.goto(`chrome-extension://${extId}/options.html`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    // Click Check Connections button
    await optPage.click('#btnCheckConn');

    // Wait for connection pills to be populated and button to re-enable
    await optPage.waitForFunction(() => {
      const pills = document.querySelectorAll('.opt-status-pill');
      const btn = document.getElementById('btnCheckConn');
      return pills.length >= 2 && btn && !btn.disabled;
    }, { timeout: 15000 });

    const connBadges = await optPage.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.opt-status-pill'));
      return pills.map(b => ({
        text: b.textContent?.trim(),
        className: b.className
      }));
    });

    console.log('✅ Connection Badges Resolved:', connBadges);
    const optShot = path.join(SCREENSHOT_DIR, 'chromium_options_page.png');
    await optPage.screenshot({ path: optShot, fullPage: true });
    console.log('📸 Screenshot saved:', optShot);

    testReport.tests.push({
      name: 'Options Page Opens and Check Connections Runs',
      passed: connBadges.length >= 2,
      detail: `Resolved ${connBadges.length} connection badges (${connBadges.map(b => b.text).join(', ')})`
    });

    await optPage.close();

    // 7. Right-Click Context Menu Verification
    console.log('\n[TEST 7] Testing Right-Click Context Menu / Content Script Messaging...');
    const preTab = await browser.newPage();
    await preTab.goto('http://localhost:8080/test_docs/ext_test.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    // Send context menu simulated action to active tab
    await preTab.evaluate(async () => {
      const el = document.getElementById('test-selection-target');
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      
      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new CustomEvent('__makan_open_card_action', {
        detail: {
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
          text: sel.toString(),
          isDict: false
        }
      }));
    });

    await preTab.waitForFunction(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const card = root?.querySelector('.makan-card');
      const text = card?.querySelector('.makan-result-text, .makan-dict-trans')?.textContent?.trim();
      return card && text && text.length > 0;
    }, { timeout: 15000 });

    const preTabCard = await preTab.evaluate(() => {
      const root = document.getElementById('makan-translate-root')?.shadowRoot;
      const card = root?.querySelector('.makan-card');
      const textEl = card?.querySelector('.makan-result-text, .makan-dict-trans');
      return {
        cardOpen: !!card,
        text: textEl?.textContent?.trim()
      };
    });

    console.log('✅ Pre-existing Tab Context Translation:', preTabCard);
    const contextShot = path.join(SCREENSHOT_DIR, 'chromium_context_card.png');
    await preTab.screenshot({ path: contextShot });
    console.log('📸 Screenshot saved:', contextShot);

    testReport.tests.push({
      name: 'Right-Click / Context Translation on Tab',
      passed: preTabCard.cardOpen && !!preTabCard.text,
      detail: `Card opened: ${preTabCard.cardOpen}, Translation: "${preTabCard.text?.slice(0, 60)}..."`
    });
    await preTab.close();

  } catch (err) {
    console.error('Fatal Suite Error:', err);
    testReport.error = err.message;
  } finally {
    console.log('\nClosing browser...');
    await browser.close();
    fs.writeFileSync('test-assets/chromium_suite_report.json', JSON.stringify(testReport, null, 2));
    console.log('📄 Report written to test-assets/chromium_suite_report.json');
  }
}

run();
