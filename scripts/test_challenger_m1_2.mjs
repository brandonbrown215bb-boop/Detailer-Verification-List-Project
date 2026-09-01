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

console.log('================================================================================');
console.log(' Challenger 2 - Empirical Adversarial Stress Test Suite: Milestone 1 (R1)');
console.log('================================================================================\n');

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

// Mock factory helpers
function createFact(key, value, status = 'Known', confidence = 'Authoritative', category = 'General') {
  return {
    key,
    label: key,
    category,
    value,
    status,
    confidence,
    overrideHistory: []
  };
}

function createChecklist(instanceKey, ruleId, scopeTargetId, applicability = 'Applicable', status = 'Incomplete') {
  return {
    ruleId,
    semanticKey: ruleId,
    instanceKey,
    scopeTargetId,
    applicability,
    applicabilityReason: 'Evaluated rule',
    status,
    detailerComment: '',
    updatedAt: new Date().toISOString(),
    factTraces: []
  };
}

// ===========================================================================
// Stress Suite 1: resolveFactForScope Multi-Skid & Malformed Keys
// ===========================================================================
console.log('[Stress Suite 1/6] Scoped Fact Resolution (resolveFactForScope)...');

runTest('1.1 Extreme multi-skid assembly (20 skids) fact resolution and scope isolation', () => {
  const facts = {};
  const numSkids = 20;
  
  // Populate 20 skids with unique weights, baserails, lifting lugs
  for (let i = 1; i <= numSkids; i++) {
    const skidId = `skid-${i}`;
    facts[`skid.${skidId}.weight`] = createFact(`skid.${skidId}.weight`, 2000 + i * 250, 'Derived', 'Authoritative', 'Weights');
    facts[`skid.${skidId}.baserail.type`] = createFact(`skid.${skidId}.baserail.type`, i % 2 === 0 ? 'StructuralSteel' : 'FormedChannel', 'Known', 'Authoritative', 'Baserails');
    facts[`skid.${skidId}.liftingLugs`] = createFact(`skid.${skidId}.liftingLugs`, i > 10, 'Derived', 'Authoritative', 'Baserails');
  }
  facts['unit.jobName'] = createFact('unit.jobName', 'Mega Hospital AHU-100', 'Known', 'Authoritative', 'Order & Identity');

  // Verify resolution for all 20 skids
  for (let i = 1; i <= numSkids; i++) {
    const skidId = `skid-${i}`;
    
    // Generic key 'skid.weight' resolving to scoped key
    const resWeight = resolveFactForScope(facts, 'skid.weight', skidId);
    countStrictEqual(resWeight.resolvedKey, `skid.${skidId}.weight`);
    countStrictEqual(resWeight.fact?.value, 2000 + i * 250);

    // Generic key 'skid.baserail.type'
    const resBase = resolveFactForScope(facts, 'skid.baserail.type', skidId);
    countStrictEqual(resBase.resolvedKey, `skid.${skidId}.baserail.type`);
    countStrictEqual(resBase.fact?.value, i % 2 === 0 ? 'StructuralSteel' : 'FormedChannel');

    // Unit-scoped fact requested with skid scope target should NOT get skid prefix
    const resUnit = resolveFactForScope(facts, 'unit.jobName', skidId);
    countStrictEqual(resUnit.resolvedKey, 'unit.jobName');
    countStrictEqual(resUnit.fact?.value, 'Mega Hospital AHU-100');
  }
});

runTest('1.2 Pre-scoped fact key fallback robustness', () => {
  const facts = {
    'skid.skid-3.weight': createFact('skid.skid-3.weight', 7500, 'Derived', 'Authoritative')
  };

  // If already passing pre-scoped key 'skid.skid-3.weight' with scopeTargetId 'skid-3'
  const res = resolveFactForScope(facts, 'skid.skid-3.weight', 'skid-3');
  countStrictEqual(res.resolvedKey, 'skid.skid-3.weight');
  countStrictEqual(res.fact?.value, 7500);
});

