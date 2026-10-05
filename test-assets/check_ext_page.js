const http = require('http');
const { spawn } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extPath = 'c:\\Users\\Makan\\Desktop\\translator\\extension';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_ext_diag';

const proc = spawn(chromePath, [
  '--remote-debugging-port=9889',
  '--user-data-dir=' + tmpDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=' + extPath,
  'about:blank'
]);

setTimeout(async () => {
  try {
    const list = await new Promise(r => http.get('http://127.0.0.1:9889/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }));
    const page = list.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'chrome://extensions' } }));
    await new Promise(r => setTimeout(r, 2000));

    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: 'location.href',
        returnByValue: true
      }
    }));
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 2) {
        console.log('Extensions Page location:', d.result);
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Try to inspect extensions-manager
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const mgr = document.querySelector('extensions-manager');
          if (!mgr) return 'No extensions-manager element';
          const list = mgr.shadowRoot ? mgr.shadowRoot.querySelector('extensions-item-list') : null;
          if (!list) return 'No extensions-item-list';
          const items = list.shadowRoot ? Array.from(list.shadowRoot.querySelectorAll('extensions-item')) : [];
          return items.map(i => ({
            id: i.id,
            name: i.shadowRoot?.querySelector('#name')?.textContent,
            desc: i.shadowRoot?.querySelector('#description')?.textContent,
            errors: i.shadowRoot?.querySelector('#errors')?.textContent
          }));
        })()`,
        returnByValue: true
      }
    }));

    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.id === 3) {
        console.log('Extensions item result:', JSON.stringify(d.result?.value, null, 2));
        ws.close();
        proc.kill();
      }
    });

  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2500);
