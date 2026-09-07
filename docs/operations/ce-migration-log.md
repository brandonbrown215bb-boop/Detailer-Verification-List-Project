# C# Authoritative Engine Migration Log

Date: 2026-09-06
Status: Historical migration record — not current acceptance evidence
Active Slice: None recorded; current acceptance remains pending
Completion plan: [C# migration remediation](csharp-migration-remediation-plan.md)
Architecture Decision: [ADR 0012](../decisions/0012-csharp-authoritative-engine-and-browser-engine-retirement.md)

The slice entries below record the initial migration (CE0–CE6) and the subsequent remediation claims (CE-R1–CE-R6). They preserve prior results and are not proof that the current working tree is accepted. Use the linked remediation plan for current gaps and required evidence.

---

## 1. Inspection Baseline Lock (CE0)

- **Baseline Commit:** `ed8e9d5` (`feat: baseline material mapping, surface gauge parsing, and CE migration plan` on `master`)
- **Pre-migration Tree:** Clean commit on `master` incorporating recent material mapping and surface gauge parsing fixes.
- **Environment & Toolchain:**
  - .NET SDK: `8.0.424`
  - Node.js: `24.14.0` (active) / `22.18.0` (pinned)
  - npm: `11.9.0`
  - WebView2 Runtime: `152.0.4191.62`
- **Baseline Test Results:**
  - .NET Core Test Suite: 206/206 tests passing (`AHUVerification.Tests.dll`)
  - Frontend Test Suite: 22/22 test suites passing (copy linter, contrast, AST, reducers, etc.)
  - Production Bundle Build: `npm run build` exits 0 (clean compilation)
  - Rule Pack Build: `node scripts/build_rulepack.mjs` exits 0 (v14.0.0 built cleanly)

---

## 2. Retiring Modules & Consumer Inventory (CE0)

The following modules will be retired and removed during the migration (CE2 through CE5):

| Retiring Module | Exported Responsibilities | Current Callers & Consumers | Replacement in C# Core / Host |
|---|---|---|---|
| `src/services/browserPreviewIngestion.ts` | Non-certifying browser-preview XML parsing and fact extraction pipeline | `src/hooks/useProjectSession.ts` | Host project session: `ProjectSessionService.OpenSource` |
| `src/services/xmlParser.ts` | Browser XML parsing, section tree extraction, surface mapping | `src/services/browserPreviewIngestion.ts`, `scripts/test_cross_runtime_parity.mjs`, `scripts/test_m2_parity_and_bridge.mjs` | `AHUVerification.Core.Parsers.NormalizedXmlParser` |
| `src/services/factRegistry.ts` (domain logic) | Client-side fact extraction, provenance derivation, custom overrides | `src/hooks/useProjectSession.ts`, `src/services/browserPreviewIngestion.ts`, `src/services/manualUnitFactory.ts`, `scripts/test_cross_runtime_parity.mjs` | `AHUVerification.Core.Services.FactExtractor` |
| `src/services/ruleEvaluator.ts` | AST predicate evaluator, checklist generator, semantic fingerprinting | `src/hooks/useProjectSession.ts`, `src/services/manualUnitFactory.ts`, `src/ruleEditor/components/RuleTestSandbox.tsx`, `scripts/test_cross_runtime_parity.mjs`, `scripts/test_reducers.mjs` | `AHUVerification.Core.Services.AstRuleEvaluator` and `RulePackManager` |
| `src/services/manualUnitFactory.ts` | Synthesizes normalized graph, facts, and checklists for manual units | `src/components/ManualUnitModal.tsx`, `src/hooks/useManualUnitWizard.ts`, `src/hooks/useProjectSession.ts`, `scripts/test_reducers.mjs`, `scripts/test_cross_runtime_parity.mjs` | C# `ManualUnitService` in Core / Host session |
| `src/services/projectStorage.ts` | DVL project construction, JSON canonicalization, hashing, autosave | `src/hooks/useProjectSession.ts`, `src/services/desktopBridge.ts`, `scripts/test_dvl_canonical.mjs`, `scripts/test_reducers.mjs`, `scripts/test_cross_runtime_parity.mjs` | `AHUVerification.Core.Services.DvlProjectManager` |
| `src/services/excelExporter.ts` | Browser client SheetJS workbook generation | `src/services/desktopBridge.ts` (dynamic import), `scripts/test_m2_parity_and_bridge.mjs` | `AHUVerification.Core.Services.OpenXmlTemplatePatcher` |
| `src/utils/readiness.ts` (business rules) | Computes unit & scope readiness, blocking reasons, final eligibility | `src/App.tsx`, `src/components/Header.tsx`, `src/components/PreFlightModal.tsx`, `src/components/ResolutionCenterModal.tsx`, `src/components/Sidebar.tsx`, `src/components/SkidViewTab.tsx` | Core readiness calculation returned in `ProjectSessionSnapshot` |

---

## 3. Domain Assertion & Test Mapping (CE0)

| Domain Area | TypeScript / Script Assertion | Retained / Replacement C# Test |
|---|---|---|
| XML Parsing defaults & materials | `scripts/test_m2_parity_and_bridge.mjs` (Suite 1) | `XmlParserTests.cs`, `MaterialMappingTests.cs` |
| AST Predicate Evaluation | `scripts/test_cross_runtime_parity.mjs`, `tests/ast_predicate_evaluator.test.ts` | `AstEvaluatorTests.cs` |
| Fact Provenance & Derivations | `scripts/test_cross_runtime_parity.mjs` | `FactRegistryTests.cs` |
| Canonical DVL Hashing | `scripts/test_dvl_canonical.mjs` | `DvlProjectTests.cs` |
| Category Sheet Pruning | `excelExporter.ts` sheet pruning tests | `OpenXmlPatcherTests.cs` |
| Project Mutation / State Transitions | `scripts/test_reducers.mjs` | `ProjectSessionTests.cs`, `ProjectSessionBridgeTests.cs` |

---

## 4. Slice Progress Tracker

- [x] **CE0: Lock Baseline and Migration Contract (Completed & Accepted)**
  - Baseline commit `ed8e9d5` established and verified.
  - Successor ADR 0012 drafted, indexed, and accepted.
  - Retiring module consumer inventory and test mapping recorded and completed.
  - Canonical DVL fixtures verified via `DvlProjectTests.cs`.
- [x] **CE1: Establish C# Project Session and Command Contract (Completed & Accepted)**
  - C# `ProjectSessionService`, `ProjectSession`, models, and command records implemented in `AHUVerification.Core.Session`.
  - Typed snapshot DTOs created with complete project state and excluding raw XML.
  - Dedicated bridge actions wired in `BridgeHandler.cs`.
  - Monotonic revision conflict checking implemented; conflicts return current authoritative snapshot.
  - Typed bridge client wrappers implemented in `src/services/desktopBridge.ts` and `src/types/session.ts`.
  - **Defect Remediation & Stabilization (Completed):**
    - [x] Host-held source handle validation required for `IsTrusted = true` (`OpenSourceCommand.IsTrusted` defaults to `false`; `BridgeHandler` enforces `false` unless native file is read directly from disk by host).
    - [x] UI commands and responses bound to originating session ID and lifecycle generation (`sessionLifecycleGeneration`).
    - [x] Bounded LRU request deduplication implemented in C# `ProjectSession` using `requestId`.
    - [x] General comments field name aligned (`comments` property with `[JsonPropertyName("generalComments")]` alias).
    - [x] Rejected mutations explicitly surfaced and thrown rather than swallowed.
- [x] **CE2: Move All Project Workflows onto the Engine (Completed & Accepted)**
  - [x] **CE2-A: Imported projects and edits in UI (Completed & Accepted)**
    - Extended `SessionCommands.cs` and `ProjectSession.cs` with `BatchOverrideFactsCommand` and `ReorderSpecialQuotesCommand` for atomic mutations.
    - Updated `UpdateSpecialQuote` in Core to match by immutable `Id` first to prevent slot collisions.
    - Extended `OpenSourceCommand` with hydration fields (`InitialOverrides`, `InitialChecklists`, `InitialSpecialQuotes`, `InitialGeneralComments`) so opening `.dvl` files launches an active C# `ProjectSession`.
    - Added `projectSessionReadiness` projection in `src/utils/readiness.ts` to map C# snapshot readiness to UI models.
    - **Defect Remediation & Stabilization (Completed):**
      - [x] Save and Export serialize post-flush acknowledged snapshot state instead of pre-flush closure state.
      - [x] Preserved UPZ raw XML metadata (`rawOrderRevisionXml`, `rawManifestXml`) across snapshot sync.
  - [x] **CE2-B: Manual projects and rule-pack changes (Completed & Accepted)**
    - Implemented C# `ManualUnitFactory` and `ManualUnitConfig` in `AHUVerification.Core.Manual`, generating synthetic canonical `<AHU>` XML stored in `RawConfigXml` with `IsTrusted = false` (draft-only, non-certifying).
    - Added `CreateManualProjectCommand` and `ProjectSession.CreateManual` to start active C# project sessions for manual units.
    - Exposed segment templates via `BridgeHandler` (`getSegmentTemplates`) and `DesktopBridge`.
    - Added `UpdateRulePack` on `ProjectSession` and `ProjectSessionService` for host-owned rule-pack synchronization and re-evaluation.
    - Updated `AstRuleEvaluator.GenerateChecklists` to preserve detailer/checker initials and comments across checklist reconciliation.
    - Extended readiness with `ExportBlocked` and `TemplateRetrievable` to block final Excel export when `template.xlsx` is missing or corrupt.
    - Added hard-blocking rule pack error screen in `App.tsx` and error surfacing in `useRulePackSession.ts` when authoritative rule packs cannot be loaded.
    - **Defect Remediation & Stabilization (Completed):**
      - [x] Fixed unescaped XML ampersand bug in `ManualUnitFactory.cs` and `manualUnitFactory.ts` (e.g. `Damper Wall (Return & Outside Air)`).
      - [x] Rewrote `scripts/test_ce2b_manual_and_pack.mjs` to test real manual creation, XML escaping invariants, rule pack updates, and bridge contracts without self-authored mock snapshots.
  - **Evidence:** 240/240 .NET Core tests passing (`AHUVerification.Tests.dll`), 23/23 frontend test suites passing (`npm test`), `npm run build` exits 0 clean.
- [x] **CE3: Move DVL, Recovery, and All Excel Output into C# (Completed & Accepted)**
  - Implemented C# authoritative persistence, opening, recovery, and Excel generation:
    - **DVL Persistence & Integrity**: Embedded exact `template.xlsx` Base64 bytes in `DvlRulePackSnapshot` for complete offline self-containment. Enforced full SHA-256 state and snapshot verification.
    - **Trust Preservation (PO Decision 1)**: Untampered `.dvl` saved from authentic source restores `IsTrusted = true` upon reload.
    - **Save / Save As Workflow (PO Decision 3)**: First save prompts save dialog with `${jobName}_${comNumber}.dvl`; subsequent saves overwrite cleanly in C#; Save As always prompts.
    - **Native Crash Recovery (PO Decision 4)**: Dirty mutations trigger automatic background snapshot to `%LOCALAPPDATA%\AHUVerification\recovery\recovery_session.dvl`. Clean explicit save discards recovery file. Restoring recovery resumes in-flight session (`IsDirty = true`, `CurrentSavePath = null`).
    - **Retire Browser LocalStorage Autosave (PO Decision 5)**: Removed legacy client-side autosave loops completely; frontend delegates entirely to native crash recovery and C# session state.
    - **Authoritative Excel Deliverables (PO Decision 6)**: `ProjectSession.ExportExcel` executes via OpenXmlTemplatePatcher, blocking exports when facts or checklists are incomplete and auto-populating missing `unit.date` with UTC today.
  - Added native bridge endpoints: `projectSession_save`, `projectSession_openDvl`, `projectSession_exportExcel`, `getRecoveryInfo`, `restoreRecovery`, `discardRecovery`.
  - Added frontend contract integration test `scripts/test_ce3_persistence_and_export.mjs`.
  - Added comprehensive C# integration test suite `tests/AHUVerification.Tests/ProjectSessionCe3Tests.cs`.
  - **Evidence:** 245/245 .NET Core tests passing (`AHUVerification.Tests.dll`), 24/24 frontend test suites passing (`npm test`), `npm run build` exits 0 clean.
- [x] **CE4: Unify Rule Editor Processing with Core (Completed & Accepted)**
  - Unified Rule Editor logic with Core C# authoritative engine:
    - **Draft Workflows (PO Decision 1)**: Replaced browser downloads with native Windows `SaveFileDialog` and `OpenFileDialog` (`saveDraft`, `openDraft`). Added unsaved changes confirmation dialog before opening drafts or navigating away.
    - **Live Sandbox Simulation (PO Decision 2)**: Replaced client-side eval with backend C# AST rule evaluation (`evaluateRuleSandbox`) debounced at 50ms, with simulation paused warning banner when AST logic is invalid or incomplete.
    - **Dynamic Excel Mappings & Strict Rejection (PO Decision 3)**: Dynamically generates Excel cell coordinates (`S{row}`, `T{row}`, `V{row}`, `Y{row}`, `Z{row}`) based on rule `excelRow`. Fact contract validation rejects invalid rows or malformed structures, mapping structured errors to rule IDs and field names (`id`, `semanticKey`, `excelRow`, `scope`, `verificationMode`, `category`, `predicate`, `requiredFacts`) to highlight and focus offending form fields.
    - **Launcher Gutted from Main App (PO Decision 4)**: Completely removed Rule Editor launch button and state from Settings modal in the main application; removed fallback browser launch paths.
    - **Live Pack Updates (PO Decision 5)**: When active rule pack is published/updated, main application displays a notification banner offering "Reload & Re-verify Project", calling `reloadActiveRulePack` to update the active pack and re-evaluate session checklists while preserving detailer initials, comments, and Special Quotes.
    - **Permanent Rule Deletion (PO Decision 6)**: Added hard delete per rule with confirmation prompt, immediately purging the rule and its dynamic Excel cell mappings.
  - Implemented C# test suite in `tests/AHUVerification.Tests/RuleEditorBridgeTests.cs` (14 unit tests covering validation, dynamic Excel mapping, atomic draft saving/loading, sandbox evaluation, staging and promotion).
  - Evidence: 259/259 .NET Core tests passing (`AHUVerification.Tests.dll`), all frontend test suites passing (`npm test`), `npm run build` exits 0 clean (1,650 modules transformed).
- [x] **CE5: Delete Duplicate Engine and Replace Test Burden (Completed & Accepted)**
  - Physically deleted 8 duplicate TypeScript engine modules from `src/services/`:
    - `browserPreviewIngestion.ts`
    - `xmlParser.ts`
    - `factRegistry.ts`
    - `ruleEvaluator.ts`
    - `manualUnitFactory.ts`
    - `projectStorage.ts`
    - `excelExporter.ts`
    - `rulesCatalog.ts`
  - Uninstalled prototype npm dependencies: `xlsx`, `file-saver`, `@types/file-saver`.
  - Removed `BrowserPreviewBridge` class from `src/services/desktopBridge.ts`; `WebView2DesktopBridge` is now the sole bridge implementation, strictly guarding all bridge methods when running outside the WebView2 desktop host.
  - Implemented `DesktopHostRequiredScreen.tsx` (rendered in `App.tsx` when `!desktopBridge.isDesktopHost()`) with actionable remediation guidance, environment diagnostics JSON, and a Copy Diagnostics button.
  - C# disk-path verification (PO Decision 2): files dropped into `BridgeHandler.OpenProjectSession` are validated on disk; existing files on local filesystem achieve `Certified` (`IsTrusted = true`), while browser/unverified paths fall back to non-certifying `Draft` (`IsTrusted = false`).
  - Removed browser preview fallback logic from UI components (`Header.tsx`, `Sidebar.tsx`, `PreFlightModal.tsx`, `ResolutionCenterModal.tsx`, `HomePage.tsx`, `useProjectSession.ts`, `useRulePackSession.ts`, `readiness.ts`).
  - Created standalone UI manual contracts in `src/types/manual.ts`.
  - Retired obsolete parity/reducer runners: `test_reducers.mjs`, `test_m2_parity_and_bridge.mjs`, `test_cross_runtime_parity.mjs`, `stress_test_readiness_adversarial.mjs`.
  - Converted `CanonicalParityAcceptanceTests.cs` into self-contained pure C# tests for canonical JSON specification, semantic fingerprinting, DVL complete-state save integrity, predicate semantics, and sparse source parsing.
  - Added `scripts/test_ce5_desktop_only.mjs` (16/16 assertions passing) enforcing zero-duplicate engine imports and desktop host invariants.
  - Updated `run-tests.bat` and `package.json` scripts.
  - **Evidence:** 261/261 .NET tests passing (`dotnet test`), Core coverage baseline satisfied across all 8 modules (`npm run test:coverage`), 13/13 frontend suites passing (`npm test` and `run-tests.bat`), `npm run build` exits 0 (1,637 modules transformed, zero `xlsx`/`file-saver`), and bundle budget verified (`node scripts/verify_bundle_budget.mjs`).
- [x] **CE6: Accept Desktop-Only Engine and Update Documentation (Completed & Accepted)**
  - **Packaged Windows Acceptance Walkthrough & Findings Resolution:**
    - Tested production installer `AHUVerification-win-Setup.exe` against core detailing workflows.
    - Diagnosed and resolved all 8 reported user observations:
      1. *Detailer Name Auto-Application*: `useProjectSession.ts` auto-applies `dvl_detailer_name` from `localStorage` on project load.
      2. *Checklist Button Width Shift*: `SkidViewTab.tsx` enforces fixed width `w-20 justify-center shrink-0` on verify button to prevent layout widening.
      3. *Unit Weight Override*: Added `'unit.weight'` to `unitSpecFacts` in `GeneralUnitTab.tsx` so detailers can override weight.
      4. *Revision Mismatch on Save / Export*: Replaced stale React ref with monotonic backend revision from `sessionSnapshotRef.current.revision` in `useProjectSession.ts`.
      5. *Special Quote 22-Slot Hard Cap*: Enforced 22-slot limit in `GeneralUnitTab.tsx` UI and added C# backend bounds validation in `ProjectSession.UpdateSpecialQuote`. Added unit test `ProjectSession_SpecialQuotes_EnforcesSlotBoundsAndMaxCount`.
      6. *Trust Preservation on Open/Resume*: Fixed property access `snapshot.source?.isTrusted` in `useProjectSession.ts` to prevent false draft status upon opening saved `.dvl` or resuming recovery.
      7. *Manual Unit Draft Banner*: Updated `App.tsx` banner to distinguish manual uncertified units (`Manual Unit (Draft Only)`) from unverified source imports.
      8. *Rule Editor Status Badge*: Display `Draft Saved (${draftName}) — Unpublished` (amber badge) instead of claiming synced when saving drafts in `RuleEditorApp.tsx` and `Header.tsx`.
  - **Automated Verification & Coverage:**
    - Full .NET Core test suite: **262/262 tests passing** (`dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`).
    - Core coverage gate satisfied across all 8 modules (`npm run test:coverage`): NormalizedXmlParser (98.24% line, 82.03% branch), FactExtractor (99.35% line, 89.09% branch), AstRuleEvaluator (83.28% line, 72.76% branch), VerificationHostService (84.40% line, 65.69% branch), DvlProjectManager (85.71% line, 75.07% branch), OpenXmlTemplatePatcher (94.89% line, 79.67% branch), RulePackManager (78.26% line, 55.77% branch), UpzBundleExtractor (68.18% line, 44.83% branch).
    - 13/13 frontend test suites passing (`npm test`).
    - Production build: `npm run build` exits 0 (1,637 modules transformed).
    - Rule pack validation & hashing: `node scripts/build_rulepack.mjs` exits 0, 100% deterministic bytes.
  - **Bundle Reduction & Dependency Elimination:**
    - `index.html`: 901,686 bytes uncompressed, 148,438 bytes gzip (reduced from 1,360,149 bytes / 290,095 gzip; ~34% raw, ~49% gzip reduction).
    - `rule-editor.html`: 396,041 bytes uncompressed, 99,517 bytes gzip (reduced from 749,074 bytes / 216,100 gzip; ~47% raw, ~54% gzip reduction).
    - On-demand chunk dependencies: 0 files, 0 bytes (complete elimination of on-demand `xlsx`/SheetJS chunk).
  - **Packaged Deliverables Generated:**
    - Velopack Installer: `Releases\AHUVerification-win-Setup.exe` (SHA-256: `2D9BF7359FC41D2883E2CDB068150193139D099F4AD44DA23CB46F16DDC825B2`)
    - Standalone Main Host: `publish\AHUVerification\AHUVerification.App.exe`
    - Standalone Rule Editor: `publish\RuleEditor\RuleEditor.exe`
    - Rule Editor Zip Bundle: `Releases\RuleEditor-1.0.0-win-x64.zip`
  - **Documentation Refreshed:**
    - `README.md`, `PROJECT.md`, `docs/architecture/README.md`, `TEST_INFRA.md`, `docs/operations/development.md`, `docs/operations/bundle-budget.md`, `docs/rule_and_logic_editor_guide.md`, and `docs/decisions/0007-typed-ipc-bridge-protocol.md` updated to reflect the desktop-only single C# authoritative engine architecture.

---

## 5. Remediation Slices Progress & Full Migration Closure (CE-R1 through CE-R6)

### CE-R1: Close Legacy Authority Routes (Completed & Verified)
- Removed all legacy renderer-authoritative save/export/verification routes.
- Enforced host-held source handles in `ProjectSessionService.OpenSource` with strict `IsTrusted` provenance tracking.
- Completely removed `BrowserPreviewBridge`; all bridge methods now require the desktop host and strictly guard against browser execution.
- Completely removed prototype npm packages (`xlsx`, `file-saver`).
- Added `DesktopHostRequiredScreen.tsx` with diagnostic JSON payload and copy button for when the app is loaded outside WebView2.

### CE-R2: Preserve Pinned Projects and Recovery (Completed & Verified)
- Implemented offline self-contained `.dvl` project bundles embedding exact `template.xlsx` Base64 bytes in `DvlRulePackSnapshot` with SHA-256 integrity checks.
- Verified trust preservation: loading an authentic, untampered `.dvl` preserves `IsTrusted = true` (certified).
- Implemented native background crash recovery writing to `%LOCALAPPDATA%\AHUVerification\recovery\recovery_session.dvl` on dirty mutations, cleaned up on clean save.
- Restoring recovery resumes session with `IsDirty = true`, `CurrentSavePath = null`.

### CE-R3: Finish Rule Editor Processing Ownership (Completed & Verified)
- Replaced browser downloads with native Windows Save/Open draft dialogs (`saveDraft`, `openDraft`).
- Added native confirmation dialog before opening drafts or navigating away with unsaved edits.
- Sandboxed AST evaluation executed via backend C# host (`evaluateRuleSandbox`), debounced at 50ms.
- Fact contract validation maps structured errors to rule IDs and field names to highlight and focus invalid inputs.
- Dynamic Excel coordinate generation (`S{row}`, `T{row}`, etc.) with strict row bounds and deletion cleanup.

### CE-R4: Restore Meaningful Tests and CI (Completed & Verified)
- Updated `.github/workflows/codex-verification.yml` to execute active CE integration test scripts (`test_ce2a_session_bridge.mjs`, `test_ce2b_manual_and_pack.mjs`, `test_ce3_persistence_and_export.mjs`, `test_ce5_desktop_only.mjs`).
- Rewrote `tests/e2e/smoke.spec.mjs` with fixed host IPC mock; 14/14 tests passing.
- Fixed accessibility and contrast violations across all Rule Editor views (0 Axe-core violations on both desktop and narrow viewports).

### CE-R5: Internal Release Follow-ups (Completed & Verified)
- **CE-R5a (Comment/Status Ordering Race Resolution):**
  - Made `UpdateChecklistCommand.Status` nullable (`CheckStatus? Status`).
  - In `ProjectSession.UpdateChecklist`: checks `cmd.Status.HasValue` before updating `check.Status`, and checks `cmd.Comment != null` before updating `check.DetailerComment`.
  - In `src/types/session.ts`: `UpdateChecklistPayload.status?: string` made optional.
  - In `src/hooks/useProjectSession.ts`: `handleUpdateChecklistStatus` sends only `status`; `handleUpdateChecklistComment` sends only `comment`, eliminating stale closure captures of companion fields.
  - Unit tested in `tests/AHUVerification.Tests/ProjectSessionTests.cs` (status-only update, comment-only update, sequential order preservation).
- **CE-R5b (Visual-Rule Fidelity in AST Converter):**
  - In `src/ruleEditor/services/astConverter.ts`:
    - Inverts relational operators when `{ var }` is on right side (`4000 > skid.weight` <=> `skid.weight < 4000`), preserving identical truth outcomes.
    - Preserves variable-to-variable comparisons (`{ '>': [{ var: 'a' }, { var: 'b' }] }`).
    - Eliminates silent numeric fallback to 0.
    - Losslessly retains unsupported/complex AST structures via `VisualConditionUnsupported` node (`type: 'unsupported'`).
    - `extractRequiredFactsFromTree` inspects leaves, variable-to-variable operands, and unsupported trees.
  - In `src/ruleEditor/types.ts`: added `VisualConditionUnsupported` interface.
  - In `src/ruleEditor/components/VisualConditionBuilder.tsx`: renders unsupported conditions in read-only mode with syntax preview and removal button.
  - Tested in `scripts/test_ast_converter.mjs` (Suite 7 added with 6 tests, all 34/34 assertions passing).

### CE-R6: Historical acceptance and documentation checkpoint
- **Automated Verification Matrix:**
  - `npm run build`: PASS (clean compilation in ~4.5s)
  - `npm test`: PASS (all 13 frontend test suites pass, 68 copy assertions, 26 responsive contrast assertions, 34 AST assertions)
  - `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`: PASS (267/267 tests pass)
  - `npm run test:coverage`: PASS (0 failures across all 8 modules; all meet or exceed baselines):
    - `NormalizedXmlParser`: line 98.24% (min 95.94%), branch 82.03% (min 75.95%)
    - `FactExtractor`: line 99.35% (min 99.21%), branch 89.09% (min 87.27%)
    - `AstRuleEvaluator`: line 83.28% (min 83.06%), branch 72.76% (min 70.79%)
    - `VerificationHostService`: line 97.25% (min 84.40%), branch 83.33% (min 65.68%)
    - `DvlProjectManager`: line 88.13% (min 85.71%), branch 77.47% (min 67.60%)
    - `OpenXmlTemplatePatcher`: line 97.31% (min 94.84%), branch 84.67% (min 79.66%)
    - `RulePackManager`: line 78.42% (min 77.94%), branch 59.43% (min 54.25%)
    - `UpzBundleExtractor`: line 68.18% (min 68.18%), branch 44.83% (min 44.82%)
  - `npm run test:dist`: PASS (3 local assets resolve across 4 files)
  - `npm run test:bundle`: PASS (uncompressed & gzip budgets satisfied)
  - `npm run test:graph`: PASS (0 on-demand files; startup bundle contained)
  - `npx playwright test`: PASS (14/14 tests pass, 0 Axe-core violations in desktop and narrow viewports)
  - `build-all.bat`: PASS (clean build of frontend, rulepack, and .NET projects)
- **Documentation Reconciliation:**
  - `docs/operations/ce-migration-log.md`, `README.md`, `PROJECT.md`, `TEST_INFRA.md`, and `docs/rule_and_logic_editor_guide.md` reconciled against actual source and tests.
- **Historical outcome:** Full migration closure was recorded at the time. Current closure still requires the evidence described in the remediation plan.
