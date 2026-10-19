'use strict';
/**
 * tests/static-no-undef.test.js
 * ITEM 3: Permanent static guard for undefined identifiers in browser scripts.
 * Collects top-level declarations across all scripts loaded in index.html,
 * checks every script against the unified global scope using acorn and eslint-scope,
 * and reports any undeclared variable references (preventing ReferenceErrors).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const eslintScope = require('eslint-scope');

const ROOT = path.resolve(__dirname, '..');

// Standard browser, DOM, and runtime globals
const BROWSER_GLOBALS = new Set([
  // JavaScript runtime primitive values and globals (ECMA-262)
  'undefined', 'NaN', 'Infinity',
  // Window / global scopes
  'window', 'self', 'globalThis', 'document', 'navigator', 'location', 'history',
  'console', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'localStorage', 'sessionStorage', 'performance', 'crypto', 'indexedDB', 'caches',
  'alert', 'confirm', 'prompt', 'open', 'close', 'focus', 'blur', 'print',
  // Window event listener and dimension properties
  'addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight',
  // DOM Events and Elements
  'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'UIEvent', 'EventTarget',
  'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement',
  'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLAnchorElement', 'HTMLAudioElement',
  'HTMLVideoElement', 'HTMLCanvasElement', 'HTMLDetailsElement', 'HTMLDialogElement',
  // Streams, Files, Network
  'Blob', 'File', 'FileList', 'FileReader', 'FormData', 'URL', 'URLSearchParams',
  'AbortController', 'AbortSignal', 'Headers', 'Response', 'Request',
  'WebSocket', 'Worker', 'SharedWorker', 'ServiceWorker',
  // Media and Speech
  'AudioContext', 'webkitAudioContext', 'MediaStream', 'MediaRecorder', 'Audio', 'Image',
  'speechSynthesis', 'SpeechSynthesisUtterance', 'SpeechRecognition', 'webkitSpeechRecognition',
  // Observers and Parsers
  'DOMParser', 'XMLSerializer', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'Notification', 'Screen', 'devicePixelRatio', 'matchMedia', 'getComputedStyle',
  // Web APIs (Exceptions, Encoding, Streams, Subtitles)
  'DOMException', 'TextDecoder', 'TextEncoder', 'DecompressionStream', 'VTTCue',
  // Standard built-ins
  'btoa', 'atob', 'escape', 'unescape', 'encodeURI', 'encodeURIComponent',
  'decodeURI', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp', 'Date',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'EvalError',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array', 'BigInt', 'DataView', 'ArrayBuffer', 'Intl',
  'WebAssembly', 'GPU', 'GPUBuffer', 'GPUTexture', 'GPUAdapter', 'GPUDevice',
  // Chrome Built-in AI APIs (window.ai / window.translation)
  'LanguageDetector', 'Translator',
  // WebExtensions globals (extension/engine.js)
  'chrome', 'browser', 'importScripts',
  // CommonJS environment globals for hybrid browser/node scripts (e.g. js/pdf-input.js, translation-memory.js)
  'module', 'require',
  // Electron / Desktop bridge globals
  'ENG', 'makanDesktop', 'electronAPI',
  // External library globals loaded via vendor or CDN
  'pdfjsLib', 'docx', 'ExcelJS', 'PptxGenJS', 'JSZip', 'XMLParser', 'XMLBuilder',
  'flatted', 'pipeline', 'env', 'AutoModel', 'AutoTokenizer', 'ort'
]);

// Read index.html to extract scripts in load order
function getIndexHtmlScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [];
  const re = /<script\s+src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Only verify local app scripts, skip vendor or external CDNs
    if (!m[1].startsWith('http://') && !m[1].startsWith('https://') && !m[1].startsWith('vendor/')) {
      scripts.push(m[1]);
    }
  }
  return scripts;
}

function walkNode(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item.type === 'string') walkNode(item, visitor);
      }
    } else if (child && typeof child.type === 'string') {
      walkNode(child, visitor);
    }
  }
}

// Extract top-level declaration names from an AST
function extractDeclarations(ast, names) {
  if (!ast || !Array.isArray(ast.body)) return;
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      if (node.id && node.id.name) names.add(node.id.name);
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        extractPatternNames(decl.id, names);
      }
    }
  }

  // Also collect global exports (window.X = ..., root.X = ..., self.X = ..., globalThis.X = ...)
  walkNode(ast, (node) => {
    if (node.type === 'AssignmentExpression') {
      if (node.left.type === 'MemberExpression') {
        const obj = node.left.object;
        const prop = node.left.property;
        if (obj && prop) {
          const objName = obj.name;
          const propName = prop.name || (prop.type === 'Literal' ? String(prop.value) : null);
          if (['window', 'self', 'globalThis', 'root'].includes(objName) && propName) {
            names.add(propName);
          }
        }
      }
    }
  });
}

function extractPatternNames(id, names) {
  if (!id) return;
  if (id.type === 'Identifier') {
    names.add(id.name);
  } else if (id.type === 'ObjectPattern') {
    for (const prop of id.properties) {
      if (prop.type === 'Property') extractPatternNames(prop.value, names);
      else if (prop.type === 'RestElement') extractPatternNames(prop.argument, names);
    }
  } else if (id.type === 'ArrayPattern') {
    for (const elem of id.elements) {
      if (elem) extractPatternNames(elem, names);
    }
  } else if (id.type === 'AssignmentPattern') {
    extractPatternNames(id.left, names);
  } else if (id.type === 'RestElement') {
    extractPatternNames(id.argument, names);
  }
}

test('Permanent static guard: no undefined identifiers across loaded scripts (ITEM 3)', () => {
  const scriptFiles = getIndexHtmlScripts();
  assert.ok(scriptFiles.length > 0, 'index.html should load scripts');

  const allGlobals = new Set(BROWSER_GLOBALS);
  const parsedScripts = [];

  // Pass 1: Parse all scripts and collect all top-level globals
  for (const relPath of scriptFiles) {
    const absPath = path.join(ROOT, relPath);
    const code = fs.readFileSync(absPath, 'utf8');
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
      ranges: true
    });

    extractDeclarations(ast, allGlobals);
    parsedScripts.push({ relPath, code, ast });
  }

  // Pass 2: Analyze scopes and find any references not defined in any scope or global
  const undefinedReferences = [];

  for (const { relPath, ast } of parsedScripts) {
    const scopeManager = eslintScope.analyze(ast, {
      ecmaVersion: 'latest',
      sourceType: 'script'
    });

    for (const ref of scopeManager.globalScope.through) {
      // typeof identifier guards (e.g. typeof foo === 'undefined') are safe and never throw ReferenceError
      if (typeof ref.isTypeof === 'function' && ref.isTypeof()) continue;

      const name = ref.identifier.name;
      if (!allGlobals.has(name)) {
        undefinedReferences.push({
          file: relPath,
          name,
          line: ref.identifier.loc?.start?.line,
          col: ref.identifier.loc?.start?.column
        });
      }
    }
  }

  const failureDetails = undefinedReferences.map(
    u => `  - ${u.file}:${u.line}:${u.col} '${u.name}' is not defined`
  ).join('\n');

  assert.strictEqual(
    undefinedReferences.length,
    0,
    `Found undefined identifiers across browser scripts:\n${failureDetails}`
  );
});

test('Static guard detects and reports deliberately undefined identifier in in-memory script', () => {
  const code = 'function testDeliberateUndef() { const val = deliberatelyUndefinedIdentifier; return val; }';
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true,
    ranges: true
  });

  const scopeManager = eslintScope.analyze(ast, {
    ecmaVersion: 'latest',
    sourceType: 'script'
  });

  const undefs = [];
  for (const ref of scopeManager.globalScope.through) {
    if (typeof ref.isTypeof === 'function' && ref.isTypeof()) continue;
    const name = ref.identifier.name;
    if (!BROWSER_GLOBALS.has(name)) {
      undefs.push({
        name,
        line: ref.identifier.loc?.start?.line,
        col: ref.identifier.loc?.start?.column
      });
    }
  }

  assert.strictEqual(undefs.length, 1, 'Guard should detect exactly one undefined identifier');
  assert.strictEqual(undefs[0].name, 'deliberatelyUndefinedIdentifier');
});