runTest('1.3 Adversarial and malformed input handling in resolveFactForScope', () => {
  const facts = {
    'skid.skid-1.weight': createFact('skid.skid-1.weight', 4200)
  };

  // Null / undefined facts record
  countStrictEqual(resolveFactForScope(null, 'skid.weight', 'skid-1').fact, undefined);
  countStrictEqual(resolveFactForScope(undefined, 'skid.weight', 'skid-1').fact, undefined);

  // Empty fact key
  countStrictEqual(resolveFactForScope(facts, '', 'skid-1').resolvedKey, '');
  countStrictEqual(resolveFactForScope(facts, '', 'skid-1').fact, undefined);

  // Empty / undefined / unit scopeTargetId
  countStrictEqual(resolveFactForScope(facts, 'skid.weight', '').resolvedKey, 'skid.weight');
  countStrictEqual(resolveFactForScope(facts, 'skid.weight', 'unit').resolvedKey, 'skid.weight');

  // Fact key starting with 'skid.' but not found in facts
  const missingRes = resolveFactForScope(facts, 'skid.missingParam', 'skid-1');
  countStrictEqual(missingRes.resolvedKey, 'skid.missingParam');
  countStrictEqual(missingRes.fact, undefined);

  // Irregular skid IDs (e.g., custom names with dashes, underscores, spaces)
  const customFacts = {
    'skid.skid_fan_section.weight': createFact('skid.skid_fan_section.weight', 9900)
  };
  const customRes = resolveFactForScope(customFacts, 'skid.weight', 'skid_fan_section');
  countStrictEqual(customRes.resolvedKey, 'skid.skid_fan_section.weight');
  countStrictEqual(customRes.fact?.value, 9900);
});

// ===========================================================================
// Stress Suite 2: Export Readiness Gating (isReadyForFinal) Boundary States
// ===========================================================================
console.log('\n[Stress Suite 2/6] Export Readiness Gating (isReadyForFinal) Boundaries...');

runTest('2.1 Boundary 1: Empty state (0 facts, 0 checklists)', () => {
  const r = computeUnitReadiness({}, []);
  countStrictEqual(r.totalChecksCount, 0);
  countStrictEqual(r.totalApplicableChecksCount, 0);
  countStrictEqual(r.completedChecksCount, 0);
  countStrictEqual(r.incompleteChecksCount, 0);
  countStrictEqual(r.blockedChecksCount, 0);
  countStrictEqual(r.unconfirmedFactsCount, 0);
  countStrictEqual(r.isReadyForFinal, false, 'Safe Zero: Empty project must NEVER be ready for final export');
});

runTest('2.2 Boundary 2: 100% NotApplicable checklists (0 Applicable rules)', () => {
  const facts = {
    'unit.jobName': createFact('unit.jobName', 'Job', 'Known', 'Authoritative')
  };
  const checklists = [
    createChecklist('u:1', 'R1', 'unit', 'NotApplicable', 'NA'),
    createChecklist('u:2', 'R2', 'unit', 'NotApplicable', 'NA'),
    createChecklist('s1:1', 'R3', 'skid-1', 'NotApplicable', 'NA')
  ];
  const r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.totalChecksCount, 3);
  countStrictEqual(r.totalApplicableChecksCount, 0);
  countStrictEqual(r.completedChecksCount, 0);
  countStrictEqual(r.isReadyForFinal, false, 'Project with 0 applicable checks must NOT be ready for final export');
});

runTest('2.3 Boundary 3: Fully verified with mix of Passed and NA checks', () => {
  const facts = {
    'unit.jobName': createFact('unit.jobName', 'Job', 'Known', 'Authoritative'),
    'unit.com': createFact('unit.com', 'COM-123456', 'Known', 'Authoritative')
  };
  const checklists = [
    createChecklist('u:1', 'R1', 'unit', 'Applicable', 'Passed'),
    createChecklist('u:2', 'R2', 'unit', 'Applicable', 'NA'),
    createChecklist('u:3', 'R3', 'unit', 'Applicable', 'Passed'),
    createChecklist('u:4', 'R4', 'unit', 'NotApplicable', 'NA')
  ];
  const r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.totalApplicableChecksCount, 3);
  countStrictEqual(r.completedChecksCount, 3);
  countStrictEqual(r.incompleteChecksCount, 0);
  countStrictEqual(r.blockedChecksCount, 0);
  countStrictEqual(r.unconfirmedFactsCount, 0);
  countStrictEqual(r.percentComplete, 100);
  countStrictEqual(r.isReadyForFinal, true, 'Fully verified project with NA applicable items must be ready');
});

