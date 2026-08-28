# Comprehensive Repository Documentation Gap & Inaccuracy Audit

**Date**: 2026-08-28  
**Audit Scope**: Entire Repository Documentation Suite (23 Files across Root, Architecture, Decisions, Operations, Guides, and Historical Audits)  
**Perspective**: Fresh AI Agent Onboarding with Zero Prior Memory  
**Target Deliverable**: `audits/documentation_gap_audit.md`  
**Status**: Authoritative & Complete  

---

## 1. Executive Summary

A comprehensive, line-by-line verification audit of the entire documentation suite for the **Detailer Verification List Project** (`Detailer-Verification-List-Project`) was conducted from the perspective of an autonomous AI agent onboarding to the repository with a clean context window. Every claim, path, CLI command, framework version, architecture boundary, build instruction, IPC contract, fact provenance definition, and AST evaluation rule was cross-referenced against the authoritative source code (`src/backend/**/*.csproj`, `src/services/`, `src/components/`, `src/ruleEditor/`, `resources/rulepack/`, `scripts/`, `tests/`, and root batch automation scripts).

Across the 23 audited markdown and JSON documentation files, **86 distinct documentation gaps and inaccuracies** were identified, cataloged, and prioritized into three severity tiers:
- **Blocks the Reader (Critical)**: **21 findings** — Gaps or inaccuracies that directly prevent building, executing, testing, publishing, or correctly understanding core architectural boundaries and safety guarantees.
- **Slows the Reader (Moderate)**: **43 findings** — Ambiguities, implicit knowledge, missing error recovery paths, or incomplete catalogs that force guessing, code diving, and trial-and-error.
- **Minor (Low)**: **22 findings** — Cosmetic inconsistencies, missing helper fixture mentions, dead links to deleted scratch folders, or minor token defaults that do not impede execution.

---

### 1.1. Key Systemic Documentation Issues

The audit revealed seven recurring, cross-cutting systemic themes across the documentation suite:

1. **The .NET 8 vs. .NET 10 Framework Drift**:
   Multiple core documents (`README.md`, `PROJECT.md`, `docs/architecture/README.md`, `docs/operations/development.md`, `ADR 0001`, `ADR 0007`, `docs/AHU_Verification_E2E_Workflow_Audit.md`, and `docs/documentation_staleness_report.md`) claim the application is built on or requires `.NET 10` (`net10.0` / `net10.0-windows`). In reality, all four C# project files (`AHUVerification.App.csproj`, `AHUVerification.Core.csproj`, `AHUVerification.RuleEditor.csproj`, `AHUVerification.Tests.csproj`) target `net8.0` / `net8.0-windows`, and repository environment validation (`scripts/init_env.bat`) verifies `.NET 8.0 or later`. This represents documentation-first drift where future roadmap targets were documented as current reality.

2. **Ghost Paths and Removed Artifacts**:
   - `README.md` depicts baseline rulepack files residing in `src/rulepack/`; the canonical files reside exclusively in `resources/rulepack/`.
   - `docs/architecture/README.md` frontmatter scope indexes non-existent files (`implementation_plan.md`, `spike/**`).
   - `docs/operations/validation.md` directs developers to execute `dotnet run --project spike/OpenXmlSpike`, which fails immediately with `MSB1009: Project file does not exist`.
   - `docs/documentation_staleness_report.md` contains extensive references to `docs/roolz/`, an obsolete temporary folder that has been completely removed.

3. **Broken CLI Commands & Publishing Desynchronization**:
   `docs/operations/development.md` provides broken publish commands targeting `artifacts/publish/win-x64` with `--self-contained true`, directly contradicting the repository's authoritative release automation (`publish-release.bat`), which publishes `AHUVerification.App` to `publish\AHUVerification` and `AHUVerification.RuleEditor` to `publish\RuleEditor` with `--self-contained false`.

4. **IPC Action Catalog Discrepancies**:
   Both `docs/architecture/README.md` and `docs/decisions/0007-typed-ipc-bridge-protocol.md` document a 11-action IPC catalog that includes a phantom `parseXml` action (which is actually executed client-side in TypeScript and throws an `Unknown bridge action` exception if invoked over IPC), while omitting actively implemented host actions (`checkRulePackUpdate`, `selectFolderDialog`, and `publishRulePack`).

5. **Stale Project Identity in `PROJECT.md`**:
   `PROJECT.md` was overwritten during a previous code duplication audit and currently lists code duplication clusters and duplication milestones instead of the AHU Detailing Verification system's feature set, domain architecture, and active project milestones.

6. **Fact Provenance & Safety Confidence Contradictions**:
   Both `docs/field_derivation_report.md` and `docs/AHU_Verification_E2E_Workflow_Audit.md` assert that calculated skid weight has `RequiresConfirmation` confidence and gates rule `BASE-01` into a blocking `NeedsInput` state. In actual code (`FactExtractor.cs:698` and `src/services/factRegistry.ts:568`), `skid.<id>.weight` is initialized as `Authoritative`, evaluating immediately without blocking.

7. **OpenXML Style Index and File Lock Dependencies**:
   `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` omits that dynamic row generation in `OpenXmlTemplatePatcher.cs` relies on hardcoded numeric `StyleIndex` constants tied to `template.xlsx`, and provides zero error-handling guidance for file concurrency collisions when Microsoft Excel locks the output deliverable.

---

### 1.2. Summary Breakdown by Severity Tier vs. Document Category

| Document Category | Documents Audited | Blocks the Reader (Critical) | Slows the Reader (Moderate) | Minor (Low) | Total Findings |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Root Documentation** (`README.md`, `PROJECT.md`, `AGENTS.md`, `GEMINI.md`) | 4 | 4 | 6 | 4 | **14** |
| **Architecture & Decisions** (`docs/architecture/README.md`, `docs/decisions/README.md`, ADRs 0001–0009) | 11 | 10 | 21 | 10 | **41** |
| **Operations & Guides** (`docs/operations/development.md`, `docs/operations/validation.md`, `docs/rule_and_logic_editor_guide.md`) | 3 | 3 | 9 | 3 | **15** |
| **Historical Audits & Reports** (`AHU_Verification_E2E_Workflow_Audit.md`, `staleness_report.md`, `field_derivation_report.md`, `code_duplication_audit.md`, `context-manifest.json`) | 5 | 4 | 7 | 5 | **16** |
| **Total** | **23** | **21** | **43** | **22** | **86** |

---

### 1.3. Summary Breakdown by Gap Dimension

| Gap Dimension | Blocker (Critical) | Slows (Moderate) | Minor (Low) | Total | Dimension Focus |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Missing Information** | 4 | 13 | 10 | **27** | Missing run commands, web routes, LKG sync specs, AST test scripts, fact dictionary entries |
| **Unstated Assumption** | 0 | 8 | 1 | **9** | Unstated 32-bit execution, trailing slash on unpacker, `$env:PLUGIN_ROOT`, CodeGraph optionality |
| **Ambiguous Step** | 1 | 3 | 6 | **10** | 5-inch geometric tolerance window, manifest hashing prerequisites, verification mode semantics |
| **Unguided Error Scenario** | 2 | 7 | 1 | **10** | Decompression failure codes, Excel file locking, missing frontend dist on publish, autosave corruption |
| **Outdated / Contradictory** | 14 | 12 | 4 | **30** | .NET 10 vs .NET 8, `src/rulepack/` vs `resources/rulepack/`, dead `spike/` commands, skid weight provenance |
| **Total** | **21** | **43** | **22** | **86** | |

---

## 2. Target Documents Audited (Verification Checklist)

The following 23 files represent the complete documentation suite verified against active repository code:

- [x] **Root Documentation**:
  - [x] `README.md` — Root project overview, architecture summary, and quick start guide.
  - [x] `PROJECT.md` — Project context, feature inventory, active milestones, and code layout.
  - [x] `AGENTS.md` — Agent Ground repository rules, context boundaries, and agent contracts.
  - [x] `GEMINI.md` — Tool and agent directive passthrough to `AGENTS.md`.
- [x] **Architecture Specification**:
  - [x] `docs/architecture/README.md` — System architecture specification, subsystem breakdown, IPC catalog, and invariants.
- [x] **Architecture Decision Records (ADRs)**:
  - [x] `docs/decisions/README.md` — Index of architectural decision records.
  - [x] `docs/decisions/0001-ahu-verification-desktop-architecture.md` — Core desktop host and frontend architecture.
  - [x] `docs/decisions/0002-ui-ux-design-specification.md` — UI layout, Special Quotes manager, and fact resolution model.
  - [x] `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` — Rule pack packaging, integrity, and desktop delivery.
  - [x] `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` — UPZ bundle decompression and order metadata traces.
  - [x] `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` — Dynamic Excel deliverable synthesis and scratchpad pruning.
  - [x] `docs/decisions/0006-manual-unit-graph-synthesis.md` — Manual unit setup wizard and structural graph synthesis.
  - [x] `docs/decisions/0007-typed-ipc-bridge-protocol.md` — Typed asynchronous IPC bridge between WebView2 and .NET host.
  - [x] `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` — Standalone Rule Editor desktop studio and visual AST authoring.
  - [x] `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` — UPZ baseline fact extraction and rule predicate expansion.
- [x] **Operations & User Guides**:
  - [x] `docs/operations/development.md` — Developer environment setup, build, test, and publishing runbook.
  - [x] `docs/operations/validation.md` — Quality assurance runbook, test execution, and Agent Ground validation.
  - [x] `docs/rule_and_logic_editor_guide.md` — Rule authoring manual, fact dictionary catalog, and AST operator guide.
