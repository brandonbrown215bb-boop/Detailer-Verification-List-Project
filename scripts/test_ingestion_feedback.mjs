#!/usr/bin/env node

/**
 * File Ingestion & Action Feedback Live Test Suite (M3 / R3)
 * Validates XML/UPZ ingestion error trapping, durable error banner state machines,
 * desktop bridge process launch handlers, and settings action feedback.
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
console.log(' AHU Verification - File Ingestion & Action Feedback Tests (M3 / R3)');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: XML Parser Error Trapping & Descriptive Exceptions
// ---------------------------------------------------------------------------
console.log('[Suite 1/4] Ingestion Schema Validation & Descriptive Exceptions...');

const xmlParserPath = path.join(srcDir, 'services', 'xmlParser.ts');
assert(!fs.existsSync(xmlParserPath), 'xmlParser.ts deleted from src/services/ in CE5 (C# authoritative engine)');

// ---------------------------------------------------------------------------
// Suite 2: Desktop Bridge Rule Editor Process Launch Handler (Gutted in CE4)
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] Desktop Bridge Rule Editor Launch Handler (Gutted in CE4)...');

const desktopBridgePath = path.join(srcDir, 'services', 'desktopBridge.ts');
assert(fs.existsSync(desktopBridgePath), 'desktopBridge.ts exists in src/services/');

const desktopBridgeSource = fs.readFileSync(desktopBridgePath, 'utf8');
assert(!desktopBridgeSource.includes('launchRuleEditor'), 'desktopBridge.ts does not define gutted launchRuleEditor method');

// ---------------------------------------------------------------------------
// Suite 3: HomePage Durable Error Banners & Loading Progress State
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/4] HomePage Durable Error Banner & Ingestion Progress...');

const homePagePath = path.join(srcDir, 'components', 'HomePage.tsx');
assert(fs.existsSync(homePagePath), 'HomePage.tsx exists in src/components/');

const homePageSource = fs.readFileSync(homePagePath, 'utf8');
assert(homePageSource.includes('ImportErrorState'), 'HomePage.tsx exports/defines structured ImportErrorState interface');
assert(homePageSource.includes('isProcessing'), 'HomePage.tsx tracks isProcessing loading state');
assert(homePageSource.includes('processingMessage'), 'HomePage.tsx tracks processingMessage for step-by-step detail');
assert(homePageSource.includes('importError'), 'HomePage.tsx tracks durable importError state');
assert(homePageSource.includes('role="alert"'), 'HomePage.tsx error banner has accessible role="alert" attribute');
assert(homePageSource.includes('Suggested Recovery Steps:'), 'HomePage.tsx renders actionable recovery steps in error banner');
assert(homePageSource.includes('Try Another File'), 'HomePage.tsx provides retry file action');
assert(homePageSource.includes('Create Manually'), 'HomePage.tsx provides fallback manual setup action');
assert(homePageSource.includes('Loader2') || homePageSource.includes('animate-spin'), 'HomePage.tsx displays animated loading spinner during ingestion');

// ---------------------------------------------------------------------------
// Suite 4: SettingsModal Rule Editor Feedback & C# Bridge Handler (Gutted in CE4)
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] SettingsModal Action Feedback & Backend Bridge (Gutted in CE4)...');

const settingsModalPath = path.join(srcDir, 'components', 'SettingsModal.tsx');
assert(fs.existsSync(settingsModalPath), 'SettingsModal.tsx exists in src/components/');

const settingsModalSource = fs.readFileSync(settingsModalPath, 'utf8');
assert(!settingsModalSource.includes('handleLaunchRuleEditor'), 'SettingsModal.tsx removed handleLaunchRuleEditor handler');
assert(!settingsModalSource.includes('launchRuleEditor'), 'SettingsModal.tsx does not reference launchRuleEditor');

const bridgeHandlerCsPath = path.join(srcDir, 'backend', 'AHUVerification.App', 'Bridge', 'BridgeHandler.cs');
if (fs.existsSync(bridgeHandlerCsPath)) {
  const bridgeHandlerCsSource = fs.readFileSync(bridgeHandlerCsPath, 'utf8');
  assert(!bridgeHandlerCsSource.includes('"launchRuleEditor" =>'), 'BridgeHandler.cs does not route gutted launchRuleEditor');
}

// Summary
console.log('\n======================================================================');
if (failedTests === 0) {
  console.log(` [SUCCESS] All ${totalTests} ingestion & action feedback assertions passed cleanly!`);
  console.log('======================================================================\n');
  process.exit(0);
} else {
  console.error(` [FAILURE] ${failedTests} of ${totalTests} assertions failed.`);
  console.log('======================================================================\n');
  process.exit(1);
}
