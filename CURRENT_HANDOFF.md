# Current Handoff — Open-Issue Remediation

## Phase 5 Local Release Gate Completed — 2026-09-05

Phase 5 Slices P5-A, P5-B, and P5-C are complete locally, and the release-package preflight is complete. The working tree remains intentionally dirty; all existing staged, unstaged, and untracked remediation work is preserved.

- **Protected snapshot:** `HEAD 1844dc7a18b28ba78b23087d5c32f3c8930c94a9` on `master`. Do not reset, clean, or treat the current tree as a release checkout.
- **Version contract:** `version.json` is authoritative for application `1.0.0`, DVL format `2.0`, and document schema `2018.9.14.1003`; frontend/backend diagnostics and DVL defaults now consume those identities. Rule Pack identity remains owned by `resources/rulepack/manifest.json` (`14.0.0`).
- **Coverage contract:** `docs/operations/coverage-baseline.json` records eight measured `AHUVerification.Core` module floors. `npm run test:coverage` runs the full Release xUnit suite with coverlet 6.0.4 and writes ignored Cobertura/TRX evidence under `TestResults/coverage-core/`.
- **Current results:** Version, TypeScript, the full frontend suite, dist/bundle/graph checks, focused bridge/DVL tests, solution build, production build, two-generation rule-pack byte determinism, and the pinned-runtime coverage gate passed. `npm run test:coverage` passed 205/205 C# tests and every named floor. The self-contained `win-x64` publishes and the 18-test Playwright suite passed. `dotnet format AHUVerification.sln --verify-no-changes --no-restore --severity warn --verbosity minimal` now exits 0. The final `publish-release.bat 1.0.0` run passed all pre-package gates and produced the setup executable, portable archive, Rule Editor archive, Velopack metadata, two SBOMs, and a nine-file SHA-256 manifest in ignored `Releases/`; independent hash and JSON parsing checks passed.
- **Native launch boundary:** With broader local process access, `publish\AHUVerification\AHUVerification.App.exe` opened responsively as `AHU Detailing Verification Desktop Application`, and `publish\RuleEditor\RuleEditor.exe` opened responsively as `AHU Verification • Rule & Logic Editor Studio`. The restricted sandbox previously showed error dialogs because its identity has read-only access to the normal per-user WebView2 data root; WebView2 Runtime `152.0.4191.62` is installed. Native computer-use surfaces expose no desktop apps in this session, so no installer UI, UPZ file-dialog, save/reopen, Excel export, or uninstall interaction is claimed.
- **Environment:** The interactive shell reports Node `24.14.0`, npm `11.9.0`, and .NET SDK `8.0.424`; the repository-local Node `22.18.0` executable was used for the pinned checks. Restricted-sandbox esbuild and WebView2 failures remain environment diagnostics; broader local execution is the accepted automated evidence.
- **Next safe action:** Use an authorized clean checkout on a normal Windows desktop to run and record install/first launch, offline/native UPZ import, Rule Editor, save-close-reopen, final Excel export, and uninstall. Do not lower coverage floors, waive restricted-mode failures, or treat the generated package as published. External CI/branch-protection changes, push/publication, code signing, and live release remain outside this handoff.

Updated: 2026-09-05 (America/Chicago)

## Phase 3 Slice P3-B Completed & Accepted — 2026-09-05

Slice P3-B: Rendered accessibility, modal contrast & Playwright e2e checks is completed and independently verified. All 16 Playwright e2e smoke tests (across desktop and narrow viewports) pass 100% with zero axe-core accessibility violations. All 22 frontend unit suites and 205 .NET backend tests pass cleanly.

### Scope Executed & Changes Made
- Real XML Fixture Acceptance:
  - Replaced production-hidden demo dataset dependencies (`Load Demo Dataset`) in Playwright e2e smoke tests with real XML ingestion via `setupLoadedProject(page)`.
  - Ingestion uploads `tests/fixtures/Config.xml`, enters `COM-842910` via `ComNumberModal`, and awaits `General Unit Specs` in the sidebar navigation.
  - Replaced obsolete `getByRole('tablist')` assertions with the application's actual `<aside>` navigation button structure.
- Form Accessibility & Labeling:
  - Added explicit `id`, `htmlFor`, and `aria-label` attributes across all interactive form controls:
    - `ComNumberModal.tsx`: input id/htmlFor `com-number-input`, submit button contrast updated.
    - `DetailerNameModal.tsx`: input id/htmlFor `detailer-full-name-input`, submit button contrast updated.
    - `ProjectIdentityModal.tsx`: explicit `aria-label` on all 6 inputs, submit button contrast updated.
    - `ResolutionCenterModal.tsx`: `aria-label="COM Number"` on COM input, explicit labels on custom weight/fact overrides, high-contrast action buttons.
    - `ManualUnitModal.tsx`: explicit labels for all skid inputs, selects, and segment manipulation buttons (drag handles, move, tags, duplicate, delete).
    - `GeneralUnitTab.tsx`: accessible labels on SQ text inputs, scope select, and comments textarea.
