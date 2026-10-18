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
 * - Prints a summary table: repo, exists/status, license, listed size vs real size, missing files.
 * - Distinguishes EXISTS, NOT FOUND, and UNREACHABLE states.
 * - Follows redirects and applies 15s timeout.
 * - Exit code: 1 if anything real is NOT FOUND or has missing files, 2 if unreachable, 0 if good.
 * - Supports --repo <owner/name> and --offline-selftest.
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

function buildModelApiUrl(repo) {
  const encodedRepo = String(repo).split('/').map(encodeURIComponent).join('/');
  return `https://huggingface.co/api/models/${encodedRepo}`;
}

function buildResolveUrl(repo, filePath) {
  const encodedRepo = String(repo).split('/').map(encodeURIComponent).join('/');
  const encodedPath = String(filePath).split('/').map(encodeURIComponent).join('/');
  return `https://huggingface.co/${encodedRepo}/resolve/main/${encodedPath}`;
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

function isSizeMismatch(listedBytes, realBytes) {
  if (!listedBytes || !realBytes) return false;
  const diff = Math.abs(realBytes - listedBytes);
  return (diff / listedBytes) > 0.05;
}

function httpRequest(urlStr, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) {
      return reject(new Error('Too many redirects'));
    }
    const url = new URL(urlStr);
    const transport = url.protocol === 'http:' ? http : https;
    const reqOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'MAKAN-Catalog-Verifier/1.0 (Public Open-Source Tool)',
        ...(options.headers || {})
      },
      timeout: 15000
    };

    const req = transport.request(reqOptions, res => {
      // Follow redirects (301, 302, 303, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, urlStr).href;
        return resolve(httpRequest(nextUrl, options, redirectCount + 1));
      }

      const clHeader = res.headers['content-length'];
      const len = clHeader ? parseInt(clHeader, 10) : null;
      const contentLength = (len != null && !isNaN(len)) ? len : null;

      if (options.method === 'HEAD') {
        res.resume();
        return resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          contentLength: contentLength,
          data: null
        });
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          contentLength: contentLength,
          data: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('ETIMEDOUT: request timed out after 15s'));
    });

    req.on('error', err => {
      reject(err);
    });

    req.end();
  });
}

function extractLicense(modelData) {
  if (!modelData) return '-';
  if (modelData.cardData && modelData.cardData.license) {
    return String(modelData.cardData.license);
  }
  if (Array.isArray(modelData.tags)) {
    const licTag = modelData.tags.find(t => typeof t === 'string' && t.startsWith('license:'));
    if (licTag) return licTag.replace('license:', '');
  }
  return '-';
}

async function verifyRepoLive(entry) {
  const repo = entry.repo;
  const files = entry.files || [];
  const res = {
    repo: repo,
    name: entry.name || repo,
    isCandidate: Boolean(entry.verified === false),
    status: 'UNREACHABLE',
    exists: false,
    reason: '',
    license: '-',
    listedBytes: entry.bytes || 0,
    realBytes: 0,
    missingFiles: [],
    errors: []
  };

  let infoRes;
  try {
    infoRes = await httpRequest(buildModelApiUrl(repo), { method: 'GET' });
  } catch (err) {
    res.status = 'UNREACHABLE';
    res.reason = err.code || err.message || 'Network error';
    res.missingFiles = [];
    return res;
  }

  if (infoRes.statusCode === 404) {
    res.status = 'NOT FOUND';
    res.reason = 'HTTP 404';
    res.exists = false;
    res.missingFiles = files.map(f => (Array.isArray(f) ? f[0] : f));
    return res;
  }

  if (infoRes.statusCode !== 200) {
    res.status = 'UNREACHABLE';
    res.reason = `HTTP ${infoRes.statusCode}`;
    res.missingFiles = [];
    return res;
  }

  let modelData;
  try {
    modelData = JSON.parse(infoRes.data);
  } catch (err) {
    res.status = 'UNREACHABLE';
    res.reason = 'Invalid JSON response';
    res.missingFiles = [];
    return res;
  }

  res.status = 'EXISTS';
  res.exists = true;
  res.license = extractLicense(modelData);

  const isPartialRepo = repo === 'rhasspy/piper-voices' || repo.startsWith('PaddleOCR');
  const siblingsMap = (!isPartialRepo && Array.isArray(modelData.siblings))
    ? new Map(modelData.siblings.map(s => [s.rfilename, s]))
    : null;

  let totalRealBytes = 0;
  for (const f of files) {
    const fileName = Array.isArray(f) ? f[0] : f;
    const expectedSize = Array.isArray(f) ? f[1] : 0;
    const fileUrl = buildResolveUrl(repo, fileName);

    try {
      const head = await httpRequest(fileUrl, { method: 'HEAD' });
      if (head.statusCode === 200) {
        let size = head.contentLength;
        if (size == null && siblingsMap && siblingsMap.has(fileName)) {
          const s = siblingsMap.get(fileName);
          size = s.lfs?.size != null ? s.lfs.size : (s.size != null ? s.size : expectedSize);
        }
        totalRealBytes += (size != null ? size : expectedSize);
      } else if (head.statusCode === 404) {
        res.missingFiles.push(fileName);
      } else {
        // Network or 5xx/403/429 during file HEAD: do not mark missing
        if (siblingsMap && siblingsMap.has(fileName)) {
          const s = siblingsMap.get(fileName);
          totalRealBytes += (s.lfs?.size || s.size || expectedSize);
        } else {
          totalRealBytes += expectedSize;
        }
      }
    } catch (_) {
      // Network failure on resolve HEAD: do not mark missing
      if (siblingsMap && siblingsMap.has(fileName)) {
        const s = siblingsMap.get(fileName);
        totalRealBytes += (s.lfs?.size || s.size || expectedSize);
      } else {
        totalRealBytes += expectedSize;
      }
    }
  }

  res.realBytes = totalRealBytes;
  return res;
}