- [x] **Historical Audits & Analysis Reports**:
  - [x] `docs/AHU_Verification_E2E_Workflow_Audit.md` — End-to-end verification workflow audit and checkpoint verification.
  - [x] `docs/documentation_staleness_report.md` — Point-in-time staleness audit report (2026-08-26).
  - [x] `docs/field_derivation_report.md` — Comprehensive fact derivation catalog, XML mappings, and confidence ratings.
  - [x] `audits/code_duplication_audit.md` — Repository-wide code duplication audit, DRY refactoring plan, and script inventory.
  - [x] `docs/context-manifest.json` — Agent Ground tracked context manifest and commit baseline.

---

## 3. Prioritized Gap Catalog

---

### 3.1. Tier 1: Blocks the Reader (Critical)

#### `[BLOCKER-01] Non-Existent src/rulepack/ Directory Path in Repository Structure Tree`
- **Document & Section Reference**: `README.md` § 📂 Repository Structure (lines 65–70)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The repository layout diagram in `README.md` asserts that baseline rulepack files (`rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`, `manifest.json`) reside under `src/rulepack/`. An AI agent attempting to read, inspect, or edit rules in `src/rulepack/` will encounter missing file errors because `src/rulepack/` does not exist in the repository; all baseline rulepack files are located in `resources/rulepack/`.
- **One-Sentence Fix Note**: Update the repository tree in `README.md` to remove `src/rulepack/` and accurately reflect `resources/rulepack/` as the sole baseline rulepack directory.

#### `[BLOCKER-02] .NET 10 Framework Version Contradiction Against Project Configurations`
- **Document & Section Reference**: `README.md` § 🛠️ Prerequisites & Requirements (line 98) & § ⚡ Quick Start (line 16)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: `README.md` states the project requires the `.NET 10 SDK` and advertises the desktop app as `.NET 10 + WebView2`, whereas all `.csproj` files (`AHUVerification.Core`, `AHUVerification.App`, `AHUVerification.RuleEditor`, `AHUVerification.Tests`) target `net8.0` / `net8.0-windows` and `scripts/init_env.bat` validates `.NET 8.0 or later`. A fresh agent configuring an environment or modifying build targets will be misled about the actual target framework.
- **One-Sentence Fix Note**: Align `README.md` prerequisites and descriptions to clearly state .NET 8 (TFM `net8.0`/`net8.0-windows`) with .NET 10 SDK forward compatibility.

#### `[BLOCKER-03] Stale Project Scope and Feature Inventory Overwritten by Code Duplication Audit`
- **Document & Section Reference**: `PROJECT.md` § Project: Code Duplication Audit & DRY Remediation (lines 1–48)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: `PROJECT.md` currently contains the title, feature inventory (24 duplication clusters), and milestones (M0–M3) from a previously completed code duplication audit task, completely displacing the AHU Detailing Verification application's actual feature inventory and durable architectural goals. A fresh AI agent reading `PROJECT.md` will misinterpret the repository as a code duplication utility rather than an engineering verification desktop suite.
- **One-Sentence Fix Note**: Reset `PROJECT.md` to document the primary AHU Detailing Verification System architecture, domain feature inventory, and active project milestones.

#### `[BLOCKER-04] Unresolvable Reference to Non-Existent .agents/state/current.md`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (line 4)
- **Gap Category**: `Missing Information`
- **Impact Description**: Line 4 instructs agents: "Read docs/architecture/README.md, relevant ADRs under docs/decisions/, and .agents/state/current.md when present before substantial changes." However, `.agents/state/current.md` does not exist in the repository, and no guidance explains how or when state files are initialized.
- **One-Sentence Fix Note**: Clarify in `AGENTS.md` that `.agents/state/current.md` is an optional runtime checkpoint and describe fallback behavior when the directory does not exist.

#### `[BLOCKER-05] Ghost File and Folder References in Architecture Frontmatter Scope`
- **Document & Section Reference**: `docs/architecture/README.md` § Frontmatter Scope (lines 4–10)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The YAML frontmatter lists `implementation_plan.md` and `spike/**` in the scope definition. Neither `implementation_plan.md` nor `spike/` exists anywhere in the repository. An automated tool or agent indexing architecture scope will fail or flag dead references.
- **One-Sentence Fix Note**: Remove `implementation_plan.md` and `spike/**` from the `scope` array in `docs/architecture/README.md`.

#### `[BLOCKER-06] Inaccurate IPC Action Catalog Contradicting C# and TypeScript Implementations`
- **Document & Section Reference**: `docs/architecture/README.md` § 3. Desktop Host & Typed Asynchronous IPC Bridge (lines 80–85)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The architecture document asserts that the bridge supports 11 actions including `parseXml`, while omitting `checkRulePackUpdate` and `selectFolderDialog`. In reality, `parseXml` is handled locally on the client and is not a bridge action in `BridgeHandler.cs` or `desktopBridge.ts`, whereas `checkRulePackUpdate` and `selectFolderDialog` are actively implemented in `BridgeHandler.cs`. An agent attempting to invoke `parseXml` over IPC will encounter an `Unknown bridge action` exception.
- **One-Sentence Fix Note**: Correct the IPC bridge action list in `docs/architecture/README.md` to match the exact action registry in `BridgeHandler.cs` and `desktopBridge.ts` (removing `parseXml`, adding `checkRulePackUpdate` and `selectFolderDialog`).

#### `[BLOCKER-07] Conflicting TargetFramework Directives Between Decision 1 and Addendum 1`
- **Document & Section Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` § Decisions (line 12) vs § Addendum (line 43)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Decision 1 specifies `.NET 8 / C#`, while Addendum 1 asserts the project is "Standardized on .NET 10 (`net10.0-windows` / `net10.0`)". However, the actual csproj files in the repository target `net8.0` / `net8.0-windows`. An onboarding AI agent cannot determine whether .NET 10 migration was completed, partially reverted, or merely proposed.
- **One-Sentence Fix Note**: Clarify in ADR-0001 Addendum 1 that the project remains configured for `net8.0`/`net8.0-windows` target frameworks while utilizing the .NET 10 SDK toolchain.