- WCAG 2.2 AA Rendered Color Contrast Fixes:
  - `ManualUnitModal.tsx`: Step buttons elevated to `bg-blue-700 hover:bg-blue-600` and `bg-emerald-700 hover:bg-emerald-600`.
  - `Header.tsx`: Search trigger text and shortcut badge elevated to `text-slate-600 dark:text-slate-400`.
  - `Sidebar.tsx`:
    - Verification badge updated to `bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`.
    - Progress text and pending counts elevated to `text-slate-600` and `text-amber-800 dark:text-amber-400`.
    - Section headers elevated from `text-slate-400` to `text-slate-600 dark:text-slate-400`.
    - Skid subtitles elevated from `opacity-80` to explicit `text-slate-600 dark:text-slate-400` (or `text-blue-100` when selected).
    - Special Quotes count elevated to `text-amber-800 dark:text-amber-300`.
    - Schema Ver / Dimensions footer elevated to `text-slate-600 dark:text-slate-400`.
  - `GeneralUnitTab.tsx`:
    - Materials & Gauges Schedule header elevated from `text-emerald-600` to `text-emerald-700 dark:text-emerald-400`.
    - Segment count badge and empty table notice elevated to `text-slate-600 dark:text-slate-400`.
    - Comments subtext elevated to `text-slate-600 dark:text-slate-400`.
  - `SettingsModal.tsx`:
    - Theme button subtexts updated to dynamic high contrast (`text-blue-700 dark:text-blue-300` when selected, `text-slate-600 dark:text-slate-400` when unselected).
    - Section headers, input labels, and autosave captions elevated to `text-slate-600 dark:text-slate-400`.
  - `PreFlightModal.tsx`:
    - Metric labels elevated to `text-slate-600 dark:text-slate-400`.
    - Metric counts elevated to `text-emerald-700` and `text-amber-800`.
    - "Resolve Items" button elevated to `bg-amber-800 hover:bg-amber-700`.
    - "Export Draft .xlsx" button elevated to `bg-emerald-700 hover:bg-emerald-600`.

### Verification Results
| Verification Target | Result | Notes |
|---|---|---|
| `npx playwright test` | 16 passed, 0 failed | 8 tests on `chromium-desktop` (1426x893), 8 tests on `chromium-narrow` (1024x768); 0 a11y violations |
| `npm test` | Passed | All 22 test suites passed cleanly |
| Full .NET Suite | 205 passed, 0 failed | 100% passing across all tests |
| `npm run build` | Passed | Clean production bundle compilation (0 errors) |
| `node scripts/build_rulepack.mjs` | Passed | Rule pack v14.0.0 built cleanly |

### Next Action: Phase 4 Slice P4-A — App.tsx orchestration extraction & session state decomposition
- Extract project/session lifecycle transitions and orchestration (ingestion, persistence, rule pack distribution, and export workflows) from `App.tsx` into cohesive custom hooks/modules.
- Preserve 100% of existing behavior characterized in Phases 1–3.
- Maintain clean separation between UI rendering and domain state transitions.
- Verify all 22 unit test suites, 205 .NET tests, and 16 Playwright e2e tests continue to pass with zero regressions.

## Phase 3 Slice P3-A Completed & Accepted — 2026-09-05

## Phase 2 Slice P2-B Completed & Accepted — 2026-09-05

Slice P2-B: native destination selection & deliverable export is completed and independently verified.

### Scope Executed & Changes Made
- Test Harness Path Selector Injection:
  - Upgraded `BridgeHandlerTests.CreateAppHandler(Func<string?>? exportPathSelector = null)` to support native destination selector injection while preserving zero-argument default behavior for all existing tests.
- Reconciled Deliverable Export Test:
  - `BridgeHandlerTests.Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook`: exercises the injected native selector boundary, verifies draft deliverable exports cleanly to disk with length > 0, and asserts `exported: true` with `certificationAllowed: false`.
- Proven Untrusted Renderer Path Rejection:
  - `Handle_ExportExcelDeliverable_WithoutNativeSelector_CancelsAndDoesNotWriteRendererPath`: proves that without an authorized selector/dialog, a renderer request specifying `outputPath = tempXlsx` returns `{ cancelled: true }` and does NOT write any file.
- Proven Selector Path Validation:
  - `Handle_ExportExcelDeliverable_InvalidPathFromSelector_ReturnsFailure`: proves that a selector returning a non-rooted path or non-`.xlsx` path fails with `InvalidOperationException("Target path must be an absolute path ending in .xlsx")`.
- Proven Certified Export Fail-Closed Security:
  - `Handle_ExportExcelDeliverable_FinalExportWithoutTrustedSource_FailsClosed`: proves that an uncertified export (`isDraft: false`) without bound trusted `Config.xml` source fails closed with `"Final export requires the trusted raw Config.xml source"` and writes no file.

