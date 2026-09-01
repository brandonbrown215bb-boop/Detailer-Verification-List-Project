# Milestone 1: UI Component Integration Strategy Report
**Subagent:** Explorer 2 (`explorer_m1_2`)  
**Milestone:** M1 (R1: Single Readiness Predicate & Fact Synchronization)  
**Date:** 2026-08-31  

---

## 1. Executive Summary

This report establishes the comprehensive UI component integration strategy for Milestone 1. It details the exact props interfaces, internal computation models, visual state machines, and bidirectional event flows for:
1. `src/components/Header.tsx`
2. `src/components/Sidebar.tsx`
3. `src/components/ResolutionCenterModal.tsx`
4. `src/components/PreFlightModal.tsx`
5. Scoped fact resolution in `src/components/SkidViewTab.tsx` and `src/components/InlineFactPopover.tsx`

### Core Principle: Zero Divergent Calculations
All UI surfaces must derive their badges, counts, and readiness states from the centralized readiness contract in `src/utils/readiness.ts` (`computeUnitReadiness` and `computeSkidReadiness`), completely eradicating isolated inline filters (such as `!f.key.includes('weight')`), partial status counts, and false success messages.

---

## 2. Root Cause Analysis of Existing Component Defects

| Component | Existing Defect | Root Cause | Impact |
|---|---|---|---|
| **Header.tsx** | Facts pill shows 0 when 15 checks are blocked or skid weights are unconfirmed | Inline filter `!f.key.includes('weight')` and absence of `checklists` prop; counts only domain facts, ignoring blocked rules. | Users see an empty or green Facts pill while the sidebar reports 15 inputs needed. |
| **Sidebar.tsx** | Counter badges show `15 input needed` but disregard unconfirmed domain facts; ignores `NA` checks in overall progress | Computes progress only from `c.status === 'Passed'`, omitting `c.status === 'NA'`; lacks `facts` prop to track domain fact completeness. | Detailers see skewed completion percentages (e.g. 80% when 100% of applicable items are verified/NA) and unaligned badge counts. |
| **ResolutionCenterModal.tsx** | False "All Facts Confirmed!" screen while 15 checklist items are blocked in `NeedsInput` | Displays success purely when `pendingFacts.length === 0` (which also excluded weight facts). Modal does not receive `checklists` or `rules`. | Fatal false-trust state: users believe the project is ready when rules are blocked. |
| **ResolutionCenterModal.tsx** | Cannot resolve skid weights or non-hardcoded domain facts | Missing UI controls for fact keys other than 5 hardcoded strings (`isSeismic`, `noa`, `knockdown`, `utl`, `comNumber`). | Users cannot resolve skid lifting weight facts (`BASE-01`) or general facts from the Resolution Center. |
| **PreFlightModal.tsx** | Redundant local calculation of `isReadyForFinal` with mismatched NA handling; unconfirmed facts banner disconnected from blocked rules | PreFlight recalculates predicate locally; ignores `Flagged` check states and lacks jump navigation for blocked (`NeedsInput`) checks. | Users cannot jump directly to blocked rules from PreFlight; export readiness gating diverges from Header/Sidebar. |
| **SkidViewTab.tsx** | Clicking "Approve Weight" creates orphan fact `facts['skid.weight']` instead of scoped `facts['skid.skid-1.weight']` | Passed `rule.requiredFacts[0]` (`'skid.weight'`) directly to `InlineFactPopover` without mapping to scoped skid key. | `BASE-01` remains permanently stuck in `NeedsInput` because the scoped fact was never updated. |

---

## 3. Component Integration Specifications

### 3.1 `src/components/Header.tsx`

#### 3.1.1 Updated Props Contract
```typescript
import { Fact, ChecklistInstance, ThemeMode } from '../types';
import { UnitReadiness } from '../utils/readiness';

export interface HeaderProps {
  jobName: string;
  comNumber: string;
  orderNumber?: string;
  unitTag?: string;
  dimensions?: { length: number; width: number; height: number };
  facts: Record<string, Fact>;
  checklists: ChecklistInstance[];
  readiness?: UnitReadiness; // Injected or computed via computeUnitReadiness(facts, checklists)
  onGoHome: () => void;
  onOpenResolutionCenter: () => void;
  onOpenPreFlight: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onLoadSample: () => void;
  onFileUpload: (file: File) => void;
  onSaveDvl: () => void;
  onSaveDvlAs: () => void;
  rulePackVersion: string;
  themeMode: ThemeMode;
  onCycleThemeMode: () => void;
  lastSavedAt?: string;
  hasUnsavedChanges?: boolean;
  onOpenProjectIdentityModal?: () => void;
  onOpenDetailerModal?: () => void;
  onOpenComModal?: () => void;
}
```