function verifyRepoMock(entry, fixtureData) {
  const repo = entry.repo;
  const files = entry.files || [];
  const mockInfo = fixtureData ? fixtureData[repo] : null;

  let status = 'NOT FOUND';
  let reason = '';
  if (mockInfo) {
    if (mockInfo.status) {
      status = mockInfo.status;
      reason = mockInfo.reason || '';
    } else if (mockInfo.unreachable) {
      status = 'UNREACHABLE';
      reason = mockInfo.reason || 'Network error';
    } else if (mockInfo.exists) {
      status = 'EXISTS';
    }
  }

  const res = {
    repo: repo,
    name: entry.name || repo,
    isCandidate: Boolean(entry.verified === false),
    status: status,
    exists: status === 'EXISTS',
    reason: reason,
    license: (mockInfo && mockInfo.license) || '-',
    listedBytes: entry.bytes || 0,
    realBytes: (mockInfo && mockInfo.realBytes) || 0,
    missingFiles: [],
    errors: []
  };

  if (status === 'NOT FOUND') {
    res.missingFiles = files.map(f => (Array.isArray(f) ? f[0] : f));
    return res;
  }

  if (status === 'UNREACHABLE') {
    res.missingFiles = [];
    return res;
  }

  const existingFiles = new Set((mockInfo && mockInfo.files) || []);
  for (const f of files) {
    const fName = Array.isArray(f) ? f[0] : f;
    if (!existingFiles.has(fName)) {
      res.missingFiles.push(fName);
    }
  }

  return res;
}

function getExitCode(results) {
  const hasRealMissing = results.some(r => !r.isCandidate && (r.status === 'NOT FOUND' || r.missingFiles.length > 0));
  if (hasRealMissing) return 1;
  const hasUnreachable = results.some(r => r.status === 'UNREACHABLE');
  if (hasUnreachable) return 2;
  return 0;
}

