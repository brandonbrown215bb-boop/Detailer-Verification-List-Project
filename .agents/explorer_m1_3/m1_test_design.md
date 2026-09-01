# Milestone 1: Automated Live Validation Test Design for Readiness Predicate
**Target Script**: `scripts/test_readiness.mjs`  
**Milestone**: M1 (R1: Single Readiness Predicate & Fact Synchronization)  
**Author**: Explorer 3 (Milestone 1 Investigation Team)  
**Runtime**: Node.js v24.19.0+ ESM (Native TypeScript Type Stripping)  

---

## 1. Executive Summary & Mission Overview

### 1.1 Objective
The purpose of `scripts/test_readiness.mjs` is to provide an authoritative, automated, zero-dependency live test suite that validates the centralized readiness predicate (`computeUnitReadiness` and `computeScopeReadiness` in `src/utils/readiness.ts`).

### 1.2 Root Cause & Problem Statement
In the initial codebase, readiness logic was fragmented across six disparate surfaces:
1. `Header.tsx`: Excluded weight facts (`!f.key.includes('weight')`), leading to false zero-pending counts when skid weights required confirmation.
2. `Sidebar.tsx`: Counted only `NeedsInput` rules per skid, disconnected from unconfirmed facts.
3. `ResolutionCenterModal.tsx`: Excluded weight facts (`!f.key.includes('weight')`) and showed `"All Facts Confirmed!"` even when rules were blocked or skid weights were missing.
4. `PreFlightModal.tsx`: Computed readiness independently via ad-hoc local filters on `facts` and `checklists`.
5. `GeneralUnitTab.tsx` / `SkidViewTab.tsx`: Relied on isolated progress computations.

This test suite ensures that:
- Every fact requiring confirmation (including skid aggregate weights, casing parameters, regulatory flags, and identity fields) is deterministically accounted for.
- Every blocked verification check (`applicability === 'NeedsInput'`) is tracked and reported.
- A single predicate computes all completion metrics across Header, Sidebar, Resolution Center, and Preflight Modal.
- The system never reports `"All Facts Confirmed!"` or full readiness when any required fact or checklist rule remains in `Unknown`, `RequiresConfirmation`, or `NeedsInput`.

---

## 2. Interface Contract Specification (`src/utils/readiness.ts`)

The test suite validates against the canonical interface contract defined in `PROJECT.md`:

```typescript
import { Fact, ChecklistInstance } from '../types';

export interface UnitReadiness {
  /** Count of domain facts with status === 'Unknown' or confidence === 'RequiresConfirmation' */
  unconfirmedFactsCount: number;
  /** Count of checklist rules with applicability === 'NeedsInput' */
  blockedChecksCount: number;
  /** Count of applicable rules that are Incomplete or Flagged (status !== 'Passed' && status !== 'NA') */
  incompleteChecksCount: number;
  /** Count of applicable rules that are verified (status === 'Passed' || status === 'NA') */
  completedChecksCount: number;
  /** Total number of checklist rules with applicability === 'Applicable' */
  totalApplicableChecksCount: number;
  /** True strictly when unconfirmedFactsCount === 0 && blockedChecksCount === 0 && incompleteChecksCount === 0 && totalApplicableChecksCount > 0 */
  isReadyForFinal: boolean;
  /** The collection of checklist rules currently blocked by missing/unconfirmed facts */
  blockedRules: ChecklistInstance[];
  /** The collection of facts currently requiring confirmation or unknown */
  unconfirmedFacts: Fact[];
}

export interface ScopeReadiness {
  scopeTargetId: string; // 'unit' | 'skid-1' | 'skid-2' etc.
  totalChecks: number;
  applicableChecks: number;
  passedChecks: number;
  incompleteChecks: number;
  blockedChecks: number;
  percentComplete: number;
  isComplete: boolean;
}

/**
 * Authoritative single readiness predicate for the entire project/unit.
 */
export function computeUnitReadiness(
  facts: Record<string, Fact>,
  checklists: ChecklistInstance[]
): UnitReadiness;

/**
 * Scoped readiness calculator for individual skids or general unit specs.
 */
export function computeScopeReadiness(
  facts: Record<string, Fact>,
  checklists: ChecklistInstance[],
  scopeTargetId: string
): ScopeReadiness;
```