#### 3.1.2 State & Badge Logic
```typescript
// Header.tsx internal derivation
const unitReadiness = readiness || computeUnitReadiness(facts, checklists);
const { unconfirmedFactsCount, blockedChecksCount, isReadyForFinal } = unitReadiness;
const totalAttentionNeeded = unconfirmedFactsCount + blockedChecksCount;
```

#### 3.1.3 UI Render Specification
```tsx
{/* Facts & Resolution Center Trigger */}
<button
  onClick={onOpenResolutionCenter}
  title={
    totalAttentionNeeded > 0
      ? `${unconfirmedFactsCount} unconfirmed facts, ${blockedChecksCount} blocked checks`
      : 'All facts and checks confirmed authoritative'
  }
  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
    totalAttentionNeeded > 0
      ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-800 dark:text-amber-300'
      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
  }`}
>
  {totalAttentionNeeded > 0 ? (
    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
  ) : (
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
  )}
  <span className="hidden sm:inline">Facts</span>
  {totalAttentionNeeded > 0 && (
    <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-900 dark:text-amber-200 font-mono text-[10px] font-bold">
      {totalAttentionNeeded}
    </span>
  )}
</button>
```

---

### 3.2 `src/components/Sidebar.tsx`

#### 3.2.1 Updated Props Contract
```typescript
import { NormalizedXmlGraph, Fact, ChecklistInstance, SpecialQuote } from '../types';
import { UnitReadiness } from '../utils/readiness';

export interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  graph: NormalizedXmlGraph | null;
  facts: Record<string, Fact>;
  checklists: ChecklistInstance[];
  sqItems: SpecialQuote[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  readiness?: UnitReadiness;
}
```

#### 3.2.2 Progress & Badge Computations
```typescript
// Global readiness
const unitReadiness = readiness || computeUnitReadiness(facts, checklists);
const {
  totalApplicableChecksCount,
  completedChecksCount,
  blockedChecksCount,
  unconfirmedFactsCount,
  incompleteChecksCount
} = unitReadiness;

const overallPercent = totalApplicableChecksCount > 0
  ? Math.round((completedChecksCount / totalApplicableChecksCount) * 100)
  : 0;

// Per-Skid / Tab helper
function getTabReadiness(tabId: string) {
  return computeSkidReadiness(tabId, facts, checklists);
}
```

#### 3.2.3 UI Render Specification
1. **Overall Progress Card (Expanded):**
```tsx
<div className="mx-3 mt-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1.5">
  <div className="flex items-center justify-between text-xs font-semibold">
    <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
      <Activity className="w-3.5 h-3.5 text-blue-500" />
      Overall Progress
    </span>
    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
      {overallPercent}%
    </span>
  </div>
  <div className="w-full bg-slate-200 dark:bg-slate-750 h-2 rounded-full overflow-hidden">
    <div
      className={`h-full transition-all duration-300 ${
        overallPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-500'
      }`}
      style={{ width: `${overallPercent}%` }}
    />
  </div>
  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
    <span>{completedChecksCount} / {totalApplicableChecksCount} Verified</span>
    {blockedChecksCount > 0 ? (
      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5" title={`${blockedChecksCount} rules blocked by missing facts`}>
        <AlertTriangle className="w-2.5 h-2.5" />
        {blockedChecksCount} input needed
      </span>
    ) : unconfirmedFactsCount > 0 ? (
      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5" title={`${unconfirmedFactsCount} domain facts require confirmation`}>
        <AlertTriangle className="w-2.5 h-2.5" />
        {unconfirmedFactsCount} facts pending
      </span>
    ) : null}
  </div>
