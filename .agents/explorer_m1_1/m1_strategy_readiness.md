# Technical Strategy Report: Centralized Readiness Predicate & Fact Synchronization (Milestone 1 / R1)

**Author**: Explorer 1 (Milestone 1)  
**Date**: 2026-08-31  
**Target Module**: `src/utils/readiness.ts`  
**Applicable Components**: `App.tsx`, `Header.tsx`, `Sidebar.tsx`, `ResolutionCenterModal.tsx`, `PreFlightModal.tsx`, `GeneralUnitTab.tsx`, `SkidViewTab.tsx`

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Problem
In the previous codebase, readiness logic was duplicated across six different components with divergent predicates and inconsistent filtering logic:
- **`Header.tsx`** and **`ResolutionCenterModal.tsx`** filtered pending facts with `(f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')`, arbitrarily hiding unconfirmed weight facts.
- **`PreFlightModal.tsx`** filtered pending facts with `f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'` (including weight), resulting in mismatched pending fact counts between the Header pill and the Preflight audit.
- **`ResolutionCenterModal.tsx`** rendered `"All Facts Confirmed!"` whenever pending facts were zero, completely ignoring checklist rules stuck in `applicability === 'NeedsInput'`.
- **`Sidebar.tsx`** computed verified and pending checks independently using ad-hoc filters on `applicability === 'Applicable'` vs `applicability === 'NeedsInput'`, with no unified synchronization with `PreFlightModal.tsx`.

### 1.2 The Solution: Single Source of Truth
We establish a centralized, deterministic readiness module at `src/utils/readiness.ts`. All UI surfaces (Header badge, Sidebar progress bars, Resolution Center zero-state, Preflight audit cards, and Excel export gating) will consume the exact same `UnitReadiness` data structure calculated via `computeUnitReadiness(facts, checklists)`.

---

## 2. Interface Contracts & Type Definitions

The module `src/utils/readiness.ts` and `src/types/index.ts` will provide the following canonical interfaces and type aliases:

```typescript
import { Fact, ChecklistInstance, CheckStatus, RuleApplicability } from '../types';

/** Type aliases for domain clarity and backwards-compatibility */
export type DomainFact = Fact;
export type ChecklistItem = ChecklistInstance;

/**
 * Scoped metrics for a specific target (e.g. 'unit' or 'skid-1')
 */
export interface ScopeReadiness {
  scopeTargetId: string;
  totalChecksCount: number;
  totalApplicableChecksCount: number;
  completedChecksCount: number;
  incompleteChecksCount: number;
  blockedChecksCount: number;
  naChecksCount: number;
  percentComplete: number;
  isFullyVerified: boolean;
  blockedRules: ChecklistInstance[];
  incompleteRules: ChecklistInstance[];
  passedRules: ChecklistInstance[];
}

/**
 * Global project readiness metrics across all facts and checklist items
 */
export interface UnitReadiness {
  /** Count of domain facts with status === 'Unknown' or confidence === 'RequiresConfirmation' (including weights) */
  unconfirmedFactsCount: number;
  /** Count of checklist rules where applicability === 'NeedsInput' */
  blockedChecksCount: number;
  /** Count of applicable checklist rules that are not Passed or NA (status === 'Incomplete' | 'Flagged') */
  incompleteChecksCount: number;
  /** Count of applicable checklist rules with status === 'Passed' */
  completedChecksCount: number;
  /** Count of applicable checklist rules with status === 'NA' */
  naChecksCount: number;
  /** Total count of checklist rules with applicability === 'Applicable' */
  totalApplicableChecksCount: number;
  /** Total count of all checklist rule instances */
  totalChecksCount: number;
  /** Percentage of applicable checks completed: Math.round((completedChecksCount / totalApplicableChecksCount) * 100) */
  percentComplete: number;
  /** True ONLY if unconfirmedFactsCount === 0 && blockedChecksCount === 0 && incompleteChecksCount === 0 && totalApplicableChecksCount > 0 */
  isReadyForFinal: boolean;
  /** Array of all checklist items blocked by missing/unconfirmed facts */
  blockedRules: ChecklistInstance[];
  /** Array of all unconfirmed domain facts */
  unconfirmedFacts: Fact[];
  /** Array of all applicable incomplete checklist items */
  incompleteRules: ChecklistInstance[];
  /** Array of all applicable passed checklist items */
  passedRules: ChecklistInstance[];
  /** Scope-by-scope readiness map indexed by scopeTargetId ('unit', 'skid-1', etc.) */
  scopeReadinessMap: Record<string, ScopeReadiness>;
}
```

