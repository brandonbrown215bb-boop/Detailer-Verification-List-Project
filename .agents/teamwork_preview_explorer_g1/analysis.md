# Documentation Gap & Inaccuracy Audit Report: Group 1 (Root Docs, Architecture, ADRs 0001–0003)

**Auditor**: Explorer 1  
**Target Repository**: `Detailer-Verification-List-Project`  
**Date**: 2026-08-28  
**Scope**: 
1. `README.md` (Root Documentation & Quick Start)
2. `PROJECT.md` (Project Context, Inventory, Milestones)
3. `AGENTS.md` (Agent Grounding Contract)
4. `GEMINI.md` (Tool & Agent Passthrough)
5. `docs/architecture/README.md` (System Architecture Specification)
6. `docs/decisions/README.md` (Architecture Decisions Index)
7. `docs/decisions/0001-ahu-verification-desktop-architecture.md` (ADR 0001)
8. `docs/decisions/0002-ui-ux-design-specification.md` (ADR 0002)
9. `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` (ADR 0003)

---

## Executive Summary

An exhaustive audit of Root Documentation, the Architecture Specification, and early Architecture Decision Records (ADRs 0001–0003) was conducted from the perspective of an AI agent onboarding with a fresh context window. 

Every claim, path, command, build requirement, and architectural invariant was cross-referenced against the actual codebase (`src/backend/**/*.csproj`, `package.json`, `build-*.bat`, `scripts/*.mjs`, `resources/**`, `tests/**`).

### Key Audit Highlights:
- **Critical Path Errors**: `README.md` documents a non-existent `src/rulepack/` directory for core rule definitions when the canonical files actually reside in `resources/rulepack/`. `docs/architecture/README.md` references non-existent scope paths (`implementation_plan.md`, `spike/**`).
- **Framework Version Confusion**: `README.md`, `PROJECT.md`, `docs/architecture/README.md`, and `ADR 0001` repeatedly claim the system is built on `.NET 10`, whereas all four `.csproj` project files compile against `net8.0` / `net8.0-windows` and `scripts/init_env.bat` tests for .NET 8.0+.
- **Stale Project Identity in `PROJECT.md`**: `PROJECT.md` was overwritten during a previous code duplication audit and currently lists code duplication clusters and duplication milestones instead of the AHU Detailing Verification system's feature set and durable architecture.
- **Contract & Tooling Discrepancies**: `AGENTS.md` mandates reading `.agents/state/current.md` (which does not exist) and executing `Agent Ground status` (which is not an available CLI tool). `docs/architecture/README.md` lists `parseXml` as an IPC action (which is not implemented in `BridgeHandler.cs`) while omitting `checkRulePackUpdate` and `selectFolderDialog`. `ADR 0003` claims MSBuild target `ValidatePackagedAssets` validates rulepack files, which is not present in `.csproj`.

### Finding Counts by Severity:
| Document | Blocks the Reader (Critical) | Slows the Reader (Moderate) | Minor (Low) | Total |
| :--- | :---: | :---: | :---: | :---: |
| `README.md` | 2 | 3 | 1 | **6** |
| `PROJECT.md` | 1 | 1 | 1 | **3** |
| `AGENTS.md` | 1 | 2 | 1 | **4** |
| `GEMINI.md` | 0 | 0 | 1 | **1** |
| `docs/architecture/README.md` | 2 | 3 | 1 | **6** |
| `docs/decisions/README.md` | 0 | 1 | 1 | **2** |
| `docs/decisions/0001-ahu-verification-desktop-architecture.md` | 1 | 2 | 0 | **3** |
| `docs/decisions/0002-ui-ux-design-specification.md` | 0 | 2 | 1 | **3** |
| `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` | 1 | 1 | 1 | **3** |
| **Total** | **8** | **15** | **8** | **31** |

---

## 1. Severity Tier: Blocks the Reader (Critical)

### `[BLOCKER-01] Non-Existent src/rulepack/ Directory Path in Repository Structure Tree`
- **Document & Section Reference**: `README.md` § 📂 Repository Structure (lines 65–70)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The repository layout diagram in `README.md` asserts that baseline rulepack files (`rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`, `manifest.json`) reside under `src/rulepack/`. An AI agent attempting to read, inspect, or edit rules in `src/rulepack/` will encounter missing file errors because `src/rulepack/` does not exist in the repository; all baseline rulepack files are located in `resources/rulepack/`.
- **One-Sentence Fix Note**: Update the repository tree in `README.md` to remove `src/rulepack/` and accurately reflect `resources/rulepack/` as the sole baseline rulepack directory.

