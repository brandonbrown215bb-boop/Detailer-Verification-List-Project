# Frontend Codebase Survey & Remediation Architecture

**Author:** Frontend Codebase Explorer  
**Date:** 2026-08-31 / 2026-09-01  
**Project:** AHU Detailing Verification Desktop Application  
**Repository:** `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project`  
**Target File:** `.agents\explorer_survey_2\survey_frontend.md`  

---

## 1. Executive Overview & Codebase Architecture

The AHU Detailing Verification frontend is a single-page React 18 + TypeScript + Tailwind CSS application engineered to run inside a Microsoft Edge WebView2 desktop host (Windows Forms C# host in `src/backend/AHUVerification.App/`) as well as in standard web preview mode.

### 1.1 Core Frontend File Hierarchy

```
src/
├── App.tsx                     # Top-level workspace controller, state store, global shortcuts, notifications
├── index.css                   # Global Tailwind layer rules, scrollbar styling, base body colors
├── main.tsx                    # React DOM root entry point
├── components/
│   ├── HomePage.tsx            # Landing & file ingestion view (Autosave resume, Drag&Drop, FilePicker, Presets)
│   ├── Header.tsx              # Top app bar (Job name, dimensions, COM#, Detailer, Search, Facts pill, Export)
│   ├── Sidebar.tsx             # Left rail (Progress bar, Unit specs link, Unit checks, Shipping skids, SQs)
│   ├── GeneralUnitTab.tsx      # Main specs view (Active features, casing specs, materials table, SQ editor, comments)
│   ├── SkidViewTab.tsx         # Skid verification grid (Skid summary, segments, filters, grouped rule tables, expandable rows)
│   ├── SegmentMaterialsTable.tsx # Segment casing & gauge summary / matrix view
│   ├── InlineFactPopover.tsx   # Popover trigger to resolve/confirm individual facts inline
│   ├── OmniSearchModal.tsx     # Global fuzzy search modal (Ctrl+K)
│   ├── PreFlightModal.tsx      # Export verification audit dialog (Applicable/passed/incomplete checks, jump links, XLSX export)
│   ├── ResolutionCenterModal.tsx # Facts & Provenance resolution center dialog (Pending facts list, batch approve defaults)
│   ├── SettingsModal.tsx       # Preferences dialog (Theme, Detailer profile, Central rule pack sync, Export path, Reset)
│   ├── ProjectIdentityModal.tsx # Project metadata dialog (Job Name, COM#, Order#, Unit Tag, Date, Detailer)
│   ├── ComNumberModal.tsx      # Fast COM# capture dialog prompted on startup
│   ├── DetailerNameModal.tsx   # Fast Detailer signature capture dialog prompted on first launch
│   └── common/
│       └── ModalShell.tsx      # Base modal container wrapper
├── services/
│   ├── desktopBridge.ts        # WebView2 window.chrome.webview IPC bridge client
│   ├── excelExporter.ts        # Browser SheetJS fallback deliverable exporter
│   ├── factRegistry.ts         # Fact extraction, override history, reversion, status typing
│   ├── manualUnitFactory.ts    # Manual 4-step wizard unit geometry & rule checklist synthesizer
│   ├── projectStorage.ts       # .dvl project serializer, SHA-256 integrity inspection, localStorage autosave
│   ├── ruleEvaluator.ts        # AST predicate evaluator & checklist instance generator
│   ├── rulesCatalog.ts         # Bundled baseline rules and rule pack identity
│   └── xmlParser.ts            # MOM Config.xml & OrderRevision XML DOM parsers
├── types/
│   └── index.ts                # TypeScript interface definitions (Fact, RuleDefinition, ChecklistInstance, NormalizedXmlGraph, etc.)
└── ruleEditor/                 # Standalone Rule & Logic Editor App (Vite multi-page entry: rule-editor.html)
```

---

## 2. Investigation Area 1: Facts, Shell Warnings & Readiness Synchronization

### 2.1 Fact Definition and Extraction Lifecycle (`src/services/factRegistry.ts`)

Facts represent the single source of truth for all unit specifications, regulatory classifications, casing gauges, and skid parameters.
- **`FactStatus`**: `'Known' | 'Derived' | 'Unknown' | 'ManuallyOverridden'`
- **`FactConfidence`**: `'Authoritative' | 'RequiresConfirmation'`

When an XML or UPZ file is loaded:
1. `extractFactsFromGraph(graph, orderRev)` constructs 60+ domain facts across 6 categories:
   - *Order & Identity*: `unit.jobName`, `unit.comNumber` (default: `Unknown` / `RequiresConfirmation`), `unit.orderNumber`, `unit.tag`, `unit.productType`, `unit.detailer`, `unit.date`
   - *Baserail & Skid*: `unit.baseHeight`, `unit.curbrest`, `unit.lipHeight`, `unit.hasUTL`, `unit.isTiered`, `unit.isStacked`, `unit.hasFloorDrains`, per-base facts (`base.{id}.height`, `base.{id}.lipHeight`, `base.{id}.subFloorMaterial`, etc.)
   - *Housing & Materials*: `unit.shellType`, `unit.unitType`, `unit.thermalBreak`, `unit.knockdown`, `unit.shippingProtection`, `casing.thicknessFront`, `casing.exteriorMaterial`, `casing.exteriorGauge`, `casing.interiorMaterial`, `casing.interiorGauge`, `casing.floorMaterial`, `casing.floorGauge`, `casing.insulationType`, `roof.hasSlopedRoof`, `roof.roofPeak`, `roof.roofSlope`
   - *Opening Schedule*: `opening.totalCount`, `door.totalCount`, `damper.totalCount`, `floorDrain.totalCount`, and per-component facts (`door.{id}.*`, `damper.{id}.*`, `floorDrain.{id}.*`)
   - *Component Sub-Trees*: `fan.{id}.*`, `coil.{id}.*`, `filter.{id}.*`, `wheel.{id}.*`, `motorControl.{id}.*`
   - *Ratings & Quality*: `unit.isSeismic`, `unit.noa`, `unit.deflectionTest`, `unit.totalWeight`, `unit.totalStaticPressure`, and per-skid facts (`skid.{id}.weight`, `skid.{id}.segmentCount`, `skid.{id}.hasDrainPan`, `skid.{id}.hasFans`, `skid.{id}.hasCoils`, `skid.{id}.hasFilters`, `skid.{id}.hasHeatWheel`, `skid.{id}.hasSubFloor`, `skid.{id}.floorDrainCount`)

### 2.2 AST Rule Evaluation Lifecycle (`src/services/ruleEvaluator.ts`)

Every `RuleDefinition` defines:
- `requiredFacts: string[]`
- `predicate?: ASTPredicate` (supporting `>`, `<`, `>=`, `<=`, `===`, `!==`, `includes`, `in`, `and`, `or`)

In `evaluateAstPredicate`:
- If any fact in `rule.requiredFacts` is missing, or has `fact.status === 'Unknown'`, or has `fact.confidence === 'RequiresConfirmation'`, the evaluator returns:
  `{ result: false, needsInput: true, trace: "Required fact '...' requires confirmation or is unknown" }`
- This sets `instance.applicability = 'NeedsInput'`.
- If all required facts are authoritative and known, it evaluates the AST expression to assign `Applicable` (status: `Incomplete` or preserved) or `NotApplicable` (status: `NA`).

### 2.3 Consumption Across Frontend Surfaces (The Root Cause of Discrepancy)

The table below contrasts the conflicting predicates currently implemented in each component:

| Component | State / Metric Computed | Implementation Logic | Identified Flaw / Conflict |
|---|---|---|---|
| **`Header.tsx`** (Line 75) | Facts Pill Count & Warning Color | `Object.values(facts).filter(f => (f.status === 'Unknown' \|\| f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')).length` | Excludes `weight` facts; does not count blocked `NeedsInput` checklist items; displays a simple number that disagrees with the Sidebar. |
| **`Sidebar.tsx`** (Line 38-48) | Grand Total & Skid Progress | `checklists.filter(c => c.applicability === 'NeedsInput').length` and `allPassed / allApplicable.length` | Only counts checklist instances with `NeedsInput`; does not count unconfirmed domain facts that aren't tied to an active rule; skid warning badge only triggers if `needsInput > 0`. |
| **`ResolutionCenterModal.tsx`** (Line 28, 53) | Pending Facts List & "All Facts Confirmed!" | `const pendingFacts = Object.values(facts).filter(f => (f.status === 'Unknown' \|\| f.confidence === 'RequiresConfirmation') && !f.key.includes('weight'));` <br/> Success state triggered when `pendingFacts.length === 0`. | **PRIMARY BUG (Finding 1)**: If a project has 0 unconfirmed domain facts (or all 5 specific hardcoded fact cards are dismissed), it renders **"All Facts Confirmed! All engineering parameters and order identity values are populated with authoritative status"** even if 15 verification checklist checks remain in `NeedsInput` or `Incomplete`, or if skid weights are unconfirmed. |
| **`PreFlightModal.tsx`** (Line 40-52) | Export Readiness & Final vs Draft | `incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0` where `pendingFacts` **includes** weight facts (`f.status === 'Unknown' \|\| f.confidence === 'RequiresConfirmation'`). | PreFlight uses the strictest predicate (including weight facts). Because Header and Resolution Center exclude weight facts, PreFlight can report pending facts when Header says 0 facts pending. |
| **`GeneralUnitTab.tsx`** (Line 85, 206) | Inline Popovers & Feature Badges | Checks `fact.confidence === 'RequiresConfirmation' \|\| fact.status === 'Unknown'` to display `<InlineFactPopover>` | Isolated to individual field controls; does not reflect aggregate unit readiness. |
| **`SkidViewTab.tsx`** (Line 149-153, 273) | Skid Filter & Group Warnings | `needsInputCount = skidChecklists.filter(c => c.applicability === 'NeedsInput').length;` | Counts checklist items in `NeedsInput`, but does not show unconfirmed skid-level facts (e.g. `skid.{id}.weight`) if the rule predicate did not evaluate them. |

### 2.4 Unified Readiness Predicate Architecture

To resolve Finding 1 and satisfy Requirement R1, the application must compute and export a single synchronized readiness model:

```typescript
export interface ProjectReadinessSummary {
  // 1. Unconfirmed Domain Facts (Facts requiring detailer input or confirmation)
  unconfirmedFacts: Fact[];
  unconfirmedFactsCount: number;

  // 2. Verification Checks Blocked by Facts (Checklist items in NeedsInput state)
  blockedChecklists: ChecklistInstance[];
  blockedChecklistsCount: number;

  // 3. Verification Progress (Applicable checklist items)
  applicableChecklists: ChecklistInstance[];
  applicableCount: number;
  passedCount: number;
  incompleteCount: number;
  completionPercentage: number;

  // 4. Single Unified Truth Predicate
  isReadyForFinalExport: boolean;
  hasBlockingIssues: boolean;
}
```

Every surface (`Header`, `Sidebar`, `ResolutionCenterModal`, `PreFlightModal`, `GeneralUnitTab`, `SkidViewTab`) must consume this shared hook/selector (`useProjectReadiness(facts, checklists)`), ensuring:
1. "All Facts Confirmed" is **only** displayed when `unconfirmedFactsCount === 0 && blockedChecklistsCount === 0`.
2. Header pill, Sidebar warnings, and Preflight modal display the exact same numeric badges for pending facts and blocked checks.

---

## 3. Investigation Area 2: Modal Architecture, Focus Management & Accessibility

### 3.1 Inventory of Modal Dialogs

There are **9 modal surfaces** in the application:

| Modal Component | File Location | Wraps `ModalShell`? | Key Missing Accessibility / Behavior |
|---|---|---|---|
| `ModalShell` | `src/components/common/ModalShell.tsx` | Base Container | Missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, focus trap, focus restoration, subtitle truncation (`max-w-[320px] truncate`). |
| `OmniSearchModal` | `src/components/OmniSearchModal.tsx` | ❌ Custom overlay | Missing `role="dialog"`, `aria-modal="true"`; `setTimeout(50ms)` focus does not call `.select()`; Tab escapes modal into root document; does not restore focus on Esc. |
| `ManualUnitModal` | `src/components/ManualUnitModal.tsx` | ❌ Custom overlay | Missing `role="dialog"`, `aria-modal="true"`; no `Escape` key handler; no focus trapping; background document remains interactive. |
| `SettingsModal` | `src/components/SettingsModal.tsx` | ✅ Uses `ModalShell` | Nested scroll areas; launch link `<a target="_blank">` lacks desktop IPC feedback. |
| `PreFlightModal` | `src/components/PreFlightModal.tsx` | ✅ Uses `ModalShell` | Jump links navigate behind modal before closing; needs smooth focus transition. |
| `ProjectIdentityModal` | `src/components/ProjectIdentityModal.tsx` | ✅ Uses `ModalShell` | Tab from last field exits to root document; no autofocus on first input. |
| `ComNumberModal` | `src/components/ComNumberModal.tsx` | ✅ Uses `ModalShell` | Focus not restored to trigger upon dismissal. |
| `DetailerNameModal` | `src/components/DetailerNameModal.tsx` | ✅ Uses `ModalShell` | First launch prompt can leave UI Automation focus unanchored. |
| `ResolutionCenterModal` | `src/components/ResolutionCenterModal.tsx` | ✅ Uses `ModalShell` | Missing keyboard shortcuts between fact resolution cards. |

### 3.2 Keyboard Speed & `Ctrl+K` Global Search

In `src/App.tsx`:
```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
  e.preventDefault();
  setIsSearchOpen(prev => !prev);
}
```
In `src/components/OmniSearchModal.tsx`:
```typescript
useEffect(() => {
  if (isOpen) {
    setTimeout(() => inputRef.current?.focus(), 50);
  } else {
    setQuery('');
  }
}, [isOpen]);
```

**Flaws Identified (Finding 2):**
1. The 50ms `setTimeout` fails when the WebView2 host processes keyboard focus asynchronously or when re-renders occur, leaving focus on `document.body`.
2. The search input is not selected (`inputRef.current?.select()`), so any existing text requires manual deletion.
3. No focus trap exists: pressing `Tab` inside the search dialog immediately tabs into elements behind the backdrop (e.g. sidebar or table check boxes).
4. On `Escape` or dismissal, focus is lost rather than restored to the button or table cell that had focus when `Ctrl+K` was pressed.

### 3.3 Accessible Modal Implementation Plan

`ModalShell.tsx` and custom modals must be upgraded with:
1. **Semantic ARIA Attributes**:
   - `role="dialog"`
   - `aria-modal="true"`
   - `aria-labelledby={titleId}`
   - `aria-describedby={subtitleId}`
2. **Programmatic Focus Trapping**:
   - Query all focusable elements (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`)
   - Intercept `Tab` and `Shift+Tab`: when on last element, wrap to first; when on first with Shift, wrap to last.
3. **Focus Anchor & Restoration**:
   - Record `previousActiveElement = document.activeElement as HTMLElement` on mount.
   - On unmount / close, invoke `previousActiveElement?.focus()`.
4. **Immediate Focus & Selection**:
   - Auto-focus the designated primary input or first focusable element on open using `requestAnimationFrame` / synchronous focus.
5. **Subtitle Wrapping**:
   - Remove `max-w-[320px] truncate` in `ModalShell.tsx` (line 60) and allow natural multi-line wrapping with clean secondary text styling.

---

## 4. Investigation Area 3: File Ingestion & Desktop External Actions

### 4.1 Ingestion Flow for `Config.xml`, `.upz`, and `.dvl` (`src/components/HomePage.tsx`)

`HomePage.tsx` supports three entry mechanisms:
1. **Drag & Drop** (`handleDrop` -> `processFile`)
2. **Hidden `<input type="file">`** (`handleFileInputChange` -> `processFile`)
3. **Native Desktop File Dialog** (`handleNativeOpen` -> `desktopBridge.openFileDialog()`)

**Flaws Identified (Finding 4):**
1. **Silent Reset / Absence of Feedback**:
   - If `desktopBridge.openFileDialog()` returns `null` (e.g., user opened a file that failed parsing in C# bridge or returned an error), `handleNativeOpen` does nothing and returns silently to Home.
   - If `parseAhuXml(text)` throws an error during `loadXmlData`, `App.tsx` calls `alert(...)`. If the browser/WebView2 suppresses alerts or the detailer dismisses it, Home remains unchanged without an error banner, filename display, error code, or corrective guidance.
2. **Missing Loading / Decompression State**:
   - Ingesting a large 350KB `Config.xml` with 7,500+ lines or extracting an archive `.upz` performs synchronous parsing with zero visual indicator (no spinner, no "Parsing unit geometry...", no progress bar).
3. **Bridge Extraction Architecture**:
   - In `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`, `ShowOpenFileDialog()` extracts `.upz` via `UpzBundleExtractor` and reads `.xml` via `File.ReadAllText`. If an exception occurs, it returns `{ success: false, error: ex.Message }`, but `desktopBridge.openFileDialog()` rejects or resolves null without bubbling a structured error object to `HomePage`.

### 4.2 Settings External Action Handlers (`src/components/SettingsModal.tsx`)

In `SettingsModal.tsx`:
```html
<a
  href="/rule-editor.html"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
>
  <Shield className="w-3.5 h-3.5" />
  <span>Open Rule & Logic Editor</span>
</a>
```

**Flaws Identified:**
1. In the WebView2 desktop host, clicking an external anchor with `target="_blank"` triggers default WebView2 navigation behavior unless `CoreWebView2.NewWindowRequested` is explicitly wired in `MainForm.cs`.
2. If `AHUVerification.RuleEditor.exe` cannot be spawned or the window is suppressed, the user receives zero visual feedback (no loading spinner, no success toast, no error alert).
3. **Remediation**:
   - Implement `desktopBridge.launchRuleEditor()` action.
   - Wire C# bridge handler to spawn `AHUVerification.RuleEditor.exe` or open a new WebView2 window.
   - Surface a status toast ("Launching Rule & Logic Editor...") or error banner if the process fails to start.

---

## 5. Investigation Area 4: Copy Cleanup, LaTeX Math, Enums & Visual Hierarchy

### 5.1 LaTeX Math Markup Artifacts

| File & Line | Current Verbatim String | Required Clean Domain Copy |
|---|---|---|
| `src/components/ManualUnitModal.tsx:732` | `Configure any number of skids ($N \ge 1$), custom skid names, and base profiles.` | `Configure one or more shipping skids, custom skid names, and base profiles.` |

### 5.2 Internal Implementation Jargon & Leaked Internals

| File & Line | Current Verbatim Jargon | Required Desktop Domain Copy |
|---|---|---|
| `src/components/ManualUnitModal.tsx:1259` | `The application will synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules across unit and skids, and generate compliant OpenXML deliverables.` | `The application will build the unit structure, apply all engineering specifications, evaluate verification rules across all skids, and prepare the project for Excel deliverable export.` |
| `src/components/PreFlightModal.tsx:179` | `Download .dvl` | `Save Project (.dvl)` |
| `src/components/PreFlightModal.tsx:163-166` | `Patches 'Detailing Verification List.xlsx' preserving all formulas and cell coordinates.` | `Generates the official Detailing Verification List workbook with all formulas, formatting, and cell coordinates preserved.` |
| `src/components/HomePage.tsx:177` | `Ingest MOM Config.xml engineering configuration, load an existing .dvl project, or configure a custom unit.` | `Import an engineering configuration file (Config.xml or .upz), open an existing .dvl project, or configure a custom unit.` |
| `src/components/HomePage.tsx:235` | `Ingest MOM Config.xml or JCI .upz bundle to automatically extract unit geometry, casing materials, segments, and shipping splits.` | `Import a Config.xml or .upz package to automatically load unit geometry, casing materials, segment sequencing, and shipping skids.` |
| `src/components/HomePage.tsx:321` | `OpenXML 3.1.1 Deliverable Engine • Zero Schema Corruption` | `Official Excel Template Engine • Verified OpenXML Deliverables` |
| `src/components/SkidViewTab.tsx:342` | `title="Expand AST logic trace & full reference"` | `title="Expand rule requirement details and logic evaluation"` |
| `src/components/SkidViewTab.tsx:481` | `AST Rule Logic Trace:` | `Rule Evaluation Logic:` |
| `src/components/Sidebar.tsx:321` | `Project special quotes and detailing deviations mapped to deliverable.` | `Special quotes and detailing requirements assigned to this unit and its skids.` |

### 5.3 Raw Enum Tokens & Human Display Formatting

The codebase currently displays raw PascalCase identifiers directly in user-facing badges, tables, and popovers. A centralized formatting utility (`formatEnumToken(val: string): string`) is required:

| Raw Enum / Identifier | Current Display | Human Formatted Display |
|---|---|---|
| `StructuralSteel` | `StructuralSteel` | `Structural Steel` |
| `FormedChannel` | `FormedChannel` | `Formed Channel` |
| `ShrinkWrap` | `ShrinkWrap` | `Shrink Wrap` |
| `StitchWeld` | `StitchWeld` | `Stitch Weld` |
| `ContinuousWeld` | `ContinuousWeld` | `Continuous Weld` |
| `ThermalBreak` | `ThermalBreak` | `Thermal Break` |
| `StandardCurb` | `StandardCurb` | `Standard Curb` |
| `FrontToRear` | `FrontToRear` | `Front to Rear` |
| `RearToFront` | `RearToFront` | `Rear to Front` |
| `Negative` / `Positive` | `Negative` | `Negative Pressure` / `Positive Pressure` |
| `ISG` / `CAD` | `ISG` | `Integrated ISG Casing` / `CAD Double-Wall Casing` |

### 5.4 AI-Slop & Repetitive Badge Pill Reduction

1. **Card-in-Card Nesting**:
   - `GeneralUnitTab.tsx`: "Active Unit Features" card contains individual feature cards, each containing an icon, title, "Active: Yes" pill, provenance badge, and close button. Simplify to a calm specification list with subtle dividers and typography-driven hierarchy.
   - `SkidViewTab.tsx`: Table cells wrap plain text in decorative rounded pills. Reserve pills strictly for actionable status (`Applicable`, `Needs Input`, `SQ-1`).
2. **Metric Tile Proliferation**:
   - `HomePage.tsx`: 4-column metric tiles on the landing page compete with primary entry actions. Keep metrics on `PreFlightModal` where users make release decisions, and simplify Home to clear entry actions with autosave recency guidance.

---

## 6. Investigation Area 5: Table Layouts, Responsive Grids & Theme Tokens

### 6.1 Verification Grid Column Widths & Layout (`src/components/SkidViewTab.tsx`)

Current Column Definitions:
```html
<th className="py-2.5 px-3 w-14 text-center"># / Info</th>
<th className="py-2.5 px-3 w-36">Rule ID</th>
<th className="py-2.5 px-4 min-w-[280px]">Verification Description</th>
<th className="py-2.5 px-3 w-32 text-center">Applicability</th>
<th className="py-2.5 px-3 w-28 text-center">Check Off</th>
<th className="py-2.5 px-3 w-16 text-center">N/A</th>
<th className="py-2.5 px-4 min-w-[220px]">Detailer Comments</th>
<th className="py-2.5 px-3 w-24 text-center">SQ Link</th>
```

**Flaws Identified (Finding 5 & 7):**
1. Long rule requirements are clipped by `line-clamp-2` in a `min-w-[280px]` cell. Detailers are forced to click expand or scroll horizontally to read the full specification they are signing off on.
2. At 1086px window width, the 8 columns sum to over 1100px, causing an unwanted horizontal scrollbar.
3. Secondary columns (`Detailer Comments`, `SQ Link`, `Rule ID`) take up fixed space at the expense of `Verification Description`.

**Recommended Priority Layout:**
- **Primary Column**: `Verification Description` gets `flex-1` / unrestricted proportional width and renders full text without truncation.
- **Fixed Action Columns**: `Rule ID` (`w-28`), `Check Off` (`w-24`), `N/A` (`w-14`).
- **Responsive Drawer**: At constrained widths (<1280px), shift `Detailer Comments`, `Reference`, `AST Logic Trace`, and `SQ Link` into the expandable row drawer (`isRowExpanded`) rather than compressing the main table into unreadability.

### 6.2 Responsive Sidebar & Shell Behavior

- Currently, `Sidebar.tsx` width is strictly manual (`w-72` or `w-16`) based on `isSidebarCollapsed` state.
- **Remediation**:
  - Add a responsive `useEffect` window resize listener in `App.tsx` or `Sidebar.tsx`: automatically switch to collapsed mode when viewport width drops below `1200px` (or when split-screen / 1086px is detected), while allowing manual override via `Ctrl+B`.
  - In `Header.tsx`, wrap secondary action labels in responsive utilities (`hidden xl:inline`) so primary identity (`Job Name`, `Dimensions`, `COM#`, `Save`, `Export`) remain visible without premature truncation.

### 6.3 Theme System & WCAG 2.2 AA Contrast Audit

#### Contrast Token Analysis

| Token / Class Pair | Foreground | Background | Measured Ratio | WCAG 2.2 AA Status | Remediation Token |
|---|---|---|---|---|---|
| `text-slate-400` on Light | `#94a3b8` (Slate-400) | `#ffffff` (White) | **2.88:1** | ❌ **FAIL** (Min 4.5:1 required) | Use `text-slate-600` (`#475569`, 5.90:1) or `text-slate-500` (`#64748b`, 4.58:1) |
| `text-slate-400` on Slate-50 | `#94a3b8` (Slate-400) | `#f8fafc` (Slate-50) | **2.75:1** | ❌ **FAIL** | Use `text-slate-600` (`#475569`, 5.62:1) |
| `text-slate-500` on Dark Slate-900 | `#64748b` (Slate-500) | `#0f172a` (Slate-900) | **3.67:1** | ❌ **FAIL** for small body | Use `text-slate-400` (`#94a3b8`, 6.07:1) or `text-slate-300` (`#cbd5e1`, 10.42:1) |
| `text-slate-500` on Dark Slate-950 | `#64748b` (Slate-500) | `#090d16` (Slate-950) | **4.12:1** | ❌ **FAIL** for small body | Use `text-slate-400` (`#94a3b8`, 6.81:1) |
| Amber-600 on Amber-500/15 (Light) | `#d97706` (Amber-600) | `#fef3c7` (Amber-100) | **3.31:1** | ❌ **FAIL** | Use `text-amber-800` (`#92400e`, 5.92:1) |

#### Light Theme Modal Surface Ownership
In `SettingsModal.tsx` and `ManualUnitModal.tsx`, light theme rendered dark backdrop shells (`bg-black/70`) with mismatched card borders. Standardize `ModalShell.tsx` backdrop to `bg-slate-900/40 dark:bg-black/75` with cohesive light modal surfaces (`bg-white text-slate-900 border-slate-200`).

---

## 7. Comprehensive Remediation Plan & File Target Matrix

| Requirement | Target Files | Specific Planned Modifications |
|---|---|---|
| **R1: Unified Facts & Readiness Predicate** | `src/types/index.ts`<br/>`src/services/factRegistry.ts`<br/>`src/services/ruleEvaluator.ts`<br/>`src/components/Header.tsx`<br/>`src/components/Sidebar.tsx`<br/>`src/components/ResolutionCenterModal.tsx`<br/>`src/components/PreFlightModal.tsx` | 1. Create centralized `computeProjectReadiness()` selector returning unconfirmed facts, blocked checks, applicable checks, and single `isReadyForFinalExport` boolean.<br/>2. Synchronize fact filtering between Header, Resolution Center, and Preflight.<br/>3. Ensure Resolution Center displays "All Facts Confirmed" **only** when both unconfirmed facts and blocked checklist counts are 0. |
| **R2: Accessible Modals, Focus Trapping & Ctrl+K** | `src/components/common/ModalShell.tsx`<br/>`src/components/OmniSearchModal.tsx`<br/>`src/components/ManualUnitModal.tsx`<br/>`src/components/ProjectIdentityModal.tsx`<br/>`src/components/SettingsModal.tsx`<br/>`src/components/ComNumberModal.tsx`<br/>`src/components/DetailerNameModal.tsx` | 1. Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` to `ModalShell` and standalone modals.<br/>2. Add programmatic focus trapping for `Tab` and `Shift+Tab`.<br/>3. Store and restore `document.activeElement` on open/close.<br/>4. Ensure `Ctrl+K` immediately focuses and selects the search input.<br/>5. Remove `max-w-[320px] truncate` from `ModalShell` subtitle. |
| **R3: File Ingestion & Desktop Feedback** | `src/components/HomePage.tsx`<br/>`src/App.tsx`<br/>`src/services/desktopBridge.ts`<br/>`src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`<br/>`src/backend/AHUVerification.App/MainForm.cs` | 1. Add explicit loading state banner/spinner during XML parsing and UPZ extraction.<br/>2. Add durable error card with filename, error message, and next action on Home when import fails.<br/>3. Wire `launchRuleEditor` IPC bridge action with pending/success/failure toast notifications. |
| **R4: Copy, LaTeX Math & Enums** | `src/components/ManualUnitModal.tsx`<br/>`src/components/PreFlightModal.tsx`<br/>`src/components/HomePage.tsx`<br/>`src/components/SkidViewTab.tsx`<br/>`src/components/GeneralUnitTab.tsx`<br/>`src/utils/constants.ts` | 1. Eliminate `$N \ge 1$` -> replace with "one or more".<br/>2. Replace "Download .dvl" with "Save Project (.dvl)".<br/>3. Replace "AST verification rules", "normalized XML", "OpenXML deliverables", "MOM Config.xml" with plain desktop domain copy.<br/>4. Add `formatEnumToken` utility for PascalCase enums.<br/>5. Reduce card-in-card nesting and excessive badge pills. |
| **R5: Responsive Columns & Contrast** | `src/components/SkidViewTab.tsx`<br/>`src/components/Sidebar.tsx`<br/>`src/components/Header.tsx`<br/>`src/components/SegmentMaterialsTable.tsx`<br/>`src/index.css`<br/>`tailwind.config.js` | 1. Prioritize `Verification Description` width; move secondary metadata to row drawer at constrained widths.<br/>2. Implement auto-collapse sidebar breakpoint (<1200px).<br/>3. Correct low-contrast tokens (`text-slate-400` -> `text-slate-600` on light, `text-slate-500` -> `text-slate-400` on dark) to meet WCAG 2.2 AA (4.5:1). |

---

## 8. Verification & Baseline Status

- **Frontend TypeScript Build**: Tested via `npm run build` — Passed (Exit Code 0).
- **Rule Pack Manifest Generator**: Tested via `node scripts/build_rulepack.mjs` — Passed (Exit Code 0, Bundle SHA `9bf21f8f...`).
- **Backend Unit Tests**: Tested via `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` — Passed (29/29 tests passed).
