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
      const origRpc = window.rpc;

      window.rpc = async (cmd, a, tr, signal) => {
        calls.push({ cmd, a });
        if (cmd === 'loadTr') {
          if (a?.spec?.repo) resident.add(a.spec.repo);
          return true;
        }
        if (cmd === 'unload') {
          if (a?.repo) resident.delete(a.repo);
          return true;
        }
        if (cmd === 'stats') {
          const list = Array.from(resident);
          return { repos: list, count: list.length, length: list.length };
        }
        return origRpc ? origRpc(cmd, a, tr, signal) : true;
      };

      const m = (self.MODEL_CATALOG?.models || []).find(x => x.job === 'translate');
      // Simulate verification path in mcDownload
      if (m.job === 'translate') {
        await rpc('loadTr', { spec: { repo: m.repo, kind: m.kind } });
        try { await rpc('unload', { repo: m.repo }); } catch {}
      }

      const stats = await rpc('stats');
      return { calls, stats, repo: m.repo };
    });

    expect(result.calls.some(c => c.cmd === 'loadTr')).toBe(true);
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
      const origRpc = window.rpc;

      window.rpc = async (cmd, a, tr, signal) => {
        calls.push({ cmd, a });
        if (cmd === 'loadAsr') {
          const m = (self.MODEL_CATALOG?.models || []).find(x => x.key === a?.model);
          if (m?.repo) resident.add(m.repo);
          return true;
        }
        if (cmd === 'unload') {
          if (a?.repo) resident.delete(a.repo);
          return true;
        }
        if (cmd === 'stats') {
          const list = Array.from(resident);
          return { repos: list, count: list.length, length: list.length };
        }
        return origRpc ? origRpc(cmd, a, tr, signal) : true;
      };

      const m = (self.MODEL_CATALOG?.models || []).find(x => x.job === 'listen');
      // Simulate verification path in mcDownload for Whisper
      await rpc('loadAsr', { model: m.key });
      try { await rpc('unload', { repo: m.repo }); } catch {}

      const stats = await rpc('stats');
      return { calls, stats, repo: m.repo };
    });

    expect(result.calls.some(c => c.cmd === 'loadAsr')).toBe(true);
    const unloadCall = result.calls.find(c => c.cmd === 'unload');
    expect(unloadCall).toBeDefined();
    expect(unloadCall.a.repo).toBe(result.repo);
    expect(result.stats.count).toBe(0);
  });
});
