'use strict';
// Playwright settings for the MAKAN Translate test suite. Run through `npm test`.
const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  outputDir: path.join(__dirname, '.results', 'artifacts'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(__dirname, '.results', 'results.json') }]
  ],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15_000 },
  projects: [
    { name: 'web', testMatch: /web\/.*\.spec\.js$/ },
    { name: 'ext', testMatch: /ext\/.*\.spec\.js$/ }
  ]
});