### Verification Results
| Verification Target | Result | Notes |
|---|---|---|
| `BridgeHandlerTests.Handle_ExportExcelDeliverable*` | 7 passed, 0 failed | All 4 export tests (native selector, untrusted renderer rejection, invalid path, fail-closed uncertified) pass |
| `BridgeHandlerTests` | 38 passed, 1 failed | Only `RuleEditor_PublishRulePack` in P3-A remains |
| Full .NET Suite | 200 passed, 1 failed | Down from 10 failed at baseline; only 1 failure remaining across the entire suite |
| `npm test` | Passed | All 22 suites (104 assertions + 15 adversarial + 28 AST + 68 copy + 26 contrast) |
| `npm run build` | Passed | Clean production bundle compilation (0 errors, 7.54s) |
| `node scripts/build_rulepack.mjs` | Passed | Rule pack v14.0.0 built cleanly |

### Remaining Failure Owned by Phase 3
1. `BridgeHandlerTests.RuleEditor_PublishRulePack_ValidPayload_PublishesSuccessfully` -> Phase 3, Slice P3-A (Rule Editor verification mode & publication).

### Next Action: Slice P3-A — Rule Editor verification mode & publication
- Reconcile `RuleEditor_PublishRulePack_ValidPayload_PublishesSuccessfully` in `tests/AHUVerification.Tests/BridgeHandlerTests.cs` to use supported verification modes per `RulePackManager`.
- Bring full .NET test suite to 100% passing (201/201).

## Phase 2 Slice P2-A Completed & Accepted — 2026-09-05

Slice P2-A: DVL v2 persistence & bridge test harness is completed and independently verified.

### Scope Executed & Changes Made
- Core DVL Construction & Factory Alignment:
  - Added `DvlProjectManager.CreateProject(..., RulePackBundle bundle, ...)` overload in `src/backend/AHUVerification.Core/Services/DvlProjectManager.cs`.
  - Automatically constructs immutable `RulePackInfo` provenance and `DvlRulePackSnapshot` via `RulePackManager.CreateSnapshot(bundle)`.
  - In existing `CreateProject(..., string rulePackVersion, string rulePackSha, ...)`, if `rulePackSnapshot == null`, sets `Integrity.State = "draft"` rather than asserting certifying completeness.
- Draft vs Certified Project Save Invariants:
  - Reconciled `ValidateV2ProjectStructure` with ADR 0011 (Decision 5): valid noncertifying drafts (`Integrity.State != "complete"`) can be saved and reloaded without requiring a full embedded template snapshot.
  - For projects in `"complete"` state, snapshot integrity and template artifact validation are strictly enforced.
- Test Reconciliation & Rejection Coverage:
  - `DvlProjectTests.DvlProject_RoundtripSerialization_PreservesAllData`: verified full production-factory roundtrip with `bundle`, asserting all collections, cryptographic complete-state hash, and `Integrity.State == "complete"`.
  - `DvlProjectTests.SaveJsonToFile_ReplacesDestinationWithoutLeavingTemporaryFiles`: updated to use valid serialized DVL envelopes, asserting atomic destination replacement, zero leftover temporary files, and rejection of malformed JSON with destination preservation.
  - Added `DvlProjectTests.DvlProject_DraftWithoutSnapshot_CanBeSavedAndLoadedAsNonCertifyingDraft` verifying persistence and honest noncertifying reporting for draft projects (`CertificationAllowed == false`, `State == "artifact-unavailable"`).
  - `BridgeHandlerTests.Handle_SaveDvl_ValidPayload_WritesFileSuccessfully`: updated to send a valid DVL project envelope and added negative test proving malformed payload fails without a partial file write.

### Verification Results
| Verification Target | Result | Notes |
|---|---|---|
| `DvlProjectTests` | 12 passed, 0 failed | All roundtrip, atomic save, draft persistence, and rejection tests pass |
| `BridgeHandlerTests.Handle_SaveDvl` | 2 passed, 0 failed | Valid DVL save and malformed rejection pass |
| Full .NET Suite | 196 passed, 2 failed | Failure count reduced from 5 to 2 (0 regressions) |
| `npm test` | Passed | All 22 suites (104 assertions + 15 adversarial + 28 AST + 68 copy + 26 contrast) |
| `npm run build` | Passed | Clean production bundle compilation |
| `node scripts/build_rulepack.mjs` | Passed | Rule pack v14.0.0 built cleanly |

### Remaining Failures Owned by Phase 2 & 3
1. `BridgeHandlerTests.Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook` -> Phase 2, Slice P2-B (native destination selection & deliverable export).
2. `BridgeHandlerTests.RuleEditor_PublishRulePack_ValidPayload_PublishesSuccessfully` -> Phase 3, Slice P3-A (editor supported verification modes).

### Next Action: Slice P2-B — native destination selection & deliverable export
- Reconcile `BridgeHandlerTests.Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook` with the host native path selector boundary.
- Verify that untrusted renderer-supplied output paths cannot bypass native dialog/selector boundary.
- Verify cancellation and invalid target path error handling.

## Phase 1 Slice P1-B Completed & Accepted — 2026-09-05

