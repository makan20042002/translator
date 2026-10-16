'use strict';
/**
 * Test Item 3: Recover from a fatal engine error.
 * - Detects fatal errors (e.g. Aborted(), failed to allocate buffer).
 * - Terminates the faulted worker cleanly and creates a fresh worker on the next attempt.
 * - Translates retry once automatically on the fresh worker.
 * - Shows friendly user-facing message, never raw WASM text.
 * - Records failure in mcFailed so Voice status line shows a warning instead of Ready until later success.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Offline fatal WASM error recovery', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('fatal Aborted error terminates the worker and retries translate on a fresh worker', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const workers = [];
      let nextId = 0;

      class MockWorker {
        constructor() {
          this.id = ++nextId;
          this.terminated = false;
          this.messages = [];
          workers.push(this);
        }
        postMessage(data) {
          this.messages.push(data);
          const { id, cmd } = data;
          if (cmd === 'translate') {
            // First worker aborts with raw WASM fatal error
            if (this.id === 1) {
              setTimeout(() => {
                this.onmessage?.({
                  data: {
                    id,
                    ok: false,
                    err: 'Aborted(). Build with -sASSERTIONS for more info.'
                  }
                });
              }, 10);
            } else {
              // Second fresh worker succeeds
              setTimeout(() => {
                this.onmessage?.({
                  data: {
                    id,
                    ok: true,
                    res: ['Hello world recovered']
                  }
                });
              }, 10);
            }
          }
        }
        terminate() {
          this.terminated = true;
        }
      }

      const origWorker = window.Worker;
      window.Worker = MockWorker;

      // Make translate call which encounters fatal error on worker 1, then auto-retries on worker 2
      const translated = await rpc('translate', {
        spec: { repo: 'Xenova/nllb-200-distilled-600M', kind: 'nllb' },
        items: ['test sentence'],
        src: 'en',
        tgt: 'fa'
      });

      window.Worker = origWorker;

      return {
        totalWorkersCreated: workers.length,
        worker1Terminated: workers[0]?.terminated,
        worker2Terminated: workers[1]?.terminated,
        translated
      };
    });

    expect(result.totalWorkersCreated).toBe(2);
    expect(result.worker1Terminated).toBe(true);
    expect(result.worker2Terminated).toBe(false);
    expect(result.translated).toEqual(['Hello world recovered']);
  });

  test('fatal speech error shows friendly message and marks Voice readiness warning until next success', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const workers = [];
      let nextId = 0;

      class MockWorker {
        constructor() {
          this.id = ++nextId;
          this.terminated = false;
          workers.push(this);
        }
        postMessage(data) {
          const { id, cmd } = data;
          if (cmd === 'asr') {
            if (this.id === 1) {
              setTimeout(() => {
                this.onmessage?.({
                  data: {
                    id,
                    ok: false,
                    err: "Can't create a session. failed to allocate a buffer of size 3450000000"
                  }
                });
              }, 10);
            } else {
              setTimeout(() => {
                this.onmessage?.({
                  data: {
                    id,
                    ok: true,
                    res: { text: 'Recovered speech text' }
                  }
                });
              }, 10);
            }
          }
        }
        terminate() {
          this.terminated = true;
        }
      }

      const origWorker = window.Worker;
      window.Worker = MockWorker;

      // Seed model in store so it is recognized as downloaded
      const d = store.get('mdl', {});
      d['asr-large-v3-turbo'] = { at: Date.now(), files: [] };
      store.set('mdl', d);

      // Setup Whisper selection in cfg
      cfg.stt = 'whisper';
      cfg.whisper = 'large-v3-turbo';
      if (typeof window !== 'undefined' && window.cfg) {
        window.cfg.stt = 'whisper';
        window.cfg.whisper = 'large-v3-turbo';
      }

      let caughtErr = null;
      try {
        await rpc('asr', { model: 'large-v3-turbo', audio: new Float32Array(16000) });
      } catch (err) {
        caughtErr = err.message;
      }

      const failedModel = (self.MODEL_CATALOG?.models || []).find(m => m.key === 'large-v3-turbo');
      const recordedFailure = failedModel ? (typeof mcFailed !== 'undefined' ? mcFailed[failedModel.id] : window.mcFailed?.[failedModel.id]) : null;

      // Check readiness after failure
      const readinessAfterFail = window.getVoiceTabReadiness();

      // Now run second call on fresh worker which succeeds
      let secondResult = null;
      try {
        secondResult = await rpc('asr', { model: 'large-v3-turbo', audio: new Float32Array(16000) });
      } catch (err) {}

      const readinessAfterSuccess = window.getVoiceTabReadiness();

      window.Worker = origWorker;

      return {
        caughtErr,
        worker1Terminated: workers[0]?.terminated,
        recordedFailure,
        readinessAfterFailAsrOk: readinessAfterFail.asr.ok,
        readinessAfterSuccessAsrOk: readinessAfterSuccess.asr.ok,
        secondResultText: secondResult?.text
      };
    });

    // Friendly error, not raw WASM text
    expect(result.caughtErr).not.toContain("Can't create a session");
    expect(result.caughtErr).toContain('out of memory');
    expect(result.worker1Terminated).toBe(true);
    expect(result.recordedFailure).toBeDefined();
    expect(result.readinessAfterFailAsrOk).toBe(false);
    expect(result.readinessAfterSuccessAsrOk).toBe(true);
    expect(result.secondResultText).toBe('Recovered speech text');
  });
});
