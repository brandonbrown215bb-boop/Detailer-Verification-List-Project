# Phased remediation plan

Prepared: 2026-09-05. Review baseline: `master` at `1844dc7`, plus the existing staged, unstaged, and untracked remediation work.

This is a plan, not implementation acceptance or authorization to publish. It replaces the old wave order for future remediation. `CURRENT_HANDOFF.md` remains the record of interrupted work; the newer evidence below supersedes its historical test results only where explicitly stated.

## Objective and working rules

Finish a trustworthy Windows desktop workflow from native import through save/reopen and final Excel export, then complete editor/accessibility, maintainability, and release requirements. UPZ is the primary input; a standalone XML export is the fallback. The shipped product is desktop-only. Any retained browser path is a development/test harness or an explicitly noncertifying draft path, not a second product delivery target.

- Preserve the existing staging area and unrelated changes. Do not reset, clean, or restart the implementation.
- Freeze expansion until the current core workflow is accepted. Existing release/editor changes stay in place; repair build-breaking integration as needed, but defer additional work in those areas.
- Finish one acceptance slice before opening another. A phase may contain several small slices; it is not a mandate for one large commit.
- Keep the existing stack and rule-pack model. Extract responsibilities where necessary; do not introduce a new framework, generalized workflow engine, or schema-generation platform.
- Treat each user job as one selected source file: prefer UPZ, and use standalone XML only when UPZ is unavailable. Do not describe the workflow as a two-file comparison.
- Ship the Excel template with the bundled application/rule-pack assets. Users do not edit or provide the template. Release checks must prove that the expected template exists and matches the active pack identity; embedding it in every DVL is optional.
- Use the project-supported Node 22.18.0 runtime provisioned by `setup.bat` and `scripts/init_env.bat` for frontend verification.
- Use the user's requested Luna xhigh implementers only for bounded implementation assignments. The primary independently reviews source, behavior, and evidence. Read team routing/contracts before dispatch. Start with one implementer; add another only for an independent, disjoint slice.
- Classify each failure as a product defect, obsolete fixture, missing contract decision, or environment restriction before changing assertions. Replace invalid fixtures with valid ones and retain explicit rejection coverage for invalid inputs.
- Skid aggregate weight is set by engineering in Config.xml as the sum of segment weights and is authoritative directly upon ingestion (`Derived` / `Authoritative`), without requiring detailer re-validation. If missing or <= 0, it falls back to `Unknown` / `RequiresConfirmation`. Do not conflate this with Seismic/NOA/Knockdown confirmation.
- Do not close an issue merely because its files changed or a related test passed. Check all of its live acceptance criteria. Commits, pushes, releases, issue updates, installations, and external settings changes require applicable user authorization.

## Current evidence

The review retrieved 21 open GitHub issues: umbrella #2 and specific issues #3–#22. The baseline has 100 changed/new files; tracked changes total approximately 6,257 insertions and 1,092 deletions. These counts describe the reviewed tree, not a progress percentage.

| Check | Current result | Limit |
|---|---|---|
| `npm run build` | Passed under the bundled Node 22.18.0 runtime | Production build only; not native installation/lifecycle evidence |
| `npm test` | All 22 frontend suites passed under Node 22.18.0 | Mix of behavioral checks and structural lint; some checks duplicate production logic |
| Full .NET suite | 205 passed, 0 failed | Does not prove the complete packaged desktop UI journey |
| Canonical/parity and golden production paths | Passed | Service-level evidence; not a substitute for the final manual/native acceptance run |
| Built-entry WebView2 bridge/asset smoke | Passed | Includes real bridge exchange; not installer or full import/save/reopen/export E2E |
| Playwright rendered suite | 16 passed across desktop and narrow viewports | Frontend harness only; does not certify WebView2, native dialogs, or packaging |
| Rendered axe-core checks | 0 serious and 0 critical violations | Lower-severity findings are not the agreed release blocker; wording must not claim zero violations of every severity |
| Rule-pack, dist-asset, and bundle checks | Passed | Confirms local build artifacts, not a clean-checkout Windows lifecycle |
| Packaged desktop import/save/reopen/export journey | Manual acceptance still to be recorded | A real UPZ-first run is required before final release acceptance |
| Native source identity and final-export provenance | Partially implemented | Final export fails closed without trusted source, but host-held source binding still needs explicit completion |
| Bundled Excel template identity | Release contract to be completed | The app must ship and verify the expected template; users do not maintain it |

Node 22.18.0 is provisioned by `setup.bat` and `scripts/init_env.bat`, and the frontend suite has been rerun under that exact runtime. Node 24 is no longer an open project-environment concern. Historical 181/182 results are not the current baseline.

## Phase 0 — Establish a bounded acceptance baseline

**Status: complete, 2026-09-05.** The current handoff records the reproduced baseline, ten-failure classification, and tested-tree hashes. [ADR 0011](../decisions/0011-certified-processing-authority.md) records the authority contract. Supported Node 22.18 verification is now complete. No implementation slice is accepted or dispatched by this checkpoint.

**Purpose:** make the next implementation run reproducible without spending another cycle building process infrastructure.

1. Capture current HEAD, working-tree inventory, tool versions, and test commands/results in the existing handoff. Keep detailed logs in ignored output directories.
2. Run under the declared Node 22.18 environment if available. If unavailable, record the limit and obtain installation authorization only if installation is necessary. Do not silently certify Node 24 results as Node 22 results.
3. Classify the ten .NET failures: two extraction-parity failures; golden workflow's unregistered `unit.checker`; two fact/evaluator expectation failures; two DVL persistence failures; and bridge save, export, and editor-publication failures.
4. Record the certified desktop versus draft contract in a short ADR or relevant addendum. AHUVerification.Core owns certified parsing, extraction, evaluation, and export authorization. The shipped product is desktop-only; any retained browser path is noncertifying and not a release target.
5. Assign the first narrow implementation slice and its explicit passing/rejection cases. Use the acceptance ledger below instead of additional dispatch/status documents.

