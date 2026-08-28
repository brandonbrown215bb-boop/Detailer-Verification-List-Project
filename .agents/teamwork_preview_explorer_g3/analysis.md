# Operations, Guides, and Historical Audits / Reports Documentation Gap Audit

**Auditor:** Explorer 3 (Technical Operations, Guides & Historical Reports Auditor)  
**Date:** 2026-08-28  
**Scope:** 8 Assigned Target Documents  
1. `docs/operations/development.md`  
2. `docs/operations/validation.md`  
3. `docs/rule_and_logic_editor_guide.md`  
4. `docs/AHU_Verification_E2E_Workflow_Audit.md`  
5. `docs/documentation_staleness_report.md`  
6. `docs/field_derivation_report.md`  
7. `audits/code_duplication_audit.md`  
8. `docs/context-manifest.json`  

---

## 1. Executive Summary

A comprehensive, ground-truth verification audit was conducted on all 8 assigned operational guides, developer runbooks, technical specifications, and historical audit reports. Every claim, CLI command, code path, file location, framework version, test suite count, and AST/fact logic was verified against actual source code in `src/backend/`, `src/services/`, `src/components/`, `src/ruleEditor/`, `resources/rulepack/`, `tests/`, and root scripts (`setup.bat`, `publish-release.bat`, `build-all.bat`, etc.).

### Summary of Audit Findings by Severity
- **Blocks the Reader (Critical)**: **7 Findings** — High-impact contradictions, dead commands/paths, framework version mismatches (.NET 10 vs .NET 8), and fact provenance discrepancies that prevent correct building, publishing, running, or understanding core safety logic.
- **Slows the Reader (Moderate)**: **16 Findings** — Missing execution instructions for the Rule Editor web/desktop endpoints, omitted test suites (AST converter tests, test fixtures), unstated environment variable assumptions (`$env:PLUGIN_ROOT`, `tsx`), and unguided publishing/build error scenarios.
- **Minor (Low)**: **8 Findings** — Incomplete table catalogs, dead links to non-existent temporary directories (`docs/roolz/`), and minor documentation ambiguities that do not prevent execution.
- **Total Findings**: **31 Findings** across all 8 documents.

---

## 2. Document Breakdown & Evaluation Matrix

| Document | Category | Blocker | Slowdown | Minor | Total | Primary Gap Identified |
|---|---|:---:|:---:|:---:|:---:|---|
| `docs/operations/development.md` | Operations / Dev | 2 | 3 | 1 | **6** | .NET 10 prerequisite mismatch; broken publish path vs `publish-release.bat`; missing Rule Editor run instructions. |
| `docs/operations/validation.md` | Operations / QA | 1 | 3 | 1 | **5** | Dead `spike/OpenXmlSpike` project command; outdated 20 vs 28 test count; unstated `$env:PLUGIN_ROOT` assumption. |
| `docs/rule_and_logic_editor_guide.md` | Feature Guide | 0 | 3 | 1 | **4** | Missing Vite web route (`/rule-editor.html`); omitted component/opening facts; unguided publish error scenarios. |
| `docs/AHU_Verification_E2E_Workflow_Audit.md` | Technical Spec | 1 | 2 | 1 | **4** | Contradictory skid weight provenance (`RequiresConfirmation` in doc vs `Authoritative` in code); hardcoded bundle SHA. |
| `docs/documentation_staleness_report.md` | Historical Audit | 1 | 1 | 1 | **3** | Outdated .NET 10 claims; references to non-existent `docs/roolz/` folder; outdated commit baseline. |
| `docs/field_derivation_report.md` | Data Spec | 1 | 2 | 1 | **4** | Contradictory skid weight confidence rating; omitted sub-component and opening schedule fact tables. |
| `audits/code_duplication_audit.md` | Historical Audit | 0 | 2 | 1 | **3** | Describes already-implemented scripts (`init_env.bat`, `launch.bat`) as future work; unstated `tsx` dependency. |
| `docs/context-manifest.json` | Agent Ground Config | 1 | 0 | 1 | **2** | Tracks only 1 file (`README.md`) ignoring all operations/guides/audits; verified commit is 7 commits behind HEAD. |
| **TOTALS** | — | **7** | **16** | **8** | **31** | — |

