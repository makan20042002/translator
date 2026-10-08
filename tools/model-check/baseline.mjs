// Memory of an idle Chromium with the app open and settings shown (no model loaded): subtracted from model figures.
import fs from 'node:fs';
import path from 'node:path';
import { openApp, here } from './harness.mjs';
const app = await openApp(process.argv[2]);
await app.page.goto(app.origin + '/index.html', { waitUntil: 'domcontentloaded' });
await app.page.click('#openSet');
await app.page.waitForTimeout(4000);
app.peakMB();
await app.page.waitForTimeout(6000);
const mb = app.peakMB();
fs.writeFileSync(path.join(here, 'results/baseline.json'), JSON.stringify({ idleBrowserWithAppMB: mb }) + '\n');
console.log('idle browser with the app open: ' + mb + ' MB');
await app.close();
