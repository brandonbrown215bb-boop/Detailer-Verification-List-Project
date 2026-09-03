# Handoff Report: Explorer 3 — Frontend Test Pyramid, Typed Bridge Protocol, Test Fixtures & Architecture Ground

**Date**: 2026-09-02  
**Author**: Explorer 3  
**Target Milestone**: Survey & Remediation Planning  

---

## 1. Observation

### 1.1 Frontend Test Pyramid & Quality Gates
1. **Test Runner Framework & Setup**:
   - In `package.json` (lines 10–16), `npm test` runs five custom Node `.mjs` scripts:
     ```json
     "test": "node scripts/test_readiness.mjs && node scripts/test_modal_accessibility.mjs && node scripts/test_ingestion_feedback.mjs && node scripts/test_copy_linter.mjs && node scripts/test_responsive_contrast.mjs"
     ```
   - In `package.json` (devDependencies, lines 24–35), there are no testing libraries (no `@testing-library/react`, `vitest`, `jest`, `jsdom`, `@axe-core/react`, or `playwright`).
   - `scripts/test_ast_converter.mjs` and `scripts/stress_test_readiness_adversarial.mjs` are excluded from `npm test` in `package.json`.
   - In `run-tests.bat` (lines 17–101), scripts are executed sequentially with `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` followed by 7 `.mjs` scripts, but the script numbering comments are inconsistent (`[1/2]`, `[2/3]`, `[3/4]`, `[4/5]`, `[5/7]`, `[6/8]`, `[7/8]`, `[8/8]`).
   - On branch `origin/ci/codex-verification-loop`, Playwright smoke tests were added in `playwright.config.mjs` and `tests/e2e/smoke.spec.mjs`, running via dynamic runner install `npm install --no-save @playwright/test@1.55.0 @axe-core/playwright@4.10.2` in `.github/workflows/codex-verification.yml` (Ubuntu runner only).

2. **Test Implementation Nature vs. Real Rendering**:
   - `scripts/test_readiness.mjs` (lines 1–566) directly imports pure TypeScript logic (`src/utils/readiness.ts`) and tests `computeUnitReadiness`, `computeScopeReadiness`, `resolveFactForScope`, and status/confidence matrices.
   - `scripts/test_ast_converter.mjs` (lines 1–78) directly imports `src/ruleEditor/services/astConverter.ts` and tests 5 conversion round-trips.
   - `scripts/test_copy_linter.mjs` (lines 49–77, 97–109) duplicates formatting logic inside local test helper functions (`testFormatEnumLabel`, `testSanitize`) instead of importing and testing `src/utils/formatters.ts` exports directly.
   - `scripts/test_modal_accessibility.mjs` (lines 55–118, 321–394) simulates focus trap algorithms in pure JS and runs static regex/string searches (`includes('role="dialog"')`, `includes('aria-modal="true"')`) on JSX source files rather than rendering components in a DOM environment.
   - `scripts/test_ingestion_feedback.mjs` (lines 42–104) is purely a static string scanner checking if component files contain text like `role="alert"` and `isProcessing`.
   - `scripts/test_responsive_contrast.mjs` (lines 42–116, 123–159) performs mathematical WCAG luminance calculations and static regex checks on `SkidViewTab.tsx` and `ModalShell.tsx`.
   - **Zero Component Unit Tests**: There are zero test files rendering React components (`ModalShell`, `ResolutionCenterModal`, `PreFlightModal`, `ManualUnitModal`, `GeneralUnitTab`, `SkidViewTab`, `HomePage`, `Header`, `Sidebar`, `SegmentMaterialsTable`, `RuleEditorApp`, `VisualConditionBuilder`, `RuleFormView`, `RuleTestSandbox`).
   - **Zero Unit Tests for Core TypeScript Services**: `src/services/factRegistry.ts`, `src/services/ruleEvaluator.ts`, `src/services/xmlParser.ts`, `src/services/manualUnitFactory.ts`, `src/services/projectStorage.ts`, and `src/services/excelExporter.ts` have no direct unit test suites.

