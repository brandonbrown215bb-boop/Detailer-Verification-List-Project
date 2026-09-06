import assert from 'assert';
import { projectSessionReadiness } from '../src/utils/readiness.ts';
import { desktopBridge } from '../src/services/desktopBridge.ts';

console.log('======================================================================');
console.log(' CE2-A: C# ProjectSession Engine Integration & Readiness Tests');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: projectSessionReadiness Projection from C# Snapshot
// ---------------------------------------------------------------------------
console.log('[Suite 1/3] C# Session Snapshot Readiness Projection...');

const mockSnapshot = {
  sessionId: 'test-session-123',
  revision: 4,
  graph: {
    skids: [{ id: 'skid-1', name: 'Shipping Skid 1' }],
    segments: [],
    bases: [],
    unitWeight: 5000,
    dimensions: { length: 120, width: 60, height: 72 },
    unitOptions: { unitType: 'Outdoor' }
  },
  facts: {
    'unit.jobName': {
      key: 'unit.jobName',
      label: 'Job Name',
      category: 'Order & Identity',
      value: 'Hospital Wing B',
      status: 'Known',
      confidence: 'Authoritative'
    },
    'unit.noa': {
      key: 'unit.noa',
      label: 'NOA Certified',
      category: 'Ratings',
      value: false,
      status: 'Known',
      confidence: 'RequiresConfirmation'
    },
    'unit.unknownFact': {
      key: 'unit.unknownFact',
      label: 'Unknown Spec',
      category: 'Order & Identity',
      value: null,
      status: 'Unknown',
      confidence: 'RequiresConfirmation'
    }
  },
  checklists: [
    {
      instanceKey: 'chk-1',
      ruleId: 'RULE-1',
      scopeTargetId: 'unit',
      status: 'Passed',
      applicability: 'Applicable',
      detailerComment: 'All good'
    },
    {
      instanceKey: 'chk-2',
      ruleId: 'RULE-2',
      scopeTargetId: 'unit',
      status: 'Incomplete',
      applicability: 'NeedsInput',
      detailerComment: ''
    },
    {
      instanceKey: 'chk-3',
      ruleId: 'RULE-3',
      scopeTargetId: 'skid-1',
      status: 'Incomplete',
      applicability: 'Applicable',
      detailerComment: ''
    }
  ],
  specialQuotes: [
    {
      slot: 1,
      id: 'sq-101',
      text: 'Custom drain pan depth',
      isCompleted: true
    }
  ],
  generalComments: 'Verified according to standards.',
  source: {
    fileName: 'Config.xml',
    filePath: 'C:\\Projects\\Config.xml',
    fileSha256: 'abc123sha',
    isUpz: false,
    isTrusted: true
  },
  rulePack: {
    version: '1.0.0',
    bundleSha256: 'bundle123',
    generation: 1
  },
  readiness: {
    isReadyForFinal: false,
    isDraftOnly: false,
    unconfirmedFactsCount: 2,
    blockedChecksCount: 1,
    incompleteChecksCount: 1,
    completedChecksCount: 1,
    totalApplicableChecksCount: 2,
    totalChecksCount: 3,
    incompleteSpecialQuotesCount: 0,
    percentComplete: 50,
    scopeReadinessMap: {
      'unit': {
        scopeTargetId: 'unit',
        totalChecksCount: 2,
        applicableChecksCount: 1,
        completedChecksCount: 1,
        incompleteChecksCount: 0,
        blockedChecksCount: 1,
        percentComplete: 100,
        isComplete: false
      },
      'skid-1': {
        scopeTargetId: 'skid-1',
        totalChecksCount: 1,
        applicableChecksCount: 1,
        completedChecksCount: 0,
        incompleteChecksCount: 1,
        blockedChecksCount: 0,
        percentComplete: 0,
        isComplete: false
      }
    },
    blockers: ['2 unconfirmed facts', '1 rule blocked awaiting fact confirmation']
  },
  isDirty: false
};

const readiness = projectSessionReadiness(mockSnapshot);

assert.strictEqual(readiness.isReadyForFinal, false, 'isReadyForFinal matches snapshot authoritative value');
assert.strictEqual(readiness.unconfirmedFactsCount, 2, 'unconfirmedFactsCount matches snapshot');
assert.strictEqual(readiness.blockedChecksCount, 1, 'blockedChecksCount matches snapshot');
assert.strictEqual(readiness.completedChecksCount, 1, 'completedChecksCount matches snapshot');
assert.strictEqual(readiness.totalApplicableChecksCount, 2, 'totalApplicableChecksCount matches snapshot');
assert.strictEqual(readiness.percentComplete, 50, 'percentComplete matches snapshot');

