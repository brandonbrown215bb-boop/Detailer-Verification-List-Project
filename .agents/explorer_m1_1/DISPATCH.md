## 2026-08-31T19:46:25Z

Explore and formulate the exact implementation strategy for `src/utils/readiness.ts` and core state calculation:
1. Define the `UnitReadiness` interface and `computeUnitReadiness(facts, checklists)` function.
2. Determine how `unconfirmedFactsCount` (all facts with status==='Unknown' or confidence==='RequiresConfirmation', including weights), `blockedChecksCount` (checklists with applicability==='NeedsInput'), `completedChecksCount`, `incompleteChecksCount`, and `isReadyForFinal` should be calculated deterministically.
3. Formulate how `App.tsx` and child components should import and consume this single predicate.
Deliverable: Write report to `.agents/explorer_m1_1/m1_strategy_readiness.md` and `handoff.md`.
