const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_doc_shot';

async function main() {
  const chrome = spawn(chromePath, [
    '--remote-debugging-port=9226',
    '--user-data-dir=' + tmpDir,
    '--headless=new',
    '--window-size=1280,1150',
    'http://localhost:8080'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await new Promise((res, rej) => {
          http.get('http://127.0.0.1:9226/json', r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
          }).on('error', rej);
        });
        const list = JSON.parse(res);
        const p = list.find(x => x.type === 'page');
        if (p && p.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!wsUrl) throw new Error('CDP not ready');
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (m, p = {}) => new Promise((res, rej) => {
      const curId = id++;
      const handler = evt => {
        const resp = JSON.parse(evt.data);
        if (resp.id === curId) { ws.removeEventListener('message', handler); res(resp.result); }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method: m, params: p }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 1200));

    await send('Runtime.evaluate', { expression: `
      document.querySelector('[data-tab=doc]').click();
      document.getElementById('dWork').hidden = false;
      document.getElementById('docSubjectCard').hidden = false;
      document.getElementById('dFileName').textContent = 'realistic_word_25p.docx';
      document.getElementById('dBadge').textContent = 'DOCX';
      document.getElementById('dSizePill').textContent = '~52 pages · 9,172 words';
      document.getElementById('dInfo').textContent = '688 segments';
      document.getElementById('docSubjectField').value = 'Cloud Infrastructure & High-Performance Distributed Systems';
      document.getElementById('docRegister').value = 'Technical / Specialized';
      renderDocTerms([
        {s: 'kernel', t: 'هسته'},
        {s: 'thread', t: 'نخ'},
        {s: 'cache line', t: 'خط حافظه نهان (Cache Line)'},
        {s: 'bus', t: 'گذرگاه'},
        {s: 'throughput', t: 'توان عملیاتی'}
      ]);
    ` });
    await new Promise(r => setTimeout(r, 600));

    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:/Users/Makan/.gemini/antigravity-ide/brain/311477a6-aa18-48f9-a76a-48d82f5afb72/after_doc_tab_options.png', Buffer.from(data, 'base64'));
    console.log('Saved after_doc_tab_options.png');
    ws.close();
  } finally {
    chrome.kill();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