**Exit:** repeatable failing baseline, failure ownership, and authority contract are recorded. This phase does not require making every test green or solving the backlog.

## Phase 1 — Stabilize facts, rules, and cross-runtime contracts

**Depends on:** Phase 0. **Issues:** #3, #5–#10; domain portion of #11 and #16.

1. Reconcile the canonical fact contract across production extraction, manual creation, rule validation, editor validation, and mappings. Resolve `unit.checker` against the intended persisted/workbook contract; do not add a fact solely to satisfy a test or delete a legitimate requirement to get green.
2. Make sparse, malformed, authored, and defaulted source values carry consistent status, confidence, provenance, and original snapshots in both runtimes. Preserve legitimate uncertainty rather than inventing defaults.
3. Verify override/revert cycles for known, unknown, derived, and confirmed values, including audit history and source reload/migration behavior. Unknown → override → revert must become blocking again.
4. Verify applicability transitions, semantic fingerprint changes, allowed N/A behavior, and UI status constraints. A newly applicable or semantically changed check must not retain stale completion.
5. Complete fail-closed AST/key/type/scope/mode validation and approved material classification. Exercise the actual production implementations instead of local copies of the classifier or fingerprint algorithm.
6. Prove strict weight behavior for authored, missing, calculated, approved, and conflicting inputs. Correct fixtures that still expect calculated weight to be authoritative, while preserving tests that detect accidental promotion.
7. Extend shared golden fixtures for the native certified path: graph, facts, provenance, applicability, status, and traces for XML/UPZ, manual, tiered/stacked, opening, material, weight, and unknown-mapping cases. Do not spend release-remediation effort on browser/native product parity. If the TypeScript parser remains for frontend tests or development, keep it clearly noncertifying and do not present it as a second desktop authority.

**Exit:** current native domain/parity failures are resolved; production-function tests cover the corrected contracts and negative cases; the certified desktop path agrees with its golden fixtures. The golden workflow proceeds through fact resolution and checklist transitions. Persistence/export failures may remain for Phase 2, but are individually accounted for.

## Phase 2 — Accept the complete desktop project workflow

**Depends on:** Phase 1. **Issues:** #4, #11, #12, #15, #17; core acceptance portion of #16.

1. Bind renderer acceptance of verification responses to the active session and pack version/hash/generation. Cover import, reopen, edits, reset, sync, rollback, and delayed responses. Handle Header upload and native ingestion consistently. All save/evaluate/display/export paths must use the same pack identity.
2. Finish action-specific bridge types, runtime validation, origin/navigation policy, and capability/path restrictions in both hosts. Isolate dialogs/filesystem operations only as needed for meaningful tests. Test success, cancellation, malformed requests, timeouts, filesystem failures, and unknown actions.
3. Prove DVL complete-state integrity, metadata preservation, alias migration, and save/reopen behavior. Preserve filename, UPZ status, order-revision/manifest XML, snapshots, comments, SQs, and active-pack identity across autosave, Save, and Save As.
4. Require the expected Excel template to ship with the bundled application/rule-pack assets. Verify its existence and exact identity against the active pack before certifying or exporting. Prove unavailable historical artifacts remain noncertifying. Saving legacy, tampered, or mismatched state must not restore certification by itself. The user is not responsible for editing or supplying the template.
5. Keep native-source binding and host recomputation mandatory for final export. The host should retain the one source file imported for the job (UPZ first, standalone XML fallback) and bind verification/export to that source rather than treating later renderer-supplied XML as the authority. Accept only validated override intent; preserve explicitly supported manual/draft persistence. Cover fabricated readiness, omitted/replaced source, stale pack, unsupported rules, invalid targets, cancellation, and failed replacement without losing the prior file.
6. Execute one real desktop journey: import a UPZ; use standalone XML only as the fallback case; override/revert; resolve facts; complete checks/SQs; save; reopen; and final Excel export. Assert exact workbook status/comment/initial cells, formulas, validations, shared strings, sheet pruning, and SQ boundaries 0/1/22/23+. Define a visible overflow policy; never silently discard entries. A manual run is valid acceptance evidence when it is recorded against the packaged app; service tests and bridge smoke alone are not full E2E.

**Exit:** the complete golden lifecycle passes; all .NET failures assigned to this phase are resolved; host-authority negative cases pass; DVL tamper and roundtrip cases pass. Exercise the real bridge and built renderer for the critical user journey, then record a packaged-app manual run. A service test plus a separate message smoke is not by itself full E2E. Retain honest draft/manual behavior.

## Phase 3 — Finish Rule Editor and rendered accessibility

**Depends on:** Phase 2. **Issues:** #14, #18; editor portions of #9/#15/#17 and rendered-frontend testing portions of #16.

1. Replace production-hidden demo dependencies in the frontend test harness with a real import fixture or manual setup. Reuse minimal setup helpers, not an alternate application implementation. Do not expand browser preview into a product delivery target.
2. Fix the observed modal contrast failure and run actual rendered keyboard/axe checks. Cover launch buttons, forward/reverse tab boundaries, Escape, focus restoration, background isolation, rapid reopen, and nested dialogs.
3. Cover home, loaded project, resolution, preflight, settings, search, and manual-unit flows in both configured viewports. Verify ingestion failure/recovery remains visible.
4. Verify native Rule Editor launch with active-pack context; edit/rename, uniqueness, mappings retention, validation, full draft download, publish/reload, and failed-publication rollback. If a legacy browser facade remains, it must fail closed, but it is not part of the shipped product contract.
5. Prove the detailer application activates the exact published pack and applies the defined migration behavior. Use an isolated local test destination; do not publish a live shared pack as a test.