Slice P1-B: weight & checker semantics is completed and independently verified.

### Scope Executed & Changes Made
- Skid Weight Authority:
  - Engineering skid aggregate weight (calculated from segment weights in `Config.xml`) is authoritative upon ingestion (`Derived` / `Authoritative` with `derivationName: "Sum of Segment Weights"`).
  - Skids with missing or <= 0 weight fall back strictly to `Unknown` / `RequiresConfirmation` with `promptNote: "Authoritative skid weight is required for structural verification."`
  - Reconciled in both `src/services/factRegistry.ts` and `src/backend/AHUVerification.Core/Services/FactExtractor.cs`.
- Contract & Parser Bug Fixes:
  - `FactContractValidator.cs`: Fixed pattern key regex escaping bug (`Regex.Escape` escaping `{` but not `}` prevented `{id}` pattern specs from matching).
  - `NormalizedXmlParser.cs`: Fixed `GetChildText` to treat empty XML tags (`<tag></tag>`) as missing/defaulted values rather than returning empty strings.
- Test Reconciliation:
  - `FactRegistryTests.cs`: Verified `ExtractFacts_PreservesProvenanceAndStrictWeightSemantics` asserts `Derived` / `Authoritative` for valid engineering skid weight and `Unknown` / `RequiresConfirmation` for zero-weight skids.
  - `AstEvaluatorTests.cs`: Verified `EvaluateChecklists_EnforcesStrictWeightAndFactCompleteness` evaluates `BASE-01` (`skid.weight > 4000`) as `Applicable` for positive skid weight, and `NeedsInput` for zero-weight skids with unconfirmed weight.
  - `GoldenProductionPathTests.cs`: Removed unregistered `unit.checker` fact override, supplied `rulePackSnapshot` / `rulePackProvenance` to satisfy DVL v2 persistence requirements, mapped column `T` for detailer check-off, and passed full end-to-end lifecycle test.

## Phase 1 Slice P1-A Completed & Accepted — 2026-09-05

Slice P1-A: extraction provenance parity is completed and independently verified.

### Scope Executed & Changes Made
- Dual-engine contract parity implemented in `src/services/factRegistry.ts`, `src/services/xmlParser.ts`, `src/backend/AHUVerification.Core/Services/FactExtractor.cs`, `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs`, and `src/backend/AHUVerification.Core/Models/NormalizedGraph.cs`.
- `createFact` / `CreateFact`:
  - Populates `originalSnapshot` capturing pre-override state (`value`, `status`, `confidence`, `sourceRawValue`, `sourcePointer`, `derivationName`, `sourceState`, `promptNote`).
  - Sets `sourceState` explicitly (`present`, `absent`, `derived`, `manual`).
  - Aligns derivation names (`LipHeight > 0`, `Upper Tier Segments Detected`, `Upper Base Detected`, `Housing Style Contains ThermalBreak`).
- Missing Facts Handling:
  - Preserves distinction between omitted/absent source data and valid zero/default values without fabricating certainty.
  - Clears `value`, `sourceRawValue`, `sourcePointer`, and `derivationName` to null/undefined.
  - Sets `status = Unknown`, `confidence = RequiresConfirmation`, and assigns context-appropriate `promptNote` based on `sourceState` (`absent`, `malformed`, `defaulted`).
- Graph Model Alignment:
  - Canonical ordinal ordering enforced on `missingFacts` arrays across both C# and TS.
  - Aligned parser handling for numeric values (`floorMaterialGauge` decimal string parsing, `noaRating`, `isStackedTopUnit`).
- Override & Revert:
  - `overrideFact` validates key against fact contract and type compatibility.
  - `revertFact` restores complete baseline from `originalSnapshot` including `sourceState`, `sourcePointer`, and `derivationName`, appending audit entry.

## Phase 0 completed — 2026-09-05

The user authorized Phase 0 of the [phased remediation plan](docs/operations/remediation-plan.md). Baseline capture, failure classification, the authority decision, and assignment of the first narrow slice are complete. Phase 1 implementation has not started; no implementation slice is accepted. The older checkpoint below remains historical and does not override this execution order.

### Protected tree and environment

- HEAD: `1844dc7a18b28ba78b23087d5c32f3c8930c94a9`, branch `master`. Entry inventory: 103 changed/new paths (100 in initial review + `remediation-plan.md`, `0011-certified-processing-authority.md`, and `docs/decisions/README.md`). Preserve all staged and unstaged edits.
- Ignored evidence directory: `tests/AHUVerification.Tests/TestResults/phase0/`. `baseline.json` records UTC capture time, exact entry inventory, per-file SHA-256, index digest, and product-change digest. Documentation edits after capture are excluded from the product digest; the index and product files must remain unchanged during Phase 0.
- Product-change digest: `67eeb29c81b109c6703b19c009877e16407af6add8e950b0a7dc6ebb3b00e497`. Index digest: `26a327917a32a464ffb27b73730c49d4ce1604039b485fa19a50ca6641ac2538`. These identify the dirty-tree baseline alongside HEAD, not a release artifact.
- Tested tools: Node `24.14.0`, npm `11.9.0`, TypeScript `5.9.3`, Vite `6.4.3`, .NET SDK `8.0.424`, .NET/WindowsDesktop runtime `8.0.30`.
- Required Node pin: `22.18.0`; not found on PATH, in the checked nvm/fnm/Volta locations, or the bundled Codex runtime (which supplies `24.19.0`). No runtime was installed. Node 22.18 compatibility remains unverified; this limits later acceptance, not Phase 0 classification.
- Agent Ground still reports stale architecture notes. No freshness certification was performed. [ADR 0011](docs/decisions/0011-certified-processing-authority.md) records the accepted authority direction and explicitly distinguishes it from incomplete implementation.

