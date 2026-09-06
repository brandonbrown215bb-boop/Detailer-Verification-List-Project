import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const rulePackDir = path.join(repoRoot, 'resources', 'rulepack');

const REQUIRED_FILES = [
  'rules.json',
  'template_map.json',
  'approved_mappings.json',
  'fact_contract.json',
  'template.xlsx'
];

function sha256(bufferOrString) {
  return crypto.createHash('sha256').update(bufferOrString).digest('hex').toLowerCase();
}

function canonicalJsonSha256(rawText) {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return sha256(Buffer.from(normalized, 'utf8'));
}

function normalizeLf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

console.log(`Validating and building Rule Pack manifest in: ${rulePackDir}`);

if (!fs.existsSync(rulePackDir)) {
  throw new Error(`Rule pack directory not found: ${rulePackDir}`);
}

// 1. Verify existence of required files
for (const file of REQUIRED_FILES) {
  const filePath = path.join(rulePackDir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required rule pack artifact: ${filePath}`);
  }
}

// 2. Read and validate JSON artifacts
const rulesPath = path.join(rulePackDir, 'rules.json');
const templateMapPath = path.join(rulePackDir, 'template_map.json');
const approvedMappingsPath = path.join(rulePackDir, 'approved_mappings.json');
const factContractPath = path.join(rulePackDir, 'fact_contract.json');
const templatePath = path.join(rulePackDir, 'template.xlsx');
const manifestPath = path.join(rulePackDir, 'manifest.json');

const rawRules = fs.readFileSync(rulesPath, 'utf8');
const rawTemplateMap = fs.readFileSync(templateMapPath, 'utf8');
const rawApprovedMappings = fs.readFileSync(approvedMappingsPath, 'utf8');
const rawFactContract = fs.readFileSync(factContractPath, 'utf8');

const rules = JSON.parse(rawRules);
if (!Array.isArray(rules) || rules.length === 0) {
  throw new Error(`Invalid rules.json: expected non-empty array, got ${typeof rules}`);
}

const templateMap = JSON.parse(rawTemplateMap);
if (typeof templateMap !== 'object' || !templateMap.templateVersion || !templateMap.sheetNames) {
  throw new Error(`Invalid template_map.json: missing templateVersion or sheetNames`);
}

const approvedMappings = JSON.parse(rawApprovedMappings);
if (typeof approvedMappings !== 'object' || !approvedMappings.approvedSegments) {
  throw new Error(`Invalid approved_mappings.json: missing approvedSegments`);
}
const factContract = JSON.parse(rawFactContract);
if (!factContract || typeof factContract !== 'object' || typeof factContract.contractVersion !== 'string' || !Array.isArray(factContract.facts) || !Array.isArray(factContract.patterns) || typeof factContract.legacyAliases !== 'object') {
  throw new Error('Invalid fact_contract.json: expected versioned facts, patterns, and legacyAliases.');
}

const canonicalFactKey = key => factContract.legacyAliases[key] || key;
const factEntry = key => {
  const canonical = canonicalFactKey(key);
  const exact = factContract.facts.find(entry => entry.key === canonical);
  if (exact) return exact;
  return factContract.patterns.find(entry => {
    const pattern = `^${entry.key.split('.').map(part => part === '{id}' ? '[^.]+': part.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('\\.')}$`;
    return new RegExp(pattern).test(canonical);
  });
};
const supportedScopes = new Set(['Unit', 'Skid', 'Segment', 'Component']);
const supportedModes = new Set(['ManualCheckbox', 'AutoEvaluated', 'MeasurementVerify']);
const supportedCategories = new Set(['Base', 'Housing', 'Knockdown', 'UTL', 'Paperwork', 'MOM', 'Internals']);
const errors = [];
const kindOf = value => value === null ? 'null' : Array.isArray(value) ? 'array' : (typeof value === 'number' && Number.isFinite(value)) ? 'number' : typeof value;
const termType = (term, at) => {
  if (term && typeof term === 'object' && !Array.isArray(term) && typeof term.var === 'string' && Object.keys(term).length === 1) {
    const entry = factEntry(term.var);
    if (!entry) errors.push(`${at}: unknown fact '${term.var}'.`);
    return entry?.type;
  }
  const kind = kindOf(term);
  if (['string', 'number', 'boolean', 'null'].includes(kind)) return kind;
  errors.push(`${at}: malformed literal/variable.`);
  return undefined;
};
const validatePredicate = (predicate, at) => {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate) || Object.keys(predicate).length !== 1) {
    errors.push(`${at}: predicate must contain exactly one supported operator.`);
    return;
  }
  const [operator, value] = Object.entries(predicate)[0];
  const leafOperators = new Set(['>=', '<=', '>', '<', '===', '!==', 'includes', 'in']);
  if (leafOperators.has(operator)) {
    if (!Array.isArray(value) || value.length !== 2) { errors.push(`${at}.${operator}: expected exactly two operands.`); return; }
    const leftType = termType(value[0], `${at}.${operator}[0]`);
    const rightType = operator === 'in' && Array.isArray(value[1])
      ? (value[1].length ? termType(value[1][0], `${at}.${operator}[1][0]`) : undefined)
      : termType(value[1], `${at}.${operator}[1]`);
    if (operator === 'includes' && (leftType !== 'string' || rightType !== 'string')) errors.push(`${at}.includes: operands must be strings.`);
    if (['>', '>=', '<', '<='].includes(operator) && (leftType !== 'number' || rightType !== 'number')) errors.push(`${at}.${operator}: operands must be numbers.`);
    if (['===', '!=='].includes(operator) && leftType && rightType && leftType !== 'null' && rightType !== 'null' && leftType !== rightType) errors.push(`${at}.${operator}: operand types ${leftType} and ${rightType} are incompatible.`);
    if (operator === 'in') {
      if (!Array.isArray(value[1]) && rightType !== 'string') errors.push(`${at}.in: right operand must be an array or comma-delimited string.`);
      if (Array.isArray(value[1])) value[1].forEach((item, index) => { const type = termType(item, `${at}.in[1][${index}]`); if (leftType && type && type !== 'null' && type !== leftType) errors.push(`${at}.in: item ${index} has incompatible type.`); });
    }
    return;
  }
  if (operator === 'and' || operator === 'or') {
    if (!Array.isArray(value) || value.length === 0) errors.push(`${at}.${operator}: expected a non-empty predicate array.`);
    else value.forEach((child, index) => validatePredicate(child, `${at}.${operator}[${index}]`));
    return;
  }
  errors.push(`${at}: unsupported AST operator '${operator}'.`);
};

const normalizePredicate = predicate => {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return predicate;
  const output = {};
  for (const [operator, value] of Object.entries(predicate)) {
    if (operator === 'var' && typeof value === 'string') output[operator] = canonicalFactKey(value);
    else if (Array.isArray(value)) output[operator] = value.map(normalizePredicate);
    else output[operator] = normalizePredicate(value);
  }
  return output;
};

const ids = new Set();
const semanticKeys = new Set();
rules.forEach((rule, index) => {
  rule.requiredFacts = (rule.requiredFacts || []).map(canonicalFactKey);
  rule.predicate = normalizePredicate(rule.predicate);
  if (!rule.id || ids.has(rule.id)) errors.push(`rules[${index}]: duplicate or missing id '${rule.id}'.`);
  ids.add(rule.id);
  if (!rule.semanticKey || semanticKeys.has(rule.semanticKey)) errors.push(`rules[${index}]: duplicate or missing semanticKey '${rule.semanticKey}'.`);
  semanticKeys.add(rule.semanticKey);
  if (!supportedScopes.has(rule.scope)) errors.push(`rules[${index}]: unsupported scope '${rule.scope}'.`);
  if (!supportedModes.has(rule.verificationMode)) errors.push(`rules[${index}]: unsupported verificationMode '${rule.verificationMode}'.`);
  if (!supportedCategories.has(rule.category)) errors.push(`rules[${index}]: unsupported category '${rule.category}'.`);
  rule.requiredFacts.forEach((key, factIndex) => { if (!factEntry(key)) errors.push(`rules[${index}].requiredFacts[${factIndex}]: unknown fact '${key}'.`); });
  if (rule.predicate) validatePredicate(rule.predicate, `rules[${index}].predicate`);
});

for (const [key, coordinate] of Object.entries(templateMap.generalFields || {})) {
  const canonical = canonicalFactKey(key);
  if (key !== 'generalComments' && !factEntry(canonical)) errors.push(`template_map.generalFields: unknown fact '${key}'.`);
  if (!coordinate?.sheet || !/^[A-Z]{1,3}[1-9][0-9]*$/.test(coordinate?.cell || '')) errors.push(`template_map.generalFields.${key}: malformed cell mapping.`);
  if (canonical !== key) { templateMap.generalFields[canonical] = coordinate; delete templateMap.generalFields[key]; }
}
const cellIsValid = cell => /^[A-Z]{1,3}[1-9][0-9]*$/.test(cell || '');
for (const [semanticKey, mapping] of Object.entries(templateMap.ruleCellMappings || {})) {
  const rule = rules.find(item => item.semanticKey === semanticKey);
  if (!rule) errors.push(`template_map.ruleCellMappings: orphan semantic key '${semanticKey}'.`);
  if (rule && mapping.ruleId !== rule.id) errors.push(`template_map.ruleCellMappings.${semanticKey}: ruleId does not match rule.`);
  if (!mapping || !Number.isInteger(mapping.row) || mapping.row < 1 || !['naCell', 'detailerCell', 'checkerCell', 'commentsCell', 'initialsCell'].every(name => cellIsValid(mapping[name]))) errors.push(`template_map.ruleCellMappings.${semanticKey}: malformed cell mapping.`);
}
for (const rule of rules) if (!templateMap.ruleCellMappings?.[rule.semanticKey]) errors.push(`template_map.ruleCellMappings: missing '${rule.semanticKey}'.`);
if (errors.length) throw new Error(`Rule pack validation failed:\n${errors.join('\n')}`);

// 3. Re-serialize canonical JSON with LF line endings
const formattedRules = normalizeLf(JSON.stringify(rules, null, 2) + '\n');
const formattedTemplateMap = normalizeLf(JSON.stringify(templateMap, null, 2) + '\n');
const formattedApprovedMappings = normalizeLf(JSON.stringify(approvedMappings, null, 2) + '\n');
const formattedFactContract = normalizeLf(JSON.stringify(factContract, null, 2) + '\n');

fs.writeFileSync(rulesPath, formattedRules, 'utf8');
fs.writeFileSync(templateMapPath, formattedTemplateMap, 'utf8');
fs.writeFileSync(approvedMappingsPath, formattedApprovedMappings, 'utf8');
fs.writeFileSync(factContractPath, formattedFactContract, 'utf8');

// 4. Compute artifact hashes
const templateBuffer = fs.readFileSync(templatePath);
const templateSha = sha256(templateBuffer);
const rulesSha = canonicalJsonSha256(formattedRules);
const templateMapSha = canonicalJsonSha256(formattedTemplateMap);
const approvedMappingsSha = canonicalJsonSha256(formattedApprovedMappings);

const activeRules = rules.filter(r => !r.isArchived).length;
const archivedRules = rules.filter(r => r.isArchived).length;

const files = {
  'rules.json': {
    sha256: rulesSha,
    totalRules: rules.length,
    activeRules,
    archivedRules
  },
  'template_map.json': {
    sha256: templateMapSha
  },
  'approved_mappings.json': {
    sha256: approvedMappingsSha
  },
  'fact_contract.json': {
    sha256: canonicalJsonSha256(formattedFactContract)
  },
  'template.xlsx': {
    sha256: templateSha
  }
};

// 5. Compute bundle SHA-256
const bundleIdentity = REQUIRED_FILES.map(name => `${name}:${files[name].sha256}`).join('\n');
const bundleSha256 = sha256(Buffer.from(bundleIdentity, 'utf8'));

// 6. Read existing manifest version or use default
let version = '14.0.0';
let name = 'AHU Detailing Verification Rule Pack';
let generatedAt = new Date().toISOString();
if (fs.existsSync(manifestPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (existing.version) version = existing.version;
    if (existing.name) name = existing.name;
    if (existing.bundleSha256 === bundleSha256 && existing.generatedAt) {
      generatedAt = existing.generatedAt;
    }
  } catch (e) {
    // ignore parse error on old manifest
  }
}

const manifest = {
  name,
  version,
  generatedAt,
  bundleSha256,
  files
};

const formattedManifest = normalizeLf(JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(manifestPath, formattedManifest, 'utf8');

console.log(`------------------------------------------------------------`);
console.log(`Rule Pack v${version} built successfully.`);
console.log(`Bundle SHA-256 : ${bundleSha256}`);
console.log(`Total Rules    : ${rules.length} (${activeRules} active, ${archivedRules} archived)`);
console.log(`Rules Hash     : ${rulesSha}`);
console.log(`Template Hash  : ${templateSha}`);
console.log(`------------------------------------------------------------`);
