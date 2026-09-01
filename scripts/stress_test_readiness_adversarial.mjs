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
console.log(' Adversarial Stress Harness - Empirical Readiness Verification');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function runStressTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failures.push({ name, error: err.message, stack: err.stack });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFact(key, value, status = 'Known', confidence = 'Authoritative') {
  return {
    key,
    label: `Fact ${key}`,
    category: 'Test',
    value,
    status,
    confidence,
    overrideHistory: []
  };
}

function makeCheck(instanceKey, ruleId, scopeTargetId, applicability = 'Applicable', status = 'Incomplete') {
  return {
    ruleId,
    semanticKey: ruleId,
    instanceKey,
    scopeTargetId,
    applicability,
    applicabilityReason: 'Stress test check',
    status,
    detailerComment: '',
    updatedAt: new Date().toISOString(),
    factTraces: []
  };
}

// ===========================================================================
// SECTION 1: Massive Scale Stress Test (150 Skids, 15,000 Checks, 5,000 Facts)
// ===========================================================================
console.log('\n--- Section 1: Massive Scale & Performance Stress ---');

runStressTest('1.1 150 skids, 15,000 checks, 3,000 facts performance and partitioning', () => {
  const skidCount = 150;
  const checksPerSkid = 100;
  const facts = {};
  const checklists = [];

  // Facts: 20 unconfirmed out of 3000
  for (let s = 1; s <= skidCount; s++) {
    const skidId = `skid-${s}`;
    facts[`skid.${skidId}.weight`] = makeFact(`skid.${skidId}.weight`, 3000 + s, s <= 10 ? 'Unknown' : 'Derived', s <= 10 ? 'RequiresConfirmation' : 'Authoritative');
    facts[`skid.${skidId}.lipHeight`] = makeFact(`skid.${skidId}.lipHeight`, 2.0, s > 140 ? 'Derived' : 'Known', s > 140 ? 'RequiresConfirmation' : 'Authoritative');
  }

  // Checklists: mix of Applicable Passed, Applicable Incomplete, NeedsInput, NotApplicable
  for (let s = 1; s <= skidCount; s++) {
    const skidId = `skid-${s}`;
    for (let c = 1; c <= checksPerSkid; c++) {
      let applicability = 'Applicable';
      let status = 'Passed';
      if (c % 10 === 0) applicability = 'NeedsInput';
      else if (c % 7 === 0) applicability = 'NotApplicable';
      else if (c % 5 === 0) status = 'Incomplete';
      else if (c % 3 === 0) status = 'NA';

      checklists.push(makeCheck(`${skidId}:R_${c}`, `R_${c}`, skidId, applicability, status));
    }
  }

  const start = performance.now();
  const readiness = computeUnitReadiness(facts, checklists);
  const duration = performance.now() - start;

  console.log(`      Computed 15,000 checks across 150 skids in ${duration.toFixed(2)}ms`);

  assert.ok(duration < 500, `Execution took ${duration}ms which exceeds 500ms threshold`);
  assert.strictEqual(readiness.unconfirmedFactsCount, 20, 'Unconfirmed facts count mismatch');
  assert.strictEqual(Object.keys(readiness.scopeReadinessMap).length, skidCount, 'Scope map skid count mismatch');
  assert.strictEqual(readiness.isReadyForFinal, false, 'Should NOT be ready when unconfirmed/blocked items exist');

  // Verify scope partition sum equals global total checks count
  let sumTotal = 0;
  let sumApplicable = 0;
  let sumCompleted = 0;
  let sumBlocked = 0;

  for (let s = 1; s <= skidCount; s++) {
    const scope = readiness.scopeReadinessMap[`skid-${s}`];
    sumTotal += scope.totalChecksCount;
    sumApplicable += scope.totalApplicableChecksCount;
    sumCompleted += scope.completedChecksCount;
    sumBlocked += scope.blockedChecksCount;
  }

  assert.strictEqual(sumTotal, readiness.totalChecksCount);
  assert.strictEqual(sumApplicable, readiness.totalApplicableChecksCount);
  assert.strictEqual(sumCompleted, readiness.completedChecksCount);
  assert.strictEqual(sumBlocked, readiness.blockedChecksCount);
});