runTest('2.4 Boundary 4: Exactly one check remaining Incomplete or Flagged', () => {
  const facts = {
    'unit.jobName': createFact('unit.jobName', 'Job', 'Known', 'Authoritative')
  };
  const checklists = [
    createChecklist('u:1', 'R1', 'unit', 'Applicable', 'Passed'),
    createChecklist('u:2', 'R2', 'unit', 'Applicable', 'Passed'),
    createChecklist('u:3', 'R3', 'unit', 'Applicable', 'Incomplete')
  ];
  const r1 = computeUnitReadiness(facts, checklists);
  countStrictEqual(r1.incompleteChecksCount, 1);
  countStrictEqual(r1.isReadyForFinal, false);

  // Flagged status
  checklists[2].status = 'Flagged';
  const r2 = computeUnitReadiness(facts, checklists);
  countStrictEqual(r2.incompleteChecksCount, 1);
  countStrictEqual(r2.isReadyForFinal, false, 'Flagged check must block final readiness');
});

runTest('2.5 Boundary 5: All checks Passed but single fact in RequiresConfirmation', () => {
  const facts = {
    'unit.jobName': createFact('unit.jobName', 'Job', 'Known', 'Authoritative'),
    'unit.isSeismic': createFact('unit.isSeismic', false, 'Derived', 'RequiresConfirmation')
  };
  const checklists = [
    createChecklist('u:1', 'R1', 'unit', 'Applicable', 'Passed'),
    createChecklist('u:2', 'R2', 'unit', 'Applicable', 'Passed')
  ];
  const r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 1);
  countStrictEqual(r.incompleteChecksCount, 0);
  countStrictEqual(r.isReadyForFinal, false, 'Unconfirmed fact MUST block final readiness even if all checks passed');
});

runTest('2.6 Boundary 6: All checks Passed but single fact in Unknown status', () => {
  const facts = {
    'unit.jobName': createFact('unit.jobName', 'Job', 'Known', 'Authoritative'),
    'unit.comNumber': createFact('unit.comNumber', null, 'Unknown', 'Authoritative')
  };
  const checklists = [
    createChecklist('u:1', 'R1', 'unit', 'Applicable', 'Passed')
  ];
  const r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 1);
  countStrictEqual(r.isReadyForFinal, false, 'Unknown status fact MUST block final readiness');
});

// ===========================================================================
// Stress Suite 3: ResolutionCenterModal Truthfulness & Invariants
// ===========================================================================
console.log('\n[Stress Suite 3/6] ResolutionCenterModal Invariants & Truthfulness...');

runTest('3.1 Truthfulness: isFullyResolved matches unconfirmedFactsCount === 0 && blockedChecksCount === 0', () => {
  // Test comprehensive state matrix
  const testCases = [
    { unconfirmed: 0, blocked: 0, incomplete: 0, expectedFullyResolved: true, expectedReady: true },
    { unconfirmed: 0, blocked: 0, incomplete: 5, expectedFullyResolved: true, expectedReady: false },
    { unconfirmed: 1, blocked: 0, incomplete: 0, expectedFullyResolved: false, expectedReady: false },
    { unconfirmed: 0, blocked: 2, incomplete: 0, expectedFullyResolved: false, expectedReady: false },
    { unconfirmed: 3, blocked: 4, incomplete: 2, expectedFullyResolved: false, expectedReady: false }
  ];

  testCases.forEach((tc, idx) => {
    const facts = {};
    for (let i = 0; i < tc.unconfirmed; i++) {
      facts[`fact.${i}`] = createFact(`fact.${i}`, null, 'Unknown', 'RequiresConfirmation');
    }
    const checklists = [];
    for (let i = 0; i < tc.blocked; i++) {
      checklists.push(createChecklist(`b:${i}`, `B${i}`, 'unit', 'NeedsInput', 'Incomplete'));
    }
    for (let i = 0; i < tc.incomplete; i++) {
      checklists.push(createChecklist(`inc:${i}`, `I${i}`, 'unit', 'Applicable', 'Incomplete'));
    }
    if (tc.incomplete === 0 && tc.blocked === 0 && tc.unconfirmed === 0) {
      checklists.push(createChecklist('p:1', 'P1', 'unit', 'Applicable', 'Passed'));
    }

    const r = computeUnitReadiness(facts, checklists);
    const isFullyResolved = r.unconfirmedFactsCount === 0 && r.blockedChecksCount === 0;

    countStrictEqual(isFullyResolved, tc.expectedFullyResolved, `Case ${idx + 1} isFullyResolved mismatch`);
    countStrictEqual(r.isReadyForFinal, tc.expectedReady, `Case ${idx + 1} isReadyForFinal mismatch`);
  });
});