#### `[BLOCKER-08] MSBuild Packaging Target Claim Contradicts Actual .csproj Implementation`
- **Document & Section Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` § Addendum — 2. MSBuild Packaging Verification (lines 44–45)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Addendum 2 claims that MSBuild target `ValidatePackagedAssets` enforces that "dist/index.html, all 5 resources/rulepack/ files, and both resources/bin/ native binaries exist prior to publish." In reality, inspection of `AHUVerification.App.csproj` reveals that `ValidatePackagedAssets` only checks `dist\index.html`, `resources\bin\unpack32.exe`, and `resources\bin\ywunpack.dll`—it does NOT check any of the 5 `resources/rulepack/` files. A missing rulepack file will pass MSBuild validation and result in a broken publish package.
- **One-Sentence Fix Note**: Update ADR-0003 Addendum 2 to document the exact asset conditions checked by MSBuild, and recommend expanding the target to validate all `resources/rulepack/` artifacts.

#### `[BLOCKER-09] Hardcoded Developer Fallback Path and Missing Non-Zero Exit Code Handling in UPZ Extractor`
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 1: Native UPZ Decompression Toolchain
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: A fresh AI agent running the backend on a clean machine without local developer environment paths will not know that `UpzBundleExtractor.cs` (lines 43-45) falls back to a hardcoded local developer path (`C:\Users\jbrow263\source\repos\...`), and fails to verify `process.ExitCode` when `unpack32.exe` fails, resulting in an unguided `FileNotFoundException: Config.xml not found` rather than identifying that the 32-bit unpacker failed or required assets were missing.
- **One-Sentence Fix Note**: Update ADR 0004 to document the required deployment asset locations for `unpack32.exe`/`ywunpack.dll` (`resources/bin/`), mandate checking `process.ExitCode` with descriptive error messaging on decompression failure, and remove hardcoded developer fallback assumptions.

#### `[BLOCKER-10] Unguided Excel OpenXML File Lock & Process Concurrency Failures`
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 1: Dynamic Category Sheet Pruning
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: When a detailer or reviewer has the deliverable workbook open in Microsoft Excel, exporting the verification list crashes with an unhandled `IOException` ("process cannot access file") because `OpenXmlTemplatePatcher` performs a direct `File.Copy` and `SpreadsheetDocument.Open` with zero retry logic, locked-file detection, or guided UI recovery steps.
- **One-Sentence Fix Note**: Document file locking behavior and specify standard error handling (prompting the detailer to close Excel or exporting to a timestamped alternate filename) in ADR 0005.

#### `[BLOCKER-11] Single-Language Synthesis Implementation Discrepancy (TypeScript Only vs Backend Absence)`
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 2: Structural Graph Synthesis Engine (`manualUnitFactory.ts`)
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0006 implies that manual unit structural graph synthesis is an application-wide capability, but it exists solely in the TypeScript frontend (`src/services/manualUnitFactory.ts`) with zero C# backend implementation in `AHUVerification.Core`. An agent attempting to invoke headless C# batch jobs or C# tests for manual unit creation will find no backend classes, requiring full understanding that the frontend must synthesize the graph and transfer it over the bridge or `.dvl` save file.
- **One-Sentence Fix Note**: Explicitly document in ADR 0006 that structural graph synthesis is exclusively implemented in the frontend TypeScript runtime (`src/services/manualUnitFactory.ts`) and serialized to `.dvl` or IPC payload for backend consumption.

#### `[BLOCKER-12] Phantom parseXml Action and Missing Bridge Action Catalog Entries`
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Decisions 2: 11-Action Bridge Method Catalog
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0007 lists `parseXml` as an active bridge method (`FE -> BE`), but `parseXml` is entirely absent from `BridgeHandler.cs` (calling it throws `Unknown bridge action: 'parseXml'`). Furthermore, actions that are actively implemented in `BridgeHandler.cs` (`checkRulePackUpdate`, `selectFolderDialog`) and `RuleEditorBridgeHandler.cs` (`publishRulePack`) are missing from the table in ADR 0007, creating confusion over where XML parsing occurs (TypeScript frontend vs C# backend).
- **One-Sentence Fix Note**: Remove `parseXml` from the bridge action table in ADR 0007, clarify that XML parsing occurs client-side in TypeScript, and document the actual `checkRulePackUpdate`, `selectFolderDialog`, and `publishRulePack` bridge actions.

#### `[BLOCKER-13] Missing Rule Pack Canonical Hashing Spec & Manifest Verification Protocol`
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 5: Draft Review, Semantic Versioning, and Publishing Pipeline
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0008 states that `RulePackManager.PublishToDirectory` computes canonical UTF-8 SHA-256 hashes, but omits the exact hashing algorithm: JSON must be normalized with `\n` (LF line endings) without CRLF, keys formatted with specific indentation, and `bundleSha256` computed as the SHA-256 of the newline-joined list of `filename:hash` pairs for the 4 required artifacts (`rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`). Any tool or script failing to replicate this exact protocol will produce invalid rule packs rejected by the desktop application.
- **One-Sentence Fix Note**: Provide the complete specification for LF normalization, individual artifact hashing, and composite `bundleSha256` calculation in ADR 0008 § Decisions 5.

#### `[BLOCKER-14] Undocumented Tiered vs Stacked Geometric Classification Rules & Tolerance Limits`
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 4: Tiered vs. Stacked Unit Structural Semantics
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: ADR 0009 defines tiered units as $y > \text{defaultBaseHeight} + 10$ without an independent base, and stacked units as $y > 15$, but omits the exact tolerance comparisons used in code (`Math.Abs(b.Dimensions.Y - parsedGeom.Y) < 5` in `NormalizedXmlParser.cs` line 247). An agent attempting to replicate the unit graph or write verification rules for multi-deck units will misclassify elevated segments if they do not know the 5-inch elevation tolerance or default base height fallback.
- **One-Sentence Fix Note**: Specify the exact mathematical conditions and 5-inch elevation tolerance window for tiered and stacked unit classification in ADR 0009 § Decisions 4.

#### `[BLOCKER-15] Outdated .NET SDK Prerequisite Target in Development Runbook`
- **Document & Section Reference**: `docs/operations/development.md` § Prerequisites (Line 4)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: A fresh AI agent reading line 4 is instructed to install and configure the ".NET 10 SDK" and build with .NET 10 toolchains. In reality, all project files (`AHUVerification.App.csproj`, `AHUVerification.Core.csproj`, `AHUVerification.RuleEditor.csproj`, `AHUVerification.Tests.csproj`) target `net8.0` / `net8.0-windows`, and `scripts/init_env.bat` explicitly verifies `.NET SDK v8.0 or later`. Following the documentation causes toolchain confusion and unnecessary SDK installation attempts.
- **One-Sentence Fix Note**: Update the prerequisites section to specify .NET 8.0 SDK (or .NET 8.0+ SDK targeting `net8.0`/`net8.0-windows`) to match actual project framework targets and environment validation scripts.

#### `[BLOCKER-16] Contradictory and Broken Publishing Commands and Target Paths`
- **Document & Section Reference**: `docs/operations/development.md` § Build & Test Commands (Lines 42–43)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 42 instructs publishing to `artifacts/publish/win-x64` with `-p:PublishSingleFile=false` and `--self-contained true`, but the repository's authoritative release script `publish-release.bat` publishes `AHUVerification.App` to `publish\AHUVerification` and `AHUVerification.RuleEditor` to `publish\RuleEditor` with `--self-contained false`. Following `development.md` produces a fragmented deployment missing the Rule Editor and placing assets in an unreferenced `artifacts/` folder.
- **One-Sentence Fix Note**: Align publish commands and target output directories with `publish-release.bat` (`publish\AHUVerification` and `publish\RuleEditor`) and document both application artifacts.

#### `[BLOCKER-17] Dead Reference to Non-Existent Spike Project in Validation Runbook`
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 28–31)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 30 directs readers to execute `dotnet run --project spike/OpenXmlSpike` to validate OpenXML schema roundtripping. The `spike/` directory does not exist in the repository; executing this command immediately terminates with error `MSB1009: Project file does not exist`, halting automated CI/validation runs.
- **One-Sentence Fix Note**: Remove the obsolete `spike/OpenXmlSpike` command from `validation.md` or replace it with the active test fixture command in `AHUVerification.Tests`.

#### `[BLOCKER-18] Contradictory Skid Weight Provenance and AST Evaluation Semantics`
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` § 3 Phase 3 (Lines 198–200) & § 7 Checkpoint 2 (Line 386)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The document asserts that `skid.<id>.weight` is always initialized with `Status = Derived` and `Confidence = RequiresConfirmation`, forcing rule `BASE-01` to evaluate to `NeedsInput` until explicitly confirmed by the detailer. In actual code (`FactExtractor.cs:698` and `src/services/factRegistry.ts:568`), `skid.<id>.weight` is initialized with `Confidence = Authoritative`, meaning `BASE-01` evaluates immediately to `Applicable` without gating. An agent relying on this document will expect mandatory confirmation blockers that do not occur in code.
- **One-Sentence Fix Note**: Reconcile documentation with code to state that calculated skid weight defaults to Authoritative derivation, and document the optional manual confirmation/override pathway.

#### `[BLOCKER-19] Historical Staleness Report Preserves Outdated .NET 10 Claims and Obsolete docs/roolz Directory References`
- **Document & Section Reference**: `docs/documentation_staleness_report.md` § 1 Executive Summary (Line 22) & § 2 Freshness Matrix (Lines 44–45)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: This report repeatedly asserts that the codebase is standardized on ".NET 10 (`net10.0` / `net10.0-windows`)" (lines 22, 61, 150) and refers heavily to an out-of-sync directory `docs/roolz/` (lines 21, 44, 45, 97, 240, 256, 262, 291). In reality, the codebase targets `net8.0`/`net8.0-windows`, and `docs/roolz/` does not exist in the repository (it was an intermediate temporary folder). A fresh AI agent reading this historical report will attempt to target .NET 10 and search for non-existent `docs/roolz/` files.
- **One-Sentence Fix Note**: Add an archival header stating that this document is a historical point-in-time audit (2026-08-26) superseded by current .NET 8 configuration and `resources/rulepack/` structure, and note that `docs/roolz` has been deleted.

#### `[BLOCKER-20] Contradictory Skid Weight Confidence Rating vs Actual Code Implementation`
- **Document & Section Reference**: `docs/field_derivation_report.md` § 4.1 Strict Skid Weight Semantics (Lines 164–167)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Section 4.1 states that `skid.weight` is assigned `status: Derived`, `confidence: RequiresConfirmation`, and promptNote: *"Sum of segments = X lbs. Confirm or override official lifting weight."* In reality, `FactExtractor.cs:698` and `src/services/factRegistry.ts:568` assign `confidence: 'Authoritative'` and no prompt note. This contradiction causes confusion regarding whether lifting weight requires user confirmation before rules execute.
- **One-Sentence Fix Note**: Update Section 4.1 to reflect actual code confidence assignment (`Authoritative`) or document the difference between runtime automated calculation and manual override workflows.

#### `[BLOCKER-21] Severely Restricted Scoping and Outdated Verified Commit in Agent Ground Manifest`
- **Document & Section Reference**: `docs/context-manifest.json` Lines 1–19
- **Gap Category**: `Missing Information`
- **Impact Description**: `context-manifest.json` only tracks a single document (`docs/architecture/README.md`) against commit `7a8ff4489f01b6891c1e32721737176353fb976b`. It completely ignores all other assigned documentation files (`development.md`, `validation.md`, `rule_and_logic_editor_guide.md`, `AHU_Verification_E2E_Workflow_Audit.md`, `documentation_staleness_report.md`, `field_derivation_report.md`, `code_duplication_audit.md`), ADRs 0005–0009, and root documentation. Furthermore, the verified commit is 7 commits behind HEAD (`7cd24b5`), causing Agent Ground checks to treat repository context as stale.
- **One-Sentence Fix Note**: Expand `context-manifest.json` to include all documentation files, operational runbooks, and ADRs in its tracking scope, and update `verified_at_commit` to current HEAD.

---

### 3.2. Tier 2: Slows the Reader (Moderate)

#### `[SLOW-01] Unstated Fallback Behavior in Browser Preview Mode`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 1. Developing Frontend Interfaces (lines 106–112)
- **Gap Category**: `Missing Information`
- **Impact Description**: The guide instructs developers to open `http://localhost:5173/` in a web browser without explaining that browser preview mode operates without the C# WebView2 IPC bridge, causing native features (UPZ decompression, native OpenXML file generation, native file dialogs) to run in mock or degraded browser-only fallback mode.
- **One-Sentence Fix Note**: Add a note to Development Workflow 1 explaining that standard browser mode uses client-side fallbacks (SheetJS export, localStorage) and requires the WebView2 desktop host for full OpenXML and native UPZ extraction capabilities.

#### `[SLOW-02] Missing Manifest Hashing Prerequisite for Passing Automated Tests`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 3. Editing & Validating Rules (lines 118–122) & 4. Running Automated Tests (lines 124–135)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: If an agent edits `resources/rulepack/rules.json` and runs `dotnet test` or `run-tests.bat` without first executing `build-rulepack.bat` (`node scripts/build_rulepack.mjs`), `RulePackManagerTests` will fail due to a SHA-256 manifest mismatch. The workflow does not explicitly warn that rule edits invalidate the test suite until re-hashed.
- **One-Sentence Fix Note**: Explicitly state in Workflow 3 and 4 that `build-rulepack.bat` must be executed after any rulepack JSON modification before running the test suite.

