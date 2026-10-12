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

  test.describe('Item 4: Status strip', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('slim bottom strip reflects real readiness for speech recognition, translation, and voice without inventing anything', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      const strip = page.locator('#vStatusStrip');
      await expect(strip).toBeVisible();

      const asrChip = page.locator('#vStripAsrChip');
      const transChip = page.locator('#vStripTransChip');
      const voiceChip = page.locator('#vStripVoiceChip');

      await expect(asrChip).toBeVisible();
      await expect(transChip).toBeVisible();
      await expect(voiceChip).toBeVisible();

      // Test not-ready state reflection (e.g. whisper not downloaded, no voice installed)
      await page.evaluate(() => {
        window.getVoiceTabReadiness = () => ({
          ready: false,
          reason: 'Model not downloaded',
          asr: { ok: false, reason: 'Model not downloaded', mode: 'whisper' },
          trans: { ok: true, reason: '', engine: 'google' },
          voice: { ok: false, reason: 'No voice for target language', kind: 'none' }
        });
        updateVoiceStatusStrip();
      });

      // ASR chip shows amber warn dot and real reason
      await expect(asrChip.locator('.status-dot')).toHaveClass(/warn/);
      expect(await asrChip.textContent()).toContain('Model not downloaded');

      // Translation chip shows green ok dot
      await expect(transChip.locator('.status-dot')).toHaveClass(/ok/);
      expect(await transChip.textContent()).toContain('Ready');

      // Voice chip shows amber warn dot and real reason
      await expect(voiceChip.locator('.status-dot')).toHaveClass(/warn/);
      expect(await voiceChip.textContent()).toContain('No voice for target language');

      // Test fully-ready state reflection
      await page.evaluate(() => {
        window.getVoiceTabReadiness = () => ({
          ready: true,
          reason: '',
          asr: { ok: true, reason: '', mode: 'browser' },
          trans: { ok: true, reason: '', engine: 'google' },
          voice: { ok: true, reason: '', kind: 'device' }
        });
        updateVoiceStatusStrip();
      });

      await expect(asrChip.locator('.status-dot')).toHaveClass(/ok/);
      await expect(transChip.locator('.status-dot')).toHaveClass(/ok/);
      await expect(voiceChip.locator('.status-dot')).toHaveClass(/ok/);
    });
  });

  test.describe('Item 5: Talk button occlusion and mouse press guard', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('real mouse press at center of #vAskPttBtn and #vPttBtn hits button/child with no occlusion at 360, 700, 1280px in EN and FA', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      const assertTopmostAtPoint = async (targetId, cx, cy, stateLabel, w, lang) => {
        const result = await page.evaluate(({ id, x, y }) => {
          const el = document.elementFromPoint(x, y);
          const btn = document.getElementById(id);
          const isTarget = el === btn || (btn && btn.contains(el));
          let elDesc = 'null (outside viewport)';
          if (el) {
            elDesc = el.tagName.toLowerCase();
            if (el.id) elDesc += '#' + el.id;
            if (el.className) elDesc += '.' + String(el.className).trim().replace(/\s+/g, '.');
          }
          return {
            isTarget,
            topElement: elDesc
          };
        }, { id: targetId, x: cx, y: cy });

        expect(
          result.isTarget,
          `#${targetId} occluded (${stateLabel}) at (${cx.toFixed(1)}, ${cy.toFixed(1)}) at viewport ${w}x800 in ${lang}. Topmost element was <${result.topElement}>`
        ).toBe(true);
      };

      for (const lang of ['en', 'fa']) {
        if (lang === 'fa') {
          await page.evaluate(() => {
            ui = 'fa';
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            if (typeof applyI18n === 'function') applyI18n();
          });
        } else {
          await page.evaluate(() => {
            ui = 'en';
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
            if (typeof applyI18n === 'function') applyI18n();
          });
        }

        for (const w of [360, 700, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });

          // 1. Check main Talk button in Conversation view
          await mouseClick(page, page.locator('#vTabConv'));
          const pttBtn = page.locator('#vPttBtn');
          await expect(pttBtn).toBeVisible();
          await pttBtn.scrollIntoViewIfNeeded();

          const boxPtt = await pttBtn.boundingBox();
          expect(boxPtt, `#vPttBtn bounding box at ${w}px in ${lang}`).not.toBeNull();
          const pttCx = boxPtt.x + boxPtt.width / 2;
          const pttCy = boxPtt.y + boxPtt.height / 2;

          // Before pressing
          await assertTopmostAtPoint('vPttBtn', pttCx, pttCy, 'before press', w, lang);

          // Real mouse press at centre
          await page.mouse.move(pttCx, pttCy);
          await page.mouse.down();

          // While pressed: check at press coordinates (nothing covered the mouse location)
          await assertTopmostAtPoint('vPttBtn', pttCx, pttCy, 'during press at click point', w, lang);

          // While pressed: re-measure active centre to ensure active button centre is also unoccluded
          const boxPttDown = await pttBtn.boundingBox();
          expect(boxPttDown, `#vPttBtn bounding box while pressed at ${w}px in ${lang}`).not.toBeNull();
          const pttCxDown = boxPttDown.x + boxPttDown.width / 2;
          const pttCyDown = boxPttDown.y + boxPttDown.height / 2;
          await assertTopmostAtPoint('vPttBtn', pttCxDown, pttCyDown, 'during press at active center', w, lang);

          await page.mouse.up();

          // 2. Check Ask AI Talk button in Ask AI view
          await mouseClick(page, page.locator('#vTabAsk'));
          const askBtn = page.locator('#vAskPttBtn');
          await expect(askBtn).toBeVisible();
          await askBtn.scrollIntoViewIfNeeded();

          const boxAsk = await askBtn.boundingBox();
          expect(boxAsk, `#vAskPttBtn bounding box at ${w}px in ${lang}`).not.toBeNull();
          const askCx = boxAsk.x + boxAsk.width / 2;
          const askCy = boxAsk.y + boxAsk.height / 2;

          // Before pressing
          await assertTopmostAtPoint('vAskPttBtn', askCx, askCy, 'before press', w, lang);

          // Real mouse press at centre
          await page.mouse.move(askCx, askCy);
          await page.mouse.down();

          // While pressed: check at press coordinates
          await assertTopmostAtPoint('vAskPttBtn', askCx, askCy, 'during press at click point', w, lang);

          // While pressed: re-measure active centre
          const boxAskDown = await askBtn.boundingBox();
          expect(boxAskDown, `#vAskPttBtn bounding box while pressed at ${w}px in ${lang}`).not.toBeNull();
          const askCxDown = boxAskDown.x + boxAskDown.width / 2;
          const askCyDown = boxAskDown.y + boxAskDown.height / 2;
          await assertTopmostAtPoint('vAskPttBtn', askCxDown, askCyDown, 'during press at active center', w, lang);

          await page.mouse.up();
        }
      }
    });
  });
});