// ===========================================================================
// SECTION 2: Prototype Pollution & Strange Fact Keys
// ===========================================================================
console.log('\n--- Section 2: Exotic Fact Key Naming & Object Security ---');

runStressTest('2.1 Prototype pollution keys and JS reserved property names in facts dict', () => {
  const facts = {
    ['__proto__']: makeFact('__proto__', 'malicious', 'Unknown', 'RequiresConfirmation'),
    'constructor': makeFact('constructor', 'builder', 'Known', 'Authoritative'),
    'toString': makeFact('toString', 'fn', 'Derived', 'Authoritative'),
    'valueOf': makeFact('valueOf', 'fn', 'Unknown', 'RequiresConfirmation'),
    'hasOwnProperty': makeFact('hasOwnProperty', 'fn', 'Known', 'Authoritative')
  };

  const checklists = [
    makeCheck('unit:R1', 'R1', 'unit', 'Applicable', 'Passed')
  ];

  const readiness = computeUnitReadiness(facts, checklists);
  // Unconfirmed: __proto__ and valueOf
  assert.strictEqual(readiness.unconfirmedFactsCount, 2);
  assert.strictEqual(readiness.isReadyForFinal, false);
});

runStressTest('2.2 Unicode, emojis, newlines, null characters, dots in fact keys', () => {
  const weirdKeys = [
    'skid.skid 1.weight',
    'skid.skid_🚀.weight',
    'skid.skid-1.sub.prop.deep.nested',
    'unit.casing.material.\n.type',
    'unit.casing.material.\t.gauge',
    'unit.empty..key',
    'skid..weight'
  ];

  const facts = {};
  weirdKeys.forEach((k, i) => {
    facts[k] = makeFact(k, `val_${i}`, i % 2 === 0 ? 'Unknown' : 'Known', i % 2 === 0 ? 'RequiresConfirmation' : 'Authoritative');
  });

  const readiness = computeUnitReadiness(facts, [makeCheck('u:1', '1', 'unit', 'Applicable', 'Passed')]);
  assert.strictEqual(readiness.unconfirmedFactsCount, 4); // indices 0, 2, 4, 6
});

runStressTest('2.3 resolveFactForScope with malformed or edge case scopeTargetIds and factKeys', () => {
  const facts = {
    'skid.skid-1.weight': makeFact('skid.skid-1.weight', 5000),
    'skid.skid 2.weight': makeFact('skid.skid 2.weight', 6000),
    'skid.weight': makeFact('skid.weight', 1000),
    'skid..weight': makeFact('skid..weight', 2000),
    'skid.skid-3.': makeFact('skid.skid-3.', 3000)
  };

  // Normal scoped resolution
  assert.strictEqual(resolveFactForScope(facts, 'skid.weight', 'skid-1').resolvedKey, 'skid.skid-1.weight');
  assert.strictEqual(resolveFactForScope(facts, 'skid.weight', 'skid 2').resolvedKey, 'skid.skid 2.weight');

  // Fallback when scoped key doesn't exist
  assert.strictEqual(resolveFactForScope(facts, 'skid.weight', 'skid-999').resolvedKey, 'skid.weight');
  assert.strictEqual(resolveFactForScope(facts, 'skid.weight', 'skid-999').fact?.value, 1000);

  // unit scope target should NOT prefix
  assert.strictEqual(resolveFactForScope(facts, 'skid.weight', 'unit').resolvedKey, 'skid.weight');

  // Empty string or null inputs
  assert.strictEqual(resolveFactForScope(null, 'skid.weight', 'skid-1').resolvedKey, 'skid.weight');
  assert.strictEqual(resolveFactForScope(facts, '', 'skid-1').resolvedKey, '');
  assert.strictEqual(resolveFactForScope(facts, null, 'skid-1').resolvedKey, '');
  assert.strictEqual(resolveFactForScope(facts, 'skid.weight', '').resolvedKey, 'skid.weight');
});

