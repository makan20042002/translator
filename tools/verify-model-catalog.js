#!/usr/bin/env node
'use strict';

/**
 * tools/verify-model-catalog.js
 *
 * Verifies model repositories and files in models-catalog.js and tools/model-candidates.json
 * against Hugging Face public APIs (HEAD requests / https://huggingface.co/api/models/<repo>).
 *
 * Requirements:
 * - Pure Node.js with no external npm dependencies.
 * - Sends NO API keys and NO user data.
 * - Prints a summary table: repo, exists, license, listed size vs real size, missing files.
 * - Exits with code 1 if anything in the REAL catalog is missing.
 * - Supports --offline-selftest flag to test validation logic using mock fixture data.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CATALOG_PATH = path.join(REPO_ROOT, 'models-catalog.js');
const DEFAULT_CANDIDATES_PATH = path.join(__dirname, 'model-candidates.json');

function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '-';
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(2) + ' GB';
}

function loadRealCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  const code = fs.readFileSync(catalogPath, 'utf8');
  const sandbox = {};
  const fn = new Function('self', code);
  fn(sandbox);
  return sandbox.MODEL_CATALOG?.models || [];
}

function loadCandidates(candidatesPath = DEFAULT_CANDIDATES_PATH) {
  if (!fs.existsSync(candidatesPath)) return [];
  const text = fs.readFileSync(candidatesPath, 'utf8');
  return JSON.parse(text);
}

function httpsGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'MAKAN-Catalog-Verifier/1.0 (Public Open-Source Tool)'
      }
    };
    const req = https.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsGetJson(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          return resolve({ status: 404, data: null });
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${urlStr}`));
        }
        try {
          resolve({ status: 200, data: JSON.parse(data) });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsHeadFile(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'MAKAN-Catalog-Verifier/1.0 (Public Open-Source Tool)'
      }
    };
    const req = https.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsHeadFile(res.headers.location));
      }
      const len = res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : null;
      resolve({
        statusCode: res.statusCode,
        contentLength: len
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyRepoLive(entry) {
  const repo = entry.repo;
  const files = entry.files || [];
  const res = {
    repo: repo,
    name: entry.name || repo,
    isCandidate: Boolean(entry.verified === false),
    exists: false,
    license: 'unknown',
    listedBytes: entry.bytes || 0,
    realBytes: 0,
    missingFiles: [],
    errors: []
  };

  try {
    const info = await httpsGetJson(`https://huggingface.co/api/models/${encodeURIComponent(repo)}`);
    if (info.status === 404 || !info.data) {
      res.exists = false;
      res.missingFiles = files.map(f => (Array.isArray(f) ? f[0] : f));
      return res;
    }

    res.exists = true;
    const modelData = info.data;
    // Extract license
    if (modelData.cardData && modelData.cardData.license) {
      res.license = modelData.cardData.license;
    } else if (Array.isArray(modelData.tags)) {
      const licTag = modelData.tags.find(t => t.startsWith('license:'));
      if (licTag) res.license = licTag.replace('license:', '');
    }

    // Check files via siblings or resolve URL
    const siblings = Array.isArray(modelData.siblings) ? new Set(modelData.siblings.map(s => s.rfilename)) : null;

    let totalRealBytes = 0;
    for (const f of files) {
      const fileName = Array.isArray(f) ? f[0] : f;
      const expectedSize = Array.isArray(f) ? f[1] : 0;

      if (siblings && !siblings.has(fileName)) {
        res.missingFiles.push(fileName);
        continue;
      }

      // Query resolve URL HEAD to get actual size
      try {
        const head = await httpsHeadFile(`https://huggingface.co/${repo}/resolve/main/${fileName}`);
        if (head.statusCode === 404) {
          res.missingFiles.push(fileName);
        } else {
          totalRealBytes += (head.contentLength != null ? head.contentLength : expectedSize);
        }
      } catch (err) {
        // If network glitch on resolve, fallback to expected size if in siblings
        if (siblings && siblings.has(fileName)) {
          totalRealBytes += expectedSize;
        } else {
          res.missingFiles.push(fileName);
        }
      }
    }
    res.realBytes = totalRealBytes;
  } catch (err) {
    res.errors.push(err.message);
  }

  return res;
}

function verifyRepoMock(entry, fixtureData) {
  const repo = entry.repo;
  const files = entry.files || [];
  const mockInfo = fixtureData[repo];

  const res = {
    repo: repo,
    name: entry.name || repo,
    isCandidate: Boolean(entry.verified === false),
    exists: Boolean(mockInfo && mockInfo.exists),
    license: (mockInfo && mockInfo.license) || 'unknown',
    listedBytes: entry.bytes || 0,
    realBytes: (mockInfo && mockInfo.realBytes) || 0,
    missingFiles: [],
    errors: []
  };

  if (!mockInfo || !mockInfo.exists) {
    res.missingFiles = files.map(f => (Array.isArray(f) ? f[0] : f));
    return res;
  }

  const existingFiles = new Set(mockInfo.files || []);
  for (const f of files) {
    const fName = Array.isArray(f) ? f[0] : f;
    if (!existingFiles.has(fName)) {
      res.missingFiles.push(fName);
    }
  }

  return res;
}

function printTable(results) {
  console.log('\n====================================================================================================');
  console.log('                            MODEL CATALOG VERIFICATION REPORT');
  console.log('====================================================================================================');
  console.log(
    'Repo'.padEnd(38) +
    'Type'.padEnd(12) +
    'Exists'.padEnd(8) +
    'License'.padEnd(14) +
    'Listed'.padEnd(11) +
    'Real'.padEnd(11) +
    'Missing Files'
  );
  console.log('-'.repeat(100));

  for (const r of results) {
    const typeStr = r.isCandidate ? 'Candidate' : 'Real';
    const existsStr = r.exists ? 'YES' : 'NO';
    const missingStr = r.missingFiles.length > 0 ? r.missingFiles.join(', ') : 'none';

    console.log(
      r.repo.slice(0, 36).padEnd(38) +
      typeStr.padEnd(12) +
      existsStr.padEnd(8) +
      (r.license || '-').slice(0, 12).padEnd(14) +
      formatBytes(r.listedBytes).padEnd(11) +
      formatBytes(r.realBytes).padEnd(11) +
      missingStr
    );
  }
  console.log('====================================================================================================\n');
}

// Built-in fixtures for --offline-selftest
const SELFTFEST_FIXTURES = {
  good: {
    catalog: [
      {
        repo: 'onnx-community/whisper-tiny',
        name: 'Whisper Tiny',
        bytes: 79677901,
        files: [['config.json', 2248], ['onnx/encoder_model_quantized.onnx', 23200850]]
      }
    ],
    candidates: [
      {
        repo: 'onnx-community/whisper-large-v3',
        name: 'Whisper Large v3',
        verified: false,
        bytes: 3000000000,
        files: [['config.json', 2500]]
      }
    ],
    mockHF: {
      'onnx-community/whisper-tiny': {
        exists: true,
        license: 'apache-2.0',
        realBytes: 79677901,
        files: ['config.json', 'onnx/encoder_model_quantized.onnx']
      },
      'onnx-community/whisper-large-v3': {
        exists: true,
        license: 'apache-2.0',
        realBytes: 3000000000,
        files: ['config.json']
      }
    }
  },
  missingFile: {
    catalog: [
      {
        repo: 'onnx-community/whisper-tiny',
        name: 'Whisper Tiny',
        bytes: 79677901,
        files: [['config.json', 2248], ['missing-weight.onnx', 50000000]]
      }
    ],
    candidates: [],
    mockHF: {
      'onnx-community/whisper-tiny': {
        exists: true,
        license: 'apache-2.0',
        realBytes: 2248,
        files: ['config.json'] // missing-weight.onnx is absent
      }
    }
  },
  missingRepo: {
    catalog: [
      {
        repo: 'nonexistent-org/missing-model-repo',
        name: 'Nonexistent Model',
        bytes: 1000,
        files: [['config.json', 1000]]
      }
    ],
    candidates: [],
    mockHF: {}
  }
};

async function runSelftest(subMode) {
  if (subMode === 'missing-file' || subMode === 'missingFile') {
    const fix = SELFTFEST_FIXTURES.missingFile;
    const results = fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF));
    printTable(results);
    const hasMissingInReal = results.some(r => !r.isCandidate && (!r.exists || r.missingFiles.length > 0));
    process.exit(hasMissingInReal ? 1 : 0);
  }

  if (subMode === 'missing-repo' || subMode === 'missingRepo') {
    const fix = SELFTFEST_FIXTURES.missingRepo;
    const results = fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF));
    printTable(results);
    const hasMissingInReal = results.some(r => !r.isCandidate && (!r.exists || r.missingFiles.length > 0));
    process.exit(hasMissingInReal ? 1 : 0);
  }

  if (subMode === 'good') {
    const fix = SELFTFEST_FIXTURES.good;
    const results = [
      ...fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF)),
      ...fix.candidates.map(entry => verifyRepoMock(entry, fix.mockHF))
    ];
    printTable(results);
    const hasMissingInReal = results.some(r => !r.isCandidate && (!r.exists || r.missingFiles.length > 0));
    process.exit(hasMissingInReal ? 1 : 0);
  }

  // Full self-test runner
  console.log('Running verify-model-catalog internal self-tests...\n');

  // Test 1: Good fixture
  const goodRes = SELFTFEST_FIXTURES.good.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.good.mockHF));
  const goodPass = goodRes.every(r => r.exists && r.missingFiles.length === 0);
  console.log(`[Self-test] Good fixtures check: ${goodPass ? 'PASS' : 'FAIL'}`);

  // Test 2: Missing file fixture
  const mfRes = SELFTFEST_FIXTURES.missingFile.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.missingFile.mockHF));
  const mfPass = mfRes.some(r => r.missingFiles.includes('missing-weight.onnx'));
  console.log(`[Self-test] Missing file detection: ${mfPass ? 'PASS' : 'FAIL'}`);

  // Test 3: Missing repo fixture
  const mrRes = SELFTFEST_FIXTURES.missingRepo.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.missingRepo.mockHF));
  const mrPass = mrRes.some(r => !r.exists);
  console.log(`[Self-test] Missing repo detection: ${mrPass ? 'PASS' : 'FAIL'}`);

  if (goodPass && mfPass && mrPass) {
    console.log('\nAll offline self-tests PASSED.');
    process.exit(0);
  } else {
    console.error('\nSelf-tests FAILED.');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const selftestArg = args.find(a => a.startsWith('--offline-selftest'));
  const fixtureArg = args.find(a => a.startsWith('--fixture=') || a.startsWith('--mode='));

  if (selftestArg) {
    let mode = null;
    if (selftestArg.includes('=')) {
      mode = selftestArg.split('=')[1];
    } else if (fixtureArg) {
      mode = fixtureArg.split('=')[1];
    }
    return runSelftest(mode);
  }

  // Real verification with Internet
  console.log('Loading models-catalog.js and tools/model-candidates.json...');
  const realModels = loadRealCatalog();
  const candidateModels = loadCandidates();

  console.log(`Checking ${realModels.length} real catalog models and ${candidateModels.length} candidate models against Hugging Face...`);

  const results = [];
  for (const m of realModels) {
    process.stdout.write(`  Checking real: ${m.repo}... `);
    const r = await verifyRepoLive(m);
    results.push(r);
    console.log(r.exists ? (r.missingFiles.length ? `MISSING ${r.missingFiles.length} files` : 'OK') : 'NOT FOUND');
  }

  for (const c of candidateModels) {
    process.stdout.write(`  Checking candidate: ${c.repo}... `);
    const r = await verifyRepoLive(c);
    results.push(r);
    console.log(r.exists ? (r.missingFiles.length ? `MISSING ${r.missingFiles.length} files` : 'OK') : 'NOT FOUND');
  }

  printTable(results);

  const realFailures = results.filter(r => !r.isCandidate && (!r.exists || r.missingFiles.length > 0));
  if (realFailures.length > 0) {
    console.error(`Verification FAILED: ${realFailures.length} model(s) in the real catalog are missing or have missing files.`);
    process.exit(1);
  }

  console.log('Verification SUCCEEDED: All models in the real catalog exist and have all required files.');
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  loadRealCatalog,
  loadCandidates,
  verifyRepoMock,
  verifyRepoLive,
  SELFTFEST_FIXTURES
};
