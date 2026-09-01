# Handoff Report: Milestone 1 Single Readiness Predicate & Fact Synchronization

**Agent**: Explorer 1 (`explorer_m1_1`)  
**Mission**: Formulate exact implementation strategy for `src/utils/readiness.ts` and core state calculation.  
**Deliverable Document**: `.agents/explorer_m1_1/m1_strategy_readiness.md`

---

## 1. Observation

1. **Header Fact Filtering**:
   In `src/components/Header.tsx` lines 75-77:
   ```typescript
   const pendingFactsCount = Object.values(facts).filter(
     f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
   ).length;
   ```
   Weight facts were explicitly excluded with `!f.key.includes('weight')`.

2. **Resolution Center Fact Filtering & Premature Completion State**:
   In `src/components/ResolutionCenterModal.tsx` lines 28-30 and 53-60:
   ```typescript
   const pendingFacts = Object.values(facts).filter(
     f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
   );
   ```
   and:
   ```tsx
   {pendingFacts.length === 0 ? (
     <div className="py-12 text-center space-y-3">
       <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
       <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed!</h4>
   ```
   The modal showed "All Facts Confirmed!" even if weight facts were unconfirmed or checklist items had `applicability === 'NeedsInput'`.

3. **PreFlight Modal Count Calculation**:
   In `src/components/PreFlightModal.tsx` lines 40-53:
   ```typescript
   const applicableChecks = checklists.filter(c => c.applicability === 'Applicable');
   const passedChecks = applicableChecks.filter(c => c.status === 'Passed');
   const incompleteChecks = applicableChecks.filter(c => c.status === 'Incomplete');
   const needsInputChecks = checklists.filter(c => c.applicability === 'NeedsInput');
   const pendingFacts = Object.values(facts).filter(
     f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
   );

   const isReadyForFinal = incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0;
   ```
   PreFlight included weights in `pendingFacts`, causing a direct discrepancy with the Header badge and Resolution Center.

4. **Sidebar Independent Metrics**:
   In `src/components/Sidebar.tsx` lines 38-47:
   ```typescript
   const unitChecks = checklists.filter(c => c.scopeTargetId === 'unit');
   const unitApplicable = unitChecks.filter(c => c.applicability === 'Applicable');
   const unitPassed = unitApplicable.filter(c => c.status === 'Passed').length;
   const unitNeedsInput = unitChecks.filter(c => c.applicability === 'NeedsInput').length;

   const allApplicable = checklists.filter(c => c.applicability === 'Applicable');
   const allPassed = allApplicable.filter(c => c.status === 'Passed').length;
   const allNeedsInput = checklists.filter(c => c.applicability === 'NeedsInput').length;
   const overallPercent = allApplicable.length > 0 ? Math.round((allPassed / allApplicable.length) * 100) : 0;
   ```
   Calculations were inline and decoupled from the rest of the application.

5. **AST Evaluator NeedsInput Propagation**:
   In `src/services/ruleEvaluator.ts` lines 21-27:
   ```typescript
   if (!fact || fact.status === 'Unknown' || fact.confidence === 'RequiresConfirmation') {
     return {
       result: false,
       needsInput: true,
       trace: `Required fact '${fact?.label || fKey}' requires confirmation or is unknown (${fact?.status || 'Missing'})`
     };
   }
   ```
   When a rule requires a fact that is `Unknown` or `RequiresConfirmation`, the evaluator sets `applicability = 'NeedsInput'`.

---

## 2. Logic Chain

1. **Observation 1 & 3 vs Requirement R1**:
   `Header.tsx` and `ResolutionCenterModal.tsx` filtered out `weight` facts, while `PreFlightModal.tsx` counted them. This caused count mismatches (e.g. Header showing 0 pending facts while Preflight showed 1+ pending facts).
   *Inference*: Removing arbitrary key filtering and standardizing on `isFactUnconfirmed = fact.status === 'Unknown' || fact.confidence === 'RequiresConfirmation'` resolves the mismatch across all UI surfaces.

2. **Observation 2 & 5 vs Requirement R1**:
   When a fact is unconfirmed, dependent checklist items receive `applicability === 'NeedsInput'`. If a user resolves some facts but a rule remains in `NeedsInput`, the Resolution Center reported "All Facts Confirmed!", misleading the user.
   *Inference*: Resolution Center zero-state must check both `unconfirmedFactsCount === 0` AND `blockedChecksCount === 0`, and must render a dedicated section for `blockedRules` with interactive resolution affordances.

3. **Observation 4 & Project Architecture**:
   Sidebar and Skid views re-implemented progress formulas in place.
   *Inference*: Providing `computeUnitReadiness` and `computeScopeReadiness` in `src/utils/readiness.ts` allows `App.tsx` and all child components to consume a single memoized structure (`UnitReadiness`), eliminating state divergence and guaranteeing identical counts.

---

## 3. Caveats

- **No Caveats**: The domain types, fact structure, AST predicate evaluator, and component hierarchy have been thoroughly analyzed. All invariants and edge cases (empty states, NA status handling, scope partitioning, weight facts) have been accounted for in `m1_strategy_readiness.md`.

---

## 4. Conclusion

The strategy for `src/utils/readiness.ts` is fully formulated and documented in `.agents/explorer_m1_1/m1_strategy_readiness.md`:
1. `UnitReadiness` interface and helper functions are explicitly defined.
2. Exact deterministic calculations for `unconfirmedFactsCount`, `blockedChecksCount`, `completedChecksCount`, `incompleteChecksCount`, and `isReadyForFinal` are specified.
3. Component-by-component blueprints for `App.tsx`, `Header.tsx`, `Sidebar.tsx`, `ResolutionCenterModal.tsx`, `PreFlightModal.tsx`, and `SkidViewTab.tsx` are provided with drop-in code examples.
4. Test harness strategy `scripts/test_readiness.mjs` is specified for continuous verification.

---

## 5. Verification Method

To verify the strategy and subsequent implementation:
1. **Report Inspection**:
   Inspect `.agents/explorer_m1_1/m1_strategy_readiness.md` for complete code listings and component blueprints.
2. **Build Verification**:
   Run `npm run build` to verify zero TypeScript errors.
3. **Automated Readiness Validation**:
   Run `node scripts/test_readiness.mjs` to verify deterministic state calculations and count synchronization across all test cases.
4. **Backend Test Suite**:
   Run `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`.
