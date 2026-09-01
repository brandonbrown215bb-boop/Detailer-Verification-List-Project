import assert from 'assert';
import {
  computeUnitReadiness,
  computeScopeReadiness,
  isFactUnconfirmed,
  isChecklistBlocked,
  isChecklistPassed,
  isChecklistCompleted,
  isChecklistIncomplete,
  resolveFactForScope
} from '../src/utils/readiness.ts';

console.log('======================================================================');
console.log(' AHU Verification - Live Readiness Predicate Test Suite (Node v24 ESM)');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;
let totalAssertions = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    console.error(`  ✗ [FAILED] ${testName}`);
    console.error(`    Error: ${err.message}`);
    if (err.actual !== undefined && err.expected !== undefined) {
      console.error(`    Actual:   ${JSON.stringify(err.actual)}`);
      console.error(`    Expected: ${JSON.stringify(err.expected)}`);
    }
    throw err;
  }
}

function countAssert(condition, message) {
  totalAssertions++;
  assert.ok(condition, message);
}

function countStrictEqual(actual, expected, message) {
  totalAssertions++;
  assert.strictEqual(actual, expected, message);
}

function countDeepStrictEqual(actual, expected, message) {
  totalAssertions++;
  assert.deepStrictEqual(actual, expected, message);
}

// ---------------------------------------------------------------------------
// Helper Mock Factories
// ---------------------------------------------------------------------------
function mockFact(key, label, value, status, confidence) {
  return {
    key,
    label: label || key,
    category: 'Test',
    value,
    status,
    confidence,
    overrideHistory: []
  };
}

function mockChecklist(instanceKey, ruleId, scopeTargetId, applicability, status) {
  return {
    ruleId,
    semanticKey: ruleId,
    instanceKey,
    scopeTargetId,
    applicability,
    applicabilityReason: 'Test evaluation trace',
    status,
    detailerComment: '',
    updatedAt: new Date().toISOString(),
    factTraces: []
  };
}

// ===========================================================================
// Test Suite 1: Baseline Initial State (Fresh XML Ingestion)
// ===========================================================================
console.log('[Suite 1/8] Baseline Initial State (Fresh Ingestion)...');

runTest('1.1 Unconfirmed identity facts and blocked rules are detected', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM #', null, 'Unknown', 'RequiresConfirmation'),
    'unit.detailer': mockFact('unit.detailer', 'Detailer', null, 'Unknown', 'RequiresConfirmation'),
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', false, 'Derived', 'RequiresConfirmation'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'Skid 1 Weight', 4500, 'Derived', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:BASE_SEISMIC', 'BASE_SEISMIC', 'unit', 'NeedsInput', 'Incomplete'),
    mockChecklist('unit:GENERAL_01', 'GENERAL_01', 'unit', 'Applicable', 'Incomplete'),
    mockChecklist('skid-1:BASE_01', 'BASE_01', 'skid-1', 'Applicable', 'Incomplete'),
    mockChecklist('unit:KNOCKDOWN_01', 'KNOCKDOWN_01', 'unit', 'NotApplicable', 'NA')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 3, 'Expected 3 unconfirmed facts');
  countStrictEqual(readiness.blockedChecksCount, 1, 'Expected 1 blocked check');
  countStrictEqual(readiness.totalApplicableChecksCount, 2, 'Expected 2 applicable checks');
  countStrictEqual(readiness.completedChecksCount, 0, 'Expected 0 completed checks');
  countStrictEqual(readiness.incompleteChecksCount, 2, 'Expected 2 incomplete checks');
  countStrictEqual(readiness.isReadyForFinal, false, 'Should not be ready for final export');
  countStrictEqual(readiness.blockedRules.length, 1, 'blockedRules length mismatch');
  countStrictEqual(readiness.blockedRules[0].ruleId, 'BASE_SEISMIC', 'blockedRule ID mismatch');
  countStrictEqual(readiness.unconfirmedFacts.length, 3, 'unconfirmedFacts length mismatch');
});

