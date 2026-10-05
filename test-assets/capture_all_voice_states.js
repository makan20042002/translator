const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Makan\\.gemini\\antigravity-ide\\brain\\9730017d-487f-4ddb-8ee7-cfd0a79e2f77';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function waitForCdp(port = 9225, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json`, r => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(data));
        }).on('error', reject);
      });
      const list = JSON.parse(res);
      const page = list.find(x => x.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP not reachable');
}

function sendCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = evt => {
      try {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const configs = [
  { w: 1366, h: 800, lang: 'en' },
  { w: 1366, h: 800, lang: 'fa' },
  { w: 1920, h: 1080, lang: 'en' },
  { w: 1920, h: 1080, lang: 'fa' },
  { w: 390, h: 844, lang: 'en' },
  { w: 390, h: 844, lang: 'fa' }
];

const states = [
  { id: 'ready', msgEn: '', msgFa: '' },
  { id: 'listening', msgEn: 'Listening… speak now', msgFa: 'در حال گوش دادن… اکنون صحبت کنید' },
  { id: 'working', msgEn: 'Translating with Google…', msgFa: 'در حال ترجمه با گوگل…' },
  { id: 'speaking', msgEn: 'Speaking translation…', msgFa: 'در حال خواندن ترجمه…' },
  { id: 'error', msgEn: 'Microphone level too low', msgFa: 'صدای میکروفون بسیار ضعیف است' }
];

async function capture() {
  for (const cfg of configs) {
    console.log(`\n=== Capturing After States for ${cfg.w}x${cfg.h} [${cfg.lang}] ===`);
    const tmpDir = path.join(__dirname, `chrome_prof_after_${cfg.w}_${cfg.lang}`);
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-port=9225',
      `--window-size=${cfg.w},${cfg.h}`,
      '--user-data-dir=' + tmpDir,
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      'http://localhost:8080/index.html'
    ]);

    try {
      const wsUrl = await waitForCdp(9225);
      const ws = new globalThis.WebSocket(wsUrl);
      await new Promise(r => ws.addEventListener('open', r));

      await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
        width: cfg.w,
        height: cfg.h,
        deviceScaleFactor: 1,
        mobile: cfg.w <= 500
      });

      await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
      await new Promise(r => setTimeout(r, 1200));

      // Setup page language and seed conversation
      await sendCdp(ws, 'Runtime.evaluate', {
        expression: `(() => {
          if ('${cfg.lang}' === 'fa') {
            ui = 'fa';
            store.set('ui', 'fa');
          } else {
            ui = 'en';
            store.set('ui', 'en');
          }
          boot();
          const btn = document.querySelector('#tabs button[data-tab="voice"]');
          if (btn) btn.click();

          // Add a sample conversation turn to showcase the bubbles in realistic state
          $('bubbles').innerHTML = '';
          convHistory = [];
          if ('${cfg.lang}' === 'fa') {
            $('src').value = 'fa'; $('tgt').value = 'en';
            $('src').onchange(); $('tgt').onchange();
            addBubble($('bubbles'), 'a', 'سلام، وقت بخیر! قطار بعدی به سمت مرکز شهر چه ساعتی حرکت میکنه؟', 'Hello, good day! What time does the next train to the city center leave?', 'fa', 'en', {
              stt: 'Whisper', engine: 'Google', voice: 'Google US', dur: '0.4s'
            });
            addBubble($('bubbles'), 'b', 'The next train departs from platform 3 in about ten minutes.', 'قطار بعدی حدود ده دقیقه دیگر از سکوی ۳ حرکت می‌کند.', 'en', 'fa', {
              stt: 'Whisper', engine: 'Google', voice: 'Farid', dur: '0.5s'
            });
          } else {
            $('src').value = 'en'; $('tgt').value = 'fa';
            $('src').onchange(); $('tgt').onchange();
            addBubble($('bubbles'), 'a', 'Hello, good day! What time does the next train to the city center leave?', 'سلام، روز بخیر! قطار بعدی به سمت مرکز شهر چه ساعتی حرکت میکنه؟', 'en', 'fa', {
              stt: 'Whisper', engine: 'Google', voice: 'Farid', dur: '0.4s'
            });
            addBubble($('bubbles'), 'b', 'قطار بعدی حدود ده دقیقه دیگر از سکوی ۳ حرکت می‌کند.', 'The next train departs from platform 3 in about ten minutes.', 'fa', 'en', {
              stt: 'Whisper', engine: 'Google', voice: 'Google US', dur: '0.5s'
            });
          }
        })()`,
        returnByValue: true
      });
      await new Promise(r => setTimeout(r, 400));

      for (const st of states) {
        const msg = (cfg.lang === 'fa' ? st.msgFa : st.msgEn);
        await sendCdp(ws, 'Runtime.evaluate', {
          expression: `(() => {
            setVoiceState('${st.id}', ${JSON.stringify(msg)});
            if ('${st.id}' === 'listening') {
              updateMeterLevel(0.45);
              const p = $('vPartial');
              if (p) {
                p.hidden = false;
                p.textContent = '${cfg.lang === 'fa' ? 'آیا این اتوبوس به سمت میدان آزادی میرود؟…' : 'Is this bus heading towards the central square?…'}';
              }
            } else {
              const p = $('vPartial');
              if (p) { p.hidden = true; p.textContent = ''; }
            }
          })()`
        });
        await new Promise(r => setTimeout(r, 250));

        const shot = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
        const filename = `after_voice_${cfg.w}_${cfg.lang}_${st.id}.png`;
        fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), Buffer.from(shot.data, 'base64'));
        fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(shot.data, 'base64'));
        console.log(`Saved ${filename}`);
      }

      ws.close();
    } finally {
      chrome.kill();
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

capture().then(() => console.log('\nAll 30 after screenshots captured successfully!')).catch(console.error);