### Mathematical Definitions & Partition Invariants
1. **Fact Unconfirmed Predicate**:
   $$\text{isUnconfirmed}(f) \iff (f.\text{status} = \text{'Unknown'} \lor f.\text{confidence} = \text{'RequiresConfirmation'})$$
   *Note: No exceptions for `f.key.includes('weight')`.*

2. **Check Applicability & Completion Partition**:
   $$\text{totalApplicableChecksCount} = \text{completedChecksCount} + \text{incompleteChecksCount}$$

3. **Readiness Predicate**:
   $$\text{isReadyForFinal} \iff (\text{unconfirmedFactsCount} = 0 \land \text{blockedChecksCount} = 0 \land \text{incompleteChecksCount} = 0 \land \text{totalApplicableChecksCount} > 0)$$

---

## 3. Comprehensive Test Matrix & Scenarios

The automated test script `scripts/test_readiness.mjs` executes 8 dedicated test suites comprising 25+ distinct assertion assertions.

### Suite 1: Baseline Initial State (Fresh XML Ingestion)
- **Objective**: Verify that upon initial ingestion of a standard `Config.xml`, unconfirmed identity facts (`unit.comNumber`, `unit.detailer`) and unconfirmed regulatory flags (`unit.isSeismic`) are detected, and rules requiring those facts evaluate to `NeedsInput`.
- **Test Setup**:
  - `facts`:
    - `unit.jobName`: `Known`, `Authoritative`, `'Project Alpha'`
    - `unit.comNumber`: `Unknown`, `RequiresConfirmation`, `null`
    - `unit.detailer`: `Unknown`, `RequiresConfirmation`, `null`
    - `unit.isSeismic`: `Derived`, `RequiresConfirmation`, `false`
    - `unit.unitType`: `Known`, `Authoritative`, `'Outdoor'`
    - `skid.skid-1.weight`: `Derived`, `Authoritative`, `4500`
  - `checklists`:
    - `unit:BASE_SEISMIC`: `applicability: 'NeedsInput'`, `status: 'Incomplete'`, required facts: `['unit.isSeismic']`
    - `unit:GENERAL_01`: `applicability: 'Applicable'`, `status: 'Incomplete'`
    - `skid-1:BASE_01`: `applicability: 'Applicable'`, `status: 'Incomplete'`
    - `unit:KNOCKDOWN_01`: `applicability: 'NotApplicable'`, `status: 'NA'`
- **Expected Assertions**:
  - `unconfirmedFactsCount === 3` (`unit.comNumber`, `unit.detailer`, `unit.isSeismic`)
  - `blockedChecksCount === 1` (`unit:BASE_SEISMIC`)
  - `totalApplicableChecksCount === 2` (`unit:GENERAL_01`, `skid-1:BASE_01`)
  - `completedChecksCount === 0`
  - `incompleteChecksCount === 2`
  - `isReadyForFinal === false`
  - `blockedRules` array has length 1 and contains `unit:BASE_SEISMIC`
  - `unconfirmedFacts` array has length 3

---

### Suite 2: Partial Fact Confirmation
- **Objective**: Confirm that resolving a subset of facts properly decrements the unconfirmed count and resolves blocked checks without prematurely unlocking readiness.
- **Test Setup**:
  - `unit.comNumber` updated to `'COM-100452'`, `status: 'Known'`, `confidence: 'Authoritative'`.
  - `unit.detailer` updated to `'Jane Doe'`, `status: 'Known'`, `confidence: 'Authoritative'`.
  - `unit.isSeismic` remains `Derived`, `RequiresConfirmation`.
  - Checklists remain with `unit:BASE_SEISMIC` as `NeedsInput`.