#### `[SLOW-03] Unguided Release Build Failure on Missing Frontend Dist Directory`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 5. Packaging & Deploying Releases (lines 136–143)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: If an agent runs `dotnet publish` directly instead of `publish-release.bat`, MSBuild target `ValidatePackagedAssets` fails with an error if `npm run build` has not been executed first. The documentation does not explain this dependency chain or provide recovery steps.
- **One-Sentence Fix Note**: Document in the packaging section that `npm run build` is a mandatory prerequisite before running `dotnet publish` to prevent MSBuild asset validation failures.

#### `[SLOW-04] Framework Version Inconsistency in Project Architecture Summary`
- **Document & Section Reference**: `PROJECT.md` § Architecture (line 5)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 5 lists `C# .NET 10 Core Engine`, contradicting the actual `net8.0` target in `src/backend/AHUVerification.Core/AHUVerification.Core.csproj`.
- **One-Sentence Fix Note**: Update the architecture summary in `PROJECT.md` to specify .NET 8 (TFM `net8.0`) for the Core engine.

#### `[SLOW-05] Undefined and Non-Executable Agent Ground status CLI Command`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (line 5)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: Line 5 commands agents to "Run Agent Ground status before trusting architecture notes," but `Agent Ground` is not an installed CLI executable or environment path command on the host. An agent attempting to execute `Agent Ground status` in bash/powershell will encounter a command-not-found error.
- **One-Sentence Fix Note**: Clarify whether `Agent Ground status` refers to an external tool/skill or replace it with the specific repository freshness verification steps.

#### `[SLOW-06] Unconditional CodeGraph Reference Without Repository Presence`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (line 6)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: Line 6 states "If .codegraph/ exists, use CodeGraph before grep or manual source wandering". Because `.codegraph/` is not committed or generated by default, fresh agents without CodeGraph MCP context are unsure if CodeGraph generation is required before exploring code.
- **One-Sentence Fix Note**: Clarify in `AGENTS.md` that CodeGraph indexing is optional and that ripgrep/find_by_name are standard primary tools when `.codegraph/` is absent.

#### `[SLOW-07] .NET 10 Framework Claims Inconsistent with Solution TargetFramework net8.0`
- **Document & Section Reference**: `docs/architecture/README.md` § Purpose (line 17) & § 3. Desktop Host (line 81)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The document repeatedly specifies `.NET 10`, but the underlying projects compile against `net8.0` and `net8.0-windows`. Agents designing new backend modules or compiling code might assume .NET 10 runtime/language features that are unavailable in .NET 8.
- **One-Sentence Fix Note**: Update the architecture specification to state .NET 8 as the current project target framework with .NET 10 host SDK support.

#### `[SLOW-08] Unstated Temp Directory and Permissions Assumptions for Native UPZ Decompression`
- **Document & Section Reference**: `docs/architecture/README.md` § 2. Ingestion & Data Pipeline (lines 74–75)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: The document explains that `UpzBundleExtractor` invokes `unpack32.exe` / `ywunpack.dll` in an isolated temp directory, but does not state the prerequisite assumptions: 32-bit execution support on Windows x64 host OS, write access to `Path.GetTempPath()`, and execution permissions for spawned subprocesses.
- **One-Sentence Fix Note**: Add a note under Ingestion describing the subprocess execution model, required OS architecture support (32-bit on x64), and temporary directory permissions.

#### `[SLOW-09] Unguided Rule Editor Synchronization Architecture`
- **Document & Section Reference**: `docs/architecture/README.md` § 7. Rule & Logic Editor Desktop Studio (lines 104–110)
- **Gap Category**: `Missing Information`
- **Impact Description**: Section 7 describes the standalone Rule Editor studio and its publishing engine, but omits the workflow explaining how published rulepacks in `resources/rulepack/` are reloaded by the running verification app (`AHUVerification.App`) or propagated across machines.
- **One-Sentence Fix Note**: Add a section explaining the synchronization mechanism between the Rule Editor output and the main application's rulepack loader.

#### `[SLOW-10] Lack of ADR Template, Creation Workflow, and Decision Lifecycle Guidance`
- **Document & Section Reference**: `docs/decisions/README.md` (lines 1–15)
- **Gap Category**: `Missing Information`
- **Impact Description**: `docs/decisions/README.md` contains only a 1-sentence preamble and a markdown link list for ADRs 0001–0009. It provides no guidance on the ADR template structure (Context, Decision, Consequences, Addenda), numbering conventions, or status lifecycle (`Proposed`, `Accepted`, `Superseded`) for agents authoring new ADRs.
- **One-Sentence Fix Note**: Add an ADR authoring standard section to `docs/decisions/README.md` detailing the template format, numbering scheme, and status lifecycle.

#### `[SLOW-11] Ambiguity Between File-Based Autosave (.dvl) and Browser LocalStorage Autosave`
- **Document & Section Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` § Decisions (line 27) vs § Addendum (line 45)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Decision 6 states the application performs "Continuous background autosaving to `%LOCALAPPDATA%/AHUVerification/autosave.dvl`", while Addendum 3 states "Frontend debounces active state autosaves to WebView2 `localStorage` (`ahu_dvl_autosave`)". The documentation does not clarify whether both mechanisms operate simultaneously or if `localStorage` completely superseded the `%LOCALAPPDATA%` file autosave.
- **One-Sentence Fix Note**: Update ADR-0001 to explicitly delineate that client UI state is cached in WebView2 `localStorage` during active editing while project persistence to disk is triggered on explicit Save/Save As.

#### `[SLOW-12] Unguided Recovery for Corrupted Autosave State`
- **Document & Section Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` § Addendum (line 45)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: If the serialized `ahu_dvl_autosave` state in `localStorage` becomes corrupted, malformed, or incompatible with an updated rulepack schema, the application frontend may fail on initial load. ADR-0001 does not specify an automated recovery or schema-version discard policy.
- **One-Sentence Fix Note**: Document error-handling and recovery semantics in ADR-0001 specifying that corrupted or version-mismatched autosave payloads are safely discarded with fallback to empty state.

#### `[SLOW-13] Unguided Special Quote (SQ) Overflow Beyond 22 Excel Slots`
- **Document & Section Reference**: `docs/decisions/0002-ui-ux-design-specification.md` § Decisions — 3. Special Quotes (SQ) & Deviation Manager (lines 23–25)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: Decision 3 notes that the UI displays an active slot counter (`X / 22 slots used`) and maps up to 22 entries into the official Excel template. However, it does not define the system behavior when a detailer enters more than 22 SQs (e.g. whether the UI blocks entry, warns the user, or truncates at export time).
- **One-Sentence Fix Note**: Explicitly state in ADR-0002 the overflow handling policy when >22 SQs are entered (e.g. UI warning and export truncation/validation gating).

#### `[SLOW-14] Unstated Conflict Resolution Policy for Manual Overrides vs. XML Re-Import`
- **Document & Section Reference**: `docs/decisions/0002-ui-ux-design-specification.md` § Decisions — 2. General Unit Interface & 5. Fact Resolution Model (lines 18–21, 33–37)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: The document explains that facts have provenance (`Auto: Config.xml`, `Overridden`, `Manual Entry`), but does not define what happens when a user who has manually overridden facts re-imports a modified `Config.xml` (whether manual overrides are preserved, overwritten, or flagged as conflicts).
- **One-Sentence Fix Note**: Add a specification in ADR-0002 stating that re-importing XML retains manual overrides while updating underlying raw XML baseline values, displaying a conflict badge if values diverge.

#### `[SLOW-15] Unguided Remote Rulepack Sync Failure and LKG Storage Specification`
- **Document & Section Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` § Decisions — 1. Rule Pack integrity (lines 17–18)
- **Gap Category**: `Missing Information`
- **Impact Description**: Decision 1 mentions "Last Known Good (LKG) rollback" during remote sync, but does not define where LKG rulepacks are persisted (directory path), how corrupted sync attempts are isolated, or how detailers are notified when a remote sync fails due to hash or network errors.
- **One-Sentence Fix Note**: Specify the exact LKG local storage directory and fallback error notification protocol in ADR-0003.

#### `[SLOW-16] Trailing Slash Requirement on Unpack Target Directory Undocumented`
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 1: Native UPZ Decompression Toolchain
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: A fresh AI agent attempting to invoke or debug `unpack32.exe` will fail if they do not append a trailing directory separator (`\`) to the second CLI argument, because `unpack32.exe` interprets destination arguments without trailing slashes as target file paths rather than output directories, causing silent failure.
- **One-Sentence Fix Note**: Add explicit documentation in ADR 0004 specifying that `unpack32.exe` strictly requires a trailing backslash on destination folder arguments to output extracted XML files correctly.

#### `[SLOW-17] Inconsistent Fallback Job Name Mock in Fact Extractor`
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 3: Authoritative Fact Provenance & COM # Manual Boundary
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0004 states that for standalone `Config.xml` files where order metadata is absent, order-level facts are left unpopulated or fallback behavior is retained; however, `FactExtractor.cs` (line 51) and `factRegistry.ts` (line 41) hardcode a default dummy string `"Medical Center Phase 3"` instead of leaving `unit.jobName` empty or prompting for user entry with status `Unknown`, leading to misleading automated verification data in XML-only workflows.
- **One-Sentence Fix Note**: Update ADR 0004 to specify the exact fallback behavior for `unit.jobName` when `OrderRev.xml` is absent (either defaulting to empty prompt or documenting the legacy placeholder), aligning the document with code reality.

#### `[SLOW-18] Hardcoded OpenXML Style Index Dependency in Row Synthesis`
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 3: Dynamic Skid-Grouped Verification Rows
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: `OpenXmlTemplatePatcher.cs` hardcodes exact numeric style indices (e.g. `98U`, `70U`, `42U`, `63U`, `78U`, `80U`, `19U`) directly tied to `template.xlsx`'s specific stylesheet table. If an agent modifies `template.xlsx` or adds styles without preserving the exact style indexing order, dynamic row generation outputs incorrect cell borders, zebra shading, and fonts with no compiler or runtime warning.
- **One-Sentence Fix Note**: Document in ADR 0005 that dynamic row styling depends strictly on fixed `StyleIndex` constants corresponding to the packaged `template.xlsx` stylesheet, detailing how new styles or template revisions must be coordinated.

#### `[SLOW-19] Undocumented Category-to-Sheet Mapping Hierarchy (GetCategorySheetName)`
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 1: Dynamic Category Sheet Pruning
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0005 states that category worksheets are pruned if they have zero applicable checks, but does not explain how 20+ rule categories and subgroups (e.g., `UTL`, `Knockdown`, `Internals`, `Coil Segments`) are aggregated and mapped onto the 8 physical scratchpad sheets (`Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, `MOM`), leaving an agent unable to predict whether a custom rule will preserve or delete a given tab.
- **One-Sentence Fix Note**: Include the formal category and subgroup mapping table from `GetCategorySheetName` in ADR 0005, clarifying how categories like `UTL` and `Knockdown` map to `Housing` and how `Internals` subgroups map to specific scratchpads.

