import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const distRoot = path.resolve(dist);
const entries = ['index.html', 'rule-editor.html'];
const externalPattern = /^(?:[a-z]+:|\/\/|data:|#)/i;

function referencesFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contents = fs.readFileSync(filePath, 'utf8');
  if (extension === '.html') {
    return {
      startup: [...contents.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]),
      onDemand: []
    };
  }
  if (extension === '.js' || extension === '.mjs') {
    return {
      startup: [...contents.matchAll(/\bimport\s+(?!\()(?:(?:[^"'()]*?)\s*from\s*)?["']([^"']+)["']/g)].map(match => match[1]),
      onDemand: [...contents.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map(match => match[1])
    };
  }
  if (extension === '.css') {
    return {
      startup: [...contents.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map(match => match[1]),
      onDemand: []
    };
  }
  return { startup: [], onDemand: [] };
}

function resolveAsset(current, reference, entry) {
  if (externalPattern.test(reference)) return null;
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const assetPath = path.resolve(path.dirname(current), cleanReference);
  const relative = path.relative(distRoot, assetPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Bundle entry ${entry} references an asset outside dist: ${reference}`);
  }
  if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    throw new Error(`Bundle entry ${entry} references a missing asset: ${reference}`);
  }
  return assetPath;
}

function collectGraph(entry) {
  const startupQueue = [path.join(dist, entry)];
  const startupAssets = new Set();
  const onDemandQueue = [];
  const onDemandAssets = new Set();

  while (startupQueue.length > 0) {
    const current = startupQueue.shift();
    if (!current || startupAssets.has(current)) continue;
    startupAssets.add(current);
    const references = referencesFor(current);
    for (const reference of references.startup) {
      const assetPath = resolveAsset(current, reference, entry);
      if (assetPath) startupQueue.push(assetPath);
    }
    for (const reference of references.onDemand) {
      const assetPath = resolveAsset(current, reference, entry);
      if (assetPath) onDemandQueue.push(assetPath);
    }
  }

  while (onDemandQueue.length > 0) {
    const current = onDemandQueue.shift();
    if (!current || startupAssets.has(current) || onDemandAssets.has(current)) continue;
    onDemandAssets.add(current);
    const references = referencesFor(current);
    for (const reference of [...references.startup, ...references.onDemand]) {
      const assetPath = resolveAsset(current, reference, entry);
      if (assetPath) onDemandQueue.push(assetPath);
    }
  }

  const files = assetPaths => assetPaths
    .filter(assetPath => path.extname(assetPath).toLowerCase() !== '.html')
    .map(assetPath => {
      const bytes = fs.readFileSync(assetPath);
      return {
        path: path.relative(dist, assetPath).replaceAll(path.sep, '/'),
        bytes: bytes.length,
        gzipBytes: zlib.gzipSync(bytes, { mtime: 0 }).length
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  const startup = files([...startupAssets]);
  const onDemand = files([...onDemandAssets]);
  return {
    startup,
    onDemand,
    startupBytes: startup.reduce((sum, file) => sum + file.bytes, 0),
    startupGzipBytes: startup.reduce((sum, file) => sum + file.gzipBytes, 0),
    onDemandBytes: onDemand.reduce((sum, file) => sum + file.bytes, 0),
    onDemandGzipBytes: onDemand.reduce((sum, file) => sum + file.gzipBytes, 0)
  };
}

for (const entry of entries) {
  const graph = collectGraph(entry);
  console.log(`${entry}:`);
  console.log(`  startup: ${graph.startup.length} files, ${graph.startupBytes} bytes (${graph.startupGzipBytes} gzip)`);
  console.log(`  on-demand: ${graph.onDemand.length} files, ${graph.onDemandBytes} bytes (${graph.onDemandGzipBytes} gzip)`);
  console.log(`  startup files: ${graph.startup.map(file => file.path).join(', ') || '(none)'}`);
  console.log(`  on-demand files: ${graph.onDemand.map(file => file.path).join(', ') || '(none)'}`);
}
