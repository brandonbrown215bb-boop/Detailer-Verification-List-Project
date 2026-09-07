import assert from 'assert';
import {
  projectSessionReadiness,
  isFactUnconfirmed,
  isChecklistBlocked,
  isChecklistPassed,
  isChecklistCompleted,
  isChecklistIncomplete,
  resolveFactForScope,
  EMPTY_READINESS,
  EMPTY_SCOPE_READINESS
} from '../src/utils/readiness.ts';

console.log('======================================================================');
console.log(' AHU Verification - CE5 UI Readiness & Predicates Test Suite (Node v24 ESM)');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    console.error(`  ✗ [FAILED] ${testName}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Suite 1: UI Readiness Fact Predicates
// ---------------------------------------------------------------------------
console.log('[Suite 1/4] UI Fact Confirmation Predicates...');

runTest('1.1 isFactUnconfirmed handles null, undefined, Unknown, and RequiresConfirmation', () => {
  assert.strictEqual(isFactUnconfirmed(null), true);
  assert.strictEqual(isFactUnconfirmed(undefined), true);
  assert.strictEqual(isFactUnconfirmed({ status: 'Unknown', confidence: 'Authoritative' }), true);
  assert.strictEqual(isFactUnconfirmed({ status: 'Known', confidence: 'RequiresConfirmation' }), true);
  assert.strictEqual(isFactUnconfirmed({ status: 'Known', confidence: 'Authoritative' }), false);
  assert.strictEqual(isFactUnconfirmed({ status: 'Known', confidence: 'Verified' }), false);
});

// ---------------------------------------------------------------------------
// Suite 2: Checklist Rule Predicates
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] Checklist Rule State Predicates...');

runTest('2.1 isChecklistBlocked identifies NeedsInput applicability', () => {
  assert.strictEqual(isChecklistBlocked({ applicability: 'NeedsInput', status: 'Incomplete' }), true);
  assert.strictEqual(isChecklistBlocked({ applicability: 'Applicable', status: 'Incomplete' }), false);
  assert.strictEqual(isChecklistBlocked({ applicability: 'NotApplicable', status: 'NA' }), false);
});

runTest('2.2 isChecklistPassed identifies Applicable Passed status', () => {
  assert.strictEqual(isChecklistPassed({ applicability: 'Applicable', status: 'Passed' }), true);
  assert.strictEqual(isChecklistPassed({ applicability: 'Applicable', status: 'NA' }), false);
  assert.strictEqual(isChecklistPassed({ applicability: 'NeedsInput', status: 'Passed' }), false);
});

runTest('2.3 isChecklistCompleted handles allowNA rules correctly', () => {
  const itemNA = { applicability: 'Applicable', status: 'NA', allowNA: false };
  assert.strictEqual(isChecklistCompleted(itemNA), false);
  assert.strictEqual(isChecklistCompleted(itemNA, { allowNA: true }), true);

  const itemPassed = { applicability: 'Applicable', status: 'Passed' };
  assert.strictEqual(isChecklistCompleted(itemPassed), true);
});

runTest('2.4 isChecklistIncomplete correctly inverts completion', () => {
  assert.strictEqual(isChecklistIncomplete({ applicability: 'Applicable', status: 'Incomplete' }), true);
  assert.strictEqual(isChecklistIncomplete({ applicability: 'Applicable', status: 'Passed' }), false);
  assert.strictEqual(isChecklistIncomplete({ applicability: 'NotApplicable', status: 'NA' }), false);
});

// ---------------------------------------------------------------------------
// Suite 3: Scoped Fact Resolution
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/4] Scoped Fact Resolution...');

runTest('3.1 resolveFactForScope resolves scoped and generic keys', () => {
  const facts = {
    'unit.jobName': { key: 'unit.jobName', value: 'Tower 1' },
    'skid.skid-1.weight': { key: 'skid.skid-1.weight', value: 3500 },
    'skid.weight': { key: 'skid.weight', value: 3000 }
  };

  const scoped = resolveFactForScope(facts, 'skid.weight', 'skid-1');
  assert.strictEqual(scoped.resolvedKey, 'skid.skid-1.weight');
  assert.strictEqual(scoped.fact.value, 3500);

  const generic = resolveFactForScope(facts, 'unit.jobName', 'unit');
  assert.strictEqual(generic.resolvedKey, 'unit.jobName');
  assert.strictEqual(generic.fact.value, 'Tower 1');

  const empty = resolveFactForScope(null, '', 'unit');
  assert.strictEqual(empty.resolvedKey, '');
  assert.strictEqual(empty.fact, undefined);
});

// ---------------------------------------------------------------------------
// Suite 4: projectSessionReadiness Snapshot Projection
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] projectSessionReadiness Snapshot Projection...');

runTest('4.1 projects authoritative C# snapshot readiness to UI presentation model', () => {
  const mockSnapshot = {
    sessionId: 'test-sess',
    revision: 1,
    facts: {
      'unit.jobName': { key: 'unit.jobName', value: 'Hospital', status: 'Known', confidence: 'Authoritative' },
      'unit.comNumber': { key: 'unit.comNumber', value: null, status: 'Unknown', confidence: 'RequiresConfirmation' }
    },
    checklists: [
      { instanceKey: 'c1', ruleId: 'r1', scopeTargetId: 'unit', applicability: 'Applicable', status: 'Passed' },
      { instanceKey: 'c2', ruleId: 'r2', scopeTargetId: 'unit', applicability: 'NeedsInput', status: 'Incomplete' },
      { instanceKey: 'c3', ruleId: 'r3', scopeTargetId: 'skid-1', applicability: 'Applicable', status: 'Incomplete' }
    ],
    readiness: {
      unconfirmedFactsCount: 1,
      blockedChecksCount: 1,
      incompleteChecksCount: 1,
      completedChecksCount: 1,
      totalApplicableChecksCount: 2,
      totalChecksCount: 3,
      percentComplete: 50,
      isReadyForFinal: false,
      scopeReadinessMap: {
        'unit': {
          totalChecksCount: 2,
          applicableChecksCount: 1,
          completedChecksCount: 1,
          incompleteChecksCount: 0,
          blockedChecksCount: 1,
          percentComplete: 100,
          isComplete: true
        },
        'skid-1': {
          totalChecksCount: 1,
          applicableChecksCount: 1,
          completedChecksCount: 0,
          incompleteChecksCount: 1,
          blockedChecksCount: 0,
          percentComplete: 0,
          isComplete: false
        }
      }
    }
  };

  const projected = projectSessionReadiness(mockSnapshot);
  assert.strictEqual(projected.unconfirmedFactsCount, 1);
  assert.strictEqual(projected.blockedChecksCount, 1);
  assert.strictEqual(projected.incompleteChecksCount, 1);
  assert.strictEqual(projected.completedChecksCount, 1);
  assert.strictEqual(projected.percentComplete, 50);
  assert.strictEqual(projected.isReadyForFinal, false);
  assert.strictEqual(projected.scopeReadinessMap['unit'].isComplete, true);
  assert.strictEqual(projected.scopeReadinessMap['skid-1'].isComplete, false);
});

runTest('4.2 EMPTY_READINESS and EMPTY_SCOPE_READINESS default invariants', () => {
  assert.strictEqual(EMPTY_READINESS.isReadyForFinal, false);
  assert.strictEqual(EMPTY_READINESS.percentComplete, 0);
  assert.strictEqual(EMPTY_READINESS.totalChecksCount, 0);
  assert.strictEqual(EMPTY_SCOPE_READINESS.isComplete, false);
  assert.strictEqual(EMPTY_SCOPE_READINESS.totalChecksCount, 0);
});

console.log('\n======================================================================');
console.log(` [SUCCESS] All ${passedTests}/${totalTests} CE5 UI readiness assertions passed!`);
console.log('======================================================================\n');