---

## 3. Implementation Blueprint: `src/utils/readiness.ts`

The complete implementation of `src/utils/readiness.ts` is defined as follows:

```typescript
import { Fact, ChecklistInstance, CheckStatus, RuleApplicability } from '../types';

export type DomainFact = Fact;
export type ChecklistItem = ChecklistInstance;

export interface ScopeReadiness {
  scopeTargetId: string;
  totalChecksCount: number;
  totalApplicableChecksCount: number;
  completedChecksCount: number;
  incompleteChecksCount: number;
  blockedChecksCount: number;
  naChecksCount: number;
  percentComplete: number;
  isFullyVerified: boolean;
  blockedRules: ChecklistInstance[];
  incompleteRules: ChecklistInstance[];
  passedRules: ChecklistInstance[];
}

export interface UnitReadiness {
  unconfirmedFactsCount: number;
  blockedChecksCount: number;
  incompleteChecksCount: number;
  completedChecksCount: number;
  naChecksCount: number;
  totalApplicableChecksCount: number;
  totalChecksCount: number;
  percentComplete: number;
  isReadyForFinal: boolean;
  blockedRules: ChecklistInstance[];
  unconfirmedFacts: Fact[];
  incompleteRules: ChecklistInstance[];
  passedRules: ChecklistInstance[];
  scopeReadinessMap: Record<string, ScopeReadiness>;
}

/**
 * Predicate to determine if an individual fact requires confirmation or is unknown.
 * Includes all categories: Order & Identity, Baserails, Casing, Openings, Components, Ratings, and Weights.
 */
export function isFactUnconfirmed(fact: Fact | undefined | null): boolean {
  if (!fact) return true;
  return fact.status === 'Unknown' || fact.confidence === 'RequiresConfirmation';
}

/**
 * Predicate to determine if a checklist rule is blocked awaiting fact confirmation.
 */
export function isChecklistBlocked(item: ChecklistInstance): boolean {
  return item.applicability === 'NeedsInput';
}

/**
 * Predicate to determine if a checklist rule is applicable and passed.
 */
export function isChecklistPassed(item: ChecklistInstance): boolean {
  return item.applicability === 'Applicable' && item.status === 'Passed';
}

/**
 * Predicate to determine if a checklist rule is applicable but not yet completed.
 */
export function isChecklistIncomplete(item: ChecklistInstance): boolean {
  return item.applicability === 'Applicable' && item.status !== 'Passed' && item.status !== 'NA';
}

/**
 * Computes readiness metrics for a specific scope target ('unit', 'skid-1', 'skid-2', etc.)
 */
export function computeScopeReadiness(
  checklists: ChecklistInstance[],
  scopeTargetId: string
): ScopeReadiness {
  const scopeChecks = (checklists || []).filter(c => c.scopeTargetId === scopeTargetId);
  const applicableChecks = scopeChecks.filter(c => c.applicability === 'Applicable');
  const passedRules = applicableChecks.filter(c => c.status === 'Passed');
  const naRules = applicableChecks.filter(c => c.status === 'NA');
  const incompleteRules = applicableChecks.filter(isChecklistIncomplete);
  const blockedRules = scopeChecks.filter(isChecklistBlocked);

  const totalApplicableChecksCount = applicableChecks.length;
  const completedChecksCount = passedRules.length;
  const percentComplete = totalApplicableChecksCount > 0
    ? Math.round((completedChecksCount / totalApplicableChecksCount) * 100)
    : 0;

  const isFullyVerified = totalApplicableChecksCount > 0 &&
    blockedRules.length === 0 &&
    incompleteRules.length === 0;

  return {
    scopeTargetId,
    totalChecksCount: scopeChecks.length,
    totalApplicableChecksCount,
    completedChecksCount,
    incompleteChecksCount: incompleteRules.length,
    blockedChecksCount: blockedRules.length,
    naChecksCount: naRules.length,
    percentComplete,
    isFullyVerified,
    blockedRules,
    incompleteRules,
    passedRules
  };
}

/**
 * Computes deterministic unit-level and project-level readiness metrics.
 * 
 * Rules:
 * 1. unconfirmedFactsCount includes all facts with status === 'Unknown' or confidence === 'RequiresConfirmation' (including weights).
 * 2. blockedChecksCount includes all checklist instances with applicability === 'NeedsInput'.
 * 3. incompleteChecksCount includes applicable rules not marked Passed or NA.
 * 4. isReadyForFinal is strictly true iff unconfirmedFactsCount === 0 && blockedChecksCount === 0 && incompleteChecksCount === 0 && totalApplicableChecksCount > 0.
 */
export function computeUnitReadiness(
  facts: Record<string, Fact> = {},
  checklists: ChecklistInstance[] = []
): UnitReadiness {
  const factList = Object.values(facts || {});
  const unconfirmedFacts = factList.filter(isFactUnconfirmed);
  const unconfirmedFactsCount = unconfirmedFacts.length;

  const blockedRules = (checklists || []).filter(isChecklistBlocked);
  const blockedChecksCount = blockedRules.length;

  const applicableChecks = (checklists || []).filter(c => c.applicability === 'Applicable');
  const totalApplicableChecksCount = applicableChecks.length;

  const passedRules = applicableChecks.filter(c => c.status === 'Passed');
  const completedChecksCount = passedRules.length;

  const naRules = applicableChecks.filter(c => c.status === 'NA');
  const naChecksCount = naRules.length;

  const incompleteRules = applicableChecks.filter(isChecklistIncomplete);
  const incompleteChecksCount = incompleteRules.length;

  const totalChecksCount = (checklists || []).length;

  const percentComplete = totalApplicableChecksCount > 0
    ? Math.round((completedChecksCount / totalApplicableChecksCount) * 100)
    : 0;

  const isReadyForFinal = totalApplicableChecksCount > 0 &&
    unconfirmedFactsCount === 0 &&
    blockedChecksCount === 0 &&
    incompleteChecksCount === 0;

  // Build per-scope readiness map
  const scopeIds = Array.from(new Set((checklists || []).map(c => c.scopeTargetId)));
  const scopeReadinessMap: Record<string, ScopeReadiness> = {};
  scopeIds.forEach(scopeId => {
    scopeReadinessMap[scopeId] = computeScopeReadiness(checklists, scopeId);
  });

  return {
    unconfirmedFactsCount,
    blockedChecksCount,
    incompleteChecksCount,
    completedChecksCount,
    naChecksCount,
    totalApplicableChecksCount,
    totalChecksCount,
    percentComplete,
    isReadyForFinal,
    blockedRules,
    unconfirmedFacts,
    incompleteRules,
    passedRules,
    scopeReadinessMap
  };
}
```

