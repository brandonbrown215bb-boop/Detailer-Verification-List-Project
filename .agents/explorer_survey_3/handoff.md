# Codebase Duplication Survey Report — Explorer 3
**Focus Areas**: Test Suites, Test Fixtures, Scripts, Configurations, Models & Schemas, UI/CLI Handlers, Constants & Magic Values

---

## 1. Observation

A deep, systematic inspection of `tests/`, `scripts/`, root batch scripts, configuration files, TypeScript and C# models, rule pack definitions, and UI modal components was conducted. The direct observations are cataloged below:

### O1. Exact Duplicate Mock Graph Builder Across C# Test Files
- **Files**:
  - `tests/AHUVerification.Tests/FactRegistryTests.cs`: lines 78–123 (`ExtractFacts_SupportsArbitrarySkidsAndCustomSegmentSequencing`)
  - `tests/AHUVerification.Tests/OpenXmlPatcherTests.cs`: lines 182–227 (`PatchTemplate_SupportsArbitraryMultiSkidUnit`)
- **Observed Code**: An identical 46-line mock `NormalizedXmlGraph` object literal containing 5 shipping skids (`skid-1` through `skid-5`), 9 segments (`seg-1` through `seg-9` with exact tags, names, type codes, and internals), unit dimensions (Length 360, Width 96, Height 108), unit options (`YORKCustom`, `Standard`, 12" base), roof options, and curb options is copy-pasted verbatim between both test files.
- **Duplication Percentage**: 100% identical token sequence.

### O2. Test Setup & Pipeline Execution Boilerplate Duplication Across Test Files
- **Files**:
  - `tests/AHUVerification.Tests/AstEvaluatorTests.cs`: lines 15–28
  - `tests/AHUVerification.Tests/DvlProjectTests.cs`: lines 15–27
  - `tests/AHUVerification.Tests/FactRegistryTests.cs`: lines 14–20
  - `tests/AHUVerification.Tests/OpenXmlPatcherTests.cs`: lines 22–36
  - `tests/AHUVerification.Tests/XmlParserTests.cs`: lines 14–20
- **Observed Code**: Every test repeatedly executes the identical 8–12 line pipeline:
  ```csharp
  string xmlContent = File.ReadAllText(TestPathHelper.GetRepoPath("Config.xml"));
  var parser = new NormalizedXmlParser();
  var graph = parser.Parse(xmlContent);
  var extractor = new FactExtractor();
  var facts = extractor.ExtractFacts(graph);
  var rulePackManager = new RulePackManager();
  var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));
  var evaluator = new AstRuleEvaluator();
  var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);
  ```
- **Duplication Percentage**: 90%–100% identical setup pattern repeated across 5 test classes.

### O3. Exact Logic Duplication Between Node Script and Rule Editor AST Converter
- **Files**:
  - `scripts/test_ast_converter.mjs`: lines 3–168
  - `src/ruleEditor/services/astConverter.ts`: lines 12–239
- **Observed Code**: `test_ast_converter.mjs` is an uncompiled JS copy of the TypeScript AST converter functions: `leafToAst` (lines 3–40 vs ts:68–106), `subGroupToAst` (lines 42–58 vs ts:42–66), `visualTreeToAst` (lines 60–79 vs ts:12–40), `parseLeaf` (lines 81–117 vs ts:168–219), `parseSubPredicate` (lines 119–135 vs ts:146–166), `astToVisualTree` (lines 137–155 vs ts:111–144), and `extractRequiredFacts` (lines 157–168 vs ts:224–239).
- **Duplication Percentage**: 95%+ identical algorithmic logic maintained in two separate files.

### O4. Repetitive 64-bit .NET SDK Detection & Node.js Verification Across 8 Batch Scripts
- **Files**:
  - `build-all.bat`: lines 10–33 (SDK check), lines 34–58 (Node/npm check & build)
  - `build-backend.bat`: lines 10–33 (SDK check)
  - `build-frontend.bat`: lines 10–26 (Node/npm check)
  - `launch-app.bat`: lines 10–33 (SDK check), lines 34–53 (Frontend build check)
  - `launch-rule-editor.bat`: lines 10–33 (SDK check), lines 34–53 (Frontend build check)
  - `publish-release.bat`: lines 10–33 (SDK check), lines 34–58 (Node/npm check)
  - `run-tests.bat`: lines 10–33 (SDK check), lines 34–40 (Node check)
  - `setup.bat`: lines 9–32 (SDK check), lines 34–60 (Node/npm check)
  - `start-dev.bat`: lines 10–28 (Node/npm check)
- **Observed Code**: The identical 24-line 64-bit .NET SDK path resolution (`%ProgramW6432%\dotnet` vs `%ProgramFiles%\dotnet`, `set PATH=!DOTNET_DIR!;!PATH!`, `dotnet --version`) and identical Node/npm availability checks are copy-pasted across all 8 batch files.
- `launch-app.bat` (65 lines) and `launch-rule-editor.bat` (65 lines) are 98% identical copy-pastes differing only in project name and HTML target.
- **Duplication Percentage**: 80%–98% identical script content.

### O5. Dual-Stack Domain Models & Schemas Duplication (TypeScript vs C#)
- **Files**:
  - Enums: `src/types/index.ts` (lines 1–5) vs `src/backend/AHUVerification.Core/Models/Rules.cs` (lines 8–32) and `src/backend/AHUVerification.Core/Models/FactRegistry.cs` (lines 7–21)
  - Fact models: `src/types/index.ts` (lines 9–26) vs `src/backend/AHUVerification.Core/Models/FactRegistry.cs` (lines 23–73)
  - Normalized Graph & Component models: `src/types/index.ts` (lines 28–307) vs `src/backend/AHUVerification.Core/Models/NormalizedGraph.cs` (lines 7–800)
  - Rule & Checklist models: `src/types/index.ts` (lines 323–457) vs `src/backend/AHUVerification.Core/Models/Rules.cs` (lines 34–252)
  - Project file models: `src/types/index.ts` (lines 411–437) vs `src/backend/AHUVerification.Core/Models/DvlProject.cs` (lines 7–78)
  - OrderRevision/Upz models: `src/types/index.ts` (lines 392–409) vs `src/backend/AHUVerification.Core/Models/UpzBundle.cs` (lines 7–38)
- **Observed Code**: Complete structural mirroring of 20+ domain interfaces/classes across TypeScript and C# with manually synchronized property names, types, JSON property naming attributes, and default values.
- **Duplication Percentage**: 100% structural schema duplication.

### O6. Dual-Engine Fact Extraction & AST Evaluation Duplication
- **Files**:
  - Fact Extraction: `src/services/factRegistry.ts` (695 lines) vs `src/backend/AHUVerification.Core/Services/FactExtractor.cs` (806 lines)
  - AST Rule Evaluation: `src/services/ruleEvaluator.ts` (296 lines) vs `src/backend/AHUVerification.Core/Services/AstRuleEvaluator.cs` (414 lines)
- **Observed Code**: The entire fact extraction logic across 6 domains (Order & Identity, Baserail & Skid, Housing & Materials, Opening Schedule, Components, Ratings & Quality) and the AST rule evaluation logic (`>=`, `<=`, `>`, `<`, `===`, `!==`, `includes`, `in`, `and`, `or`, skid context derivation, instance key formatting) are implemented twice — once in TypeScript for browser/dev preview and once in C# for desktop production.
- **Duplication Percentage**: 90%+ algorithmic duplication.

### O7. Rule Pack Packaging & Manifest Hashing Algorithm Duplication
- **Files**:
  - `scripts/build_rulepack.mjs`: lines 11–134
  - `src/backend/AHUVerification.Core/Services/RulePackManager.cs`: lines 36–42, 79–115, 237–365
- **Observed Code**:
  - Required files array: `['rules.json', 'template_map.json', 'approved_mappings.json', 'template.xlsx']`
  - Canonical JSON normalization: `.replace(/\r\n/g, '\n').replace(/\r/g, '\n')`
  - Composite bundle identity string generation: `REQUIRED_FILES.map(name => `${name}:${files[name].sha256}`).join('\n')`
  - SHA-256 computation and manifest JSON formatting.
- **Duplication Percentage**: 85%+ procedural duplication across JavaScript and C#.

### O8. Desktop IPC Bridge Request/Response Contracts & Dialog Handlers Duplication
- **Files**:
  - `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`: lines 15–40, 349–366
  - `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs`: lines 14–39, 234–251
  - Repo root discovery: `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs:253–268` vs `tests/AHUVerification.Tests/TestPathHelper.cs:16–32`
- **Observed Code**:
  - `BridgeRequest` and `BridgeResponse` classes are defined twice with identical JSON properties.
  - `ShowSelectFolderDialog` and `ShowOpenFileDialog` WinForms invocation logic is identical.
  - `FindRepoRoot()` 10-level ancestor directory traversal searching for `Detailing Verification List.xlsx` is identical.
- **Duplication Percentage**: 90%–100% duplicate code blocks.

### O9. MSBuild Project Configurations & Publish Validation Targets Duplication
- **Files**:
  - `src/backend/AHUVerification.App/AHUVerification.App.csproj`: lines 11–47
  - `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj`: lines 11–41
- **Observed Code**: Identical MSBuild `<Content Include="...">` patterns for `dist\**\*` and `resources\rulepack\**\*`, and identical `<Target Name="ValidatePackagedAssets" BeforeTargets="PrepareForPublish">` verifying existence of `manifest.json`, `rules.json`, `template_map.json`, `approved_mappings.json`, and `template.xlsx`.
- **Duplication Percentage**: 85% duplicate XML structure.

### O10. UI Modal Shell Boilerplate & Magic Strings Across React Components
- **Files**:
  - `src/components/ComNumberModal.tsx`: lines 36–60
  - `src/components/DetailerNameModal.tsx`: lines 47–75
  - `src/components/ProjectIdentityModal.tsx`: lines 65–92
  - `src/components/SettingsModal.tsx`: lines 152–176
  - `src/components/PreFlightModal.tsx`: lines 55–90
  - `src/components/ResolutionCenterModal.tsx`: lines 33–60
  - `src/ruleEditor/components/PublishModal.tsx`: lines 61–87
- **Observed Code**: The identical modal backdrop overlay (`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in`), container card shell, header with icon badge, title/subtitle block, and close `X` button structure are copy-pasted across 7 modal components.
- **Magic Strings & Fallback Constants**:
  - Hardcoded fact keys (`"unit.jobName"`, `"unit.comNumber"`, `"unit.orderNumber"`, `"unit.tag"`, `"unit.detailer"`, `"unit.date"`, `"unit.baseHeight"`, `"unit.curbrest"`, `"unit.lipHeight"`, `"unit.hasUTL"`, `"unit.thermalBreak"`, `"unit.isSeismic"`, `"unit.noa"`, etc.) scattered across 15+ UI components without centralized constants.
  - Magic fallback strings (`"Medical Center Phase 3"`, `"COM-000000"`, `"Detailer"`, `"TD"`, `"14.0.0"`, `"AHU Detailing Verification Rule Pack"`) repeated across multiple source files.

---

## 2. Logic Chain

1. **Step 1: Test Suite Isolation vs Shared Fixtures (O1, O2)**
   - In `FactRegistryTests.cs` (lines 78–123) and `OpenXmlPatcherTests.cs` (lines 182–227), both test suites required a multi-skid normalized XML graph. Instead of referencing a shared test fixture helper or factory in `TestPathHelper.cs` (or a dedicated `TestGraphFactory.cs`), developers copy-pasted the 46-line graph instantiation.
   - Similarly, in 5 test classes (O2), every test manually performs the exact 5-stage setup sequence (File.ReadAllText -> NormalizedXmlParser -> FactExtractor -> RulePackManager -> AstRuleEvaluator). Any change in constructor signature or initialization order requires manual edits across all 5 test files.
   - *Inference*: A centralized `TestGraphFactory` and `TestPipelineContext` fixture helper will reduce test suite maintenance burden by over 120 lines and eliminate test divergence.

2. **Step 2: Script Duplication & Standalone Test Runner Workaround (O3, O4, O7)**
   - Because the frontend build uses TypeScript without a standalone Node-compatible test runner (like `vitest`), developers copy-pasted `astConverter.ts` into `scripts/test_ast_converter.mjs` (O3) to enable `node scripts/test_ast_converter.mjs` execution in `run-tests.bat`. If `astConverter.ts` is modified, `test_ast_converter.mjs` becomes out-of-sync unless manually updated.
   - In the root `.bat` files (O4), the 24-line 64-bit .NET SDK detection was copy-pasted across 8 batch files because there was no common `scripts\common_env.bat` or `scripts\init_dotnet.bat`.
   - `launch-app.bat` and `launch-rule-editor.bat` share 98% identical code; maintaining two separate launchers introduces drift risk.
   - *Inference*: Extracting `scripts/init_env.bat` and configuring `vitest` or `tsx` to run TypeScript tests directly against `src/ruleEditor/services/astConverter.ts` completely eliminates `test_ast_converter.mjs` and reduces 150+ lines of duplicate batch script code.

3. **Step 3: Dual-Stack Architecture Redundancy (O5, O6, O7)**
   - The application has two runtime modes: WebView2 desktop app (which executes the C# backend engine via IPC bridge) and Browser Preview (which executes the TypeScript engine in-browser).
   - Consequently, both the TypeScript layer (`src/types/index.ts`, `src/services/factRegistry.ts`, `src/services/ruleEvaluator.ts`) and the C# layer (`AHUVerification.Core/Models/`, `FactExtractor.cs`, `AstRuleEvaluator.cs`, `RulePackManager.cs`) implement duplicate fact extraction, AST rule evaluation, and rule pack verification.
   - *Inference*: While dual-stack duplication is a consequence of supporting pure browser preview alongside desktop C# execution, models can be consolidated via JSON Schema code generation or unified contract interfaces, and shared constants/enums can be extracted to prevent semantic drift.

4. **Step 4: IPC Bridge & MSBuild Structural Duplication (O8, O9)**
   - Both `AHUVerification.App` and `AHUVerification.RuleEditor` define `BridgeRequest` and `BridgeResponse` in separate files, and both implement identical repo root traversal and folder browsing. Moving these shared bridge contracts and helpers into `AHUVerification.Core` (or a shared backend library) eliminates duplicate types and methods.
   - The MSBuild packaging target (`ValidatePackagedAssets`) and Content item groups in `AHUVerification.App.csproj` and `AHUVerification.RuleEditor.csproj` are 85% duplicate and should be centralized into a `Directory.Build.props` or `Directory.Build.targets` file.

5. **Step 5: UI Modal Shell & Magic String Duplication (O10)**
   - All 7 modal dialogs implement identical layout wrappers, backdrop blur, header styling, and close mechanics.
   - A single reusable `<ModalShell title="..." subtitle="..." icon={...} isOpen={...} onClose={...}>` component will reduce 30–50 lines per modal and guarantee visual consistency across the entire UI.
   - Centralizing all fact keys into a typed constant enum/object (`FACT_KEYS`) will prevent typographical bugs and ease fact key renaming.

---

## 3. Caveats

- **Dual-Stack Execution Rationale**: The duplicate implementation of fact extraction and AST evaluation in both TypeScript (`src/services/`) and C# (`AHUVerification.Core/Services/`) is intentional to allow web-only development (`npm run dev`) without running the .NET host. Complete deletion of one engine would disable either browser preview or desktop native OpenXml export; remediation must preserve dual-engine functionality while unifying shared constants, schemas, and test fixtures.
- **OpenXml Template Dependency**: The test suite depends on the physical presence of `Detailing Verification List.xlsx` and `Config.xml` in the repository root. `TestPathHelper` is required across tests to resolve root paths in various build output folders (`bin/Debug/net8.0/`).

---

## 4. Conclusion & Duplication Inventory

### Detailed Findings Catalog Table

| ID | Finding Category | Primary File & Line Range | Duplicate File & Line Range | Duplication % | Importance (1–10) | Effort | Recommended Extraction Method |
|---|---|---|---|:---:|:---:|:---:|---|
| **F-DUP-01** | Exact Duplicate Test Fixture | `tests/AHUVerification.Tests/FactRegistryTests.cs:78-123` | `tests/AHUVerification.Tests/OpenXmlPatcherTests.cs:182-227` | **100%** | **8/10** | Low | Extract `TestGraphFactory.CreateStandardMultiSkidGraph()` in `tests/AHUVerification.Tests/TestPathHelper.cs` |
| **F-DUP-02** | Test Setup Pipeline Boilerplate | `tests/AHUVerification.Tests/AstEvaluatorTests.cs:15-28` | `DvlProjectTests.cs:15-27`, `FactRegistryTests.cs:14-20`, `OpenXmlPatcherTests.cs:22-36`, `XmlParserTests.cs:14-20` | **90%** | **7/10** | Low | Extract `TestPipelineContext.CreateStandardContext()` fixture helper |
| **F-DUP-03** | Exact Code Copy in Test Script | `scripts/test_ast_converter.mjs:3-168` | `src/ruleEditor/services/astConverter.ts:12-239` | **95%** | **9/10** | Medium | Replace `.mjs` copy by configuring `tsx` or `vitest` in `package.json` to test `astConverter.ts` directly |
| **F-DUP-04** | Repetitive .NET & Node SDK Checks in Batch Scripts | `build-all.bat:10-33, 34-58` | `build-backend.bat:10-33`, `build-frontend.bat:10-26`, `launch-app.bat:10-53`, `launch-rule-editor.bat:10-53`, `publish-release.bat:10-58`, `run-tests.bat:10-40`, `setup.bat:9-60`, `start-dev.bat:10-28` | **85%** | **8/10** | Low | Extract shared `scripts/init_env.bat` and invoke via `call "%~dp0scripts\init_env.bat"` |
| **F-DUP-05** | Near-Duplicate Desktop App Launchers | `launch-app.bat:1-65` | `launch-rule-editor.bat:1-65` | **98%** | **6/10** | Low | Parameterize single launcher `scripts/launch.bat <app|rule-editor>` or consolidate into `menu.bat` |
| **F-DUP-06** | Dual-Stack Schema & Model Duplication | `src/types/index.ts:1-458` | `AHUVerification.Core/Models/Rules.cs:8-252`, `FactRegistry.cs:7-73`, `NormalizedGraph.cs:7-800`, `DvlProject.cs:7-78`, `UpzBundle.cs:7-38` | **100%** (structural) | **7/10** | Medium | Establish JSON schema or shared schema mapping contract; align naming conventions |
| **F-DUP-07** | Dual-Engine Fact Extraction & AST Evaluation | `src/services/factRegistry.ts:1-695`, `src/services/ruleEvaluator.ts:1-296` | `AHUVerification.Core/Services/FactExtractor.cs:1-806`, `AHUVerification.Core/Services/AstRuleEvaluator.cs:1-414` | **90%** (domain logic) | **7/10** | High | Share rule AST definitions via `rules.json`; unify fact key constants in `FACT_KEYS` dictionary |
| **F-DUP-08** | Rule Pack Hashing & Manifest Generation | `scripts/build_rulepack.mjs:11-134` | `AHUVerification.Core/Services/RulePackManager.cs:36-42, 79-115, 237-365` | **85%** | **7/10** | Medium | Consolidate rule pack validation into single executable CLI (`dotnet run --project AHUVerification.Core -- --build-rulepack` or single Node script) |
| **F-DUP-09** | Desktop Bridge Request/Response Contracts & Handlers | `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs:15-40, 349-366` | `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs:14-39, 234-268`, `tests/AHUVerification.Tests/TestPathHelper.cs:16-32` | **90%** | **7/10** | Low | Move `BridgeRequest`, `BridgeResponse`, `FindRepoRoot()`, and common WinForms dialogs to `AHUVerification.Core/Bridge/` |
| **F-DUP-10** | MSBuild Asset Packaging & Target Duplication | `src/backend/AHUVerification.App/AHUVerification.App.csproj:11-47` | `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj:11-41` | **85%** | **6/10** | Low | Extract shared MSBuild properties & targets to `Directory.Build.props` / `Directory.Build.targets` |
| **F-DUP-11** | React Modal Shell UI Boilerplate | `src/components/ComNumberModal.tsx:36-60`, `DetailerNameModal.tsx:47-75`, `ProjectIdentityModal.tsx:65-92` | `SettingsModal.tsx:152-176`, `PreFlightModal.tsx:55-90`, `ResolutionCenterModal.tsx:33-60`, `PublishModal.tsx:61-87` | **80%** | **7/10** | Low | Extract reusable `<ModalShell />` component in `src/components/common/ModalShell.tsx` |
| **F-DUP-12** | Hardcoded Fact Keys & Magic Strings | `src/services/factRegistry.ts:37-640`, `src/backend/AHUVerification.Core/Services/FactExtractor.cs:47-775` | 15+ UI modal and tab components (`GeneralUnitTab.tsx`, `Header.tsx`, `ProjectIdentityModal.tsx`, `SettingsModal.tsx`) | **N/A** (Magic Values) | **8/10** | Low | Extract strongly-typed `FACT_KEYS` constants dictionary in `src/types/factKeys.ts` and `AHUVerification.Core/Models/FactKeys.cs` |

---

## 5. Verification Method

To independently verify all findings and test suite integrity:

1. **Verify C# Tests & Duplicate Setup Boilerplate**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
   ```
2. **Verify AST Converter Script Test & Duplicate Implementation**:
   ```powershell
   node scripts/test_ast_converter.mjs
   ```
3. **Verify Rule Pack Manifest Build Script vs Backend Core**:
   ```powershell
   node scripts/build_rulepack.mjs
   ```
4. **Inspect Source Files for Line-by-Line Ground Truth**:
   - Inspect `tests/AHUVerification.Tests/FactRegistryTests.cs:78-123` vs `tests/AHUVerification.Tests/OpenXmlPatcherTests.cs:182-227` to confirm identical 46-line graph builder.
   - Inspect `scripts/test_ast_converter.mjs:3-168` vs `src/ruleEditor/services/astConverter.ts:12-239` to confirm copy-pasted AST parser logic.
   - Inspect `build-all.bat:10-33`, `launch-app.bat:10-33`, `launch-rule-editor.bat:10-33`, and `setup.bat:9-32` to confirm 24-line duplicate SDK detection.
   - Inspect `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs:15-40` vs `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs:14-39` to confirm duplicate `BridgeRequest`/`BridgeResponse` models.