**Exit:** full built-output Playwright frontend-harness suite passes in both configured viewports; editor integration/rollback tests pass; both built native entries pass bridge/asset smoke. Required packaged-app/manual checks are recorded separately from browser evidence and are not implied by the Playwright pass.

## Phase 4 — Reduce the complexity and delivery overhead

**Depends on:** Phase 3. **Issues:** #21, #20; structural portions of #2.

1. Extract project/session transitions and ingestion, persistence, pack, and export orchestration from `App.tsx`, retaining the behavior characterized in Phases 1–3. Use cohesive modules and explicit state transitions; avoid arbitrary file-size targets or one-hook-per-handler extraction.
2. Separate manual wizard state/transitions from step rendering. Split parser/extractor and workbook responsibilities only along actual domain/transformation boundaries. Do not combine these extractions with semantic changes.
3. Preserve dependency direction: UI renders and routes intent; domain services enforce business invariants. Keep any retained frontend-only parser behind an explicit noncertifying adapter, or remove it when the app-only cleanup is performed.
4. Measure both entry dependency graphs and startup assets. Lazy-load optional workflows/demo content and large dependencies where the measured benefit justifies it. A budget passing is not evidence of reduction.
5. Rerun characterization and integration checks after each extraction; rerun built/native asset checks after bundling changes. Verify offline packaging and avoid duplicate large dependencies.

**Exit:** the named oversized modules have cohesive responsibilities and independently testable boundaries; the accepted workflow is unchanged. Record before/after bundle totals and explain any retained large dependency. No optimization is accepted if it breaks offline or native asset resolution.

## Phase 5 — Complete reproducibility, repository hygiene, and release acceptance

**Depends on:** Phase 4. **Issues:** #13, #19, #22; remaining #16 and umbrella #2 requirements.

1. Verify explicit SemVer/version propagation across frontend, backend, DVL, diagnostics, and packaging, while preserving separate application, DVL-format, document-schema, and rule-pack versions. Keep existing passing mismatch tests.
2. Align local and CI validation under supported Node 22.18/.NET versions. Include build/types, production-function tests, structural lint, manifest freshness, .NET tests, built frontend-harness tests, coverage, and packaging checks. Establish a measured critical-module coverage baseline and a justified ratchet.
3. Complete the umbrella's formatter/linter/analyzer and solution-entry requirements using conventional tools. Separate mechanical changes from behavior changes. Required new dependencies need applicable installation authorization.
4. Finish least-privilege release stages, pinned actions/packaging tooling, correct artifacts, checksums/SBOM, fail-fast scripts, and publish smoke. A failing verification gate must prevent packaging/upload progression as specified by #13.
5. Classify transient agent material and durable documentation. Preserve useful history, explicitly review public fixture provenance/sanitization, and avoid wholesale deletion or fixture relocation during functional fixes.
6. Update source-aligned architecture, operations, compatibility/version policy, and test classifications. Remove or clearly mark browser-preview promises as retired, document UPZ-primary/XML-fallback input handling, and document that the Excel template is bundled with the app. Refresh context-manifest verification only after the final source/docs review; do not mark the present stale notes verified in advance.
7. Validate clean-checkout commands and packaged Windows installation, first launch, native UPZ, Rule Editor, save/reopen/export, offline assets, and uninstall on an authorized test target. Obtain separate authorization for installer execution, external CI/branch-protection changes, push/publication, or live release actions as needed.

**Exit:** clean-checkout verification and authorized Windows lifecycle checks pass; documentation matches the final source; release artifacts meet the issue contract. Inspect every remaining issue criterion before closing #2. Pending external authorization remains a named gate, not a claimed success or a reason to leave authorized local work unfinished.

## Acceptance ledger

Maintain this table in place. Link each accepted entry to the exact tested snapshot and evidence; the phase assignment is a completion target, not a declaration that all its work is still missing.

| Issues | Primary completion phase | Current status |
|---|---|---|
| #3, #5, #6, #7, #8, #9, #10 | 1; editor enforcement confirmed in 3 | Phase 1 Slices P1-A & P1-B completed & accepted |
| #11 | 2, after Phase 1 parity | Phase 2 Slices P2-A & P2-B completed & accepted |
| #4, #12, #15, #17 | 2; editor integration confirmed in 3 | Phase 2 Slices P2-A & P2-B completed & accepted |
| #14, #18 | 3 | Slice P3-A & Slice P3-B completed & accepted |
| #20, #21 | 4 | Phase 4 completed locally across Slices P4-A, P4-B, and P4-C; packaged desktop acceptance remains a separate release gate |
| #13, #19, #22 | 5 | Local release gate and clean-checkout accepted; target-host lifecycle remains open |
| #16 | Core path in 2, rendered frontend harness in 3, coverage/CI in 5 | Automated suites green; packaged desktop acceptance remains a recorded release gate |
| #2 | 5, after all dependent and umbrella-only criteria | Open |

For each slice record only: scope/contract, exact snapshot, commands/results, unresolved limits, and independent acceptance decision. Do not copy the whole task history into every update.

**Current execution target:** Phase 4 is complete locally, and the Phase 5 local release gate plus clean-checkout reproducibility are complete across P5-A through P5-D. Authorized target-host installer/native lifecycle evidence remains open. Do not reopen accepted Phase 1–4 slices unless one of these checks identifies a concrete regression.

### Slice P1-A — extraction provenance parity [COMPLETED & ACCEPTED]

Status: Completed and accepted (2026-09-05).
- **Scope executed:** `src/services/factRegistry.ts`, `src/services/xmlParser.ts`, `src/backend/AHUVerification.Core/Services/FactExtractor.cs`, `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs`, `src/backend/AHUVerification.Core/Models/NormalizedGraph.cs`, and `tests/AHUVerification.Tests/CanonicalParityAcceptanceTests.cs`.
- **Evidence:**
  - `dotnet test --filter FullyQualifiedName~CanonicalParityAcceptanceTests`: 13 passed, 0 failed.
  - `npm test`: All 22 test suites passed cleanly with 104 assertions, plus all 15 adversarial stress tests, 28 AST converter tests, 68 copy assertions, 26 responsive/contrast assertions, and Milestone 2 dual-engine XML alignment tests.
  - `node scripts/test_fact_contract.mjs`: Fact contract passed (104 rules, 109 entries).
  - `node scripts/build_rulepack.mjs`: Rule pack v14.0.0 built cleanly.
  - `npm run build`: Production build succeeded.
  - Full .NET suite: 191 passed, 6 failed, 0 regressions from baseline.