runTest('1.2 Total check counts vs applicable checks partition', () => {
  const checklists = [
    mockChecklist('u:1', '1', 'unit', 'Applicable', 'Incomplete'),
    mockChecklist('u:2', '2', 'unit', 'NotApplicable', 'NA'),
    mockChecklist('u:3', '3', 'unit', 'NeedsInput', 'Incomplete'),
    mockChecklist('s1:1', 's1', 'skid-1', 'Applicable', 'Incomplete')
  ];
  const readiness = computeUnitReadiness({}, checklists);

  countStrictEqual(readiness.totalChecksCount, 4, 'Total checks count should be 4');
  countStrictEqual(readiness.totalApplicableChecksCount, 2, 'Applicable checks count should be 2');
  countStrictEqual(readiness.percentComplete, 0, 'Initial completion percentage should be 0');
});

// ===========================================================================
// Test Suite 2: Partial Fact Confirmation
// ===========================================================================
console.log('\n[Suite 2/8] Partial Fact Confirmation...');

runTest('2.1 Resolving identity facts decrements unconfirmed count while keeping blocked checks', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM #', 'COM-100452', 'Known', 'Authoritative'),
    'unit.detailer': mockFact('unit.detailer', 'Detailer', 'John Smith', 'Known', 'Authoritative'),
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', false, 'Derived', 'RequiresConfirmation')
  };

  const checklists = [
    mockChecklist('unit:BASE_SEISMIC', 'BASE_SEISMIC', 'unit', 'NeedsInput', 'Incomplete'),
    mockChecklist('unit:GENERAL_01', 'GENERAL_01', 'unit', 'Applicable', 'Incomplete')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 1, 'Only unit.isSeismic should remain unconfirmed');
  countStrictEqual(readiness.blockedChecksCount, 1, 'BASE_SEISMIC remains blocked');
  countStrictEqual(readiness.isReadyForFinal, false, 'Must remain not ready');
});

runTest('2.2 Resolving dependent fact unblocks rule and updates totalApplicableChecksCount', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', true, 'ManuallyOverridden', 'Authoritative')
  };

  // Rule transitions from NeedsInput to Applicable
  const checklists = [
    mockChecklist('unit:BASE_SEISMIC', 'BASE_SEISMIC', 'unit', 'Applicable', 'Incomplete'),
    mockChecklist('unit:GENERAL_01', 'GENERAL_01', 'unit', 'Applicable', 'Incomplete')
  ];

  const readiness = computeUnitReadiness(facts, checklists);
  countStrictEqual(readiness.unconfirmedFactsCount, 0, 'All facts confirmed');
  countStrictEqual(readiness.blockedChecksCount, 0, 'Zero blocked checks');
  countStrictEqual(readiness.totalApplicableChecksCount, 2, '2 applicable checks now active');
  countStrictEqual(readiness.incompleteChecksCount, 2, '2 incomplete checks');
});

// ===========================================================================
// Test Suite 3: Skid Weight Facts Confirmation (R1 Critical Regression Guard)
// ===========================================================================
console.log('\n[Suite 3/8] Skid Weight Facts Confirmation (R1 Critical Path)...');

runTest('3.1 Unconfirmed skid weights are NEVER ignored by readiness predicate', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM #', 'COM-100452', 'Known', 'Authoritative'),
    'unit.detailer': mockFact('unit.detailer', 'Detailer', 'John Smith', 'Known', 'Authoritative'),
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', false, 'Derived', 'Authoritative'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'Skid 1 Weight', null, 'Unknown', 'RequiresConfirmation'),
    'skid.skid-2.weight': mockFact('skid.skid-2.weight', 'Skid 2 Weight', 5200, 'Derived', 'Authoritative')
  };

  const checklists = [
    mockChecklist('skid-1:BASE_LIFTING_LUG', 'BASE_LIFTING_LUG', 'skid-1', 'NeedsInput', 'Incomplete'),
    mockChecklist('skid-2:BASE_LIFTING_LUG', 'BASE_LIFTING_LUG', 'skid-2', 'Applicable', 'Incomplete')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 1, 'Must report 1 unconfirmed skid weight');
  countStrictEqual(readiness.blockedChecksCount, 1, 'Must report 1 blocked lifting lug rule');
  countStrictEqual(readiness.isReadyForFinal, false, 'Must not be ready when skid weight is unconfirmed');
  countStrictEqual(readiness.unconfirmedFacts[0].key, 'skid.skid-1.weight', 'Expected unconfirmed fact to be skid-1 weight');
});