---

## 3. Prioritized Gap Catalog

Findings are ordered by severity tier: **Blocks the Reader (Critical)**, then **Slows the Reader (Moderate)**, then **Minor (Low)**.

---

### Tier 1: Blocks the Reader (Critical)

#### [BLOCKER-01] Outdated .NET SDK Prerequisite Target in Development Runbook
- **Document & Section Reference**: `docs/operations/development.md` § Prerequisites (Line 4)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: A fresh AI agent reading line 4 is instructed to install and configure the ".NET 10 SDK" and build with .NET 10 toolchains. In reality, all project files (`src/backend/AHUVerification.App/AHUVerification.App.csproj`, `src/backend/AHUVerification.Core/AHUVerification.Core.csproj`, `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj`, `tests/AHUVerification.Tests/AHUVerification.Tests.csproj`) target `net8.0` / `net8.0-windows`, and `scripts/init_env.bat` explicitly verifies `.NET SDK v8.0 or later`. Following the documentation causes toolchain confusion and unnecessary SDK installation attempts.
- **One-Sentence Fix Note**: Update the prerequisites section to specify .NET 8.0 SDK (or .NET 8.0+ SDK targeting `net8.0`/`net8.0-windows`) to match actual project framework targets and environment validation scripts.

#### [BLOCKER-02] Contradictory and Broken Publishing Commands and Target Paths
- **Document & Section Reference**: `docs/operations/development.md` § Build & Test Commands (Lines 42–43)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Line 42 instructs publishing to `artifacts/publish/win-x64` with `-p:PublishSingleFile=false` and `--self-contained true`, but the repository's authoritative release script `publish-release.bat` publishes `AHUVerification.App` to `publish\AHUVerification` and `AHUVerification.RuleEditor` to `publish\RuleEditor` with `--self-contained false`. Following `development.md` produces a fragmented deployment missing the Rule Editor and placing assets in an unreferenced `artifacts/` folder.
- **One-Sentence Fix Note**: Align publish commands and target output directories with `publish-release.bat` (`publish\AHUVerification` and `publish\RuleEditor`) and document both application artifacts.

#### [BLOCKER-03] Dead Reference to Non-Existent Spike Project in Validation Runbook
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 28–31)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Line 30 directs readers to execute `dotnet run --project spike/OpenXmlSpike` to validate OpenXML schema roundtripping. The `spike/` directory does not exist in the repository; executing this command immediately terminates with error `MSB1009: Project file does not exist`, halting automated CI/validation runs.
- **One-Sentence Fix Note**: Remove the obsolete `spike/OpenXmlSpike` command from `validation.md` or replace it with the active test fixture command in `AHUVerification.Tests`.

