# Tests, Build & Architecture Technical Survey Report
**Project**: AHU Detailing Verification Desktop Application  
**Author**: Tests & Architecture Explorer (`explorer_survey_3`)  
**Date**: 2026-08-31 / 2026-09-01  
**Scope**: Build pipelines, backend/frontend test harnesses, rulepack compilation/AST evaluation, and verification strategies for requirements R1–R5.

---

## 1. Executive Summary & Verification Landscape

The AHU Detailing Verification desktop system combines a **C# / .NET 8 WinForms + WebView2 desktop host** with a **React 18 + TypeScript + Tailwind CSS SPA** frontend. Its core business logic is driven by declarative JSON-AST rulepacks (`resources/rulepack/`), XML engineering parsers (`Config.xml`, `OrderRev.xml`, `.upz` bundles), and an OpenXML deliverable synthesis engine (`DocumentFormat.OpenXml` 3.1.1+).

### Summary of System Health Checks

| Subsystem | Command | Execution Status | Key Output / Metrics |
|---|---|---|---|
| **Backend Unit & Integration Tests** | `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` | **PASS** (29/29 tests) | 6.59s duration; covers parsers, fact extraction, AST evaluation, rulepack integrity, OpenXML deliverable patching. |
| **Frontend Production Build** | `npm run build` (`tsc && vite build`) | **PASS** (0 TS errors) | 6.75s duration; transforms 1,634 modules; outputs `dist/index.html` and `dist/rule-editor.html`. |
| **Rule Pack Compiler & Manifest Builder** | `node scripts/build_rulepack.mjs` | **PASS** | Generates canonical LF JSON hashes, binary template SHA, and `bundleSha256` (`9bf21f8fe482...`). 104 rules (99 active, 5 archived). |
| **AST Converter Tests** | `node scripts/test_ast_converter.mjs` | **PASS** (5/5 assertions) | Verified against live TypeScript AST parser in Node v24.19.0. |

### Core Architectural Finding
The backend C# engine and TypeScript compiler are in a stable, passing state. However, **there is currently no frontend unit, component, or integration test harness configured in `package.json`** (no Vitest, Jest, React Testing Library, or Playwright). Verification of UI logic, modal dialog behaviors, accessibility attributes, copy hygiene, and synchronized readiness predicates has previously relied on ad-hoc manual reviews. Establishing a lean, high-speed automated validation suite (leveraging Node v24's native `--test` runner, TypeScript execution, and targeted test scripts) is essential for safely executing R1–R5.

---

## 2. Build & Test System Survey

### 2.1 Backend Test Harness (`tests/AHUVerification.Tests`)

The xUnit test project targets `.NET 8.0` and contains 7 test classes validating the core domain pipeline:

1. **`AstEvaluatorTests.cs`** (3 tests):
   - `EvaluateChecklists_EnforcesStrictWeightAndFactCompleteness`: Validates that missing skid weight causes dependent checks (e.g. `BASE-01`) to evaluate to `NeedsInput`.
   - `EvaluatePredicate_NestedOrGroup_EvaluatesCorrectly`: Validates compound `and`/`or` AST trees.
   - `EvaluatePredicate_ComparisonOperators_EvaluateCorrectly`: Tests `>=`, `<=`, `in`, `===`, `!==`, `includes`.
2. **`FactRegistryTests.cs`** (3 tests):
   - Multi-skid fact extraction and custom segment sequencing.
   - 4-state fact provenance (`Known`, `Derived`, `Unknown`, `ManuallyOverridden`) and override/revert audit trails.
   - Strict skid weight semantics (unconfirmed weights remain `Unknown`).
3. **`XmlParserTests.cs`** (3 tests):
   - Complete normalized graph extraction from `Config.xml`.
   - Opening schedules (`UnitDoor`, `UnitDamper`, `UnitFloorDrain`) and component sub-trees (`FanConfig`, `CoilConfig`, `FilterConfig`).
   - Ingestion of all 18 real-world UPZ example configurations (`UPZ_Unit_Examples/`) with zero exceptions.