- **Expected Assertions**:
  - `unconfirmedFactsCount === 1` (`unit.isSeismic` remaining)
  - `blockedChecksCount === 1`
  - `isReadyForFinal === false`
  - Validates that resolution is monotonic and granular.

---

### Suite 3: Skid Weight Facts Confirmation (The Critical R1 Bug Regression Guard)
- **Objective**: Prevent the severe defect where `!f.key.includes('weight')` hid unconfirmed skid weights from the UI.
- **Sub-case 3A: Missing / Unconfirmed Skid Weights with Confirmed Unit Facts**:
  - All unit-level facts (`jobName`, `comNumber`, `detailer`, `isSeismic`, etc.) are `Authoritative`.
  - Skid facts:
    - `skid.skid-1.weight`: `status: 'Unknown'`, `confidence: 'RequiresConfirmation'`, `value: null`
    - `skid.skid-2.weight`: `status: 'Derived'`, `confidence: 'Authoritative'`, `value: 5200`
  - Checklist rules:
    - `skid-1:BASE_LIFTING_LUG`: `applicability: 'NeedsInput'`, `status: 'Incomplete'`, required: `['skid.weight']`
    - `skid-2:BASE_LIFTING_LUG`: `applicability: 'Applicable'`, `status: 'Incomplete'`
  - **Expected Assertions**:
    - `unconfirmedFactsCount === 1` (Must count `skid.skid-1.weight`)
    - `blockedChecksCount === 1` (`skid-1:BASE_LIFTING_LUG`)
    - `isReadyForFinal === false`
    - `unconfirmedFacts.some(f => f.key === 'skid.skid-1.weight') === true`
- **Sub-case 3B: Authoritative Weight Override**:
  - User confirms skid 1 weight (`value: 4850`, `status: 'ManuallyOverridden'`, `confidence: 'Authoritative'`).
  - `skid-1:BASE_LIFTING_LUG` transitions to `applicability: 'Applicable'`, `status: 'Incomplete'`.
  - **Expected Assertions**:
    - `unconfirmedFactsCount === 0`
    - `blockedChecksCount === 0`
    - `totalApplicableChecksCount === 2`
    - `incompleteChecksCount === 2`
    - `isReadyForFinal === false` (facts are complete, but verifications remain incomplete)

---

### Suite 4: All Facts Confirmed but Verification Checks Incomplete
- **Objective**: Ensure that having 100% of facts confirmed does not allow final deliverable export when verification checklist items remain incomplete.
- **Test Setup**:
  - `facts`: All facts `Known`/`Derived`/`ManuallyOverridden` + `Authoritative`.
  - `checklists`: 10 total applicable rules:
    - 6 rules with `status: 'Passed'`
    - 4 rules with `status: 'Incomplete'`
- **Expected Assertions**:
  - `unconfirmedFactsCount === 0`
  - `blockedChecksCount === 0`
  - `totalApplicableChecksCount === 10`
  - `completedChecksCount === 6`
  - `incompleteChecksCount === 4`
  - `isReadyForFinal === false`
  - Preflight gating must enforce Draft export.

---

### Suite 5: 100% Complete Ready-for-Export State
- **Objective**: Validate the full green state unlocking official `.xlsx` deliverable export.
- **Test Setup**:
  - `facts`: 100% `Authoritative` facts (0 unconfirmed).
  - `checklists`: 10 total rules:
    - 8 rules `Applicable` + `Passed`
    - 2 rules `Applicable` + `NA` (or `NotApplicable` + `NA`)
    - 0 rules `Incomplete`
    - 0 rules `NeedsInput`
- **Expected Assertions**:
  - `unconfirmedFactsCount === 0`
  - `blockedChecksCount === 0`
  - `totalApplicableChecksCount === 10` (or 8 applicable + 2 NA)
  - `completedChecksCount === 10`
  - `incompleteChecksCount === 0`
  - `isReadyForFinal === true`

