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

import {
  formatEnumLabel,
  sanitizeDomainText,
  sanitizeForExcel,
  formatDimension,
  formatDimensionSummary
} from '../src/utils/formatters.ts';

// ---------------------------------------------------------------------------
// Suite 1: formatEnumLabel Unit Tests (Direct Source Import)
// ---------------------------------------------------------------------------
console.log('[Suite 1/5] PascalCase Enum Formatting & Acronym Preservation...');

const formattersPath = path.join(srcDir, 'utils', 'formatters.ts');
assert(fs.existsSync(formattersPath), 'formatters.ts utility exists in src/utils/');

// Direct tests on formatEnumLabel from formatters.ts
assert(formatEnumLabel('StructuralSteel') === 'Structural Steel', 'StructuralSteel -> Structural Steel');
assert(formatEnumLabel('FormedChannel') === 'Formed Channel', 'FormedChannel -> Formed Channel');
assert(formatEnumLabel('ThermalBreak') === 'Thermal Break', 'ThermalBreak -> Thermal Break');
assert(formatEnumLabel('RequiresConfirmation') === 'Requires Confirmation', 'RequiresConfirmation -> Requires Confirmation');
assert(formatEnumLabel('NeedsInput') === 'Needs Input', 'NeedsInput -> Needs Input');
assert(formatEnumLabel('ManuallyOverridden') === 'Manually Overridden', 'ManuallyOverridden -> Manually Overridden');
assert(formatEnumLabel('NotApplicable') === 'Not Applicable', 'NotApplicable -> Not Applicable');
assert(formatEnumLabel('SingleWall') === 'Single Wall', 'SingleWall -> Single Wall');
assert(formatEnumLabel('DoubleWall') === 'Double Wall', 'DoubleWall -> Double Wall');
assert(formatEnumLabel('GalvanizedSteel') === 'Galvanized Steel', 'GalvanizedSteel -> Galvanized Steel');
assert(formatEnumLabel('StainlessSteel') === 'Stainless Steel', 'StainlessSteel -> Stainless Steel');
assert(formatEnumLabel('MarineAluminum') === 'Marine Aluminum', 'MarineAluminum -> Marine Aluminum');
assert(formatEnumLabel('DirectExpansion') === 'Direct Expansion (DX)', 'DirectExpansion -> Direct Expansion (DX)');
assert(formatEnumLabel('StandardDirectDrive') === 'Standard Direct Drive', 'StandardDirectDrive -> Standard Direct Drive');
assert(formatEnumLabel('FanArray') === 'Fan Array', 'FanArray -> Fan Array');
assert(formatEnumLabel('FlaggedForReview') === 'Flagged for Review', 'FlaggedForReview -> Flagged for Review');
assert(formatEnumLabel('AwaitingExtraction') === 'Awaiting Extraction', 'AwaitingExtraction -> Awaiting Extraction');
// Dynamic CamelCase/PascalCase fallback & acronym tests
assert(formatEnumLabel('customVFDDrive') === 'Custom VFD Drive', 'customVFDDrive -> Custom VFD Drive (preserves VFD acronym)');
assert(formatEnumLabel('ahuSupplyAir') === 'AHU Supply Air', 'ahuSupplyAir -> AHU Supply Air (preserves AHU acronym)');
assert(formatEnumLabel('ecmMotorType') === 'ECM Motor Type', 'ecmMotorType -> ECM Motor Type (preserves ECM acronym)');
// Boundary cases
assert(formatEnumLabel(null) === '', 'formatEnumLabel(null) returns empty string');
assert(formatEnumLabel(undefined) === '', 'formatEnumLabel(undefined) returns empty string');
assert(formatEnumLabel('') === '', 'formatEnumLabel("") returns empty string');
assert(formatEnumLabel('   ') === '', 'formatEnumLabel("   ") returns empty string');

// ---------------------------------------------------------------------------
// Suite 2: sanitizeDomainText & sanitizeForExcel Unit Tests (Direct Source Import)
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/5] Domain Text & Excel Sanitization...');