// ===========================================================================
// SECTION 3: Adversarial Status & Applicability Permutations
// ===========================================================================
console.log('\n--- Section 3: Status & Applicability Permutation Matrices ---');

runStressTest('3.1 All status values on Applicable checks', () => {
  const checks = [
    makeCheck('u:1', '1', 'unit', 'Applicable', 'Passed'),
    makeCheck('u:2', '2', 'unit', 'Applicable', 'NA'),
    makeCheck('u:3', '3', 'unit', 'Applicable', 'Incomplete'),
    makeCheck('u:4', '4', 'unit', 'Applicable', 'Flagged'),
    makeCheck('u:5', '5', 'unit', 'Applicable', 'Unknown' /* anomalous status */),
    makeCheck('u:6', '6', 'unit', 'Applicable', null /* anomalous status */),
    makeCheck('u:7', '7', 'unit', 'Applicable', undefined /* anomalous status */)
  ];

  const r = computeUnitReadiness({}, checks);

  assert.strictEqual(r.totalApplicableChecksCount, 7);
  assert.strictEqual(r.completedChecksCount, 2, 'Only Passed and NA should count as completed');
  assert.strictEqual(r.incompleteChecksCount, 5, 'Incomplete, Flagged, and anomalous statuses should be incomplete');
  assert.strictEqual(r.isReadyForFinal, false);
});

runStressTest('3.2 All applicability values with Passed status', () => {
  const checks = [
    makeCheck('u:1', '1', 'unit', 'Applicable', 'Passed'),
    makeCheck('u:2', '2', 'unit', 'NotApplicable', 'Passed'), // NA rule with Passed status (e.g. legacy or glitch)
    makeCheck('u:3', '3', 'unit', 'NeedsInput', 'Passed')    // NeedsInput rule marked Passed
  ];

  const r = computeUnitReadiness({}, checks);

  assert.strictEqual(r.totalApplicableChecksCount, 1, 'Only Applicable items count towards totalApplicable');
  assert.strictEqual(r.completedChecksCount, 1, 'Only Applicable Passed/NA count as completed');
  assert.strictEqual(r.blockedChecksCount, 1, 'NeedsInput is strictly blocked');
  assert.strictEqual(r.isReadyForFinal, false, 'NeedsInput MUST prevent final readiness regardless of status');
});

runStressTest('3.3 100% NA applicable checks with zero unconfirmed facts', () => {
  const checks = [
    makeCheck('u:1', '1', 'unit', 'Applicable', 'NA'),
    makeCheck('u:2', '2', 'unit', 'Applicable', 'NA'),
    makeCheck('u:3', '3', 'unit', 'Applicable', 'NA')
  ];

  const r = computeUnitReadiness({}, checks);

  assert.strictEqual(r.totalApplicableChecksCount, 3);
  assert.strictEqual(r.completedChecksCount, 3);
  assert.strictEqual(r.naChecksCount, 3);
  assert.strictEqual(r.incompleteChecksCount, 0);
  assert.strictEqual(r.percentComplete, 100);
  assert.strictEqual(r.isReadyForFinal, true, 'All applicable checks resolved via NA is valid final state');
});

runStressTest('3.4 Zero applicable checks (all NotApplicable) with zero unconfirmed facts', () => {
  const checks = [
    makeCheck('u:1', '1', 'unit', 'NotApplicable', 'NA'),
    makeCheck('u:2', '2', 'unit', 'NotApplicable', 'NA')
  ];

  const r = computeUnitReadiness({}, checks);

  assert.strictEqual(r.totalApplicableChecksCount, 0);
  assert.strictEqual(r.completedChecksCount, 0);
  assert.strictEqual(r.percentComplete, 0);
  assert.strictEqual(r.isReadyForFinal, false, 'Zero applicable checks cannot produce ready state (Safe Zero Invariant)');
});