---

## 4. Deterministic Calculation Rules & Invariants

| Metric | Calculation / Condition | Invariant Guarantee |
|---|---|---|
| `unconfirmedFactsCount` | `Object.values(facts).filter(f => f.status === 'Unknown' \|\| f.confidence === 'RequiresConfirmation').length` | Zero facts are excluded based on key name. Weights, COM#, detailer, options are all counted equally. |
| `blockedChecksCount` | `checklists.filter(c => c.applicability === 'NeedsInput').length` | Equals the exact count of checklist instances whose AST predicate requires an unconfirmed fact. |
| `completedChecksCount` | `checklists.filter(c => c.applicability === 'Applicable' && c.status === 'Passed').length` | Only applicable passed items are counted towards completion percentage. |
| `incompleteChecksCount` | `checklists.filter(c => c.applicability === 'Applicable' && c.status !== 'Passed' && c.status !== 'NA').length` | Captures all applicable rules in `Incomplete` or `Flagged` state. |
| `totalApplicableChecksCount` | `checklists.filter(c => c.applicability === 'Applicable').length` | Excludes `NotApplicable` and `NeedsInput` from denominator. |
| `percentComplete` | `totalApplicableChecksCount > 0 ? Math.round((completed / applicable) * 100) : 0` | Stable integer 0..100 without NaN. |
| `isReadyForFinal` | `unconfirmedFactsCount === 0 && blockedChecksCount === 0 && incompleteChecksCount === 0 && totalApplicableChecksCount > 0` | Strict gate for final deliverable export. If any item is pending/blocked/unconfirmed, `isReadyForFinal` is `false`. |

---

## 5. Component Consumption Blueprints

