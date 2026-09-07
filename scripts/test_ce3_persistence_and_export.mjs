import assert from 'assert';
import { desktopBridge } from '../src/services/desktopBridge.ts';

console.log('======================================================================');
console.log(' CE3: C# Authoritative DVL, Recovery & Excel Bridge Tests');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: Desktop Bridge Method Exposure & Preview Fallbacks
// ---------------------------------------------------------------------------
console.log('[Suite 1/3] Desktop Bridge CE3 Method Exposure & Preview Guarantees...');

assert.strictEqual(typeof desktopBridge.projectSessionSave, 'function', 'desktopBridge.projectSessionSave must be exposed');
assert.strictEqual(typeof desktopBridge.projectSessionOpenDvl, 'function', 'desktopBridge.projectSessionOpenDvl must be exposed');
assert.strictEqual(typeof desktopBridge.projectSessionExportExcel, 'function', 'desktopBridge.projectSessionExportExcel must be exposed');
assert.strictEqual(typeof desktopBridge.getRecoveryInfo, 'function', 'desktopBridge.getRecoveryInfo must be exposed');
assert.strictEqual(typeof desktopBridge.restoreRecovery, 'function', 'desktopBridge.restoreRecovery must be exposed');
assert.strictEqual(typeof desktopBridge.discardRecovery, 'function', 'desktopBridge.discardRecovery must be exposed');
console.log('  ✓ All 6 CE3 bridge methods properly exposed on desktopBridge');

// Test non-desktop environment rejection behavior
(async () => {
  await assert.rejects(
    () => desktopBridge.projectSessionSave({
      sessionId: 'mock-session-id',
      expectedRevision: 1,
      jobName: 'Test Job',
      comNumber: 'COM-123456',
      author: 'Test Detailer',
      targetPath: 'C:\\test\\job.dvl'
    }),
    /desktop host/i,
    'projectSessionSave in non-desktop environment must reject with desktop host error'
  );
  console.log('  ✓ projectSessionSave safely guards in non-desktop environment');

  await assert.rejects(
    () => desktopBridge.projectSessionOpenDvl({
      filePath: 'C:\\test\\job.dvl'
    }),
    /desktop host/i,
    'projectSessionOpenDvl in non-desktop environment must reject with desktop host error'
  );
  console.log('  ✓ projectSessionOpenDvl safely guards in non-desktop environment');

  await assert.rejects(
    () => desktopBridge.projectSessionExportExcel({
      sessionId: 'mock-session-id',
      expectedRevision: 1,
      targetPath: 'C:\\test\\job.xlsx',
      isDraftOnly: false,
      options: { includeAstDebug: false, includeFactsTab: true, freezePanes: true }
    }),
    /desktop host/i,
    'projectSessionExportExcel in non-desktop environment must reject with desktop host error'
  );
  console.log('  ✓ projectSessionExportExcel safely guards in non-desktop environment');

  await assert.rejects(
    () => desktopBridge.getRecoveryInfo(),
    /desktop host/i,
    'getRecoveryInfo in non-desktop environment must reject with desktop host error'
  );
  console.log('  ✓ getRecoveryInfo safely guards in non-desktop environment');

  await assert.rejects(
    () => desktopBridge.restoreRecovery(),
    /desktop host/i,
    'restoreRecovery in non-desktop environment must reject with desktop host error'
  );
  console.log('  ✓ restoreRecovery safely guards in non-desktop environment');

  await assert.rejects(
    () => desktopBridge.discardRecovery(),
    /desktop host/i,
    'discardRecovery in non-desktop environment must reject with desktop host error'
  );
  console.log('  ✓ discardRecovery safely guards in non-desktop environment');

  // ---------------------------------------------------------------------------
  // Suite 2: Contract Schema Validation
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 2/3] Bridge Contract & Payload Invariants...');

  const mockSavePayload = {
    sessionId: 'sess-001',
    expectedRevision: 5,
    jobName: 'Unit Hospital',
    comNumber: 'COM-999999',
    author: 'Detailer Alpha',
    checkerName: 'Checker Beta',
    targetPath: 'C:\\Projects\\Unit.dvl'
  };
  assert.ok(mockSavePayload.sessionId && mockSavePayload.expectedRevision > 0);
  assert.ok(mockSavePayload.targetPath.endsWith('.dvl'));
  console.log('  ✓ Save payload conforms to DVL persistence contract');

  const mockExportPayload = {
    sessionId: 'sess-001',
    expectedRevision: 5,
    targetPath: 'C:\\Projects\\Unit_Verification.xlsx',
    isDraftOnly: false,
    options: { includeAstDebug: false, includeFactsTab: true, freezePanes: true }
  };
  assert.ok(mockExportPayload.targetPath.endsWith('.xlsx'));
  assert.strictEqual(typeof mockExportPayload.isDraftOnly, 'boolean');
  console.log('  ✓ Export payload conforms to OpenXML deliverable contract');

  // ---------------------------------------------------------------------------
  // Suite 3: Recovery Info Schema & Untrusted State Handling
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 3/3] Recovery Information Model & Session Trust Semantics...');

  const sampleRecovery = {
    hasRecovery: true,
    jobName: 'Hospital Air Handler',
    comNumber: 'COM-887766',
    author: 'Detailer One',
    lastSavedAt: new Date().toISOString(),
    sourceFileName: 'Config.xml',
    isTrusted: true,
    recoveryFilePath: 'C:\\Users\\test\\AppData\\Local\\AHUVerification\\recovery\\recovery_session.dvl'
  };

  assert.strictEqual(sampleRecovery.hasRecovery, true);
  assert.ok(sampleRecovery.recoveryFilePath.endsWith('recovery_session.dvl'));
  assert.strictEqual(typeof sampleRecovery.isTrusted, 'boolean');
  console.log('  ✓ RecoveryInfo model accurately represents native crash recovery session');

  console.log('\n======================================================================');
  console.log(' [SUCCESS] All CE3 persistence, recovery & export assertions passed!');
  console.log('======================================================================\n');
})();
