# Project: UI/UX Remediation & Live Validation Suite

## Architecture
The AHU Detailing Verification desktop application is an Electron/WebView2 + React 18 + TypeScript + Tailwind CSS desktop app backed by a .NET 8 C# verification engine and OpenXML spreadsheet deliverable patcher.

### Component & State Architecture
- **State Store**: React state in `App.tsx` coordinating facts registry (`Record<string, DomainFact>`), checklist items (`ChecklistItem[]`), unit metadata (`UnitInfo`), active tab navigation, and dialog modal states.
- **Readiness Logic**: Centralized in `src/utils/readiness.ts` exporting canonical `UnitReadiness` and `ScopeReadiness` interfaces and deterministic readiness predicates (`computeUnitReadiness`, `computeScopeReadiness`, `resolveFactForScope`).
- **Dialog System**: `src/components/common/ModalShell.tsx` and custom modal dialogs (`OmniSearchModal`, `ManualUnitModal`, `SettingsModal`, `PreFlightModal`, `ResolutionCenterModal`, `ProjectIdentityModal`, `ComNumberModal`, `DetailerNameModal`), implementing WAI-ARIA `role="dialog"`, `aria-modal="true"`, focus trapping (`useFocusTrap`), background inertness, and focus restoration to invoking elements.
- **File Ingestion Pipeline**: `HomePage.tsx` and `desktopBridge.ts`, providing explicit state machines (`idle` | `loading` | `error` | `success`), durable error banners, filename display, and desktop process launching (`launchRuleEditor`).
- **Formatting & Typography**: `src/utils/formatters.ts` providing domain formatters for enums (`StructuralSteel` -> `Structural Steel`), clean engineering terminology, and removal of LaTeX artifacts (`$N \ge 1$`).
- **Responsive Layout & Themes**: Responsive grid in `SkidViewTab.tsx` with priority description column, expandable row detail drawers, auto-collapsible sidebar below 1200px, and WCAG 2.2 AA certified color tokens.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Centralized Readiness Predicate | Single `computeUnitReadiness` / `useProjectReadiness` function calculating synchronized unconfirmed facts, blocked checks, completed checks | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Synchronized Header & Sidebar Badges | Header fact pill, sidebar badges, and resolution center all display identical pending counts and blocked states | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Resolution Center Fact Resolution | Resolution Center displays blocked checklist rules, handles all unconfirmed facts (including weights), and never shows "All Facts Confirmed!" when items are pending | M1 | ORIGINAL_REQUEST §R1 |
| 4 | PreFlight Modal Synchronized Gating | PreFlight summary cards and export buttons rely on the unified readiness predicate | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Instant Ctrl+K Focus & Selection | `Ctrl+K` omni-search immediately focuses and selects the search input, traps `Tab` focus, and restores focus on `Escape` | M2 | ORIGINAL_REQUEST §R2 |
| 6 | WAI-ARIA Modal Dialog Semantics | All modal shells render `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Modal Focus Trap & Restoration | Programmatic `Tab` / `Shift+Tab` focus trapping, backdrop inertness, and focus restoration upon dismissal | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Subtitle Text Auto-Wrapping | Remove `truncate max-w-[320px]` in `ModalShell` to prevent premature ellipsis clipping at desktop resolutions | M2 | ORIGINAL_REQUEST §R2 |
| 9 | ManualUnitModal Escape & Focus | Add `Escape` key dismissal and standard dialog focus semantics to `ManualUnitModal` | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Durable Import Error States & Banners | `HomePage` displays visible loading spinner and durable error banner with filename and recovery steps on XML/.upz ingestion errors | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Desktop Rule Editor Launch & Feedback | Add IPC action to desktop bridge for launching Rule Editor, with status toast/notifications on success or failure | M3 | ORIGINAL_REQUEST §R3 |
| 12 | LaTeX Math Formatting Removal | Eliminate `$N \ge 1$` in `ManualUnitModal` and replace with natural desktop wording ("one or more skids") | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Human-Readable Enum Formatters | Convert PascalCase enum tokens (`StructuralSteel`, `FormedChannel`, etc.) to natural title-cased labels | M4 | ORIGINAL_REQUEST §R4 |
| 14 | Leaked Internal Jargon Eradication | Clean up technical developer jargon ("normalized XML", "domain facts", "AST verification rules", "OpenXML deliverables", "Download .dvl") | M4 | ORIGINAL_REQUEST §R4 |
| 15 | De-cluttered Container Cards & Pills | Streamline nested cards, remove repetitive badge pills, and format list summaries cleanly | M4 | ORIGINAL_REQUEST §R4 |
| 16 | Responsive Sidebar Auto-Collapse | Sidebar automatically collapses to compact icon mode when window width is below 1200px | M5 | ORIGINAL_REQUEST §R5 |
| 17 | Priority Table Column Grid | Primary flex width for rule description, fixed status/action columns, eliminating horizontal scroll at 1086px | M5 | ORIGINAL_REQUEST §R5 |
| 18 | Expandable Row Metadata Drawers | Secondary metadata (provenance, comments, AST logic traces) moved into expandable row drawers | M5 | ORIGINAL_REQUEST §R5 |
| 19 | WCAG 2.2 AA Contrast Compliance | Uplift subdued text tokens (`text-slate-400`/`500`) to certified contrast ratios ($\ge 4.5:1$) in Light & Dark modes | M5 | ORIGINAL_REQUEST §R5 |
| 20 | Light Mode Modal Frame Cohesion | Unify light theme modal backdrops and containers to avoid dark frame bleed | M5 | ORIGINAL_REQUEST §R5 |
| 21 | Automated Live Validation Suite | Lightweight automated test harnesses for readiness predicates, copy/terminology linter, modal semantics, and build verification | Test Track | AGENTS.md / ORIGINAL_REQUEST |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Single Readiness Predicate & Fact Synchronization (R1) | `src/utils/readiness.ts`, `src/components/Header.tsx`, `src/components/Sidebar.tsx`, `src/components/ResolutionCenterModal.tsx`, `src/components/PreFlightModal.tsx`, `src/components/GeneralUnitTab.tsx`, `src/components/SkidViewTab.tsx` | none | DONE |
| M2 | Keyboard Speed & Accessible Dialog Focus Semantics (R2) | `src/hooks/useFocusTrap.ts`, `src/components/common/ModalShell.tsx`, `src/components/OmniSearchModal.tsx`, `src/components/ManualUnitModal.tsx`, `src/components/SettingsModal.tsx`, `src/components/ProjectIdentityModal.tsx`, `src/components/ComNumberModal.tsx`, `src/components/DetailerNameModal.tsx` | none | IN_PROGRESS |
| M3 | File Ingestion & Action Feedback (R3) | `src/components/HomePage.tsx`, `src/services/desktopBridge.ts`, `src/components/SettingsModal.tsx`, `src/App.tsx`, `BridgeHandler.cs` | none | PLANNED |
| M4 | User Copy & Typography Cleanup (R4) | `src/utils/formatters.ts`, `src/components/ManualUnitModal.tsx`, `src/components/HomePage.tsx`, `src/components/PreFlightModal.tsx`, `src/components/ResolutionCenterModal.tsx`, `src/components/SkidViewTab.tsx` | none | PLANNED |
| M5 | Responsive Column Layout & Theme Contrast Hardening (R5) | `src/components/SkidViewTab.tsx`, `src/components/Sidebar.tsx`, `src/styles/index.css`, Tailwind theme classes across components | M1, M4 | PLANNED |
| TEST | E2E & Live Validation Suite | `scripts/test_readiness.mjs`, `scripts/test_copy_linter.mjs`, `scripts/test_ast_converter.mjs`, `run-tests.bat`, integration checks | none | IN_PROGRESS |

---

## Interface Contracts

### 1. Readiness Service Contract (`src/utils/readiness.ts`)
```typescript
export interface UnitReadiness {
  unconfirmedFactsCount: number;
  blockedChecksCount: number;
  incompleteChecksCount: number;
  completedChecksCount: number;
  totalApplicableChecksCount: number;
  isReadyForFinal: boolean;
  blockedRules: ChecklistItem[];
  unconfirmedFacts: DomainFact[];
}

