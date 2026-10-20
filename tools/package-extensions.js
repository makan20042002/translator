'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JSZip = require('jszip');

const ROOT_DIR = path.resolve(__dirname, '..');
const FIXED_TIMESTAMP = new Date('2026-01-01T00:00:00.000Z');

function collectFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'tests' || entry.name === '.git') continue;
      results = results.concat(collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      // Exclude tests, .map, .md dev files, .DS_Store, Thumbs.db
      if (relPath.startsWith('tests/') || relPath.includes('/tests/')) continue;
      if (/\.(spec|test)\.[a-z0-9]+$/i.test(entry.name)) continue;
      if (/\.map$/i.test(entry.name)) continue;
      if (/\.md$/i.test(entry.name)) continue;
      if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
      const stat = fs.statSync(fullPath);
      results.push({ fullPath, relPath, size: stat.size });
    }
  }
  return results;
}

async function buildZipFromDir(sourceDir, zipPath = null) {
  const zip = new JSZip();
  const files = collectFiles(sourceDir);

  // Sort relative paths deterministically
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  for (const file of files) {
    const data = fs.readFileSync(file.fullPath);
    zip.file(file.relPath, data, {
      date: FIXED_TIMESTAMP,
      createFolders: true
    });
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX'
  });

  if (zipPath) {
    const dir = path.dirname(zipPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(zipPath, content);
  }
  return { content, files };
}

async function packageExtensions(options = {}) {
  const root = options.rootDir || ROOT_DIR;
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version;

  if (!options.skipBuild) {
    execSync(`"${process.execPath}" "${path.join(root, 'build-manifests.js')}"`, {
      cwd: root,
      stdio: 'inherit'
    });
  }

  const packagesDir = path.join(root, 'dist', 'packages');
  if (!fs.existsSync(packagesDir)) {
    fs.mkdirSync(packagesDir, { recursive: true });
  }

  const chromeSrc = path.join(root, 'dist', 'chrome');
  const firefoxSrc = path.join(root, 'dist', 'firefox');

  const chromeZipName = `makan-translate-chrome-${version}.zip`;
  const firefoxZipName = `makan-translate-firefox-${version}.zip`;

  const chromeZipPath = path.join(packagesDir, chromeZipName);
  const firefoxZipPath = path.join(packagesDir, firefoxZipName);

  const { content: chromeBuffer, files: chromeFiles } = await buildZipFromDir(chromeSrc, chromeZipPath);
  const { content: firefoxBuffer, files: firefoxFiles } = await buildZipFromDir(firefoxSrc, firefoxZipPath);

  console.log(`\n📦 Created ${chromeZipName} (${chromeBuffer.length} bytes):`);
  for (const f of chromeFiles) {
    console.log(`   ${f.relPath} (${f.size} bytes)`);
  }

  console.log(`\n📦 Created ${firefoxZipName} (${firefoxBuffer.length} bytes):`);
  for (const f of firefoxFiles) {
    console.log(`   ${f.relPath} (${f.size} bytes)`);
  }

  return {
    version,
    packagesDir,
    chromeZipPath,
    firefoxZipPath,
    chromeBuffer,
    firefoxBuffer,
    chromeZipName,
    firefoxZipName,
    chromeFiles,
    firefoxFiles
  };
}

if (require.main === module) {
  packageExtensions().catch((err) => {
    console.error('Packaging failed:', err);
    process.exit(1);
  });
}

module.exports = {
  packageExtensions,
  buildZipFromDir,
  collectFiles,
  FIXED_TIMESTAMP
};
