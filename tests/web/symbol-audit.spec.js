'use strict';
const { test, expect } = require('../support/fixtures');
const { auditAll } = require('../../tools/audit-symbols');

test.describe('Static and AST guard: use-before-declaration & script load order', () => {

  test('audit script verifies zero use-before-declaration or load-order violations', () => {
    const { issues, sampleOk } = auditAll();

    if (issues.length > 0) {
      const issueDetails = issues.map(i => `${i.name} defined at ${i.defined}, first used at ${i.firstUsed}: ${i.reason}`).join('\n');
      expect(issues.length, `Expected 0 TDZ or load-order violations, but found:\n${issueDetails}`).toBe(0);
    } else {
      expect(issues).toEqual([]);
    }

    expect(sampleOk.length).toBeGreaterThanOrEqual(5);
    for (const item of sampleOk) {
      expect(item.orderOk).toBe('yes');
    }
  });
});
