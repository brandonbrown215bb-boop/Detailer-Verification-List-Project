# C# migration completion and remediation plan

Date: 2026-09-06
Status: Current acceptance pending — do not treat CE-R1 through CE-R6 as complete on this working tree.
Baseline: `master`, HEAD `c63931a05d08`, with existing uncommitted migration work
Parent contract: [C# authoritative engine plan](csharp-authoritative-engine-plan.md)
Prior implementation evidence: [CE migration log](ce-migration-log.md)
Architecture: [ADR 0012](../decisions/0012-csharp-authoritative-engine-and-browser-engine-retirement.md)

## Objective and release treatment

Finish the existing migration: C# owns processing, validation, persistence and Excel output; React/WebView2 renders host state and collects input. Preserve the delivered native workflows and remove the remaining routes around that boundary. This is a bounded completion plan, not a new architecture or a restart of CE0–CE6.

The product owner confirmed that this is an internal release, not a live rollout. At this plan's evidence baseline, two defects were explicitly **known and non-blocking for the next internal build**:

- **CE-R5a — Comment overwrite:** the latest comment must survive a subsequent checklist action; the current race remains open for testing and correction.
- **CE-R5b — Visual-rule conversion:** editing must preserve a rule's meaning; the current conversion defect remains open for testing and correction.

These deferrals did not mean the defects were fixed or their behavior was accepted. They did not require a release delay. The sequence below prioritizes finishing the migration; it does not impose a new blanket freeze on internal builds. Full migration closure requires current evidence for the outstanding work, or a separately recorded scope decision. There is no public release commitment in this plan.

## Evidence baseline

The historical review captured by this plan established:

- Build and `npm test` passed using the repository's pinned Node `22.18.0`.
- Dist, bundle-budget and dependency-graph checks passed; `xlsx` and `file-saver` were removed.
- The .NET run passed 260 of 262 tests in the sandbox. Both WebView2 startup tests timed out there and passed when rerun outside the sandbox. This is combined evidence, not one uninterrupted 262-test pass.
- One existing Playwright home-screen test was run and failed: it expects browser import controls while the app displays `Desktop Application Required`. The complete Playwright suite was not rerun.
- The real hook, exercised with a simulated host, sent a new checklist comment at revision 1 and the old comment in a status command at revision 2. This was a focused command-sequencing reproduction, not native UI E2E.
- A production converter probe changed `4000 > skid.weight` into `skid.weight > 4000` after a visual-tree roundtrip.
- The existing installer SHA-256 matched the migration log. Its complete installed workflow was not repeated in the review. Coverage and complete packaged journeys remain historical log evidence until rerun for the remediated tree.

This planning pass rechecked the affected source and found CI still invokes the deleted `scripts/test_m2_parity_and_bridge.mjs`. Agent Ground still flags architecture notes stale, and Graphify lacks the new session symbols; source and tests govern this plan. No application tests were rerun solely for these documentation edits.

## Work order and ownership

Each slice should leave a buildable application. Attach focused regression evidence to the slice that changes the behavior, then run the complete acceptance checks after integration. The primary reviewer owns final acceptance; implementation does not approve itself.

| Slice | Work | Dependencies | Responsible boundary | Original requirement |
|---|---|---|---|---|
| CE-R0 | Correct status and retain evidence | None; completed by this document | Documentation | CE0 / CE6 |
| CE-R1 | Close legacy authority routes | R0 | Main host bridge, Core session | CE1 / CE3 |
| CE-R2 | Preserve pinned projects and recovery | R1 contract stable | Core persistence/session, host lifecycle | CE2-B / CE3 |
| CE-R3 | Finish Rule Editor ownership | R0; integrate with R1 contract | Editor bridge, Core validation, renderer | CE4 / CE5 |
| CE-R4 | Replace obsolete tests and CI gates | Update alongside R1–R3; finish after integration | Test/build tooling | CE5 / CE6 |
| CE-R5a | Correct queued comment/status updates | R1 contract stable; may follow internal build | Renderer commands, Core checklist | CE2-A |
| CE-R5b | Preserve visual-rule meaning | R3 ownership settled; may follow internal build | Editor transport, Core rule semantics | CE4 |
| CE-R6 | Record final acceptance | R1–R4; R5 closure tracked separately below | Integration, Windows validation, documentation | CE6 |

Recommended sequence: **R1 → R2 → R3 → R4 → internal acceptance checkpoint**. R4 tests are developed with their owning fixes, not postponed until the end. R5a and R5b can follow the next internal build, then R6 records full closure. Independent read-only review may run alongside implementation; overlapping edits stay sequential.

## CE-R1 — Close legacy authority routes

**Problem:** `BridgeHandler.cs` still dispatches `verifySource`, `exportExcelDeliverable` and `saveDvl`. These routes accept renderer XML/project state outside the session. `VerificationHostService.VerifySource` unconditionally returns `SourceIsTrusted = true`. The new session workflow does not remove this older route.

**Implementation:**

1. Trace all three action consumers in `desktopBridge.ts`, both hosts, tests and tooling. Migrate legitimate consumers to host-owned source/session commands, then remove the legacy actions and wrappers. A renderer-supplied XML string must not become authentic because it was successfully parsed.
2. Keep both draft and final export on the session's acknowledged revision. Save supplies intent; the host owns canonical state and file selection. Preserve native dialogs, atomic replacement, cancellation and manual draft behavior.
3. Retain parsing/evaluation helpers in Core where useful, but make source trust explicit and established by host acquisition or the accepted DVL-reopen policy. Do not leave a publicly callable bridge adapter to the old renderer-state export path.
4. Check checklist/SQ/fact mutations for host validation of allowed transitions and values, plus stale session/revision rejection, deduplication and reset/close invalidation. Readiness displaying a rejected transition as incomplete is not a substitute for validating the mutation.

**Primary files:** `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`, `src/backend/AHUVerification.Core/Services/VerificationHostService.cs`, `src/backend/AHUVerification.Core/Session/{SessionCommands,ProjectSession,ProjectSessionService}.cs`, `src/services/desktopBridge.ts`, `src/types/session.ts`.

**Acceptance:** production bridge tests reject retired action names, substituted raw XML, old-session commands and injected authority fields; a native-held source completes import → edit → save → export on the accepted revision. Manual/untrusted inputs remain draft-only. Replace the WebView smoke assertion that currently expects arbitrary renderer XML to be trusted. Verify cancellation and failed output replacement leave existing files intact.

## CE-R2 — Preserve historical projects and interruption state

**Problem:** `ProjectSessionService.OpenDvl` validates against and installs the current pack, while export prefers that pack's template and mappings. Embedded historical template bytes alone do not restore the saved processing context. Pack activation increments the session revision without marking it dirty or scheduling recovery. Reopen also supplies the `.dvl` path as the original source path, so resaving can replace the source filename with the project filename.

**Implementation:**

1. Resolve and verify a cohesive project pack from the saved snapshot: rules, mappings, contract/approved mappings where required, identity and exact template bytes. Use existing `DvlProjectManager` / `RulePackManager` mechanisms, including the verified-template resolver, rather than adding another cache subsystem.
2. Separate project integrity and source trust from whether the installed default pack is newer. Preserve the accepted trust-restoration policy for untampered native projects; a pack difference alone must not silently migrate a project or misclassify its source.
3. Use the resolved project pack consistently for evaluation, readiness, draft and final output. Do not combine historical facts/checklists with an unrelated current template/map. If required historical artifacts cannot be recovered, explain what is unavailable and block the affected output instead of substituting artifacts.
4. Preserve the explicit `Reload & Re-verify Project` choice for adopting a new pack. Reconcile checklists and preserve applicable user entries, mark changed state dirty, and schedule recovery. Failed activation preserves the prior accepted session. Advance the host activation generation monotonically even when selecting older pack content.
5. Keep original source filename/UPZ metadata separate from the current `.dvl` save path and native recovery path. Preserve both through open, recovery, Save As and a second save.
6. Reconcile the original plan's one-time browser-autosave migration requirement with the later log's retirement decision. Record whether known legacy recovery data needs transfer or the path is retired; do not recreate a browser engine or silently delete existing recovery data. Any required transfer is opaque bytes validated and durably saved by C#.

**Primary files:** `src/backend/AHUVerification.Core/Services/{DvlProjectManager,RulePackManager}.cs`, `src/backend/AHUVerification.Core/Models/DvlProject.cs`, `src/backend/AHUVerification.Core/Session/{ProjectSession,ProjectSessionService,ProjectSessionSnapshot}.cs`, `src/hooks/useRulePackSession.ts` and snapshot consumers as needed.

**Acceptance:** save under pack A → install pack B → restart offline → reopen still uses verified A rules/map/template; explicitly adopting B creates a recoverable changed revision. Cover missing/tampered embedded artifacts, legacy DVL, manual drafts, failed activation, crash recovery, and save → reopen → save source-metadata fidelity. Inspect resulting workbooks for values, comments/initials, formulas and sheet pruning. Preserve the currently accepted 22-slot SQ limit; do not reinstate an unbounded SQ workflow from older documents.

## CE-R3 — Finish Rule Editor processing ownership

**Problem:** `RuleEditorApp.tsx` initializes from bundled pack JSON, falls back to those assets on host failure, and still normalizes/validates rules and constructs mappings in TypeScript before publishing. Deleting the evaluator module did not finish CE4.

**Implementation:**

1. Load editor rules and display metadata from the host. Show a visible unavailable/error state if that fails; do not present bundled rules as the active pack. Apply desktop-host-required behavior to both entry points.
2. Make native open/save/validate/publish return normalized rules, mappings and structured field diagnostics from the same Core contract. Remove renderer acceptance decisions and duplicate mapping generation from `RuleEditorApp.tsx` and domain portions of `factContract.ts` after tracing consumers.
3. Inspect sandbox validation against production validation, including its dynamically extended simulated-fact contract and operator normalization. Test values may vary; simulation must not silently certify a rule the production contract rejects. Retain explicit test inputs without activating or publishing them.
4. Keep UI buffers, selection, labels and formatting in TypeScript. For `astConverter.ts`, complete the lossless transport boundary in R5b; its known semantic defect remains explicitly deferred for the internal build. Remove remaining production domain decisions in readiness/fact helpers where consumer inspection finds them; retain harmless presentation projections.
5. Preserve native draft save/open, unpublished status, deletion confirmation, staged publishing/rollback and explicit main-app pack reload. Use isolated test destinations; this work does not authorize live shared-pack publication.

**Primary files:** `src/ruleEditor/RuleEditorApp.tsx`, `src/ruleEditor/components/{RuleFormView,RuleTestSandbox,VisualConditionBuilder}.tsx`, `src/services/factContract.ts`, `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs`, `src/backend/AHUVerification.Core/Services/FactContractValidator.cs`.

**Acceptance:** missing host/pack visibly blocks processing in both entries; native draft and publish use one validation/normalization contract; malformed rules produce field errors; editor sandbox and application agree for the same valid rule and fact inputs. Cover rename/deletion mapping retention, failed publish rollback and exact published-pack reload. Dependency checks include the editor and reject bundled fallback pack semantics, not merely imports of the eight deleted modules.

## CE-R4 — Restore meaningful tests and CI

1. Update `.github/workflows/codex-verification.yml`, `package.json`, `run-tests.bat` and relevant scripts together. CI still invokes deleted `test_m2_parity_and_bridge.mjs`; inspect every active gate for other retired consumers before removing obsolete steps.
2. Replace `tests/e2e/smoke.spec.mjs` browser-processing setup with fixed host snapshots and command responses for interaction/accessibility tests. Keep a real no-host guard test. Fixtures may model responses and failures but must not parse XML, calculate facts, evaluate rules or authorize exports.
3. Exercise the actual `useProjectSession` hook and editor components where behavior lives. Method-existence checks, source-string checks and hand-built payload assertions do not prove state transitions or UI interactions.
4. Port any uncovered valuable domain cases from deleted runners into C# production-function tests. Keep historical canonical JSON/DVL fixtures and material/Unicode/sparse-input regressions. Record each removed assertion's replacement, rather than relying on total test counts.
5. Extend real WebView2 tests beyond startup for session import/edit/save/reopen/export and editor draft/test/reload using temporary destinations. Keep these distinct from browser fixtures and from installed-app lifecycle evidence.

**Acceptance:** no active gate calls a deleted script or expects browser processing; Playwright passes with fixed host fixtures; real native tests exercise the session boundary; Core coverage floors are retained. Static entry-graph checks include remaining helpers and bundled JSON in both entries. Do not reintroduce the duplicate engine just to make old tests pass.

## CE-R5 — Non-blocking internal-release follow-up

### CE-R5a: comment/status ordering

In `useProjectSession.ts`, status and comment handlers capture the other field before their queued command executes. Send only the intended field change, with Core retaining the other field; alternatively resolve any required companion value from the latest acknowledged snapshot when executing. Preserve rejection reporting and pending-edit flushing for Save/Export.

**Acceptance:** with a deliberately delayed host response, add a first comment or replace an existing comment and immediately Check/Validate or mark N/A. The final state contains the newest text and the requested status. Reverse ordering also preserves both changes. Save/reopen and export retain that result. Include rejected-command behavior. No timing-based workaround is treated as a verified fix.

### CE-R5b: visual-rule fidelity

In `astConverter.ts` and its consumers, preserve operand direction, types and all supported conditions. Remove silent numeric fallback to zero and silent condition dropping. Keep semantic coercion in Core; any retained renderer adapter must roundtrip without changing meaning. If a structure cannot be edited faithfully, retain its original payload and report a precise unsupported-edit diagnostic.

**Acceptance:** cover variables on either side of comparisons, variable-to-variable comparisons, nested groups, invalid numeric input and unsupported structures. `4000 > skid.weight` must retain its truth outcomes below, at and above 4000 after open/edit/save/reopen. Core should evaluate the original and saved conditions identically. The choice to lock an individual unsupported rule versus the whole pack was not settled in the interview; recommend preserving that rule read-only while allowing other edits, and confirm only if such a limitation remains necessary.

**Tracking:** keep both items open and listed in internal build notes until verified. Neither is a prerequisite for the next internal build. Their expected behavior remains part of full migration completion.

## CE-R6 — Acceptance and documentation closeout

Run the following on the integrated tree using the supported toolchain; record the commit plus any dirty-tree scope, commands, outcomes and artifact hashes:

```powershell
npm run build
npm test
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
npm run test:coverage
npm run test:dist
npm run test:bundle
npm run test:graph
npx playwright test
```

Use the repository's already-provisioned Node 22 environment (`scripts/init_env.bat` / local `.tools` runtime). Run applicable `build-all.bat`, `run-tests.bat` and local packaging preflight. If rule-pack contents or generation change, also run `node scripts/build_rulepack.mjs` and byte-determinism checks. Recheck dist/bundle outputs after the final build. Separate environment startup failures from application failures and record any reruns honestly.

Record native packaged journeys through the renderer and bridge: UPZ-first import and XML fallback; override/revert; checklist/SQ edits; Save/Save As; process restart and recovery; native manual draft; final workbook; offline historical-pack reopen; editor draft/test/publish/reload in an isolated destination; missing host/pack and rejected commands. Installer lifecycle work and external publication retain their existing separate authorization boundaries.

Update the parent plan and migration log, then reconcile `README.md`, `PROJECT.md`, `TEST_INFRA.md`, architecture/development/validation guidance, IPC documentation and the Rule Editor guide against actual source. Preserve historical CE results, replacing blanket current completion claims with the actual accepted scope. Refresh Agent Ground verification only after that review. No new ADR is needed for fixes that implement ADR 0012.

Two distinct outcomes must be recorded:

- **Internal build checkpoint:** report the implemented slices, evidence and open items, explicitly carrying R5a/R5b as non-blocking if still unresolved. Do not call this full migration closure.
- **Full migration closure:** R1–R4 and R5 behavior pass their acceptance cases, the supported workflows have current native evidence, both frontend entries contain only presentation/transport logic, and documentation matches. An accepted architectural direction or passing unit-test count alone is insufficient.

## First implementation slice and exclusions

Start with **CE-R1**: migrate legacy bridge consumers and their tests, remove renderer-authoritative verification/save/export routes, and prove host-held source/session handling. Review that bounded change before proceeding to pinned-pack persistence.

Do not rewrite the UI framework, introduce a service/database/cache architecture, change weight or Seismic/NOA/Knockdown policy, broaden SQ capacity, bump file formats without demonstrated need, restore browser processing, reset the working tree, install software or publish artifacts as part of this plan. Preserve the existing migration changes and user projects. This planning task changes documentation only; implementation remains the next task.