- **Contract delivered:**
  - Dual-engine parity established between TypeScript and .NET native extraction contracts.
  - Full provenance tracking with `originalSnapshot`, `sourceState` (`present`, `absent`, `derived`, `manual`, `malformed`, `defaulted`), `derivationName`, and `promptNote`.
  - Missing facts properly cleared to `Unknown`/`RequiresConfirmation` with context-appropriate prompt notes without fabricating certainty from parser defaults.
  - Non-destructive working tree integrity preserved.

### Slice P1-B — weight & checker semantics [COMPLETED & ACCEPTED]

Status: Completed and accepted (2026-09-05).
- **Scope executed:** `src/services/factRegistry.ts`, `src/backend/AHUVerification.Core/Services/FactExtractor.cs`, `src/backend/AHUVerification.Core/Services/FactContractValidator.cs`, `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs`, `tests/AHUVerification.Tests/FactRegistryTests.cs`, `tests/AHUVerification.Tests/AstEvaluatorTests.cs`, and `tests/AHUVerification.Tests/GoldenProductionPathTests.cs`.
- **Evidence:**
  - `dotnet test --filter FullyQualifiedName~GoldenProductionPathTests`: 1 passed, 0 failed.
  - `dotnet test --filter FullyQualifiedName~AstEvaluatorTests`: 4 passed, 0 failed.
  - `dotnet test --filter FullyQualifiedName~FactRegistryTests`: 3 passed, 0 failed.
  - `dotnet test --filter FullyQualifiedName~CanonicalParityAcceptanceTests`: 13 passed, 0 failed.
  - Full .NET suite: 192 passed, 5 failed (failures reduced from 6 to 5; all 5 remaining failures owned by Phase 2/3).
  - `npm test`: All test suites passed cleanly.
  - `npm run build`: Production build succeeded (0 errors).
  - `node scripts/build_rulepack.mjs`: Rule pack v14.0.0 built cleanly.
- **Contract delivered:**
  - Ingestion authority for engineering skid weight confirmed: skid aggregate weight calculated from segment weights in Config.xml is extracted as `Derived` / `Authoritative` with `derivationName: "Sum of Segment Weights"`, without requiring detailer re-validation. Zero or missing weight falls back to `Unknown` / `RequiresConfirmation`.
  - Evaluator enforces `BASE-01` (`skid.weight > 4000`) evaluating to `Applicable` for positive skid weight and `NeedsInput` when authoritative weight is unconfirmed/missing.
  - `unit.checker` unregistered fact removed; checker comments/initials preserved on `ChecklistInstance`.
  - Fixed pattern key regex escaping bug in `FactContractValidator` where `{id}` wildcard was not matched.
  - Fixed `NormalizedXmlParser.GetChildText` to treat empty XML tags as missing/defaulted rather than empty strings.
  - Golden production lifecycle test (`GoldenProductionPath_FullLifecycle_FromUpzToCertifiedWorkbook`) now passes end-to-end from UPZ ingestion through fact resolution, checklist transitions, DVL v2 project save, and certified OpenXML Excel export.

### Slice P2-A — DVL v2 persistence & bridge test harness [COMPLETED & ACCEPTED]

Status: Completed and accepted (2026-09-05).
- **Scope executed:** `src/backend/AHUVerification.Core/Services/DvlProjectManager.cs`, `tests/AHUVerification.Tests/DvlProjectTests.cs`, `tests/AHUVerification.Tests/BridgeHandlerTests.cs`.
- **Evidence:**
  - `dotnet test --filter FullyQualifiedName~DvlProjectTests`: 12 passed, 0 failed.
  - `dotnet test --filter FullyQualifiedName~BridgeHandlerTests.Handle_SaveDvl`: 2 passed, 0 failed.
  - Full .NET suite: 196 passed, 2 failed (failures reduced from 5 to 2; the 2 remaining failures are `Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook` in P2-B and `RuleEditor_PublishRulePack` in P3-A).
  - `npm test`: All 22 test suites passed cleanly.
  - `npm run build`: Production build clean (0 errors).
  - `node scripts/build_rulepack.mjs`: Rule pack v14.0.0 built cleanly.
- **Contract delivered:**
  - Added `DvlProjectManager.CreateProject(..., RulePackBundle bundle, ...)` overload, automatically constructing immutable `RulePackInfo` provenance and `DvlRulePackSnapshot` from the validated bundle.
  - Reconciled DVL project persistence with ADR 0011 (Decision 5): valid noncertifying drafts can be saved and reloaded (`Integrity.State = "draft"`), while projects in `"complete"` state strictly enforce snapshot integrity and template artifact validation.
  - `DvlProject_RoundtripSerialization_PreservesAllData`: verified full production-factory roundtrip with bundle, asserting `Integrity.State == "complete"`, cryptographic complete-state hash, and all collections preserved.
  - `SaveJsonToFile_ReplacesDestinationWithoutLeavingTemporaryFiles`: updated to use valid serialized DVL envelopes, asserting atomic destination replacement, zero leftover temporary files, and rejection of malformed JSON with destination preservation.
  - Added `DvlProject_DraftWithoutSnapshot_CanBeSavedAndLoadedAsNonCertifyingDraft` verifying persistence and honest noncertifying reporting for draft projects.
  - `Handle_SaveDvl_ValidPayload_WritesFileSuccessfully`: reconciled bridge save payload with valid DVL envelope and added negative malformed payload test confirming rejection without file creation.

