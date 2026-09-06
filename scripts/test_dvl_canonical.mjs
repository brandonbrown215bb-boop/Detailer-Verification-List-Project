#!/usr/bin/env node

/** Cross-runtime DVL canonicalization fixture. Keep this algorithm in lockstep
 * with src/services/projectStorage.ts and DvlProjectManager.CanonicalizeJsonPayload. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { canonicalJson } from '../src/services/projectStorage.ts';

const fixturePath = new URL('../tests/fixtures/dvl-v2-canonical.json', import.meta.url);
const fixtureText = fs.readFileSync(fixturePath, 'utf8');

const payload = JSON.parse(fixtureText);
delete payload.integrity;
delete payload.lastSavedAt;
const canonical = canonicalJson(payload);
const reordered = Object.fromEntries(Object.entries(payload).reverse());
assert.equal(canonicalJson(reordered), canonical, 'object member order must not affect canonical payload');
assert.match(canonical, /-0\.5/);
assert.match(canonical, /96\.5/);
assert.match(canonical, /"length":120/);
assert.equal(canonicalJson({ 10: 'ten', 2: 'two', a: 'letter' }), '{"10":"ten","2":"two","a":"letter"}', 'integer-like keys retain ordinal order');
const sha256 = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
console.log(JSON.stringify({ canonical, sha256 }));