runTest('3.2 Manually overriding skid weight resolves unconfirmed state', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM #', 'COM-100452', 'Known', 'Authoritative'),
    'unit.detailer': mockFact('unit.detailer', 'Detailer', 'John Smith', 'Known', 'Authoritative'),
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', false, 'Derived', 'Authoritative'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'Skid 1 Weight', 4850, 'ManuallyOverridden', 'Authoritative'),
    'skid.skid-2.weight': mockFact('skid.skid-2.weight', 'Skid 2 Weight', 5200, 'Derived', 'Authoritative')
  };

  const checklists = [
    mockChecklist('skid-1:BASE_LIFTING_LUG', 'BASE_LIFTING_LUG', 'skid-1', 'Applicable', 'Incomplete'),
    mockChecklist('skid-2:BASE_LIFTING_LUG', 'BASE_LIFTING_LUG', 'skid-2', 'Applicable', 'Incomplete')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 0, 'Zero unconfirmed facts expected');
  countStrictEqual(readiness.blockedChecksCount, 0, 'Zero blocked checks expected');
  countStrictEqual(readiness.totalApplicableChecksCount, 2, '2 applicable checks');
  countStrictEqual(readiness.incompleteChecksCount, 2, '2 incomplete checks');
  countStrictEqual(readiness.isReadyForFinal, false, 'Not ready because checks are incomplete');
});

runTest('3.3 resolveFactForScope correctly maps generic skid facts to scoped keys', () => {
  const facts = {
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', false, 'Known', 'Authoritative'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'Skid 1 Weight', 4850, 'Known', 'Authoritative'),
    'skid.skid-2.weight': mockFact('skid.skid-2.weight', 'Skid 2 Weight', 5200, 'Known', 'Authoritative')
  };

  const res1 = resolveFactForScope(facts, 'skid.weight', 'skid-1');
  countStrictEqual(res1.resolvedKey, 'skid.skid-1.weight');
  countStrictEqual(res1.fact?.value, 4850);

  const res2 = resolveFactForScope(facts, 'skid.weight', 'skid-2');
  countStrictEqual(res2.resolvedKey, 'skid.skid-2.weight');
  countStrictEqual(res2.fact?.value, 5200);

  const resUnit = resolveFactForScope(facts, 'unit.isSeismic', 'unit');
  countStrictEqual(resUnit.resolvedKey, 'unit.isSeismic');
  countStrictEqual(resUnit.fact?.value, false);
});

// ===========================================================================
// Test Suite 4: All Facts Confirmed but Verification Checks Incomplete
// ===========================================================================
console.log('\n[Suite 4/8] All Facts Confirmed but Verification Checks Incomplete...');

runTest('4.1 Zero unconfirmed facts does not allow ready status when checks remain incomplete', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM #', 'COM-100452', 'Known', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:CHK_01', 'CHK_01', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_02', 'CHK_02', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_03', 'CHK_03', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_04', 'CHK_04', 'unit', 'Applicable', 'Incomplete'),
    mockChecklist('unit:CHK_05', 'CHK_05', 'unit', 'Applicable', 'Incomplete')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 0);
  countStrictEqual(readiness.blockedChecksCount, 0);
  countStrictEqual(readiness.totalApplicableChecksCount, 5);
  countStrictEqual(readiness.completedChecksCount, 3);
  countStrictEqual(readiness.incompleteChecksCount, 2);
  countStrictEqual(readiness.percentComplete, 60, '3/5 = 60%');
  countStrictEqual(readiness.isReadyForFinal, false, 'Must be false when 2 checks are incomplete');
});

runTest('4.2 Incomplete checks array preserves specific items', () => {
  const checklists = [
    mockChecklist('u:1', 'RULE_1', 'unit', 'Applicable', 'Passed'),
    mockChecklist('u:2', 'RULE_2', 'unit', 'Applicable', 'Incomplete')
  ];
  const readiness = computeUnitReadiness({}, checklists);
  countStrictEqual(readiness.incompleteRules.length, 1);
  countStrictEqual(readiness.incompleteRules[0].ruleId, 'RULE_2');
});

// ===========================================================================
// Test Suite 5: 100% Complete Ready-for-Export State
// ===========================================================================
console.log('\n[Suite 5/8] 100% Complete Ready-for-Export State...');