### Slice P2-B — native destination selection & deliverable export [COMPLETED & ACCEPTED]

Status: Completed and accepted (2026-09-05).
- **Scope executed:** `tests/AHUVerification.Tests/BridgeHandlerTests.cs`, `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`.
- **Evidence:**
  - `dotnet test --filter FullyQualifiedName~Handle_ExportExcelDeliverable`: 7 passed, 0 failed.
  - `dotnet test --filter FullyQualifiedName~BridgeHandlerTests`: 38 passed, 1 failed (only `RuleEditor_PublishRulePack` in P3-A remains).
  - Full .NET suite: 200 passed, 1 failed (down from 10 failed at baseline; 1 remaining failure total).
  - `npm test`: All 22 test suites passed cleanly.
  - `npm run build`: Production build clean (0 errors, 7.54s).
  - `node scripts/build_rulepack.mjs`: Rule pack v14.0.0 built cleanly.
- **Contract delivered:**
  - Upgraded `BridgeHandlerTests.CreateAppHandler(Func<string?>? exportPathSelector = null)` to support native destination selector injection while preserving zero-argument default behavior.
  - Reconciled `Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook`: exercises injected native selector boundary, verifies draft deliverable exports cleanly to disk with length > 0, and asserts `exported: true` with `certificationAllowed: false`.
  - Proved untrusted renderer path rejection (`Handle_ExportExcelDeliverable_WithoutNativeSelector_CancelsAndDoesNotWriteRendererPath`): renderer cannot dictate destination; without native selector/dialog, request cancels cleanly (`cancelled: true`) without creating files.
  - Proved selector validation (`Handle_ExportExcelDeliverable_InvalidPathFromSelector_ReturnsFailure`): non-rooted or non-.xlsx destinations fail with clear actionable error.
  - Proved certified export fail-closed security (`Handle_ExportExcelDeliverable_FinalExportWithoutTrustedSource_FailsClosed`): uncertified export (`isDraft: false`) without bound trusted source rejects before file creation.

### Slice P3-A — Rule Editor verification mode & publication [COMPLETED & ACCEPTED]

Status: Completed and accepted (2026-09-05).
- **Scope executed:** `tests/AHUVerification.Tests/BridgeHandlerTests.cs`, `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`, `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs`, `src/services/desktopBridge.ts`, `tests/AHUVerification.Tests/WebViewHostSmokeTests.cs`.
- **Evidence:**
  - `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`: 205 passed, 0 failed (100% passing across entire .NET test suite, resolving all baseline test failures).
  - `dotnet test --filter FullyQualifiedName~RuleEditor_PublishRulePack`: 4 passed, 0 failed (including valid publish, unsupported mode validation failure, dual target publishing, and rollback preservation).
  - `dotnet test --filter FullyQualifiedName~Handle_LaunchRuleEditor`: 2 passed, 0 failed (validates native RuleEditor.exe discovery, active pack path argument passing, and dev fallback).
  - `npm test`: All 22 test suites passed cleanly (0 errors).
  - `npm run build`: Production bundle built cleanly (0 errors).
  - `node scripts/build_rulepack.mjs`: Rule pack v14.0.0 built cleanly.
  - `npm run test:dist; npm run test:bundle`: Local dist assets and bundle budget verified.
- **Contract delivered:**
  - Resolved `RuleEditor_PublishRulePack_ValidPayload_PublishesSuccessfully` by aligning test fixtures with the supported `ManualCheckbox` verification mode enforced by `FactContractValidator` and `rules.json`.
  - Added negative contract test `RuleEditor_PublishRulePack_UnsupportedVerificationMode_FailsValidation` asserting fail-closed rejection of unsupported modes (`AutoEvaluated`).
  - Added dual-target publication test `RuleEditor_PublishRulePack_WithTargetPath_PublishesBothLocations` verifying SHA-256 integrity check and promotion to both active pack and destination directories.
  - Added rollback test `RuleEditor_PublishRulePack_RollbackOnTargetFailure_PreservesActivePack` proving that any destination failure triggers atomic rollback and preserves the active pack intact.
  - Enhanced `LaunchRuleEditor()` in `BridgeHandler.cs` with executable search path resolution (adjacent, sibling, bin/Debug, bin/Release) and passing active pack context `--rule-pack "<path>"` to `RuleEditor.exe`, with a development-only fallback that is not a shipped browser delivery path.
  - Updated `BrowserPreviewBridge.publishRulePack` in `desktopBridge.ts` to fail closed with an explicit descriptive error (`Publishing is only available when running in the desktop Rule Editor application.`), eliminating false-success reporting if the legacy frontend facade is exercised.
  - Connected `verifySource` action in `BridgeHandler.cs` dispatch table and verified both `BridgeHandler` and `WebViewHostSmokeTests` under production WebView2 harness.

### Slice P3-B — Rendered accessibility, modal contrast & Playwright e2e checks [COMPLETED & ACCEPTED]

Status: Completed and accepted (2026-09-05).
- **Scope executed:** `tests/e2e/smoke.spec.mjs`, `src/components/ManualUnitModal.tsx`, `src/components/ComNumberModal.tsx`, `src/components/DetailerNameModal.tsx`, `src/components/ProjectIdentityModal.tsx`, `src/components/ResolutionCenterModal.tsx`, `src/components/SettingsModal.tsx`, `src/components/PreFlightModal.tsx`, `src/components/Sidebar.tsx`, `src/components/GeneralUnitTab.tsx`, `src/components/Header.tsx`.
- **Evidence:**
  - `npx playwright test`: 16 passed, 0 failed across both `chromium-desktop` (1426x893) and `chromium-narrow` (1024x768) projects (100% clean pass, resolving all 12 initial e2e failures).
  - All axe-core rendered accessibility audits pass with 0 critical and 0 serious violations across home screen, loaded project, manual unit wizard, settings modal, and loaded project primary surfaces.
  - `npm test`: All 22 static unit test suites passed cleanly (0 errors).
  - `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`: 205 passed, 0 failed.
  - `npm run build`: Production bundle built cleanly (0 errors, ~8s).
  - `node scripts/build_rulepack.mjs`: Rule pack v14.0.0 built cleanly.