runTest('3.2 All Fact categories (Identity, Baserails, Casing, Openings, Components, Ratings, Weights) captured', () => {
  const categories = [
    'Order & Identity',
    'Baserails',
    'Casing',
    'Openings',
    'Components',
    'Ratings & Compliance',
    'Weights',
    'Custom Engineering'
  ];

  categories.forEach((cat, idx) => {
    const facts = {
      [`fact.${idx}`]: createFact(`fact.${idx}`, null, 'Unknown', 'RequiresConfirmation', cat)
    };
    const r = computeUnitReadiness(facts, []);
    countStrictEqual(r.unconfirmedFactsCount, 1, `Fact in category ${cat} was not counted`);
    countStrictEqual(r.unconfirmedFacts[0].category, cat);
  });
});

runTest('3.3 Skid Weight Facts zero/null/negative handling', () => {
  // Test null weight
  const factsNull = { 'skid.skid-1.weight': createFact('skid.skid-1.weight', null, 'Unknown', 'RequiresConfirmation', 'Weights') };
  countStrictEqual(computeUnitReadiness(factsNull, []).unconfirmedFactsCount, 1);

  // Test 0 weight in Unknown status
  const factsZero = { 'skid.skid-1.weight': createFact('skid.skid-1.weight', 0, 'Unknown', 'RequiresConfirmation', 'Weights') };
  countStrictEqual(computeUnitReadiness(factsZero, []).unconfirmedFactsCount, 1);

  // Test positive weight confirmed
  const factsValid = { 'skid.skid-1.weight': createFact('skid.skid-1.weight', 4500, 'Derived', 'Authoritative', 'Weights') };
  countStrictEqual(computeUnitReadiness(factsValid, []).unconfirmedFactsCount, 0);
});

// ===========================================================================
// Stress Suite 4: Massive Scale Randomized Monte Carlo Partition Invariant
// ===========================================================================
console.log('\n[Stress Suite 4/6] Scale & Randomized Monte Carlo Testing (5,000 Iterations)...');

runTest('4.1 Monte Carlo 5,000 randomized state partitions preserve mathematical invariants', () => {
  const statuses = ['Incomplete', 'Passed', 'Flagged', 'NA'];
  const applicabilities = ['Applicable', 'NotApplicable', 'NeedsInput'];
  const factStatuses = ['Known', 'Derived', 'Unknown', 'ManuallyOverridden'];
  const confidences = ['Authoritative', 'RequiresConfirmation'];

  for (let iter = 0; iter < 5000; iter++) {
    const numSkids = Math.floor(Math.random() * 5) + 1;
    const numFacts = Math.floor(Math.random() * 20);
    const numChecks = Math.floor(Math.random() * 50);

    const facts = {};
    let manualUnconfirmedFacts = 0;
    for (let f = 0; f < numFacts; f++) {
      const status = factStatuses[Math.floor(Math.random() * factStatuses.length)];
      const conf = confidences[Math.floor(Math.random() * confidences.length)];
      const key = `fact_${f}`;
      facts[key] = createFact(key, f, status, conf);
      if (status === 'Unknown' || conf === 'RequiresConfirmation') {
        manualUnconfirmedFacts++;
      }
    }

    const checklists = [];
    let manualApplicable = 0;
    let manualCompleted = 0;
    let manualIncomplete = 0;
    let manualBlocked = 0;

    for (let c = 0; c < numChecks; c++) {
      const app = applicabilities[Math.floor(Math.random() * applicabilities.length)];
      const st = statuses[Math.floor(Math.random() * statuses.length)];
      const scope = Math.random() > 0.3 ? `skid-${Math.floor(Math.random() * numSkids) + 1}` : 'unit';
      const item = createChecklist(`inst_${c}`, `RULE_${c}`, scope, app, st);
      checklists.push(item);

      if (app === 'NeedsInput') {
        manualBlocked++;
      } else if (app === 'Applicable') {
        manualApplicable++;
        if (st === 'Passed' || st === 'NA') {
          manualCompleted++;
        } else {
          manualIncomplete++;
        }
      }
    }

    const r = computeUnitReadiness(facts, checklists);

    // Invariant 1: Unconfirmed facts exact count
    countStrictEqual(r.unconfirmedFactsCount, manualUnconfirmedFacts, `Iteration ${iter}: unconfirmed count mismatch`);

    // Invariant 2: Blocked checks exact count
    countStrictEqual(r.blockedChecksCount, manualBlocked, `Iteration ${iter}: blocked count mismatch`);

    // Invariant 3: Total Applicable = Completed + Incomplete
    countStrictEqual(r.totalApplicableChecksCount, manualApplicable, `Iteration ${iter}: applicable count mismatch`);
    countStrictEqual(r.completedChecksCount, manualCompleted, `Iteration ${iter}: completed count mismatch`);
    countStrictEqual(r.incompleteChecksCount, manualIncomplete, `Iteration ${iter}: incomplete count mismatch`);
    countStrictEqual(r.totalApplicableChecksCount, r.completedChecksCount + r.incompleteChecksCount, `Iteration ${iter}: partition sum failed`);

    // Invariant 4: isReadyForFinal strict truth
    const expectedReady = manualApplicable > 0 &&
      manualUnconfirmedFacts === 0 &&
      manualBlocked === 0 &&
      manualIncomplete === 0;
    countStrictEqual(r.isReadyForFinal, expectedReady, `Iteration ${iter}: isReadyForFinal truth violated`);
  }
});