#### [BLOCKER-04] Contradictory Skid Weight Provenance and AST Evaluation Semantics
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` § 3 Phase 3 (Lines 198–200) & § 7 Checkpoint 2 (Line 386)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: The document asserts that `skid.<id>.weight` is always initialized with `Status = Derived` and `Confidence = RequiresConfirmation`, forcing rule `BASE-01` to evaluate to `NeedsInput` until explicitly confirmed by the detailer. In actual code (`FactExtractor.cs:698` and `src/services/factRegistry.ts:568`), `skid.<id>.weight` is initialized with `Confidence = Authoritative`, meaning `BASE-01` evaluates immediately to `Applicable` without gating. An agent relying on this document will expect mandatory confirmation blockers that do not occur in code.
- **One-Sentence Fix Note**: Reconcile documentation with code to state that calculated skid weight defaults to Authoritative derivation, and document the optional manual confirmation/override pathway.

#### [BLOCKER-05] Historical Staleness Report Preserves Outdated .NET 10 Claims and Obsolete `docs/roolz` Directory References
- **Document & Section Reference**: `docs/documentation_staleness_report.md` § 1 Executive Summary (Line 22) & § 2 Freshness Matrix (Lines 44–45)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: This report repeatedly asserts that the codebase is standardized on ".NET 10 (`net10.0` / `net10.0-windows`)" (lines 22, 61, 150) and refers heavily to an out-of-sync directory `docs/roolz/` (lines 21, 44, 45, 97, 240, 256, 262, 291). In reality, the codebase targets `net8.0`/`net8.0-windows`, and `docs/roolz/` does not exist in the repository (it was an intermediate temporary folder). A fresh AI agent reading this historical report will attempt to target .NET 10 and search for non-existent `docs/roolz/` files.
- **One-Sentence Fix Note**: Add an archival header stating that this document is a historical point-in-time audit (2026-08-26) superseded by current .NET 8 configuration and `resources/rulepack/` structure, and note that `docs/roolz` has been deleted.

#### [BLOCKER-06] Contradictory Skid Weight Confidence Rating vs Actual Code Implementation
- **Document & Section Reference**: `docs/field_derivation_report.md` § 4.1 Strict Skid Weight Semantics (Lines 164–167)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Section 4.1 states that `skid.weight` is assigned `status: Derived`, `confidence: RequiresConfirmation`, and promptNote: *"Sum of segments = X lbs. Confirm or override official lifting weight."* In reality, `FactExtractor.cs:698` and `src/services/factRegistry.ts:568` assign `confidence: 'Authoritative'` and no prompt note. This contradiction causes confusion regarding whether lifting weight requires user confirmation before rules execute.
- **One-Sentence Fix Note**: Update Section 4.1 to reflect actual code confidence assignment (`Authoritative`) or document the difference between runtime automated calculation and manual override workflows.

#### [BLOCKER-07] Severely Restricted Scoping and Outdated Verified Commit in Agent Ground Manifest
- **Document & Section Reference**: `docs/context-manifest.json` Lines 1–19
- **Gap Category**: Missing Information
- **Impact Description**: `context-manifest.json` only tracks a single document (`docs/architecture/README.md`) against commit `7a8ff4489f01b6891c1e32721737176353fb976b`. It completely ignores all other 7 assigned documentation files (`docs/operations/development.md`, `docs/operations/validation.md`, `docs/rule_and_logic_editor_guide.md`, `docs/AHU_Verification_E2E_Workflow_Audit.md`, `docs/documentation_staleness_report.md`, `docs/field_derivation_report.md`, `audits/code_duplication_audit.md`), ADRs 0005–0009, and root documentation. Furthermore, the verified commit is 7 commits behind HEAD (`7cd24b5`), causing Agent Ground checks to treat the repository context as stale.
- **One-Sentence Fix Note**: Expand `context-manifest.json` to include all documentation files, operational runbooks, and ADRs in its tracking scope, and update `verified_at_commit` to current HEAD.

---

### Tier 2: Slows the Reader (Moderate)

#### [SLOW-01] Missing Dual-Host Execution and Web Route Guidance for Rule Editor
- **Document & Section Reference**: `docs/operations/development.md` § Running the Application (Lines 15–23)
- **Gap Category**: Missing Information
- **Impact Description**: The document explains how to launch the main desktop host (`dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj`) and run Vite (`npm run dev`), but completely omits how to run the desktop Rule Editor (`AHUVerification.RuleEditor`) or navigate to `/rule-editor.html` in browser mode, leaving a new agent unable to develop or test rule editing without searching the codebase.
- **One-Sentence Fix Note**: Add run commands for the Rule Editor desktop host (`dotnet run --project src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj`) and the browser route (`http://localhost:5173/rule-editor.html`).

#### [SLOW-02] Omission of Root Convenience Workflow Scripts in Development Runbook
- **Document & Section Reference**: `docs/operations/development.md` § Quickstart Setup (Lines 8–14)
- **Gap Category**: Missing Information
- **Impact Description**: The quickstart only mentions `setup.bat`, omitting existing root workflow automation scripts (`build-all.bat`, `build-backend.bat`, `build-frontend.bat`, `build-rulepack.bat`, `launch-app.bat`, `launch-rule-editor.bat`, `menu.bat`, `run-tests.bat`, `start-dev.bat`), forcing agents to manually execute fragmented CLI steps instead of using standard repository automation.
- **One-Sentence Fix Note**: Add a table or inventory summarizing all root batch automation scripts and their intended operational workflows.

