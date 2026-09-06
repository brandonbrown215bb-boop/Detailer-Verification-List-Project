import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const mismatchedVersion = metadata.version === '0.0.0' ? '0.0.1' : '0.0.0';
const result = spawnSync(process.execPath, [path.join(root, 'scripts/verify_version.mjs'), '--expected', mismatchedVersion], {
  cwd: root,
  encoding: 'utf8'
});

if (result.status === 0 || !result.stderr.includes('does not match authoritative version')) {
  console.error('Version mismatch negative check failed: verify_version accepted a split release identity.');
  process.exit(1);
}

const injectedResult = spawnSync(process.execPath, [path.join(root, 'scripts/verify_version.mjs')], {
  cwd: root,
  env: { ...process.env, VITE_APP_VERSION: mismatchedVersion },
  encoding: 'utf8'
});
if (injectedResult.status === 0 || !injectedResult.stderr.includes('VITE_APP_VERSION')) {
  console.error('VITE_APP_VERSION negative check failed: verify_version accepted an injected split identity.');
  process.exit(1);
}

console.log(`Version mismatch negative checks passed for ${mismatchedVersion}.`);
