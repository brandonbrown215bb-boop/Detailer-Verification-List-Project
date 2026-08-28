# Architectural Decision Record (ADR 0004–0009) Documentation Audit Report

**Date**: 2026-08-28  
**Auditor**: Teamwork Explorer 2 (Documentation & Architecture Auditor)  
**Target Scope**: ADRs 0004 through 0009 for Detailer-Verification-List-Project  
**Status**: Completed

---

## 1. Executive Summary

An exhaustive, line-by-line audit of Architecture Decision Records (ADRs 0004 through 0009) was conducted against the active repository source code, models, parsers, bridge handlers, UI components, OpenXML synthesis pipelines, and automated test suites. 

Every assigned ADR was evaluated across five critical documentation dimensions:
1. **Missing Information**
2. **Unstated Assumptions**
3. **Ambiguous Steps**
4. **Unguided Error Scenarios**
5. **Outdated / Contradictory Information**

All findings have been classified into three severity tiers:
- **Blocks the Reader (Critical)**: Issues that prevent building, executing, or correctly understanding core architectural contracts.
- **Slows the Reader (Moderate)**: Ambiguities, implicit knowledge, or missing error workflows that force guessing and reverse-engineering.
- **Minor (Low)**: Non-critical omissions, path quirks, or cosmetic reference inconsistencies.

### Audit Summary Matrix

| Document | Target Title on Disk | Blockers | Slowdowns | Minors | Total Findings |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **ADR 0004** | UPZ Bundle Ingestion and Order Metadata Traces | 1 | 2 | 1 | **4** |
| **ADR 0005** | Dynamic OpenXML Deliverable Synthesis and Scratchpad Sheet Pruning | 1 | 2 | 1 | **4** |
| **ADR 0006** | Manual Unit Setup Wizard and Baseline Structural Graph Synthesis | 1 | 2 | 1 | **4** |
| **ADR 0007** | Typed Asynchronous IPC Bridge Architecture between WebView2 and .NET 10 | 1 | 2 | 1 | **4** |
| **ADR 0008** | Standalone Rule & Logic Editor Desktop Studio and Visual AST Authoring | 1 | 2 | 1 | **4** |
| **ADR 0009** | UPZ Baseline Fact Extraction and Rule Predicate Expansion | 1 | 2 | 1 | **4** |
| **Total** | | **6** | **12** | **6** | **24** |

---

## 2. Document Identity & Prompt Reconciliation

The audit prompt referenced working or draft titles for several ADRs. The table below provides the definitive mapping to the authoritative files present on disk in `docs/decisions/`:

| ADR Number | Prompt Working Title | Authoritative File on Disk | Status |
| :--- | :--- | :--- | :--- |
| **0004** | `0004-wpf-generic-host-mvvm-structure.md` | `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` | Authoritative |
| **0005** | `0005-air-handling-logic-decomposition.md` | `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` | Authoritative |
| **0006** | `0006-testing-strategy-and-coverage-matrix.md` | `docs/decisions/0006-manual-unit-graph-synthesis.md` | Authoritative |
| **0007** | `0007-excel-export-and-reporting-pipeline.md` | `docs/decisions/0007-typed-ipc-bridge-protocol.md` | Authoritative |
| **0008** | `0008-rule-authoring-and-dsl-boundary.md` | `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` | Authoritative |
| **0009** | `0009-upz-baseline-fact-extraction-and-predicate-expansion.md` | `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` | Authoritative |

*(Note: The actual desktop application architecture is built upon Windows Forms + WebView2 (`Form` + `WebView2.WinForms`), not WPF MVVM Generic Host.)*

---

## 3. Prioritized Gap Catalog

### 3.1. Blocks the Reader (Critical)