### `[BLOCKER-02] .NET 10 Framework Version Contradiction Against Project Configurations`
- **Document & Section Reference**: `README.md` § 🛠️ Prerequisites & Requirements (line 98) & § ⚡ Quick Start (line 16)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: `README.md` states the project requires the `.NET 10 SDK` and advertises the desktop app as `.NET 10 + WebView2`, whereas all `.csproj` files (`AHUVerification.Core`, `AHUVerification.App`, `AHUVerification.RuleEditor`, `AHUVerification.Tests`) target `net8.0` / `net8.0-windows` and `scripts/init_env.bat` validates `.NET 8.0 or later`. A fresh agent configuring an environment or modifying build targets will be misled about the actual target framework.
- **One-Sentence Fix Note**: Align `README.md` prerequisites and descriptions to clearly state .NET 8 (TFM `net8.0`/`net8.0-windows`) with .NET 10 SDK forward compatibility.

### `[BLOCKER-03] Stale Project Scope and Feature Inventory Overwritten by Code Duplication Audit`
- **Document & Section Reference**: `PROJECT.md` § Project: Code Duplication Audit & DRY Remediation (lines 1–48)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: `PROJECT.md` currently contains the title, feature inventory (24 duplication clusters), and milestones (M0–M3) from a previously completed code duplication audit task, completely displacing the AHU Detailing Verification application's actual feature inventory and durable architectural goals. A fresh AI agent reading `PROJECT.md` will misinterpret the repository as a code duplication utility rather than an engineering verification desktop suite.
- **One-Sentence Fix Note**: Reset `PROJECT.md` to document the primary AHU Detailing Verification System architecture, domain feature inventory, and active project milestones.

### `[BLOCKER-04] Unresolvable Reference to Non-Existent .agents/state/current.md`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (line 4)
- **Gap Category**: `Missing Information`
- **Impact Description**: Line 4 instructs agents: "Read docs/architecture/README.md, relevant ADRs under docs/decisions/, and .agents/state/current.md when present before substantial changes." However, `.agents/state/current.md` does not exist in the repository, and no guidance explains how or when state files are initialized.
- **One-Sentence Fix Note**: Clarify in `AGENTS.md` that `.agents/state/current.md` is an optional runtime checkpoint and describe fallback behavior when the directory does not exist.

### `[BLOCKER-05] Ghost File and Folder References in Architecture Frontmatter Scope`
- **Document & Section Reference**: `docs/architecture/README.md` § Frontmatter Scope (lines 4–10)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The YAML frontmatter lists `implementation_plan.md` and `spike/**` in the scope definition. Neither `implementation_plan.md` nor `spike/` exists anywhere in the repository. An automated tool or agent indexing architecture scope will fail or flag dead references.
- **One-Sentence Fix Note**: Remove `implementation_plan.md` and `spike/**` from the `scope` array in `docs/architecture/README.md`.

### `[BLOCKER-06] Inaccurate IPC Action Catalog Contradicting C# and TypeScript Implementations`
- **Document & Section Reference**: `docs/architecture/README.md` § 3. Desktop Host & Typed Asynchronous IPC Bridge (lines 80–85)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The architecture document asserts that the bridge supports 11 actions including `parseXml`, while omitting `checkRulePackUpdate` and `selectFolderDialog`. In reality, `parseXml` is handled locally on the client and is not a bridge action in `BridgeHandler.cs` or `desktopBridge.ts`, whereas `checkRulePackUpdate` and `selectFolderDialog` are actively implemented in `BridgeHandler.cs`. An agent attempting to invoke `parseXml` over IPC will encounter an `Unknown bridge action` exception.
- **One-Sentence Fix Note**: Correct the IPC bridge action list in `docs/architecture/README.md` to match the exact action registry in `BridgeHandler.cs` and `desktopBridge.ts` (removing `parseXml`, adding `checkRulePackUpdate` and `selectFolderDialog`).