4. **`UpzExtractorTests.cs`** (2 tests):
   - Native decompressor (`unpack32.exe` / `ywunpack.dll`) extraction of `Config.xml`, `OrderRev.xml`, and `Manifest.xml`.
   - Direct XML parsing of `OrderRev.xml` order-level metadata (`jobName`, `orderNumber`, `unitTag`, `brandOption`).
5. **`RulePackManagerTests.cs`** (9 tests):
   - Manifest validation and bundle integrity.
   - Tampered/missing member rejection (`rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`).
   - Line-ending tolerance (accepts CRLF git checkouts with normalized LF hashing).
   - Atomic remote update checking and rollback on failure.
6. **`DvlProjectTests.cs`** (3 tests):
   - Roundtrip `.dvl` project serialization/deserialization.
   - Rejection of relative file paths.
   - Sibling temporary file atomic replacement pattern.
7. **`OpenXmlPatcherTests.cs`** (3 tests):
   - Dynamic sheet pruning: Inactive category scratchpads (`Base`, `Drain Pan`, `Housing`, `Reconnects`, etc.) with zero applicable checks are pruned from the `.xlsx` package.
   - Formula adaptation: Prevents `#REF!` errors in `Check Information` formula chains (`B8..B15`, `C8..C15`, `B19`, `B20`).
   - Multi-skid verification row expansion (rows $\ge 26$) and decimal gauge formatting.

### 2.2 Frontend Build System

- **Tooling**: Vite 6.0.1 + TypeScript 5.6.3 + Tailwind CSS 3.4.16.
- **Entry Points**:
  - `index.html` $\rightarrow$ `src/main.tsx` $\rightarrow$ `src/App.tsx` (Main Verification Application)
  - `rule-editor.html` $\rightarrow$ `src/ruleEditor/main.tsx` $\rightarrow$ `src/ruleEditor/RuleEditorApp.tsx` (Standalone Rule Editor)
- **Build Output**: Framework-dependent bundle in `dist/`, copied alongside desktop executables in `publish/`.

### 2.3 Script Automation Landscape

| Batch / Script File | Purpose | Invoked Commands |
|---|---|---|
| `build-all.bat` | End-to-end full build | `init_env.bat`, `npm run build`, `node scripts/build_rulepack.mjs`, `dotnet build Core`, `dotnet build App`, `dotnet build RuleEditor` |
| `run-tests.bat` | Automated test suite execution | `init_env.bat`, `dotnet test AHUVerification.Tests.csproj`, `node scripts/test_ast_converter.mjs` |
| `build-rulepack.bat` | Rulepack manifest compilation | `node scripts/build_rulepack.mjs` |
| `build-frontend.bat` | Web asset compilation | `npm run build` |
| `build-backend.bat` | C# desktop projects compilation | `dotnet build Core`, `dotnet build App`, `dotnet build RuleEditor` |
| `launch-app.bat` | Launches desktop host | `dotnet run --project src/backend/AHUVerification.App` |
| `launch-rule-editor.bat` | Launches standalone rule editor | `dotnet run --project src/backend/AHUVerification.RuleEditor` |
| `publish-release.bat` | Packages release distribution | `dotnet publish` + asset copy to `publish/` |

---