export function computeUnitReadiness(
  facts: Record<string, DomainFact>,
  checklists: ChecklistItem[]
): UnitReadiness;

export function computeScopeReadiness(
  facts: Record<string, DomainFact>,
  checklists: ChecklistItem[],
  scopeTargetId?: string
): ScopeReadiness;
```

### 2. Focus Trap Hook Contract (`src/hooks/useFocusTrap.ts`)
```typescript
export function useFocusTrap(
  isOpen: boolean,
  options?: {
    initialFocusRef?: React.RefObject<HTMLElement>;
    onEscape?: () => void;
    returnFocusRef?: React.RefObject<HTMLElement>;
  }
): React.RefObject<HTMLDivElement>;
```

### 3. Formatting Helper Contract (`src/utils/formatters.ts`)
```typescript
export function formatEnumLabel(enumValue: string): string;
export function sanitizeDomainText(text: string): string;
```

---

## Code Layout
- `src/utils/` — `readiness.ts`, `formatters.ts`
- `src/hooks/` — `useFocusTrap.ts`, `useMediaQuery.ts`
- `src/components/` — UI views, tabs, modals, header, sidebar
- `src/components/common/` — `ModalShell.tsx`, reusable UI primitives
- `src/services/` — `desktopBridge.ts`, `ruleEvaluator.ts`, `xmlParser.ts`
- `scripts/` — `build_rulepack.mjs`, `test_readiness.mjs`, `test_copy_linter.mjs`, `test_ast_converter.mjs`
- `tests/AHUVerification.Tests/` — C# xUnit test suite
