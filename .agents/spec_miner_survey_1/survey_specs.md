# UI/UX Remediation & Live Validation Specification Survey

**Document Status:** Complete / Authoritative  
**Target Milestone:** UI/UX Remediation & Validation Suite  
**Author:** UI/UX Specification Miner (`spec_miner_survey_1`)  
**Date:** 2026-09-01  
**Authoritative Sources:**  
- `ui-ux-review/findings.md` (Top 10 issues, Accessibility, Info Design, Workflows, Responsive, Visual System, AI-Slop audit)
- `ui-ux-review/interaction-matrix.md` (Concrete observed interactions & limits)
- `ui-ux-review/screen-notes.md` (17 per-screen notes and screenshot references)
- `docs/decisions/0002-ui-ux-design-specification.md` (ADR 0002 UI/UX Architecture)
- Repository source inspection (`src/components/`, `src/App.tsx`, `src/services/`, `src/backend/`)

---

## Executive Summary & Architecture Scope

This document specifies the exact behavioral, architectural, semantic, accessibility, and visual requirements to remediate and harden the AHU Detailing Verification desktop user interface. It translates hands-on review findings into actionable implementation specifications across five core requirement pillars:

1. **R1: Single Readiness Predicate & Fact Synchronization** (Unifying Header, Sidebar, Resolution Center, General Unit Tab, Skid Views, and Preflight Modal).
2. **R2: Keyboard Speed & Accessible Dialog Focus Semantics** (Ctrl+K omni-search autofocus/trap/restore, accessible modal dialogs with focus traps, ARIA conformance, and subtitle wrapping).
3. **R3: File Import, Rule Editor Launch & Action Feedback** (Ingestion progress/error states for Config.xml/.upz in HomePage and native file picker, and Settings external launch feedback).
4. **R4: User Copy & Typography Cleanup** (Elimination of LaTeX math markup `$N \ge 1$`, raw enum tokens, internal leaked jargon, and nested container chrome).
5. **R5: Responsive Column Prioritization & Theme Contrast Hardening** (Auto-collapsing sidebar, prioritizing verification descriptions with expandable drawers, WCAG 2.2 AA token contrast compliance).

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Readiness | Unified Readiness Predicate Engine | Single shared readiness calculation evaluating business facts, blocked rules, and check statuses across all views. | `facts: Record<string, Fact>`, `checklists: ChecklistInstance[]` | Object `{ unconfirmedFactsCount, blockedChecksCount, incompleteChecksCount, verifiedChecksCount, applicableChecksCount, isReadyForFinal }` | Returns explicit blocking reasons array if unconfirmed or incomplete. | `findings.md` #1, `screen-notes.md` #08 |
| 2 | R1: Readiness | Resolution Center Synchronized State | Facts resolution modal reflecting unit-wide blocker status rather than prematurely reporting success. | Fact updates from user input or "Approve All Defaults" action | Synchronized fact table; if blocked checks exist, shows actionable redirect rather than "All Facts Confirmed!". | Displays warning banner if checklist rules are blocked by missing inputs. | `findings.md` #1, `ResolutionCenterModal.tsx:56` |
| 3 | R1: Readiness | Preflight Modal Gating & Synchronized Metrics | Gate final Excel export behind 100% check completion and 0 unconfirmed facts; allow draft export with warning. | Checklists, facts, SQ list, draft toggle | Preflight summary grid, incomplete rule jump links, export trigger | Blocks "Export Final .xlsx" button when incomplete; shows "Export Draft .xlsx". | `findings.md` #1, `PreFlightModal.tsx:52` |
| 4 | R1: Readiness | Sidebar & Header Count Harmonization | Synchronize badge pills across Header Facts button and Sidebar Skid tabs with identical predicate counts. | Global facts and checklists state | Real-time numeric badges matching exact pending counts | Shows amber warning pill whenever count > 0; green check when 100% complete. | `Sidebar.tsx:111`, `Header.tsx:75` |
| 5 | R2: Keyboard/A11y | Instant Ctrl+K Omni-Search Focus | Global search shortcut opening modal and immediately focusing/selecting search input without mouse click. | `Ctrl+K` / `Cmd+K` keypress | Search modal open with `inputRef.focus()` and `inputRef.select()` invoked synchronously | Closes cleanly on `Escape` and restores focus to invoking element. | `findings.md` #2, `OmniSearchModal.tsx:28` |
| 6 | R2: Keyboard/A11y | Accessible Modal Dialog Semantics (`ModalShell`) | Standard accessible modal container with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`. | Title, subtitle, icon, children, footer, isOpen | Semantic DOM element with backdrop blur and accessible accessibility tree exposure | Focus trapped inside modal; background nodes set to `inert` or `aria-hidden="true"`. | `findings.md` #3, `ModalShell.tsx:48` |
| 7 | R2: Keyboard/A11y | Modal Focus Trap & Focus Restoration | Cyclic Tab/Shift+Tab trapping within active modal; restores focus to trigger button upon dismissal. | `Tab`, `Shift+Tab`, `Escape` key events | Focus confined to focusable elements inside dialog; restored to prior activeElement on unmount | Traps focus at boundaries (first <-> last focusable element). | `findings.md` #3, `ProjectIdentityModal.tsx` |
| 8 | R2: Keyboard/A11y | Modal Subtitle Natural Wrapping | Full text display for modal descriptions without premature ellipsis clipping on standard displays. | Subtitle string | Multi-line wrapped subtitle with max-width containment | Never truncates with `truncate max-w-[320px]`. | `findings.md` Minor A11y, `ModalShell.tsx:60` |
| 9 | R2: Keyboard/A11y | Manual Unit Setup Modal Keyboard Accessibility | Convert 4-step manual wizard to accessible modal with Escape dismissal and focus trapping. | `Escape`, `Tab`, `Shift+Tab` | Wizard navigation with keyboard containment; closes on Escape (with confirm if dirty) | Prevents focus escape into root document. | `findings.md` #3, `screen-notes.md` #02 |
| 10 | R3: Feedback | Ingestion Feedback & Progress State Machine | Visible loading overlay and durable error alerts during Config.xml / .upz / .dvl import. | File upload / drop / native file picker result | State machine: `idle` -> `loading` -> `success` / `error` | Renders durable error banner with filename, reason, and recovery actions instead of silent Home reset. | `findings.md` #4, `HomePage.tsx:43`, `App.tsx:272` |
| 11 | R3: Feedback | Rule & Logic Editor Bridge Launch Feedback | External process / window launcher in Settings with status toast and error handling. | "Open Rule & Logic Editor" button click in Settings | IPC bridge request `launchRuleEditor`; shows loading/success/error toast | Surfaces desktop toast or modal error banner if editor executable cannot be spawned. | `findings.md` Top 10 #14, `SettingsModal.tsx:336` |
| 12 | R4: Copy/Typography | Domain Copy Cleanup & Plain English Labels | Removal of LaTeX math artifacts (`$N \ge 1$`), raw enum tokens (`StructuralSteel`), and browser verbs ("Download"). | UI text rendering across all components | Human-readable engineering terminology ("at least 1 skid", "Structural Steel", "Save Project (.dvl)") | Enum formatter fallback for unmapped strings. | `findings.md` #8, `ManualUnitModal.tsx:732` |
| 13 | R4: Copy/Typography | Elimination of Leaked Internal Jargon | Replace internal software terms ("normalized XML", "domain facts", "AST rules", "OpenXML deliverables") with desktop domain language. | Static and dynamic copy strings | Clear operational statements ("synthesize verification checklist", "engineering parameters") | No implementation details leaked to end users. | `findings.md` #8, `ManualUnitModal.tsx:1258` |
| 14 | R4: Visual System | Container & Badge Hierarchy Simplification | Remove redundant nested card borders and excessive badge pills for static data (e.g. shipping sequences). | UI layout trees in Review, Settings, and Verification tabs | Restrained single-card containers, definition lists, and typography-driven hierarchy | Badges reserved exclusively for actionable status. | `findings.md` #10, `screen-notes.md` #05 |
| 15 | R5: Responsive | Responsive Sidebar Auto-Collapse | Automatically collapse sidebar to compact icon rail at constrained viewport widths (<1200px) to maximize table width. | Window resize event / media breakpoint | Sidebar state set to `isCollapsed: true` while preserving active tab and indicator dots | User manual toggle (`Ctrl+B`) remains supported. | `findings.md` #5, `Sidebar.tsx:51` |
| 16 | R5: Responsive | Verification Grid Column Prioritization & Row Drawers | Prioritize verification requirement text with primary column width; move secondary metadata to expandable drawers on narrow viewports. | Responsive viewport width, row toggle state | Multi-line requirement description; expandable drawer for Reference, AST Logic Trace, and Comments | Prevents horizontal table scrolling at standard 1426px / 1086px widths. | `findings.md` #7, `SkidViewTab.tsx:283` |
| 17 | R5: Contrast/Theme | WCAG 2.2 AA Contrast Hardening (Dark & Light) | Elevate subdued gray/monospace metadata tokens to meet 4.5:1 minimum contrast ratio across both themes. | Dark / Light theme tokens | Dark: `text-slate-300`/`text-slate-400` on `slate-950`; Light: `text-slate-600`/`text-slate-700` on `white` | Failsafe contrast token definitions in Tailwind theme. | `findings.md` #9, `index.css`, `tailwind.config.js` |
| 18 | R5: Contrast/Theme | Light Mode Modal Surface Coherence | Unify light theme modal surfaces, removing dark outer container shells in light mode. | Light theme mode selection | Clean white/slate-100 modal background, light header/footer borders, and dark text | Eliminates mixed light/dark visual ownership in dialogs. | `findings.md` Visual System, `screenshots/16` |

---

## Edge Cases

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Readiness Predicate | All domain facts confirmed (`Unknown: 0`), but 3 checklist rules still require manual input (`applicability === 'NeedsInput'`). | Resolution Center and Header must NOT declare "All Facts Confirmed!". Count must report `3 items needing input` and export preflight must block final release. |
| 2 | Readiness Predicate | Project has 0 unconfirmed facts and 0 incomplete checks, but 1 skid has 0 segments. | Predicate validates unit geometry integrity; preflight marks unit incomplete if skids are unpopulated. |
| 3 | Omni-Search Focus | User triggers `Ctrl+K` while an input or textarea is currently focused in General Unit tab. | Shortcut intercepts keydown, prevents typing 'k' in textarea, opens search, and moves focus into search query input with text pre-selected. |
| 4 | Modal Focus Trap | User presses `Shift+Tab` on the first interactive element inside `ModalShell`. | Focus loops to the last interactive element (e.g. Done or Cancel button in footer) without escaping into document body. |
| 5 | Modal Stack / Close | Multiple modals triggered sequentially (e.g. Preflight opens, user clicks "Resolve Facts", opening Resolution Center). | Focus history stack tracks prior active elements so closing Resolution Center returns focus to Preflight, and closing Preflight returns focus to Export button. |
| 6 | File Ingestion | User drags and drops a corrupted or 0-byte `.xml` file onto HomePage. | Parser error is caught; loading state clears; durable error dialog appears: "Corrupted XML File: Unable to parse root element. Ensure valid MOM Config.xml." |
| 7 | File Ingestion | User selects `.upz` file in standalone web browser preview without desktop bridge. | Error banner explains: "UPZ decompression requires the Windows desktop host. Use standalone Config.xml in browser preview." |
| 8 | Rule Editor Launch | Desktop host cannot locate `AHUVerification.RuleEditor.exe` or subprocess fails to spawn. | Toast notification appears: "Failed to launch Rule & Logic Editor: Executable not found in application path." |
| 9 | Copy Formatting | Raw enum value `FloorMaterialType: "STL GALV PPC"` or `BaseMaterial: "StructuralSteel"` rendered in tables. | Formatter converts string to "Galvanized Steel PPC" / "Structural Steel" rather than rendering camelCase or enum token. |
| 10 | Responsive Layout | User shrinks window to 1086px width with long 250-character verification requirement description. | Description wraps across 2-3 lines in primary column; comment and AST trace collapse into expandable row drawer without table horizontal overflow. |
| 11 | Light Theme Contrast | Subtitle rendered with `text-slate-400` on `#ffffff` in Light Mode. | Token overridden to `text-slate-600` (`#475569`), raising contrast ratio from 2.3:1 (fail) to 7.0:1 (passes WCAG AA). |

