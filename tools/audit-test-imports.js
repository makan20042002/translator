'use strict';
/**
 * Audit test specs for proper imports/definitions of activateSettingsTab and openSettings.
 * Scans all *.spec.js files under tests/ and verifies every call is backed by an import or definition.
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT_DIR, 'tests');

function findSpecFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findSpecFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.spec.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function auditSpecFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', locations: true, sourceType: 'script' });
  } catch (err) {
    return null;
  }

  const declared = new Set();
  const uses = new Set();
  const sources = {};

  function walkDecls(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        let fromModule = '';
        if (decl.init && decl.init.type === 'CallExpression' && decl.init.callee?.name === 'require') {
          const arg = decl.init.arguments[0];
          if (arg && typeof arg.value === 'string') fromModule = arg.value;
        }
        if (decl.id.type === 'Identifier') {
          declared.add(decl.id.name);
          if (fromModule) sources[decl.id.name] = `imported (${fromModule})`;
          else sources[decl.id.name] = 'locally defined';
        } else if (decl.id.type === 'ObjectPattern') {
          for (const prop of decl.id.properties) {
            if (prop.value && prop.value.type === 'Identifier') {
              declared.add(prop.value.name);
              if (fromModule) sources[prop.value.name] = `imported (${fromModule})`;
              else sources[prop.value.name] = 'locally defined';
            }
          }
        }
      }
    } else if (node.type === 'FunctionDeclaration' && node.id) {
      declared.add(node.id.name);
      sources[node.id.name] = 'locally defined';
    }

    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walkDecls);
      else if (v && typeof v === 'object') walkDecls(v);
    }
  }
  walkDecls(ast);

  function walkCalls(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'Identifier') {
        const name = node.callee.name;
        if (name === 'activateSettingsTab' || name === 'openSettings') {
          uses.add(name);
        }
      } else if (node.callee.type === 'MemberExpression') {
        // e.g. require('../support/fixtures').activateSettingsTab(...)
        if (node.callee.property?.name === 'activateSettingsTab' || node.callee.property?.name === 'openSettings') {
          const name = node.callee.property.name;
          uses.add(name);
          declared.add(name);
          sources[name] = 'qualified require call';
        }
      }
    }

    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(item => walkCalls(item, node));
      else if (v && typeof v === 'object') walkCalls(v, node);
    }
  }
  walkCalls(ast, null);

  if (uses.size === 0) return null;

  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const results = [];
  for (const sym of Array.from(uses).sort()) {
    const isDeclared = declared.has(sym);
    results.push({
      spec: relPath,
      symbol: sym,
      definedAs: isDeclared ? sources[sym] : 'NOT IMPORTED / NOT DEFINED',
      ok: isDeclared ? 'yes' : 'NO'
    });
  }
  return results;
}

function auditTestImports() {
  const files = findSpecFiles(TESTS_DIR);
  const rows = [];
  for (const f of files) {
    const res = auditSpecFile(f);
    if (res) rows.push(...res);
  }
  return rows;
}

function printTable(rows) {
  console.log('| spec | uses | imports or defines | OK |');
  console.log('| --- | --- | --- | --- |');
  for (const r of rows) {
    console.log(`| ${r.spec} | ${r.symbol} | ${r.definedAs} | ${r.ok} |`);
  }
}

if (require.main === module) {
  const rows = auditTestImports();
  printTable(rows);
  const failures = rows.filter(r => r.ok !== 'yes');
  if (failures.length > 0) {
    console.error(`\nFAILED: ${failures.length} missing import(s) detected.`);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${rows.length} uses are properly imported or defined.`);
  }
}

module.exports = { auditTestImports, auditSpecFile, findSpecFiles };