#### `[SLOW-20] Incorrect File Path Reference for Manual Unit Factory`
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 2: Structural Graph Synthesis Engine
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The heading in ADR 0006 cites `manualUnitFactory.ts` without full path, but surrounding documentation often references `src/utils/manualUnitFactory.ts`, whereas the actual file is located at `src/services/manualUnitFactory.ts`. An agent attempting to view or import the file from `src/utils/` will encounter a `FileNotFoundException`.
- **One-Sentence Fix Note**: Update ADR 0006 to reference the canonical file path `src/services/manualUnitFactory.ts`.

#### `[SLOW-21] Absence of Default Dimensional Validation and Geometric Constraints`
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 1: Manual Unit Configuration Wizard
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: ADR 0006 does not define minimum/maximum boundaries or validation rules for user input in `ManualUnitModal.tsx` (e.g., negative CFM, 0" width, base heights exceeding total unit height), which can result in malformed segment geometry ($x, y, z \le 0$) that causes downstream rule evaluation errors or broken OpenXML coordinate rendering.
- **One-Sentence Fix Note**: Add explicit input validation constraints and fallback default bounds (e.g., positive non-zero dimensions, valid pressure enum) to ADR 0006.

#### `[SLOW-22] Target Framework Version Inconsistency (.NET 10 vs .NET 8)`
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Title & § Context
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0007 titles and describes the host as `.NET 10` (`AHUVerification.App`), but all `.csproj` files (`AHUVerification.App.csproj`, `AHUVerification.Core.csproj`, `AHUVerification.RuleEditor.csproj`), `Directory.Build.targets`, and `scripts/init_env.bat` target `net8.0-windows` / `net8.0`. An onboarding agent will attempt to locate or configure .NET 10 SDKs when .NET 8.0 is the active project target.
- **One-Sentence Fix Note**: Update ADR 0007 (and related docs) to reflect the actual target framework `net8.0-windows` (or clarify that .NET 10 is a future roadmap target while .NET 8 is currently shipped).

#### `[SLOW-23] Missing UI Thread Synchronization (Form.Invoke) and Timeout Guidance`
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Decisions 1: Protocol Transport
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: ADR 0007 does not document that WebView2 IPC messages arrive on background thread contexts that require WinForms `Form.Invoke` for UI operations (`OpenFileDialog`, `SaveFileDialog`, `FolderBrowserDialog`), nor does it document the 30-second client-side timeout in `desktopBridge.ts`. If an agent adds a bridge action that touches WinForms controls without `Invoke`, the application will suffer cross-thread exceptions or deadlock.
- **One-Sentence Fix Note**: Document the requirement for UI thread marshaling (`Form.Invoke`) for dialog actions and specify the 30-second request timeout mechanism in ADR 0007.

#### `[SLOW-24] Host Framework Version and Assembly Name Discrepancy in Rule Editor`
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 1: Standalone Desktop Application & Delivery
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: ADR 0008 references `.NET 10` and `RuleEditor.exe`, but the project file `AHUVerification.RuleEditor.csproj` targets `net8.0-windows` with `<AssemblyName>RuleEditor</AssemblyName>`. Furthermore, the bridge handler is named `RuleEditorBridgeHandler.cs` (handling 5 actions: `getAppInfo`, `getRulePack`, `publishRulePack`, `openFileDialog`, `selectFolderDialog`), distinct from the main app's `BridgeHandler.cs`.
- **One-Sentence Fix Note**: Align ADR 0008 with `net8.0-windows` and document the dedicated `RuleEditorBridgeHandler` action catalog.

#### `[SLOW-25] Undocumented Remote Sync Staging, Validation, and LKG Rollback Protocol`
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 5: Draft Review, Semantic Versioning, and Publishing Pipeline
- **Gap Category**: `Missing Information`
- **Impact Description**: `RulePackManager.cs` implements an atomic 4-stage synchronization pipeline (Stage $\to$ Validate $\to$ Backup to LKG $\to$ Promote, with automatic rollback if validation fails), but ADR 0008 omits this architecture entirely, leaving developers unaware of how rule pack synchronization recovers from corrupted network shares or invalid bundle updates.
- **One-Sentence Fix Note**: Document the 4-stage atomic sync protocol (staging, validation, LKG backup, and rollback) in ADR 0008.

#### `[SLOW-26] Incomplete Floor Drain Aluminum/Steel Hole Diameter Derivation`
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 2: Opening Schedule Ingestion (`<openingList>`)
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0009 states that floor drain hole diameters are "3.125\" Aluminum / 1.50\" Steel", but does not specify how the material is extracted from XML or how drain type codes map to hole diameters in `NormalizedXmlParser.cs` and `xmlParser.ts`, leading to ambiguous rule predicate authoring for drain cutout verification.
- **One-Sentence Fix Note**: Detail the exact logic mapping floor drain piping/casing material to hole cutout diameters (3.125\" vs 1.50\") in ADR 0009 § Decisions 2.

#### `[SLOW-27] Deflection Testing Ingestion vs Display Policy Ambiguity`
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 6: Deflection Testing & Quality Standards
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: ADR 0009 states deflection testing is ingested strictly as an AST rule predicate for structural framing rules rather than user-facing general specification display, but does not clarify how `testingOptions.deflectionTest` is exposed in `FactRegistry` (key `unit.testing.deflectionTest` or `unit.deflectionTest`), causing rule authors to search for the wrong fact path.
- **One-Sentence Fix Note**: Document the exact fact key (`unit.testing.deflectionTest` / `testing.deflectionTest`) and enum value options in ADR 0009 § Decisions 6.

#### `[SLOW-28] Missing Dual-Host Execution and Web Route Guidance for Rule Editor`
- **Document & Section Reference**: `docs/operations/development.md` § Running the Application (Lines 15–23)
- **Gap Category**: `Missing Information`
- **Impact Description**: The document explains how to launch the main desktop host (`dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj`) and run Vite (`npm run dev`), but completely omits how to run the desktop Rule Editor (`AHUVerification.RuleEditor`) or navigate to `/rule-editor.html` in browser mode, leaving a new agent unable to develop or test rule editing without searching the codebase.
- **One-Sentence Fix Note**: Add run commands for the Rule Editor desktop host (`dotnet run --project src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj`) and the browser route (`http://localhost:5173/rule-editor.html`).

#### `[SLOW-29] Omission of Root Convenience Workflow Scripts in Development Runbook`
- **Document & Section Reference**: `docs/operations/development.md` § Quickstart Setup (Lines 8–14)
- **Gap Category**: `Missing Information`
- **Impact Description**: The quickstart only mentions `setup.bat`, omitting existing root workflow automation scripts (`build-all.bat`, `build-backend.bat`, `build-frontend.bat`, `build-rulepack.bat`, `launch-app.bat`, `launch-rule-editor.bat`, `menu.bat`, `run-tests.bat`, `start-dev.bat`), forcing agents to manually execute fragmented CLI steps instead of using standard repository automation.
- **One-Sentence Fix Note**: Add a table or inventory summarizing all root batch automation scripts and their intended operational workflows.

#### `[SLOW-30] Unguided Pre-Publish and Build Failure Recovery Scenarios`
- **Document & Section Reference**: `docs/operations/development.md` § Build & Test Commands (Lines 38–46)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: If an agent runs `dotnet publish` without first running `npm run build` or without verifying `resources/bin/unpack32.exe`, MSBuild target `ValidatePackagedAssets` throws a fatal build error with zero troubleshooting guidance in `development.md`.
- **One-Sentence Fix Note**: Add a troubleshooting subsection detailing common build and publish failure causes (e.g. missing `dist/index.html`, missing UPZ native unpack binaries, or missing WebView2 runtime) and their resolution steps.

#### `[SLOW-31] Outdated C# Unit Test Count and Incomplete Test Suite Inventory`
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 5–17)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 5 claims the automated test suite contains "20 Tests", but running `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` executes 28 passed tests across 7 test classes. Furthermore, test descriptions omit coverage details for several test fixtures (`TestGraphFactory`, `TestPipelineContext`, `TestPathHelper`).
- **One-Sentence Fix Note**: Update the test count from 20 to 28 tests and document all test fixture classes included in `AHUVerification.Tests`.

#### `[SLOW-32] Missing Node.js AST Converter Test Suite Execution`
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 3–27)
- **Gap Category**: `Missing Information`
- **Impact Description**: The validation runbook lists C# tests, Vite build, and Rule Pack manifest building, but omits `node scripts/test_ast_converter.mjs` (which is part of `run-tests.bat`), meaning an agent validating the repository will skip frontend AST converter verification.
- **One-Sentence Fix Note**: Add `node scripts/test_ast_converter.mjs` to the Automated Verification section alongside C# test execution.