---

## Detailed Granular Specifications

### Pillar 1 (R1): Single Readiness Predicate & Fact Synchronization

#### 1.1 Root Cause Analysis
- Currently, `ResolutionCenterModal.tsx` evaluates readiness solely based on:
  ```ts
  const pendingFacts = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  );
  ```
  If `pendingFacts.length === 0`, it immediately renders lines 54–60:
  ```tsx
  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
  <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed!</h4>
  <p className="text-xs text-slate-500">All engineering parameters and order identity values are populated with authoritative status.</p>
  ```
- Meanwhile:
  - `Header.tsx` filters pending facts separately (lines 75–77) to show a warning badge.
  - `Sidebar.tsx` computes `allNeedsInput = checklists.filter(c => c.applicability === 'NeedsInput').length` (lines 46, 111–116).
  - `PreFlightModal.tsx` evaluates `isReadyForFinal = incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0` (line 52).
- Result: The user opens the Facts center, sees "All Facts Confirmed!", but the Sidebar simultaneously warns "15 input needed", and each skid tab displays an amber warning badge that checks need fact confirmation!

#### 1.2 Unified Domain Readiness Specification
Define a centralized readiness evaluator module (e.g. `src/services/readinessEngine.ts`):

```ts
export interface UnitReadinessSummary {
  // Domain Facts
  unconfirmedFacts: Fact[];
  unconfirmedFactsCount: number;
  
  // Rule Checklist Items
  totalChecksCount: number;
  applicableChecksCount: number;
  verifiedChecksCount: number;
  incompleteChecksCount: number;
  blockedChecksCount: number; // applicability === 'NeedsInput'
  naChecksCount: number;
  
  // Progress Percentages
  checklistPercentComplete: number; // (verifiedChecksCount / applicableChecksCount) * 100
  overallReadinessPercent: number;  // weighted composite or 100% gate
  
  // Release Gate Status
  isReadyForFinalExport: boolean;
  blockingReasons: string[];
}

export function computeUnitReadiness(
  facts: Record<string, Fact>,
  checklists: ChecklistInstance[],
  sqItems?: SpecialQuote[]
): UnitReadinessSummary { ... }
```

