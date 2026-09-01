## 2026-08-31T19:49:13Z
You are the Worker for Milestone 1 (R1: Single Readiness Predicate & Fact Synchronization).

Your working directory is:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\worker_m1_1

Project Root:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project

MANDATORY FIRST STEP:
Read c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\ORIGINAL_REQUEST.md and c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\PROJECT.md before doing anything else.

EXPLORER FINDINGS TO READ:
- `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m1_1\m1_strategy_readiness.md`
- `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m1_2\m1_strategy_components.md`
- `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m1_3\m1_test_design.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
- `src/utils/readiness.ts` (create)
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ResolutionCenterModal.tsx`
- `src/components/PreFlightModal.tsx`
- `src/components/GeneralUnitTab.tsx`
- `src/components/SkidViewTab.tsx`
- `scripts/test_readiness.mjs` (create)
- `run-tests.bat` (integrate readiness test)

YOUR MISSION & IMPLEMENTATION REQUIREMENTS:
1. Implement `src/utils/readiness.ts`:
   - Export `UnitReadiness` and `ScopeReadiness` interfaces.
   - Implement `computeUnitReadiness(facts, checklists)` and `computeScopeReadiness(facts, checklists, scope)`.
   - Ensure all domain facts in `Unknown` or `RequiresConfirmation` (INCLUDING weights) count towards `unconfirmedFactsCount`.
   - Ensure rules with `applicability === 'NeedsInput'` count towards `blockedChecksCount`.
   - Compute `completedChecksCount`, `incompleteChecksCount`, and `isReadyForFinal`.
2. Integrate with UI Components:
   - `Header.tsx`: Use `computeUnitReadiness` to render unified fact pills and readiness state.
   - `Sidebar.tsx`: Render synchronized counts for blocked rules / needs input across unit and skids.
   - `ResolutionCenterModal.tsx`:
     - Allow confirming/editing all unconfirmed facts (including skid weights).
     - Display blocked checklist rules (`NeedsInput`) and required missing facts.
     - NEVER display "All Facts Confirmed!" while `unconfirmedFactsCount > 0` or `blockedChecksCount > 0`.
   - `PreFlightModal.tsx`: Derive summary cards and export readiness gating directly from `computeUnitReadiness`.
3. Create automated validation script `scripts/test_readiness.mjs`:
   - Implement 8 test suites with 25+ assertions verifying baseline, partial confirmation, weight facts, blocked rules, export gating, and cross-surface parity.
   - Integrate into `run-tests.bat`.
4. Run verification commands:
   - `npm run build`
   - `node scripts/test_readiness.mjs`
   - `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`
   - `node scripts/build_rulepack.mjs`

DELIVERABLE:
Write a complete `handoff.md` in your working directory documenting:
1. Observation (files changed and test results)
2. Logic Chain
3. Caveats
4. Conclusion
5. Verification Method & Output
Communicate completion back to caller via send_message.