#### [SLOW-03] Unguided Pre-Publish and Build Failure Recovery Scenarios
- **Document & Section Reference**: `docs/operations/development.md` § Build & Test Commands (Lines 38–46)
- **Gap Category**: Unguided Error Scenarios
- **Impact Description**: If an agent runs `dotnet publish` without first running `npm run build` or without verifying `resources/bin/unpack32.exe`, MSBuild target `ValidatePackagedAssets` throws a fatal build error with zero troubleshooting guidance in `development.md`.
- **One-Sentence Fix Note**: Add a troubleshooting subsection detailing common build and publish failure causes (e.g. missing `dist/index.html`, missing UPZ native unpack binaries, or missing WebView2 runtime) and their resolution steps.

#### [SLOW-04] Outdated C# Unit Test Count and Incomplete Test Suite Inventory
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 5–17)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Line 5 claims the automated test suite contains "20 Tests", but running `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` executes 28 passed tests across 7 test classes. Furthermore, test descriptions omit coverage details for several test fixtures (`TestGraphFactory`, `TestPipelineContext`, `TestPathHelper`).
- **One-Sentence Fix Note**: Update the test count from 20 to 28 tests and document all test fixture classes included in `AHUVerification.Tests`.

#### [SLOW-05] Missing Node.js AST Converter Test Suite Execution
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 3–27)
- **Gap Category**: Missing Information
- **Impact Description**: The validation runbook lists C# tests, Vite build, and Rule Pack manifest building, but omits `node scripts/test_ast_converter.mjs` (which is part of `run-tests.bat`), meaning an agent validating the repository will skip frontend AST converter verification.
- **One-Sentence Fix Note**: Add `node scripts/test_ast_converter.mjs` to the Automated Verification section alongside C# test execution.

#### [SLOW-06] Unstated Assumption and Unguided `$env:PLUGIN_ROOT` in Agent Ground Runbook
- **Document & Section Reference**: `docs/operations/validation.md` § Agent Ground Freshness & Rules (Lines 33–42)
- **Gap Category**: Unstated Assumptions
- **Impact Description**: Lines 36 and 40 assume `$env:PLUGIN_ROOT` is populated in the user's environment; if the environment variable is not set, the PowerShell command fails with `Cannot find path` with zero fallback guidance or instructions on locating `agent_ground.py`.
- **One-Sentence Fix Note**: Document the prerequisite for `$env:PLUGIN_ROOT` or provide the standard fallback path `%USERPROFILE%\.gemini\config\plugins\agent-ground\scripts\agent_ground.py` and explain what to do if Python or the plugin is not installed.

#### [SLOW-07] Missing Web Development Entry Point Guidance for Rule Editor
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 1. System Architecture & Overview (Lines 67–70)
- **Gap Category**: Missing Information
- **Impact Description**: Section 1.1 explains launching `launch-rule-editor.bat` or `menu.bat`, but does not explain how to access the rule editor when running the Vite web server (`npm run dev` serves `rule-editor.html` at `http://localhost:5173/rule-editor.html`), leaving web developers unaware of the multi-page Vite entry point.
- **One-Sentence Fix Note**: Add the local Vite development URL (`http://localhost:5173/rule-editor.html`) and mention `rule-editor.html` rollup entry configuration in Section 1.

#### [SLOW-08] Unguided Fact Dictionary Discrepancies and Incomplete Fact Catalog
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 2.3 Fact Dictionary Catalog (Lines 122–168)
- **Gap Category**: Missing Information
- **Impact Description**: Table 2.3 lists a subset of facts (32 keys), omitting several active facts present in `FactDictionaryCatalog.ts` and `FactExtractor.cs` (such as opening-level facts `door.*.width`, `damper.*.type`, `floorDrain.*.connectionDiameter`, motor control facts `motorControl.*.disconnectSize`, component facts `fan.*.hasRemovalRail`, `coil.*.bulkheadMaterial`), leading rule authors to assume these facts cannot be targeted in AST predicates.
- **One-Sentence Fix Note**: Expand Table 2.3 or explicitly cross-reference `FactDictionaryCatalog.ts` and `FactExtractor.cs` as the complete, authoritative catalogs of opening and component facts.