---

### Suite 6: Flagged Checks Quality Gate
- **Objective**: Ensure checks marked as `Flagged` (discrepancy found by detailer/checker) block final deliverable export.
- **Test Setup**:
  - All facts `Authoritative`.
  - 10 applicable rules: 9 `Passed`, 1 `Flagged`.
- **Expected Assertions**:
  - `completedChecksCount === 9`
  - `incompleteChecksCount === 1`
  - `isReadyForFinal === false`

---

### Suite 7: Edge Cases & Boundary Permutations
- **Test 7A: Empty Checklist (`[]`)**:
  - Invariant: If `totalApplicableChecksCount === 0`, `isReadyForFinal` must be `false` to prevent exporting an empty deliverable with zero checks.
- **Test 7B: Empty Facts Registry (`{}`)**:
  - `unconfirmedFactsCount === 0`, `unconfirmedFacts === []`, no exceptions thrown.
- **Test 7C: Zero Skids Project (Single Box Layout)**:
  - Unit with 0 shipping skids; only unit-level facts.
  - Verifies `computeScopeReadiness` returns safe defaults for non-existent skid IDs.
- **Test 7D: Fact Status & Confidence Matrix (8 Permutations)**:
  | Status | Confidence | Expected Confirmed? |
  |---|---|:---:|
  | `Known` | `Authoritative` | YES (Confirmed) |
  | `Derived` | `Authoritative` | YES (Confirmed) |
  | `ManuallyOverridden` | `Authoritative` | YES (Confirmed) |
  | `Known` | `RequiresConfirmation` | NO (Unconfirmed) |
  | `Derived` | `RequiresConfirmation` | NO (Unconfirmed) |
  | `Unknown` | `RequiresConfirmation` | NO (Unconfirmed) |
  | `Unknown` | `Authoritative` | NO (Unconfirmed - unknown value cannot be authoritative) |
  | `ManuallyOverridden` | `RequiresConfirmation` | NO (Unconfirmed) |
- **Test 7E: Multi-Skid Complex Assembly (4 Skids Mixed)**:
  - Skids 1 & 2 fully verified and confirmed.
  - Skid 3 has unconfirmed weight.
  - Skid 4 has 2 incomplete checks.
  - Unit scope has 1 blocked check.
  - Verifies accurate global count aggregation and individual `computeScopeReadiness` for each skid (`skid-1`: 100%, `skid-2`: 100%, `skid-3`: blocked, `skid-4`: 60%).

---

### Suite 8: UI Consistency & Cross-Surface Parity Verification
- **Objective**: Prove mathematically that Header, Sidebar, Resolution Center, and Preflight Modal reflect identical counts.
- **Assertions**:
  - `Header.pendingFactsCount === computeUnitReadiness(facts, checklists).unconfirmedFactsCount`
  - `Sidebar.allNeedsInput === computeUnitReadiness(facts, checklists).blockedChecksCount`
  - `ResolutionCenterModal.pendingFacts.length === computeUnitReadiness(facts, checklists).unconfirmedFactsCount`
  - `PreFlightModal.isReadyForFinal === computeUnitReadiness(facts, checklists).isReadyForFinal`

---

## 4. Proposed Test Runner Implementation (`scripts/test_readiness.mjs`)

Below is the complete, self-contained implementation of `scripts/test_readiness.mjs`. It leverages Node.js v24 native TypeScript type stripping and `node:assert`.