### `[BLOCKER-07] Conflicting TargetFramework Directives Between Decision 1 and Addendum 1`
- **Document & Section Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` § Decisions (line 12) vs § Addendum (line 43)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Decision 1 specifies `.NET 8 / C#`, while Addendum 1 asserts the project is "Standardized on .NET 10 (`net10.0-windows` / `net10.0`)". However, the actual csproj files in the repository target `net8.0` / `net8.0-windows`. An onboarding AI agent cannot determine whether .NET 10 migration was completed, partially reverted, or merely proposed.
- **One-Sentence Fix Note**: Clarify in ADR-0001 Addendum 1 that the project remains configured for `net8.0`/`net8.0-windows` target frameworks while utilizing the .NET 10 SDK toolchain.

### `[BLOCKER-08] MSBuild Packaging Target Claim Contradicts Actual .csproj Implementation`
- **Document & Section Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` § Addendum — 2. MSBuild Packaging Verification (lines 44–45)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Addendum 2 claims that MSBuild target `ValidatePackagedAssets` enforces that "dist/index.html, all 5 resources/rulepack/ files, and both resources/bin/ native binaries exist prior to publish." In reality, inspection of `AHUVerification.App.csproj` reveals that `ValidatePackagedAssets` only checks `dist\index.html`, `resources\bin\unpack32.exe`, and `resources\bin\ywunpack.dll`—it does NOT check any of the 5 `resources/rulepack/` files. A missing rulepack file will pass MSBuild validation and result in a broken publish package.
- **One-Sentence Fix Note**: Update ADR-0003 Addendum 2 to document the exact asset conditions checked by MSBuild, and recommend expanding the target to validate all `resources/rulepack/` artifacts.

---

## 2. Severity Tier: Slows the Reader (Moderate)

### `[SLOW-01] Unstated Fallback Behavior in Browser Preview Mode`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 1. Developing Frontend Interfaces (lines 106–112)
- **Gap Category**: `Missing Information`
- **Impact Description**: The guide instructs developers to open `http://localhost:5173/` in a web browser without explaining that browser preview mode operates without the C# WebView2 IPC bridge, causing native features (UPZ decompression, native OpenXML file generation, native file dialogs) to run in mock or degraded browser-only fallback mode.
- **One-Sentence Fix Note**: Add a note to Development Workflow 1 explaining that standard browser mode uses client-side fallbacks (SheetJS export, localStorage) and requires the WebView2 desktop host for full OpenXML and native UPZ extraction capabilities.

### `[SLOW-02] Missing Manifest Hashing Prerequisite for Passing Automated Tests`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 3. Editing & Validating Rules (lines 118–122) & 4. Running Automated Tests (lines 124–135)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: If an agent edits `resources/rulepack/rules.json` and runs `dotnet test` or `run-tests.bat` without first executing `build-rulepack.bat` (`node scripts/build_rulepack.mjs`), `RulePackManagerTests` will fail due to a SHA-256 manifest mismatch. The workflow does not explicitly warn that rule edits invalidate the test suite until re-hashed.
- **One-Sentence Fix Note**: Explicitly state in Workflow 3 and 4 that `build-rulepack.bat` must be executed after any rulepack JSON modification before running the test suite.

### `[SLOW-03] Unguided Release Build Failure on Missing Frontend Dist Directory`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 5. Packaging & Deploying Releases (lines 136–143)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: If an agent runs `dotnet publish` directly instead of `publish-release.bat`, MSBuild target `ValidatePackagedAssets` fails with an error if `npm run build` has not been executed first. The documentation does not explain this dependency chain or provide recovery steps.
- **One-Sentence Fix Note**: Document in the packaging section that `npm run build` is a mandatory prerequisite before running `dotnet publish` to prevent MSBuild asset validation failures.

### `[SLOW-04] Framework Version Inconsistency in Project Architecture Summary`
- **Document & Section Reference**: `PROJECT.md` § Architecture (line 5)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Line 5 lists `C# .NET 10 Core Engine`, contradicting the actual `net8.0` target in `src/backend/AHUVerification.Core/AHUVerification.Core.csproj`.
- **One-Sentence Fix Note**: Update the architecture summary in `PROJECT.md` to specify .NET 8 (TFM `net8.0`) for the Core engine.

### `[SLOW-05] Undefined and Non-Executable Agent Ground status CLI Command`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (line 5)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: Line 5 commands agents to "Run Agent Ground status before trusting architecture notes," but `Agent Ground` is not an installed CLI executable or environment path command on the host. An agent attempting to execute `Agent Ground status` in bash/powershell will encounter a command-not-found error.
- **One-Sentence Fix Note**: Clarify whether `Agent Ground status` refers to an external tool/skill or replace it with the specific repository freshness verification steps.