#### `[BLOCKER-01]` Hardcoded Developer Fallback Path and Missing Non-Zero Exit Code Handling in UPZ Extractor
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 1: Native UPZ Decompression Toolchain
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: A fresh AI agent running the backend on a clean machine without local developer environment paths will not know that `UpzBundleExtractor.cs` (lines 43-45) falls back to a hardcoded local developer path (`C:\Users\jbrow263\source\repos\...`), and fails to verify `process.ExitCode` when `unpack32.exe` fails, resulting in an unguided `FileNotFoundException: Config.xml not found` rather than identifying that the 32-bit unpacker failed or required assets were missing.
- **One-Sentence Fix Note**: Update ADR 0004 to document the required deployment asset locations for `unpack32.exe`/`ywunpack.dll` (`resources/bin/`), mandate checking `process.ExitCode` with descriptive error messaging on decompression failure, and remove hardcoded developer fallback assumptions.

#### `[BLOCKER-02]` Unguided Excel OpenXML File Lock & Process Concurrency Failures
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 1: Dynamic Category Sheet Pruning
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: When a detailer or reviewer has the deliverable workbook open in Microsoft Excel, exporting the verification list crashes with an unhandled `IOException` ("process cannot access file") because `OpenXmlTemplatePatcher` performs a direct `File.Copy` and `SpreadsheetDocument.Open` with zero retry logic, locked-file detection, or guided UI recovery steps.
- **One-Sentence Fix Note**: Document file locking behavior and specify standard error handling (prompting the detailer to close Excel or exporting to a timestamped alternate filename) in ADR 0005.

#### `[BLOCKER-03]` Single-Language Synthesis Implementation Discrepancy (TypeScript Only vs Backend Absence)
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 2: Structural Graph Synthesis Engine (`manualUnitFactory.ts`)
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0006 implies that manual unit structural graph synthesis is an application-wide capability, but it exists solely in the TypeScript frontend (`src/services/manualUnitFactory.ts`) with zero C# backend implementation in `AHUVerification.Core`. An agent attempting to invoke headless C# batch jobs or C# tests for manual unit creation will find no backend classes, requiring full understanding that the frontend must synthesize the graph and transfer it over the bridge or `.dvl` save file.
- **One-Sentence Fix Note**: Explicitly document in ADR 0006 that structural graph synthesis is exclusively implemented in the frontend TypeScript runtime (`src/services/manualUnitFactory.ts`) and serialized to `.dvl` or IPC payload for backend consumption.