### 1.2 Typed Bridge Protocol & Host Integration
1. **Transport & Catalog Architecture**:
   - In `src/services/desktopBridge.ts` (lines 6–16, 25–72), communication uses `window.chrome.webview.postMessage` and `addEventListener('message')` with 30s timeout rejection.
   - In `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs` (lines 61–77), `BridgeHandler` supports 13 actions:
     `getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `checkRulePackUpdate`, `syncRulePack`, `selectFolderDialog`, and `launchRuleEditor`.
   - In `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs` (lines 61–69), `RuleEditorBridgeHandler` supports 5 actions:
     `getAppInfo`, `getRulePack`, `publishRulePack`, `openFileDialog`, and `selectFolderDialog`.
   - `publishRulePack` is supported in `RuleEditorBridgeHandler.cs` (lines 120–150) but throws `InvalidOperationException("Unknown bridge action: 'publishRulePack'")` if invoked against `BridgeHandler.cs`.
   - `launchRuleEditor` is supported in `BridgeHandler.cs` (lines 391–418) but not in `RuleEditorBridgeHandler.cs`.

2. **Schema Validation & Error Propagation Gaps**:
   - Payloads in `desktopBridge.ts` are typed as `any` without runtime schema validation (e.g. Zod or JSON Schema).
   - In `BridgeHandler.cs` (lines 47–57), `jsonMessage` is deserialized into `BridgeRequest` where `Payload` is an untyped `JsonElement`.
   - When request deserialization fails (lines 53–57), `BridgeResponse` is constructed with `Success = false` and no `Id` (`Id = ""`). Because `desktopBridge.ts` (line 42) matches incoming messages via `response.id`, requests with malformed JSON hang on the frontend until the 30-second timeout.
   - Property extractions on `JsonElement` (e.g., `payload.GetProperty("filePath")`, line 186; `payload.GetProperty("facts")`, line 252) throw uncaught `KeyNotFoundException` if properties are missing, which gets wrapped into a generic error string.
   - UI thread blocking: File dialog actions (`ShowOpenFileDialog`, `ShowSaveFileDialog`, `ShowSelectFolderDialog`, `ExportExcelDeliverable`) invoke modal dialogs via `_parentForm.Invoke(...)`. If user interaction takes longer than 30 seconds, `desktopBridge.ts` rejects with a timeout error, leaving the native modal dialog orphaned.
   - **Zero C# Bridge Tests**: There are zero unit or integration tests for `BridgeHandler.cs`, `RuleEditorBridgeHandler.cs`, or `BridgeModels.cs` under `tests/AHUVerification.Tests/` or anywhere in the repository.

### 1.3 Repository Fixtures & Test Data Boundaries
1. **Fixture Locations**:
   - `tests/fixtures/` **does not exist** in the repository tree.
   - Test data files reside loose in the repository root:
     - `Config.xml` (351,136 bytes): 7,540 lines of AHU configuration XML.
     - `UPZ_Unit_Examples/` (18 `.upz` archives, e.g. `2N-0C0146-01.upz`, `4E-030281-10.upz`, `6E-060036-04.upz`).
     - `Detailing Verification List.xlsx` (71,121 bytes): Template Excel workbook at root.
     - `DVL Issues.xlsx` (72,148 bytes): Issue log workbook at root.
     - `src/fixtures/sampleConfigXml.ts` (contains inlined JS string sample XML).
2. **Proprietary & Real Factory Data**:
   - The 18 `.upz` files in `UPZ_Unit_Examples/` are real York factory production packages containing genuine order numbers (`6E-060036-04`, `5E-520177-03`, etc.) and project metadata inside `OrderRev.xml`.
   - In `src/backend/AHUVerification.Core/Services/UpzBundleExtractor.cs` (line 43), there is a hardcoded machine-specific path:
     ```csharp
     string devPath = @"C:\Users\jbrow263\source\repos\JCI.MOM.Legacy\SolutionSource\BoundaryUpz";
     ```
   - In `tests/AHUVerification.Tests/XmlParserTests.cs` (lines 14, 60, 90) and `UpzExtractorTests.cs` (line 12), tests depend directly on `TestPathHelper.GetRepoPath("Config.xml")` and `TestPathHelper.GetRepoPath("UPZ_Unit_Examples")` at the root.
   - `UpzBundleExtractor.cs` (lines 55–87) relies on `unpack32.exe`, a 32-bit Windows binary, preventing UPZ extraction tests from running natively on Linux runners.

### 1.4 Architecture Documentation Freshness & Drift
1. **`docs/context-manifest.json`**:
   - Currently pinned to `verified_at_commit: "2f34eff3848822cdf599ebae9b3c5b3be1241e09"` across all 23 documents (lines 4–26).
   - The repository HEAD is `3f6e01254f41db4e20eb4970cdb33df8e6ee3062` (2 commits ahead: `b3c683d` and `3f6e012`).
   - Does not scope newly added scripts (`scripts/test_responsive_contrast.mjs`), test suites, or Playwright configurations.
2. **`docs/architecture/README.md`**:
   - §3 (line 80) documents 12 IPC actions and states:
     `Main-host actions are getAppInfo, getRulePack, openFileDialog, saveFileDialog, extractUpz, saveDvl, exportExcelDeliverable, openFile, showInExplorer, checkRulePackUpdate, syncRulePack, and selectFolderDialog. XML parsing is currently invoked in the TypeScript frontend; it is not registered in BridgeHandler.`
   - Omit: `launchRuleEditor` is implemented in `BridgeHandler.cs` (line 75) but omitted from `docs/architecture/README.md`.
   - Dual-engine conflict: Document states XML parsing is solely frontend TypeScript work, conflicting with Requirement R2 to establish a single authoritative core engine in C#.
3. **ADRs (`docs/decisions/`)**:
   - `0007-typed-ipc-bridge-protocol.md`: Lists 12 actions; missing `launchRuleEditor`.
   - `0009-upz-baseline-fact-extraction-and-predicate-expansion.md`: Accurately details the 50+ domain facts and opening/component structures, but does not reflect single-engine consolidation.

---

## 2. Logic Chain

1. **Frontend Test Pyramid**:
   - Observation 1.1 shows that `package.json` and `run-tests.bat` invoke standalone `.mjs` scripts.
   - Observation 1.1 reveals that `test_modal_accessibility.mjs` and `test_ingestion_feedback.mjs` are purely synthetic simulations and regex string checkers against source code files.
   - Observation 1.1 reveals that `test_copy_linter.mjs` duplicates functions locally rather than testing `src/utils/formatters.ts`.
   - Therefore, the current frontend test suite provides false confidence: it verifies that specific strings exist in source files, but does not verify that React components actually mount, render, trap focus, update state, or satisfy accessibility guidelines under real DOM conditions.
   - Bridging this gap requires adding actual component-level rendering tests (e.g. Vitest + Testing Library or Playwright component tests) and directly executing exported utility functions.

2. **Typed Bridge Protocol**:
   - Observation 1.2 shows that `BridgeHandler.cs` has 13 actions and `RuleEditorBridgeHandler.cs` has 5 actions.
   - Observation 1.2 shows that neither backend nor frontend has runtime schema validation, and property retrieval is done via string indexing on `JsonElement`.
   - Observation 1.2 shows that when JSON deserialization fails in C#, the response `Id` is empty, causing frontend promises to hang for 30s.
   - Observation 1.2 shows that there are zero xUnit tests for `BridgeHandler` in `tests/AHUVerification.Tests/`.
   - Therefore, the IPC layer is fragile to schema mismatches, error handling is uncoordinated across the boundary, and there is no regression protection in the CI pipeline.

3. **Repository Fixtures**:
   - Observation 1.3 shows that `tests/fixtures/` does not exist and all test files reside in the root (`Config.xml`, `UPZ_Unit_Examples/`).
   - Observation 1.3 shows that `UPZ_Unit_Examples/` contains 18 production unit packages with real factory order metadata.
   - Observation 1.3 shows that `UpzBundleExtractor.cs` contains a machine-specific path (`C:\Users\jbrow263\...`).
   - Therefore, test data violates isolation boundaries, pollutes the repository root, exposes real factory orders, and introduces environment-specific dependencies.
   - To resolve: create `tests/fixtures/`, move and sanitize/anonymize sample files into `tests/fixtures/`, update `TestPathHelper.cs` and test classes, and remove hardcoded developer paths.

4. **Architecture Documentation & Ground**:
   - Observation 1.4 shows `docs/context-manifest.json` is pinned to commit `2f34eff...` (2 commits behind HEAD).
   - Observation 1.4 shows `docs/architecture/README.md` and ADR-0007 omit `launchRuleEditor` and preserve dual-engine assumptions.
   - Therefore, the ground documentation is slightly drifted and needs a synchronization refresh once remediation is completed.

---

## 3. Caveats

1. **No Source Code Modifications Made**: This investigation was strictly read-only in accordance with the Explorer role.
2. **UPZ Binary Runner Constraint**: `unpack32.exe` is a 32-bit Windows executable. UPZ extraction cannot be executed natively on Linux runners in CI without Wine or a mock decompression strategy.
3. **Playwright CI Scope**: Playwright tests currently exist on `ci/codex-verification-loop` and execute against Ubuntu; local execution requires `@playwright/test` and browsers to be installed.

---

## 4. Conclusion

The repository has strong algorithmic coverage for pure readiness predicate logic (`src/utils/readiness.ts`), AST conversion (`astConverter.ts`), and xUnit Core engine logic, but exhibits four critical structural weaknesses that must be remediated:

1. **Frontend Test Pyramid Illusion**: Component accessibility and ingestion feedback tests are static regex/string matchers rather than rendered DOM component tests. `formatEnumLabel` testing was duplicated rather than testing live exports.
2. **Untyped, Untested Bridge Protocol**: `BridgeHandler` has 0% xUnit test coverage, lacks schema validation, loses request IDs on deserialization errors, and blocks the host thread on modal dialogs.
3. **Un-isolated & Proprietary Fixtures**: No `tests/fixtures/` directory exists; 18 real factory UPZ files and `Config.xml` sit loose in the repository root; `UpzBundleExtractor.cs` contains hardcoded machine paths.
4. **Documentation Drift**: `docs/context-manifest.json` is stale by 2 commits, and ADR-0007 / `docs/architecture/README.md` omit recent bridge actions (`launchRuleEditor`).

---

## 5. Verification Method

### 5.1 Independent Verification Commands
To independently verify the observations above:

1. **Inspect Package & Test Scripts**:
   ```bash
   # Check package.json scripts and devDependencies
   cat package.json
   # Run all current frontend test scripts
   npm test
   node scripts/test_ast_converter.mjs
   node scripts/stress_test_readiness_adversarial.mjs
   ```

2. **Verify Zero Bridge Tests**:
   ```bash
   # Search tests/ for BridgeHandler tests
   rg "BridgeHandler" tests/
   ```

3. **Verify Fixture Locations & Missing tests/fixtures/**:
   ```powershell
   Test-Path "tests/fixtures" # Returns False
   Get-ChildItem "UPZ_Unit_Examples" # Lists 18 UPZ files in root
   ```

4. **Verify Context Manifest Stale Commit**:
   ```powershell
   git rev-parse HEAD # Returns 3f6e01254f41db4e20eb4970cdb33df8e6ee3062
   Get-Content "docs/context-manifest.json" | Select-String "verified_at_commit" # Returns 2f34eff...
   ```

5. **Execute .NET Test Suite**:
   ```bash
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release
   ```