// ===========================================================================
// SECTION 4: Circular & High-Dependency Fact Graph Simulation
// ===========================================================================
console.log('\n--- Section 4: Circular & Entangled Dependencies Simulation ---');

runStressTest('4.1 Inter-dependent fact chains where resolution unblocks cascades', () => {
  // Fact A requires Fact B, which requires Fact C
  const facts = {
    'unit.fanType': makeFact('unit.fanType', 'DirectDrive', 'Known', 'Authoritative'),
    'unit.fanCount': makeFact('unit.fanCount', 4, 'Derived', 'RequiresConfirmation'), // unconfirmed
    'unit.motorHp': makeFact('unit.motorHp', null, 'Unknown', 'RequiresConfirmation') // unconfirmed
  };

  const checklists = [
    makeCheck('unit:FAN_ARRAY_01', 'FAN_ARRAY_01', 'unit', 'NeedsInput', 'Incomplete'),
    makeCheck('unit:FAN_VIBE_01', 'FAN_VIBE_01', 'unit', 'NeedsInput', 'Incomplete'),
    makeCheck('unit:FAN_WIRING_01', 'FAN_WIRING_01', 'unit', 'Applicable', 'Incomplete')
  ];

  let r = computeUnitReadiness(facts, checklists);
  assert.strictEqual(r.unconfirmedFactsCount, 2);
  assert.strictEqual(r.blockedChecksCount, 2);
  assert.strictEqual(r.isReadyForFinal, false);

  // Resolve fanCount
  facts['unit.fanCount'].confidence = 'Authoritative';
  r = computeUnitReadiness(facts, checklists);
  assert.strictEqual(r.unconfirmedFactsCount, 1);
  assert.strictEqual(r.blockedChecksCount, 2); // still blocked by motorHp

  // Resolve motorHp and unblock one checklist item
  facts['unit.motorHp'] = makeFact('unit.motorHp', 15, 'ManuallyOverridden', 'Authoritative');
  checklists[0].applicability = 'Applicable';
  checklists[0].status = 'Passed';

  r = computeUnitReadiness(facts, checklists);
  assert.strictEqual(r.unconfirmedFactsCount, 0);
  assert.strictEqual(r.blockedChecksCount, 1); // 1 still blocked
  assert.strictEqual(r.isReadyForFinal, false);

  // Unblock remaining and pass all
  checklists[1].applicability = 'Applicable';
  checklists[1].status = 'Passed';
  checklists[2].status = 'Passed';

  r = computeUnitReadiness(facts, checklists);
  assert.strictEqual(r.unconfirmedFactsCount, 0);
  assert.strictEqual(r.blockedChecksCount, 0);
  assert.strictEqual(r.incompleteChecksCount, 0);
  assert.strictEqual(r.isReadyForFinal, true);
});

// ===========================================================================
// SECTION 5: Overloaded Calling Signatures & Scope Map Invariants
// ===========================================================================
console.log('\n--- Section 5: computeScopeReadiness Signature & Scope Map Invariants ---');

runStressTest('5.1 computeScopeReadiness overloaded signatures match identically', () => {
  const facts = {
    'unit.jobName': makeFact('unit.jobName', 'Tower', 'Known', 'Authoritative')
  };
  const checklists = [
    makeCheck('skid-1:R1', 'R1', 'skid-1', 'Applicable', 'Passed'),
    makeCheck('skid-1:R2', 'R2', 'skid-1', 'Applicable', 'NA'),
    makeCheck('skid-1:R3', 'R3', 'skid-1', 'NeedsInput', 'Incomplete')
  ];

  // 3-arg signature: computeScopeReadiness(facts, checklists, 'skid-1')
  const res3 = computeScopeReadiness(facts, checklists, 'skid-1');

  // 2-arg signature: computeScopeReadiness(checklists, 'skid-1')
  const res2 = computeScopeReadiness(checklists, 'skid-1');

  assert.strictEqual(res3.totalChecks, res2.totalChecks);
  assert.strictEqual(res3.applicableChecks, res2.applicableChecks);
  assert.strictEqual(res3.completedChecksCount, res2.completedChecksCount);
  assert.strictEqual(res3.blockedChecksCount, res2.blockedChecksCount);
  assert.strictEqual(res3.percentComplete, res2.percentComplete);
  assert.strictEqual(res3.isComplete, res2.isComplete);
});