</div>
```

2. **Per-Skid Navigation Item:**
```tsx
{graph.skids.map((skid) => {
  const skidReadiness = getTabReadiness(skid.id);
  const isSelected = activeTab === skid.id;

  return (
    <button
      key={skid.id}
      onClick={() => onSelectTab(skid.id)}
      className={`w-full flex flex-col rounded-xl text-left transition-all relative ${
        isCollapsed ? 'p-2.5 items-center justify-center' : 'px-3.5 py-3'
      } ${
        isSelected
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <Box className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            {skidReadiness.blockedChecksCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
            {skidReadiness.percentComplete === 100 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </div>
          <span className="text-[10px] font-mono font-bold leading-none">{skid.index}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 font-semibold text-sm">
              <Box className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className="whitespace-nowrap">{skid.name}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {skidReadiness.blockedChecksCount > 0 && (
                <span
                  title={`${skidReadiness.blockedChecksCount} checks need fact confirmation`}
                  className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold whitespace-nowrap ${
                    isSelected ? 'bg-amber-400/30 text-amber-100' : 'bg-amber-500/25 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {skidReadiness.blockedChecksCount}
                </span>
              )}
              {skidReadiness.percentComplete === 100 && (
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-green-200' : 'text-green-500'}`} />
              )}
              <span className="text-xs font-mono opacity-90 whitespace-nowrap">{skidReadiness.percentComplete}%</span>
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="w-full bg-slate-200 dark:bg-black/30 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-300 ${
                skidReadiness.percentComplete === 100 ? 'bg-emerald-500' : isSelected ? 'bg-white' : 'bg-blue-600 dark:bg-blue-500'
              }`}
              style={{ width: `${skidReadiness.percentComplete}%` }}
            />
          </div>
        </>
      )}
    </button>
  );
})}
```

---

### 3.3 `src/components/ResolutionCenterModal.tsx`

#### 3.3.1 Updated Props Contract
```typescript
import { Fact, ChecklistInstance, RuleDefinition } from '../types';
import { UnitReadiness } from '../utils/readiness';

export interface ResolutionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: Record<string, Fact>;
  checklists: ChecklistInstance[];
  rules: RuleDefinition[];
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  onBatchResolveDefaults: () => void;
  onNavigateToRule?: (scopeTargetId: string, ruleId: string) => void;
  readiness?: UnitReadiness;
}
```

#### 3.3.2 Internal State & Tab Structure
- **Active Section State:** `'facts'` | `'blocked-rules'`
- **Filter for Unconfirmed Facts:**
  ```typescript
  // INCLUDES ALL domain facts, including skid weights and bases
  const pendingFacts = Object.values(facts).filter(
    f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
  );
  const blockedRules = checklists.filter(c => c.applicability === 'NeedsInput');
  ```

#### 3.3.3 Adaptive Fact Resolver Engine
The modal must render purpose-built resolution UI for every domain fact type:

1. **Skid Weight Facts (`skid.<skidId>.weight`):**
   ```tsx
   <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
     <button
       onClick={() => onUpdateFact(fact.key, fact.value, 'Detailer', 'Approved Calculated Skid Weight')}
       className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
     >
       <Scale className="w-3.5 h-3.5" />
       <span>Approve Calculated ({Number(fact.value).toLocaleString()} lbs)</span>
     </button>
     <div className="flex items-center gap-1">
       <input
         type="number"
         placeholder="Custom lbs..."
         onKeyDown={(e) => {
           if (e.key === 'Enter') {
             const val = Number((e.target as HTMLInputElement).value);
             if (val > 0) onUpdateFact(fact.key, val, 'Detailer', 'Authoritative Scale Weight');
           }
         }}
         className="w-28 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
       />
     </div>
   </div>
   ```

2. **Standard Certifications & Options (`unit.isSeismic`, `unit.noa`, `unit.knockdown`, `unit.utl`, `unit.comNumber`):**
   - Quick action binary toggle pills (Standard Non-Seismic vs Seismic Certified, Standard vs NOA, etc.).

3. **Generic / Fallback Fact Resolver:**
   - Any unknown domain fact not explicitly enumerated receives a clean text/number input and inline confirmation button so no fact ever falls through unresolvable.

#### 3.3.4 Blocked Rules Section & False Success Elimination
```tsx
{/* ZERO STATE / SUCCESS STATE DISCRIMINATION */}
{pendingFacts.length === 0 && blockedRules.length === 0 ? (
  <div className="py-12 text-center space-y-3">
    <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
    <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts & Rules Confirmed!</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
      All engineering parameters, order identity values, and verification rules are authoritative and unblocked.
    </p>
  </div>
) : pendingFacts.length === 0 && blockedRules.length > 0 ? (
  <div className="space-y-4">
    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs text-amber-800 dark:text-amber-200 font-medium">
          All domain facts are confirmed, but {blockedRules.length} verification checks require input.
        </span>
      </div>
    </div>

    {/* List Blocked Rules */}
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {blockedRules.map(inst => {
        const ruleDef = rules.find(r => r.id === inst.ruleId);
        return (
          <div key={inst.instanceKey} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">{inst.ruleId}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">{inst.scopeTargetId}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{ruleDef?.text}</p>
              <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400 mt-0.5">{inst.applicabilityReason}</p>
            </div>
            {onNavigateToRule && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToRule(inst.scopeTargetId, inst.ruleId);
                }}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0"
              >
                Jump
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
) : (
  /* Render Pending Facts List + Batch Resolve */
  <div className="space-y-4">
    {/* Batch Resolve Helper */}
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/40">
      <div className="flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Quick Action: Resolve with Standard Factory Defaults
        </span>
      </div>
      <button
        onClick={onBatchResolveDefaults}
        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
      >
        Approve All Defaults
      </button>
    </div>

    {/* Pending Facts Cards */}
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {pendingFacts.map(fact => (
        <div key={fact.key} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-3">
          {/* Fact Details & Resolvers */}
        </div>
      ))}
    </div>
  </div>
)}
```

---

### 3.4 `src/components/PreFlightModal.tsx`

#### 3.4.1 Updated Props Contract
```typescript
import { ChecklistInstance, RuleDefinition, Fact, SpecialQuote } from '../types';
import { UnitReadiness } from '../utils/readiness';

export interface PreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklists: ChecklistInstance[];
  rules: RuleDefinition[];
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  onExportExcel: (isDraft?: boolean) => void;
  onExportDvl: () => void;
  onNavigateToRule: (scopeTargetId: string, ruleId: string) => void;
  onOpenResolutionCenter: () => void;
  readiness?: UnitReadiness;
}
```

#### 3.4.2 Predicate & Metrics Alignment
```typescript
const unitReadiness = readiness || computeUnitReadiness(facts, checklists);
const {
  totalApplicableChecksCount,
  completedChecksCount,
  incompleteChecksCount,
  blockedChecksCount,
  unconfirmedFactsCount,
  isReadyForFinal
} = unitReadiness;
```

#### 3.4.3 UI Metrics & Action Gating
1. **Metrics Tiles:**
   - Applicable Checks: `{totalApplicableChecksCount}`
   - Verified / Completed: `{completedChecksCount}`
   - Incomplete / Flagged: `{incompleteChecksCount}`
   - Blocked / Unconfirmed Facts: `{blockedChecksCount + unconfirmedFactsCount}`

2. **Blocked Checks & Unconfirmed Facts Section:**
   - If `blockedChecksCount > 0`: Display interactive jump list for all blocked checklist items.
   - If `unconfirmedFactsCount > 0`: Display "Resolve Facts" button linking directly to `onOpenResolutionCenter()`.

3. **Export Deliverable Buttons:**
   - Save Project: `Save Project (.dvl)` (renamed from "Download .dvl").
   - Export Deliverable:
     - When `isReadyForFinal === true`: `<FileSpreadsheet className="w-4 h-4" /> Export Final .xlsx` (Emerald background, full release authorization).
     - When `isReadyForFinal === false`: `<FileSpreadsheet className="w-4 h-4" /> Export Draft .xlsx` (With warning badge explaining remaining blockers).

---

### 3.5 Scoped Fact Resolution in `SkidViewTab.tsx`

#### 3.5.1 The Scoped Key Mapping Defect
In `SkidViewTab.tsx`, rules scoped to a skid (such as `BASE-01`) reference generic fact keys like `'skid.weight'`. However, `facts` stores them indexed by skid ID: `'skid.skid-1.weight'`.

#### 3.5.2 Resolution Helper Implementation
```typescript
export function resolveFactForScope(
  facts: Record<string, Fact>,
  factKey: string,
  scopeTargetId: string
): { resolvedKey: string; fact: Fact | undefined } {
  if (scopeTargetId !== 'unit' && factKey.startsWith('skid.')) {
    const scopedKey = `skid.${scopeTargetId}.${factKey.slice(5)}`;
    if (facts[scopedKey]) {
      return { resolvedKey: scopedKey, fact: facts[scopedKey] };
    }
  }
  return { resolvedKey: factKey, fact: facts[factKey] };
}
```

#### 3.5.3 Inline Fact Popover Integration in Skid Table
```tsx
{instance.applicability === 'NeedsInput' && (
  <div className="flex justify-center">
    {(() => {
      const firstReq = rule.requiredFacts[0] || 'unknown';
      const { resolvedKey, fact } = resolveFactForScope(facts, firstReq, skid.id);
      return (
        <InlineFactPopover
          factKey={resolvedKey}
          fact={fact}
          label={fact?.label || rule.text}
          onUpdateFact={onUpdateFact}
          triggerButtonText="Needs Input"
          compact={true}
        />
      );
    })()}
  </div>
)}
```

---

## 4. State Flow & Synchronization Diagram

```
                       ┌──────────────────────────────────────────────┐
                       │                   App.tsx                    │
                       │ facts, checklists, graph, activeRules, SQs   │
                       └──────────────────────┬───────────────────────┘
                                              │
                      computeUnitReadiness(facts, checklists)
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │                UnitReadiness                 │
                       │ • unconfirmedFactsCount                      │
                       │ • blockedChecksCount                         │
                       │ • completedChecksCount                       │
                       │ • incompleteChecksCount                      │
                       │ • isReadyForFinal                            │
                       └──────┬───────────────┬──────────────┬────────┘
                              │               │              │
         ┌────────────────────┼───────────────┼──────────────┼──────────────────┐
         ▼                    ▼               ▼              ▼                  ▼
┌──────────────────┐ ┌────────────────┐ ┌──────────┐ ┌───────────────────┐ ┌───────────────┐
│    Header.tsx    │ │  Sidebar.tsx   │ │ SkidTab  │ │ ResolutionCenter  │ │ PreFlightModal│
│                  │ │                │ │          │ │                   │ │               │
│ Facts Pill Badge │ │ Progress Bar & │ │ Scoped   │ │ Resolves ALL facts│ │ Gated Final   │
│ Shows combined   │ │ per-skid       │ │ skid     │ │ & blocked rules;  │ │ vs Draft      │
│ pending count    │ │ warning badges │ │ facts    │ │ no false success  │ │ export        │
└──────────────────┘ └────────────────┘ └──────────┘ └───────────────────┘ └───────────────┘
```

---

## 5. Verification & Acceptance Criteria

### Independent Verification Steps
1. **Fact Confirmation Test:**
   - Ingest `SAMPLE_CONFIG_XML`.
   - Open Facts Resolution Center. Confirm unconfirmed facts (e.g. COM#, detailer name, skid weights).
   - Verify that Header facts pill decreases in lockstep with Sidebar warning counters and PreFlight pending counts.
2. **Blocked Checklist Item Test:**
   - Set a required fact (e.g., `skid.skid-1.weight`) to unconfirmed.
   - Verify `BASE-01` enters `NeedsInput` state.
   - Check that `Header` facts pill, `Sidebar` Skid 1 badge, `ResolutionCenterModal`, and `PreFlightModal` all report exactly 1 blocked check / pending fact.
   - Click "Approve Calculated Weight" inside `SkidViewTab` or `ResolutionCenterModal`.
   - Verify `BASE-01` immediately transitions to `Applicable`, and all badges update to 0 pending.
3. **False Success Elimination Test:**
   - Ingest an XML where all domain facts are known but 2 rules remain in `NeedsInput`.
   - Open Resolution Center.
   - Verify that the modal does NOT display "All Facts Confirmed!", but instead renders the list of 2 blocked checklist rules with Jump buttons.
4. **PreFlight Export Gating Test:**
   - When any fact or check is pending, export button must render "Export Draft .xlsx".
   - When all facts are confirmed and all applicable checks are verified/NA, export button must render "Export Final .xlsx".

---
*Report formulated and delivered by Explorer 2.*