### Reproduced verification

| Command | Phase 0 result | Evidence / limitation |
|---|---|---|
| `npm run build` | Passed | `build.log`; outside sandbox for known esbuild access restriction |
| `npm test` | Passed | `npm-test.log`; includes structural lint, not full UI/E2E coverage |
| `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --no-restore --logger "trx;LogFileName=phase0.trx" --results-directory tests/AHUVerification.Tests/TestResults/phase0` | 187 passed, 10 failed, 0 skipped | `phase0.trx`, `dotnet-test.log`; outside sandbox; includes both passing built WebView2 cases |
| `npm run test:bundle` | Passed | `bundle.log`; main entry 1,352,122 raw / 288,124 gzip bytes; editor 748,561 / 216,580 |
| `npm run test:dist` | Passed | `dist-assets.log`; both entry asset graphs resolve |
| `git diff HEAD --check` | Failed | `whitespace.log`; pre-existing remediation whitespace; not repaired in Phase 0 |

The 11 original canonical/fingerprint/numeric/DVL acceptance cases pass; the two sparse extraction comparisons fail. The fresh full run reproduces the same ten failures as the prior review. Prior Playwright evidence remains 2 passed / 6 failed for `chromium-desktop`: five hidden-demo fixture dependencies and one serious manual-modal contrast failure. It was not rerun in Phase 0 because source/build output did not change; the second viewport and installer lifecycle remain unverified. The existing WindowsBase build warning persists.

### Ten-failure classification and ownership

Test names below omit the common `AHUVerification.Tests` namespace. Categories describe the observed failure, not everything still wrong in that area. No test was modified or waived.

| # | Failing test | Classification and evidence | Owner / corrective acceptance |
|---|---|---|---|
| 1 | `CanonicalParityAcceptanceTests.SparseSource_ProductionBrowserAndNativeContractsAgree` — sparse weight XML | Product contract mismatch: browser original snapshots are objects, native snapshots null; source pointers and prompt metadata also disagree (`factRegistry.ts:createFact`, `FactExtractor.cs:CreateFact` and missing-source handling). | P1-A: align effective provenance and snapshots in production; retain full comparison. |
| 2 | Same test — malformed weight/construction XML | Product contract mismatch, independently reproduced for malformed input. Unknown/malformed metadata cannot be normalized into authored certainty. | P1-A: malformed fields stay Unknown/RequiresConfirmation with matching provenance. |
| 3 | `FactRegistryTests.ExtractFacts_PreservesProvenanceAndStrictWeightSemantics` | Obsolete expectation at line 44: calculated skid weight expected Derived/Authoritative; strict policy now yields Unknown/RequiresConfirmation. Ratings assertions occur earlier and are a separate contract. | Phase 1 weight slice: test missing/calculated versus authored/approved weight explicitly; do not restore calculated authority. |
| 4 | `AstEvaluatorTests.EvaluateChecklists_EnforcesStrictWeightAndFactCompleteness` | Obsolete fixture/expectation at line 34. Its comment describes UTL; current `BASE-01` is lifting-lug support requiring `skid.weight > 4000` (`rules.json:3`). Unknown weight correctly blocks applicability. | Phase 1 weight slice: assert NeedsInput for missing authoritative weight and correct outcomes for authored values around the actual threshold. |
| 5 | `GoldenProductionPathTests.GoldenProductionPath_FullLifecycle_FromUpzToCertifiedWorkbook` | Unresolved test/domain contract at line 97: overrides unregistered `unit.checker`. Checker comments/initials exist, but that does not establish a checker fact. Later stages are not reached. | Phase 1 contract reconciliation: trace intended checker persistence/workbook mapping; use the supported metadata contract or explicitly justify a fact. Preserve checker-information assertions. |
| 6 | `DvlProjectTests.DvlProject_RoundtripSerialization_PreservesAllData` | Factory/caller/save contract mismatch at line 54: production `CreateProject` permits omitted snapshot, then `SaveToFile` rejects the resulting v2 project. Not safely classed as only a bad assertion. | Phase 2 persistence slice: align construction, valid noncertifying drafts, artifact provenance, and save validation; retain a real production-factory roundtrip. |
| 7 | `DvlProjectTests.SaveJsonToFile_ReplacesDestinationWithoutLeavingTemporaryFiles` | Obsolete fixture at line 228: `{revision:1}` / `{revision:2}` are arbitrary JSON, not valid DVL envelopes. | Phase 2: atomic replacement with two valid DVL payloads; malformed input must preserve the old file and leave no temporary output. |
| 8 | `BridgeHandlerTests.Handle_SaveDvl_ValidPayload_WritesFileSuccessfully` | Obsolete fixture at line 172: `{version,jobName,comNumber,units}` fails the required DVL envelope/validation contract. | Phase 2: real valid DVL through bridge saves; malformed payload fails without a partial write. |
| 9 | `BridgeHandlerTests.Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook` | Obsolete privileged-path fixture/contract at line 235: renderer supplies `outputPath` and the handler lacks a native selector. Current contract requires host-selected destination; other payload requirements still need valid setup. | Phase 2: inject the intended native selection boundary and valid source/draft state; retain renderer-path bypass and cancellation rejection cases. |
| 10 | `BridgeHandlerTests.RuleEditor_PublishRulePack_ValidPayload_PublishesSuccessfully` | Obsolete supported-mode fixture at line 627: `AutoEvaluated` is rejected by current pack validation. A success fixture must use an implemented mode. | Phase 3 editor slice: valid pack publish/reload/rollback succeeds; unsupported modes remain rejected. |

