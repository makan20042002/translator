'use strict';
// Model files now come from *.hf.co (Hugging Face's download network), no longer from cdn-lfs.huggingface.co:
// huggingface.co/<model>/resolve/... answers with a redirect to a host such as us.aws.cdn.hf.co.
// Nothing in the app may depend on the old address, and the service worker must leave model downloads alone
// (the model library keeps its own copy in browser storage; a second copy would double the disk use).
const { test, expect } = require('../support/fixtures');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');

test.describe('Model download hosts', () => {
  test('no file of the app, the extension or the build refers to cdn-lfs.huggingface.co', () => {
    const skip = new Set(['node_modules', '.git', 'dist', 'tests', 'test-assets', 'test_docs', 'docs']);
    const hits = [];
    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name) || e.isSymbolicLink()) continue;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { walk(f); continue; }
        if (!/\.(m?js|html|json|webmanifest|css|md)$/.test(e.name) || e.size > 5e6) continue;
        if (/cdn-lfs/i.test(fs.readFileSync(f, 'utf8'))) hits.push(path.relative(ROOT, f));
      }
    };
    walk(ROOT);
    expect(hits).toEqual([]);
  });

  /** Runs sw.js with a fake worker environment and reports whether it answers a request itself. */
  function swAnswers(url, { mode = 'cors' } = {}) {
    const handlers = {};
    const sandbox = {
      self: null, location: { origin: 'https://app.example' }, URL, Promise, console,
      caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => [], match: async () => undefined, delete: async () => true },
      fetch: async () => ({ ok: true, clone() { return this; } }),
      addEventListener: (n, fn) => { handlers[n] = fn; }
    };
    sandbox.self = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), sandbox);
    let answered = false;
    handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: () => { answered = true; } });
    return answered;
  }

  test('the service worker does not touch model downloads, on huggingface.co or on any *.hf.co host', () => {
    for (const url of [
      'https://huggingface.co/Xenova/whisper-small/resolve/main/onnx/encoder_model_quantized.onnx',
      'https://us.aws.cdn.hf.co/xet-bridge-us/64d2166c92474b17cb1f658b/c3f4343559995c7ddbea29f72d8cabafa09f4a4fb54f1cac6bd339614c9f7b1f?X-Xet-Cas-Uid=public',
      'https://cas-bridge.xethub.hf.co/xet-bridge-us/abc/def',
      'https://eu.aws.cdn.hf.co/xet-bridge-eu/abc/def',
      'https://cdn-lfs.huggingface.co/repos/ab/cd/ef'
    ]) expect(swAnswers(url), url).toBe(false);
  });

  test('the service worker still serves the model library script and the fonts from its saved copy', () => {
    expect(swAnswers('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1')).toBe(true);
    expect(swAnswers('https://fonts.googleapis.com/css2?family=x')).toBe(true);
    expect(swAnswers('https://app.example/index.html')).toBe(true);
  });

  test('the files the worker needs are saved with the app for offline use', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    for (const f of ['./ai-worker.js', './asr-guard.js', './models-catalog.js', './piper-worker.js']) expect(sw, f).toContain(`'${f}'`);
  });
});
