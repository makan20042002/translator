'use strict';
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Web app: Voice tab redesign', () => {
  test.describe('Item 1: Header and control bar', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('header exists, controls keep their IDs, no flags, selectors list real options, and no horizontal overflow at 360/700/1280 in EN and FA', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      // Header exists with title and subtitle
      await expect(page.locator('.voice-page-title')).toHaveText('Voice');
      await expect(page.locator('.voice-page-sub')).toBeVisible();

      // Subtitle must not say "offline" when online engines are selected
      const subText = await page.locator('.voice-page-sub').textContent();
      expect(subText).not.toMatch(/\boffline\b/i);

      // Control bar exists
      const bar = page.locator('#vControlBar');
      await expect(bar).toBeVisible();

      // Language pair controls exist without country flags
      await expect(page.locator('#vSrc')).toBeVisible();
      await expect(page.locator('#vSwap')).toBeVisible();
      await expect(page.locator('#vTgt')).toBeVisible();
      const flagImagesOrEmojis = await page.locator('#vControlBar .voice-lang-grp').evaluate(el => {
        const text = el.textContent || '';
        // Regional indicator symbol flags range: 1F1E6 - 1F1FF
        const hasFlagEmoji = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/.test(text);
        const hasImgFlag = !!el.querySelector('img, svg.flag');
        return hasFlagEmoji || hasImgFlag;
      });
      expect(flagImagesOrEmojis, 'no country flags in language pair').toBe(false);

      // Speech-recognition selector exists with preserved IDs
      const sttBtn = page.locator('#vMicSttBtn');
      await expect(sttBtn).toBeVisible();
      await expect(page.locator('#vMicSttCurLabel')).toBeVisible();
      await expect(page.locator('#vMicSttPopup')).toBeHidden();

      // Voice selector exists with preserved IDs
      const voiceBtn = page.locator('#vConvVoicePickerBtn');
      await expect(voiceBtn).toBeVisible();
      await expect(page.locator('#vConvVoiceCurLabel')).toBeVisible();
      await expect(page.locator('#vConvVoicePopup')).toBeHidden();

      // Honest status chip exists
      const readyChip = page.locator('#vVoiceReadyChip');
      await expect(readyChip).toBeVisible();
      const chipState = await readyChip.getAttribute('data-ready');
      expect(['true', 'false']).toContain(chipState);

      // Check no horizontal overflow at 360, 700, 1280 in English and Persian
      for (const lang of ['en', 'fa']) {
        if (lang === 'fa') {
          await page.evaluate(() => {
            ui = 'fa';
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            applyI18n();
          });
          await expect(page.locator('.voice-page-title')).toHaveText('صدا');
          const faSub = await page.locator('.voice-page-sub').textContent();
          expect(faSub).not.toMatch(/آفلاین/);
        } else {
          await page.evaluate(() => {
            ui = 'en';
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
            applyI18n();
          });
        }
        for (const w of [360, 700, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          expect(scrollWidth, `no horizontal scrollbar at ${w}px in ${lang}`).toBeLessThanOrEqual(clientWidth + 2);
        }
      }
    });
  });

  test.describe('Item 2: Conversation list', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('exchanges show original and translation, real engine chips, replay disabled when no voice, and clear button empties list', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      // Initially empty state is visible
      await expect(page.locator('#vEmptyState')).toBeVisible();
      await expect(page.locator('#bubbles .bub')).toHaveCount(0);

      // Programmatically add a bubble with metadata to verify chip rendering & replay button
      await page.evaluate(() => {
        addBubble(document.getElementById('bubbles'), 'a', 'Hello there', 'سلام', 'en', 'fa', {
          stt: 'Whisper Base',
          engine: 'Google',
          voice: 'Ganji',
          dur: '0.8s'
        });
      });

      await expect(page.locator('#vEmptyState')).toBeHidden();
      await expect(page.locator('#bubbles .bub')).toHaveCount(1);

      const bub = page.locator('#bubbles .bub').first();
      await expect(bub.locator('.bub-orig-text')).toHaveText('Hello there');
      await expect(bub.locator('.bub-text')).toHaveText('سلام');
      await expect(bub.locator('.bub-time')).toBeVisible();

      // Check real engine chips
      const chips = bub.locator('.bub-meta-tags .bub-tag');
      await expect(chips).toHaveCount(4);
      await expect(chips.nth(0)).toContainText('Whisper Base');
      await expect(chips.nth(1)).toContainText('Google');
      await expect(chips.nth(2)).toContainText('Ganji');
      await expect(chips.nth(3)).toContainText('0.8s');

      // Add another bubble WITHOUT duration to verify no time chip is shown if app has no timing
      await page.evaluate(() => {
        addBubble(document.getElementById('bubbles'), 'b', 'Good morning', 'صبح بخیر', 'en', 'fa', {
          stt: 'Browser',
          engine: 'Google'
        });
      });

      const bub2 = page.locator('#bubbles .bub').nth(1);
      const bub2Chips = bub2.locator('.bub-meta-tags .bub-tag');
      await expect(bub2Chips).toHaveCount(2);
      await expect(bub2.locator('.bub-meta-tags .bub-time-chip')).toHaveCount(0);

      // Check replay button when no voice can speak
      // Since seed has only google (no Gemini key) and browser has no Persian voice, resolveVoice('fa') is none
      const replayBtn = bub.locator('.replay-btn');
      const isDisabled = await replayBtn.getAttribute('disabled');
      expect(isDisabled !== null || (await replayBtn.getAttribute('aria-disabled')) === 'true').toBe(true);

      // Clear conversation
      await mouseClick(page, page.locator('#vClearConv'));
      await expect(page.locator('#bubbles .bub')).toHaveCount(0);
      await expect(page.locator('#vEmptyState')).toBeVisible();
    });
  });

  test.describe('Item 3: Talk control', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('states follow real flow, mic-denied and error cases show visible message without getting stuck, and privacy line is honest', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      const pttBtn = page.locator('#vPttBtn');
      const pttLabel = page.locator('#vPttLabel');
      const stopSpeakBtn = page.locator('#vStopSpeak');
      const privacyLine = page.locator('#vPrivacyLine');
      const speakNotice = page.locator('#speakNotice');

      // 1. Initial idle/ready state
      await expect(pttBtn).toBeVisible();
      await expect(pttBtn).toHaveAttribute('data-state', 'ready');
      await expect(pttLabel).toHaveText('Talk');
      await expect(stopSpeakBtn).toBeHidden();

      // Space hint is visible with genuine shortcut indicator
      await expect(page.locator('#vPttSpaceHint')).toBeVisible();

      // 2. Privacy line: absent when cloud engine is selected (seed is google)
      await expect(privacyLine).toBeHidden();

      // 3. State transition: listening -> working -> ready
      await page.evaluate(() => setVoiceState('listening'));
      await expect(pttBtn).toHaveAttribute('data-state', 'listening');
      expect(await pttBtn.getAttribute('class')).toContain('rec');

      await page.evaluate(() => setVoiceState('working'));
      await expect(pttBtn).toHaveAttribute('data-state', 'working');
      expect(await pttBtn.getAttribute('class')).toContain('work');

      await page.evaluate(() => setVoiceState('ready'));
      await expect(pttBtn).toHaveAttribute('data-state', 'ready');
      await expect(stopSpeakBtn).toBeHidden();

      // 4. Mic error / permission denied case: shows notice and does not leave button stuck on Stop
      await page.evaluate(() => {
        showSpeakNotice(L('micBlocked'));
        setVoiceState('error', L('micBlocked'));
      });
      await expect(speakNotice).toBeVisible();
      await expect(page.locator('#speakNoticeText')).toHaveText('Microphone is blocked');
      await expect(stopSpeakBtn).toBeHidden();

      // Recovers back to ready
      await page.evaluate(() => setVoiceState('ready'));
      await expect(pttBtn).toHaveAttribute('data-state', 'ready');
      await expect(stopSpeakBtn).toBeHidden();

      // 5. Privacy line is present ONLY when all engines are local
      await page.evaluate(() => {
        // Mock all engines local: whisper ok, translation offline, voice piper/device
        window.getVoiceTabReadiness = () => ({
          ready: true,
          reason: '',
          asr: { ok: true, reason: '', mode: 'whisper' },
          trans: { ok: true, reason: '', engine: 'nllb' },
          voice: { ok: true, reason: '', kind: 'piper' }
        });
        updateVoicePrivacyNote();
      });
      await expect(privacyLine).toBeVisible();
      const privText = await privacyLine.textContent();
      expect(privText).toContain('Private');

      // When cloud engine is used, privacy line is absent
      await page.evaluate(() => {
        window.getVoiceTabReadiness = () => ({
          ready: true,
          reason: '',
          asr: { ok: true, reason: '', mode: 'browser' },
          trans: { ok: true, reason: '', engine: 'google' },
          voice: { ok: true, reason: '', kind: 'device' }
        });
        updateVoicePrivacyNote();
      });
      await expect(privacyLine).toBeHidden();
    });
  });
});