runTest('5.1 All facts authoritative and all applicable checks Passed/NA yields isReadyForFinal: true', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM #', 'COM-100452', 'Known', 'Authoritative'),
    'unit.detailer': mockFact('unit.detailer', 'Detailer', 'John Smith', 'Known', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:CHK_01', 'CHK_01', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_02', 'CHK_02', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_03', 'CHK_03', 'unit', 'Applicable', 'NA'),
    mockChecklist('unit:CHK_04', 'CHK_04', 'unit', 'NotApplicable', 'NA')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 0);
  countStrictEqual(readiness.blockedChecksCount, 0);
  countStrictEqual(readiness.totalApplicableChecksCount, 3);
  countStrictEqual(readiness.completedChecksCount, 3);
  countStrictEqual(readiness.naChecksCount, 1);
  countStrictEqual(readiness.incompleteChecksCount, 0);
  countStrictEqual(readiness.percentComplete, 100);
  countStrictEqual(readiness.isReadyForFinal, true, 'Must be true when all conditions satisfied');
});

runTest('5.2 NotApplicable checks do not skew denominator or completion percentage', () => {
  const checklists = [
    mockChecklist('u:1', '1', 'unit', 'Applicable', 'Passed'),
    mockChecklist('u:2', '2', 'unit', 'NotApplicable', 'NA'),
    mockChecklist('u:3', '3', 'unit', 'NotApplicable', 'NA')
  ];
  const readiness = computeUnitReadiness({}, checklists);
  countStrictEqual(readiness.totalApplicableChecksCount, 1);
  countStrictEqual(readiness.completedChecksCount, 1);
  countStrictEqual(readiness.percentComplete, 100);
  countStrictEqual(readiness.isReadyForFinal, true);
});

// ===========================================================================
// Test Suite 6: Flagged Checks Handling
// ===========================================================================
console.log('\n[Suite 6/8] Flagged Checks Quality Gate...');

runTest('6.1 Flagged check is treated as incomplete and blocks final export', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:CHK_01', 'CHK_01', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_02', 'CHK_02', 'unit', 'Applicable', 'Flagged')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.completedChecksCount, 1);
  countStrictEqual(readiness.incompleteChecksCount, 1);
  countStrictEqual(readiness.isReadyForFinal, false, 'Flagged item must prevent final readiness');
});

runTest('6.2 Transitioning Flagged item to Passed unblocks readiness', () => {
  const checklists = [
    mockChecklist('unit:CHK_01', 'CHK_01', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:CHK_02', 'CHK_02', 'unit', 'Applicable', 'Passed')
  ];
  const readiness = computeUnitReadiness({}, checklists);
  countStrictEqual(readiness.incompleteChecksCount, 0);
  countStrictEqual(readiness.isReadyForFinal, true);
});

// ===========================================================================
// Test Suite 7: Edge Cases & Boundary Permutations
// ===========================================================================
console.log('\n[Suite 7/8] Edge Cases & Boundary Permutations...');

runTest('7.1 Empty checklists array yields isReadyForFinal: false (Safe Zero Invariant)', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative')
  };
  const readiness = computeUnitReadiness(facts, []);

  countStrictEqual(readiness.totalApplicableChecksCount, 0);
  countStrictEqual(readiness.completedChecksCount, 0);
  countStrictEqual(readiness.incompleteChecksCount, 0);
  countStrictEqual(readiness.blockedChecksCount, 0);
  countStrictEqual(readiness.isReadyForFinal, false, 'Empty checklists cannot be ready for final export');
});

runTest('7.2 Empty facts object handles gracefully without errors', () => {
  const checklists = [
    mockChecklist('unit:CHK_01', 'CHK_01', 'unit', 'Applicable', 'Passed')
  ];
  const readiness = computeUnitReadiness({}, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 0);
  countStrictEqual(readiness.isReadyForFinal, true);
});