#### `[SLOW-33] Unstated Assumption and Unguided $env:PLUGIN_ROOT in Agent Ground Runbook`
- **Document & Section Reference**: `docs/operations/validation.md` § Agent Ground Freshness & Rules (Lines 33–42)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: Lines 36 and 40 assume `$env:PLUGIN_ROOT` is populated in the user's environment; if the environment variable is not set, the PowerShell command fails with `Cannot find path` with zero fallback guidance or instructions on locating `agent_ground.py`.
- **One-Sentence Fix Note**: Document the prerequisite for `$env:PLUGIN_ROOT` or provide the standard fallback path `%USERPROFILE%\.gemini\config\plugins\agent-ground\scripts\agent_ground.py` and explain what to do if Python or the plugin is not installed.

#### `[SLOW-34] Missing Web Development Entry Point Guidance for Rule Editor`
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 1. System Architecture & Overview (Lines 67–70)
- **Gap Category**: `Missing Information`
- **Impact Description**: Section 1.1 explains launching `launch-rule-editor.bat` or `menu.bat`, but does not explain how to access the rule editor when running the Vite web server (`npm run dev` serves `rule-editor.html` at `http://localhost:5173/rule-editor.html`), leaving web developers unaware of the multi-page Vite entry point.
- **One-Sentence Fix Note**: Add the local Vite development URL (`http://localhost:5173/rule-editor.html`) and mention `rule-editor.html` rollup entry configuration in Section 1.

#### `[SLOW-35] Unguided Fact Dictionary Discrepancies and Incomplete Fact Catalog`
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 2.3 Fact Dictionary Catalog (Lines 122–168)
- **Gap Category**: `Missing Information`
- **Impact Description**: Table 2.3 lists a subset of facts (32 keys), omitting several active facts present in `FactDictionaryCatalog.ts` and `FactExtractor.cs` (such as opening-level facts `door.*.width`, `damper.*.type`, `floorDrain.*.connectionDiameter`, motor control facts `motorControl.*.disconnectSize`, component facts `fan.*.hasRemovalRail`, `coil.*.bulkheadMaterial`), leading rule authors to assume these facts cannot be targeted in AST predicates.
- **One-Sentence Fix Note**: Expand Table 2.3 or explicitly cross-reference `FactDictionaryCatalog.ts` and `FactExtractor.cs` as the complete, authoritative catalogs of opening and component facts.

#### `[SLOW-36] Unguided Error Scenarios During Rule Publishing and Hashing Divergence`
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 6. Publishing, Semantic Versioning & Integrity Pipeline (Lines 458–492)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: Section 6 describes the happy-path publishing sequence, but provides zero error handling for common failure modes (e.g. read-only permissions on `resources/rulepack/`, duplicate rule IDs, missing `template.xlsx`, CRLF line ending corruption, or IPC bridge timeout in browser mode).
- **One-Sentence Fix Note**: Add a "Publishing Troubleshooting & Rollback" section detailing error codes, duplicate ID validation, line-ending normalization recovery, and LKG fallback behavior.

#### `[SLOW-37] Outdated Rule Pack Manifest Bundle Hash in Verification Checkpoints`
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` § 7 Checkpoint 1 (Line 385) & § 6 (Line 377)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Lines 8, 378, and 386 cite bundle hash `020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28` as the pinned version, but any future rule modification or hash recalculation will invalidate this static string. An auditing agent checking file integrity against hardcoded doc hashes will report false verification failures.
- **One-Sentence Fix Note**: Clarify that the hash in the document is illustrative for v14.0.0 and reference `resources/rulepack/manifest.json` as the authoritative source of runtime bundle identity.

#### `[SLOW-38] Incomplete Omission of Runtime Framework and Dependency Details in Workflow Spec`
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` Header (Line 6) & § 1. Executive Summary (Line 14)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 6 states "Runtime Environment: Windows Desktop (.NET 10 + WebView2)", which contradicts the `.csproj` target framework `net8.0-windows`.
- **One-Sentence Fix Note**: Update the runtime environment header to reflect .NET 8.0 Windows Desktop.

#### `[SLOW-39] Stale Git Commit Baseline Delta and Hardcoded SHA References`
- **Document & Section Reference**: `docs/documentation_staleness_report.md` § Header (Lines 6–7) & § 4.1 Commit Version (Lines 109–115)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Lines 6–7 cite HEAD commit `c17d2ace8a22` and baseline `e9e2e04707a8`. The repository has since progressed multiple commits ahead (`7cd24b5`), rendering the commit delta analysis outdated.
- **One-Sentence Fix Note**: Label commit SHAs and deltas as historical baseline data valid at audit time (2026-08-26).

#### `[SLOW-40] Incomplete Field Inventory for Opening Schedules and Internal Sub-Components`
- **Document & Section Reference**: `docs/field_derivation_report.md` § 2 Fact Taxonomy & Provenance Catalog (Lines 49–89)
- **Gap Category**: `Missing Information`
- **Impact Description**: Table 2 lists unit and skid facts, but omits per-opening facts (`door.*`, `damper.*`, `floorDrain.*`) and sub-component facts (`fan.*`, `coil.*`, `filter.*`, `wheel.*`, `motorControl.*`) which are actively extracted by `FactExtractor.cs` (lines 543–624) and `factRegistry.ts` (lines 426–495).
- **One-Sentence Fix Note**: Add detailed taxonomy tables covering opening schedule facts, component sub-tree facts, and motor control facts extracted from `Config.xml`.

#### `[SLOW-41] Unstated Assumptions Regarding Manual Unit Synthesis Segment Types`
- **Document & Section Reference**: `docs/field_derivation_report.md` § 6 Synthesis Architecture in Manual Creation Mode (Lines 218–239)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: Section 6 states that manual mode creates Skid 1 with `segment_IP`, intermediary skids with `segment_XA`, and final skid with `segment_FS`. It fails to mention that recent commits added custom segment selection and dynamic segment sequence configuration in `manualUnitFactory.ts`.
- **One-Sentence Fix Note**: Update Section 6 to document the enhanced manual unit setup options including custom segment types, dimensions, and dynamic N-skid configuration.

#### `[SLOW-42] Outdated Description of Batch Scripts in Finding DUP-09 and DUP-10 as Unimplemented Refactoring`
- **Document & Section Reference**: `audits/code_duplication_audit.md` § Finding DUP-09 (Line 87) & Finding DUP-10 (Line 88)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Findings DUP-09 and DUP-10 present `scripts/init_env.bat` and `scripts/launch.bat` as proposed future refactorings to be created. In reality, both scripts were already implemented and integrated into root batch files (`setup.bat`, `publish-release.bat`, `launch-app.bat`, `launch-rule-editor.bat`, `build-all.bat`, `run-tests.bat`). An agent reading this audit will think these shared scripts do not exist.
- **One-Sentence Fix Note**: Update findings DUP-09 and DUP-10 to indicate that `scripts/init_env.bat` and `scripts/launch.bat` have already been implemented and are actively utilized across root scripts.

#### `[SLOW-43] Unstated Dependency Assumption for tsx in Finding DUP-04 Remediation Snippet`
- **Document & Section Reference**: `audits/code_duplication_audit.md` § Finding DUP-04 (Lines 121–152) & § 5.2 (Line 1215)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: The remediation snippet for DUP-04 instructs running `tsx scripts/test_ast_converter.mjs` and importing `astConverter.ts` directly, but `tsx` is not installed in `package.json` or `node_modules`. An agent attempting to execute this command without installing `tsx` will get command-not-found errors.
- **One-Sentence Fix Note**: State that `tsx` (or `ts-node`/`vitest`) must be added to `devDependencies` in `package.json` before running the proposed TypeScript test command.

---

### 3.3. Tier 3: Minor (Low)

#### `[MINOR-01] Incomplete List of Test Fixture Classes in Test Runner Reference`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 4. Running Automated Tests (lines 125–135)
- **Gap Category**: `Missing Information`
- **Impact Description**: The test list enumerates 7 test fixtures but omits test helper infrastructure files (`TestGraphFactory.cs`, `TestPipelineContext.cs`, `TestPathHelper.cs`), which agents need to know about when authoring new xUnit tests.
- **One-Sentence Fix Note**: Add a brief note mentioning `TestGraphFactory` and `TestPipelineContext` in the test documentation as standard shared fixture helpers.

#### `[MINOR-02] Omission of Rule Pack and Asset Directories in Code Layout Section`
- **Document & Section Reference**: `PROJECT.md` § Code Layout (lines 49–59)
- **Gap Category**: `Missing Information`
- **Impact Description**: The code layout section lists root, deliverable, backend, frontends, and tests, but omits `resources/rulepack/` (baseline rules and Excel template) and `resources/bin/` (native decompression binaries).
- **One-Sentence Fix Note**: Add `resources/rulepack/` and `resources/bin/` to the Code Layout listing in `PROJECT.md`.

#### `[MINOR-03] Lack of Onboarding Build and Test Guidance for Subagents`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (lines 1–11)
- **Gap Category**: `Missing Information`
- **Impact Description**: `AGENTS.md` lacks quick-reference commands for building and testing the C# and TypeScript projects (`dotnet test`, `npm run build`, `build-all.bat`), forcing new agents to search through other files.
- **One-Sentence Fix Note**: Append a concise Quick Verification Commands section to `AGENTS.md` listing standard build and test CLI invocations.

#### `[MINOR-04] Minimal Passthrough File Lacking Standalone Onboarding Context`
- **Document & Section Reference**: `GEMINI.md` (lines 1–6)
- **Gap Category**: `Missing Information`
- **Impact Description**: `GEMINI.md` contains only an `@AGENTS.md` directive and a one-line note. While functionally valid as an alias, it provides no Gemini-specific tooling hints or platform context for AI agents reading it directly.
- **One-Sentence Fix Note**: Ensure `GEMINI.md` explicitly notes that full project rules and agent grounding contracts reside in `AGENTS.md`.

