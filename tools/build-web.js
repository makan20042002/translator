'use strict';

/**
 * tools/build-web.js
 * Builds a clean, minimal runtime upload folder (dist/web/) for the web app.
 *
 * Requirements:
 * - Contains ONLY what the web app needs at runtime.
 * - Discovers files by FOLLOWING real references:
 *     script src, link href, importScripts, new Worker, fetch of local files,
 *     CSS url(), sw.js precache list, dict packs, etc.
 * - Never includes: tests/, node_modules/, extension/ (extension-only assets),
 *   dist/, test-results/, test_docs/, tools/, helper/, backups, .git, developer *.md, .env files.
 * - Fails with a clear message if a referenced local file is missing.
 * - Refuses to build if working tree contains an obvious secret pattern (AIza..., sk-..., gsk_...).
 *   Prints ONLY the file path, never the secret value.
 * - Writes dist/web/BUILD_INFO.json (version from package.json, build date, list of files with sha256 & size).
 * - Deterministic output.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, 'dist', 'web');

// Secret pattern: Google AIza..., sk-..., gsk_...
const SECRET_REGEX = /(?:AIza[0-9A-Za-z_-]{35}|(?:sk|gsk)_[a-zA-Z0-9_-]{20,})/;

// Non-text file extensions that should not be scanned as UTF-8 for secrets
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.wasm', '.onnx', '.data', '.gz', '.zip', '.mp3', '.wav'
]);

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Scan a single file for API key patterns.
 * If found, prints only the relative file path and throws an Error.
 */