### 5.1 `App.tsx`
`App.tsx` maintains facts and checklists state. It calculates `readiness` using `useMemo` and passes it down to child components:

```tsx
import { computeUnitReadiness } from './utils/readiness';

// Inside AppContent component:
const readiness = useMemo(
  () => computeUnitReadiness(facts, checklists),
  [facts, checklists]
);

// Render Header:
<Header
  jobName={String(facts['unit.jobName']?.value || '')}
  comNumber={String(facts['unit.comNumber']?.value || '')}
  orderNumber={String(facts['unit.orderNumber']?.value || '')}
  unitTag={String(facts['unit.tag']?.value || '')}
  dimensions={graph.dimensions}
  facts={facts}
  readiness={readiness}
  ...
/>

// Render Sidebar:
<Sidebar
  activeTab={activeTab}
  onSelectTab={setActiveTab}
  graph={graph}
  checklists={checklists}
  sqItems={sqItems}
  readiness={readiness}
  ...
/>

// Render ResolutionCenterModal:
<ResolutionCenterModal
  isOpen={isResolutionOpen}
  onClose={() => setIsResolutionOpen(false)}
  facts={facts}
  checklists={checklists}
  readiness={readiness}
  onUpdateFact={handleUpdateFact}
  onBatchResolveDefaults={handleBatchResolveDefaults}
/>

// Render PreFlightModal:
<PreFlightModal
  isOpen={isPreFlightOpen}
  onClose={() => setIsPreFlightOpen(false)}
  checklists={checklists}
  rules={activeRules}
  facts={facts}
  sqItems={sqItems}
  readiness={readiness}
  onExportExcel={handleExportExcel}
  onExportDvl={handleSaveDvl}
  ...
/>
```

### 5.2 `Header.tsx`
Replace local filtered pending count with `readiness.unconfirmedFactsCount`:

```tsx
interface HeaderProps {
  // ... existing props
  readiness: UnitReadiness;
}

export const Header: React.FC<HeaderProps> = ({
  // ... props
  readiness,
  onOpenResolutionCenter
}) => {
  const { unconfirmedFactsCount, blockedChecksCount } = readiness;
  const totalPendingActionCount = unconfirmedFactsCount + blockedChecksCount;

  return (
    // ...
    {/* Resolution Center Button */}
    <button
      onClick={onOpenResolutionCenter}
      title={`Facts & Provenance Resolution Center (${unconfirmedFactsCount} pending facts, ${blockedChecksCount} blocked checks)`}
      className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        totalPendingActionCount > 0
          ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-800 dark:text-amber-300'
          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
      }`}
    >
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      <span className="hidden sm:inline">Facts</span>
      {totalPendingActionCount > 0 && (
        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-900 dark:text-amber-200 font-mono text-[10px] font-bold">
          {unconfirmedFactsCount}
        </span>
      )}
    </button>
  );
};
```

### 5.3 `Sidebar.tsx`
Consume `readiness` for grand total progress and per-scope progress:

```tsx
interface SidebarProps {
  // ... existing props
  readiness: UnitReadiness;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  graph,
  checklists,
  sqItems,
  isCollapsed,
  onToggleCollapse,
  readiness
}) => {
  if (!graph) return null;

  const unitReadiness = readiness.scopeReadinessMap['unit'] || computeScopeReadiness(checklists, 'unit');
  const overallPercent = readiness.percentComplete;
  const allPassed = readiness.completedChecksCount;
  const allApplicableCount = readiness.totalApplicableChecksCount;
  const allNeedsInput = readiness.blockedChecksCount;

  // In Overall Progress Card:
  // Render overallPercent, allPassed, allApplicableCount, allNeedsInput.

  // In Unit Verifications Button:
  // Render unitReadiness.completedChecksCount / unitReadiness.totalApplicableChecksCount.
  // Render unitReadiness.blockedChecksCount badge if > 0.

  // In Shipping Skids List:
  // For each skid:
  // const skidReadiness = readiness.scopeReadinessMap[skid.id] || computeScopeReadiness(checklists, skid.id);
  // Render skidReadiness.percentComplete, skidReadiness.blockedChecksCount, skidReadiness.completedChecksCount.
};
```

### 5.4 `ResolutionCenterModal.tsx`
Display both unconfirmed facts AND blocked checklist rules. Zero-state is strictly gated on both counts:

```tsx
interface ResolutionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: Record<string, Fact>;
  checklists?: ChecklistInstance[];
  readiness: UnitReadiness;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  onBatchResolveDefaults: () => void;
}