#### `[MINOR-05] Uncommitted Verification Hash Marker in Architecture Frontmatter`
- **Document & Section Reference**: `docs/architecture/README.md` § Frontmatter (line 3)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: `verified_at_commit: UNCOMMITTED` is a temporary placeholder that was never pinned to a stable Git commit SHA.
- **One-Sentence Fix Note**: Update `verified_at_commit` with the authoritative commit SHA once baseline documentation is stabilized.

#### `[MINOR-06] Discrepancy Between Historical ADR 0002/0003 Working Titles and Repository Filenames`
- **Document & Section Reference**: `docs/decisions/README.md` (lines 6–7)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Historical prompt specifications and early roadmap manifests reference ADR 0002 as `0002-rules-engine-selection.md` and ADR 0003 as `0003-hybrid-excel-read-strategy.md`, whereas the actual repository files are `0002-ui-ux-design-specification.md` and `0003-rulepack-persistence-and-desktop-delivery.md`. While `docs/decisions/README.md` correctly links to current files, agents searching for older titles will not find them without a cross-reference.
- **One-Sentence Fix Note**: Add an alias/historical mapping note in `docs/decisions/README.md` clarifying that ADR 0002 and 0003 reflect UI/UX Architecture and Rulepack Persistence respectively.

#### `[MINOR-07] Ambiguity in Export Deliverable Default File Naming Token Substitution`
- **Document & Section Reference**: `docs/decisions/0002-ui-ux-design-specification.md` § Decisions — 6. Export Pre-Flight & Delivery Workflow (line 43)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: The default filename pattern is given as `<JobName>_<COM>_Detailing_Verification_List.xlsx`, but does not specify fallback naming if Job Name or COM # has not yet been populated by the user (e.g. when opening a unit without OrderRev metadata).
- **One-Sentence Fix Note**: Specify fallback naming tokens in ADR-0002 (e.g. `UNTITLED_Detailing_Verification_List.xlsx`) when JobName or COM is undefined.

#### `[MINOR-08] Omission of Rule Editor Packaging Rules in Desktop Delivery Decision`
- **Document & Section Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` § Decisions — 4. Desktop delivery (lines 28–30)
- **Gap Category**: `Missing Information`
- **Impact Description**: Section 4 focuses primarily on `AHUVerification.App` delivery but does not explicitly describe the secondary desktop host `RuleEditor.exe` (`AHUVerification.RuleEditor`), which requires `dist/rule-editor.html` rather than `dist/index.html`.
- **One-Sentence Fix Note**: Add `RuleEditor.exe` and its asset dependency (`dist/rule-editor.html`) to the Desktop Delivery specifications in ADR-0003.

#### `[MINOR-09] Discrepancy Between Dedicated Parser Class vs Module Function in TypeScript`
- **Document & Section Reference**: `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` § Decisions 2: Order Metadata Trace Extraction
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0004 states "Implement `OrderRevParser` in both C# Core and TypeScript", but in the TypeScript codebase, there is no standalone `OrderRevParser` class; instead, it is implemented as a standalone function `parseOrderRevXml` inside `src/services/xmlParser.ts`, causing agents searching for `OrderRevParser.ts` to conclude the TypeScript parser is missing.
- **One-Sentence Fix Note**: Clarify in ADR 0004 that the TypeScript implementation is exported as `parseOrderRevXml` within `src/services/xmlParser.ts` rather than a standalone class file.

#### `[MINOR-10] Formula Adaptation Cell Reference Discrepancy on Check Information`
- **Document & Section Reference**: `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` § Decisions 2: Formula Adaptation Engine on Check Information
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0005 mentions scanning `B8..B15` and `C8..C15` on `Check Information`, but omits mentioning that `C8..C15` are the detailer count/formula cells while `B8..B15` are the checker formula cells, and does not document the exact formula syntax generated for `B19` (`H1` sum across all active sheets) and `B20` (`J1` sum across Base/Housing/Paperwork).
- **One-Sentence Fix Note**: Detail the specific column roles (`B` for checker and `C` for detailer counts) and exact formula syntax for `B19` and `B20` in ADR 0005 § Decisions 2.

#### `[MINOR-11] Unspecified Segment Template Catalog Defaults`
- **Document & Section Reference**: `docs/decisions/0006-manual-unit-graph-synthesis.md` § Decisions 2: Structural Graph Synthesis Engine
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0006 mentions default segments (Supply Fan `FS`, Cooling Coil `CC`, Access `XA`, Filter `FF`) but omits the full list of 8+ segment catalog presets defined in `AVAILABLE_SEGMENT_TEMPLATES` (`IP`, `MB`, `FF`, `RF`, `HC`, `CC`, `FS`, `FR`, `FE`, `XA`, `DP`, `HW`), leaving developers unaware of the full preconfigured template set.
- **One-Sentence Fix Note**: Reference the complete list of available segment templates in `AVAILABLE_SEGMENT_TEMPLATES` in ADR 0006 § Decisions 2.

#### `[MINOR-12] Ambiguous Payload Structure for exportExcelDeliverable`
- **Document & Section Reference**: `docs/decisions/0007-typed-ipc-bridge-protocol.md` § Decisions 2: 11-Action Bridge Method Catalog
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: The table lists `exportExcelDeliverable` payload as `{ templatePath, outputPath, ... }`, but in practice the frontend passes `{ facts, sqItems, checklists, rules, graph, generalComments, defaultName, isDraft }`, while `templatePath` is resolved internally by `BridgeHandler` from the active rule pack path, and `outputPath` is prompted via `SaveFileDialog` if omitted.
- **One-Sentence Fix Note**: Update the payload and return schema for `exportExcelDeliverable` in ADR 0007 to match the actual parameters passed by `desktopBridge.ts` and consumed by `BridgeHandler.cs`.

#### `[MINOR-13] Missing Browser Fallback Behavior for Rule Editor Studio`
- **Document & Section Reference**: `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` § Decisions 1: Standalone Desktop Application & Delivery
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: ADR 0008 focuses on `RuleEditor.exe`, without documenting how the web application operates when launched via Vite (`/rule-editor.html`), where publishing downloads a JSON blob instead of saving to local directories.
- **One-Sentence Fix Note**: Note the browser preview fallback mode for `rule-editor.html` in ADR 0008, clarifying that web users receive export downloads in place of direct disk writes.

#### `[MINOR-14] Incomplete Fact Naming Catalog for Opening Schedules`
- **Document & Section Reference**: `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` § Decisions 2: Opening Schedule Ingestion
- **Gap Category**: `Missing Information`
- **Impact Description**: ADR 0009 lists opening classes (`UnitDoor`, `UnitDamper`, `UnitFloorDrain`), but does not document the indexed fact key convention used in `FactRegistry` (e.g. `door.{id}.width`, `damper.{id}.bladeType`, `drain.{id}.holeDiameter`), requiring agents to inspect `FactExtractor.cs` to write door/damper rules.
- **One-Sentence Fix Note**: List the standard indexed fact key naming convention for doors, dampers, and floor drains in ADR 0009.

#### `[MINOR-15] Ambiguous Deployable Asset Verification Invariant`
- **Document & Section Reference**: `docs/operations/development.md` § Build & Test Commands (Line 45)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: Line 45 states "Confirm that dist/index.html, resources/rulepack/manifest.json, all four manifest-declared Rule Pack members, and resources/bin/unpack32.exe / ywunpack.dll ... are present before release" without specifying exact file paths or providing an automated check command.
- **One-Sentence Fix Note**: Provide explicit relative paths and the automated verification command (`node scripts/build_rulepack.mjs` and MSBuild verification) to confirm all release bundle members.

#### `[MINOR-16] Unguided Test Failure Scenarios and Diagnostic Logs`
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 5–17)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: The runbook provides no guidance on interpreting xUnit test failure logs, OpenXML schema validation assertion errors, or hash divergence errors.
- **One-Sentence Fix Note**: Add a troubleshooting table describing common test failure symptoms, log locations, and remediation procedures.

#### `[MINOR-17] Ambiguous Verification Mode Semantics and Extension Guidelines`
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 2.1 Rule Definition Data Model (Table 2.1, Line 92)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: Table 2.1 lists `verificationMode` with values `'ManualCheckbox'`, `'AutoEvaluated'`, `'MeasurementVerify'`, but does not explain how the UI or C# engine interprets `'MeasurementVerify'` vs `'ManualCheckbox'` or whether measurement thresholds are supported.
- **One-Sentence Fix Note**: Clarify the operational behavior and current implementation state of each `verificationMode` value in the detailer workspace.

#### `[MINOR-18] Ambiguous Excel Cell Mapping vs Dynamic Skid Row Layout`
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` § 5.4 Verification Checklist Rules (Lines 347–358)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: Table 5.4 references Columns S, T, Y, Z on `Verification List`, but does not clearly explain how dynamic row expansion shifts row indexes from the base template starting at row 26.
- **One-Sentence Fix Note**: Add a note explaining that row indexes for verification checks are dynamically generated starting at row 26 grouped under skid headers, rather than fixed static rows.

#### `[MINOR-19] Outdated Test Execution Metrics in Historical Staleness Report`
- **Document & Section Reference**: `docs/documentation_staleness_report.md` § 3.2 Test Suites Inventory & § 6 Verification Record (Line 370)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Table 3.2 and Section 6 state that 20 tests passed in 2.26s, whereas the current test suite contains 28 tests.
- **One-Sentence Fix Note**: Update the test execution inventory note to reflect current test suite expansion from 20 to 28 tests.

#### `[MINOR-20] Unclear Distinction Between Standalone Config.xml and UPZ Archive Order Facts`
- **Document & Section Reference**: `docs/field_derivation_report.md` § 3.1 Order & Identity Domain (Lines 94–99)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: Section 3.1 notes that in standalone `Config.xml` mode, order fields default to placeholders like `"Medical Center Phase 3"`, but does not clarify whether the OpenXML export allows blank/placeholder order fields or requires manual confirmation.
- **One-Sentence Fix Note**: Clarify that standalone XML import populates placeholder defaults that should be confirmed in the UI prior to final OpenXML export.