#### 1.3 Per-Component Synchronization Requirements
1. **Header (`Header.tsx`)**:
   - Facts Warning Button (lines 244–257): Must show the badge if `unconfirmedFactsCount > 0` OR `blockedChecksCount > 0`.
   - Tooltip / Label: Display exact breakdown: `"${unconfirmedFactsCount} unconfirmed facts • ${blockedChecksCount} blocked checks"`.
2. **Sidebar (`Sidebar.tsx`)**:
   - Overall Progress Card (lines 90–118): Must show `verifiedChecksCount / applicableChecksCount Verified`, and if `blockedChecksCount > 0`, render `"${blockedChecksCount} checks blocked by facts"`.
   - Skid Items (lines 268–278): Per-skid `needsInput` badge must strictly match the rules requiring facts on that skid.
3. **Resolution Center Modal (`ResolutionCenterModal.tsx`)**:
   - If `unconfirmedFactsCount === 0` AND `blockedChecksCount === 0`: Render full success banner ("All Facts & Rules Confirmed").
   - If `unconfirmedFactsCount === 0` BUT `blockedChecksCount > 0`: Render warning state:
     - Title: "Business Facts Confirmed — Checklist Items Require Review"
     - Subtitle: "All order and engineering parameters are authoritative, but ${blockedChecksCount} verification rules still require detailer sign-off or rule-level inputs."
     - Provide jump link to the first blocked check.