runTest('7.3 Fact Status & Confidence Matrix (8 Permutations)', () => {
  const matrix = [
    { status: 'Known', confidence: 'Authoritative', expectedUnconfirmed: false },
    { status: 'Derived', confidence: 'Authoritative', expectedUnconfirmed: false },
    { status: 'ManuallyOverridden', confidence: 'Authoritative', expectedUnconfirmed: false },
    { status: 'Known', confidence: 'RequiresConfirmation', expectedUnconfirmed: true },
    { status: 'Derived', confidence: 'RequiresConfirmation', expectedUnconfirmed: true },
    { status: 'Unknown', confidence: 'RequiresConfirmation', expectedUnconfirmed: true },
    { status: 'Unknown', confidence: 'Authoritative', expectedUnconfirmed: true },
    { status: 'ManuallyOverridden', confidence: 'RequiresConfirmation', expectedUnconfirmed: true }
  ];

  matrix.forEach(({ status, confidence, expectedUnconfirmed }, idx) => {
    const facts = {
      'test.key': mockFact('test.key', 'Test', 'val', status, confidence)
    };
    const readiness = computeUnitReadiness(facts, []);
    const isUnconfirmed = readiness.unconfirmedFactsCount === 1;
    countStrictEqual(
      isUnconfirmed,
      expectedUnconfirmed,
      `Matrix test ${idx + 1} (${status} + ${confidence}) failed. Expected unconfirmed: ${expectedUnconfirmed}, got: ${isUnconfirmed}`
    );
  });
});

runTest('7.4 Scoped readiness calculation for individual skids', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Hospital Tower', 'Known', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:U_01', 'U_01', 'unit', 'Applicable', 'Passed'),
    mockChecklist('skid-1:S1_01', 'S1_01', 'skid-1', 'Applicable', 'Passed'),
    mockChecklist('skid-1:S1_02', 'S1_02', 'skid-1', 'Applicable', 'Incomplete'),
    mockChecklist('skid-2:S2_01', 'S2_01', 'skid-2', 'Applicable', 'Passed'),
    mockChecklist('skid-2:S2_02', 'S2_02', 'skid-2', 'NeedsInput', 'Incomplete')
  ];

  const skid1Scope = computeScopeReadiness(facts, checklists, 'skid-1');
  countStrictEqual(skid1Scope.totalChecks, 2);
  countStrictEqual(skid1Scope.applicableChecks, 2);
  countStrictEqual(skid1Scope.passedChecks, 1);
  countStrictEqual(skid1Scope.incompleteChecks, 1);
  countStrictEqual(skid1Scope.percentComplete, 50);
  countStrictEqual(skid1Scope.isComplete, false);

  const skid2Scope = computeScopeReadiness(facts, checklists, 'skid-2');
  countStrictEqual(skid2Scope.blockedChecks, 1);
  countStrictEqual(skid2Scope.percentComplete, 100); // 1 passed of 1 applicable
  countStrictEqual(skid2Scope.isComplete, false); // blocked check prevents complete
});

runTest('7.5 Multi-Skid Complex Assembly Partitioning', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job', 'Tower', 'Known', 'Authoritative'),
    'unit.isSeismic': mockFact('unit.isSeismic', 'Seismic', false, 'Derived', 'RequiresConfirmation'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'S1 Weight', 3000, 'Derived', 'Authoritative'),
    'skid.skid-2.weight': mockFact('skid.skid-2.weight', 'S2 Weight', null, 'Unknown', 'RequiresConfirmation')
  };

  const checklists = [
    mockChecklist('unit:U1', 'U1', 'unit', 'NeedsInput', 'Incomplete'),
    mockChecklist('skid-1:S1', 'S1', 'skid-1', 'Applicable', 'Passed'),
    mockChecklist('skid-2:S2', 'S2', 'skid-2', 'NeedsInput', 'Incomplete')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  countStrictEqual(readiness.unconfirmedFactsCount, 2); // unit.isSeismic and skid.skid-2.weight
  countStrictEqual(readiness.blockedChecksCount, 2);    // unit:U1 and skid-2:S2
  countStrictEqual(readiness.totalApplicableChecksCount, 1);
  countStrictEqual(readiness.completedChecksCount, 1);
  countStrictEqual(readiness.isReadyForFinal, false);

  countStrictEqual(readiness.scopeReadinessMap['unit'].blockedChecksCount, 1);
  countStrictEqual(readiness.scopeReadinessMap['skid-1'].completedChecksCount, 1);
  countStrictEqual(readiness.scopeReadinessMap['skid-2'].blockedChecksCount, 1);
});

