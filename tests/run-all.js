#!/usr/bin/env node
'use strict';
/**
 * `npm test` runs this file. It:
 *   1. builds the extension (node build-manifests.js → dist/chrome, dist/firefox)
 *   2. runs the browser tests (web app + Chrome/Edge extension) with Playwright
 *   3. runs `web-ext lint` on dist/firefox
 *   4. reports what it could not do (Firefox, live services) as SKIPPED
 *   5. prints one plain-language summary and exits with 1 if anything failed
 *
 * Options:  --only=web | --only=ext | --only=firefox     run just one part
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RESULTS = path.join(__dirname, '.results');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';
const want = part => !only || only === part;

const steps = [];          // { name, status: 'passed'|'failed'|'skipped', detail }
const line = (c = '─') => console.log(c.repeat(78));
const env = Object.assign({}, process.env);
// The tests send all browser traffic to a local stub; a system proxy setting
// must not interfere with that, and nothing in the tests needs the internet.
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, Object.assign({ cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts));
}

/* 1. build ---------------------------------------------------------------- */
function build() {
  line('═');
  console.log('STEP 1  Build the extension (node build-manifests.js)');
  line('═');
  const r = run(process.execPath, ['build-manifests.js'], { stdio: 'inherit' });
  const ok = r.status === 0 && fs.existsSync(path.join(ROOT, 'dist/chrome/manifest.json')) && fs.existsSync(path.join(ROOT, 'dist/firefox/manifest.json'));
  steps.push({ name: 'Build dist/chrome and dist/firefox', status: ok ? 'passed' : 'failed', detail: ok ? '' : 'build-manifests.js failed' });
  return ok;
}

/* 2. Playwright ----------------------------------------------------------- */
function playwright() {
  const projects = [];
  if (want('web')) projects.push('web');
  if (want('ext')) projects.push('ext');
  if (!only || only === 'live') projects.push('live');
  if (!projects.length) return;
  line('═');
  console.log(`STEP 2  Browser tests (${projects.join(' + ')}) in Chromium, with a local stand-in for the translation services`);
  line('═');
  fs.rmSync(path.join(RESULTS, 'results.json'), { force: true });
  const cli = require.resolve('@playwright/test/cli');
  const r = run(process.execPath, [cli, 'test', '-c', path.join(__dirname, 'playwright.config.js'), ...projects.map(p => `--project=${p}`)], { stdio: 'inherit' });
  if (!fs.existsSync(path.join(RESULTS, 'results.json'))) {
    steps.push({ name: 'Browser tests', status: 'failed', detail: `Playwright did not produce results (exit code ${r.status})` });
  }
}

/* 3. web-ext lint --------------------------------------------------------- */
function webExtLint() {
  line('═');
  console.log('STEP 3  web-ext lint on dist/firefox (Mozilla\'s add-on checker)');
  line('═');
  const cli = path.join(ROOT, 'node_modules', 'web-ext', 'bin', 'web-ext.js');
  const r = run(process.execPath, [cli, 'lint', '--source-dir', 'dist/firefox', '--output', 'json', '--no-config-discovery']);
  let report = null;
  try { report = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); } catch { /* not JSON */ }
  if (!report) {
    console.log(r.stdout + r.stderr);
    steps.push({ name: 'web-ext lint dist/firefox', status: 'failed', detail: 'could not read web-ext output' });
    return;
  }
  const { errors = [], warnings = [], notices = [] } = report;
  console.log(`errors: ${errors.length}   warnings: ${warnings.length}   notices: ${notices.length}`);
  for (const [kind, list] of [['ERROR', errors], ['WARNING', warnings], ['NOTICE', notices]]) {
    for (const m of list) console.log(`  ${kind}  ${m.file || ''}${m.line ? ':' + m.line : ''}  ${m.code}: ${m.message}`);
  }
  steps.push({
    name: 'web-ext lint dist/firefox',
    status: errors.length ? 'failed' : 'passed',
    detail: `${errors.length} errors, ${warnings.length} warnings, ${notices.length} notices`
  });
}

/* 4. Firefox --------------------------------------------------------------- */
function findFirefox() {
  const candidates = [process.env.FIREFOX_BIN, 'firefox',
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe', 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
    '/Applications/Firefox.app/Contents/MacOS/firefox'].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return { bin: c, version: 'Mozilla Firefox' };
    const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 20000 });
    if (r.status === 0 && /Firefox/i.test(r.stdout)) return { bin: c, version: r.stdout.trim() };
  }
  return null;
}
function firefox() {
  line('═');
  console.log('STEP 4  Firefox');
  line('═');
  const ff = findFirefox();
  if (!ff) {
    console.log('Firefox was not found on this computer (set FIREFOX_BIN to its path if it is installed somewhere unusual).');
    steps.push({ name: 'Firefox: load the extension, popup, selection card', status: 'skipped', detail: 'skipped: Firefox is not installed here' });
    return;
  }
  console.log(`Found ${ff.version}.`);
  console.log('There is no automated Firefox test yet: it could not be written and checked in the environment where this suite was built, because Firefox could not be installed there.');
  console.log('To try the Firefox build by hand:  npx web-ext run --source-dir dist/firefox --firefox "' + ff.bin + '"');
  steps.push({ name: 'Firefox: load the extension, popup, selection card', status: 'skipped', detail: `skipped: no automated Firefox test exists yet (${ff.version} found; see README for the manual check)` });
}