4. **General Unit Tab (`GeneralUnitTab.tsx`)**:
   - Provenance badges on fields must strictly synchronize with the active Fact status (`Known`, `Unknown`, `ManuallyOverridden`, `Derived`).
5. **Export Preflight Modal (`PreFlightModal.tsx`)**:
   - Metric cards (lines 65–93): Display exact synchronized counts for Applicable Checks, Verified Checks, Pending Checks, and Unconfirmed Facts.
   - Button state: "Export Final .xlsx" enabled only when `isReadyForFinalExport === true`; otherwise label reads "Export Draft .xlsx (Incomplete)".

---

### Pillar 2 (R2): Keyboard Speed & Accessible Dialog Focus Semantics

#### 2.1 Omni-Search (`Ctrl+K`) Instant Focus & Trap
- **Issue**: `OmniSearchModal.tsx` currently has `setTimeout(() => inputRef.current?.focus(), 50)` on line 29. On WebView2 and desktop host, focus is frequently dropped to the root document, requiring mouse clicks before typing.
- **Requirements**:
  1. **Instant Synchronous Autofocus**:
     - Use `requestAnimationFrame` and auto-focus the `<input>` element on mount.
     - Call `inputRef.current?.focus()` followed immediately by `inputRef.current?.select()`.
  2. **Focus Containment (Trap)**:
     - Trap Tab within the modal:
       - `Tab` on the last focusable element wraps to `inputRef.current`.
       - `Shift+Tab` on `inputRef.current` wraps to the last interactive result or Close button.
  3. **Focus Restoration**:
     - Record `lastActiveElement = document.activeElement as HTMLElement` before opening.
     - On `Escape` or modal close: call `lastActiveElement?.focus()`.
  4. **Keyboard Search Navigation**:
     - Support `ArrowDown` to highlight the next search result.
     - Support `ArrowUp` to highlight the previous search result.
     - Support `Enter` on a highlighted result to trigger navigation and close search.

