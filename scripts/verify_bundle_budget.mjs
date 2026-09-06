import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const budgetPath = path.join(root, 'docs', 'operations', 'bundle-budget.json');
const entries = ['index.html', 'rule-editor.html'];
const externalPattern = /^(?:[a-z]+:|\/\/|data:|#)/i;
const distRoot = path.resolve(dist);

function entryAssets(entry) {
  const queue = [path.join(dist, entry)];
  const visited = new Set();
  const assets = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current) || !fs.existsSync(current)) continue;
    visited.add(current);
    assets.push(current);
    const extension = path.extname(current).toLowerCase();
    const contents = fs.readFileSync(current, 'utf8');
    const references = extension === '.html'
      ? [...contents.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1])
      : extension === '.js' || extension === '.mjs'
        ? [...contents.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map(match => match[1])
        : extension === '.css'
          ? [...contents.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map(match => match[1])
          : [];
    for (const reference of references) {
      if (externalPattern.test(reference)) continue;
      const cleanReference = reference.split(/[?#]/, 1)[0];
      const assetPath = path.resolve(path.dirname(current), cleanReference);
      const relative = path.relative(distRoot, assetPath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Bundle entry ${entry} references an asset outside dist: ${reference}`);
      }
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) queue.push(assetPath);
    }
  }
  return assets.filter(assetPath => path.extname(assetPath).toLowerCase() !== '.html');
}

function measure(entry) {
  const assets = [...new Set(entryAssets(entry))];
  const files = assets.map(assetPath => {
    const bytes = fs.readFileSync(assetPath);
    return {
      path: path.relative(dist, assetPath).replaceAll(path.sep, '/'),
      bytes: bytes.length,
      gzipBytes: zlib.gzipSync(bytes, { mtime: 0 }).length
    };
  });
  return {
    uncompressedBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
    files
  };
}

if (!fs.existsSync(budgetPath)) throw new Error(`Missing bundle budget: ${budgetPath}`);
const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const failures = [];

for (const entry of entries) {
  const actual = measure(entry);
  const limits = budget.entries?.[entry];
  if (!limits) throw new Error(`Bundle budget has no entry for ${entry}`);
  if (actual.uncompressedBytes > limits.maxUncompressedBytes) {
    failures.push(`${entry} uncompressed ${actual.uncompressedBytes} > ${limits.maxUncompressedBytes}`);
  }
  if (actual.gzipBytes > limits.maxGzipBytes) {
    failures.push(`${entry} gzip ${actual.gzipBytes} > ${limits.maxGzipBytes}`);
  }
  console.log(`${entry}: ${actual.uncompressedBytes} bytes uncompressed, ${actual.gzipBytes} bytes gzip`);
  for (const file of actual.files.filter(file => file.path.endsWith('.js')).sort((a, b) => b.bytes - a.bytes).slice(0, 5)) {
    console.log(`  ${file.path}: ${file.bytes} bytes (${file.gzipBytes} gzip)`);
  }
}

if (failures.length > 0) {
  console.error(`Bundle budget exceeded:\n${failures.join('\n')}`);
  process.exit(1);
}