#### [SLOW-09] Unguided Error Scenarios During Rule Publishing and Hashing Divergence
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 6. Publishing, Semantic Versioning & Integrity Pipeline (Lines 458–492)
- **Gap Category**: Unguided Error Scenarios
- **Impact Description**: Section 6 describes the happy-path publishing sequence, but provides zero error handling for common failure modes (e.g. read-only permissions on `resources/rulepack/`, duplicate rule IDs, missing `template.xlsx`, CRLF line ending corruption, or IPC bridge timeout in browser mode).
- **One-Sentence Fix Note**: Add a "Publishing Troubleshooting & Rollback" section detailing error codes, duplicate ID validation, line-ending normalization recovery, and LKG fallback behavior.

#### [SLOW-10] Outdated Rule Pack Manifest Bundle Hash in Verification Checkpoints
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` § 7 Checkpoint 1 (Line 385) & § 6 (Line 377)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Lines 8, 378, and 386 cite bundle hash `020e8ef38896efc9abcdb820b2dbde73ea251ddccbc646f63e06b337b2e1bc28` as the pinned version, but any future rule modification or hash recalculation will invalidate this static string. An auditing agent checking file integrity against hardcoded doc hashes will report false verification failures.
- **One-Sentence Fix Note**: Clarify that the hash in the document is illustrative for v14.0.0 and reference `resources/rulepack/manifest.json` as the authoritative source of runtime bundle identity.

#### [SLOW-11] Incomplete Omission of Runtime Framework and Dependency Details in Workflow Spec
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` Header (Line 6) & § 1. Executive Summary (Line 14)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Line 6 states "Runtime Environment: Windows Desktop (.NET 10 + WebView2)", which contradicts the `.csproj` target framework `net8.0-windows`.
- **One-Sentence Fix Note**: Update the runtime environment header to reflect .NET 8.0 Windows Desktop.

#### [SLOW-12] Stale Git Commit Baseline Delta and Hardcoded SHA References
- **Document & Section Reference**: `docs/documentation_staleness_report.md` § Header (Lines 6–7) & § 4.1 Commit Version (Lines 109–115)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Lines 6–7 cite HEAD commit `c17d2ace8a22` and baseline `e9e2e04707a8`. The repository has since progressed multiple commits ahead (`7cd24b5`), rendering the commit delta analysis outdated.
- **One-Sentence Fix Note**: Label commit SHAs and deltas as historical baseline data valid at audit time (2026-08-26).

#### [SLOW-13] Incomplete Field Inventory for Opening Schedules and Internal Sub-Components
- **Document & Section Reference**: `docs/field_derivation_report.md` § 2 Fact Taxonomy & Provenance Catalog (Lines 49–89)
- **Gap Category**: Missing Information
- **Impact Description**: Table 2 lists unit and skid facts, but omits per-opening facts (`door.*`, `damper.*`, `floorDrain.*`) and sub-component facts (`fan.*`, `coil.*`, `filter.*`, `wheel.*`, `motorControl.*`) which are actively extracted by `FactExtractor.cs` (lines 543–624) and `factRegistry.ts` (lines 426–495).
- **One-Sentence Fix Note**: Add detailed taxonomy tables covering opening schedule facts, component sub-tree facts, and motor control facts extracted from `Config.xml`.

#### [SLOW-14] Unstated Assumptions Regarding Manual Unit Synthesis Segment Types
- **Document & Section Reference**: `docs/field_derivation_report.md` § 6 Synthesis Architecture in Manual Creation Mode (Lines 218–239)
- **Gap Category**: Unstated Assumptions
- **Impact Description**: Section 6 states that manual mode creates Skid 1 with `segment_IP`, intermediary skids with `segment_XA`, and final skid with `segment_FS`. It fails to mention that recent commits added custom segment selection and dynamic segment sequence configuration in `manualUnitFactory.ts`.
- **One-Sentence Fix Note**: Update Section 6 to document the enhanced manual unit setup options including custom segment types, dimensions, and dynamic N-skid configuration.