#### 2.2 Accessible Dialog Shell (`ModalShell.tsx`)
Update `ModalShell` to be fully compliant with WAI-ARIA Dialog (Modal) Pattern:

1. **ARIA Attributes**:
   - Outer container: `role="dialog"`, `aria-modal="true"`.
   - `aria-labelledby="modal-title-${id}"`.
   - `aria-describedby={subtitle ? "modal-desc-${id}" : undefined}`.
2. **Focus Trap Engine**:
   - Implement `useFocusTrap(modalRef, isOpen)` hook:
     - Query all focusable elements: `a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])`.
     - Intercept `Tab` and `Shift+Tab` to prevent focus escaping to background.
     - Focus the first interactive element upon mount (or element marked with `data-autofocus`).
3. **Background Inertness**:
   - While modal is open, set `inert` attribute (or `aria-hidden="true"`) on `#root-content` / main workspace canvas so screen readers and UI Automation cannot inspect or interact with obscured background content.
4. **Focus Restoration**:
   - Save invoking element on open; restore focus on unmount.
5. **Subtitle Wrapping & Layout**:
   - In `ModalShell.tsx` line 60, remove `truncate max-w-[320px]`.
   - Replace with:
     ```tsx
     {subtitle && (
       <p id={`modal-desc-${id}`} className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed max-w-xl">
         {subtitle}
       </p>
     )}
     ```