function printTable(results) {
  console.log('\n========================================================================================================================');
  console.log('                                       MODEL CATALOG VERIFICATION REPORT');
  console.log('========================================================================================================================');
  console.log(
    'Repo'.padEnd(38) +
    'Type'.padEnd(11) +
    'Status'.padEnd(18) +
    'License'.padEnd(14) +
    'Listed'.padEnd(11) +
    'Real'.padEnd(12) +
    'Missing / Notes'
  );
  console.log('-'.repeat(120));

  for (const r of results) {
    const typeStr = r.isCandidate ? 'Candidate' : 'Real';
    let statusStr = r.status;
    if (r.status === 'EXISTS') {
      statusStr = 'EXISTS (YES)';
    } else if (r.status === 'NOT FOUND') {
      statusStr = 'NOT FOUND (NO)';
    } else if (r.status === 'UNREACHABLE') {
      statusStr = 'UNREACHABLE';
    }

    const mismatch = isSizeMismatch(r.listedBytes, r.realBytes);
    const pctDiff = r.listedBytes > 0
      ? (((r.realBytes - r.listedBytes) / r.listedBytes) * 100).toFixed(1)
      : '0';

    let realStr = formatBytes(r.realBytes);
    if (mismatch) {
      realStr += ' *';
    }

    let notesStr = 'none';
    if (r.status === 'UNREACHABLE') {
      notesStr = r.reason || 'network unreachable';
    } else if (r.missingFiles.length > 0) {
      notesStr = 'MISSING: ' + r.missingFiles.join(', ');
    } else if (mismatch) {
      notesStr = `size diff: ${pctDiff > 0 ? '+' : ''}${pctDiff}%`;
    }

    console.log(
      r.repo.slice(0, 36).padEnd(38) +
      typeStr.padEnd(11) +
      statusStr.padEnd(18) +
      (r.license || '-').slice(0, 12).padEnd(14) +
      formatBytes(r.listedBytes).padEnd(11) +
      realStr.padEnd(12) +
      notesStr
    );
  }
  console.log('========================================================================================================================\n');

  if (results.some(r => isSizeMismatch(r.listedBytes, r.realBytes))) {
    console.log('* Note: Size mismatch greater than 5% between listed and actual size.');
  }

  const unreachableCount = results.filter(r => r.status === 'UNREACHABLE').length;
  if (unreachableCount > 0) {
    console.log(`${unreachableCount} repos could not be reached (network); run again with internet or a VPN`);
  }
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
        status: 'EXISTS',
        exists: true,
        license: 'apache-2.0',
        realBytes: 79677901,
        files: ['config.json', 'onnx/encoder_model_quantized.onnx']
      },
      'onnx-community/whisper-large-v3': {
        status: 'EXISTS',
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
        status: 'EXISTS',
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
    mockHF: {
      'nonexistent-org/missing-model-repo': {
        status: 'NOT FOUND',
        exists: false,
        reason: 'HTTP 404'
      }
    }
  },
  unreachableRepo: {
    catalog: [
      {
        repo: 'unreachable-org/down-model-repo',
        name: 'Unreachable Model',
        bytes: 1000,
        files: [['config.json', 1000]]
      }
    ],
    candidates: [],
    mockHF: {
      'unreachable-org/down-model-repo': {
        status: 'UNREACHABLE',
        exists: false,
        reason: 'ETIMEDOUT (connection timed out)'
      }
    }
  },
  threeStates: {
    catalog: [
      {
        repo: 'good-org/good-model',
        name: 'Good Model',
        bytes: 1000,
        files: [['config.json', 1000]]
      },
      {
        repo: 'missing-org/missing-model',
        name: 'Missing Model',
        bytes: 1000,
        files: [['config.json', 1000]]
      },
      {
        repo: 'down-org/down-model',
        name: 'Down Model',
        bytes: 1000,
        files: [['config.json', 1000]]
      }
    ],
    candidates: [],
    mockHF: {
      'good-org/good-model': {
        status: 'EXISTS',
        exists: true,
        license: 'mit',
        realBytes: 1000,
        files: ['config.json']
      },
      'missing-org/missing-model': {
        status: 'NOT FOUND',
        exists: false,
        reason: 'HTTP 404'
      },
      'down-org/down-model': {
        status: 'UNREACHABLE',
        exists: false,
        reason: 'ECONNREFUSED'
      }
    }
  }
};

