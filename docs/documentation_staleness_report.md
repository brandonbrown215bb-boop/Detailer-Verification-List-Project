# Codebase Documentation Staleness & Architectural Drift Report

**Audit Date:** 2026-08-26  
**Auditor:** SWE Adversarial Reviewer / QA Agent (Round 3 Refinement)  
**Repository:** `AHU Detailing Verification System`  
**Current HEAD Commit:** `c17d2ace8a22`  
**Document Freshness Baseline:** `e9e2e04707a8` (Commit Delta: 4 commits ahead + uncommitted working tree changes)  
**Target Output Document:** `docs/documentation_staleness_report.md`  

---

> **Archived point-in-time report (superseded for current-state decisions):** The commit SHAs, directory layout, framework conclusions, test counts, and command outcomes below are evidence from the 2026-08-26 audit only. They must not be used as present repository instructions. In the current checkout, C# projects target `net8.0` / `net8.0-windows`, `resources/rulepack/` is the rule-pack location, and the temporary `docs/roolz/`, `src/rulepack/`, `spike/`, and `implementation_plan.md` paths referenced below are absent. Verify current Git state and source before acting on any remediation recommendation in this archive.

## 1. Executive Summary

A systematic, adversarial review and comprehensive audit was conducted across the entire codebase (`src/`, `tests/`, `scripts/`, `spike/`, `resources/`, and build/project configuration) against all documentation artifacts under `docs/`, `AGENTS.md`, `GEMINI.md`, `.agents/`, and `implementation_plan.md`.

### Key Audit Findings:

1. **Agent Ground Staleness State**: `docs/architecture/README.md` is flagged as **STALE** relative to commit `e9e2e04707a8` in `docs/context-manifest.json` because substantial code increments (the .NET 10 desktop host, dynamic OpenXML deliverable synthesis with category pruning, UPZ archive decompression, and the automated test suite) were committed without updating the architecture contract and re-asserting verification.
2. **Architectural Drift in Deliverable Synthesis**: Documentation across `docs/architecture/README.md` (lines 58–62, 99–101), `implementation_plan.md` (lines 60–64), `ADR-0001` (line 13), and `docs/AHU_Verification_E2E_Workflow_Audit.md` (lines 21, 106–114) asserts that OpenXML export retains a static 12-sheet workbook with 23 static formula chains and populates rows 29–212 on `Verification List`. In reality, `OpenXmlTemplatePatcher.cs` (lines 100–121, 203–288, 408–410, 503–540) **prunes inactive category scratchpad sheets**, **dynamically adapts `Check Information` formula calculation chains** (`B8..B15`, `C8..C15`, `B19`, `B20`) to eliminate `#REF!` errors, **removes the `CalculationChainPart`** to force fresh formula recalculation in Excel, and **dynamically generates `Verification List` rows ($\ge 26$)** grouped by shipping skid section headers containing only applicable checks.
3. **Undocumented UPZ Order Metadata Facts in Field Reports**: `docs/field_derivation_report.md` was authored prior to UPZ container ingestion and asserts that order-level metadata (`Job Name`, `Order Number`, `Unit Tag`, `Product Type`, `Quantity`, `Revision Date`, `Sales Engineer`) cannot be extracted from engineering selection files. With `OrderRevParser.cs`, `SalesEngParser.cs`, and `UpzBundleExtractor.cs`, these 7 fields are now authoritatively extracted with `Status = Known` and `Confidence = Authoritative`. `unit.comNumber` (COM #) remains the sole explicit manual entry field.
4. **Rule Pack Master Template Hash Divergence**: `docs/roolz/template.xlsx` (hash `90fe5018e1...`, 53,506 bytes) diverges from `resources/rulepack/template.xlsx` and `src/rulepack/template.xlsx` (hash `406f6a5166...`, 54,582 bytes). Running `node scripts/build_rulepack.mjs` generates an out-of-sync manifest in `docs/roolz/manifest.json` (`bundleSha256: cfe421b...`) compared to `resources/rulepack/manifest.json` (`bundleSha256: 020e8ef...`).
5. **Outdated Technology Stack References in ADR-0001 & Implementation Plan**: `ADR-0001` (Line 12) and `implementation_plan.md` (Line 54) specify `.NET 8 / C#` and single-file executable delivery, whereas the repository is standardized on **.NET 10** (`net10.0` / `net10.0-windows`) and folder-based self-contained delivery (`PublishSingleFile=false`).
6. **Broken Root Test Command in Validation Runbook**: `docs/operations/validation.md` (Line 10) specifies bare `dotnet test`, which fails with `MSB1003: Specify a project or solution file` because no root `.sln` exists; it must target `tests/AHUVerification.Tests/AHUVerification.Tests.csproj`.
7. **Undocumented 11-Action Typed IPC Bridge Protocol**: The 11-action asynchronous message protocol between the React WebView2 frontend (`src/services/desktopBridge.ts`) and C# backend (`src/backend/AHUVerification.App/Bridge/BridgeHandler.cs` lines 94–106: `getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `parseXml`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `syncRulePack`) is implemented but undocumented in `docs/architecture/README.md`.
8. **Binary Asset Location Distinction & Build Validation Gap**: `unpack32.exe` and `ywunpack.dll` are located at `src/backend/AHUVerification.App/resources/bin/` in the source repository and copied to `resources/bin/` during publish. In `AHUVerification.App.csproj`, the MSBuild target `ValidatePackagedAssets` (lines 38–45) checks for `dist/` and `resources/rulepack/`, but omits checking for `unpack32.exe` / `ywunpack.dll`.

---

## 2. Documentation Freshness & Drift Matrix

| Document Path | Document Type | Scope / Target | Current Code Reality | Drift Severity | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `docs/context-manifest.json` | Agent Ground Config | Scopes `implementation_plan.md`, `decisions`, `spike`, `src` @ `e9e2e047` | Missing `tests/**`, `scripts/**`, `resources/**`; commit delta: 4 commits ahead | **HIGH** | **STALE** |
| `docs/architecture/README.md` | Architecture Overview | Static 12-sheet export, no UPZ runtime assets, misses `salesEngineer` | Dynamic category pruning, formula adaptation, UPZ `resources/bin/`, `SalesEng.xml` | **CRITICAL** | **DRIFTED** |
| `docs/decisions/0001-ahu-verification-desktop-architecture.md` | ADR | .NET 8, static 12-sheet export, `%LOCALAPPDATA%/.../autosave.dvl` | .NET 10 (`net10.0-windows`), dynamic sheet pruning, WebView2 localStorage autosave | **HIGH** | **DRIFTED** |
| `docs/decisions/0002-ui-ux-design-specification.md` | ADR | UI/UX layout, 22-slot SQ table, keyboard shortcuts | Aligned with UI implementation (`HomePage`, `Sidebar`, `GeneralUnitTab`, `SkidViewTab`) | **LOW** | **FRESH** |
| `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` | ADR | Rule Pack identity, self-contained publish folder | Accurately describes SHA-256 bundle logic; omits `resources/bin/` in delivery list | **MEDIUM** | **PARTIAL** |
| `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` | ADR | UPZ bundle ingestion, order facts, COM # boundary | Fully implemented in Core, App, and Web; present in working tree | **LOW** | **FRESH** |
| `docs/decisions/README.md` | ADR Index | Indexes ADR 0001–0004 | Updated in working tree to link ADR 0001–0004 | **LOW** | **FRESH** |
| `docs/operations/development.md` | Operations / Dev | Prerequisites, setup.bat, publish commands | Accurately updated for .NET 10, setup.bat, and `resources/bin/` | **LOW** | **FRESH** |
| `docs/operations/validation.md` | Operations / QA | `dotnet test` invocation, Agent Ground paths | `dotnet test` fails at root without project path; hardcoded user profile path | **MEDIUM** | **BROKEN CMD** |
| `docs/field_derivation_report.md` | Data Spec | Claims order metadata cannot be extracted from selection XML | UPZ ingestion extracts 7 authoritative order metadata facts | **CRITICAL** | **DRIFTED** |
| `docs/AHU_Verification_E2E_Workflow_Audit.md` | E2E Audit Spec | Bundle SHA `cfe421b...`, static sheets, no UPZ in Phase 1 | Bundle SHA `020e8ef...`, dynamic deliverable synthesis, UPZ onboarding | **CRITICAL** | **DRIFTED** |
| `docs/roolz/manifest.json` | Rule Pack Spec | Bundle SHA `cfe421b...` (via diverged template.xlsx) | `resources/rulepack/manifest.json` is `020e8ef...` | **HIGH** | **OUT OF SYNC** |
| `docs/roolz/template.xlsx` | Master Template | Older 53,506-byte template (hash `90fe5018...`) | Master template in `resources/rulepack/` is 54,582 bytes (hash `406f6a51...`) | **HIGH** | **OUT OF SYNC** |
| `docs/roolz/rules.json` | Rule Definitions | 104 rules (99 active, 5 archived) | 100% synchronized with `resources/rulepack/rules.json` | **LOW** | **FRESH** |
| `docs/roolz/template_map.json` | Physical Cell Map | Physical coordinate mappings | 100% synchronized with `resources/rulepack/template_map.json` | **LOW** | **FRESH** |
| `docs/roolz/approved_mappings.json` | Approved Mappings | Confirmed code mappings | 100% synchronized with `resources/rulepack/approved_mappings.json` | **LOW** | **FRESH** |
| `implementation_plan.md` | Initial Plan (v3.0) | .NET 8, single-file executable, static 12-sheet Excel | .NET 10, directory publish (`PublishSingleFile=false`), dynamic sheet pruning | **HIGH** | **DRIFTED** |
| `AGENTS.md` | Repository Ground | Root agent contract & retrieval invariants | Aligned with Agent Ground framework | **LOW** | **FRESH** |
| `GEMINI.md` | Agent Config | Imports AGENTS.md | Aligned | **LOW** | **FRESH** |

---

## 3. Comprehensive Codebase-to-Documentation Cross-Reference

### 3.1. Source Code Inventory (`src/`)

| Source Component | Primary File(s) | Documented In | Current Alignment & Identified Drifts |
| :--- | :--- | :--- | :--- |
| **Desktop Host Application** | `src/backend/AHUVerification.App/Program.cs`<br/>`src/backend/AHUVerification.App/MainForm.cs` | `docs/architecture/README.md` §3<br/>`ADR-0001` §1 | **Drifted**: Code targets .NET 10 (`net10.0-windows`), whereas `ADR-0001` and `implementation_plan.md` state .NET 8. |
| **Typed IPC Bridge** | `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`<br/>`src/services/desktopBridge.ts` | `docs/architecture/README.md` §3<br/>`ADR-0001` §1 | **Undocumented**: 11 bridge actions (`getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `parseXml`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `syncRulePack`) lack a protocol specification in architecture docs. |
| **Domain Data Contracts** | `src/backend/AHUVerification.Core/Models/NormalizedGraph.cs`<br/>`src/backend/AHUVerification.Core/Models/FactRegistry.cs`<br/>`src/backend/AHUVerification.Core/Models/Rules.cs`<br/>`src/backend/AHUVerification.Core/Models/DvlProject.cs`<br/>`src/backend/AHUVerification.Core/Models/UpzBundle.cs`<br/>`src/types/index.ts` | `docs/architecture/README.md` §2, §3<br/>`ADR-0004` | **Fresh**: 1:1 typed parity across C# Core models and TypeScript types (`UpzBundle`, `OrderRevisionData`, `SalesEngineerData`, `Fact`, `ChecklistInstance`, `DvlProjectFile`). |
| **Normalized XML Parser** | `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs`<br/>`src/services/xmlParser.ts` | `docs/architecture/README.md` §2<br/>`docs/field_derivation_report.md` §2 | **Fresh**: 1:1 structural parsing of `Config.xml` without speculative interpretations. |
| **UPZ Bundle Decompressor** | `src/backend/AHUVerification.Core/Services/UpzBundleExtractor.cs`<br/>`src/backend/AHUVerification.App/resources/bin/unpack32.exe`<br/>`src/backend/AHUVerification.App/resources/bin/ywunpack.dll` | `ADR-0004`<br/>`docs/operations/development.md` | **Fresh in ADR-0004 & Dev Ops**; missing in `docs/architecture/README.md` asset list (lines 85–88) and `docs/field_derivation_report.md`. Source files live under `src/backend/AHUVerification.App/resources/bin/`. |
| **Order & Sales Parsers** | `src/backend/AHUVerification.Core/Parsers/OrderRevParser.cs`<br/>`src/backend/AHUVerification.Core/Parsers/SalesEngParser.cs` | `ADR-0004` | **Fresh in ADR-0004**; omitted in `docs/field_derivation_report.md` and `docs/architecture/README.md` fact lists (`SalesEng.xml` / `unit.salesEngineer`). |
| **Fact Extractor** | `src/backend/AHUVerification.Core/Services/FactExtractor.cs`<br/>`src/services/factRegistry.ts` | `docs/architecture/README.md` §2<br/>`docs/field_derivation_report.md` | **Drifted**: Code extracts 7 authoritative UPZ order facts; `docs/field_derivation_report.md` claims order facts cannot be extracted from selection files. |
| **AST Rule Evaluator** | `src/backend/AHUVerification.Core/Services/AstRuleEvaluator.cs`<br/>`src/services/ruleEvaluator.ts` | `docs/architecture/README.md` §2<br/>`docs/AHU_Verification_E2E_Workflow_Audit.md` §2.3 | **Fresh**: Evaluates 104 rules (99 active, 5 archived) across Unit and Skid scopes with 3-state applicability. |
| **OpenXML Deliverable Patcher** | `src/backend/AHUVerification.Core/Services/OpenXmlTemplatePatcher.cs`<br/>`src/services/excelExporter.ts` | `docs/architecture/README.md` §4, Invariant 1<br/>`ADR-0001` §2<br/>`docs/AHU_Verification_E2E_Workflow_Audit.md` §2.4 | **Critical Drift**: Code prunes inactive category sheets (`Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, `MOM`), dynamically adapts `Check Information` formulas (`B8..B15`, `C8..C15`, `B19`, `B20`), removes calculation chain part, and rebuilds rows $\ge 26$ on `Verification List`. Documentation claims static 12-sheet preservation. |
| **Rule Pack Manager** | `src/backend/AHUVerification.Core/Services/RulePackManager.cs`<br/>`src/services/rulesCatalog.ts` | `ADR-0003`<br/>`docs/architecture/README.md` §1 | **Fresh**: Enforces UTF-8 LF normalization, ordered member hashing, and `bundleSha256` integrity verification. |
| **Project Persistence (.dvl)** | `src/backend/AHUVerification.Core/Services/DvlProjectManager.cs`<br/>`src/services/projectStorage.ts` | `ADR-0001` §6<br/>`ADR-0003` §2, §3 | **Minor Drift**: Atomic temporary file replacement implemented; ADR-0001 mentions `%LOCALAPPDATA%/.../autosave.dvl` whereas frontend debounces to localStorage (`AHU_VERIFICATION_AUTOSAVE`). |
| **Manual Unit Factory** | `src/services/manualUnitFactory.ts`<br/>`src/components/ManualUnitModal.tsx` | `docs/field_derivation_report.md` §6<br/>`docs/AHU_Verification_E2E_Workflow_Audit.md` §4 | **Fresh**: Synthesizes valid `NormalizedXmlGraph` and default segments for units created without XML. |
| **UI Components Suite** | `src/components/HomePage.tsx`<br/>`src/components/Sidebar.tsx`<br/>`src/components/Header.tsx`<br/>`src/components/GeneralUnitTab.tsx`<br/>`src/components/SkidViewTab.tsx`<br/>`src/components/PreFlightModal.tsx`<br/>`src/components/ResolutionCenterModal.tsx`<br/>`src/components/InlineFactPopover.tsx`<br/>`src/components/OmniSearchModal.tsx`<br/>`src/components/SettingsModal.tsx` | `ADR-0002`<br/>`docs/AHU_Verification_E2E_Workflow_Audit.md` §4 | **Fresh**: All 10 UI components, 22-slot SQ manager, dual view modes, and keyboard shortcuts match ADR-0002. |

---

### 3.2. Test Suites Inventory (`tests/`)

| Test Suite | File Path | Test Count & Status | Documented In | Identified Drifts |
| :--- | :--- | :---: | :--- | :--- |
| **AstEvaluatorTests** | `tests/AHUVerification.Tests/AstEvaluatorTests.cs` | 1 Passed | `docs/architecture/README.md` §Validation | None. Tests strict weight and fact completeness. |
| **DvlProjectTests** | `tests/AHUVerification.Tests/DvlProjectTests.cs` | 3 Passed | `docs/architecture/README.md` §Validation | None. Tests roundtrip serialization, atomic save, and relative path rejection. |
| **FactRegistryTests** | `tests/AHUVerification.Tests/FactRegistryTests.cs` | 2 Passed | `docs/architecture/README.md` §Validation | None. Tests provenance audit trail and strict weight invariants. |
| **OpenXmlPatcherTests** | `tests/AHUVerification.Tests/OpenXmlPatcherTests.cs` | 1 Passed | `docs/architecture/README.md` §Validation | Test asserts dynamic deliverable generation and sheet pruning; docs claim static preservation. |
| **RulePackManagerTests** | `tests/AHUVerification.Tests/RulePackManagerTests.cs` | 9 Passed | `docs/architecture/README.md` §Validation | None. Tests missing artifacts (4 cases), tampered artifacts (4 cases), CRLF acceptance, and bundle validation. |
| **UpzExtractorTests** | `tests/AHUVerification.Tests/UpzExtractorTests.cs` | 2 Passed | `ADR-0004` | Test suite exists and passes; missing from test list in `docs/operations/validation.md`. |
| **XmlParserTests** | `tests/AHUVerification.Tests/XmlParserTests.cs` | 2 Passed | `docs/architecture/README.md` §Validation | None. Tests structural graph extraction. |
| **TestPathHelper** | `tests/AHUVerification.Tests/TestPathHelper.cs` | Helper Fixture | Not documented | Fixture resolving repository root and test assets dynamically across runner environments. |
| **TOTALS** | `tests/AHUVerification.Tests/` | **20 Passed (2.26s)** | `docs/operations/development.md` | `docs/operations/validation.md` specifies broken root `dotnet test` command. |

---

### 3.3. Scripts & Automation Inventory (`scripts/` & Root)

| Script / Automation | File Path | Documented In | Identified Drifts |
| :--- | :--- | :--- | :--- |
| **Build Rule Pack Script** | `scripts/build_rulepack.mjs` | `docs/operations/development.md` Line 36 | **Divergence**: Script outputs to `src/rulepack/`, `resources/rulepack/`, and `docs/roolz/`. Because `docs/roolz/template.xlsx` is diverged, it calculates an inconsistent hash for `docs/roolz/manifest.json`. |
| **One-Click Setup Batch** | `setup.bat` | `docs/operations/development.md` Line 11 | **Fresh**: Correctly orchestrates SDK verification, npm build, rulepack build, C# build, and tests targeting the `.csproj`. |
| **NPM Build & Vite Config** | `package.json`<br/>`vite.config.ts`<br/>`tsconfig.json` | `docs/operations/development.md` Line 31 | **Fresh**: Configures React 18, Tailwind CSS, TypeScript, and Vite production bundle. |
| **Package Assets Validation** | `src/backend/AHUVerification.App/AHUVerification.App.csproj` | Not documented in Ops | MSBuild target `ValidatePackagedAssets` (lines 38–45) checks `dist/` and `resources/rulepack/`, but omits checking `src/backend/AHUVerification.App/resources/bin/` (`unpack32.exe` / `ywunpack.dll`). |

---

## 4. Deep Drift Analysis by Document & Domain

### 4.1. `docs/architecture/README.md` & `docs/context-manifest.json`

#### A. Commit Version & Scoping Staleness
- **File Reference**: `docs/context-manifest.json` (lines 1–16), `docs/architecture/README.md` (lines 1–8).
- **Current State**:
  ```json
  "verified_at_commit": "e9e2e04707a862d72e5f1d7f39c55845ae51bed0"
  ```
  `docs/architecture/README.md` line 3 has `verified_at_commit: UNCOMMITTED`.
- **Root Cause**: The repository advanced 4 commits (`dd889a3`, `777589f`, `aa1e868`, `c17d2ac`) plus uncommitted additions (`UpzBundleExtractor`, `OrderRevParser`, `SalesEngParser`, `OpenXmlTemplatePatcher` dynamic pruning). The document has not been re-verified.
- **Remediation**:
  1. Expand `scope` in `docs/context-manifest.json` to include `tests/**`, `scripts/**`, and `resources/**`.
  2. Update `docs/architecture/README.md` to reflect all architectural additions, then re-assert freshness with `agent_ground.py verify . --yes`.

#### B. OpenXML Deliverable Invariants vs Implementation
- **File Reference**: `docs/architecture/README.md` (lines 58–62, 99–101, 116).
- **Documented Claim**:
  > *"Must preserve all 12 DataValidations elements and all 23 formula chains on Check Information (e.g. ='Drain Pan'!F1)."*
- **Actual Implementation**:
  - In `OpenXmlTemplatePatcher.cs` (lines 84–118), inactive category scratchpad sheets (`Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, `MOM`) are removed from the workbook package when no applicable rules exist.
  - In `OpenXmlTemplatePatcher.cs` (lines 121, 471–540), `AdaptCheckInformationFormulas(...)` clears formula links for deleted sheets to numeric `0` (`B8..B15`, `C8..C15`), recalculates `B19` (`H1` sum across active sheets), and recalculates `B20` (`J1` sum across active Base/Housing/Paperwork sheets).
  - In `OpenXmlTemplatePatcher.cs` (lines 203–288), `Verification List` rows $\ge 26$ are generated dynamically with section headers and only applicable checks.
- **Remediation**: Rewrite Section 4 and Invariant 1 in `docs/architecture/README.md` to accurately document the dynamic category sheet pruning, formula adaptation engine, and dynamic skid section rendering.

#### C. Deployable Asset Bundle Omission
- **File Reference**: `docs/architecture/README.md` (lines 85–88, 111–113).
- **Issue**: Omits `resources/bin/unpack32.exe` and `resources/bin/ywunpack.dll` (source: `src/backend/AHUVerification.App/resources/bin/`) from the mandatory publish folder asset inventory.
- **Remediation**: Add `resources/bin/` to Section 5 and Invariant 6 in `docs/architecture/README.md`.

#### D. Sales Engineer Metadata Omission
- **File Reference**: `docs/architecture/README.md` (lines 21–24, 71–74).
- **Issue**: Line 73 lists order facts from `OrderRev.xml` but omits `unit.salesEngineer` extracted from `SalesEng.xml` via `SalesEngParser.cs` and `FactExtractor.cs` (line 138).
- **Remediation**: Update line 73 to include `unit.salesEngineer` from `SalesEng.xml`.

#### E. Typed IPC Bridge Protocol Specification
- **File Reference**: `docs/architecture/README.md` §3 (lines 76–80).
- **Issue**: Omits specification of the 11-action IPC message protocol between WebView2 and the C# host.
- **Remediation**: Add a dedicated subsection in Section 3 documenting the 11 bridge actions (`getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `parseXml`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `syncRulePack`).

---

### 4.2. Architecture Decision Records (`docs/decisions/`)

#### A. ADR-0001: Outdated Framework & Invariant Description
- **File Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` (lines 12–13, 27).
- **Issues**:
  1. **Line 12**: Specifies `.NET 8 / C# Windows desktop application`. Code is upgraded to **.NET 10** (`net10.0-windows` and `net10.0`).
  2. **Line 13**: States preserving all 23 formula chains statically, missing dynamic formula adaptation.
  3. **Line 27**: Specifies `%LOCALAPPDATA%/AHUVerification/autosave.dvl`. Implementation uses WebView2 localStorage (`AHU_VERIFICATION_AUTOSAVE`) and `%LOCALAPPDATA%/AHUVerification/WebView2Data/`.
- **Remediation**: Add an addendum to ADR-0001 documenting the .NET 10 migration, dynamic deliverable synthesis, and WebView2 storage architecture.

#### B. ADR-0003: Desktop Delivery Assets
- **File Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` (lines 27–30).
- **Issue**: Omits `resources/bin/` as a required deployable component beside `dist/` and `resources/rulepack/`.
- **Remediation**: Update Decision 4 in ADR-0003 to include `resources/bin/`.

#### C. ADR-0004: Status in Working Tree
- **File Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` and `docs/decisions/README.md` (line 8).
- **Observation**: ADR-0004 is authored and indexed in `docs/decisions/README.md` in the working tree, but exists as untracked/uncommitted files relative to baseline commit `e9e2e047`.
- **Remediation**: Track and commit ADR-0004 and the updated `docs/decisions/README.md`.

#### D. Missing Architecture Decision Records
1. **Proposed ADR-0005: Dynamic OpenXML Deliverable Synthesis & Scratchpad Sheet Pruning**:
   - Documents the rationale for dynamically removing unused category sheets and adapting `Check Information` cell formulas over retaining a static 12-sheet workbook.
2. **Proposed ADR-0006: Manual Project Setup Wizard & Baseline Structural Synthesis**:
   - Documents the architectural mechanism in `ManualUnitModal.tsx` and `manualUnitFactory.ts` that synthesizes a compliant `NormalizedXmlGraph` and default segments for units created without selection XML.
3. **Proposed ADR-0007: Typed Asynchronous IPC Bridge Architecture between WebView2 and .NET 10**:
   - Documents the 11-action asynchronous message exchange protocol between the TypeScript frontend and C# desktop host.

---

### 4.3. Operations & Validation Documentation (`docs/operations/`)

#### A. `docs/operations/validation.md` - Broken Root Test Command
- **File Reference**: `docs/operations/validation.md` (lines 8–11).
- **Documented Command**:
  ```powershell
  dotnet test
  ```
- **Error in Execution**:
  ```
  MSBUILD : error MSB1003: Specify a project or solution file. The current working directory does not contain a project or solution file.
  ```
- **Actual Working Command**:
  ```powershell
  dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
  ```
- **Remediation**: Replace line 10 with the project-targeted invocation.

#### B. `docs/operations/validation.md` - Script Paths & Missing UpzExtractor Tests
- **File Reference**: `docs/operations/validation.md` (lines 16, 20).
- **Issues**:
  1. Hardcodes `python "$env:USERPROFILE\.gemini\config\plugins\agent-ground\scripts\agent_ground.py"`.
  2. Omits mention of `UpzExtractorTests.cs` and `spike/OpenXmlSpike` execution details.
- **Remediation**: Use standard `$env:PLUGIN_ROOT\scripts\agent_ground.py` syntax and add run instructions for all test suites.

---

### 4.4. Field Derivation & Classification Report (`docs/field_derivation_report.md`)

#### A. Stale "XML Import Mode Cannot Extract Order Metadata" Claim
- **File Reference**: `docs/field_derivation_report.md` (lines 53–56, 83–86).
- **Documented Claim**:
  > *"In XML Import Mode: Config.xml does not contain customer-facing job names or MAPICS COM numbers (it only contains raw internal GUIDs like unit_MOMID). These fields initialize with standard placeholders and prompt notes directing the detailer to verify against the MAPICS order packet."*
- **Actual Implementation**:
  - Loading a `.upz` container decompresses `OrderRev.xml` and `SalesEng.xml` and authoritatively extracts:
    1. `unit.jobName`: `/root:OrderRevision/jobName` (`Status = Known`, `Confidence = Authoritative`)
    2. `unit.orderNumber`: `/root:OrderRevision/orderNumber` (`Status = Known`, `Confidence = Authoritative`)
    3. `unit.tag`: `/root:OrderRevision/tagList/tag` (`Status = Known`, `Confidence = Authoritative`)
    4. `unit.productType`: `/root:OrderRevision/productType` (`Status = Known`, `Confidence = Authoritative`)
    5. `unit.quantity`: `/root:OrderRevision/quantity` (`Status = Known`, `Confidence = Authoritative`)
    6. `unit.revisionDate`: `/root:OrderRevision/revisionDate` (`Status = Known`, `Confidence = Authoritative`)
    7. `unit.salesEngineer`: `/root:SalesEngineer` (`Status = Known`, `Confidence = Authoritative`)
  - `unit.comNumber` remains an explicit manual entry field.
- **Remediation**: Update Section 2 (Comparison Matrix) and Section 3.1 to document dual ingestion modes: UPZ Bundle Ingestion vs. Standalone Config.xml.

#### B. Missing Field Rows in Comparison Matrix
- **File Reference**: `docs/field_derivation_report.md` (lines 51–77).
- **Omitted Rows**: Add the following 6 rows to the Comparison Matrix table:
  ```markdown
  | `unit.orderNumber` | Order Number | Order & Identity | Wizard: N/A (Optional) | `/root:OrderRevision/orderNumber` | `Known` | `Authoritative` | Context / Header |
  | `unit.tag` | Unit Tag | Order & Identity | Wizard: N/A (Optional) | `/root:OrderRevision/tagList/tag` | `Known` | `Authoritative` | Context / Header |
  | `unit.productType` | Product Type | Order & Identity | Wizard: `SolutionYC` | `/root:OrderRevision/productType` | `Known` | `Authoritative` | Context / Header |
  | `unit.quantity` | Quantity | Order & Identity | Wizard: `1` | `/root:OrderRevision/quantity` | `Known` | `Authoritative` | Context / Header |
  | `unit.revisionDate` | Revision Date | Order & Identity | Current ISO Date | `/root:OrderRevision/revisionDate` | `Known` | `Authoritative` | Context / Header |
  | `unit.salesEngineer` | Sales Engineer | Order & Identity | Wizard: N/A | `/root:SalesEngineer` | `Known` | `Authoritative` | Context / Header |
  ```

---

### 4.5. End-to-End Workflow Audit Specification (`docs/AHU_Verification_E2E_Workflow_Audit.md`)

#### A. Stale Rule Pack Manifest Hash
- **File Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` (lines 8, 178, 378, 386).
- **Documented Hash**: `cfe421b9d079b410d09cd9d0ac88aa6e2c06ca3fb946f6c5528347c90a71b47f` (stale hash generated against old `docs/roolz/template.xlsx`).
- **Actual Runtime Hash**: `020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28` (synchronized hash in `resources/rulepack/` and `src/rulepack/`).
- **Remediation**: Update all occurrences of `cfe421b...` to `020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28`.

#### B. Omission of UPZ Archive Ingestion in Phase 1
- **File Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` (lines 122–138, 169–188).
- **Issue**: Phase 1 lists only 4 onboarding pathways (`Config.xml`, `.dvl`, `Manual Unit Setup`, `Load Demo Dataset`), omitting `.upz` Archive Ingestion.
- **Remediation**: Add `.upz` Archive Ingestion as the primary factory onboarding pathway in Phase 1, the sequence diagram, and Section 4.

#### C. Static Workbook Description vs Dynamic Synthesis
- **File Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` (lines 21, 106–114, 265–270, 390–391).
- **Issue**: Asserts that all 12 worksheet parts are preserved verbatim and checks are written to static rows 29–212 with Column S $N/A = \text{'Yes'}$.
- **Remediation**: Update Section 2.4, Phase 8, and Section 7 to describe dynamic category sheet deletion, formula adaptation, and dynamic row generation.

---

### 4.6. Rule Pack Artifacts Drift (`docs/roolz/` vs `resources/rulepack/` vs `src/rulepack/`)

#### A. Divergence Breakdown
- **File Sizes and Hashes**:
  - `resources/rulepack/template.xlsx`: 54,582 bytes, SHA-256: `406F6A516635DEEF612B540171A665E157C282BAC0F2D3D4BDF77A07E70FBC44`
  - `src/rulepack/template.xlsx`: 54,582 bytes, SHA-256: `406F6A516635DEEF612B540171A665E157C282BAC0F2D3D4BDF77A07E70FBC44`
  - `docs/roolz/template.xlsx`: 53,506 bytes, SHA-256: `90FE5018E157CF44FD1220E9E7EEBF498E61702C6D3D51F2CD2E5F52167A2550`
  - Root `Detailing Verification List.xlsx`: 54,582 bytes, SHA-256: `406F6A516635DEEF612B540171A665E157C282BAC0F2D3D4BDF77A07E70FBC44`
- **Resulting Bundle Hashes**:
  - `resources/rulepack/manifest.json`: `bundleSha256 = 020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28`
  - `src/rulepack/manifest.json`: `bundleSha256 = 020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28`
  - `docs/roolz/manifest.json`: `bundleSha256 = cfe421b9d079b410d09cd9d0ac88aa6e2c06ca3fb946f6c5528347c90a71b47f`
- **Root Cause**: `docs/roolz/template.xlsx` was not overwritten when the master template was updated. `build_rulepack.mjs` hashed the local divergent template.
- **Remediation**: Copy `resources/rulepack/template.xlsx` to `docs/roolz/template.xlsx` and execute `node scripts/build_rulepack.mjs` to synchronize all three manifests to `020e8ef...`.

---

### 4.7. Initial Implementation Plan Drift (`implementation_plan.md`)

- **File Reference**: `implementation_plan.md` (lines 52–65).
- **Identified Drifts**:
  1. **Line 54**: Mentions `.NET 8 / C# with Edge WebView2` (production is .NET 10).
  2. **Line 57**: Mentions `Single-file portable self-contained executable (AHU_Verification.exe)`. Production uses folder-based distribution (`PublishSingleFile=false`) with adjacent `dist/`, `resources/rulepack/`, and `resources/bin/`.
  3. **Lines 60–64**: Asserts static 12-sheet preservation; does not document dynamic sheet pruning.
  4. **Omissions**: Contains no mention of `.upz` decompression, `unpack32.exe`, `OrderRevParser`, or `SalesEngParser`.
- **Remediation**: Mark `implementation_plan.md` as an initial planning document superseded by `docs/architecture/README.md` and ADRs 0001–0004.

---

## 5. Prioritized, Actionable Remediation Plan

The following concrete remediation steps are ordered by execution priority:

### Priority 1: High-Impact Accuracy & Artifact Synchronization (Immediate)

#### Action 1.1: Synchronize Rule Pack Master Template in `docs/roolz/`
- **Target Files**: `docs/roolz/template.xlsx`, `docs/roolz/manifest.json`
- **Action**:
  1. Copy `resources/rulepack/template.xlsx` to `docs/roolz/template.xlsx`.
  2. Run `node scripts/build_rulepack.mjs`.
  3. Confirm that all three manifests (`resources/rulepack/`, `src/rulepack/`, `docs/roolz/`) calculate identical `bundleSha256: 020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28`.

#### Action 1.2: Update `docs/field_derivation_report.md` for UPZ Order Metadata
- **Target File**: `docs/field_derivation_report.md`
- **Required Edits**:
  - Update Section 1 & Section 2 to describe dual entry modes: UPZ Bundle Ingestion vs. Standalone Config.xml.
  - Add table rows for `unit.orderNumber`, `unit.tag`, `unit.productType`, `unit.quantity`, `unit.revisionDate`, and `unit.salesEngineer` with `/root:OrderRevision/...` and `/root:SalesEngineer` pointers, `Status = Known`, and `Confidence = Authoritative`.
  - Clarify the COM # boundary (`COM #` is never in XML and requires manual entry).

#### Action 1.3: Update Deliverable Invariants & Assets in `docs/architecture/README.md`
- **Target File**: `docs/architecture/README.md`
- **Required Edits**:
  - Update Section 2 & Section 4 to describe dynamic category scratchpad sheet deletion and `AdaptCheckInformationFormulas` logic.
  - Update Invariant 1 (lines 99–101) to state that inactive category sheets are pruned and dependent formulas on `Check Information` are adapted dynamically without formula errors (`#REF!`).
  - Update Section 5 (lines 85–88) to include `resources/bin/` (`unpack32.exe` / `ywunpack.dll`) in the publish folder asset inventory.
  - Update Section 2 (line 73) to include `unit.salesEngineer` from `SalesEng.xml`.
  - Update Section 3 to document the 11-action Typed IPC Bridge protocol.

---

### Priority 2: Operational Runbook & Workflow Documentation Updates

#### Action 2.1: Correct Test Invocations in `docs/operations/validation.md`
- **Target File**: `docs/operations/validation.md`
- **Required Edits**:
  - Replace line 10 `dotnet test` with:
    ```powershell
    dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
    ```
  - Add test execution instructions for `UpzExtractorTests.cs`.

#### Action 2.2: Update `docs/AHU_Verification_E2E_Workflow_Audit.md`
- **Target File**: `docs/AHU_Verification_E2E_Workflow_Audit.md`
- **Required Edits**:
  - Update bundle hash in lines 8, 178, 378, 386 to `020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28`.
  - Add `.upz` Bundle Ingestion workflow in Section 3 Phase 1 and Section 4 Interface Catalog.
  - Update Section 2.4 and Section 7 to reflect dynamic deliverable generation and category sheet pruning.
  - Add the 6 UPZ order metadata fields into Section 5.1 Field Inventory.

#### Action 2.3: Index ADR-0004 and Author Proposed ADR-0005, ADR-0006 & ADR-0007
- **Target Files**: `docs/decisions/README.md`, `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md`, `docs/decisions/0006-manual-unit-graph-synthesis.md`, `docs/decisions/0007-typed-ipc-bridge-protocol.md`
- **Required Edits**:
  - Ensure ADR-0004 is tracked and committed.
  - Author ADR-0005 documenting the decision to prune inactive category worksheets and dynamically generate verification rows.
  - Author ADR-0006 documenting the manual unit setup synthesis engine.
  - Author ADR-0007 documenting the 11-action Typed IPC bridge protocol between WebView2 and .NET 10.

#### Action 2.4: Update MSBuild Packaged Assets Validation in `AHUVerification.App.csproj`
- **Target File**: `src/backend/AHUVerification.App/AHUVerification.App.csproj`
- **Required Edits**:
  - Add `<Error>` checks inside `ValidatePackagedAssets` target for `src/backend/AHUVerification.App/resources/bin/unpack32.exe` and `ywunpack.dll` to guarantee release builds fail if native decompression binaries are missing.

---

### Priority 3: Agent Ground Context Re-Verification

#### Action 3.1: Re-verify Architecture Context in `docs/context-manifest.json`
- **Target File**: `docs/context-manifest.json`
- **Action**:
  - Expand `scope` in `docs/context-manifest.json` to include `tests/**`, `scripts/**`, and `resources/**`.
  - Once documentation updates are committed, run:
    ```powershell
    python "$env:PLUGIN_ROOT\scripts\agent_ground.py" verify . --yes
    ```
  - Ensure `docs/architecture/README.md` status returns clean and fresh.

---

## 6. Verification Record & Test Suite Results

The following test suites and builds were executed during this audit:

| Verification Suite | Target | Result | Evidence / Details |
| :--- | :--- | :---: | :--- |
| **C# Automated Tests** | `tests/AHUVerification.Tests/` | **PASSED** | 20 of 20 unit tests passed in 2.26s (AST Evaluator, DVL Project, Fact Registry, OpenXML Patcher, RulePack Manager, UPZ Extractor, XML Parser). |
| **TypeScript / Vite Build** | Root `package.json` | **PASSED** | `tsc && vite build` built `dist/` cleanly in 4.34s (0 TypeScript or Rollup errors). |
| **Rule Pack Generation** | `scripts/build_rulepack.mjs` | **PASSED** | Successfully generated 104 rules (99 active, 5 archived) into `src/rulepack`, `resources/rulepack`, and `docs/roolz`. |
| **OpenXML Validation Spike** | `spike/OpenXmlSpike/` | **PASSED** | Validated template inspection and row extraction (rows 26–96) without schema errors. |
| **UPZ Native Extraction** | `tests/AHUVerification.Tests/UpzExtractorTests.cs` | **PASSED** | Executed `unpack32.exe` / `ywunpack.dll` on `6E-900064-07.upz` and verified 4 extracted XML files and metadata. |

---

## 7. Summary of Untested Edge Cases & Notes for Orchestrator

1. **Airflow Channel Formed Lengths Edge Cases**: Rules evaluating base channel dimensions on multi-skid arrangements with asymmetric widths.
2. **Clean-Machine `resources/bin/` Dependency Boundary**: Testing the standalone published executable on a clean Windows machine without Visual Studio or Git installed to verify that `unpack32.exe` executes without missing MSVC C++ runtime dependencies.
3. **Draft Mode Export with Mixed Check Statuses**: Verifying that `[DRAFT - INCOMPLETE VERIFICATION AUDIT]` correctly appears on the Revision List and title block when an export is forced with unconfirmed facts.