- **Contract delivered:**
  - Replaced production-hidden demo dataset dependencies (`Load Demo Dataset`) in Playwright e2e acceptance with real XML ingestion (`setupLoadedProject(page)`) using `tests/fixtures/Config.xml`, followed by valid COM number entry via `ComNumberModal`.
  - Replaced invalid `getByRole('tablist')` assertions with the application's actual `<aside>` button navigation hierarchy.
  - Form input accessibility: added explicit `id`, `htmlFor`, and `aria-label` attributes to all form controls, selects, and table action buttons across `ComNumberModal`, `DetailerNameModal`, `ProjectIdentityModal`, `ResolutionCenterModal`, `ManualUnitModal`, and `GeneralUnitTab`.
  - WCAG 2.2 AA color contrast:
    - Updated buttons and action controls from low-contrast `bg-blue-600`, `bg-emerald-600`, and `bg-amber-600` to high-contrast variants (`bg-blue-700 hover:bg-blue-600`, `bg-emerald-700 hover:bg-emerald-600`, `bg-amber-800 hover:bg-amber-700`, `bg-indigo-700`, `bg-red-700`).
    - Fixed subtext and caption contrast across light backgrounds by elevating `text-slate-400` / `text-slate-500` to `text-slate-600 dark:text-slate-400` (> 5.5:1 ratio).
    - Fixed badge and section header contrast in `Sidebar.tsx`, `GeneralUnitTab.tsx`, `SettingsModal.tsx`, and `PreFlightModal.tsx` (`text-emerald-700`, `text-blue-700`, `text-amber-800`).
  - Verified horizontal responsiveness and containment under both desktop and narrow (1024x768) viewports.

### Post-Phase 3 review adjustments

These are the remaining findings after reviewing the completed Phase 3 work. They refine acceptance; they do not reopen the accepted Phase 1–3 implementation slices.

1. **Native source authority — open.** The user selects one file per job: UPZ first, standalone XML fallback. The native host must retain that imported source and bind verification and final export to it. It must not treat later renderer-supplied XML as the authoritative source. This is an integrity safeguard for certified output, not a two-file user workflow.
2. **Packaged desktop journey — manual acceptance required.** Run and record the real packaged-app path: UPZ import, review and overrides, fact resolution, checklist/SQ completion, save, close, reopen, and final Excel export. The existing golden/service/bridge tests are valuable, but they do not replace this manual/native acceptance run.
3. **Bundled Excel template — release gate.** The template belongs beside the bundled app/rule-pack assets. The user does not edit or provide it. The release/build checks must verify that the expected template exists and matches the active pack; storing a copy in each DVL is optional.
4. **Duplicate semantic keys — small editor follow-up.** The editor should show a direct error when a duplicate semantic key is created or cloned, or block publish with that exact error. Backend validation already rejects duplicates, so this is primarily a clearer user experience.
5. **Accessibility evidence wording — documentation follow-up.** Phase 3 proved zero serious and zero critical axe-core violations in the tested rendered surfaces. Lower-severity issues were not the agreed release blocker. Keep the wording at that level rather than claiming that every accessibility violation of every severity was ruled out. If recovery and nested-dialog checks are required for final acceptance, record those separately.
6. **Desktop-only scope — documentation cleanup.** Browser preview/web-server delivery is not a product requirement. Keep browser-based checks only as a frontend test harness or retire them; update the plan, architecture notes, ADR language, and test classifications so they do not imply a second shipped product.
7. **Node runtime — resolved.** Node 22.18.0 is provisioned by setup and initialization scripts and the frontend suite passes under it. No further remediation work is needed for the earlier Node 24 observation.

### Phase 4 Slice P4-A — App.tsx orchestration extraction & session state decomposition [COMPLETED LOCALLY]

Status: Completed locally and independently reviewed (2026-09-05). Phase 4 was completed locally by the subsequent P4-C slice; packaged native lifecycle acceptance remains a separate release gate.
- **Scope:** `src/App.tsx`, extraction to cohesive sub-modules in `src/hooks/` and `src/orchestration/`.
- **Goals:**
  - Extract project/session lifecycle transitions and orchestration (ingestion, persistence, rule pack distribution, and export workflows) from `App.tsx` into cohesive, testable custom hooks/modules.
  - Preserve 100% of existing behavior characterized in Phases 1–3.
  - Maintain clean separation between UI rendering and domain state transitions.
  - Verify all 22 unit test suites, 205 .NET tests, and 16 Playwright frontend-harness checks continue to pass with zero regressions.
- **Implementation:** Added `useProjectSession`, `useRulePackSession`, and pure source/pack identity helpers. `App.tsx` now retains rendering, navigation, theme, and modal state while the hooks own ingestion, persistence, host verification, pack synchronization, autosave, save, and export orchestration. Session-load callbacks preserve the General-tab reset and COM-number prompt; modal dismissal remains a UI concern.
- **Evidence:** Tested on working tree `HEAD 1844dc7a18b2` with existing remediation changes preserved. `App.tsx` is 612 lines (previously 1,249); `npm run build` passed under Node 22.18.0; `npm test` passed all 22 frontend suites; `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --no-restore` passed 205/205; `npx playwright test --retries=1` passed 16/16 rendered checks.
- **Independent review:** Rechecked lifecycle transitions after extraction and preserved General-tab reset, COM-number prompting, and batch-resolution modal close behavior.
- **Unresolved limits:** No packaged native import/save/reopen/export manual acceptance was performed by this slice; the Phase 2 desktop journey remains a separate Phase 5/release gate.