function checkSecret(fullPath, relPath) {
  const ext = path.extname(fullPath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return;
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (SECRET_REGEX.test(content)) {
    console.error(`Secret key pattern detected in file: ${relPath}`);
    throw new Error(`Refusing to build: secret key pattern detected in ${relPath}`);
  }
}

/**
 * Collect referenced files starting from index.html and core manifests/workers.
 */
function collectReferencedFiles(rootDir) {
  const files = new Set();

  function addFile(relPath) {
    if (!relPath) return;
    const clean = relPath.replace(/^\.\//, '').split('?')[0].split('#')[0];
    if (!clean || clean.startsWith('http:') || clean.startsWith('https:') || clean.startsWith('data:')) return;
    const full = path.join(rootDir, clean);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      throw new Error(`Referenced local file missing: ${clean} (expected at ${full})`);
    }
    files.add(clean.replace(/\\/g, '/'));
  }

  // 1. Root runtime files
  ['index.html', 'manifest.webmanifest', 'models-catalog.js', 'sw.js', 'jszip.min.js', 'translation-memory.js'].forEach(f => {
    if (fs.existsSync(path.join(rootDir, f))) addFile(f);
  });

  // 2. Scan index.html
  const indexPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf-8');
    // script src
    const scriptSrcRe = /<script\s+[^>]*src=["']([^"']+)["']/gi;
    let m;
    while ((m = scriptSrcRe.exec(html)) !== null) {
      addFile(m[1]);
    }
    // link href
    const linkHrefRe = /<link\s+[^>]*href=["']([^"']+)["']/gi;
    while ((m = linkHrefRe.exec(html)) !== null) {
      addFile(m[1]);
    }
    // img src
    const imgSrcRe = /<img\s+[^>]*src=["']([^"']+)["']/gi;
    while ((m = imgSrcRe.exec(html)) !== null) {
      addFile(m[1]);
    }
    // a href to local dict credits or docs
    const aHrefRe = /<a\s+[^>]*href=["']([^"']+)["']/gi;
    while ((m = aHrefRe.exec(html)) !== null) {
      if (m[1].startsWith('dict/') || m[1].startsWith('docs/')) {
        addFile(m[1]);
      }
    }
  }

  // 3. Scan sw.js SHELL array
  const swPath = path.join(rootDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    const swContent = fs.readFileSync(swPath, 'utf-8');
    const shellMatch = swContent.match(/const\s+SHELL\s*=\s*\[([\s\S]*?)\];/);
    if (shellMatch) {
      const itemRe = /['"]([^'"]+)['"]/g;
      let im;
      while ((im = itemRe.exec(shellMatch[1])) !== null) {
        if (im[1] !== './' && im[1] !== '/') {
          addFile(im[1]);
        }
      }
    }
  }

  // 4. Scan CSS files for url(...)
  const cssDir = path.join(rootDir, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    for (const cf of cssFiles) {
      addFile(`css/${cf}`);
      const cssContent = fs.readFileSync(path.join(cssDir, cf), 'utf-8');
      const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
      let um;
      while ((um = urlRe.exec(cssContent)) !== null) {
        let u = um[1].trim();
        if (u.startsWith('data:') || u.startsWith('http:') || u.startsWith('https:')) continue;
        // resolve relative to css directory
        const resolved = path.join('css', u).replace(/\\/g, '/');
        const norm = path.normalize(resolved).replace(/\\/g, '/');
        addFile(norm);
      }
    }
  }

  // 5. Scan media directory
  const mediaDir = path.join(rootDir, 'media');
  if (fs.existsSync(mediaDir)) {
    const mf = fs.readdirSync(mediaDir);
    for (const file of mf) {
      const full = path.join(mediaDir, file);
      if (fs.statSync(full).isFile()) {
        addFile(`media/${file}`);
      }
    }
  }

  // 6. Workers and vendor scripts
  ['ai-worker.js', 'piper-worker.js', 'asr-guard.js'].forEach(w => {
    if (fs.existsSync(path.join(rootDir, w))) addFile(w);
  });

  // vendor/piper and vendor/pdfjs
  ['vendor/piper', 'vendor/pdfjs'].forEach(vdir => {
    const fullVDir = path.join(rootDir, vdir);
    if (fs.existsSync(fullVDir)) {
      const vfiles = fs.readdirSync(fullVDir);
      for (const vf of vfiles) {
        const vfPath = path.join(fullVDir, vf);
        if (fs.statSync(vfPath).isFile()) {
          addFile(`${vdir}/${vf}`);
        }
      }
    }
  });

  // 7. Fonts
  const fontsDir = path.join(rootDir, 'fonts');
  if (fs.existsSync(fontsDir)) {
    const fontFiles = fs.readdirSync(fontsDir);
    for (const ff of fontFiles) {
      if (fs.statSync(path.join(fontsDir, ff)).isFile()) {
        addFile(`fonts/${ff}`);
      }
    }
  }

  // 8. Dictionary packs (used by offline dictionary tab)
  const dictDir = path.join(rootDir, 'dict');
  if (fs.existsSync(dictDir)) {
    ['packs.json', 'index.json'].forEach(df => {
      if (fs.existsSync(path.join(dictDir, df))) addFile(`dict/${df}`);
    });
    // add all pack files
    function walkDict(dir, relPrefix) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const rel = `${relPrefix}/${ent.name}`;
        if (ent.isDirectory()) {
          walkDict(full, rel);
        } else if (ent.isFile() && !ent.name.endsWith('.md')) {
          addFile(rel);
        }
      }
    }
    const dictSubdirs = fs.readdirSync(dictDir, { withFileTypes: true });
    for (const d of dictSubdirs) {
      if (d.isDirectory()) {
        walkDict(path.join(dictDir, d.name), `dict/${d.name}`);
      }
    }
  }

  // 9. Brand & icons
  ['icon-192.png', 'icon-512.png'].forEach(ic => {
    if (fs.existsSync(path.join(rootDir, ic))) addFile(ic);
  });
  const brandDir = path.join(rootDir, 'brand');
  if (fs.existsSync(brandDir)) {
    ['makanlab-square-icon.svg', 'makanlab-m-mark.svg', 'makanlab-wordmark.svg'].forEach(bf => {
      if (fs.existsSync(path.join(brandDir, bf))) addFile(`brand/${bf}`);
    });
  }

  // 10. Documents / user guides / licenses (if they exist)
  ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'docs/USER_GUIDE.md'].forEach(doc => {
    if (fs.existsSync(path.join(rootDir, doc))) addFile(doc);
  });

  return Array.from(files).sort();
}

/**
 * Generate .htaccess and .htaccess.threads-optional content
 */
function getHtaccessContent() {
  return `# MAKAN Translate — Apache / LiteSpeed server settings
# Generated by tools/build-web.js

# 1. Force HTTPS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# 2. MIME types for modern web app, WASM & AI models
<IfModule mod_mime.c>
  AddType application/wasm .wasm
  AddType text/javascript .mjs
  AddType application/octet-stream .onnx .data
  AddType application/json .json
  AddType application/manifest+json .webmanifest
  AddType font/woff2 .woff2
</IfModule>

# 3. Compression for text and JSON assets
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json application/manifest+json image/svg+xml
</IfModule>

# 4. Cache rules:
# HTML, manifest and Service Worker: never cached long (fresh updates reach users)
# Static versioned assets, fonts, WASM: cached long
<IfModule mod_headers.c>
  <FilesMatch "\\.(html|webmanifest)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  <FilesMatch "^sw\\.js$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  <FilesMatch "\\.(woff2|woff|ttf|wasm|onnx|data|png|jpg|svg|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # 5. Security Headers
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "microphone=(self), display-capture=(self)"
</IfModule>
`;
}

