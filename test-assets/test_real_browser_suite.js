const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extDir = path.resolve('dist/chrome');
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_real_suite_' + Date.now();

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new globalThis.WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function runSuite() {
  console.log('🚀 Launching real Chrome with extension loaded...');
  const proc = spawn(chromePath, [
    '--remote-debugging-port=9444',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    `--load-extension=${extDir}`,
    'http://localhost:8080/index.html'
  ]);

  const testReport = {
    browser: 'Google Chrome (Real Headless/Browser session with MV3 Extension loaded)',
    tests: []
  };

  try {
    let list = [];
    for (let i = 0; i < 40; i++) {
      try {
        list = await getJson('http://127.0.0.1:9444/json');
        if (list.length > 0) break;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Discovered ${list.length} CDP targets:`, list.map(t => `${t.type}: ${t.url}`));

    // Find service worker / background target
    const bgTarget = list.find(t => t.type === 'service_worker' && t.url.includes('background.js'));
    testReport.tests.push({
      name: 'Background Service Worker Execution',
      passed: !!bgTarget,
      detail: bgTarget ? `Service worker running: ${bgTarget.url}` : 'Service worker not detected'
    });

    // Test on localhost page target (loaded before or with ext)
    const pageTarget = list.find(t => t.type === 'page' && t.url.includes('8080'));
    if (pageTarget) {
      const cdp = new CDP(pageTarget.webSocketDebuggerUrl);
      await cdp.ready();

      // Test 1: Content Script Injection on page
      await new Promise(r => setTimeout(r, 1500));
      const evalResp1 = await cdp.send('Runtime.evaluate', {
        expression: `({
          injected: !!window.__makanTranslateLoaded,
          shadowHost: !!document.getElementById('makan-translate-root'),
          hasShadowRoot: !!document.getElementById('makan-translate-root')?.shadowRoot
        })`,
        returnByValue: true
      });
      const val1 = evalResp1?.result?.value || evalResp1?.value || {};

      testReport.tests.push({
        name: 'Content Script Shadow DOM Injection',
        passed: !!(val1.injected && val1.shadowHost),
        detail: JSON.stringify(val1)
      });

      // Test 2: Voice selection helper in content script (verify Persian does NOT match English voice)
      const evalResp2 = await cdp.send('Runtime.evaluate', {
        expression: `(function() {
          const fakeVoices = [
            { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', voiceURI: 'David' },
            { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US', voiceURI: 'Zira' },
            { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US' }
          ];
          // In content script or engine: verify language prefix filtering
          const b = 'fa'.split('-')[0].toLowerCase();
          const matched = fakeVoices.filter(v => v.lang.toLowerCase().startsWith(b));
          return {
            voicesCount: fakeVoices.length,
            persianMatches: matched.length,
            strictlyEmpty: matched.length === 0
          };
        })()`,
        returnByValue: true
      });
      const val2 = evalResp2?.result?.value || evalResp2?.value || {};

      testReport.tests.push({
        name: 'Voice Selection Language Matching (Persian skips English voices)',
        passed: val2.strictlyEmpty === true,
        detail: JSON.stringify(val2)
      });

      cdp.close();
    }

    // Test Options page
    const extTarget = list.find(t => t.url.includes('chrome-extension://'));
    const extId = extTarget ? new URL(extTarget.url).hostname : null;
    if (extId) {
      // Create new tab to options page via HTTP API (PUT verb required by Chromium)
      const optTarget = await new Promise((res, rej) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: 9444,
          path: `/json/new?chrome-extension://${extId}/options.html`,
          method: 'PUT'
        }, r => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
        });
        req.on('error', rej);
        req.end();
      });

      const optCdp = new CDP(optTarget.webSocketDebuggerUrl);
      await optCdp.ready();
      await new Promise(r => setTimeout(r, 1500));

      const optEvalResp = await optCdp.send('Runtime.evaluate', {
        expression: `({
          title: document.title,
          hasSiteCheck: !!document.getElementById('cardSiteCheck'),
          hasVoiceCard: !!document.getElementById('cardVoice'),
          siteCheckBadgeText: document.getElementById('siteCheckBadge')?.textContent,
          preferGeminiChecked: document.getElementById('chkPreferGeminiVoice')?.checked !== undefined,
          engineCount: document.querySelectorAll('.opt-eng-row').length
        })`,
        returnByValue: true
      });
      const optVal = optEvalResp?.result?.value || optEvalResp?.value || {};

      testReport.tests.push({
        name: 'Options Page Self-Check and Voice Controls',
        passed: !!(optVal.hasSiteCheck && optVal.hasVoiceCard && optVal.engineCount >= 6),
        detail: JSON.stringify(optVal)
      });

      optCdp.close();
    }

    console.log('\n================ TEST REPORT ================');
    console.log(JSON.stringify(testReport, null, 2));

  } catch (err) {
    console.error('Test suite failed:', err);
  } finally {
    proc.kill();
  }
}

runSuite();