### `[SLOW-06] Unconditional CodeGraph Reference Without Repository Presence`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (line 6)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: Line 6 states "If .codegraph/ exists, use CodeGraph before grep or manual source wandering". Because `.codegraph/` is not committed or generated by default, fresh agents without CodeGraph MCP context are unsure if CodeGraph generation is required before exploring code.
- **One-Sentence Fix Note**: Clarify in `AGENTS.md` that CodeGraph indexing is optional and that ripgrep/find_by_name are standard primary tools when `.codegraph/` is absent.

### `[SLOW-07] .NET 10 Framework Claims Inconsistent with Solution TargetFramework net8.0`
- **Document & Section Reference**: `docs/architecture/README.md` § Purpose (line 17) & § 3. Desktop Host (line 81)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: The document repeatedly specifies `.NET 10`, but the underlying projects compile against `net8.0` and `net8.0-windows`. Agents designing new backend modules or compiling code might assume .NET 10 runtime/language features that are unavailable in .NET 8.
- **One-Sentence Fix Note**: Update the architecture specification to state .NET 8 as the current project target framework with .NET 10 host SDK support.

### `[SLOW-08] Unstated Temp Directory and Permissions Assumptions for Native UPZ Decompression`
- **Document & Section Reference**: `docs/architecture/README.md` § 2. Ingestion & Data Pipeline (lines 74–75)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: The document explains that `UpzBundleExtractor` invokes `unpack32.exe` / `ywunpack.dll` in an isolated temp directory, but does not state the prerequisite assumptions: 32-bit execution support on Windows x64 host OS, write access to `Path.GetTempPath()`, and execution permissions for spawned subprocesses.
- **One-Sentence Fix Note**: Add a note under Ingestion describing the subprocess execution model, required OS architecture support (32-bit on x64), and temporary directory permissions.

### `[SLOW-09] Unguided Rule Editor Synchronization Architecture`
- **Document & Section Reference**: `docs/architecture/README.md` § 7. Rule & Logic Editor Desktop Studio (lines 104–110)
- **Gap Category**: `Missing Information`
- **Impact Description**: Section 7 describes the standalone Rule Editor studio and its publishing engine, but omits the workflow explaining how published rulepacks in `resources/rulepack/` are reloaded by the running verification app (`AHUVerification.App`) or propagated across machines.
- **One-Sentence Fix Note**: Add a section explaining the synchronization mechanism between the Rule Editor output and the main application's rulepack loader.

### `[SLOW-10] Lack of ADR Template, Creation Workflow, and Decision Lifecycle Guidance`
- **Document & Section Reference**: `docs/decisions/README.md` (lines 1–15)
- **Gap Category**: `Missing Information`
- **Impact Description**: `docs/decisions/README.md` contains only a 1-sentence preamble and a markdown link list for ADRs 0001–0009. It provides no guidance on the ADR template structure (Context, Decision, Consequences, Addenda), numbering conventions, or status lifecycle (`Proposed`, `Accepted`, `Superseded`) for agents authoring new ADRs.
- **One-Sentence Fix Note**: Add an ADR authoring standard section to `docs/decisions/README.md` detailing the template format, numbering scheme, and status lifecycle.

