'use strict';

/**
 * tests/tools/verify-model-catalog.test.js
 * ITEM 4: Catalog verification tool and candidates catalog tests using node:test.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TOOL_PATH = path.join(REPO_ROOT, 'tools', 'verify-model-catalog.js');
const CATALOG_PATH = path.join(REPO_ROOT, 'models-catalog.js');
const CANDIDATES_PATH = path.join(REPO_ROOT, 'tools', 'model-candidates.json');

const { loadRealCatalog, loadCandidates } = require('../../tools/verify-model-catalog');
const { buildWeb } = require('../../tools/build-web');

test('tools/verify-model-catalog.js --offline-selftest reports all good on good fixtures and exits 0', () => {
  const res = spawnSync(process.execPath, [TOOL_PATH, '--offline-selftest', '--fixture=good'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.strictEqual(res.status, 0, `Expected exit 0, got ${res.status}. Output: ${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /onnx-community\/whisper-tiny/i);
  assert.match(res.stdout, /YES/);
});

test('tools/verify-model-catalog.js --offline-selftest reports missing file correctly and exits 1', () => {
  const res = spawnSync(process.execPath, [TOOL_PATH, '--offline-selftest', '--fixture=missing-file'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.strictEqual(res.status, 1, `Expected exit 1, got ${res.status}. Output: ${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /missing-weight\.onnx/i);
});

test('tools/verify-model-catalog.js --offline-selftest reports missing repo correctly and exits 1', () => {
  const res = spawnSync(process.execPath, [TOOL_PATH, '--offline-selftest', '--fixture=missing-repo'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.strictEqual(res.status, 1, `Expected exit 1, got ${res.status}. Output: ${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /nonexistent-org\/missing-model-repo/i);
  assert.match(res.stdout, /NO/);
});

test('models-catalog.js parses and every entry has repo, name, and files array', () => {
  assert.ok(fs.existsSync(CATALOG_PATH), 'models-catalog.js must exist');
  const realModels = loadRealCatalog(CATALOG_PATH);

  assert.ok(Array.isArray(realModels), 'models must be an array');
  assert.ok(realModels.length > 5, 'models array must contain entries');

  for (const m of realModels) {
    assert.ok(m.repo, `Model ${m.id || 'unnamed'} must have a repo`);
    assert.ok(m.name, `Model ${m.repo} must have a name`);
    assert.ok(Array.isArray(m.files) && m.files.length > 0, `Model ${m.repo} must have non-empty files array`);

    for (const f of m.files) {
      const fileName = Array.isArray(f) ? f[0] : f;
      const fileSize = Array.isArray(f) ? f[1] : 0;
      assert.ok(typeof fileName === 'string' && fileName.length > 0, `File entry in ${m.repo} must have valid filename`);
      assert.ok(typeof fileSize === 'number' && fileSize >= 0, `File size in ${m.repo} must be a number`);
    }
  }
});

test('tools/model-candidates.json parses, every entry has verified: false, and none of its repos appears in models-catalog.js', () => {
  assert.ok(fs.existsSync(CANDIDATES_PATH), 'tools/model-candidates.json must exist');
  const candidates = loadCandidates(CANDIDATES_PATH);

  assert.ok(Array.isArray(candidates), 'model-candidates.json must be an array');
  assert.ok(candidates.length >= 4, 'Must have at least 4 candidate models');

  const realModels = loadRealCatalog(CATALOG_PATH);
  const realRepos = new Set(realModels.map(m => m.repo));

  for (const c of candidates) {
    assert.strictEqual(c.verified, false, `Candidate ${c.repo} must have verified: false`);
    assert.ok(c.repo, 'Candidate must have repo');
    assert.ok(c.name, 'Candidate must have name');
    assert.ok(c.note, 'Candidate must have note');
    assert.match(c.note, /name unverified, run tools\/verify-model-catalog\.js/i);
    assert.ok(Array.isArray(c.files) && c.files.length > 0, `Candidate ${c.repo} must have files array`);
    assert.ok(!realRepos.has(c.repo), `Candidate repo ${c.repo} must NOT appear in models-catalog.js`);
  }
});

test('tools/verify-model-catalog.js and tools/model-candidates.json are NOT in the web build output', () => {
  const tempOut = fs.mkdtempSync(path.join(os.tmpdir(), 'makan-build-tools-test-'));
  try {
    buildWeb({ rootDir: REPO_ROOT, outDir: tempOut });

    assert.strictEqual(fs.existsSync(path.join(tempOut, 'tools')), false, 'tools/ folder must not exist in web build output');
    assert.strictEqual(fs.existsSync(path.join(tempOut, 'tools', 'verify-model-catalog.js')), false);
    assert.strictEqual(fs.existsSync(path.join(tempOut, 'tools', 'model-candidates.json')), false);
    assert.strictEqual(fs.existsSync(path.join(tempOut, 'verify-model-catalog.js')), false);
    assert.strictEqual(fs.existsSync(path.join(tempOut, 'model-candidates.json')), false);
  } finally {
    try { fs.rmSync(tempOut, { recursive: true, force: true }); } catch (_) {}
  }
});
