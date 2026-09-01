# Handoff Report — Milestone 1 UI Component Integration Strategy

## 1. Observation
- In `src/components/Header.tsx` (lines 75–77):
  ```typescript
  const pendingFactsCount = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  ).length;
  ```
  Weight facts are arbitrarily excluded with `!f.key.includes('weight')`, and `Header` has no visibility into `checklists` or rules blocked in `NeedsInput` state.
- In `src/components/Sidebar.tsx` (lines 38–47):
  ```typescript
  const allApplicable = checklists.filter(c => c.applicability === 'Applicable');
  const allPassed = allApplicable.filter(c => c.status === 'Passed').length;
  const allNeedsInput = checklists.filter(c => c.applicability === 'NeedsInput').length;
  const overallPercent = allApplicable.length > 0 ? Math.round((allPassed / allApplicable.length) * 100) : 0;
  ```
  `overallPercent` omits resolved `NA` checks (`status === 'NA'`), and `Sidebar` receives no `facts` prop, so it cannot reflect unconfirmed domain facts in progress or badges.
- In `src/components/ResolutionCenterModal.tsx` (lines 28–30, 53–60):
  ```typescript
  const pendingFacts = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  );
  ```
  When `pendingFacts.length === 0`, it renders:
  ```tsx
  <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
  <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed!</h4>
  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
    All engineering parameters and order identity values are populated with authoritative status.
  </p>
  ```
  This creates a false-success state when rules are in `NeedsInput` state or skid weights are unconfirmed. Additionally, no controls exist for non-hardcoded fact keys or skid weights.
- In `src/components/PreFlightModal.tsx` (lines 40–53):
  PreFlight recalculates its readiness counts locally and computes `isReadyForFinal = incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0`, while lacking jump links for blocked rules.
- In `src/components/SkidViewTab.tsx` (line 387):
  ```tsx
  <InlineFactPopover
    factKey={rule.requiredFacts[0] || 'unknown'}
    fact={facts[rule.requiredFacts[0]]}
    onUpdateFact={onUpdateFact}
    triggerButtonText="Needs Input"
    compact={true}
  />
  ```
  `rule.requiredFacts[0]` is `'skid.weight'`, whereas `facts` indexes `'skid.skid-1.weight'`. Approving the weight updates an orphan key rather than the scoped skid fact, leaving `BASE-01` permanently blocked.

## 2. Logic Chain
1. **Single Source of Truth Requirement:** To satisfy R1, all UI surfaces (`Header`, `Sidebar`, `ResolutionCenterModal`, `PreFlightModal`) must consume the centralized readiness predicate from `src/utils/readiness.ts` (`UnitReadiness` and `computeUnitReadiness`).
2. **Badge & Counter Reconciliation:** Passing `readiness` (or `facts` + `checklists`) to `Header` and `Sidebar` guarantees that `Header` facts pill, `Sidebar` progress tracker, and `Sidebar` per-skid warning badges evaluate identical counts of unconfirmed facts (`unconfirmedFactsCount`) and blocked checks (`blockedChecksCount`).
3. **Elimination of False "All Facts Confirmed!":** In `ResolutionCenterModal`, removing the `!f.key.includes('weight')` filter and passing `checklists` and `rules` enables the modal to distinguish between:
   - True Success: `unconfirmedFactsCount === 0 && blockedChecksCount === 0`.
   - Partial Blocked: `unconfirmedFactsCount === 0 && blockedChecksCount > 0` (shows list of blocked rules with jump actions).
   - Pending Facts: `unconfirmedFactsCount > 0` (shows adaptive fact resolution cards for all facts including skid weights).
4. **Scoped Fact Resolution:** Adding `resolveFactForScope` in `SkidViewTab` maps `'skid.weight'` to `'skid.skid-X.weight'`, ensuring inline fact updates immediately unblock `BASE-01` and synchronize state with `App.tsx`.
5. **PreFlight Export Alignment:** PreFlight gating directly on `unitReadiness.isReadyForFinal` ensures that "Export Final .xlsx" is only unlocked when zero unconfirmed facts, zero blocked checks, and zero incomplete checks remain.

## 3. Caveats
- Backend .NET C# verification engine (`NormalizedXmlParser.cs`, `AstRuleEvaluator.cs`) performs parallel rule evaluations on native desktop execution; frontend logic in `src/utils/readiness.ts` and component hooks must remain 100% semantically aligned with the C# model.
- Modal focus trapping and keyboard navigation improvements are scoped to Milestone 2 (R2), but the props and callback surfaces designed here (`onNavigateToRule`, `onClose`) are fully forward-compatible with M2 modal focus trap requirements.

## 4. Conclusion
The UI component integration strategy is fully formulated, documented, and ready for implementation. It resolves all UI/UX review findings regarding state trust, eliminates false readiness messages, ensures synchronized badges across all views, and provides comprehensive fact resolution for all domain parameters including skid weights.

## 5. Verification Method
1. Inspect report: `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m1_2\m1_strategy_components.md`.
2. Verify TypeScript build integrity:
   ```bash
   npm run build
   ```
3. Run backend tests:
   ```bash
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
   ```
4. Verify rule pack manifest:
   ```bash
   node scripts/build_rulepack.mjs
   ```