#### 2.3 Standalone Modal Conformance
Ensure all modal dialogs utilize `ModalShell` or conform to this pattern:
- `ManualUnitModal.tsx` (Refactor to use `ModalShell` or integrate identical focus trap + Escape key handler).
- `OmniSearchModal.tsx`
- `SettingsModal.tsx`
- `PreFlightModal.tsx`
- `ProjectIdentityModal.tsx`
- `ComNumberModal.tsx`
- `DetailerNameModal.tsx`
- `ResolutionCenterModal.tsx`

---

### Pillar 3 (R3): File Import, Rule Editor Launch & Action Feedback

#### 3.1 File Ingestion State Machine (`HomePage.tsx` & `App.tsx`)
- **Issue**: Selecting an unsupported or invalid `Config.xml` in native Windows file picker returns to Home silently without feedback.
- **Requirements**:
  1. Define explicit Ingestion Status State:
     ```ts
     type IngestionState = 
       | { status: 'idle' }
       | { status: 'loading'; fileName: string; step: 'reading' | 'parsing_xml' | 'extracting_facts' | 'evaluating_rules' }
       | { status: 'error'; fileName: string; title: string; message: string; details?: string; recoveryTip: string };
     ```
  2. **Loading Feedback**:
     - When file is selected (via picker or drag-and-drop), immediately transition to `loading`.
     - Render full-screen or card-level loading spinner with clear description:
       - *"Ingesting MOM Config.xml..."*
       - *"Extracting UPZ bundle and order revision..."*
       - *"Evaluating 99 verification rules..."*
  3. **Durable Error Modal / Banner**:
     - If XML parser fails, schema is invalid, or UPZ extraction errors:
       - Do NOT silently return to Home.
       - Display a high-visibility Error Alert Card/Dialog:
         - **File Name**: `e.g. Config_Invalid_2026.xml`
         - **Error Title**: `e.g. Invalid AHU XML Structure`
         - **Detailed Reason**: `e.g. Missing required root <AHU> or <UnitOptions> element at line 14.`
         - **Recommended Next Steps**: `e.g. "Please export a fresh Config.xml from the MOM / JCI Selection Tool or use Manual Unit Setup."`
         - **Action Buttons**: `Try Another File`, `Open Manual Setup`, `Dismiss`.

#### 3.2 Rule & Logic Editor External Launch Feedback (`SettingsModal.tsx`)
- **Issue**: Line 336 of `SettingsModal.tsx` uses `<a href="/rule-editor.html" target="_blank">`, which produces no outcome or feedback in the WebView2 desktop host.
- **Requirements**:
  1. Replace link with an explicit asynchronous launch handler:
     ```ts
     const handleLaunchRuleEditor = async () => {
       setIsLaunchingEditor(true);
       try {
         const res = await desktopBridge.launchRuleEditor();
         if (res.success) {
           setEditorNotice('Rule & Logic Editor launched successfully.');
         } else {
           setEditorError(res.error || 'Failed to spawn Rule Editor process.');
         }
       } catch (err: any) {
         setEditorError(err?.message || 'Rule Editor executable could not be launched.');
       } finally {
         setIsLaunchingEditor(false);
       }
     };
     ```
  2. Implement backend bridge handler `launchRuleEditor` in `BridgeHandler.cs`:
     - Looks for `AHUVerification.RuleEditor.exe` in `AppContext.BaseDirectory` or starts new window hosting `rule-editor.html`.
     - Returns `{ success: true, processId: p.Id }` or `{ success: false, error: ex.Message }`.
  3. In UI, display spinner while launching, and show toast / banner upon success or failure.

---

### Pillar 4 (R4): User Copy & Typography Cleanup

#### 4.1 LaTeX & Raw Markup Removal
- **Issue**: `ManualUnitModal.tsx` line 732 renders: `Configure any number of skids ($N \ge 1$), custom skid names, and base profiles.`
- **Requirement**: Replace all LaTeX formatting with natural English:
  - Change to: `Configure one or more shipping skids, custom skid names, and base profiles.`