export const ResolutionCenterModal: React.FC<ResolutionCenterModalProps> = ({
  isOpen,
  onClose,
  facts,
  readiness,
  onUpdateFact,
  onBatchResolveDefaults
}) => {
  if (!isOpen) return null;

  const { unconfirmedFacts, blockedRules, unconfirmedFactsCount, blockedChecksCount } = readiness;
  const isFullyResolved = unconfirmedFactsCount === 0 && blockedChecksCount === 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Fact & Verification Resolution Center"
      subtitle="Confirm engineering parameters, regulatory certifications, and unblock verification rules."
      icon={<ShieldAlert className="w-5 h-5" />}
      maxWidth="3xl"
      // ...
    >
      <div className="space-y-6">
        {isFullyResolved ? (
          <div className="py-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed & Checks Unblocked!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              All engineering parameters are authoritative and zero verification rules are blocked awaiting input.
            </p>
          </div>
        ) : (
          <>
            {/* Quick Action Batch Resolve */}
            {unconfirmedFactsCount > 0 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/40">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Quick Action: Resolve standard factory defaults (Non-Seismic, Non-NOA, Factory Assembled)
                  </span>
                </div>
                <button
                  onClick={onBatchResolveDefaults}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  Approve Defaults
                </button>
              </div>
            )}

            {/* Section 1: Unconfirmed Domain Facts */}
            {unconfirmedFactsCount > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                  Pending Domain Facts ({unconfirmedFactsCount})
                </h5>
                <div className="space-y-3">
                  {unconfirmedFacts.map((fact) => (
                    // Render interactive fact row (COM#, Seismic, NOA, Knockdown, UTL, Weights, etc.)
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Blocked Verification Rules */}
            {blockedChecksCount > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider font-mono">
                    Blocked Verification Rules ({blockedChecksCount})
                  </h5>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  These rules cannot be evaluated until their dependent domain facts are resolved.
                </p>
                <div className="space-y-2">
                  {blockedRules.map((item) => (
                    <div key={item.instanceKey} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{item.ruleId}</span>
                        <span className="ml-2 font-mono text-slate-500">{item.instanceKey}</span>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">{item.applicabilityReason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
};
```

### 5.5 `PreFlightModal.tsx`
Directly consumes `readiness` for all metrics, lists, and export button state:

```tsx
interface PreFlightModalProps {
  // ...
  readiness: UnitReadiness;
  onExportExcel: (isDraft?: boolean) => void;
  onExportDvl: () => void;
  onNavigateToRule: (scopeTargetId: string, ruleId: string) => void;
  onOpenResolutionCenter: () => void;
}

export const PreFlightModal: React.FC<PreFlightModalProps> = ({
  isOpen,
  onClose,
  rules,
  sqItems,
  readiness,
  onExportExcel,
  onExportDvl,
  onNavigateToRule,
  onOpenResolutionCenter
}) => {
  if (!isOpen) return null;

  const {
    totalApplicableChecksCount,
    completedChecksCount,
    incompleteChecksCount,
    unconfirmedFactsCount,
    blockedChecksCount,
    isReadyForFinal,
    incompleteRules
  } = readiness;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Pre-Flight Verification Audit"
      subtitle="Auditing rule completion, special quotes table, and fact confirmations before deliverable export."
      icon={<ShieldCheck className="w-5 h-5" />}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Applicable Checks</div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{totalApplicableChecksCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Verified Checks</div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{completedChecksCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Pending Checks</div>
            <div className={`text-xl font-bold font-mono mt-1 ${incompleteChecksCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {incompleteChecksCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">SQs Populated</div>
            <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">{sqItems.length} / 22</div>
          </div>
        </div>

        {/* Incomplete Applicable Checks */}
        {incompleteChecksCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 font-mono">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Incomplete Applicable Verification Checks ({incompleteChecksCount}):
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {incompleteRules.map((inst) => {
                const rule = rules.find(r => r.id === inst.ruleId);
                return (
                  <button
                    key={inst.instanceKey}
                    onClick={() => {
                      onClose();
                      onNavigateToRule(inst.scopeTargetId, inst.ruleId);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-between text-xs transition-all group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{inst.ruleId}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                          {inst.scopeTargetId === 'unit' ? 'General Unit' : inst.scopeTargetId.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-1">{rule?.text}</p>
                    </div>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <span>Jump</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Facts & Blocked Checks Warning */}
        {(unconfirmedFactsCount > 0 || blockedChecksCount > 0) && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs text-amber-800 dark:text-amber-200">
                {unconfirmedFactsCount > 0 && `${unconfirmedFactsCount} domain facts require confirmation.`}
                {unconfirmedFactsCount > 0 && blockedChecksCount > 0 && ' • '}
                {blockedChecksCount > 0 && `${blockedChecksCount} verification checks are blocked awaiting fact confirmation.`}
              </span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenResolutionCenter();
              }}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Resolve Items
            </button>
          </div>
        )}

        {/* Export Actions */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-850 dark:to-slate-900 border border-slate-200 dark:border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Official Excel Deliverable
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Patches 'Detailing Verification List.xlsx' preserving all formulas and cell coordinates.
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => {
                onExportDvl();
                onClose();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Save .dvl</span>
            </button>

            <button
              onClick={() => {
                onExportExcel(!isReadyForFinal);
                onClose();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isReadyForFinal ? 'Export Final .xlsx' : 'Export Draft .xlsx'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
```

---

## 6. Automated Test Harness Strategy (`scripts/test_readiness.mjs`)

To ensure non-regression, we will establish an automated Node.js test script `scripts/test_readiness.mjs` verifying:
1. **Fact Status Invariants**:
   - `Unknown` or `RequiresConfirmation` facts are always counted in `unconfirmedFactsCount`.
   - Weights with `Unknown` or `RequiresConfirmation` are never ignored.
   - `ManuallyOverridden` and `Known`/`Derived` with `Authoritative` are counted as confirmed.
2. **Blocked Checklist Invariants**:
   - `applicability === 'NeedsInput'` correctly maps to `blockedChecksCount`.
3. **Completion & Readiness Gating**:
   - When all facts are confirmed and all applicable rules are `Passed` or `NA` -> `isReadyForFinal === true`.
   - When even 1 fact is unconfirmed -> `isReadyForFinal === false`.
   - When even 1 check is `NeedsInput` -> `isReadyForFinal === false`.
   - When even 1 applicable check is `Incomplete` -> `isReadyForFinal === false`.
4. **Scope Partitioning**:
   - The sum of `completedChecksCount` across all scopes equals the grand project `completedChecksCount`.
   - The sum of `blockedChecksCount` across all scopes equals the grand project `blockedChecksCount`.

---

## 7. File Action Plan for Implementer

1. **Create `src/utils/readiness.ts`**:
   - Export `UnitReadiness`, `ScopeReadiness`, `DomainFact`, `ChecklistItem`.
   - Export `computeUnitReadiness`, `computeScopeReadiness`, `isFactUnconfirmed`, `isChecklistBlocked`, `isChecklistPassed`, `isChecklistIncomplete`.
2. **Update `src/types/index.ts`**:
   - Add aliases `export type DomainFact = Fact;` and `export type ChecklistItem = ChecklistInstance;`.
   - Re-export or include `UnitReadiness` and `ScopeReadiness`.
3. **Update `src/App.tsx`**:
   - Import `computeUnitReadiness`.
   - Compute `readiness` with `useMemo`.
   - Pass `readiness` to `Header`, `Sidebar`, `ResolutionCenterModal`, `PreFlightModal`, `GeneralUnitTab`, `SkidViewTab`.
4. **Update `src/components/Header.tsx`**:
   - Consume `readiness.unconfirmedFactsCount` and `readiness.blockedChecksCount`.
   - Remove manual `!f.key.includes('weight')` filter.
5. **Update `src/components/Sidebar.tsx`**:
   - Consume `readiness` for grand progress bar and per-scope progress bars.
6. **Update `src/components/ResolutionCenterModal.tsx`**:
   - Consume `readiness.unconfirmedFacts`, `readiness.blockedRules`.
   - Show zero-state only when both counts are 0.
   - Render blocked rules list if `blockedChecksCount > 0`.
7. **Update `src/components/PreFlightModal.tsx`**:
   - Consume `readiness` for metrics grid, incomplete check list, blocked warning, and export button label.
8. **Create and Run `scripts/test_readiness.mjs`**:
   - Add live validation suite verifying readiness predicates and synchronization across all test cases.