No failure in the outside-sandbox run is classified as an environment-only failure. Missing Node 22.18 and sandbox esbuild access are separate verification limits. The apparent fixture failures do not prove their corresponding production workflows are complete.

### Next action

The next assigned slice is **P1-A: extraction provenance parity**, scoped in the plan to the two fact extractors and focused acceptance tests, with parser/DTO expansion only when evidence requires it. One Luna xhigh implementer owns implementation after Phase 1 authorization; the primary owns independent acceptance. First target: the existing 13 canonical acceptance cases all pass, with an authored-source positive case and unknown/malformed override/revert rejection coverage, without regressing previously passing tests. Do not reopen three broad waves or pull/commit/push/close issues as part of this checkpoint.

## Historical interrupted implementation checkpoint (superseded by Phase 0 above)

### Prior checkpoint context

- Repository: `C:\Users\brand\Documents\Detailer Verification List Project`; branch `master`; HEAD remains `1844dc7`.
- The latest user instruction is to update this handoff with current progress only. Implementation is paused; this checkpoint does not authorize further implementation work.
- Preserve all staged and unstaged edits. No commits, pushes, publication, or issue closures have been performed in this remediation session.
- Work now extends into Waves 2 and 3, but **no implementation slice is accepted**. The earlier Wave 1-only handoff was stale.
- Backend and release/editor agents resumed, then both ended with usage-limit errors again. Frontend could not resume because of the agent limit, so the primary continued that slice. No agents remain running and no acceptance-ready final reports were delivered.
- Latest status contains 100 changed/new files. Existing staged changes and subsequent unstaged edits remain preserved.
- Latest full-suite evidence predates the newest edits. Do not describe the current tree as green.

## User contract and scope

Fix open issues #2–#22 carefully, without premature abstractions, over-engineering, or scope creep. Use Luna xhigh implementers; they never review or approve their own work. The primary reviews source, tests, integration, and acceptance, and returns detailed correction lists until each slice is accepted.

No push or publication without fresh authorization. Do not reset, clean, discard existing changes, or silently replace the staging area.

Weight policy is settled: only explicitly authored/approved skid weight is authoritative. Calculated weight remains diagnostic and cannot clear readiness. This is separate from Seismic/NOA/Knockdown confirmation.

## Authoritative issue criteria

The live public GitHub issues were retrieved through Python `urllib.request` after `gh` returned HTTP 401 and PowerShell/web retrieval failed. A session-local snapshot is at `C:\Users\brand\AppData\Local\Temp\dvl-remediation-issues.json`; retrieve again if absent. This is an aid, not durable authoritative state.

1. Wave 1: fact/schema/provenance #3, #5–#10; DVL integrity/export #4/#12; release/accessibility/version #13/#18/#22; initial bundle-budget slice #20.
2. Wave 2: authoritative desktop engine, active-pack state, trusted export and IPC #11/#15/#17; Rule Editor #14.
3. Wave 3: real golden workflow, cross-runtime parity, built frontend, Windows IPC, precise workbook assertions and coverage #16.
4. Wave 4: characterized refactoring #21, transient artifact hygiene #19, remaining packaged-path/bundle work #20. Umbrella #2 cannot close until its own and dependent criteria are met.

## Ownership and partial implementation

### frontend_contracts — primary continuation paused, not accepted

Owns TypeScript application/services/types/readiness and fact/DVL test scripts. Excludes Rule Editor, HomePage, ModalShell, and useFocusTrap.

Partial edits include App save metadata/signature integration, ordered pack loading/recomputation, host verification wiring, fact original snapshots/audit history, numeric predicate validation, allowNA readiness, active rules for manual generation, DVL integrity state persistence and canonicalization.

