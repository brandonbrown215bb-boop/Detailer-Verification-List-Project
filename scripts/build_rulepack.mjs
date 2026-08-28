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
const templatePath = path.join(rulePackDir, 'template.xlsx');
const manifestPath = path.join(rulePackDir, 'manifest.json');

const rawRules = fs.readFileSync(rulesPath, 'utf8');
const rawTemplateMap = fs.readFileSync(templateMapPath, 'utf8');
const rawApprovedMappings = fs.readFileSync(approvedMappingsPath, 'utf8');

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

// 3. Re-serialize canonical JSON with LF line endings
const formattedRules = normalizeLf(JSON.stringify(rules, null, 2) + '\n');
const formattedTemplateMap = normalizeLf(JSON.stringify(templateMap, null, 2) + '\n');
const formattedApprovedMappings = normalizeLf(JSON.stringify(approvedMappings, null, 2) + '\n');

fs.writeFileSync(rulesPath, formattedRules, 'utf8');
fs.writeFileSync(templateMapPath, formattedTemplateMap, 'utf8');
fs.writeFileSync(approvedMappingsPath, formattedApprovedMappings, 'utf8');

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
if (fs.existsSync(manifestPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (existing.version) version = existing.version;
    if (existing.name) name = existing.name;
  } catch (e) {
    // ignore parse error on old manifest
  }
}

const manifest = {
  name,
  version,
  generatedAt: new Date().toISOString(),
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
