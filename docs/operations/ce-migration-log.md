# C# Authoritative Engine Migration Log

Date: 2026-09-06
Status: Active
Active Slice: CE0 / CE1
Architecture Decision: [ADR 0012](../decisions/0012-csharp-authoritative-engine-and-browser-engine-retirement.md)

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
| AST Predicate Evaluation | `scripts/test_cross_runtime_parity.mjs`, `tests/ast_predicate_evaluator.test.ts` | `AstRuleEvaluatorTests.cs` |
| Fact Provenance & Derivations | `scripts/test_cross_runtime_parity.mjs` | `FactExtractorTests.cs`, `FactRegistryTests.cs` |
| Canonical DVL Hashing | `scripts/test_dvl_canonical.mjs` | `DvlProjectManagerTests.cs` |
| Category Sheet Pruning | `excelExporter.ts` sheet pruning tests | `OpenXmlDeliverableTests.cs` |
| Project Mutation / State Transitions | `scripts/test_reducers.mjs` | `ProjectSessionTests.cs` (CE1) |

---

## 4. Slice Progress Tracker

- [x] **CE0: Lock Baseline and Migration Contract**
  - Baseline commit `ed8e9d5` established and verified.
  - Successor ADR 0012 drafted and indexed.
  - Retiring module consumer inventory and test mapping recorded.
  - Compatibility fixtures created under `tests/fixtures/compatibility/`.
- [x] **CE1: Establish C# Project Session and Command Contract**
  - C# `ProjectSessionService`, `ProjectSession`, models, and command records implemented in `AHUVerification.Core.Session`.
  - Typed snapshot DTOs created with complete project state and excluding raw XML.
  - Dedicated bridge actions wired in `BridgeHandler.cs` (`projectSession_open`, `projectSession_overrideFact`, `projectSession_revertFact`, `projectSession_updateChecklist`, `projectSession_updateSpecialQuote`, `projectSession_deleteSpecialQuote`, `projectSession_updateGeneralComments`, `projectSession_reset`, `projectSession_getSnapshot`).
  - Monotonic revision conflict checking implemented; conflicts return current authoritative snapshot.
  - Typed bridge client wrappers implemented in `src/services/desktopBridge.ts` and `src/types/session.ts`.
  - Core and Bridge tests passing (215/215 .NET tests green across `ProjectSessionTests.cs` and `ProjectSessionBridgeTests.cs`).
  - Frontend test suites and build passing (22/22 suites green, `npm run build` exits 0).
- [ ] **CE2: Move All Project Workflows onto the Engine**
  - CE2-A: Imported projects and edits in UI.
  - CE2-B: Manual projects and rule-pack changes.
- [ ] **CE3: Move DVL, Recovery, and All Excel Output into C#**
- [ ] **CE4: Unify Rule Editor Processing with Core**
- [ ] **CE5: Delete Duplicate Engine and Replace Test Burden**
- [ ] **CE6: Accept Desktop-Only Engine and Update Documentation**