// ===========================================================================
// Stress Suite 5: Cross-Surface Synchronization Integrity
// ===========================================================================
console.log('\n[Stress Suite 5/6] Cross-Surface Synchronization Integrity...');

runTest('5.1 Header, Sidebar, Resolution Center, and PreFlight derive identical counts', () => {
  const facts = {
    'unit.jobName': createFact('unit.jobName', 'Tower 1', 'Known', 'Authoritative'),
    'unit.comNumber': createFact('unit.comNumber', null, 'Unknown', 'RequiresConfirmation'),
    'skid.skid-1.weight': createFact('skid.skid-1.weight', null, 'Unknown', 'RequiresConfirmation'),
    'skid.skid-2.weight': createFact('skid.skid-2.weight', 6000, 'Derived', 'Authoritative')
  };

  const checklists = [
    createChecklist('u:1', 'R1', 'unit', 'NeedsInput', 'Incomplete'),
    createChecklist('s1:1', 'R2', 'skid-1', 'NeedsInput', 'Incomplete'),
    createChecklist('s1:2', 'R3', 'skid-1', 'Applicable', 'Incomplete'),
    createChecklist('s2:1', 'R4', 'skid-2', 'Applicable', 'Passed')
  ];

  const readiness = computeUnitReadiness(facts, checklists);

  // 1. Header Surface
  const headerTotalAttention = readiness.unconfirmedFactsCount + readiness.blockedChecksCount;
  countStrictEqual(headerTotalAttention, 4, 'Header total pending badge must equal 4');

  // 2. Sidebar Surface
  const sidebarTotalBlocked = readiness.blockedChecksCount;
  countStrictEqual(sidebarTotalBlocked, 2, 'Sidebar blocked input count must equal 2');
  const sidebarUnitScope = readiness.scopeReadinessMap['unit'];
  countStrictEqual(sidebarUnitScope.blockedChecksCount, 1, 'Sidebar unit scope blocked count must equal 1');
  const sidebarSkid1Scope = readiness.scopeReadinessMap['skid-1'];
  countStrictEqual(sidebarSkid1Scope.blockedChecksCount, 1, 'Sidebar skid-1 scope blocked count must equal 1');
  const sidebarSkid2Scope = readiness.scopeReadinessMap['skid-2'];
  countStrictEqual(sidebarSkid2Scope.completedChecksCount, 1, 'Sidebar skid-2 completed count must equal 1');

  // 3. Resolution Center Surface
  countStrictEqual(readiness.unconfirmedFacts.length, 2, 'Resolution Center unconfirmed facts list length must equal 2');
  countStrictEqual(readiness.blockedRules.length, 2, 'Resolution Center blocked rules list length must equal 2');
  const isResolutionCenterClean = readiness.unconfirmedFactsCount === 0 && readiness.blockedChecksCount === 0;
  countStrictEqual(isResolutionCenterClean, false, 'Resolution center must NOT report clean');

  // 4. PreFlight Modal Surface
  countStrictEqual(readiness.totalApplicableChecksCount, 2, 'PreFlight applicable checks must equal 2');
  countStrictEqual(readiness.completedChecksCount, 1, 'PreFlight completed checks must equal 1');
  countStrictEqual(readiness.incompleteChecksCount, 1, 'PreFlight pending checks must equal 1');
  countStrictEqual(readiness.isReadyForFinal, false, 'PreFlight isReadyForFinal must be false');
});

// ===========================================================================
// Stress Suite 6: State Transitions & Re-evaluation Lifecycle
// ===========================================================================
console.log('\n[Stress Suite 6/6] State Transitions & Re-evaluation Lifecycle...');