// Verify unconfirmedFacts list contains both RequiresConfirmation and Unknown facts
assert.strictEqual(readiness.unconfirmedFacts.length, 2, 'unconfirmedFacts list extracted');
assert.strictEqual(readiness.unconfirmedFacts.some(f => f.key === 'unit.noa'), true, 'unit.noa is in unconfirmedFacts');
assert.strictEqual(readiness.unconfirmedFacts.some(f => f.key === 'unit.unknownFact'), true, 'unit.unknownFact is in unconfirmedFacts');

// Verify blocked, incomplete, and passed rules lists
assert.strictEqual(readiness.blockedRules.length, 1, 'blockedRules length 1');
assert.strictEqual(readiness.blockedRules[0].instanceKey, 'chk-2', 'chk-2 is blocked rule');
assert.strictEqual(readiness.incompleteRules.length, 1, 'incompleteRules length 1');
assert.strictEqual(readiness.incompleteRules[0].instanceKey, 'chk-3', 'chk-3 is incomplete rule');
assert.strictEqual(readiness.passedRules.length, 1, 'passedRules length 1');
assert.strictEqual(readiness.passedRules[0].instanceKey, 'chk-1', 'chk-1 is passed rule');

// Verify scopeReadinessMap
assert.ok(readiness.scopeReadinessMap['unit'], 'unit scope mapped');
assert.strictEqual(readiness.scopeReadinessMap['unit'].percentComplete, 100, 'unit scope percent complete');
assert.ok(readiness.scopeReadinessMap['skid-1'], 'skid-1 scope mapped');
assert.strictEqual(readiness.scopeReadinessMap['skid-1'].percentComplete, 0, 'skid-1 scope percent complete');

console.log('  ✓ Authoritative snapshot readiness correctly projected into UnitReadiness model');
console.log('  ✓ Unconfirmed facts and blocked rules filtered correctly for Resolution Center');
console.log('  ✓ Per-scope readiness metrics projected accurately for Skid View');

// ---------------------------------------------------------------------------
// Suite 2: Bridge Interface Method Presence & Signatures
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/3] Desktop Bridge Session Command Routing...');

assert.strictEqual(typeof desktopBridge.projectSessionOpen, 'function', 'projectSessionOpen exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionGetSnapshot, 'function', 'projectSessionGetSnapshot exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionOverrideFact, 'function', 'projectSessionOverrideFact exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionBatchOverrideFacts, 'function', 'projectSessionBatchOverrideFacts exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionRevertFact, 'function', 'projectSessionRevertFact exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionUpdateChecklist, 'function', 'projectSessionUpdateChecklist exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionUpdateSpecialQuote, 'function', 'projectSessionUpdateSpecialQuote exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionDeleteSpecialQuote, 'function', 'projectSessionDeleteSpecialQuote exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionReorderSpecialQuotes, 'function', 'projectSessionReorderSpecialQuotes exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionUpdateGeneralComments, 'function', 'projectSessionUpdateGeneralComments exists on desktopBridge');
assert.strictEqual(typeof desktopBridge.projectSessionReset, 'function', 'projectSessionReset exists on desktopBridge');

console.log('  ✓ All 11 ProjectSession bridge command methods exposed on DesktopBridge');

// ---------------------------------------------------------------------------
// Suite 3: Browser Preview Fallback Safe Guard
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/3] Browser Preview Bridge Safety Guard...');

// In non-desktop environment (node test runner), calls to native projectSession should throw cleanly
let errorThrown = false;
try {
  await desktopBridge.projectSessionGetSnapshot();
} catch (err) {
  errorThrown = true;
  assert.ok(err.message.includes('desktop host'), `Expected desktop host error message, got: ${err.message}`);
}
assert.strictEqual(errorThrown, true, 'BrowserPreviewBridge safely throws when ProjectSession called without WebView2');

console.log('  ✓ BrowserPreviewBridge properly guards ProjectSession native commands');

console.log('\n======================================================================');
console.log(' [SUCCESS] All CE2-A integration assertions passed cleanly!');
console.log('======================================================================\n');
