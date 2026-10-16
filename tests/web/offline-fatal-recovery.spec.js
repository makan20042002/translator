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
const { fakeDownloaded } = require('../support/model-helpers');

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
    const cat = await page.evaluate(() => MODEL_CATALOG);
    const turbo = cat.models.find(m => m.key === 'large-v3-turbo');
    await fakeDownloaded(page, turbo.repo, turbo.files);

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

      // Seed model in store and mcCache so it is recognized as downloaded and ready
      const cat = self.MODEL_CATALOG?.models || [];
      const m = cat.find(x => x.key === 'large-v3-turbo');
      if (m) {
        const d = store.get('mdl', {});
        d[m.id] = { at: Date.now(), files: m.files.map(f => f[0]) };
        store.set('mdl', d);
        await mcScan();
        if (!mcCache) mcCache = {};
        mcCache[m.repo] = {
          bytes: m.bytes || 1000,
          files: new Map(m.files.map(f => [f[0], f[1]]))
        };
      }

      // Setup Whisper selection in cfg
      cfg.stt = 'whisper';
      cfg.whisper = 'large-v3-turbo';

      // (a) Readiness before any failure
      const readinessBefore = getVoiceTabReadiness();

      let caughtErr = null;
      try {
        await rpc('asr', { model: 'large-v3-turbo', audio: new Float32Array(16000) });
      } catch (err) {
        caughtErr = err.message;
      }

      const failedModel = (self.MODEL_CATALOG?.models || []).find(x => x.key === 'large-v3-turbo');
      const recordedFailure = failedModel ? (typeof mcFailed !== 'undefined' ? mcFailed[failedModel.id] : window.mcFailed?.[failedModel.id]) : null;

      // Check readiness after failure
      const readinessAfterFail = getVoiceTabReadiness();

      // Now run second call on fresh worker which succeeds
      let secondResult = null;
      try {
        secondResult = await rpc('asr', { model: 'large-v3-turbo', audio: new Float32Array(16000) });
      } catch (err) {}

      const readinessAfterSuccess = getVoiceTabReadiness();
      const mcFailedAfterSuccess = failedModel ? (typeof mcFailed !== 'undefined' ? mcFailed[failedModel.id] : window.mcFailed?.[failedModel.id]) : undefined;

      window.Worker = origWorker;

      return {
        caughtErr,
        worker1Terminated: workers[0]?.terminated,
        recordedFailure,
        readinessBeforeAsrOk: readinessBefore.asr.ok,
        readinessAfterFailAsrOk: readinessAfterFail.asr.ok,
        readinessAfterFailAsrReason: readinessAfterFail.asr.reason,
        readinessAfterSuccessAsrOk: readinessAfterSuccess.asr.ok,
        mcFailedAfterSuccess,
        secondResultText: secondResult?.text
      };
    });

    // (a) BEFORE any failure getVoiceTabReadiness().asr.ok === true;
    expect(result.readinessBeforeAsrOk).toBe(true);

    // (b) after the fatal failure asr.ok === false AND asr.reason equals the friendly out-of-memory message recorded in mcFailed (not the text 'Model not downloaded');
    expect(result.caughtErr).not.toContain("Can't create a session");
    expect(result.caughtErr).toContain('out of memory');
    expect(result.worker1Terminated).toBe(true);
    expect(result.recordedFailure).toBeTruthy();
    expect(result.readinessAfterFailAsrOk).toBe(false);
    expect(result.readinessAfterFailAsrReason).toBe(result.recordedFailure);
    expect(result.readinessAfterFailAsrReason).not.toContain('Model not downloaded');

    // (c) after the successful second call asr.ok === true and mcFailed for that model is gone
    expect(result.readinessAfterSuccessAsrOk).toBe(true);
    expect(result.mcFailedAfterSuccess).toBeFalsy();
    expect(result.secondResultText).toBe('Recovered speech text');
  });
});
