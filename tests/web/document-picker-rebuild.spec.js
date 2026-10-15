'use strict';
// Tests for Document tab engine picker rebuilding on language switch and picker interaction.
const { test, expect, mouseClick, onlyEngines } = require('../support/fixtures');

test.describe('Document tab engine picker rebuild and preservation', () => {
  test.use({ appOptions: { seed: { cfg: onlyEngines(['google', 'mymemory', 'ollama', 'nllb']), src: 'en', tgt: 'fa' } } });

  test('picker survives interface language toggle and Ollama refresh with zero errors and preserves chosen engine', async ({ app }) => {
    const { page, errors } = app;

    // 1. Open the Document tab
    await mouseClick(page, page.locator('#tabs button[data-tab="doc"]'));
    const picker = page.locator('#dEngineSel');
    await expect(picker, '#dEngineSel should be visible').toBeVisible();

    // Verify initial "Same as Text tab" option exists
    const firstOption = picker.locator('option').first();
    await expect(firstOption).toHaveValue('');
    await expect(firstOption).toHaveText(/Same as Text tab/i);

    // 2. Previously choose an engine
    await picker.selectOption('google');
    await expect(picker).toHaveValue('google');

    // 3. Switch interface language to Persian
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    // 4. Switch interface language back to English
    await mouseClick(page, page.locator('#uiLang'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // 5. Refresh the Ollama models (picker click)
    await mouseClick(page, picker);
    await page.waitForTimeout(300);

    // 6. Verify zero page errors
    const pageErrors = errors.filter(e => e.startsWith('uncaught:'));
    expect(pageErrors, 'zero page errors').toEqual([]);
    expect(errors, 'zero console or page errors').toEqual([]);

    // 7. Verify the picker still has the "Same as Text tab" option plus engine options
    const options = picker.locator('option');
    expect(await options.count()).toBeGreaterThan(1);
    await expect(picker.locator('option').first()).toHaveValue('');
    await expect(picker.locator('option').first()).toHaveText(/Same as Text tab/i);

    const values = await picker.locator('option').evaluateAll(opts => opts.map(o => o.value));
    expect(values).toContain('');
    expect(values).toContain('google');
    expect(values).toContain('mymemory');

    // 8. Verify the previously chosen engine stays selected
    await expect(picker).toHaveValue('google');
  });
});