function getHtaccessThreadsOptionalContent() {
  return `# MAKAN Translate — OPTIONAL Multi-Threading Headers (.htaccess.threads-optional)
# DO NOT ACTIVATE BY DEFAULT WITHOUT TESTING ON YOUR REAL HOST!
#
# To test or activate: rename this file to .htaccess (or merge into .htaccess).
#
# WHY USE THIS:
# Enables Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP).
# This gives the page 'crossOriginIsolated = true', allowing ONNX Runtime / Transformers.js
# to use Web Workers with SharedArrayBuffer and multiple CPU threads (up to hardwareConcurrency - 2).
# Whisper speech recognition in the Media and Voice tabs can run significantly faster on CPU.
#
# WHAT CAN BREAK:
# COEP 'require-corp' blocks ALL cross-origin resources that do not send a
# Cross-Origin-Resource-Policy (CORP) header. For example, direct fetches to
# huggingface.co model files or external CDN assets may be blocked by the browser!
# MUST be thoroughly tested on the real hosting server before production use.

<IfModule mod_headers.c>
  Header always set Cross-Origin-Opener-Policy "same-origin"
  Header always set Cross-Origin-Embedder-Policy "require-corp"
</IfModule>
`;
}

/**
 * Main build function
 */
function buildWeb(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const outDir = options.outDir || DEFAULT_OUT_DIR;
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : { version: '0.0.0' };

  console.log(`Building clean web upload folder in: ${outDir}`);

  // Collect all referenced files
  const fileList = collectReferencedFiles(rootDir);

  // Check for secrets across all files to be copied
  for (const rel of fileList) {
    const full = path.join(rootDir, rel);
    checkSecret(full, rel);
  }

  // Clean and prepare output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const buildFilesMeta = [];

  // Copy files
  for (const rel of fileList) {
    const srcFull = path.join(rootDir, rel);
    const destFull = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(destFull), { recursive: true });

    // For sw.js: ensure cache version name reflects package.json version
    if (rel === 'sw.js') {
      let swCode = fs.readFileSync(srcFull, 'utf-8');
      const cacheVersion = `makan-translate-v${pkg.version || '0.0.0'}`;
      swCode = swCode.replace(/const\s+CACHE\s*=\s*['"][^'"]+['"];/, `const CACHE = '${cacheVersion}';`);
      fs.writeFileSync(destFull, swCode, 'utf-8');
    } else {
      fs.copyFileSync(srcFull, destFull);
    }

    const sha256 = computeSha256(destFull);
    const size = fs.statSync(destFull).size;
    buildFilesMeta.push({
      path: rel,
      sha256,
      size
    });
  }

  // Generate .htaccess and .htaccess.threads-optional
  const htaccessPath = path.join(outDir, '.htaccess');
  fs.writeFileSync(htaccessPath, getHtaccessContent(), 'utf-8');
  buildFilesMeta.push({
    path: '.htaccess',
    sha256: computeSha256(htaccessPath),
    size: fs.statSync(htaccessPath).size
  });

  const htaccessThreadsPath = path.join(outDir, '.htaccess.threads-optional');
  fs.writeFileSync(htaccessThreadsPath, getHtaccessThreadsOptionalContent(), 'utf-8');
  buildFilesMeta.push({
    path: '.htaccess.threads-optional',
    sha256: computeSha256(htaccessThreadsPath),
    size: fs.statSync(htaccessThreadsPath).size
  });

  // Sort files deterministically by path
  buildFilesMeta.sort((a, b) => a.path.localeCompare(b.path));

  // Write BUILD_INFO.json
  const buildInfo = {
    version: pkg.version || '0.0.0',
    buildDate: options.buildDate || new Date().toISOString(),
    files: buildFilesMeta
  };

  const buildInfoPath = path.join(outDir, 'BUILD_INFO.json');
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2) + '\n', 'utf-8');

  console.log(`Build complete. Copied ${buildFilesMeta.length} files to ${outDir}`);
  return { outDir, buildInfo };
}

if (require.main === module) {
  try {
    const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT_DIR;
    buildWeb({ outDir: target });
  } catch (err) {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  buildWeb,
  collectReferencedFiles,
  checkSecret,
  SECRET_REGEX
};