### `[SLOW-11] Ambiguity Between File-Based Autosave (.dvl) and Browser LocalStorage Autosave`
- **Document & Section Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` § Decisions (line 27) vs § Addendum (line 45)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Decision 6 states the application performs "Continuous background autosaving to `%LOCALAPPDATA%/AHUVerification/autosave.dvl`", while Addendum 3 states "Frontend debounces active state autosaves to WebView2 `localStorage` (`ahu_dvl_autosave`)". The documentation does not clarify whether both mechanisms operate simultaneously or if `localStorage` completely superseded the `%LOCALAPPDATA%` file autosave.
- **One-Sentence Fix Note**: Update ADR-0001 to explicitly delineate that client UI state is cached in WebView2 `localStorage` during active editing while project persistence to disk is triggered on explicit Save/Save As.

### `[SLOW-12] Unguided Recovery for Corrupted Autosave State`
- **Document & Section Reference**: `docs/decisions/0001-ahu-verification-desktop-architecture.md` § Addendum (line 45)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: If the serialized `ahu_dvl_autosave` state in `localStorage` becomes corrupted, malformed, or incompatible with an updated rulepack schema, the application frontend may fail on initial load. ADR-0001 does not specify an automated recovery or schema-version discard policy.
- **One-Sentence Fix Note**: Document error-handling and recovery semantics in ADR-0001 specifying that corrupted or version-mismatched autosave payloads are safely discarded with fallback to empty state.

### `[SLOW-13] Unguided Special Quote (SQ) Overflow Beyond 22 Excel Slots`
- **Document & Section Reference**: `docs/decisions/0002-ui-ux-design-specification.md` § Decisions — 3. Special Quotes (SQ) & Deviation Manager (lines 23–25)
- **Gap Category**: `Unguided Error Scenario`
- **Impact Description**: Decision 3 notes that the UI displays an active slot counter (`X / 22 slots used`) and maps up to 22 entries into the official Excel template. However, it does not define the system behavior when a detailer enters more than 22 SQs (e.g. whether the UI blocks entry, warns the user, or truncates at export time).
- **One-Sentence Fix Note**: Explicitly state in ADR-0002 the overflow handling policy when >22 SQs are entered (e.g. UI warning and export truncation/validation gating).

### `[SLOW-14] Unstated Conflict Resolution Policy for Manual Overrides vs. XML Re-Import`
- **Document & Section Reference**: `docs/decisions/0002-ui-ux-design-specification.md` § Decisions — 2. General Unit Interface & 5. Fact Resolution Model (lines 18–21, 33–37)
- **Gap Category**: `Unstated Assumption`
- **Impact Description**: The document explains that facts have provenance (`Auto: Config.xml`, `Overridden`, `Manual Entry`), but does not define what happens when a user who has manually overridden facts re-imports a modified `Config.xml` (whether manual overrides are preserved, overwritten, or flagged as conflicts).
- **One-Sentence Fix Note**: Add a specification in ADR-0002 stating that re-importing XML retains manual overrides while updating underlying raw XML baseline values, displaying a conflict badge if values diverge.

### `[SLOW-15] Unguided Remote Rulepack Sync Failure and LKG Storage Specification`
- **Document & Section Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` § Decisions — 1. Rule Pack integrity (lines 17–18)
- **Gap Category**: `Missing Information`
- **Impact Description**: Decision 1 mentions "Last Known Good (LKG) rollback" during remote sync, but does not define where LKG rulepacks are persisted (directory path), how corrupted sync attempts are isolated, or how detailers are notified when a remote sync fails due to hash or network errors.
- **One-Sentence Fix Note**: Specify the exact LKG local storage directory and fallback error notification protocol in ADR-0003.

---

## 3. Severity Tier: Minor (Low)

### `[MINOR-01] Incomplete List of Test Fixture Classes in Test Runner Reference`
- **Document & Section Reference**: `README.md` § 💻 Development Workflows — 4. Running Automated Tests (lines 125–135)
- **Gap Category**: `Missing Information`
- **Impact Description**: The test list enumerates 7 test fixtures but omits test helper infrastructure files (`TestGraphFactory.cs`, `TestPipelineContext.cs`, `TestPathHelper.cs`), which agents need to know about when authoring new xUnit tests.
- **One-Sentence Fix Note**: Add a brief note mentioning `TestGraphFactory` and `TestPipelineContext` in the test documentation as standard shared fixture helpers.

### `[MINOR-02] Omission of Rule Pack and Asset Directories in Code Layout Section`
- **Document & Section Reference**: `PROJECT.md` § Code Layout (lines 49–59)
- **Gap Category**: `Missing Information`
- **Impact Description**: The code layout section lists root, deliverable, backend, frontends, and tests, but omits `resources/rulepack/` (baseline rules and Excel template) and `resources/bin/` (native decompression binaries).
- **One-Sentence Fix Note**: Add `resources/rulepack/` and `resources/bin/` to the Code Layout listing in `PROJECT.md`.

### `[MINOR-03] Lack of Onboarding Build and Test Guidance for Subagents`
- **Document & Section Reference**: `AGENTS.md` § Repository Ground (lines 1–11)
- **Gap Category**: `Missing Information`
- **Impact Description**: `AGENTS.md` lacks quick-reference commands for building and testing the C# and TypeScript projects (`dotnet test`, `npm run build`, `build-all.bat`), forcing new agents to search through other files.
- **One-Sentence Fix Note**: Append a concise Quick Verification Commands section to `AGENTS.md` listing standard build and test CLI invocations.