async function runSelftest(subMode) {
  if (subMode === 'missing-file' || subMode === 'missingFile') {
    const fix = SELFTFEST_FIXTURES.missingFile;
    const results = fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF));
    printTable(results);
    const code = getExitCode(results);
    process.exit(code);
  }

  if (subMode === 'missing-repo' || subMode === 'missingRepo') {
    const fix = SELFTFEST_FIXTURES.missingRepo;
    const results = fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF));
    printTable(results);
    const code = getExitCode(results);
    process.exit(code);
  }

  if (subMode === 'unreachable-repo' || subMode === 'unreachableRepo' || subMode === 'unreachable') {
    const fix = SELFTFEST_FIXTURES.unreachableRepo;
    const results = fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF));
    printTable(results);
    const code = getExitCode(results);
    process.exit(code);
  }

  if (subMode === 'three-states' || subMode === 'threeStates') {
    const fix = SELFTFEST_FIXTURES.threeStates;
    const results = fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF));
    printTable(results);
    const code = getExitCode(results);
    process.exit(code);
  }

  if (subMode === 'good') {
    const fix = SELFTFEST_FIXTURES.good;
    const results = [
      ...fix.catalog.map(entry => verifyRepoMock(entry, fix.mockHF)),
      ...fix.candidates.map(entry => verifyRepoMock(entry, fix.mockHF))
    ];
    printTable(results);
    const code = getExitCode(results);
    process.exit(code);
  }

  // Full self-test runner
  console.log('Running verify-model-catalog internal self-tests...\n');

  const goodRes = SELFTFEST_FIXTURES.good.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.good.mockHF));
  const goodPass = goodRes.every(r => r.status === 'EXISTS' && r.missingFiles.length === 0);
  console.log(`[Self-test] Good fixtures check: ${goodPass ? 'PASS' : 'FAIL'}`);

  const mfRes = SELFTFEST_FIXTURES.missingFile.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.missingFile.mockHF));
  const mfPass = mfRes.some(r => r.missingFiles.includes('missing-weight.onnx'));
  console.log(`[Self-test] Missing file detection: ${mfPass ? 'PASS' : 'FAIL'}`);

  const mrRes = SELFTFEST_FIXTURES.missingRepo.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.missingRepo.mockHF));
  const mrPass = mrRes.some(r => r.status === 'NOT FOUND');
  console.log(`[Self-test] Missing repo detection: ${mrPass ? 'PASS' : 'FAIL'}`);

  const unRes = SELFTFEST_FIXTURES.unreachableRepo.catalog.map(e => verifyRepoMock(e, SELFTFEST_FIXTURES.unreachableRepo.mockHF));
  const unPass = unRes.every(r => r.status === 'UNREACHABLE' && r.missingFiles.length === 0);
  console.log(`[Self-test] Unreachable repo detection: ${unPass ? 'PASS' : 'FAIL'}`);

  if (goodPass && mfPass && mrPass && unPass) {
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

  // Parse --repo <owner/name>
  let targetRepo = null;
  const repoIdx = args.indexOf('--repo');
  if (repoIdx !== -1 && repoIdx + 1 < args.length) {
    targetRepo = args[repoIdx + 1];
  } else {
    const inlineRepo = args.find(a => a.startsWith('--repo='));
    if (inlineRepo) {
      targetRepo = inlineRepo.split('=')[1];
    }
  }

  console.log('Loading models-catalog.js and tools/model-candidates.json...');
  let realModels = loadRealCatalog();
  let candidateModels = loadCandidates();

  if (targetRepo) {
    const rFound = realModels.filter(m => m.repo === targetRepo);
    const cFound = candidateModels.filter(c => c.repo === targetRepo);
    if (rFound.length === 0 && cFound.length === 0) {
      realModels = [{ repo: targetRepo, name: targetRepo, files: [] }];
      candidateModels = [];
    } else {
      realModels = rFound;
      candidateModels = cFound;
    }
    console.log(`Checking single repo: ${targetRepo}...`);
  } else {
    console.log(`Checking ${realModels.length} real catalog models and ${candidateModels.length} candidate models against Hugging Face...`);
  }

  const results = [];
  for (const m of realModels) {
    process.stdout.write(`  Checking real: ${m.repo}... `);
    const r = await verifyRepoLive(m);
    results.push(r);
    let logStatus = r.status;
    if (r.status === 'EXISTS' && r.missingFiles.length > 0) {
      logStatus = `MISSING ${r.missingFiles.length} files`;
    } else if (r.status === 'UNREACHABLE') {
      logStatus = `UNREACHABLE (${r.reason})`;
    }
    console.log(logStatus);
  }

  for (const c of candidateModels) {
    process.stdout.write(`  Checking candidate: ${c.repo}... `);
    const r = await verifyRepoLive(c);
    results.push(r);
    let logStatus = r.status;
    if (r.status === 'EXISTS' && r.missingFiles.length > 0) {
      logStatus = `MISSING ${r.missingFiles.length} files`;
    } else if (r.status === 'UNREACHABLE') {
      logStatus = `UNREACHABLE (${r.reason})`;
    }
    console.log(logStatus);
  }

  printTable(results);

  const code = getExitCode(results);
  if (code === 1) {
    console.error('Verification FAILED: One or more real models were not found or have missing files.');
    process.exit(1);
  }
  if (code === 2) {
    console.warn('Verification INCOMPLETE: Some models could not be reached due to network errors.');
    process.exit(2);
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
  SELFTFEST_FIXTURES,
  buildModelApiUrl,
  buildResolveUrl,
  isSizeMismatch,
  getExitCode,
  httpRequest,
  extractLicense
};