#### [SLOW-15] Outdated Description of Batch Scripts in Finding DUP-09 and DUP-10 as Unimplemented Refactoring
- **Document & Section Reference**: `audits/code_duplication_audit.md` § Finding DUP-09 (Line 87) & Finding DUP-10 (Line 88)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Findings DUP-09 and DUP-10 present `scripts/init_env.bat` and `scripts/launch.bat` as proposed future refactorings to be created. In reality, both scripts were already implemented and integrated into root batch files (`setup.bat`, `publish-release.bat`, `launch-app.bat`, `launch-rule-editor.bat`, `build-all.bat`, `run-tests.bat`). An agent reading this audit will think these shared scripts do not exist.
- **One-Sentence Fix Note**: Update findings DUP-09 and DUP-10 to indicate that `scripts/init_env.bat` and `scripts/launch.bat` have already been implemented and are actively utilized across root scripts.

#### [SLOW-16] Unstated Dependency Assumption for `tsx` in Finding DUP-04 Remediation Snippet
- **Document & Section Reference**: `audits/code_duplication_audit.md` § Finding DUP-04 (Lines 121–152) & § 5.2 (Line 1215)
- **Gap Category**: Unstated Assumptions
- **Impact Description**: The remediation snippet for DUP-04 instructs running `tsx scripts/test_ast_converter.mjs` and importing `astConverter.ts` directly, but `tsx` is not installed in `package.json` or `node_modules`. An agent attempting to execute this command without installing `tsx` will get command-not-found errors.
- **One-Sentence Fix Note**: State that `tsx` (or `ts-node`/`vitest`) must be added to `devDependencies` in `package.json` before running the proposed TypeScript test command.

---

### Tier 3: Minor (Low)

#### [MINOR-01] Ambiguous Deployable Asset Verification Invariant
- **Document & Section Reference**: `docs/operations/development.md` § Build & Test Commands (Line 45)
- **Gap Category**: Ambiguous Steps
- **Impact Description**: Line 45 states "Confirm that dist/index.html, resources/rulepack/manifest.json, all four manifest-declared Rule Pack members, and resources/bin/unpack32.exe / ywunpack.dll ... are present before release" without specifying exact file paths or providing an automated check command.
- **One-Sentence Fix Note**: Provide explicit relative paths and the automated verification command (`node scripts/build_rulepack.mjs` and MSBuild verification) to confirm all release bundle members.

#### [MINOR-02] Unguided Test Failure Scenarios and Diagnostic Logs
- **Document & Section Reference**: `docs/operations/validation.md` § Automated Verification (Lines 5–17)
- **Gap Category**: Unguided Error Scenarios
- **Impact Description**: The runbook provides no guidance on interpreting xUnit test failure logs, OpenXML schema validation assertion errors, or hash divergence errors.
- **One-Sentence Fix Note**: Add a troubleshooting table describing common test failure symptoms, log locations, and remediation procedures.

#### [MINOR-03] Ambiguous Verification Mode Semantics and Extension Guidelines
- **Document & Section Reference**: `docs/rule_and_logic_editor_guide.md` § 2.1 Rule Definition Data Model (Table 2.1, Line 92)
- **Gap Category**: Ambiguous Steps
- **Impact Description**: Table 2.1 lists `verificationMode` with values `'ManualCheckbox'`, `'AutoEvaluated'`, `'MeasurementVerify'`, but does not explain how the UI or C# engine interprets `'MeasurementVerify'` vs `'ManualCheckbox'` or whether measurement thresholds are supported.
- **One-Sentence Fix Note**: Clarify the operational behavior and current implementation state of each `verificationMode` value in the detailer workspace.

#### [MINOR-04] Ambiguous Excel Cell Mapping vs Dynamic Skid Row Layout
- **Document & Section Reference**: `docs/AHU_Verification_E2E_Workflow_Audit.md` § 5.4 Verification Checklist Rules (Lines 347–358)
- **Gap Category**: Ambiguous Steps
- **Impact Description**: Table 5.4 references Columns S, T, Y, Z on `Verification List`, but does not clearly explain how dynamic row expansion shifts row indexes from the base template starting at row 26.
- **One-Sentence Fix Note**: Add a note explaining that row indexes for verification checks are dynamically generated starting at row 26 grouped under skid headers, rather than fixed static rows.