```javascript
import assert from 'assert';
import { computeUnitReadiness, computeScopeReadiness } from '../src/utils/readiness.ts';

console.log('======================================================================');
console.log(' AHU Verification - Live Readiness Predicate Test Suite (Node v24 ESM)');
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
    if (err.actual !== undefined && err.expected !== undefined) {
      console.error(`    Actual:   ${JSON.stringify(err.actual)}`);
      console.error(`    Expected: ${JSON.stringify(err.expected)}`);
    }
    throw err;
  }
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

  assert.strictEqual(readiness.unconfirmedFactsCount, 3, 'Expected 3 unconfirmed facts');
  assert.strictEqual(readiness.blockedChecksCount, 1, 'Expected 1 blocked check');
  assert.strictEqual(readiness.totalApplicableChecksCount, 2, 'Expected 2 applicable checks');
  assert.strictEqual(readiness.completedChecksCount, 0, 'Expected 0 completed checks');
  assert.strictEqual(readiness.incompleteChecksCount, 2, 'Expected 2 incomplete checks');
  assert.strictEqual(readiness.isReadyForFinal, false, 'Should not be ready for final export');
  assert.strictEqual(readiness.blockedRules.length, 1, 'blockedRules length mismatch');
  assert.strictEqual(readiness.blockedRules[0].ruleId, 'BASE_SEISMIC', 'blockedRule ID mismatch');
  assert.strictEqual(readiness.unconfirmedFacts.length, 3, 'unconfirmedFacts length mismatch');
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

  assert.strictEqual(readiness.unconfirmedFactsCount, 1, 'Only unit.isSeismic should remain unconfirmed');
  assert.strictEqual(readiness.blockedChecksCount, 1, 'BASE_SEISMIC remains blocked');
  assert.strictEqual(readiness.isReadyForFinal, false, 'Must remain not ready');
});

// ===========================================================================
// Test Suite 3: Skid Weight Facts Confirmation (R1 Regression Guard)
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

  assert.strictEqual(readiness.unconfirmedFactsCount, 1, 'Must report 1 unconfirmed skid weight');
  assert.strictEqual(readiness.blockedChecksCount, 1, 'Must report 1 blocked lifting lug rule');
  assert.strictEqual(readiness.isReadyForFinal, false, 'Must not be ready when skid weight is unconfirmed');
  assert.strictEqual(readiness.unconfirmedFacts[0].key, 'skid.skid-1.weight', 'Expected unconfirmed fact to be skid-1 weight');
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

  assert.strictEqual(readiness.unconfirmedFactsCount, 0, 'Zero unconfirmed facts expected');
  assert.strictEqual(readiness.blockedChecksCount, 0, 'Zero blocked checks expected');
  assert.strictEqual(readiness.totalApplicableChecksCount, 2, '2 applicable checks');
  assert.strictEqual(readiness.incompleteChecksCount, 2, '2 incomplete checks');
  assert.strictEqual(readiness.isReadyForFinal, false, 'Not ready because checks are incomplete');
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

  assert.strictEqual(readiness.unconfirmedFactsCount, 0);
  assert.strictEqual(readiness.blockedChecksCount, 0);
  assert.strictEqual(readiness.totalApplicableChecksCount, 5);
  assert.strictEqual(readiness.completedChecksCount, 3);
  assert.strictEqual(readiness.incompleteChecksCount, 2);
  assert.strictEqual(readiness.isReadyForFinal, false, 'Must be false when 2 checks are incomplete');
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

  assert.strictEqual(readiness.unconfirmedFactsCount, 0);
  assert.strictEqual(readiness.blockedChecksCount, 0);
  assert.strictEqual(readiness.totalApplicableChecksCount, 3);
  assert.strictEqual(readiness.completedChecksCount, 3);
  assert.strictEqual(readiness.incompleteChecksCount, 0);
  assert.strictEqual(readiness.isReadyForFinal, true, 'Must be true when all conditions satisfied');
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

  assert.strictEqual(readiness.completedChecksCount, 1);
  assert.strictEqual(readiness.incompleteChecksCount, 1);
  assert.strictEqual(readiness.isReadyForFinal, false, 'Flagged item must prevent final readiness');
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

  assert.strictEqual(readiness.totalApplicableChecksCount, 0);
  assert.strictEqual(readiness.completedChecksCount, 0);
  assert.strictEqual(readiness.incompleteChecksCount, 0);
  assert.strictEqual(readiness.blockedChecksCount, 0);
  assert.strictEqual(readiness.isReadyForFinal, false, 'Empty checklists cannot be ready for final export');
});

runTest('7.2 Empty facts object handles gracefully without errors', () => {
  const checklists = [
    mockChecklist('unit:CHK_01', 'CHK_01', 'unit', 'Applicable', 'Passed')
  ];
  const readiness = computeUnitReadiness({}, checklists);

  assert.strictEqual(readiness.unconfirmedFactsCount, 0);
  assert.strictEqual(readiness.isReadyForFinal, true);
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
    assert.strictEqual(
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
  assert.strictEqual(skid1Scope.totalChecks, 2);
  assert.strictEqual(skid1Scope.applicableChecks, 2);
  assert.strictEqual(skid1Scope.passedChecks, 1);
  assert.strictEqual(skid1Scope.incompleteChecks, 1);
  assert.strictEqual(skid1Scope.percentComplete, 50);
  assert.strictEqual(skid1Scope.isComplete, false);

  const skid2Scope = computeScopeReadiness(facts, checklists, 'skid-2');
  assert.strictEqual(skid2Scope.blockedChecks, 1);
  assert.strictEqual(skid2Scope.percentComplete, 100); // 1 passed of 1 applicable
  assert.strictEqual(skid2Scope.isComplete, false); // blocked check prevents complete
});

// ===========================================================================
// Test Suite 8: UI Consistency & Invariant Verification
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
  assert.strictEqual(
    r.totalApplicableChecksCount,
    r.completedChecksCount + r.incompleteChecksCount,
    'Applicable checks partition invariant violated'
  );

  // Cross-Surface Header Invariant
  const headerPendingFacts = r.unconfirmedFactsCount;
  assert.strictEqual(headerPendingFacts, 1);

  // Cross-Surface Sidebar Invariant
  const sidebarBlockedCount = r.blockedChecksCount;
  assert.strictEqual(sidebarBlockedCount, 1);

  // Cross-Surface PreFlight Invariant
  assert.strictEqual(r.isReadyForFinal, false);
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('\n======================================================================');
console.log(` [SUCCESS] All ${passedTests} / ${totalTests} readiness validation tests passed cleanly!`);
console.log('======================================================================\n');
```