#### 4.2 Raw Enum Token Formatting
- **Issue**: Raw PascalCase enum strings like `StructuralSteel`, `ThermalBreak`, `STL GALV PPC` are rendered raw in review tables.
- **Requirement**: Implement standard display formatter helper (`formatEnumDisplay(val: string): string`):
  - `StructuralSteel` -> `Structural Steel`
  - `ThermalBreak` -> `Thermal Break`
  - `Knockdown` -> `Knockdown (Field Assembled)`
  - `NoSubFloor` -> `No Sub-Floor`

#### 4.3 Implementation Jargon Replacement
| Location | Current Leaked Jargon | Required Desktop Domain Copy |
|---|---|---|
| `ManualUnitModal.tsx:1258` | *"The application will synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules across unit and skids, and generate compliant OpenXML deliverables."* | *"Ready to create the AHU verification project with configured skid splits, casing specifications, and automated verification checklists."* |
| `HomePage.tsx:321` | *"OpenXML 3.1.1 Deliverable Engine • Zero Schema Corruption"* | *"Official York AHU Verification & Excel Workbook Generator"* |
| `PreFlightModal.tsx:180` | *"Download .dvl"* | *"Save Project (.dvl)"* |
| `PreFlightModal.tsx:166` | *"Patches 'Detailing Verification List.xlsx' preserving all formulas and cell coordinates."* | *"Generates certified Detailing Verification List workbook (.xlsx) with all formulas intact."* |
| `SkidViewTab.tsx:481` | *"AST Rule Logic Trace:"* | *"Rule Evaluation & Logic Detail:"* |
| `GeneralUnitTab.tsx:240` | *"General Specification"* / *"User Specified"* | *"Unit Specification"* / *"Manual Entry"* |

#### 4.4 Badge and Container De-Cluttering
- In `ManualUnitModal.tsx` (Review Step) and `GeneralUnitTab.tsx`:
  - Convert runs of horizontal badge pills (e.g. shipping sequences) into clean structured rows or definition tables.
  - Remove inner card outlines where the parent container already provides background containment.
  - Reserve badge pills exclusively for actionable statuses (`Passed`, `Needs Input`, `N/A`, `Overridden`) and verified segment type codes (`FF`, `MB`, `CC`).

---

### Pillar 5 (R5): Responsive Column Prioritization & Theme Contrast Hardening

#### 5.1 Responsive Breakpoints & Navigation Auto-Collapse
- **Behavior Requirements**:
  1. Breakpoints:
     - **Wide (>1400px)**: Sidebar expanded (288px / `w-72`), full header labels, wide verification table.
     - **Constrained (1000px – 1399px)**: Sidebar **automatically collapsed** to compact icon rail (64px / `w-16`), reclaiming 224px of horizontal canvas. Header actions collapse text to icons + tooltips.
     - **Minimum Supported (1100px)**: Compact sidebar, prioritized verification columns, secondary metadata moved into expandable row drawers.
  2. Manual Override:
     - User pressing `Ctrl+B` or clicking collapse button toggles collapsed state and persists manual preference in `localStorage`.
     - If viewport is resized below 1100px, auto-collapse forces compact mode regardless of preference to prevent table distortion.

#### 5.2 Verification Grid Column Prioritization Model
In `SkidViewTab.tsx` and `GeneralUnitTab.tsx`:
- Allocate table width based on task priority:
  - **Priority 1 (Primary Elastic Width)**: `Verification Description` (`min-w-[340px] flex-1`). The requirement text must have room to breathe, rendering multi-line if needed without harsh truncation.
  - **Priority 2 (Fixed Width)**:
    - `# / Info`: `w-14` text-center
    - `Rule ID`: `w-28` font-mono font-bold
    - `Applicability`: `w-28` text-center
    - `Check Off`: `w-24` text-center
    - `N/A`: `w-16` text-center
  - **Priority 3 (Responsive Drawer)**:
    - At constrained widths (<1280px), the `Comments` input column and `Ref` details move out of the table row into the **Expandable Row Detail Drawer** (`isRowExpanded`), leaving the main table crisp and 100% horizontal-scroll-free.