runStressTest('5.2 Scope with 0 applicable checks returns percentComplete: 0 and isComplete: false', () => {
  const checklists = [
    makeCheck('skid-1:R1', 'R1', 'skid-1', 'NotApplicable', 'NA')
  ];
  const res = computeScopeReadiness(checklists, 'skid-1');
  assert.strictEqual(res.totalChecks, 1);
  assert.strictEqual(res.applicableChecks, 0);
  assert.strictEqual(res.percentComplete, 0);
  assert.strictEqual(res.isComplete, false, 'Scope with 0 applicable checks must not be complete');
});

runStressTest('5.3 Scope with all Passed applicable checks returns percentComplete: 100 and isComplete: true', () => {
  const checklists = [
    makeCheck('skid-1:R1', 'R1', 'skid-1', 'Applicable', 'Passed'),
    makeCheck('skid-1:R2', 'R2', 'skid-1', 'Applicable', 'NA')
  ];
  const res = computeScopeReadiness(checklists, 'skid-1');
  assert.strictEqual(res.percentComplete, 100);
  assert.strictEqual(res.isComplete, true);
});

// ===========================================================================
// SECTION 6: UI Counter Synchronization & Divergence Audit
// ===========================================================================
console.log('\n--- Section 6: UI Cross-Surface Counter Audit ---');

runStressTest('6.1 Header Attention Count matches unconfirmedFactsCount + blockedChecksCount', () => {
  const facts = {
    'f1': makeFact('f1', '1', 'Unknown', 'RequiresConfirmation'),
    'f2': makeFact('f2', '2', 'Derived', 'RequiresConfirmation'),
    'f3': makeFact('f3', '3', 'Known', 'Authoritative')
  };
  const checklists = [
    makeCheck('u:1', '1', 'unit', 'NeedsInput', 'Incomplete'),
    makeCheck('u:2', '2', 'unit', 'NeedsInput', 'Incomplete'),
    makeCheck('u:3', '3', 'unit', 'Applicable', 'Passed')
  ];

  const r = computeUnitReadiness(facts, checklists);
  const headerTotalPending = r.unconfirmedFactsCount + r.blockedChecksCount;

  assert.strictEqual(headerTotalPending, 4);
  assert.strictEqual(r.unconfirmedFacts.length, 2);
  assert.strictEqual(r.blockedRules.length, 2);
});

runStressTest('6.2 Null and undefined arguments in computeUnitReadiness do not throw', () => {
  const rNull = computeUnitReadiness(null, null);
  assert.strictEqual(rNull.unconfirmedFactsCount, 0);
  assert.strictEqual(rNull.totalApplicableChecksCount, 0);
  assert.strictEqual(rNull.isReadyForFinal, false);

  const rUndef = computeUnitReadiness(undefined, undefined);
  assert.strictEqual(rUndef.unconfirmedFactsCount, 0);
  assert.strictEqual(rUndef.totalApplicableChecksCount, 0);
  assert.strictEqual(rUndef.isReadyForFinal, false);
});

runStressTest('6.3 Single NA applicable check: Scope completed count is 1 (100%), passed is 0', () => {
  const checklists = [
    makeCheck('skid-1:R1', 'R1', 'skid-1', 'Applicable', 'NA')
  ];
  const res = computeScopeReadiness(checklists, 'skid-1');
  assert.strictEqual(res.applicableChecks, 1);
  assert.strictEqual(res.passedChecks, 0);
  assert.strictEqual(res.completedChecksCount, 1);
  assert.strictEqual(res.percentComplete, 100);
  assert.strictEqual(res.isComplete, true);
});

console.log('\n======================================================================');
console.log(` Summary: ${passedTests} / ${totalTests} passed, ${failedTests} failed.`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