### `[MINOR-04] Minimal Passthrough File Lacking Standalone Onboarding Context`
- **Document & Section Reference**: `GEMINI.md` (lines 1–6)
- **Gap Category**: `Missing Information`
- **Impact Description**: `GEMINI.md` contains only an `@AGENTS.md` directive and a one-line note. While functionally valid as an alias, it provides no Gemini-specific tooling hints or platform context for AI agents reading it directly.
- **One-Sentence Fix Note**: Ensure `GEMINI.md` explicitly notes that full project rules and agent grounding contracts reside in `AGENTS.md`.

### `[MINOR-05] Uncommitted Verification Hash Marker in Architecture Frontmatter`
- **Document & Section Reference**: `docs/architecture/README.md` § Frontmatter (line 3)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: `verified_at_commit: UNCOMMITTED` is a temporary placeholder that was never pinned to a stable Git commit SHA.
- **One-Sentence Fix Note**: Update `verified_at_commit` with the authoritative commit SHA once baseline documentation is stabilized.

### `[MINOR-06] Discrepancy Between Historical ADR 0002/0003 Working Titles and Repository Filenames`
- **Document & Section Reference**: `docs/decisions/README.md` (lines 6–7)
- **Gap Category**: `Outdated / Contradictory`
- **Impact Description**: Historical prompt specifications and early roadmap manifests reference ADR 0002 as `0002-rules-engine-selection.md` and ADR 0003 as `0003-hybrid-excel-read-strategy.md`, whereas the actual repository files are `0002-ui-ux-design-specification.md` and `0003-rulepack-persistence-and-desktop-delivery.md`. While `docs/decisions/README.md` correctly links to the current files, agents searching for the older titles will not find them without a cross-reference.
- **One-Sentence Fix Note**: Add an alias/historical mapping note in `docs/decisions/README.md` clarifying that ADR 0002 and 0003 reflect UI/UX Architecture and Rulepack Persistence respectively.

### `[MINOR-07] Ambiguity in Export Deliverable Default File Naming Token Substitution`
- **Document & Section Reference**: `docs/decisions/0002-ui-ux-design-specification.md` § Decisions — 6. Export Pre-Flight & Delivery Workflow (line 43)
- **Gap Category**: `Ambiguous Step`
- **Impact Description**: The default filename pattern is given as `<JobName>_<COM>_Detailing_Verification_List.xlsx`, but does not specify fallback naming if Job Name or COM # has not yet been populated by the user (e.g. when opening a unit without OrderRev metadata).
- **One-Sentence Fix Note**: Specify fallback naming tokens in ADR-0002 (e.g. `UNTITLED_Detailing_Verification_List.xlsx`) when JobName or COM is undefined.

### `[MINOR-08] Omission of Rule Editor Packaging Rules in Desktop Delivery Decision`
- **Document & Section Reference**: `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` § Decisions — 4. Desktop delivery (lines 28–30)
- **Gap Category**: `Missing Information`
- **Impact Description**: Section 4 focuses primarily on `AHUVerification.App` delivery but does not explicitly describe the secondary desktop host `RuleEditor.exe` (`AHUVerification.RuleEditor`), which requires `dist/rule-editor.html` rather than `dist/index.html`.
- **One-Sentence Fix Note**: Add `RuleEditor.exe` and its asset dependency (`dist/rule-editor.html`) to the Desktop Delivery specifications in ADR-0003.

---

## Synthesis & Priority Recommendations for Documentation Refresh

1. **Immediate Rulepack Path Realignment**: Fix `README.md` § Repository Structure to eliminate `src/rulepack/` and establish `resources/rulepack/` as the single canonical location.
2. **Framework Alignment**: Harmonize all mentions of `.NET 10` across `README.md`, `PROJECT.md`, `docs/architecture/README.md`, and `ADR 0001` to reflect that the solution projects target `net8.0` / `net8.0-windows` while supporting execution via the .NET 10 SDK.
3. **Reset PROJECT.md**: Cleanse the temporary code duplication inventory from `PROJECT.md` and restore the full AHU Detailing Verification product specification and active roadmap.
4. **Synchronize IPC Action Catalogs**: Update `docs/architecture/README.md` to remove phantom action `parseXml` and document `checkRulePackUpdate` and `selectFolderDialog`.
5. **Enforce MSBuild Target Consistency**: Update `ADR 0003` to reflect actual MSBuild `ValidatePackagedAssets` behavior and enhance `AHUVerification.App.csproj` to enforce presence of all 5 `resources/rulepack/` files.
