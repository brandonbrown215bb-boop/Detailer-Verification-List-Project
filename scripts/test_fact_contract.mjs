import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const contract = readJson('resources/rulepack/fact_contract.json');
const rules = readJson('resources/rulepack/rules.json');
const templateMap = readJson('resources/rulepack/template_map.json');
const fingerprintCases = readJson('tests/fixtures/semantic_fingerprint_cases.json');

const exactFacts = new Map(contract.facts.map((entry) => [entry.key, entry]));
const patterns = contract.patterns.map((entry) => ({
  ...entry,
  regex: new RegExp(`^${entry.key.split('.').map((part) => part === '{id}' ? '[^.]+': part.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('\\.')}$`)
}));
const aliases = contract.legacyAliases;
const canonical = (key) => aliases[key] || key;
const registered = (key) => exactFacts.has(canonical(key)) || patterns.some((entry) => entry.regex.test(canonical(key)));

const walkPredicate = (predicate) => {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate) || Object.keys(predicate).length !== 1) throw new Error('Malformed predicate');
  const [operator, operands] = Object.entries(predicate)[0];
  if (['and', 'or'].includes(operator)) {
    if (!Array.isArray(operands) || operands.length === 0) throw new Error(`Malformed ${operator}`);
    operands.forEach(walkPredicate);
    return;
  }
  if (!['>=', '<=', '>', '<', '===', '!==', 'includes', 'in'].includes(operator) || !Array.isArray(operands) || operands.length !== 2) throw new Error(`Unsupported predicate ${operator}`);
  const walkTerm = (term) => {
    if (term && typeof term === 'object' && !Array.isArray(term) && typeof term.var === 'string') {
      assert.equal(Object.keys(term).length, 1);
      assert.ok(registered(term.var), `unknown predicate fact ${term.var}`);
    }
  };
  walkTerm(operands[0]);
  if (operator === 'in' && Array.isArray(operands[1])) operands[1].forEach(walkTerm);
  else walkTerm(operands[1]);
};

const ids = new Set();
const semanticKeys = new Set();
for (const rule of rules) {
  assert.ok(!ids.has(rule.id), `duplicate rule id ${rule.id}`);
  assert.ok(!semanticKeys.has(rule.semanticKey), `duplicate semantic key ${rule.semanticKey}`);
  ids.add(rule.id);
  semanticKeys.add(rule.semanticKey);
  rule.requiredFacts.forEach((key) => assert.ok(registered(key), `unknown required fact ${key}`));
  if (rule.predicate) walkPredicate(rule.predicate);
}
for (const [key, mapping] of Object.entries(templateMap.generalFields)) {
  if (key !== 'generalComments') assert.ok(registered(key), `unknown template fact ${key}`);
  assert.match(mapping.cell, /^[A-Z]{1,3}[1-9][0-9]*$/);
}
for (const key of Object.keys(templateMap.ruleCellMappings)) assert.ok(semanticKeys.has(key), `orphan template mapping ${key}`);
for (const rule of rules) assert.ok(templateMap.ruleCellMappings[rule.semanticKey], `missing mapping ${rule.semanticKey}`);

const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const canonicalizePredicate = (predicate) => {
  if (!predicate || typeof predicate !== 'object') return predicate;
  if (Array.isArray(predicate)) return predicate.map(canonicalizePredicate);
  const result = {};
  for (const key of Object.keys(predicate)) {
    if (key === 'var' && typeof predicate[key] === 'string') {
      result[key] = canonical(predicate[key]);
    } else {
      result[key] = canonicalizePredicate(predicate[key]);
    }
  }
  return result;
};

const fingerprint = (rule) => stableJson({
  predicate: canonicalizePredicate(rule.predicate) || null,
  requiredFacts: rule.requiredFacts.map(canonical).sort(),
  scope: rule.scope,
  verificationMode: rule.verificationMode,
  instructions: rule.text,
  allowNA: rule.allowNA
});
for (const { rule, expected } of fingerprintCases) assert.equal(fingerprint(rule), expected);

const materialKind = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\\/_-]+/g, ' ').replace(/\s+/g, ' ');
  const tokens = new Set(normalized.split(' ').filter(Boolean));
  if (tokens.has('AL') || tokens.has('ALUM') || tokens.has('ALUMINUM') || normalized.includes('AL TREAD') || normalized.includes('ALUMINUM TREAD') || normalized.includes('AL DIAMOND PLATE') || normalized.includes('ALUMINUM DIAMOND PLATE')) return 'aluminum';
  if (tokens.has('SS') || tokens.has('SS304') || tokens.has('STAINLESS') || normalized.includes('STAINLESS STEEL')) return 'stainless';
  if (tokens.has('STL') && tokens.has('GALV')) return 'galvanized';
  return 'unknown';
};
assert.equal(materialKind(' STL   GALV '), 'galvanized');
assert.equal(materialKind('AL TREAD'), 'aluminum');
assert.equal(materialKind('Stainless_Steel_304'), 'stainless');
assert.equal(materialKind('mystery plate'), 'unknown');

console.log(`Fact contract checks passed (${rules.length} rules, ${contract.facts.length + contract.patterns.length} entries).`);
