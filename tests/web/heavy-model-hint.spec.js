'use strict';
/**
 * Test Item 4: Heavy-model hint.
 * - In Model Hub, show the approximate RAM already listed for each model.
 * - When the user selects Whisper Large v3 Turbo or any model with RAM >= 3 GB as the active one,
 *   show a short hint that it needs several GB of free memory and that a smaller model is more reliable.
 * - Do not block the user.
 */
const { test, expect, onlyEngines } = require('../support/fixtures');

test.describe('Model Hub heavy-model RAM display and hint', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

  test('Model Hub displays approximate RAM for each model', async ({ app }) => {
    const { page } = app;
    const cat = await page.evaluate(() => {
      if (typeof renderModelHub === 'function') renderModelHub();
      const cards = Array.from(document.querySelectorAll('.hub-model-card'));
      return cards.map(c => ({
        id: c.dataset.hubMdl,
        text: c.textContent
      }));
    });

    expect(cat.length).toBeGreaterThan(0);
    for (const item of cat) {
      expect(item.text).toContain('RAM ≈');
    }
  });

  test('selecting Whisper Large v3 Turbo triggers non-blocking heavy model warning hint', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(async () => {
      const toasts = [];
      const origToast = window.toast;
      window.toast = (msg, type) => toasts.push({ msg, type });

      const turbo = (self.MODEL_CATALOG?.models || []).find(m => m.key === 'large-v3-turbo');
      window.checkHeavyModelHint(turbo);

      // Verify user is not blocked when selecting
      if ($('offWhisperSel')) {
        $('offWhisperSel').value = 'large-v3-turbo';
        $('offWhisperSel').dispatchEvent(new Event('change'));
      }

      window.toast = origToast;
      return {
        toasts,
        activeWhisper: window.cfg.whisper
      };
    });

    expect(result.toasts.length).toBeGreaterThan(0);
    expect(result.toasts[0].type).toBe('warn');
    expect(result.toasts[0].msg).toContain('free memory');
    // Selection was not blocked
    expect(result.activeWhisper).toBe('large-v3-turbo');
  });

  test('selecting a model with RAM >= 3 GB triggers hint, while lighter model does not', async ({ app }) => {
    const { page } = app;
    const result = await page.evaluate(() => {
      const toasts = [];
      const origToast = window.toast;
      window.toast = (msg, type) => toasts.push({ msg, type });

      const light = (self.MODEL_CATALOG?.models || []).find(m => m.key === 'tiny');
      const heavyTr = (self.MODEL_CATALOG?.models || []).find(m => m.id === 'tr-nllb-600');

      window.checkHeavyModelHint(light);
      const lightToastsCount = toasts.length;

      window.checkHeavyModelHint(heavyTr);
      const heavyToastsCount = toasts.length;

      window.toast = origToast;
      return {
        lightToastsCount,
        heavyToastsCount,
        heavyToastMsg: toasts[toasts.length - 1]?.msg
      };
    });

    expect(result.lightToastsCount).toBe(0);
    expect(result.heavyToastsCount).toBe(1);
    expect(result.heavyToastMsg).toContain('free memory');
  });
});