#### [MINOR-05] Outdated Test Execution Metrics in Historical Staleness Report
- **Document & Section Reference**: `docs/documentation_staleness_report.md` § 3.2 Test Suites Inventory & § 6 Verification Record (Line 370)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Table 3.2 and Section 6 state that 20 tests passed in 2.26s, whereas the current test suite contains 28 tests.
- **One-Sentence Fix Note**: Update the test execution inventory note to reflect current test suite expansion from 20 to 28 tests.

#### [MINOR-06] Unclear Distinction Between Standalone Config.xml and UPZ Archive Order Facts
- **Document & Section Reference**: `docs/field_derivation_report.md` § 3.1 Order & Identity Domain (Lines 94–99)
- **Gap Category**: Ambiguous Steps
- **Impact Description**: Section 3.1 notes that in standalone `Config.xml` mode, order fields default to placeholders like `"Medical Center Phase 3"`, but does not clarify whether the OpenXML export allows blank/placeholder order fields or requires manual confirmation.
- **One-Sentence Fix Note**: Clarify that standalone XML import populates placeholder defaults that should be confirmed in the UI prior to final OpenXML export.

#### [MINOR-07] Outdated .NET 10 References and Inconsistent Test Count Baseline in Code Duplication Audit
- **Document & Section Reference**: `audits/code_duplication_audit.md` § 1.1 Architecture (Line 36) & § 5.3 Quality Gate (Line 1228)
- **Gap Category**: Outdated / Contradictory Information
- **Impact Description**: Line 36 describes the C# engine as ".NET 10", and line 1228 specifies "*Pass Criteria*: 15 passed, 0 failed", which conflicts with actual .NET 8 target and 28 passed tests.
- **One-Sentence Fix Note**: Correct the framework target to .NET 8 and update the test pass criteria count to 28 tests.

#### [MINOR-08] Missing Multi-Document Entry Structure and Schema Metadata in Context Manifest
- **Document & Section Reference**: `docs/context-manifest.json` Lines 3–17
- **Gap Category**: Missing Information
- **Impact Description**: The manifest lacks entries for individual operational and architectural guides, preventing fine-grained freshness checking per document subsystem.
- **One-Sentence Fix Note**: Add distinct manifest document entries for each architectural guide, operations runbook, and audit report.

---

## 4. Cross-Cutting Analysis & Synthesis

1. **The .NET 10 vs .NET 8 Narrative Collision**:
   Across multiple documents (`development.md`, `staleness_report.md`, `code_duplication_audit.md`, `AHU_Verification_E2E_Workflow_Audit.md`), text was written asserting that the system migrated to .NET 10. However, all C# project files target `net8.0` and `net8.0-windows`. This is a classic documentation-first drift where architectural intent was documented before the project framework upgrade was executed.

2. **Fact Provenance Contract Drift**:
   Both `docs/field_derivation_report.md` and `docs/AHU_Verification_E2E_Workflow_Audit.md` state that calculated skid weight has `RequiresConfirmation` confidence and blocks rule evaluation. Both TypeScript (`factRegistry.ts`) and C# (`FactExtractor.cs`) assign `Authoritative` confidence to calculated skid weights. Either the code lacks the intended safety gating, or the documentation over-specifies safety constraints.

3. **Tooling & Automation Desynchronization**:
   The repository contains a mature set of root batch scripts (`setup.bat`, `publish-release.bat`, `build-all.bat`, `launch-app.bat`, `launch-rule-editor.bat`, `run-tests.bat`, `start-dev.bat`, `menu.bat`) and shared utilities (`scripts/init_env.bat`, `scripts/launch.bat`). However, `development.md` and `validation.md` either omit them or cite outdated one-off CLI invocations.

4. **Agent Ground Scoping Deficiency**:
   `docs/context-manifest.json` only tracks `docs/architecture/README.md`. As new features (e.g. Rule Editor studio, UPZ extraction, dynamic OpenXML pruning) were developed, the context manifest was not updated with multi-document tracking scopes, allowing operations runbooks and guides to drift silently without triggering freshness warnings.