### Phase 4 Slice P4-B — Manual unit wizard state/transition extraction [COMPLETED LOCALLY]

Status: Completed locally and independently reviewed (2026-09-05). Phase 4 was completed locally by the subsequent P4-C slice; packaged native lifecycle acceptance remains a separate release gate.
- **Scope:** `src/components/ManualUnitModal.tsx`, extraction to `src/hooks/useManualUnitWizard.ts`.
- **Contract:** Separate manual wizard state, preset initialization, step transitions, skid/segment mutations, metrics, and submit validation from the existing step-rendering markup without changing manual-unit semantics.
- **Implementation:** `useManualUnitWizard` now owns the existing wizard state and transitions, preset/local-storage initialization, target-skid reconciliation, segment and internal-item mutations, derived unit metrics, and final `ManualUnitConfig` validation/submission. `ManualUnitModal` retains the accessible dialog, focus trap, controls, step navigation rendering, and visual presentation; parser, factory, persistence, and workbook behavior were not changed.
- **Evidence:** Working tree preserved at `HEAD 1844dc7a18b2`; `ManualUnitModal.tsx` is 1,167 lines and `useManualUnitWizard.ts` is 433 lines; `npm run build` passed under Node 22.18.0; `npm test` passed all 22 frontend suites; `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --no-restore` passed 205/205; `npm run test:dist` and `npm run test:bundle` passed. The full Playwright run exited successfully with 15 first-attempt passes and one narrow settings case passing on retry; that case also passed 1/1 when rerun in isolation.
- **Independent review:** Confirmed the modal no longer owns React wizard state/effects or step-transition handlers; the extracted hook exposes the renderer’s existing values/actions, preserves submit guards and payload construction, and leaves parser/workbook responsibilities untouched. Scoped `git diff --check` is clean after removing the extra EOF blank line.
- **Unresolved limits:** No packaged native import/save/reopen/export manual acceptance was performed by this slice; the Phase 2 desktop journey remains a separate Phase 5/release gate.

### Phase 4 Slice P4-C — browser authority boundary, workbook loading, and entry-graph measurement [COMPLETED LOCALLY]

Status: Completed locally and independently reviewed (2026-09-05). Phase 4 is complete locally; packaged native lifecycle acceptance remains a separate release gate.
- **Scope:** `src/services/browserPreviewIngestion.ts`, `src/hooks/useProjectSession.ts`, `src/services/desktopBridge.ts`, `scripts/measure_bundle_graph.mjs`, and the browser export acceptance coverage in `tests/e2e/smoke.spec.mjs`.
- **Contract:** Keep browser parsing and fact extraction explicitly non-certifying; preserve native host authority for certified verification and Excel synthesis; defer the browser-only SheetJS path until draft export is requested; measure both entry graphs and preserve offline asset resolution.
- **Implementation:** Added a named non-certifying browser-preview ingestion adapter around the retained TypeScript parser/fact extractor. The native desktop bridge no longer statically imports `excelExporter.ts`; the browser bridge loads it on demand. Added `npm run test:graph` to report startup and on-demand entry assets.
- **Evidence:** Before the change, `index.html` startup measured 1,360,149 bytes / 290,095 gzip and `rule-editor.html` startup measured 749,074 / 216,100. After the change, startup measured 1,018,719 / 178,760 and 407,556 / 104,727 respectively, with a retained 340,459 / 111,643 on-demand Excel chunk. `npm run build`, `npm test`, `.NET 205/205`, `npm run test:dist`, and `npm run test:bundle` passed. The focused browser export check passed in both viewports and produced `.xlsx` downloads; the complete Playwright suite passed 18/18 after the added coverage.
- **Independent review:** Confirmed the browser adapter is used only on non-desktop ingestion paths, native `verifySource` and native export remain unchanged, the browser draft watermark path remains intact, and the deferred chunk is exercised by rendered download coverage. No parser, fact, workbook, or certification semantics were changed.
- **Unresolved limits:** Packaged Windows import/save/close/reopen/final-export and installer lifecycle acceptance remain Phase 5/release-gate work.

### Phase 5 Slice P5-A — version identity, Core coverage ratchet, and validation wiring [COMPLETED LOCALLY]

Status: Completed and accepted locally on the preserved dirty working tree at `HEAD 1844dc7a18b2`. This slice does not claim complete Phase 5 or release acceptance.
- **Scope:** Propagate authoritative application/DVL/document identities through frontend, backend, diagnostics, and persistence; establish a measured Core coverage floor; align the local Windows test runner and reusable CI verification job with that gate; correct stale operational wording exposed while doing so.
- **Implementation:** `version.json` remains the authority. `ApplicationVersion` now supplies backend app, DVL, and document defaults; the bridge, DVL manager/models, update diagnostics, browser-preview diagnostics, project storage, and XML parser consume those identities. Added [`docs/operations/coverage-baseline.json`](coverage-baseline.json) and `scripts/verify_core_coverage.ps1`; the gate runs the full Release xUnit suite with coverlet, records Cobertura/TRX output under ignored `TestResults/coverage-core/`, and enforces line/branch floors for eight named Core pipeline modules. `AHUVerification.sln` is now the documented/CI solution entry, and `run-tests.bat`, `setup.bat`, `publish-release.bat`, and `.github/workflows/codex-verification.yml` use the same coverage entry point before release packaging. Documentation now separates browser-preview, WebView2, service, coverage, and packaging evidence.
- **Evidence:** `npm run test:version`, `npx tsc --noEmit`, `npm test`, `npm run test:dist`, `npm run test:bundle`, `npm run test:graph`, `npm run test:dvl`, the reducer suite, the focused bridge/DVL .NET tests, and `dotnet build AHUVerification.sln -c Release --no-restore` passed. `npm run build` passed in the normal local execution environment and produced both Vite entries. Rule-pack generation was byte-stable across two generations of six artifacts. The normal local `npm run test:coverage` gate passed all 205 C# tests and measured every floor above baseline: `NormalizedXmlParser` 97.40% / 77.62%, `FactExtractor` 99.22% / 87.27%, `AstRuleEvaluator` 83.07% / 70.79%, `VerificationHostService` 84.40% / 65.69%, `DvlProjectManager` 85.71% / 67.61%, `OpenXmlTemplatePatcher` 94.85% / 79.67%, `RulePackManager` 77.95% / 54.26%, and `UpzBundleExtractor` 68.18% / 44.83% for line / branch coverage.
- **Unresolved limits:** The same coverage command still fails when run inside the restricted sandbox: two canonical parity cases cannot let esbuild read the parent tree, and both WebView2 built-entry smoke cases time out. Those failures remain fail-closed; the normal local run passed. The repository-local Node `22.18.0` runtime is now available and was used for the pinned checks. Windows packaged install/first-launch/offline/native UPZ/Rule Editor/save-reopen/export/uninstall, clean-checkout verification, and external release authorization remain open.
- **Independent acceptance:** Primary review complete for this slice's source and evidence; P5-A is accepted locally, not as complete Phase 5 or release acceptance.

