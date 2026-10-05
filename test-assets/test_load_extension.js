const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extPath = path.resolve('extension');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_test_' + Date.now();

console.log('Testing extension loading from:', extPath);

async function main() {
  const chrome = spawn(chromePath, [
    '--remote-debugging-port=9227',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    'about:blank'
  ]);

  try {
    let list = [];
    for (let i = 0; i < 30; i++) {
      try {
        const res = await new Promise((res, rej) => {
          http.get('http://127.0.0.1:9227/json', r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
          }).on('error', rej);
        });
        list = JSON.parse(res);
        if (list.length > 0) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('CDP targets found:', list.map(t => ({ type: t.type, title: t.title, url: t.url })));
    const sw = list.find(t => t.type === 'service_worker' && t.url.includes('background.js'));
    if (sw) {
      console.log('[PASS] Service worker registered and running:', sw.url);
    } else {
      console.log('No service worker target immediately listed in /json; checking extension targets...');
    }

  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
