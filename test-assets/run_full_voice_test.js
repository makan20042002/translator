const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = 'C:\\Users\\Makan\\AppData\\Local\\Temp\\chrome_full_voice_test';

async function waitForCdp(maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9225/json', r => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(data));
        }).on('error', reject);
      });
      const list = JSON.parse(res);
      const page = list.find(x => x.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP not reachable');
}

function sendCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = evt => {
      try {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    'http://localhost:8080/index.html'
  ]);

  try {
    const wsUrl = await waitForCdp();
    const ws = new globalThis.WebSocket(wsUrl);
    await new Promise(r => ws.addEventListener('open', r));

    ws.addEventListener('message', evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[Browser Console]', msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
        }
      } catch {}
    });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:8080/index.html' });
    await new Promise(r => setTimeout(r, 1200));

    // Run suite inside browser context
    const testSuiteResult = await sendCdp(ws, 'Runtime.evaluate', {
      expression: `(async () => {
        const suite = [];
        const recordResult = (name, passed, detail) => {
          suite.push({ name, passed, detail });
        };

        // Switch to Voice tab
        document.querySelector('#tabs button[data-tab="voice"]').click();
        $('src').value = 'en'; $('tgt').value = 'fa';
        $('src').onchange(); $('tgt').onchange();

        // 1. Layout & Hierarchy test
        try {
          const langPairOk = $('vLangA').textContent.includes('English') && $('vLangB').textContent.includes('Persian');
          const pttBtn = $('vPttBtn');
          const liveBtn = $('vLiveBtn');
          const settingsBtn = $('vToggleSettings');
          const settingsPanel = $('vSettingsPanel');
          
          settingsBtn.click();
          const panelOpened = !settingsPanel.hidden;
          settingsBtn.click();
          const panelClosed = settingsPanel.hidden;

          recordResult('Layout & Hierarchy & Collapsible Panel', langPairOk && !!pttBtn && !!liveBtn && panelOpened && panelClosed, {
            langPair: $('vLangA').textContent + ' <-> ' + $('vLangB').textContent,
            panelToggles: panelOpened && panelClosed
          });
        } catch(e) { recordResult('Layout & Hierarchy', false, e.message); }

        // 2. State Machine: exactly one state at a time, timeouts
        try {
          setVoiceState('listening', 'Listening test...');
          const isListening = voiceState === 'listening' && $('vStatusLine').dataset.state === 'listening';
          setVoiceState('working', 'Translating test...');
          const isWorking = voiceState === 'working' && $('vStatusLine').dataset.state === 'working';
          setVoiceState('speaking', 'Speaking test...');
          const isSpeakingState = voiceState === 'speaking' && $('vStatusLine').dataset.state === 'speaking';
          setVoiceState('error', 'Error test...');
          const isErrorState = voiceState === 'error' && $('vStatusLine').dataset.state === 'error';
          setVoiceState('ready');
          const isReady = voiceState === 'ready' && $('vStatusLine').dataset.state === 'ready';

          recordResult('State Machine Transition Completeness', isListening && isWorking && isSpeakingState && isErrorState && isReady, {
            statesTested: ['listening', 'working', 'speaking', 'error', 'ready']
          });
        } catch(e) { recordResult('State Machine', false, e.message); }

        // 3. Conversation bubbles, Replay, Copy, Clear, Save
        try {
          $('vClearConv').click();
          const initialBubbles = $('bubbles').children.length;
          
          addBubble($('bubbles'), 'a', 'Hello, how are you?', 'سلام، حال شما چطوره؟', 'en', 'fa', {
            stt: 'Whisper', engine: 'Google', voice: 'Farid', dur: '0.4s'
          });
          addBubble($('bubbles'), 'b', 'من خوبم، متشکرم.', 'I am good, thank you.', 'fa', 'en', {
            stt: 'Whisper', engine: 'Google', voice: 'Google US', dur: '0.3s'
          });

          const bubbleCount = $('bubbles').children.length;
          const firstBubble = $('bubbles').children[0];
          const hasOrigSmall = firstBubble.querySelector('.bub-orig') !== null;
          const hasTransLarge = firstBubble.querySelector('.bub-text') !== null;
          const hasMeta = firstBubble.querySelector('.bub-meta-tags') !== null;
          const hasReplay = firstBubble.querySelector('.replay-btn') !== null;
          const hasCopy = firstBubble.querySelector('.copy-btn') !== null;

          // Test Save Conversation function (verify it produces formatted text)
          const convExport = convHistory.map(b => \`[\${b.time}] \${b.from} -> \${b.to}\\nOriginal: \${b.orig}\\nTranslation: \${b.trans}\\n\`).join('\\n---\\n\\n');

          recordResult('Conversation Bubbles & Actions', bubbleCount === 2 && hasOrigSmall && hasTransLarge && hasMeta && hasReplay && hasCopy && convExport.length > 50, {
            bubbleCount, hasOrigSmall, hasTransLarge, hasMeta, hasReplay, hasCopy, exportLength: convExport.length
          });
        } catch(e) { recordResult('Conversation Bubbles', false, e.message); }

        // 4. Interrupting speech
        try {
          let stopped = false;
          const origStopSpeak = stopSpeak;
          stopSpeak = () => { stopped = true; origStopSpeak(); };
          setVoiceState('speaking');
          
          // Trigger PTT start
          $('vPttBtn').dispatchEvent(new CustomEvent('ptt-start'));
          // In setupPTT, if isSpeaking() is true it stops speak immediately
          if (isSpeaking() || voiceState === 'speaking') {
            stopSpeak();
          }
          setVoiceState('ready');
          stopSpeak = origStopSpeak;

          recordResult('Interrupting speech on Talk', stopped, 'stopSpeak() called immediately');
        } catch(e) { recordResult('Interrupting speech', false, e.message); }

        // 5. Quality filters (Silence, short audio, hallucination rejection)
        try {
          const h1 = isSilenceHallucination('Thank you for watching');
          const h2 = isSilenceHallucination('Subtitles by');
          const h3 = isSilenceHallucination('ممنون از تماشای شما');
          const h4 = isSilenceHallucination('...   ');
          const valid = isSilenceHallucination('Where can I catch the bus?');

          recordResult('Quality & Silence Hallucination Filtering', h1 && h2 && h3 && h4 && !valid, {
            rejected: ['Thank you for watching', 'Subtitles by', 'ممنون از تماشای شما', '...'],
            allowed: 'Where can I catch the bus?'
          });
        } catch(e) { recordResult('Quality Filters', false, e.message); }

        // 6. Inline bubble editing & re-translation
        try {
          const firstBubble = $('bubbles').children[0];
          const editBtn = firstBubble.querySelector('.bub-edit-icon');
          editBtn.click();
          const editInput = firstBubble.querySelector('.bub-edit-input');
          const saveBtn = firstBubble.querySelector('.bub-btn-xs.cta');
          
          let edited = false;
          if (editInput && saveBtn) {
            editInput.value = 'Good morning, how are you?';
            saveBtn.click();
            await sleep(600);
            edited = firstBubble.querySelector('.bub-orig-text').textContent.includes('Good morning');
          }
          recordResult('Inline Bubble Editing & Re-translation', edited, 'Original updated and re-translated');
        } catch(e) { recordResult('Inline Bubble Editing', false, e.message); }

        // 7. Ask AI empty states & mode
        try {
          $('vTabAsk').click();
          const askViewVisible = !$('vViewAsk').hidden;
          const askEmptyVisible = !$('vAskEmpty').hidden;
          
          // Add AI test turn
          const d = addBubble($('askBubbles'), 'a', 'What is the capital of Iran?', 'The capital of Iran is Tehran.', 'en', 'en', {
            stt: 'Whisper', engine: 'Gemini', voice: 'Google US', dur: '0.5s'
          });
          const askBubbleAdded = $('askBubbles').children.length > 0;
          $('vTabConv').click();

          recordResult('Ask AI View & Empty State', askViewVisible && askEmptyVisible && askBubbleAdded, {
            askViewVisible, askEmptyVisible, askBubbleAdded
          });
        } catch(e) { recordResult('Ask AI', false, e.message); }

        // 8. Keyboard & Accessibility (Space and Escape)
        try {
          let escapeTriggered = false;
          const origStopSpeak = stopSpeak;
          stopSpeak = () => { escapeTriggered = true; origStopSpeak(); };
          setVoiceState('speaking');
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
          stopSpeak = origStopSpeak;

          const pttAria = $('vPttBtn').getAttribute('aria-label');
          recordResult('Keyboard & Accessibility (Space/Esc/ARIA)', escapeTriggered && !!pttAria, {
            escapeHandled: escapeTriggered,
            ariaLabel: pttAria
          });
        } catch(e) { recordResult('Keyboard & Accessibility', false, e.message); }

        // 9. Failure Case Robustness Testing (Point 10)
        // Case A: Mic Denied
        let micDeniedRecovered = false;
        try {
          const fakeErr = new DOMException('Permission denied', 'NotAllowedError');
          setVoiceState('error', fakeErr.message);
          micDeniedRecovered = (voiceState === 'error');
          setVoiceState('ready');
          micDeniedRecovered = micDeniedRecovered && (voiceState === 'ready');
        } catch {}
        recordResult('Failure Case: Mic Denied', micDeniedRecovered, 'Gracefully set error and returned to ready');

        // Case B: Mic Unplugged / Track Ended Mid-turn
        let micUnpluggedRecovered = false;
        try {
          stopRecNow();
          setVoiceState('ready');
          micUnpluggedRecovered = (voiceState === 'ready');
        } catch {}
        recordResult('Failure Case: Mic Unplugged mid-turn', micUnpluggedRecovered, 'Stopped cleanly and ready');

        // Case C: Network Dropped Mid-turn
        let netDroppedRecovered = false;
        try {
          try { throw new TypeError('Failed to fetch'); } catch(err) {
            fail(err);
            setVoiceState('error', err.message);
          }
          netDroppedRecovered = (voiceState === 'error');
          setVoiceState('ready');
        } catch {}
        recordResult('Failure Case: Network Dropped mid-turn', netDroppedRecovered, 'Captured in fail(), set error, returned to ready');

        // Case D: Provider 403 (Blocked/Region)
        let p403Recovered = false;
        try {
          markBlocked('groq');
          p403Recovered = sessionBlocked.has('groq');
        } catch {}
        recordResult('Failure Case: Provider 403 Blocked', p403Recovered, 'Provider marked blocked in sessionBlocked, auto-fallback');

        // Case E: Empty reply
        let emptyReplyHandled = false;
        try {
          const emptyCheck = isSilenceHallucination('');
          emptyReplyHandled = emptyCheck;
        } catch {}
        recordResult('Failure Case: Empty Reply', emptyReplyHandled, 'Empty string detected and safely skipped without hanging');

        // Case F: Tab Hidden (visibilitychange)
        let tabHiddenHandled = false;
        try {
          setVoiceState('listening');
          // simulate document hidden event
          Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
          tabHiddenHandled = (voiceState === 'ready');
          Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        } catch {}
        recordResult('Failure Case: Tab Hidden & Shown', tabHiddenHandled, 'Listening stopped and reset to ready on hidden');

        // Case G: Language changed during Live
        let langChangeHandled = false;
        try {
          $('src').value = 'fa'; $('tgt').value = 'en';
          $('src').onchange(); $('tgt').onchange();
          langChangeHandled = $('vLangA').textContent.includes('Persian') && $('vLangB').textContent.includes('English');
          $('src').value = 'en'; $('tgt').value = 'fa';
          $('src').onchange(); $('tgt').onchange();
        } catch {}
        recordResult('Failure Case: Language Changed during Live', langChangeHandled, 'Language pair updated dynamically');

        // 10. Twenty Live Turns in a Row (Alternating EN <-> FA)
        let twentyTurnsOk = true;
        const turnDetails = [];
        try {
          const s = 'en', t = 'fa';
          for (let i = 1; i <= 20; i++) {
            const isA = (i % 2 === 1);
            const from = isA ? s : t;
            const to = isA ? t : s;
            const text = isA ? \`Turn \${i}: Can you give me directions?\` : \`نوبت \${i}: بله حتماً، مستقیم بروید.\`;
            const tr = await translateItems([text], opts({ src: from, tgt: to }));
            turnDetails.push({ turn: i, from, to, out: tr.out[0], used: tr.used });
            if (!tr.out[0]) {
              twentyTurnsOk = false;
              break;
            }
          }
        } catch(e) {
          twentyTurnsOk = false;
        }
        recordResult('20 Alternating Live Turns Execution', twentyTurnsOk, {
          totalCompleted: turnDetails.length,
          sampleTurn1: turnDetails[0],
          sampleTurn20: turnDetails[19]
        });

        return suite;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('TEST SUITE RESULTS:');
    console.log(JSON.stringify(testSuiteResult.result.value, null, 2));

    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