#### 5.3 Theme Contrast Hardening (WCAG 2.2 AA Compliance)

##### Dark Theme Contrast Hardening:
- Current failure: `text-slate-500` (`#64748b`) on `slate-950` (`#090d16`) has contrast ratio **4.1:1**, failing WCAG AA (4.5:1).
- Correction:
  - Update all secondary text, table references, helper text, and subtitles in dark mode:
    - Use `text-slate-400` (`#94a3b8`, contrast ratio **7.4:1**) for secondary labels/descriptions.
    - Use `text-slate-300` (`#cbd5e1`, contrast ratio **11.5:1**) for primary values.
    - Reserve `text-slate-500` only for disabled items or decorative icons.

##### Light Theme Contrast Hardening:
- Current failure: `text-slate-400` (`#94a3b8`) on `#ffffff` has contrast ratio **2.3:1** (severe failure!).
- Correction:
  - Update secondary text in light mode:
    - Use `text-slate-600` (`#475569`, contrast ratio **7.0:1**) or `text-slate-700` (`#334155`, contrast ratio **9.6:1**).
    - Replace `text-slate-500` (`#64748b`, 4.0:1) with `text-slate-600` for normal body copy.

##### Light Theme Modal Surface Ownership:
- **Issue**: `screenshots/16-settings-light-theme.jpg` shows light mode modal dialogs keeping dark backdrop shells and dark header container elements (`bg-black/60`, `dark:bg-slate-850`), resulting in mixed visual systems.
- **Requirement**:
  - In light theme, `ModalShell` renders a pure, cohesive light surface:
    - Backdrop: `bg-slate-900/40 backdrop-blur-sm` (clean translucent neutral dark scrim).
    - Modal Shell: `bg-white border border-slate-200 shadow-2xl`.
    - Header & Footer: `bg-slate-50 border-slate-200 text-slate-900`.
    - Content cards: `bg-slate-50/80 border-slate-200 text-slate-800`.
    - Inputs: `bg-white border-slate-300 text-slate-900 focus:border-blue-500`.

---

## Verification & Automated Testing Plan

1. **Frontend TypeScript & Build Verification**:
   - Command: `npm run build`
   - Requirement: Zero TypeScript errors (`tsc` passes cleanly), zero broken CSS classes.
2. **Backend Unit Tests**:
   - Command: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`
   - Requirement: 100% passing unit tests across XML parsing, AST evaluation, Fact registry, and OpenXML template patching.
3. **Rule Pack Manifest Verification**:
   - Command: `node scripts/build_rulepack.mjs`
   - Requirement: Successful manifest rebuild and SHA256 integrity match.
4. **Keyboard & Modal Navigation Verification**:
   - Test sequence:
     1. Press `Ctrl+K` -> verify search opens, input has focus, text typing works immediately without mouse.
     2. Press `Tab` -> verify focus cycles exclusively inside search modal.
     3. Press `Escape` -> verify search closes and focus returns to previously focused trigger.
     4. Open `SettingsModal` / `ManualUnitModal` -> verify `role="dialog"`, `aria-modal="true"`, focus trapped, Escape closes dialog.
5. **Readiness Predicate Synchronization Verification**:
   - Test sequence:
     1. Load demo or project with unconfirmed facts.
     2. Verify Header Fact pill count == Sidebar blocked items count == Preflight blocked count.
     3. Open `ResolutionCenterModal` -> verify it does NOT display "All Facts Confirmed!" while items require input.
     4. Confirm all facts -> verify Header, Sidebar, and Preflight simultaneously transition to 100% confirmed state.
6. **File Import & Error Feedback Verification**:
   - Ingest valid `Config.xml` -> verify loading indicator then workspace transition.
   - Ingest invalid XML -> verify durable error dialog with filename and actionable message.

---
*End of UI/UX Remediation Specification Survey.*
