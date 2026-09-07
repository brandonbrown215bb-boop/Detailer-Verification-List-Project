import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { desktopBridge } from '../src/services/desktopBridge.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');

console.log('======================================================================');
console.log(' CE5: Desktop-Only Engine & Dependency Cleanliness Verification Suite');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAILED] ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Suite 1: Physical Deletion of Retired TypeScript Engine Modules
// ---------------------------------------------------------------------------
console.log('[Suite 1/4] Physical Deletion of Duplicate TS Engine Modules...');

const retiredFiles = [
  'browserPreviewIngestion.ts',
  'xmlParser.ts',
  'factRegistry.ts',
  'ruleEvaluator.ts',
  'manualUnitFactory.ts',
  'projectStorage.ts',
  'excelExporter.ts',
  'rulesCatalog.ts'
];

retiredFiles.forEach(file => {
  runTest(`1.${retiredFiles.indexOf(file) + 1} src/services/${file} is physically deleted`, () => {
    const fullPath = path.join(srcDir, 'services', file);
    assert.strictEqual(fs.existsSync(fullPath), false, `${file} must NOT exist on disk.`);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Source Code Import Cleanliness (No xlsx, file-saver, or retired modules)
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] Source Tree Import Cleanliness...');

function getAllFiles(dir, extensions = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(res, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(res);
    }
  }
  return files;
}

const sourceFiles = getAllFiles(srcDir);

runTest('2.1 Zero imports of xlsx or file-saver in src/', () => {
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.strictEqual(content.includes("from 'xlsx'"), false, `${file} imports xlsx`);
    assert.strictEqual(content.includes('from "xlsx"'), false, `${file} imports xlsx`);
    assert.strictEqual(content.includes("from 'file-saver'"), false, `${file} imports file-saver`);
    assert.strictEqual(content.includes('from "file-saver"'), false, `${file} imports file-saver`);
  }
});

runTest('2.2 Zero imports of retired TS engine modules in src/', () => {
  const patterns = [
    'browserPreviewIngestion',
    'xmlParser',
    'factRegistry',
    'ruleEvaluator',
    'manualUnitFactory',
    'projectStorage',
    'excelExporter',
    'rulesCatalog'
  ];
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      const regex = new RegExp(`from\\s+['"][^'"]*\\b${pattern}\\b`, 'i');
      assert.strictEqual(regex.test(content), false, `${file} imports retired module: ${pattern}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Suite 3: Desktop Bridge Guards & Absence of BrowserPreviewBridge
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/4] Desktop Bridge Runtime Guards & Class Removal...');

runTest('3.1 BrowserPreviewBridge class is completely removed from desktopBridge.ts', () => {
  const bridgeContent = fs.readFileSync(path.join(srcDir, 'services', 'desktopBridge.ts'), 'utf8');
  assert.strictEqual(bridgeContent.includes('class BrowserPreviewBridge'), false, 'BrowserPreviewBridge must not exist');
  assert.strictEqual(bridgeContent.includes('new BrowserPreviewBridge'), false, 'BrowserPreviewBridge instantiation must not exist');
});

runTest('3.2 desktopBridge.isDesktopHost() returns false in node/browser environment', () => {
  assert.strictEqual(desktopBridge.isDesktopHost(), false);
  assert.strictEqual(desktopBridge.isRunningInDesktop(), false);
});

runTest('3.3 desktopBridge methods reject when outside desktop host', async () => {
  await assert.rejects(
    async () => desktopBridge.projectSessionGetSnapshot(),
    /desktop host/i
  );
  await assert.rejects(
    async () => desktopBridge.getRulePack(),
    /desktop host/i
  );
  await assert.rejects(
    async () => desktopBridge.projectSessionOpen({ configXml: '<AHU />' }),
    /desktop host/i
  );
});

// ---------------------------------------------------------------------------
// Suite 4: DesktopHostRequiredScreen Component & C# Bridge Contract
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] Desktop Host Required Screen & C# Authorization Contract...');

runTest('4.1 DesktopHostRequiredScreen exists and contains remediation & diagnostic copy', () => {
  const screenPath = path.join(srcDir, 'components', 'DesktopHostRequiredScreen.tsx');
  assert.strictEqual(fs.existsSync(screenPath), true);
  const screenContent = fs.readFileSync(screenPath, 'utf8');
  assert.strictEqual(screenContent.includes('Desktop Application Required'), true);
  assert.strictEqual(screenContent.includes('Copy Diagnostics'), true);
  assert.strictEqual(screenContent.includes('AHUVerification.App.exe'), true);
});

runTest('4.2 App.tsx renders DesktopHostRequiredScreen when !desktopBridge.isDesktopHost()', () => {
  const appContent = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');
  assert.strictEqual(appContent.includes('DesktopHostRequiredScreen'), true);
  assert.strictEqual(appContent.includes('!desktopBridge.isDesktopHost()'), true);
});

runTest('4.3 BridgeHandler.cs authorizes disk-verified drag-and-drop paths', () => {
  const bridgeHandlerPath = path.join(srcDir, 'backend', 'AHUVerification.App', 'Bridge', 'BridgeHandler.cs');
  assert.strictEqual(fs.existsSync(bridgeHandlerPath), true);
  const handlerContent = fs.readFileSync(bridgeHandlerPath, 'utf8');
  assert.strictEqual(handlerContent.includes('AuthorizeSourcePath(cmd.FilePath)'), true);
});

console.log('\n======================================================================');
console.log(` [SUCCESS] All ${passedTests}/${totalTests} CE5 desktop-only assertions passed!`);
console.log('======================================================================\n');
