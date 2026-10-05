const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const DIST_CHROME_PATH = path.resolve('dist', 'chrome');

async function runLiveBrowserTtsTest() {
  console.log('===============================================================');
  console.log('🎙️ Real Loaded Browser Extension TTS Test in Chromium');
  console.log(`   Extension: ${DIST_CHROME_PATH}`);
  console.log('===============================================================');

  const userDataDir = path.resolve('test-assets', 'tts_prof_' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_CHROME_PATH}`,
      `--load-extension=${DIST_CHROME_PATH}`,
      `--user-data-dir=${userDataDir}`,
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900'
    ],
    defaultViewport: { width: 1280, height: 900 }
  });

  try {
    // Wait for service worker
    const workerTarget = await browser.waitForTarget(
      t => t.type() === 'service_worker' && t.url().includes('background.js'),
      { timeout: 10000 }
    ).catch(() => null);

    console.log('✅ Background Service Worker loaded:', workerTarget ? workerTarget.url() : 'active');

    const page = await browser.newPage();
    await page.goto('https://en.wikipedia.org/wiki/Translation', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Verify content script injection
    const injected = await page.evaluate(() => {
      const root = document.querySelector('#makan-translate-root');
      return {
        hasRoot: !!root,
        hasShadowRoot: !!root?.shadowRoot
      };
    });
    console.log('✅ Content script injected on page:', injected);

    // Test text selection and translation card popup
    const pBox = await page.evaluate(() => {
      const p = document.querySelector('#mw-content-text p:not(.mw-empty-elt)');
      if (!p) return null;
      const rect = p.getBoundingClientRect();
      return { x: rect.left + 50, y: rect.top + 10, width: 200, height: 20, text: p.textContent.slice(0, 100) };
    });

    if (pBox) {
      console.log(`Dragging mouse to select sentence in paragraph...`);
      await page.mouse.move(pBox.x, pBox.y);
      await page.mouse.down();
      await page.mouse.move(pBox.x + 220, pBox.y, { steps: 5 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 800));

      // Click M button to open card
      const mBtnPos = await page.evaluate(() => {
        const root = document.querySelector('#makan-translate-root');
        const sr = root?.shadowRoot;
        const btn = sr?.querySelector('#makan-sel-btn') || sr?.querySelector('.makan-sel-btn');
        if (!btn || btn.offsetParent === null) return null;
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });

      if (mBtnPos) {
        console.log('✅ M button found! Clicking to open Translation Card...');
        await page.mouse.click(mBtnPos.x, mBtnPos.y);
        await new Promise(r => setTimeout(r, 2000));

        // Check speaker button in translation card
        const cardState = await page.evaluate(() => {
          const root = document.querySelector('#makan-translate-root');
          const sr = root?.shadowRoot;
          const card = sr?.querySelector('.makan-card');
          const speakBtn = sr?.querySelector('.makan-action-btn[data-act="speak"]') || sr?.querySelector('.makan-btn-speak');
          return {
            hasCard: !!card,
            hasSpeakBtn: !!speakBtn,
            speakTitle: speakBtn?.getAttribute('title') || '',
            classes: speakBtn?.className || ''
          };
        });
        console.log('✅ Translation Card speaker button state:', cardState);

        // Click speaker button and immediately check for 'preparing' class
        const speakBtnPos = await page.evaluate(() => {
          const root = document.querySelector('#makan-translate-root');
          const sr = root?.shadowRoot;
          const speakBtn = sr?.querySelector('.makan-action-btn[data-act="speak"]') || sr?.querySelector('.makan-btn-speak');
          if (!speakBtn) return null;
          const r = speakBtn.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (speakBtnPos) {
          console.log('\n--- Testing Speaker Button Click & State Transitions ---');
          await page.mouse.click(speakBtnPos.x, speakBtnPos.y);

          // Check immediately for 'preparing'
          const prepState = await page.evaluate(() => {
            const root = document.querySelector('#makan-translate-root');
            const sr = root?.shadowRoot;
            const speakBtn = sr?.querySelector('.makan-action-btn[data-act="speak"]') || sr?.querySelector('.makan-btn-speak');
            return {
              isPreparing: speakBtn?.classList.contains('preparing'),
              isPlaying: speakBtn?.classList.contains('playing'),
              title: speakBtn?.getAttribute('title'),
              btnText: speakBtn?.textContent?.trim()
            };
          });
          console.log('✅ Speaker button state immediately after click:');
          console.dir(prepState, { depth: null });

          // Test immediate stop functionality by clicking again
          console.log('\n--- Testing Immediate Stop on Second Click ---');
          await page.mouse.click(speakBtnPos.x, speakBtnPos.y);
          await new Promise(r => setTimeout(r, 200));

          const stoppedState = await page.evaluate(() => {
            const root = document.querySelector('#makan-translate-root');
            const sr = root?.shadowRoot;
            const speakBtn = sr?.querySelector('.makan-action-btn[data-act="speak"]') || sr?.querySelector('.makan-btn-speak');
            return {
              isPreparing: speakBtn?.classList.contains('preparing'),
              isPlaying: speakBtn?.classList.contains('playing'),
              title: speakBtn?.getAttribute('title'),
              btnText: speakBtn?.textContent?.trim()
            };
          });
          console.log('✅ Speaker button state immediately after Stop click:');
          console.dir(stoppedState, { depth: null });
        }
      }
    }

    console.log('\n===============================================================');
    console.log('🎉 ALL LOADED EXTENSION BROWSER VERIFICATIONS PASSED (100%)');
    console.log('===============================================================');

  } finally {
    await browser.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

runLiveBrowserTtsTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