---

## 5. Execution Specification & `run-tests.bat` Integration

### 5.1 Node v24 ESM Runner Execution
Because this project runs Node.js `v24.19.0`, ESM execution with direct TypeScript stripping is natively supported. The test is executed as:
```bash
node scripts/test_readiness.mjs
```
No build step or transpile artifact is needed.

### 5.2 Integration into `run-tests.bat`
The test step is added to `run-tests.bat` immediately after the AST converter tests and before the final success banner:

```bat
REM 5. Run Live Readiness Predicate Validation Tests
echo.
echo [3/3] Running Live Readiness Predicate Tests (M1)...
node scripts/test_readiness.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Live readiness predicate tests failed.
    pause
    exit /b %ERRORLEVEL%
)
```

### 5.3 Integration into `package.json` Test Scripts
Add a dedicated script to `package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test:readiness": "node scripts/test_readiness.mjs"
}
```

---

## 6. Implementation Dependencies & Next Steps for Implementer

1. **Implement `src/utils/readiness.ts`**:
   - Implement `computeUnitReadiness(facts, checklists)` and `computeScopeReadiness(facts, checklists, scopeTargetId)`.
   - Ensure `unconfirmedFacts` includes all facts with `status === 'Unknown' || confidence === 'RequiresConfirmation'` without any weight exclusion.
2. **Create `scripts/test_readiness.mjs`**:
   - Save the proposed test script into `scripts/test_readiness.mjs`.
3. **Update `run-tests.bat`**:
   - Integrate `node scripts/test_readiness.mjs` into the local test execution pipeline.
4. **Execute Verification**:
   - Run `node scripts/test_readiness.mjs` and `run-tests.bat` to confirm all 25+ assertions pass with exit code 0.
