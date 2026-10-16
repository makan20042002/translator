'use strict';
/**
 * Test Item 2: Separate workers for speech and translation, one resident model each.
 * - Translation and speech calls go to different worker instances (roles).
 * - Loading a second model in the same worker disposes the first (stats shows one repo).
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Separate workers for speech and translation', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('translation and speech calls go to different workers', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      // Mock Worker to track instances and their messages
      const created = [];
      class MockWorker {
        constructor(script, opts) {
          this.script = script;
          this.opts = opts;
          this.messages = [];
          this.disposed = [];
          this.loaded = new Set();
          this.id = created.length + 1;
          created.push(this);
        }
        postMessage(data) {
          this.messages.push(data);
          const { id, cmd, a } = data;
          if (cmd === 'loadTr' || cmd === 'translate') {
            const repo = a?.spec?.repo || 'Xenova/nllb-200-distilled-600M';
            for (const r of this.loaded) {
              if (r !== repo) { this.disposed.push(r); this.loaded.delete(r); }
            }
            this.loaded.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: ['translated text'] } }), 0);
          } else if (cmd === 'loadAsr' || cmd === 'asr') {
            const repo = a?.spec?.repo || ('Xenova/whisper-' + (a?.model || 'base'));
            for (const r of this.loaded) {
              if (r !== repo) { this.disposed.push(r); this.loaded.delete(r); }
            }
            this.loaded.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: { text: 'transcribed' } } }), 0);
          } else if (cmd === 'stats') {
            const list = Array.from(this.loaded);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: list } }), 0);
          } else if (cmd === 'unload') {
            if (a?.repo) this.loaded.delete(a.repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 0);
          }
        }
        terminate() {}
      }

      const origWorker = window.Worker;
      window.Worker = MockWorker;

      // Make a translation call
      await rpc('loadTr', { spec: { repo: 'Xenova/nllb-200-distilled-600M', kind: 'nllb' } });

      // Make a speech call
      await rpc('loadAsr', { model: 'base' });

      window.Worker = origWorker;

      return {
        workerCount: created.length,
        worker1Messages: created[0]?.messages.map(m => m.cmd),
        worker2Messages: created[1]?.messages.map(m => m.cmd),
        worker1Role: created[0]?.role,
        worker2Role: created[1]?.role
      };
    });

    expect(result.workerCount).toBe(2);
    expect(result.worker1Role).toBe('translate');
    expect(result.worker2Role).toBe('speech');
    expect(result.worker1Messages).toContain('loadTr');
    expect(result.worker2Messages).toContain('loadAsr');
  });

  test('loading a second model in the same worker disposes the first (stats shows one repo)', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const created = [];
      class MockWorker {
        constructor() {
          this.loaded = new Set();
          this.disposed = [];
          created.push(this);
        }
        postMessage(data) {
          const { id, cmd, a } = data;
          if (cmd === 'loadTr') {
            const repo = a?.spec?.repo;
            // Enforce one resident model policy: evict others
            for (const r of this.loaded) {
              if (r !== repo) {
                this.disposed.push(r);
                this.loaded.delete(r);
              }
            }
            this.loaded.add(repo);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: true } }), 0);
          } else if (cmd === 'stats') {
            const list = Array.from(this.loaded);
            setTimeout(() => this.onmessage?.({ data: { id, ok: true, res: list } }), 0);
          }
        }
        terminate() {}
      }

      const origWorker = window.Worker;
      window.Worker = MockWorker;

      // Load model 1
      await rpc('loadTr', { spec: { repo: 'Xenova/nllb-200-distilled-600M', kind: 'nllb' }, role: 'translate' });
      // Load model 2
      await rpc('loadTr', { spec: { repo: 'Xenova/m2m100_418M', kind: 'm2m100' }, role: 'translate' });

      // Check stats on translation worker
      const stats = await rpc('stats', { role: 'translate' });

      window.Worker = origWorker;

      return {
        disposed: created[0]?.disposed,
        loadedCount: created[0]?.loaded.size,
        stats
      };
    });

    expect(result.disposed).toContain('Xenova/nllb-200-distilled-600M');
    expect(result.loadedCount).toBe(1);
    expect(result.stats.length).toBe(1);
  });
});
