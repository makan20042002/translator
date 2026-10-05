const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function test() {
  const extPath = path.resolve('extension');
  console.log('Loading unpacked extension from:', extPath);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--no-sandbox'
    ],
    ignoreDefaultArgs: ['--disable-extensions']
  });

  try {
    const page = await browser.newPage();
    
    // Inspect service worker target
    const targets = await browser.targets();
    console.log('Targets found:', targets.map(t => `${t.type()}: ${t.url()}`));
    
    const swTarget = targets.find(t => t.type() === 'service_worker');
    console.log('Service worker target:', swTarget ? swTarget.url() : 'NONE');

    // Go to chrome://extensions
    await page.goto('chrome://extensions', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'test-assets/chrome_extensions_unpacked.png', fullPage: true });
    console.log('Screenshot of chrome://extensions saved to test-assets/chrome_extensions_unpacked.png');
    
  } finally {
    await browser.close();
  }
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