runTest('6.1 Stepwise Resolution Workflow from 0% to 100% Ready', () => {
  // Step 0: Ingestion
  let facts = {
    'unit.jobName': createFact('unit.jobName', 'Job', 'Known', 'Authoritative'),
    'unit.com': createFact('unit.com', null, 'Unknown', 'RequiresConfirmation'),
    'unit.isSeismic': createFact('unit.isSeismic', false, 'Derived', 'RequiresConfirmation'),
    'skid.skid-1.weight': createFact('skid.skid-1.weight', null, 'Unknown', 'RequiresConfirmation')
  };

  let checklists = [
    createChecklist('u:1', 'BASE_SEISMIC', 'unit', 'NeedsInput', 'Incomplete'),
    createChecklist('s1:1', 'BASE_01_WEIGHT', 'skid-1', 'NeedsInput', 'Incomplete'),
    createChecklist('s1:2', 'ROOF_01', 'skid-1', 'Applicable', 'Incomplete')
  ];

  let r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 3);
  countStrictEqual(r.blockedChecksCount, 2);
  countStrictEqual(r.totalApplicableChecksCount, 1);
  countStrictEqual(r.completedChecksCount, 0);
  countStrictEqual(r.isReadyForFinal, false);

  // Step 1: Resolve COM#
  facts = { ...facts, 'unit.com': createFact('unit.com', 'COM-999', 'Known', 'Authoritative') };
  r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 2);
  countStrictEqual(r.blockedChecksCount, 2);
  countStrictEqual(r.isReadyForFinal, false);

  // Step 2: Batch Resolve Defaults (Seismic -> False) -> Unblocks BASE_SEISMIC
  facts = { ...facts, 'unit.isSeismic': createFact('unit.isSeismic', false, 'ManuallyOverridden', 'Authoritative') };
  checklists = [
    createChecklist('u:1', 'BASE_SEISMIC', 'unit', 'Applicable', 'Incomplete'), // unblocked
    checklists[1],
    checklists[2]
  ];
  r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 1); // only skid weight remains
  countStrictEqual(r.blockedChecksCount, 1);    // only BASE_01_WEIGHT remains blocked
  countStrictEqual(r.totalApplicableChecksCount, 2);
  countStrictEqual(r.isReadyForFinal, false);

  // Step 3: Detailer confirms skid weight -> Unblocks BASE_01_WEIGHT
  facts = { ...facts, 'skid.skid-1.weight': createFact('skid.skid-1.weight', 5400, 'ManuallyOverridden', 'Authoritative') };
  checklists = [
    checklists[0],
    createChecklist('s1:1', 'BASE_01_WEIGHT', 'skid-1', 'Applicable', 'Incomplete'), // unblocked
    checklists[2]
  ];
  r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.unconfirmedFactsCount, 0, 'All facts confirmed');
  countStrictEqual(r.blockedChecksCount, 0, 'All rules unblocked');
  countStrictEqual(r.totalApplicableChecksCount, 3);
  countStrictEqual(r.incompleteChecksCount, 3);
  countStrictEqual(r.isReadyForFinal, false, 'Not ready because checks are still Incomplete');

  // Step 4: Detailer checks off 2 of 3 rules
  checklists = [
    createChecklist('u:1', 'BASE_SEISMIC', 'unit', 'Applicable', 'Passed'),
    createChecklist('s1:1', 'BASE_01_WEIGHT', 'skid-1', 'Applicable', 'Passed'),
    checklists[2]
  ];
  r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.completedChecksCount, 2);
  countStrictEqual(r.incompleteChecksCount, 1);
  countStrictEqual(r.percentComplete, 67);
  countStrictEqual(r.isReadyForFinal, false);

  // Step 5: Detailer marks last rule NA
  checklists = [
    checklists[0],
    checklists[1],
    createChecklist('s1:2', 'ROOF_01', 'skid-1', 'Applicable', 'NA')
  ];
  r = computeUnitReadiness(facts, checklists);
  countStrictEqual(r.completedChecksCount, 3);
  countStrictEqual(r.incompleteChecksCount, 0);
  countStrictEqual(r.percentComplete, 100);
  countStrictEqual(r.isReadyForFinal, true, 'Now fully ready for official final export!');
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('\n================================================================================');
console.log(` [CHALLENGER SUCCESS] All ${passedTests} / ${totalTests} test suites passed cleanly with ${totalAssertions} assertions!`);
console.log('================================================================================\n');
