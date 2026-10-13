'use strict';

const { test, expect, onlyEngines, mouseClick, chooseFile, VALID_KEY } = require('../support/fixtures');

test.describe('Item 3: Voice PTT lifecycle, mode switching, and Document download layout', () => {

  test.describe('Voice mode switching and unoccluded Talk buttons', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']), src: 'en', tgt: 'fa' } } });

    test('#vTabConv is clickable and switches back to Conversation mode after Ask AI scroll', async ({ app }) => {
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      // Switch to Ask AI
      await mouseClick(page, page.locator('#vTabAsk'));
      await expect(page.locator('#vViewAsk')).toBeVisible();
      await expect(page.locator('#vAskPttBtn')).toBeVisible();

      // Scroll Ask AI talk button into view
      await page.locator('#vAskPttBtn').scrollIntoViewIfNeeded();

      // Switch back to Conversation mode via real click
      await mouseClick(page, page.locator('#vTabConv'));
      const pttBtn = page.locator('#vPttBtn');
      await expect(pttBtn).toBeVisible();

      // Verify scroll-margin prevents sticky header occlusion
      const box = await page.locator('#vTabConv').boundingBox();
      expect(box).not.toBeNull();
      const topEl = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el.id || el.className || el.tagName.toLowerCase()) : 'null';
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(topEl).toMatch(/vTabConv/);
    });
  });

  test.describe('Voice PTT release processing without cancelled flag leak', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['gemini', 'google'], { gemini: VALID_KEY }), stt: 'gemini' }, src: 'en', tgt: 'fa' } } });

    test('holding Talk after switching to Conversation view creates a translated bubble', async ({ app }) => {
      test.setTimeout(60_000);
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      // Explicitly click conversation tab (which calls resetPttState)
      await mouseClick(page, page.locator('#vTabConv'));

      const btn = page.locator('#vPttBtn');
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();

      // Hold Talk for 2.6 seconds
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(2600);
      await page.mouse.up();

      // A bubble must appear and receive translated text
      const bub = page.locator('#bubbles .bub').first();
      await expect(bub.locator('.bub-text')).toBeVisible({ timeout: 20_000 });
      await expect(bub.locator('.bub-orig-text')).toHaveText('hello from the fake microphone');
    });
  });

  test.describe('Ask AI PTT release processing with Groq', () => {
    test.use({ appOptions: { seed: { cfg: { ...onlyEngines(['google', 'groq'], { groq: VALID_KEY }), stt: 'groq' }, src: 'en', tgt: 'fa' } } });

    test('holding Ask AI Talk after mode switch transcribes question and displays answer bubble', async ({ app }) => {
      test.setTimeout(60_000);
      const { page } = app;
      await mouseClick(page, page.locator('#tabs button[data-tab="voice"]'));

      // Switch to Ask AI (calls resetPttState)
      await mouseClick(page, page.locator('#vTabAsk'));

      const btn = page.locator('#vAskPttBtn');
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();

      // Hold Ask AI Talk
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(2600);
      await page.mouse.up();

      // Answer bubble must be displayed
      const answerBub = page.locator('#askBubbles .bub.b .bub-text');
      await expect(answerBub).toBeVisible({ timeout: 30_000 });
      await expect(answerBub).toHaveText('This is the stub assistant answer.');
    });
  });

  test.describe('Document tab viewport bounds and Download button accessibility', () => {
    test.use({ appOptions: { seed: { cfg: onlyEngines(['google']) } } });

    test('Download button remains within 900px viewport after file translation', async ({ app, files }) => {
      const { page } = app;
      await page.setViewportSize({ width: 1280, height: 900 });
      await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
      await chooseFile(page, page.locator('#dDrop'), files.txt);
      await mouseClick(page, page.locator('#dGo'));

      const saveBtn = page.locator('#dSave');
      await expect(saveBtn).toBeEnabled({ timeout: 30_000 });

      // Get bounding box without scrolling
      const box = await saveBtn.boundingBox();
      expect(box).not.toBeNull();

      // Verify button center coordinate is strictly inside 900px viewport
      const centerY = box.y + box.height / 2;
      expect(centerY, `center Y of #dSave (${centerY}) should be < 900`).toBeLessThan(900);

      // Verify elementFromPoint returns #dSave directly
      const onTop = await page.evaluate(({ x, y }) => {
        const e = document.elementFromPoint(x, y);
        return e ? (e.id || e.className || e.tagName.toLowerCase()) : null;
      }, { x: box.x + box.width / 2, y: centerY });

      expect(onTop, 'element at center of #dSave').toBe('dSave');
    });
  });

});