#### `[MINOR-21] Outdated .NET 10 References and Inconsistent Test Count Baseline in Code Duplication Audit`
- **Document & Section Reference**: `audits/code_duplication_audit.md` § 1.1 Architecture (Line 36) & § 5.3 Quality Gate (Line 1228)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 36 describes the C# engine as ".NET 10", and line 1228 specifies "*Pass Criteria*: 15 passed, 0 failed", which conflicts with actual .NET 8 target and 28 passed tests.
- **One-Sentence Fix Note**: Correct the framework target to .NET 8 and update the test pass criteria count to 28 tests.

#### `[MINOR-22] Missing Multi-Document Entry Structure and Schema Metadata in Context Manifest`
- **Document & Section Reference**: `docs/context-manifest.json` Lines 3–17
- **Gap Category**: `Missing Information`
- **Impact Description**: The manifest lacks entries for individual operational and architectural guides, preventing fine-grained freshness checking per document subsystem.
- **One-Sentence Fix Note**: Add distinct manifest document entries for each architectural guide, operations runbook, and audit report.

---

## 4. Consolidated Document Remediation Summary Table

The table below summarizes all 23 audited documents, their finding counts by severity tier, and the primary required remediation actions:

| # | Target Document Path | Blockers | Slowdowns | Minors | Total Findings | Primary Required Remediation Actions |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| 1 | `README.md` | 2 | 3 | 1 | **6** | Fix `src/rulepack/` path to `resources/rulepack/`; clarify .NET 8 TFM; document browser fallback and manifest test requirement. |
| 2 | `PROJECT.md` | 1 | 1 | 1 | **3** | Reset project context from code duplication audit to AHU Verification System; fix .NET 8 TFM; add resources to layout. |
| 3 | `AGENTS.md` | 1 | 2 | 1 | **4** | Remove mandatory `.agents/state/current.md`; clarify `Agent Ground status` and optional CodeGraph; add quick test commands. |
| 4 | `GEMINI.md` | 0 | 0 | 1 | **1** | Clarify that full rules and grounding reside in `AGENTS.md`. |
| 5 | `docs/architecture/README.md` | 2 | 3 | 1 | **6** | Remove dead `spike/` and `implementation_plan.md` from scope; fix IPC bridge catalog; clarify .NET 8 and UPZ 32-bit execution. |
| 6 | `docs/decisions/README.md` | 0 | 1 | 1 | **2** | Add standard ADR template and status lifecycle guidance; add alias notes for historical ADR titles. |
| 7 | `docs/decisions/0001-ahu-verification-desktop-architecture.md` | 1 | 2 | 0 | **3** | Harmonize .NET 8 vs .NET 10; clarify `localStorage` vs `.dvl` autosave semantics and corruption recovery. |
| 8 | `docs/decisions/0002-ui-ux-design-specification.md` | 0 | 2 | 1 | **3** | Document SQ >22 slot overflow policy; define XML re-import manual override conflict handling and filename fallbacks. |
| 9 | `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` | 1 | 1 | 1 | **3** | Update MSBuild asset validation claim; document LKG fallback directory; add `RuleEditor.exe` delivery specs. |
| 10 | `docs/decisions/0004-upz-bundle-ingestion-and-order-metadata-traces.md` | 1 | 2 | 1 | **4** | Document `unpack32.exe` exit code handling and trailing slash requirement; fix job name mock; clarify TypeScript parser function. |
| 11 | `docs/decisions/0005-dynamic-openxml-deliverable-synthesis.md` | 1 | 2 | 1 | **4** | Document Excel file lock handling; detail fixed StyleIndex dependencies; provide category-to-sheet mapping table. |
| 12 | `docs/decisions/0006-manual-unit-graph-synthesis.md` | 1 | 2 | 1 | **4** | Document TypeScript-only synthesis; fix `src/services/manualUnitFactory.ts` path; add dimensional validation bounds. |
| 13 | `docs/decisions/0007-typed-ipc-bridge-protocol.md` | 1 | 2 | 1 | **4** | Remove phantom `parseXml` action; document `checkRulePackUpdate`/`selectFolderDialog`; add `Form.Invoke` UI thread rules. |
| 14 | `docs/decisions/0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` | 1 | 2 | 1 | **4** | Specify canonical LF hashing and `bundleSha256` composite algorithm; document 4-stage LKG rollback; fix TFM and assembly. |
| 15 | `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md` | 1 | 2 | 1 | **4** | Document 5-inch elevation tolerance for tiered/stacked classification; detail drain hole math; define indexed opening keys. |
| 16 | `docs/operations/development.md` | 2 | 3 | 1 | **6** | Update .NET 8 SDK prerequisite; fix publish paths to `publish\AHUVerification` / `publish\RuleEditor`; add Rule Editor run cmds. |
| 17 | `docs/operations/validation.md` | 1 | 3 | 1 | **5** | Remove dead `spike/OpenXmlSpike` command; update test count to 28; add AST test execution; clarify `$env:PLUGIN_ROOT`. |
| 18 | `docs/rule_and_logic_editor_guide.md` | 0 | 3 | 1 | **4** | Add `/rule-editor.html` Vite web route; expand opening/component fact tables; add publishing error recovery guide. |
| 19 | `docs/AHU_Verification_E2E_Workflow_Audit.md` | 1 | 2 | 1 | **4** | Reconcile skid weight confidence (`Authoritative` in code); replace static bundle hash with dynamic note; fix .NET 8 header. |
| 20 | `docs/documentation_staleness_report.md` | 1 | 1 | 1 | **3** | Add historical archival header; note that `docs/roolz/` is deleted; clarify .NET 8 target and 28 test count baseline. |
| 21 | `docs/field_derivation_report.md` | 1 | 2 | 1 | **4** | Align skid weight confidence with code (`Authoritative`); add opening/component fact taxonomy; note manual setup updates. |
| 22 | `audits/code_duplication_audit.md` | 0 | 2 | 1 | **3** | Mark `init_env.bat` and `launch.bat` as already implemented; note `tsx` dependency for proposed scripts; fix .NET 8 TFM. |
| 23 | `docs/context-manifest.json` | 1 | 0 | 1 | **2** | Expand manifest tracking to all 23 documents/ADRs; bump `verified_at_commit` to current HEAD (`7cd24b5`). |
| **—** | **TOTALS** | **21** | **43** | **22** | **86** | **Comprehensive Full-Repository Remediation Scope** |

---

## 5. Execution Guidelines & Next Steps for Documentation Refresh

To remediate the documentation suite efficiently without introducing new regressions or breaking active agent workflows, execution should follow a disciplined three-phase remediation plan:

### Phase 1: Critical Blockers & Path Alignment (Immediate Priority)
1. **Rulepack & Tooling Path Realignment**:
   - Update `README.md` repository tree to replace `src/rulepack/` with `resources/rulepack/`.
   - Remove `spike/**` and `implementation_plan.md` from `docs/architecture/README.md` frontmatter.
   - Delete `dotnet run --project spike/OpenXmlSpike` from `docs/operations/validation.md`.
2. **Framework Target Harmonization**:
   - Standardize all mentions of target frameworks across `README.md`, `PROJECT.md`, `docs/architecture/README.md`, `docs/operations/development.md`, `ADR 0001`, `ADR 0007`, and `ADR 0008` to explicitly state `.NET 8` (`net8.0` / `net8.0-windows`) while noting .NET 10 SDK toolchain forward compatibility.
3. **Reset PROJECT.md**:
   - Restore the authoritative AHU Detailing Verification system architecture, domain feature inventory, and durable milestones in `PROJECT.md`.
4. **IPC Bridge & Publishing Synchronization**:
   - Correct the bridge action catalog in `docs/architecture/README.md` and `ADR 0007` to remove `parseXml` and document `checkRulePackUpdate`, `selectFolderDialog`, and `publishRulePack`.
   - Update `docs/operations/development.md` to reflect the authoritative `publish-release.bat` paths (`publish\AHUVerification` and `publish\RuleEditor`).

### Phase 2: Operational Runbooks, Guides & Missing Specifications (High Priority)
1. **Rule Editor Integration & Testing Instructions**:
   - Add the Vite multi-page entry point (`http://localhost:5173/rule-editor.html`) and desktop host execution commands to `development.md` and `rule_and_logic_editor_guide.md`.
   - Add `node scripts/test_ast_converter.mjs` to `validation.md` and update xUnit test count to 28 tests across 7 fixtures.
2. **Hashing & Architectural Protocol Documentation**:
   - Document the canonical LF normalization, SHA-256 member hashing, and composite `bundleSha256` verification algorithm in `ADR 0008`.
   - Document the 5-inch elevation tolerance window and geometric classification rules for tiered vs. stacked units in `ADR 0009`.
   - Document OpenXML Excel file locking handling and fixed `StyleIndex` constants in `ADR 0005`.
3. **Fact Provenance Reconciliations**:
   - Reconcile skid weight confidence ratings between documentation (`docs/field_derivation_report.md`, `AHU_Verification_E2E_Workflow_Audit.md`) and code (`FactExtractor.cs`, `factRegistry.ts`).

### Phase 3: Historical Audits Archival & Context Manifest Expansion (Medium Priority)
1. **Historical Document Grounding**:
   - Prepend historical archival notices to `docs/documentation_staleness_report.md` and `docs/AHU_Verification_E2E_Workflow_Audit.md` indicating they represent point-in-time audits.
   - Note in `audits/code_duplication_audit.md` that `scripts/init_env.bat` and `scripts/launch.bat` have already been implemented.
2. **Context Manifest Expansion**:
   - Expand `docs/context-manifest.json` to track all architectural specifications, operations runbooks, ADRs, and guides, pinning `verified_at_commit` to current HEAD.

