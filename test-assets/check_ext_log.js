const fs = require('fs');

const p = 'C:/Users/Makan/AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/fooigdpdhibmfhkgamlpnmnngkmnolba/000003.log';
const buf = fs.readFileSync(p);
const str = buf.toString('latin1');
const idx = str.indexOf('makan_cfg');
console.log('Index:', idx);
if (idx !== -1) {
  const slice = str.slice(idx, idx + 1000);
  const masked = slice.replace(/AIza[0-9A-Za-z\-_]{35}/g, '[MASKED_KEY]').replace(/"key":"[^"]*"/g, '"key":"[MASKED]"');
  console.log('Snippet:\n', masked);
}
