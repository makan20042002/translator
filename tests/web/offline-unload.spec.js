'use strict';
/**
 * Test Item 1: Do not keep a model in memory after its download check.
 * After verification in models.js succeeds, rpc('unload', { repo }) is sent
 * so only browser storage files remain, and stats shows zero resident models.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Offline model unload after download check', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('translation model download check sends unload and leaves zero models resident', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const calls = [];
      const resident = new Set();
      const origWorker = window.Worker;

      class MockWorker {
        constructor() {
          this.terminated = false;
        }
        postMessage(data) {
          const { id, cmd, a } = data;
          calls.push({ cmd, a });
          if (cmd === 'loadTr') {
            const repo = a?.spec?.repo || a?.repo;
            if (repo) resident.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          } else if (cmd === 'loadAsr') {
            const m = (self.MODEL_CATALOG?.models || []).find(x => x.key === a?.model);
            const repo = a?.spec?.repo || m?.repo;
            if (repo) resident.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          } else if (cmd === 'unload') {
            if (a?.repo) resident.delete(a.repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          } else if (cmd === 'stats') {
            const list = Array.from(resident);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: { repos: list, count: list.length } } }), 10);
          } else {
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          }
        }
        terminate() {
          this.terminated = true;
        }
      }

      window.Worker = MockWorker;

      const m = (self.MODEL_CATALOG?.models || []).find(x => x.job === 'translate');
      // Exercise real mcDownload path
      await mcDownload(m);

      const stats = await rpc('stats');
      window.Worker = origWorker;

      return { calls, stats, repo: m.repo };
    });

    const loadIndex = result.calls.findIndex(c => c.cmd === 'loadTr');
    const unloadIndex = result.calls.findIndex(c => c.cmd === 'unload');
    expect(loadIndex).toBeGreaterThanOrEqual(0);
    expect(unloadIndex).toBeGreaterThan(loadIndex);
    const unloadCall = result.calls.find(c => c.cmd === 'unload');
    expect(unloadCall).toBeDefined();
    expect(unloadCall.a.repo).toBe(result.repo);
    expect(result.stats.count).toBe(0);
  });

  test('speech (Whisper) download check sends unload for whisper repo and leaves zero models resident', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const calls = [];
      const resident = new Set();
      const origWorker = window.Worker;

      class MockWorker {
        constructor() {
          this.terminated = false;
        }
        postMessage(data) {
          const { id, cmd, a } = data;
          calls.push({ cmd, a });
          if (cmd === 'loadTr') {
            const repo = a?.spec?.repo || a?.repo;
            if (repo) resident.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          } else if (cmd === 'loadAsr') {
            const m = (self.MODEL_CATALOG?.models || []).find(x => x.key === a?.model);
            const repo = a?.spec?.repo || m?.repo;
            if (repo) resident.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          } else if (cmd === 'unload') {
            if (a?.repo) resident.delete(a.repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          } else if (cmd === 'stats') {
            const list = Array.from(resident);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: { repos: list, count: list.length } } }), 10);
          } else {
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 10);
          }
        }
        terminate() {
          this.terminated = true;
        }
      }

      window.Worker = MockWorker;

      const m = (self.MODEL_CATALOG?.models || []).find(x => x.job === 'listen');
      // Exercise real mcDownload path for Whisper
      await mcDownload(m);

      const stats = await rpc('stats');
      window.Worker = origWorker;

      return { calls, stats, repo: m.repo };
    });

    const loadIndex = result.calls.findIndex(c => c.cmd === 'loadAsr');
    const unloadIndex = result.calls.findIndex(c => c.cmd === 'unload');
    expect(loadIndex).toBeGreaterThanOrEqual(0);
    expect(unloadIndex).toBeGreaterThan(loadIndex);
    const unloadCall = result.calls.find(c => c.cmd === 'unload');
    expect(unloadCall).toBeDefined();
    expect(unloadCall.a.repo).toBe(result.repo);
    expect(result.stats.count).toBe(0);
  });
});
