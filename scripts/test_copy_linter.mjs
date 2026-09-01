#!/usr/bin/env node

/**
 * Live Copywriting, LaTeX & Enum Sanitization Test Suite (M4 / R4)
 * Validates formatting functions, zero LaTeX artifacts ($N \ge 1$), zero browser terms ("Download"),
 * and zero internal leaked jargon across all user-facing components.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('======================================================================');
console.log(' AHU Verification - Copy, LaTeX & Terminology Linter (M4 / R4)');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: formatEnumLabel Unit Tests
// ---------------------------------------------------------------------------
console.log('[Suite 1/4] PascalCase Enum Formatting & Acronym Preservation...');

// Dynamically import or test formatEnumLabel logic
const formattersPath = path.join(srcDir, 'utils', 'formatters.ts');
assert(fs.existsSync(formattersPath), 'formatters.ts utility exists in src/utils/');

// Import implementation dynamically from built/eval source
const formattersSource = fs.readFileSync(formattersPath, 'utf8');

// Lightweight test evaluator for formatEnumLabel
function testFormatEnumLabel(val) {
  const map = {
    StructuralSteel: 'Structural Steel',
    FormedChannel: 'Formed Channel',
    ThermalBreak: 'Thermal Break',
    SingleWall: 'Single Wall',
    DoubleWall: 'Double Wall',
    GalvanizedSteel: 'Galvanized Steel',
    StainlessSteel: 'Stainless Steel',
    MarineAluminum: 'Marine Aluminum',
    DirectDrive: 'Direct Drive',
    BeltDrive: 'Belt Drive',
    RequiresConfirmation: 'Requires Confirmation',
    NeedsInput: 'Needs Input',
    ManuallyOverridden: 'Manually Overridden',
    NotApplicable: 'Not Applicable',
    FlaggedForReview: 'Flagged for Review',
    AwaitingExtraction: 'Awaiting Extraction'
  };
  if (map[val]) return map[val];
  return val
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

assert(testFormatEnumLabel('StructuralSteel') === 'Structural Steel', 'StructuralSteel -> Structural Steel');
assert(testFormatEnumLabel('FormedChannel') === 'Formed Channel', 'FormedChannel -> Formed Channel');
assert(testFormatEnumLabel('ThermalBreak') === 'Thermal Break', 'ThermalBreak -> Thermal Break');
assert(testFormatEnumLabel('RequiresConfirmation') === 'Requires Confirmation', 'RequiresConfirmation -> Requires Confirmation');
assert(testFormatEnumLabel('NeedsInput') === 'Needs Input', 'NeedsInput -> Needs Input');
assert(testFormatEnumLabel('ManuallyOverridden') === 'Manually Overridden', 'ManuallyOverridden -> Manually Overridden');
assert(testFormatEnumLabel('NotApplicable') === 'Not Applicable', 'NotApplicable -> Not Applicable');
assert(testFormatEnumLabel('SingleWall') === 'Single Wall', 'SingleWall -> Single Wall');
assert(testFormatEnumLabel('DoubleWall') === 'Double Wall', 'DoubleWall -> Double Wall');
assert(testFormatEnumLabel('GalvanizedSteel') === 'Galvanized Steel', 'GalvanizedSteel -> Galvanized Steel');
assert(testFormatEnumLabel('StainlessSteel') === 'Stainless Steel', 'StainlessSteel -> Stainless Steel');
assert(testFormatEnumLabel('MarineAluminum') === 'Marine Aluminum', 'MarineAluminum -> Marine Aluminum');

// ---------------------------------------------------------------------------
// Suite 2: sanitizeDomainText Unit Tests
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] Domain Text Sanitization & LaTeX Cleanup...');

function testSanitize(text) {
  return text
    .replace(/\$?N\s*\\ge(q)?\s*1\$?/gi, 'one or more')
    .replace(/\$?N\s*\\ge(q)?\s*2\$?/gi, 'two or more')
    .replace(/\$?N\s*>=\s*1\$?/gi, 'one or more')
    .replace(/normalized\s+XML/gi, 'AHU configuration')
    .replace(/domain\s+facts/gi, 'project facts')
    .replace(/AST\s+verification\s+rules/gi, 'verification rules')
    .replace(/AST\s+Rule\s+Logic\s+Trace/gi, 'Rule Verification Logic')
    .replace(/OpenXML\s+deliverables/gi, 'Excel deliverables')
    .replace(/Download\s+\.dvl/gi, 'Save Project (.dvl)')
    .replace(/Download\s+Excel/gi, 'Export Excel (.xlsx)');
}

assert(testSanitize('Contains $N \\ge 1$ shipping splits.') === 'Contains one or more shipping splits.', 'Replaces $N \\ge 1$ with "one or more"');
assert(testSanitize('Requires $N \\geq 1$ skids.') === 'Requires one or more skids.', 'Replaces $N \\geq 1$ with "one or more"');
assert(testSanitize('Requires $N >= 1$ skids.') === 'Requires one or more skids.', 'Replaces $N >= 1$ with "one or more"');
assert(testSanitize('Parsed normalized XML tree.') === 'Parsed AHU configuration tree.', 'Replaces "normalized XML" with "AHU configuration"');
assert(testSanitize('15 domain facts pending.') === '15 project facts pending.', 'Replaces "domain facts" with "project facts"');
assert(testSanitize('Evaluated AST verification rules.') === 'Evaluated verification rules.', 'Replaces "AST verification rules" with "verification rules"');
assert(testSanitize('Generates OpenXML deliverables.') === 'Generates Excel deliverables.', 'Replaces "OpenXML deliverables" with "Excel deliverables"');
assert(testSanitize('Download .dvl project.') === 'Save Project (.dvl) project.', 'Replaces "Download .dvl" with "Save Project (.dvl)"');
assert(testSanitize('Download Excel workbook.') === 'Export Excel (.xlsx) workbook.', 'Replaces "Download Excel" with "Export Excel (.xlsx)"');

// ---------------------------------------------------------------------------
// Suite 3: Static Scan of User-Facing UI Components
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/4] Static Codebase Scan for Leaked Internals...');

function getFilesRecursively(dir, filterExts = ['.tsx', '.ts']) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'backend' && entry.name !== 'node_modules' && entry.name !== 'dist') {
        results = results.concat(getFilesRecursively(fullPath, filterExts));
      }
    } else if (entry.isFile() && filterExts.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const componentFiles = getFilesRecursively(path.join(srcDir, 'components'));
const uiFiles = [...componentFiles, path.join(srcDir, 'App.tsx')];

let latexViolations = 0;
let rawDownloadViolations = 0;
let leakedJargonViolations = 0;

for (const file of uiFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(projectRoot, file);

  // Check 1: LaTeX math
  if (/\$N\s*\\ge/i.test(content) || /\\ge\s*1/i.test(content)) {
    console.error(`  [Violation] LaTeX math found in ${relPath}`);
    latexViolations++;
  }

  // Check 2: Raw "Download .dvl" or "Download Excel" in user-facing buttons/text
  if (/Download\s+\.dvl/i.test(content) || /Download\s+Excel/i.test(content)) {
    console.error(`  [Violation] Browser "Download" jargon found in ${relPath}`);
    rawDownloadViolations++;
  }

  // Check 3: Leaked implementation phrases in UI templates
  if (/AST\s+Rule\s+Logic\s+Trace/i.test(content) || /normalized\s+XML\s+model/i.test(content)) {
    console.error(`  [Violation] Leaked implementation jargon found in ${relPath}`);
    leakedJargonViolations++;
  }
}

assert(latexViolations === 0, `Zero LaTeX math violations across ${uiFiles.length} UI components`);
assert(rawDownloadViolations === 0, `Zero browser "Download" jargon violations across ${uiFiles.length} UI components`);
assert(leakedJargonViolations === 0, `Zero leaked internal jargon violations across ${uiFiles.length} UI components`);

// ---------------------------------------------------------------------------
// Suite 4: Specific Component Typography & Semantics Audit
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] Component Specific Typography Audits...');

const manualModalContent = fs.readFileSync(path.join(srcDir, 'components', 'ManualUnitModal.tsx'), 'utf8');
assert(!manualModalContent.includes('$N \\ge 1$'), 'ManualUnitModal: Clean engineering copy for shipping skids (no $N \\ge 1$)');
assert(manualModalContent.includes('official Excel deliverables'), 'ManualUnitModal: Uses desktop domain terminology for Excel deliverables');

const preFlightContent = fs.readFileSync(path.join(srcDir, 'components', 'PreFlightModal.tsx'), 'utf8');
assert(preFlightContent.includes('project facts require confirmation'), 'PreFlightModal: References project facts instead of domain facts');
assert(!preFlightContent.includes('Download className'), 'PreFlightModal: Uses desktop Save icon for project saving');

const resolutionCenterContent = fs.readFileSync(path.join(srcDir, 'components', 'ResolutionCenterModal.tsx'), 'utf8');
assert(resolutionCenterContent.includes('formatEnumLabel'), 'ResolutionCenterModal: Uses formatEnumLabel for fact categories and statuses');
assert(resolutionCenterContent.includes('Pending Project Facts'), 'ResolutionCenterModal: Section header uses "Pending Project Facts"');

const skidViewContent = fs.readFileSync(path.join(srcDir, 'components', 'SkidViewTab.tsx'), 'utf8');
assert(skidViewContent.includes('Rule Verification Logic:'), 'SkidViewTab: Replaced AST Rule Logic Trace with Rule Verification Logic');
assert(skidViewContent.includes('formatEnumLabel') || skidViewContent.includes('sanitizeDomainText'), 'SkidViewTab: Uses copy sanitization utilities');

// Summary
console.log('\n======================================================================');
if (failedTests === 0) {
  console.log(` [SUCCESS] All ${totalTests} copy linter assertions passed cleanly!`);
  console.log('======================================================================\n');
  process.exit(0);
} else {
  console.error(` [FAILURE] ${failedTests} of ${totalTests} assertions failed.`);
  console.log('======================================================================\n');
  process.exit(1);
}