// sanitizeDomainText direct assertions
assert(sanitizeDomainText('Contains $N \\ge 1$ shipping splits.') === 'Contains one or more shipping splits.', 'Replaces $N \\ge 1$ with "one or more"');
assert(sanitizeDomainText('Requires $N \\geq 1$ skids.') === 'Requires one or more skids.', 'Replaces $N \\geq 1$ with "one or more"');
assert(sanitizeDomainText('Requires $N >= 1$ skids.') === 'Requires one or more skids.', 'Replaces $N >= 1$ with "one or more"');
assert(sanitizeDomainText('Requires $N \\ge 2$ skids.') === 'Requires two or more skids.', 'Replaces $N \\ge 2$ with "two or more"');
assert(sanitizeDomainText('Parsed normalized XML tree.') === 'Parsed AHU configuration tree.', 'Replaces "normalized XML" with "AHU configuration"');
assert(sanitizeDomainText('15 domain facts pending.') === '15 project facts pending.', 'Replaces "domain facts" with "project facts"');
assert(sanitizeDomainText('Evaluated AST verification rules.') === 'Evaluated verification rules.', 'Replaces "AST verification rules" with "verification rules"');
assert(sanitizeDomainText('AST Rule Logic Trace:') === 'Rule Verification Logic:', 'Replaces "AST Rule Logic Trace" with "Rule Verification Logic"');
assert(sanitizeDomainText('Expand AST logic trace') === 'Expand rule logic trace', 'Replaces "Expand AST logic trace"');
assert(sanitizeDomainText('Generates OpenXML deliverables.') === 'Generates Excel deliverables.', 'Replaces "OpenXML deliverables" with "Excel deliverables"');
assert(sanitizeDomainText('Download .dvl project.') === 'Save Project (.dvl) project.', 'Replaces "Download .dvl" with "Save Project (.dvl)"');
assert(sanitizeDomainText('Download Excel workbook.') === 'Export Excel (.xlsx) workbook.', 'Replaces "Download Excel" with "Export Excel (.xlsx)"');
assert(sanitizeDomainText('Download Verification List.') === 'Export Verification List (.xlsx).', 'Replaces "Download Verification List"');
assert(sanitizeDomainText(null) === '', 'sanitizeDomainText(null) returns empty string');
assert(sanitizeDomainText(undefined) === '', 'sanitizeDomainText(undefined) returns empty string');

// sanitizeForExcel formula injection protection & control character strip
assert(sanitizeForExcel('=SUM(A1:A10)') === "'=SUM(A1:A10)", 'sanitizeForExcel escapes formula leading =');
assert(sanitizeForExcel('+12345') === "'+12345", 'sanitizeForExcel escapes formula leading +');
assert(sanitizeForExcel('-10% discount') === "'-10% discount", 'sanitizeForExcel escapes formula leading -');
assert(sanitizeForExcel('@cmd|/C calc') === "'@cmd|/C calc", 'sanitizeForExcel escapes formula leading @');
assert(sanitizeForExcel('Normal text without formula') === 'Normal text without formula', 'sanitizeForExcel preserves normal strings');
assert(sanitizeForExcel('Text with control char \x00\x08\x1F inside') === 'Text with control char  inside', 'sanitizeForExcel strips OpenXML invalid control chars');
assert(sanitizeForExcel(null) === '', 'sanitizeForExcel(null) returns empty string');

// ---------------------------------------------------------------------------
// Suite 3: Dimension Formatting Unit Tests (formatDimension & formatDimensionSummary)
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/5] Engineering Dimension Formatter Unit Tests...');

assert(formatDimension(120) === '120"', 'formatDimension(120) -> 120"');
assert(formatDimension(48.5) === '48.5"', 'formatDimension(48.5) -> 48.5"');
assert(formatDimension('96') === '96"', 'formatDimension("96") -> 96"');
assert(formatDimension(0) === '0"', 'formatDimension(0) -> 0"');
assert(formatDimension(null) === '0"', 'formatDimension(null) -> 0"');
assert(formatDimension(undefined) === '0"', 'formatDimension(undefined) -> 0"');
assert(formatDimension('', ' in') === '0 in', 'formatDimension("", " in") -> 0 in');
assert(formatDimension(10, ' ft') === '10 ft', 'formatDimension(10, " ft") -> 10 ft');

assert(
  formatDimensionSummary(120, 84, 96) === '120"L × 84"W × 96"H',
  'formatDimensionSummary(120, 84, 96) -> 120"L × 84"W × 96"H'
);
assert(
  formatDimensionSummary(null, undefined, 0) === '0"L × 0"W × 0"H',
  'formatDimensionSummary handles nullish inputs gracefully'
);


// ---------------------------------------------------------------------------
// Suite 4: Static Scan of User-Facing UI Components
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/5] Static Codebase Scan for Leaked Internals...');

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
// Suite 5: Specific Component Typography & Semantics Audit
// ---------------------------------------------------------------------------
console.log('\n[Suite 5/5] Component Specific Typography Audits...');

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
