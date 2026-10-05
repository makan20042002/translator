const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getKeyInMemory() {
  const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
  if (fs.existsSync(p)) {
    const str = fs.readFileSync(p, 'latin1');
    const lastIdx = str.lastIndexOf('makan_cfg');
    if (lastIdx !== -1) {
      const jsonStart = str.indexOf('{', lastIdx);
      let depth = 0, jsonEnd = -1;
      for (let i = jsonStart; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
      }
      if (jsonEnd !== -1) {
        const cfg = JSON.parse(str.slice(jsonStart, jsonEnd));
        if (cfg.eng?.gemini?.key) return cfg.eng.gemini.key;
      }
    }
  }
  throw new Error('Key not found');
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function debugIndex() {
  const key = getKeyInMemory();
  const chromePath = 'C:\\Users\\Makan\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  const extDir = path.resolve('dist/chrome');
  const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\pw_debug_' + Date.now();

  const p = spawn(chromePath, [
    '--remote-debugging-port=9470',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--load-extension=${extDir}`,
    'http://localhost:8080/index.html'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const targets = await getJson('http://127.0.0.1:9470/json');
  console.log('Targets:', targets.map(t => `${t.type}: ${t.url}`));

  const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8080'));
  const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const send = (method, params = {}) => {
    return new Promise(res => {
      const id = msgId++;
      const onMsg = e => {
        const d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', onMsg);
          res(d.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Console.enable');

  ws.addEventListener('message', e => {
    const d = JSON.parse(e.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', d.params.type, d.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  const s1 = 'ترجمه، فرایند انتقال معنا از یک زبان به زبان دیگر به روشی وفادار و روان است.';
  const s2 = 'این فرایند نقشی حیاتی در ارتباطات میان‌فرهنگی و تبادل دانش در سراسر جهان ایفا می‌کند.';
  const s3 = 'با پیشرفت‌های اخیر در هوش مصنوعی، ابزارهای ترجمه بسیار دقیق‌تر و در دسترس‌تر شده‌اند.';
  const fullText = `${s1} ${s2} ${s3}`;

  // Configure index.html
  const evalRes = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `
      (async () => {
        console.log("Checking engine functions:");
        console.log("streamGeminiTts:", typeof streamGeminiTts);
        console.log("GeminiAudioStreamPlayer:", typeof GeminiAudioStreamPlayer);
        console.log("cfg:", typeof cfg);

        cfg.eng.gemini.key = ${JSON.stringify(key)};
        cfg.eng.gemini.on = true;
        cfg.tts.mode = 'gemini';
        cfg.tts.model = 'gemini-3.8-flash-lite-tts';
        cfg.tts.voice = 'Kore';
        cfg.tts.rate = 1.0;
        saveCfg();

        $('tgt').value = 'fa';
        $('tOut').value = ${JSON.stringify(fullText)};

        const tBtn = $('tSpeak');
        console.log("Initial tSpeak classes:", tBtn.className);

        const t0 = performance.now();
        let tPrep = null, tPlay = null;
        const obs = new MutationObserver(() => {
          const now = performance.now() - t0;
          if (tBtn.classList.contains('preparing') && tPrep === null) {
            tPrep = now;
            console.log("Observed preparing at:", Math.round(tPrep), "ms");
          }
          if (tBtn.classList.contains('playing') && tPlay === null) {
            tPlay = now;
            console.log("Observed playing at:", Math.round(tPlay), "ms");
          }
        });
        obs.observe(tBtn, { attributes: true, attributeFilter: ['class'] });

        console.log("Clicking tSpeak...");
        tBtn.click();

        for (let i = 0; i < 100; i++) {
          if (tPlay !== null) break;
          await new Promise(r => setTimeout(r, 100));
        }
        obs.disconnect();

        console.log("Result: tPrep =", tPrep, "tPlay =", tPlay);
        return { tPrep: Math.round(tPrep), tPlay: Math.round(tPlay) };
      })()
    `
  });

  console.log('Eval result:', evalRes);

  p.kill();
  process.exit(0);
}

debugIndex().catch(e => {
  console.error(e);
  process.exit(1);
});
