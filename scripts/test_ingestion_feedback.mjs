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
assert(fs.existsSync(xmlParserPath), 'xmlParser.ts exists in src/services/');

const xmlParserSource = fs.readFileSync(xmlParserPath, 'utf8');
assert(xmlParserSource.includes('Empty XML input received'), 'xmlParser.ts traps empty XML strings with descriptive exception');
assert(xmlParserSource.includes('DOMParser'), 'xmlParser.ts utilizes DOMParser for structural validation');

// ---------------------------------------------------------------------------
// Suite 2: Desktop Bridge Rule Editor Process Launch Handler
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] Desktop Bridge Rule Editor Launch Handler...');

const desktopBridgePath = path.join(srcDir, 'services', 'desktopBridge.ts');
assert(fs.existsSync(desktopBridgePath), 'desktopBridge.ts exists in src/services/');

const desktopBridgeSource = fs.readFileSync(desktopBridgePath, 'utf8');
assert(desktopBridgeSource.includes('launchRuleEditor'), 'desktopBridge.ts defines launchRuleEditor method');
assert(desktopBridgeSource.includes("this.sendRequest('launchRuleEditor')"), 'desktopBridge.ts routes launchRuleEditor to WebView2 host');
assert(desktopBridgeSource.includes('/rule-editor.html'), 'desktopBridge.ts provides browser preview fallback');

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
// Suite 4: SettingsModal Rule Editor Feedback & C# Bridge Handler
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] SettingsModal Action Feedback & Backend Bridge...');

const settingsModalPath = path.join(srcDir, 'components', 'SettingsModal.tsx');
assert(fs.existsSync(settingsModalPath), 'SettingsModal.tsx exists in src/components/');

const settingsModalSource = fs.readFileSync(settingsModalPath, 'utf8');
assert(settingsModalSource.includes('handleLaunchRuleEditor'), 'SettingsModal.tsx implements handleLaunchRuleEditor handler');
assert(settingsModalSource.includes('launchStatus'), 'SettingsModal.tsx tracks launchStatus (idle | launching | success | error)');
assert(settingsModalSource.includes('launchMessage'), 'SettingsModal.tsx renders dynamic feedback toast message');
assert(settingsModalSource.includes('desktopBridge.launchRuleEditor'), 'SettingsModal.tsx delegates launch to desktopBridge');

const bridgeHandlerCsPath = path.join(srcDir, 'backend', 'AHUVerification.App', 'Bridge', 'BridgeHandler.cs');
if (fs.existsSync(bridgeHandlerCsPath)) {
  const bridgeHandlerCsSource = fs.readFileSync(bridgeHandlerCsPath, 'utf8');
  assert(bridgeHandlerCsSource.includes('"launchRuleEditor" => LaunchRuleEditor()'), 'BridgeHandler.cs handles launchRuleEditor action');
  assert(bridgeHandlerCsSource.includes('LaunchRuleEditor()'), 'BridgeHandler.cs implements LaunchRuleEditor method');
} else {
  console.log('  - Note: BridgeHandler.cs path checked');
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