### Phase 5 Slice P5-B — pinned runtime and self-contained publish preflight [COMPLETED LOCALLY]

Status: Completed and accepted locally on the preserved dirty working tree at `HEAD 1844dc7a18b2`. This slice validates the supported runtime and publish inputs without creating an installer, changing external state, or claiming target-host acceptance.
- **Scope:** Exercise the frontend and Core coverage contracts under the repository-local Node `22.18.0` runtime; build both self-contained `win-x64` publish trees; verify the required packaged entry pages, version metadata, rule-pack files, Excel template, and native unpacker assets.
- **Evidence:** Node 22 `npm test`, `npm exec -- tsc --noEmit`, and `npm run build` passed. Node 22 `npm run test:dist`, `npm run test:bundle`, and `npm run test:graph` passed. Node 22 `npm run test:coverage` passed 205/205 C# tests and all eight Core coverage floors. `dotnet publish` passed for `AHUVerification.App` and `RuleEditor` with `--self-contained true -r win-x64 -p:Version=1.0.0` into ignored `publish/phase5-smoke/` output; version validation passed and all 21 required publish assets were present.
- **Unresolved limits:** The interactive shell itself remains Node `24.14.0`; CI and clean-checkout validation have not run from a committed remediation snapshot. SDK formatter verify-only mode reports at least 400 mechanical diagnostics across the dirty solution; no broad rewrite was applied. Velopack packaging, checksum/SBOM generation as release artifacts, installer execution, and the real Windows install/first-launch/offline/native UPZ/Rule Editor/save-reopen/final-export/uninstall journey remain open and require the corresponding authorization/target environment.
- **Independent acceptance:** P5-B local preflight accepted. Phase 5 remains open until clean-checkout and target-host lifecycle evidence is recorded; no commit, push, installer, or external publication was performed.

### Phase 5 Slice P5-C — formatter/analyzer and solution-entry hygiene [COMPLETED LOCALLY]

Status: Completed and accepted locally on the clean Git-backed remediation snapshot at `HEAD 29836826b5cc`.
- **Scope:** Exercise the conventional SDK solution formatter/analyzer and confirm the checked-in solution entry without changing runtime behavior or adding frontend tooling.
- **Implementation:** Applied the SDK formatter's mechanical C# cleanup to the existing remediation tree. No frontend formatter/linter dependency was added; the repository's existing Node source-pattern checks remain structural checks and are documented as such.
- **Evidence:** `dotnet format AHUVerification.sln --no-restore --severity warn --verbosity minimal` completed the scoped mechanical pass, and the follow-up `--verify-no-changes` command exited `0`. `dotnet build AHUVerification.sln -c Release --no-restore` also passed with the known WindowsBase conflict warnings.
- **Unresolved limits:** This acceptance is local. Target-host installer/native lifecycle acceptance remains open.
- **Independent acceptance:** P5-C accepted locally; no new frontend dependency or external state change was introduced.

### Phase 5 Slice P5-D — release-package hardening and local publish smoke [COMPLETED LOCALLY]

Status: Completed and accepted locally on the clean Git-backed remediation snapshot at `HEAD 29836826b5cc`. This slice does not claim installer UI acceptance, code signing, publication, or complete Phase 5 exit.
- **Scope:** Complete the deterministic local release path after all verification gates, including pinned Velopack packaging, artifact validation, SBOM generation, checksums, and fail-fast output checks.
- **Implementation:** Pinned `vpk` `1.2.0` checks now use the tool manifest rather than an unsupported `vpk --version` command. Local and CI release paths reject a non-empty `Releases/` directory before packaging and verify the expected setup, archive, metadata, SBOM, and checksum outputs after packaging. Added `scripts/write_release_checksums.mjs` to generate a sorted uppercase SHA-256 manifest after SBOM creation.
- **Evidence:** `publish-release.bat 1.0.0` passed all frontend, rule-pack, .NET 205/205, coverage-floor, publish-asset, and package checks from the clean Git-backed worktree. `Releases/` contains exactly one setup executable, the portable package, the Rule Editor archive, Velopack metadata, two JSON SBOMs, and nine checksum entries. Independent verification reported `CHECKSUM_LINES=9`, `CHECKSUM_FAILURES=0`, and both SBOM files parsed as JSON. Elevated process smoke kept both packaged executables alive and responsive with their intended main-window titles.
- **Unresolved limits:** The session's computer-use surface has no native desktop apps, so installer execution and the full native journey were not performed. Code signing, external CI/branch-protection changes, push/publication, and live release remain outside scope.
- **Independent acceptance:** P5-D accepted as a local release-package and clean-checkout gate; Phase 5 remains open only for the authorized target-host lifecycle gate.