/* 5. summary --------------------------------------------------------------- */
function collectTests() {
  const file = path.join(RESULTS, 'results.json');
  if (!fs.existsSync(file)) return [];
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  const walk = (suite, trail) => {
    for (const s of suite.suites || []) walk(s, s.title && !/\.spec\.js$/.test(s.title) ? [...trail, s.title] : trail);
    for (const spec of suite.specs || []) {
      for (const t of spec.tests) {
        const res = t.results[t.results.length - 1] || {};
        const status = t.status === 'skipped' ? 'skipped' : (res.status === 'passed' ? 'passed' : 'failed');
        const ann = t.annotations || [];
        out.push({
          project: t.projectName,
          file: spec.file,
          title: [...trail, spec.title].join(' › '),
          status,
          seconds: ((res.duration || 0) / 1000).toFixed(1),
          error: (res.error && res.error.message || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 3).join(' / '),
          skipReason: (ann.find(a => a.type === 'skip') || {}).description || '',
          notes: ann.filter(a => a.type !== 'skip').map(a => `${a.type}: ${a.description}`)
        });
      }
    }
  };
  walk(json, []);
  return out;
}

function summary() {
  const tests = collectTests();
  const count = s => tests.filter(t => t.status === s).length;
  line('═');
  console.log('SUMMARY');
  line('═');
  const areas = [['web', 'Web app (index.html)'], ['ext', 'Extension, Chrome/Edge build'], ['live', 'Real services (need keys)']];
  for (const [p, label] of areas) {
    const ts = tests.filter(t => t.project === p);
    if (!ts.length) continue;
    const c = s => ts.filter(t => t.status === s).length;
    console.log(`${label.padEnd(34)} ${String(c('passed')).padStart(3)} passed  ${String(c('failed')).padStart(3)} failed  ${String(c('skipped')).padStart(3)} skipped`);
  }
  for (const s of steps) console.log(`${s.name.padEnd(52)} ${s.status.toUpperCase()}${s.detail ? '  (' + s.detail + ')' : ''}`);
  line();
  console.log(`Browser tests: ${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped (${tests.length} in total)`);

  const failed = tests.filter(t => t.status === 'failed');
  if (failed.length) {
    line();
    console.log('FAILED — each line is something that did not behave as expected:');
    for (const t of failed) {
      console.log(`  ✘ [${t.project}] ${t.title}`);
      if (t.error) console.log(`      ${t.error.slice(0, 300)}`);
      for (const n of t.notes) console.log(`      ${n}`);
    }
  }
  const skipped = tests.filter(t => t.status === 'skipped');
  const skippedSteps = steps.filter(s => s.status === 'skipped');
  if (skipped.length || skippedSteps.length) {
    line();
    console.log('SKIPPED — not tested, so not counted as passed:');
    for (const t of skipped) console.log(`  - [${t.project}] ${t.title}: ${t.skipReason || 'skipped'}`);
    for (const s of skippedSteps) console.log(`  - ${s.name}: ${s.detail}`);
  }
  const notes = tests.filter(t => t.status === 'passed' && t.notes.length);
  if (notes.length) {
    line();
    console.log('Notes recorded by passing tests:');
    for (const t of notes) for (const n of t.notes) console.log(`  - [${t.project}] ${t.title}: ${n}`);
  }
  line('═');
  const bad = failed.length + steps.filter(s => s.status === 'failed').length;
  console.log(bad ? `RESULT: ${bad} problem(s) found. Details above; full report: tests/.results/report.txt` : 'RESULT: everything that ran passed.');
  line('═');
  return bad;
}

/* main --------------------------------------------------------------------- */
const t0 = Date.now();
fs.mkdirSync(RESULTS, { recursive: true });
const built = build();
if (built) {
  playwright();
  if (want('firefox') || !only) { webExtLint(); firefox(); }
}
const original = console.log;
const captured = [];
console.log = (...a) => { captured.push(a.join(' ')); original(...a); };
const problems = summary();
console.log(`(finished in ${Math.round((Date.now() - t0) / 1000)} s)`);
console.log = original;
fs.writeFileSync(path.join(RESULTS, 'report.txt'), captured.join('\n') + '\n');
process.exit(problems ? 1 : 0);
