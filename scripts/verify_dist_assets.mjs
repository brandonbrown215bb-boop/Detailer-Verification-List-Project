import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const entries = ['index.html', 'rule-editor.html'];
const externalPattern = /^(?:[a-z]+:|\/\/|data:|#)/i;
const distRoot = path.resolve(dist);

function referencesFor(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return [...source.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  if (extension === '.js' || extension === '.mjs') return [...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map(match => match[1]);
  if (extension === '.css') return [...source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map(match => match[1]);
  return [];
}

if (!fs.existsSync(dist)) throw new Error(`Missing Vite output directory: ${dist}`);

for (const entry of entries) {
  const entryPath = path.join(dist, entry);
  if (!fs.existsSync(entryPath)) throw new Error(`Missing Vite entry: dist/${entry}`);
  const queue = [entryPath];
  const visited = new Set();
  let localReferenceCount = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const rawReference of referencesFor(current)) {
      const reference = rawReference.split(/[?#]/, 1)[0];
      if (externalPattern.test(rawReference)) continue;
      localReferenceCount++;
      if (reference.startsWith('/')) {
        throw new Error(`Entry ${entry} contains root-relative asset ${rawReference}; packaged WebView2 entry pages require relative URLs.`);
      }
      const assetPath = path.resolve(path.dirname(current), reference);
      const relative = path.relative(distRoot, assetPath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Entry ${entry} references an asset outside dist: ${rawReference}`);
      }
      if (!fs.existsSync(assetPath)) {
        throw new Error(`Entry ${entry} references a missing local asset: ${rawReference}`);
      }
      if (/\.(?:html|js|mjs|css)$/i.test(assetPath)) queue.push(assetPath);
    }
  }

  console.log(`PASS dist/${entry}: ${localReferenceCount} local assets resolve across ${visited.size} files`);
}