#### `[BLOCKER-04]` Phantom `parseXml` Action and Missing Bridge Action Catalog Entries
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Decisions 2: 11-Action Bridge Method Catalog
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0007 lists `parseXml` as an active bridge method (`FE -> BE`), but `parseXml` is entirely absent from `BridgeHandler.cs` (calling it throws `Unknown bridge action: 'parseXml'`). Furthermore, actions that are actively implemented in `BridgeHandler.cs` (`checkRulePackUpdate`, `selectFolderDialog`) and `RuleEditorBridgeHandler.cs` (`publishRulePack`) are missing from the table in ADR 0007, creating confusion over where XML parsing occurs (TypeScript frontend vs C# backend).
- **One-Sentence Fix Note**: Remove `parseXml` from the bridge action table in ADR 0007, clarify that XML parsing occurs client-side in TypeScript, and document the actual `checkRulePackUpdate`, `selectFolderDialog`, and `publishRulePack` bridge actions.

#### `[BLOCKER-05]` Missing Rule Pack Canonical Hashing Spec & Manifest Verification Protocol
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 5: Draft Review, Semantic Versioning, and Publishing Pipeline
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0008 states that `RulePackManager.PublishToDirectory` computes canonical UTF-8 SHA-256 hashes, but omits the exact hashing algorithm: JSON must be normalized with `\n` (LF line endings) without CRLF, keys formatted with specific indentation, and `bundleSha256` computed as the SHA-256 of the newline-joined list of `filename:hash` pairs for the 4 required artifacts (`rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`). Any tool or script failing to replicate this exact protocol will produce invalid rule packs rejected by the desktop application.
- **One-Sentence Fix Note**: Provide the complete specification for LF normalization, individual artifact hashing, and composite `bundleSha256` calculation in ADR 0008 § Decisions 5.

#### `[BLOCKER-06]` Undocumented Tiered vs Stacked Geometric Classification Rules & Tolerance Limits
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 4: Tiered vs. Stacked Unit Structural Semantics
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: ADR 0009 defines tiered units as $y > \text{defaultBaseHeight} + 10$ without an independent base, and stacked units as $y > 15$, but omits the exact tolerance comparisons used in code (`Math.Abs(b.Dimensions.Y - parsedGeom.Y) < 5` in `NormalizedXmlParser.cs` line 247). An agent attempting to replicate the unit graph or write verification rules for multi-deck units will misclassify elevated segments if they do not know the 5-inch elevation tolerance or default base height fallback.
- **One-Sentence Fix Note**: Specify the exact mathematical conditions and 5-inch elevation tolerance window for tiered and stacked unit classification in ADR 0009 § Decisions 4.

---

### 3.2. Slows the Reader (Moderate)

#### `[SLOW-01]` Trailing Slash Requirement on Unpack Target Directory Undocumented
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 1: Native UPZ Decompression Toolchain
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: A fresh AI agent attempting to invoke or debug `unpack32.exe` will fail if they do not append a trailing directory separator (`\`) to the second CLI argument, because `unpack32.exe` interprets destination arguments without trailing slashes as target file paths rather than output directories, causing silent failure.
- **One-Sentence Fix Note**: Add explicit documentation in ADR 0004 specifying that `unpack32.exe` strictly requires a trailing backslash on destination folder arguments to output extracted XML files correctly.

#### `[SLOW-02]` Inconsistent Fallback Job Name Mock in Fact Extractor
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 3: Authoritative Fact Provenance & COM # Manual Boundary
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0004 states that for standalone `Config.xml` files where order metadata is absent, order-level facts are left unpopulated or fallback behavior is retained; however, `FactExtractor.cs` (line 51) and `factRegistry.ts` (line 41) hardcode a default dummy string `"Medical Center Phase 3"` instead of leaving `unit.jobName` empty or prompting for user entry with status `Unknown`, leading to misleading automated verification data in XML-only workflows.
- **One-Sentence Fix Note**: Update ADR 0004 to specify the exact fallback behavior for `unit.jobName` when `OrderRev.xml` is absent (either defaulting to empty prompt or documenting the legacy placeholder), aligning the document with code reality.

#### `[SLOW-03]` Hardcoded OpenXML Style Index Dependency in Row Synthesis
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 3: Dynamic Skid-Grouped Verification Rows
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: `OpenXmlTemplatePatcher.cs` hardcodes exact numeric style indices (e.g. `98U`, `70U`, `42U`, `63U`, `78U`, `80U`, `19U`) directly tied to `template.xlsx`'s specific stylesheet table. If an agent modifies `template.xlsx` or adds styles without preserving the exact style indexing order, dynamic row generation outputs incorrect cell borders, zebra shading, and fonts with no compiler or runtime warning.
- **One-Sentence Fix Note**: Document in ADR 0005 that dynamic row styling depends strictly on fixed `StyleIndex` constants corresponding to the packaged `template.xlsx` stylesheet, detailing how new styles or template revisions must be coordinated.

#### `[SLOW-04]` Undocumented Category-to-Sheet Mapping Hierarchy (`GetCategorySheetName`)
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 1: Dynamic Category Sheet Pruning
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0005 states that category worksheets are pruned if they have zero applicable checks, but does not explain how 20+ rule categories and subgroups (e.g., `UTL`, `Knockdown`, `Internals`, `Coil Segments`) are aggregated and mapped onto the 8 physical scratchpad sheets (`Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, `MOM`), leaving an agent unable to predict whether a custom rule will preserve or delete a given tab.
- **One-Sentence Fix Note**: Include the formal category and subgroup mapping table from `GetCategorySheetName` in ADR 0005, clarifying how categories like `UTL` and `Knockdown` map to `Housing` and how `Internals` subgroups map to specific scratchpads.

#### `[SLOW-05]` Incorrect File Path Reference for Manual Unit Factory
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 2: Structural Graph Synthesis Engine
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The heading in ADR 0006 cites `manualUnitFactory.ts` without full path, but surrounding documentation often references `src/utils/manualUnitFactory.ts`, whereas the actual file is located at `src/services/manualUnitFactory.ts`. An agent attempting to view or import the file from `src/utils/` will encounter a `FileNotFoundException`.
- **One-Sentence Fix Note**: Update ADR 0006 to reference the canonical file path `src/services/manualUnitFactory.ts`.

#### `[SLOW-06]` Absence of Default Dimensional Validation and Geometric Constraints
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 1: Manual Unit Configuration Wizard
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: ADR 0006 does not define minimum/maximum boundaries or validation rules for user input in `ManualUnitModal.tsx` (e.g., negative CFM, 0" width, base heights exceeding total unit height), which can result in malformed segment geometry ($x, y, z \le 0$) that causes downstream rule evaluation errors or broken OpenXML coordinate rendering.
- **One-Sentence Fix Note**: Add explicit input validation constraints and fallback default bounds (e.g., positive non-zero dimensions, valid pressure enum) to ADR 0006.

#### `[SLOW-07]` Target Framework Version Inconsistency (.NET 10 vs .NET 8)
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Title & § Context
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0007 titles and describes the host as `.NET 10` (`AHUVerification.App`), but all `.csproj` files (`AHUVerification.App.csproj`, `AHUVerification.Core.csproj`, `AHUVerification.RuleEditor.csproj`), `Directory.Build.targets`, and `scripts/init_env.bat` target `net8.0-windows` / `net8.0`. An onboarding agent will attempt to locate or configure .NET 10 SDKs when .NET 8.0 is the active project target.
- **One-Sentence Fix Note**: Update ADR 0007 (and related docs) to reflect the actual target framework `net8.0-windows` (or clarify that .NET 10 is a future roadmap target while .NET 8 is currently shipped).

#### `[SLOW-08]` Missing UI Thread Synchronization (`Form.Invoke`) and Timeout Guidance
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Decisions 1: Protocol Transport
- **Gap Category**: `Unguided Error Scenario` / `Missing Information`
- **Impact Description**: ADR 0007 does not document that WebView2 IPC messages arrive on background thread contexts that require WinForms `Form.Invoke` for UI operations (`OpenFileDialog`, `SaveFileDialog`, `FolderBrowserDialog`), nor does it document the 30-second client-side timeout in `desktopBridge.ts`. If an agent adds a bridge action that touches WinForms controls without `Invoke`, the application will suffer cross-thread exceptions or deadlock.
- **One-Sentence Fix Note**: Document the requirement for UI thread marshaling (`Form.Invoke`) for dialog actions and specify the 30-second request timeout mechanism in ADR 0007.

#### `[SLOW-09]` Host Framework Version and Assembly Name Discrepancy in Rule Editor
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 1: Standalone Desktop Application & Delivery
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0008 references `.NET 10` and `RuleEditor.exe`, but the project file `AHUVerification.RuleEditor.csproj` targets `net8.0-windows` with `<AssemblyName>RuleEditor</AssemblyName>`. Furthermore, the bridge handler is named `RuleEditorBridgeHandler.cs` (handling 5 actions: `getAppInfo`, `getRulePack`, `publishRulePack`, `openFileDialog`, `selectFolderDialog`), distinct from the main app's `BridgeHandler.cs`.
- **One-Sentence Fix Note**: Align ADR 0008 with `net8.0-windows` and document the dedicated `RuleEditorBridgeHandler` action catalog.

#### `[SLOW-10]` Undocumented Remote Sync Staging, Validation, and LKG Rollback Protocol
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 5: Draft Review, Semantic Versioning, and Publishing Pipeline
- **Gap Category**: `Missing Information`
- **Impact Description**: `RulePackManager.cs` implements an atomic 4-stage synchronization pipeline (Stage $\to$ Validate $\to$ Backup to LKG $\to$ Promote, with automatic rollback if validation fails), but ADR 0008 omits this architecture entirely, leaving developers unaware of how rule pack synchronization recovers from corrupted network shares or invalid bundle updates.
- **One-Sentence Fix Note**: Document the 4-stage atomic sync protocol (staging, validation, LKG backup, and rollback) in ADR 0008.

#### `[SLOW-11]` Incomplete Floor Drain Aluminum/Steel Hole Diameter Derivation
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 2: Opening Schedule Ingestion (`<openingList>`)
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0009 states that floor drain hole diameters are "3.125\" Aluminum / 1.50\" Steel", but does not specify how the material is extracted from XML or how drain type codes map to hole diameters in `NormalizedXmlParser.cs` and `xmlParser.ts`, leading to ambiguous rule predicate authoring for drain cutout verification.
- **One-Sentence Fix Note**: Detail the exact logic mapping floor drain piping/casing material to hole cutout diameters (3.125\" vs 1.50\") in ADR 0009 § Decisions 2.

#### `[SLOW-12]` Deflection Testing Ingestion vs Display Policy Ambiguity
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 6: Deflection Testing & Quality Standards
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: ADR 0009 states deflection testing is ingested strictly as an AST rule predicate for structural framing rules rather than user-facing general specification display, but does not clarify how `testingOptions.deflectionTest` is exposed in `FactRegistry` (key `unit.testing.deflectionTest` or `unit.deflectionTest`), causing rule authors to search for the wrong fact path.
- **One-Sentence Fix Note**: Document the exact fact key (`unit.testing.deflectionTest` / `testing.deflectionTest`) and enum value options in ADR 0009 § Decisions 6.

---

### 3.3. Minor (Low)

#### `[MINOR-01]` Discrepancy Between Dedicated Parser Class vs Module Function in TypeScript
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 2: Order Metadata Trace Extraction
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0004 states "Implement `OrderRevParser` in both C# Core and TypeScript", but in the TypeScript codebase, there is no standalone `OrderRevParser` class; instead, it is implemented as a standalone function `parseOrderRevXml` inside `src/services/xmlParser.ts`, causing agents searching for `OrderRevParser.ts` to conclude the TypeScript parser is missing.
- **One-Sentence Fix Note**: Clarify in ADR 0004 that the TypeScript implementation is exported as `parseOrderRevXml` within `src/services/xmlParser.ts` rather than a standalone class file.

#### `[MINOR-02]` Formula Adaptation Cell Reference Discrepancy on Check Information
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 2: Formula Adaptation Engine on Check Information
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0005 mentions scanning `B8..B15` and `C8..C15` on `Check Information`, but omits mentioning that `C8..C15` are the detailer count/formula cells while `B8..B15` are the checker formula cells, and does not document the exact formula syntax generated for `B19` (`H1` sum across all active sheets) and `B20` (`J1` sum across Base/Housing/Paperwork).
- **One-Sentence Fix Note**: Detail the specific column roles (`B` for checker and `C` for detailer counts) and exact formula syntax for `B19` and `B20` in ADR 0005 § Decisions 2.

#### `[MINOR-03]` Unspecified Segment Template Catalog Defaults
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 2: Structural Graph Synthesis Engine
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0006 mentions default segments (Supply Fan `FS`, Cooling Coil `CC`, Access `XA`, Filter `FF`) but omits the full list of 8+ segment catalog presets defined in `AVAILABLE_SEGMENT_TEMPLATES` (`IP`, `MB`, `FF`, `RF`, `HC`, `CC`, `FS`, `FR`, `FE`, `XA`, `DP`, `HW`), leaving developers unaware of the full preconfigured template set.
- **One-Sentence Fix Note**: Reference the complete list of available segment templates in `AVAILABLE_SEGMENT_TEMPLATES` in ADR 0006 § Decisions 2.

#### `[MINOR-04]` Ambiguous Payload Structure for `exportExcelDeliverable`
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Decisions 2: 11-Action Bridge Method Catalog
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: The table lists `exportExcelDeliverable` payload as `{ templatePath, outputPath, ... }`, but in practice the frontend passes `{ facts, sqItems, checklists, rules, graph, generalComments, defaultName, isDraft }`, while `templatePath` is resolved internally by `BridgeHandler` from the active rule pack path, and `outputPath` is prompted via `SaveFileDialog` if omitted.
- **One-Sentence Fix Note**: Update the payload and return schema for `exportExcelDeliverable` in ADR 0007 to match the actual parameters passed by `desktopBridge.ts` and consumed by `BridgeHandler.cs`.

#### `[MINOR-05]` Missing Browser Fallback Behavior for Rule Editor Studio
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 1: Standalone Desktop Application & Delivery
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: ADR 0008 focuses on `RuleEditor.exe`, without documenting how the web application operates when launched via Vite (`/rule-editor.html`), where publishing downloads a JSON blob instead of saving to local directories.
- **One-Sentence Fix Note**: Note the browser preview fallback mode for `rule-editor.html` in ADR 0008, clarifying that web users receive export downloads in place of direct disk writes.

#### `[MINOR-06]` Incomplete Fact Naming Catalog for Opening Schedules
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 2: Opening Schedule Ingestion
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0009 lists opening classes (`UnitDoor`, `UnitDamper`, `UnitFloorDrain`), but does not document the indexed fact key convention used in `FactRegistry` (e.g. `door.{id}.width`, `damper.{id}.bladeType`, `drain.{id}.holeDiameter`), requiring agents to inspect `FactExtractor.cs` to write door/damper rules.
- **One-Sentence Fix Note**: List the standard indexed fact key naming convention for doors, dampers, and floor drains in ADR 0009.

---

## 4. Synthesis & Architectural Alignment

### 4.1. Core Alignment Observations
1. **Frontend / Backend Role Split**:
   - The desktop architecture uses **WebView2** hosted inside a native C# WinForms shell.
   - Core domain parsing (`xmlParser.ts`), fact extraction (`factRegistry.ts`), and rule evaluation (`ruleEvaluator.ts`) run primarily in the TypeScript frontend.
   - The C# backend acts as a high-integrity OS host handling 32-bit native UPZ decompression (`unpack32.exe`), OpenXML spreadsheet synthesis (`OpenXmlTemplatePatcher.cs`), rule pack integrity hashing (`RulePackManager.cs`), and native Windows dialogs.
   - Dual-language implementations of `NormalizedXmlParser.cs` and `AstRuleEvaluator.cs` exist in C# primarily for backend xUnit test verification and headless automation.

2. **Target Framework Unification**:
   - All C# projects target `.NET 8.0` (`net8.0` / `net8.0-windows`). References to `.NET 10` in ADR 0007 and ADR 0008 should be harmonized or explicitly marked as forward-looking roadmap targets.

3. **Integrity and Canonical Serialization**:
   - The rule pack publishing and verification pipeline strictly mandates LF line endings, specific artifact names, and composite SHA-256 bundle verification. ADR 0008 should be updated with this exact specification to prevent bundle validation failures.

---

## 5. Verification & Validation Summary

- **C# xUnit Test Suite**: 28 tests executed via `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` (28 passed, 0 failed, duration: ~5s).
- **Node.js AST Converter Suite**: 5 tests executed via `node scripts/test_ast_converter.mjs` (5 passed, 0 failed).
- **File & Path Verification**: 100% of cited file paths, method names, and line numbers were verified against actual repository files.