Primary continuation added stale-result rejection using session/pack revisions, host generation tracking, trusted-source and pending-verification export gates, host-routed override/revert verification, pack-change recomputation, browser upload filename preservation, registered-type input parsing, and canonical UTL actions. Readiness now uses the active rule's allowNA policy and defaults to disallowing N/A when no policy exists. Node regression fixtures and a negative N/A-policy test were updated.

Review requirements still outstanding:

- The initial five TypeScript errors were fixed and a production build passed, but that build predates subsequent frontend and modal edits. Rebuild the exact current tree before acceptance.
- Align native/renderer request and response contracts, especially trusted source session and active pack identity/generation.
- Preserve source filename, UPZ/order-revision XML and pack snapshots on autosave, Save, Save As, reopen, and export.
- Saving legacy/tampered/mismatched state cannot silently restore certification, including after reopening the saved file.
- Align audit DTOs: TS previously used `by` plus snapshot while C# used `actor`; typed native serialization must not drop fields or inject defaults that invalidate the complete-state hash.
- Reject unsupported scopes/modes at validation, not only in editor dropdowns.
- Complete source absence/malformed/default provenance, alias migration, override/revert cycles, strict weights/material mappings, and behavioral regression tests.
- Review the remaining legacy `unit.utl` condition, desktop Header upload/native-source binding, and manual draft behavior when raw XML is present. These are unresolved review leads, not confirmed fixes.

### backend_certification — interrupted, not accepted

Owns backend Core/main host and C# tests except the primary-owned tests listed below and Rule Editor-specific work.

Partial edits include DVL pre-save validation, raw canonical number serialization, provenance/weight handling, host recomputation/export, origin policy and bridge source/path restrictions. Inspect source rather than assuming these are finished.

Latest agent-reported work adds a shared JSON.stringify-compatible canonical encoder, source binding across Config/OrderRev/Manifest and active-pack generation, host-owned export selection, raw DVL validation/persistence, audit `by`/snapshot DTO fields, typed override reapplication, SQ/allowNA checks, and OpenXML validation before replacement. A raw-source-free draft fallback is explicitly noncertifying; final export requires trusted source binding. These changes still require independent integrated verification.

Critical review requirements:

- The previous export path allowed omitted `configXml` to bypass host recomputation, even for final export. Confirm removal without breaking honest draft/manual persistence.
- Do not promote arbitrary renderer XML to trusted final provenance. Bind final export to source captured by native ingestion/open and the validated active pack generation.
- Accept only typed, validated manual override intent; recompute facts/confidence/provenance/applicability/readiness from host-owned data. SQ completion and allowNA policy must participate.
- Exact URI origin comparison, dev-only localhost, new-window/navigation restrictions, and production devtools policy are required.
- Final targets must be absolute user-selected `.xlsx` paths; renderer `outputPath` must not bypass selection. Sibling temporary output must pass OpenXML validation before atomic replacement.
- DVL raw save must reject arbitrary/malformed/tampered JSON without reblessing hashes; draft/noncertifiable persistence must remain usable. Template availability needs actual retrievable/embedded bytes, not a self-asserted boolean.
- Native typed DTO roundtrip must preserve a real TS-created DVL's complete payload/hash.
- Fix semantic fingerprint Unicode/escaping/exponent parity and exact numeric equality (old C# used tolerance while JS used strict equality).
- Intermediate `DvlProjectManager` syntax failures blocked test runs. The agent subsequently reported successful Core/App compilation; the primary has not rerun the expanded parity suite after the latest repairs.
- The golden service test formerly failed because `OriginalSnapshot` was null; subsequent stages were never reached.

### release_editor — interrupted, not accepted

Owns workflows, build/release/test scripts, version/package/Vite metadata, Rule Editor source/host, HomePage/ModalShell/useFocusTrap, Playwright, and `docs/operations`.

Partial edits include prerequisite checks, version/budget/script changes, editor import/rename/publish behavior and host origin restrictions. Remaining review includes:

Latest edits include Node 22.18.x metadata, fail-fast prerequisite scripts, explicit release SemVer/pinned tooling checks, dependency-graph bundle accounting, canonical editor validation and mapping rename, full draft export, and native transactional publish/rollback. Playwright now targets production preview. Production hides the demo card, so tests were being migrated to Manual Unit Setup; ManualUnitModal now uses a body portal for focus isolation. No final passing browser report was received. Reconcile the flagged workflow Node 22.14 versus package 22.18 pin before acceptance.

- Correct pinned Node/runtime requirements, fail-fast batch/PowerShell paths, least-privilege release jobs, pinned tooling/actions, reproducible rule pack, checksums/SBOM and packaged assets.
- Native Rule Editor launches with active pack context, retains approved mappings, rejects invalid imports and unsupported scopes/modes, and proves publish/reload/rollback without browser false-success.
- Run rendered keyboard/axe tests against built output, including all launch actions and focus isolation/restoration/nested dialogs.
- Installation, first launch, uninstall, and release uploading are separate target-host/external gates, not implied by source checks.

## Primary-owned additions

- `.editorconfig`: scoped editor defaults; no repository-wide formatting pass yet.
- `AHUVerification.sln`: Core, App, RuleEditor and tests; created successfully.
- `TEST_INFRA.md`: rewritten to distinguish structural lint, unit, service integration, browser, native host and packaging evidence.
- `scripts/test_cross_runtime_parity.mjs` and `tests/AHUVerification.Tests/CanonicalParityAcceptanceTests.cs`: production TS/C# canonical payload/fingerprint, numeric predicate, and real TS-created DVL/native save comparisons. These are not yet green.
- `tests/AHUVerification.Tests/WebViewHostSmokeTests.cs`: hidden WinForms/WebView2 harness loading both built entries via virtual host, checking real getAppInfo/getRulePack transport, rendered root and missing local assets. The original two cases passed outside the sandbox. A subsequent main-entry verifySource/camelCase/untrusted-readiness assertion has not been compiled or rerun. This is not installer or full certified-export E2E proof.
- The parity probe also has an `extract` operation using in-memory esbuild plus installed Chromium and real browser DOMParser. It ran successfully for sparse XML. Two full browser/native sparse/malformed extraction comparisons were subsequently added but remain unexecuted after an intermediate compile failure. Its isolated HTTP page is test harness infrastructure, not a production UI journey.

## Verification evidence and environment

Before the latest agent edits:

- Core Release build: passed, zero warnings/errors.
- `npm run build`: failed with five TS errors (App save call/source metadata; Fact snapshot/audit types).
- `npm test`: passed, illustrating that Node tests alone did not catch compilation failures.
- Fact contract: passed, 104 rules / 109 entries.
- DVL simple canonical fixture: SHA `1aa26cd3c1d1b5b4906503ece290375a23471c6ead56aec962709323bbfc27b8`.
- Version consistency and negative mismatch tests: passed.
- Full .NET suite: 181 passed, 1 failed, zero skipped; GoldenProductionPathTests line 90 null OriginalSnapshot.
- `git diff HEAD --check`: whitespace failures (not just CRLF notices).

During resumed implementation (each result applies to its tested snapshot, not automatically the newest tree):

- `npm run build`: TypeScript passed in the sandbox, then esbuild hit parent-directory access denial. The approved outside-sandbox run passed: Vite 6.4.3, 1,643 modules. Chunks over 500 kB remain. This build predates later App/readiness/input and modal portal edits.
- `npx tsc --noEmit`: passed after session/host gating edits, before the final typed-input/readiness changes.
- Latest `npm test`: passed after readiness tightening and fixture updates, including the negative N/A-policy test. This is not browser or E2E evidence.
- Canonical parity: 11 tests ran, 7 passed and 4 failed. Failures involved Unicode escaping, TS-created DVL hash parity, and semantic fingerprint escaping/exponent formatting. UTF-8 subprocess handling and the backend encoder were subsequently changed; no rerun confirms those fixes. The suite now contains two additional extraction cases awaiting execution.
- Original WebView2 built-entry smoke: sandbox navigation timed out; approved outside-sandbox run passed 2/2 with zero skips in approximately three seconds. The later verifySource extension remains unverified.
- Backend agent reported Core Release with zero warnings/errors and App Release with zero errors plus the existing WindowsBase conflict warning after syntax repairs. This is not primary final acceptance or a full-suite result.
- Built-preview Playwright attempts encountered the hidden production demo entry. Test migration and modal portal changes were in progress at interruption; no final passing report was received.
- Production TS manual project probe ran: 58 facts and 99 checks produced. Hash varies with timestamps.
- Installed Chromium exists under the local Playwright cache.
- In-sandbox esbuild failed reading parent directories (`Access is denied`). The same local probe was approved outside the sandbox and ran after adding an isolated origin for browser localStorage. This was not an auto-review rejection.
- No dependency installation, installer execution, push, release publication, or clean-checkout certification was performed.
- No final full .NET suite, exact-current-tree production build, coverage baseline/ratchet, or final whitespace check has completed. The earlier 181/182 full-suite result remains historical.

### Prior resume order (historical; superseded by Phase 0 / P1-A above)

1. Stop at this documentation-only checkpoint per the latest user instruction. Wait for a new request before resuming implementation; preserve all edits.
2. When resumed, re-establish disjoint owners and independently inspect the latest source/session/pack DTOs, draft/final export paths, and incomplete browser test migration.
3. Run primary-owned parity tests and full build/tests. Return concrete failures to Luna implementers. Do not weaken assertions or substitute source scans for behavior.
4. Run built browser tests and actual WebView2 host smoke; complete golden final export/DVL/Excel assertions and real retained-engine parity.
5. Only after correctness stabilizes, complete characterized cleanup/refactoring, source-aligned architecture/operations docs, coverage baseline and remaining local package checks.
6. Update this file with final evidence and exact remaining external/target-host gates. Do not claim all issues fixed, accepted, or closed until supported.