// ===========================================================================
// Test Suite 8: UI Consistency & Cross-Surface Parity Verification
// ===========================================================================
console.log('\n[Suite 8/8] Cross-Surface Parity Verification...');

runTest('8.1 Mathematical partition invariant holds across complex workload', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Test', 'Known', 'Authoritative'),
    'unit.comNumber': mockFact('unit.comNumber', 'COM', null, 'Unknown', 'RequiresConfirmation'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'Weight', 5000, 'Derived', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:01', '01', 'unit', 'Applicable', 'Passed'),
    mockChecklist('unit:02', '02', 'unit', 'Applicable', 'NA'),
    mockChecklist('unit:03', '03', 'unit', 'Applicable', 'Incomplete'),
    mockChecklist('unit:04', '04', 'unit', 'Applicable', 'Flagged'),
    mockChecklist('unit:05', '05', 'unit', 'NeedsInput', 'Incomplete'),
    mockChecklist('unit:06', '06', 'unit', 'NotApplicable', 'NA')
  ];

  const r = computeUnitReadiness(facts, checklists);

  // Partition Invariant: Total Applicable = Completed + Incomplete
  countStrictEqual(
    r.totalApplicableChecksCount,
    r.completedChecksCount + r.incompleteChecksCount,
    'Applicable checks partition invariant violated'
  );

  // Cross-Surface Header Invariant
  const headerPendingFacts = r.unconfirmedFactsCount;
  countStrictEqual(headerPendingFacts, 1);

  // Cross-Surface Sidebar Invariant
  const sidebarBlockedCount = r.blockedChecksCount;
  countStrictEqual(sidebarBlockedCount, 1);

  // Cross-Surface PreFlight Invariant
  countStrictEqual(r.isReadyForFinal, false);
});

runTest('8.2 Zero false success: never reports ready when blocked items exist', () => {
  const facts = {
    'unit.jobName': mockFact('unit.jobName', 'Job Name', 'Test', 'Known', 'Authoritative')
  };

  const checklists = [
    mockChecklist('unit:01', '01', 'unit', 'NeedsInput', 'Incomplete')
  ];

  const r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 0, 'No unconfirmed facts');
  countStrictEqual(r.blockedChecksCount, 1, '1 blocked rule');
  countStrictEqual(r.isReadyForFinal, false, 'Must NOT be ready when rule is blocked');
});

runTest('8.3 Synchronized counts across all surface predicates', () => {
  const facts = {
    'unit.com': mockFact('unit.com', 'COM', null, 'Unknown', 'RequiresConfirmation'),
    'unit.det': mockFact('unit.det', 'Det', 'Jane', 'Known', 'Authoritative'),
    'skid.skid-1.weight': mockFact('skid.skid-1.weight', 'Weight', null, 'Unknown', 'RequiresConfirmation')
  };

  const checklists = [
    mockChecklist('u:1', 'U1', 'unit', 'NeedsInput', 'Incomplete'),
    mockChecklist('s1:1', 'S1', 'skid-1', 'NeedsInput', 'Incomplete'),
    mockChecklist('s1:2', 'S2', 'skid-1', 'Applicable', 'Passed')
  ];

  const r = computeUnitReadiness(facts, checklists);

  // Header Pending Action Count (Facts + Blocked)
  const headerTotalAttention = r.unconfirmedFactsCount + r.blockedChecksCount;
  countStrictEqual(headerTotalAttention, 4, 'Header must show 4 total attention items (2 facts + 2 blocked checks)');

  // Sidebar Needs Input Count
  countStrictEqual(r.blockedChecksCount, 2, 'Sidebar must show 2 inputs needed');

  // Resolution Center items count
  const resolutionPendingFacts = r.unconfirmedFacts.length;
  const resolutionBlockedRules = r.blockedRules.length;
  countStrictEqual(resolutionPendingFacts, 2, 'Resolution Center must list 2 unconfirmed facts');
  countStrictEqual(resolutionBlockedRules, 2, 'Resolution Center must list 2 blocked checks');

  // PreFlight Modal Gating
  countStrictEqual(r.isReadyForFinal, false, 'Preflight must disable final export');
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('\n======================================================================');
console.log(` [SUCCESS] All ${passedTests} / ${totalTests} test suites passed cleanly with ${totalAssertions} assertions!`);
console.log('======================================================================\n');