## 3. Architecture Mapping: Rulepacks, AST Evaluation, & Frontend Display

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ 1. DECLARATIVE RULE PACK (resources/rulepack/)                          │
 │    • rules.json (Semantic Keys, Scopes, AST Predicates, Required Facts) │
 │    • template_map.json (Physical Cell Coordinates)                      │
 │    • approved_mappings.json (Confirmed Code Mappings)                   │
 │    • template.xlsx (Master Workbook Template)                           │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ 2. COMPILE & SYNC (scripts/build_rulepack.mjs / RulePackManager.cs)     │
 │    • Canonical UTF-8 LF JSON Hashing                                    │
 │    • Binary XLSX Hashing                                                │
 │    • Bundle SHA-256 Checksum Validation                                 │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
 ┌───────────────────────────────────┐ ┌───────────────────────────────────┐
 │ 3A. TS CLIENT ENGINE              │ │ 3B. C# BACKEND ENGINE             │
 │     (src/services/rulesCatalog.ts)│ │     (RulePackManager.cs)          │
 └─────────────────┬─────────────────┘ └─────────────────┬─────────────────┘
                   │                                     │
                   ▼                                     ▼
 ┌───────────────────────────────────┐ ┌───────────────────────────────────┐
 │ 4A. TS AST EVALUATOR              │ │ 4B. C# AST EVALUATOR              │
 │     (src/services/ruleEvaluator.ts│ │     (Services/AstRuleEvaluator.cs)│
 └─────────────────┬─────────────────┘ └─────────────────┬─────────────────┘
                   │                                     │
                   ▼                                     ▼
 ┌───────────────────────────────────┐ ┌───────────────────────────────────┐
 │ 5A. FRONTEND INSTANCES & UI       │ │ 5B. OPENXML EXPORT PATCHER        │
 │     • ChecklistInstance[]         │ │     (OpenXmlTemplatePatcher.cs)   │
 │     • Applicability State:        │ │     • Active Sheet Pruning        │
 │       - Applicable                │ │     • Formula Adaptation          │
 │       - NotApplicable             │ │     • Dynamic Skid Rows (≥ 26)    │
 │       - NeedsInput                │ │     • Deliverable Generation      │
 └─────────────────┬─────────────────┘ └───────────────────────────────────┘
                   │
                   ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ 6. FRONTEND PRESENTATION SURFACES                                       │
 │    • Header: Job Identity, Readiness Pill, Fact Warnings                │
 │    • Sidebar: Per-Skid Progress, Completion Badges, Warning Counters    │
 │    • General Unit Tab: Domain Facts (Order, Geometry, Materials)        │
 │    • Skid View Tab: Category Groups, Checklists, Inline Fact Popovers   │
 │    • Resolution Center Modal: Batch/Inline Unconfirmed Fact Resolution  │
 │    • PreFlight Modal: Export Audit, Incomplete Jump Links               │
 └─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 AST Predicate Schema & Operators
Rules evaluate over a typed scope context containing unit facts, skid facts, segment collections, and base configurations. Supported AST predicates include:
- **Comparison**: `{ ">=": [left, right] }`, `{ "<=": [left, right] }`, `{ ">": [left, right] }`, `{ "<": [left, right] }`, `{ "===": [left, right] }`, `{ "!==": [left, right] }`
- **Set Membership / String Search**: `{ "in": [val, list] }`, `{ "includes": [str, substr] }`
- **Boolean Composition**: `{ "and": [pred1, pred2, ...] }`, `{ "or": [pred1, pred2, ...] }`
- **Fact Reference**: `{ "var": "fact.key.name" }`

### 3.2 Evaluation Preconditions & Fact Trace Pipeline
1. **Pre-check**: Before evaluating predicate AST, `ruleEvaluator.ts` inspects `rule.requiredFacts`.
2. **Missing/Unconfirmed Facts**: If any required fact is missing from the registry, has `status === 'Unknown'`, or `confidence === 'RequiresConfirmation'`, AST evaluation aborts early and returns `{ result: false, needsInput: true, trace: "Required fact '...' requires confirmation or is unknown" }`.
3. **Instance Generation**:
   - `Unit` rules create a single instance with `instanceKey = "unit:<ruleId>"`.
   - `Skid` rules iterate over all shipping skids in `graph.skids` and create instances with `instanceKey = "<skidId>:<ruleId>"`.
   - Resulting `applicability` is assigned: `'NeedsInput' | 'Applicable' | 'NotApplicable'`.

---

## 4. Root Cause Analysis for UI/UX Requirements R1–R5

### Requirement R1: Reconcile Facts, Shell Warnings, and Readiness into a Single Predicate

#### Discovered Discrepancies & Flaws
1. **Inconsistent Weight Filtering**:
   - `Header.tsx` (lines 75–77) and `ResolutionCenterModal.tsx` (lines 28–30) filtered out weight facts:  
     `const pendingFacts = Object.values(facts).filter(f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight'));`
   - `PreFlightModal.tsx` (lines 44–46) included weight facts:  
     `const pendingFacts = Object.values(facts).filter(f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation');`
   - `Sidebar.tsx` (line 46) counted:  
     `const allNeedsInput = checklists.filter(c => c.applicability === 'NeedsInput').length;`
2. **The "All Facts Confirmed" False-Success Bug**:
   - When a unit has unknown skid weights (the default for unweighted units), `ResolutionCenterModal` ignored weight and found 0 pending facts, displaying **"All Facts Confirmed!"**.
   - Simultaneously, 15+ skid checklist rules requiring `skid.weight` evaluated to `applicability: 'NeedsInput'`, causing the Sidebar to display **15 Inputs Needed** and Skid views to show blocked check warnings.
3. **Remediation Requirement**:
   - Implement a single canonical helper (`src/utils/readiness.ts`) providing unified calculation of:
     - `unconfirmedFacts`: array of facts requiring confirmation or missing.
     - `blockedChecks`: array of checklist instances in `NeedsInput` state.
     - `pendingChecks`: array of applicable checklist instances with `status === 'Incomplete'`.
     - `passedChecks`: array of applicable checklist instances with `status === 'Passed'`.
     - `isAllFactsConfirmed`: boolean (strictly true only when zero unconfirmed facts exist).
     - `isReadyForFinalExport`: boolean (strictly true when `unconfirmedFacts.length === 0 && blockedChecks.length === 0 && pendingChecks.length === 0`).
   - Every consumer (`Header`, `Sidebar`, `ResolutionCenterModal`, `PreFlightModal`, `GeneralUnitTab`, `SkidViewTab`) must import and use this single predicate.

---

### Requirement R2: Keyboard Speed & Accessible Dialog Focus Semantics

#### Discovered Discrepancies & Flaws
1. **`Ctrl+K` Focus Timing Race**:
   - `OmniSearchModal.tsx` used `setTimeout(() => inputRef.current?.focus(), 50)` on `isOpen`.
   - In WebView2 / Chromium, `setTimeout` execution frequently fires before modal rendering completes or fails to select text, leaving UI Automation focus on the document body.
2. **Missing Accessible Modal Attributes**:
   - `ModalShell.tsx` and custom modals (`OmniSearchModal`, `ManualUnitModal`, `SettingsModal`, `PreFlightModal`, `ProjectIdentityModal`, `ComNumberModal`, `DetailerNameModal`) lacked:
     - `role="dialog"` or `role="alertdialog"`
     - `aria-modal="true"`
     - `aria-labelledby` / `aria-describedby`
     - Background element `inert` or `aria-hidden` attributes
3. **Missing Focus Trap & Restoration**:
   - Pressing `Tab` inside modals allowed focus to escape into the background table or shell.
   - Closing modals did not restore focus to the element that was active before opening (`document.activeElement`).
4. **Premature Subtitle Truncation**:
   - `ModalShell.tsx` line 60 hardcoded `className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]"`.
   - At standard resolutions (1426x893), subtitles on Settings, Facts, and Project Identity clipped with `...` even with ample horizontal room.

---

### Requirement R3: File Import, Rule Editor Launch & Action Feedback

#### Discovered Discrepancies & Flaws
1. **Silent Import Failure**:
   - In `HomePage.tsx` / `App.tsx`, selecting an invalid or unparseable `Config.xml` via native file picker caused `loadXmlData` to catch exceptions or receive null without setting an explicit error state in `HomePage`.
   - The user was returned to Home with zero visual feedback, leaving them unsure if the file was processed, corrupt, or ignored.
2. **Missing Loading / Importing State**:
   - Parsing large XML files or extracting UPZ bundles had no intermediate spinner or progress state on Home.
3. **Broken Rule Editor Launch in Desktop Host**:
   - In `SettingsModal.tsx` line 337, "Open Rule & Logic Editor" was implemented as `<a href="/rule-editor.html" target="_blank">`.
   - In the WebView2 desktop environment, anchor tags with `target="_blank"` do not launch external desktop processes (`RuleEditor.exe`) and produced no visible response.
   - Remediation: Expose a bridge command or proper action feedback with error toasts if the process cannot be spawned.

---

### Requirement R4: User Copy & Typography Cleanup (AI-Slop & Leaked Internals Removal)

#### Discovered Instances of Leaked Internals & Formatting Artifacts
1. **Raw LaTeX Math Markup**:
   - `src/components/ManualUnitModal.tsx` line 732:  
     `"Configure any number of skids ($N \ge 1$), custom skid names, and base profiles."`  
     $\rightarrow$ Must be plain domain English: `"Configure one or more shipping skids, custom skid names, and base profiles."`
2. **Leaked Architectural Jargon**:
   - `src/components/ManualUnitModal.tsx` line 1259:  
     `"The application will synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules across unit and skids, and generate compliant OpenXML deliverables."`  
     $\rightarrow$ Must be domain desktop language: `"The application will configure your unit geometry, populate engineering specifications, build the verification checklist across all shipping skids, and prepare the project for Excel deliverable generation."`
3. **Browser Terminology in Desktop App**:
   - `src/components/PreFlightModal.tsx` line 179: `"Download .dvl"` $\rightarrow$ Replace with `"Save Project (.dvl)"`.
4. **Raw PascalCase Enums in UI**:
   - Materials and profiles rendered directly from XML (e.g. `StructuralSteel`, `FormedChannel`, `ThermalBreak`, `GalvanizedSteel`, `Outdoor`, `StandardGalv`).
   - Need formatting utility `formatEnumValue(val: string): string` to convert tokens to human-readable strings (`"Structural Steel"`, `"Formed Channel"`, `"Thermal Break"`).

---

### Requirement R5: Responsive Column Prioritization & Theme Contrast Hardening

#### Discovered Discrepancies & Flaws
1. **Narrow Viewport Compression**:
   - `SkidViewTab.tsx` verification table used rigid column widths (`w-36`, `w-32`, `w-28`, `min-w-[280px]`, `min-w-[220px]`).
   - At window widths $\le 1280\text{px}$, the description truncated while secondary columns occupied excessive space.
   - Verification description must take primary flexible width (`flex-1`), while check/NA controls remain compact and fixed, and secondary details (provenance, comments, AST traces) collapse into expandable row drawers.
2. **Sidebar Breakpoints**:
   - Sidebar should automatically collapse into icon rail when window width falls below $1200\text{px}$ unless manually expanded.
3. **Contrast Tokens**:
   - Subdued gray text on dark surfaces (`text-slate-500` / `text-slate-400` on `bg-slate-900`/`bg-slate-850`) fell below WCAG 2.2 AA contrast ratios ($< 4.5:1$).
   - Light mode modal shells had dark container outer borders causing mixed-theme surface ownership.

---

## 5. Automated Test Harness Strategy & Architecture for R1–R5

To verify R1–R5 systematically without introducing unnecessary heavy dependencies, we establish **5 automated test harnesses** integrated into `run-tests.bat` and `npm run build`:

```
┌────────────────────────────────────────────────────────────────────────┐
│ AUTOMATED VALIDATION SUITE (run-tests.bat)                             │
├───────────────────────────────────┬────────────────────────────────────┤
│ Harness 1: Readiness Predicate    │ scripts/test_readiness.mjs         │
│ Synchronized counts, blocked      │ (Runs via node --test)             │
│ checks, All Facts Confirmed logic │                                    │
├───────────────────────────────────┼────────────────────────────────────┤
│ Harness 2: User Copy & Linter     │ scripts/test_copy_linter.mjs       │
│ Rejects LaTeX, raw enums, and     │ (Runs via node --test)             │
│ leaked architectural jargon       │                                    │
├───────────────────────────────────┼────────────────────────────────────┤
│ Harness 3: AST & Rulepack Linter  │ scripts/build_rulepack.mjs &       │
│ Validates all 104 rules, schema,  │ scripts/test_ast_converter.mjs     │
│ and hash invariants               │                                    │
├───────────────────────────────────┼────────────────────────────────────┤
│ Harness 4: TypeScript & Build     │ npm run build                      │
│ 100% strict type safety across    │ (tsc && vite build)                │
│ components and services           │                                    │
├───────────────────────────────────┼────────────────────────────────────┤
│ Harness 5: Backend xUnit Suite    │ dotnet test                        │
│ 29 tests covering AST, OpenXML,   │ AHUVerification.Tests.csproj       │
│ Fact Registry, and UPZ Extraction │                                    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 5.1 Harness Specifications

#### Harness 1: Single Readiness Predicate Verification (`scripts/test_readiness.mjs`)
- **Objective**: Test `computeReadinessSummary()` against mock facts and checklist states.
- **Test Cases**:
  1. `Unconfirmed domain facts` $\rightarrow$ `isAllFactsConfirmed: false`, count matches exact pending facts.
  2. `Unknown skid weight` $\rightarrow$ dependent checklist items marked `NeedsInput`, `blockedChecksCount > 0`, `isAllFactsConfirmed: false`.
  3. `All facts resolved, some checks incomplete` $\rightarrow$ `isAllFactsConfirmed: true`, `isReadyForFinalExport: false`, `incompleteChecksCount` accurate.
  4. `All facts resolved, all checks passed/NA` $\rightarrow$ `isAllFactsConfirmed: true`, `isReadyForFinalExport: true`.

#### Harness 2: User Copy, Formatting & Typography Linter (`scripts/test_copy_linter.mjs`)
- **Objective**: Statically analyze all `.tsx` and `.ts` files in `src/` to prevent regressions on forbidden phrases.
- **Banned Patterns**:
  - `/\$N\s*\\ge\s*1\$/i` (LaTeX math artifacts)
  - `/\b(normalized XML|domain facts|AST verification rules|OpenXML deliverables)\b/i` (Leaked internals)
  - `/>\s*Download \.dvl\s*</i` (Browser download terminology)
  - Raw unformatted enum constants in user displays.

#### Harness 3: Modal Dialog Semantics & Accessibility Static Verifier
- **Objective**: Ensure all modal components (`ModalShell`, `OmniSearchModal`, `ManualUnitModal`, `SettingsModal`, `PreFlightModal`, `ProjectIdentityModal`, `ComNumberModal`, `DetailerNameModal`) maintain required accessibility props (`role="dialog"`, `aria-modal="true"`, focus trap refs).

#### Harness 4: C# xUnit Test Suite (`tests/AHUVerification.Tests`)
- **Objective**: Validate core backend logic, OpenXML deliverable patching, and AST evaluation parity.

---

## 6. Execution Matrix & Integration Plan

### Updated Test Runner Workflow (`run-tests.bat`)

```bat
@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

REM 1. Run C# xUnit Backend Tests
echo [1/4] Running C# xUnit Verification Tests...
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

REM 2. Run AST Converter & Rulepack Manifest Validator
echo [2/4] Validating Rule Pack and AST Converter...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%
node scripts/test_ast_converter.mjs
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

REM 3. Run Readiness Predicate & Copy Linter Suites
echo [3/4] Running Readiness Predicate and Copy Linter Tests...
node --test scripts/test_readiness.mjs
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%
node --test scripts/test_copy_linter.mjs
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

REM 4. Verifying Frontend TypeScript Compilation
echo [4/4] Verifying Frontend TypeScript Compilation...
call npm run build
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo ======================================================================
echo  [SUCCESS] All verification tests, linters, and builds passed!
echo ======================================================================
```

---

## 7. Conclusion & Recommendations for Implementation Teams

1. **Readiness Unification (R1)**: Implement `src/utils/readiness.ts` immediately as the central source of truth before adjusting individual component badges or modals.
2. **Accessible Dialogs (R2)**: Upgrade `ModalShell.tsx` with standard dialog accessibility (`role="dialog"`, `aria-modal="true"`, focus containment, focus restoration, non-clipping subtitles) and adapt all modal components to consume it.
3. **Import Feedback (R3)**: Add durable `importError` and `isImporting` state variables in `HomePage.tsx` so users receive immediate, actionable error cards when unsupported or corrupt XML files are provided.
4. **Copy & Enums (R4)**: Introduce `src/utils/formatters.ts` with `formatEnumValue()` and remove all LaTeX math / leaked implementation phrases.
5. **Responsive Layout & Theme Tokens (R5)**: Give rule descriptions primary width in `SkidViewTab.tsx`, collapse metadata into expandable drawers, and ensure dark/light color tokens achieve WCAG 2.2 AA contrast compliance.
6. **Automated CI Enforcement**: Integrate `scripts/test_readiness.mjs` and `scripts/test_copy_linter.mjs` into `run-tests.bat` to ensure these requirements remain permanently validated across future edits.
