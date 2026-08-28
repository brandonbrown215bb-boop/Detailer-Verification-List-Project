# Empirical Challenge & Adversarial Review Report: Code Duplication Audit

**Target Deliverable**: `audits/code_duplication_audit.md`  
**Reviewer**: Challenger 1 (Empirical Challenger — Critic & Specialist)  
**Date**: 2026-08-28  
**Verdict**: **APPROVE WITH RECOMMENDATIONS**

---

## 1. Observation

A systematic adversarial review and empirical test execution was conducted across the codebase to evaluate the findings, metrics, and DRY remediation proposals in `audits/code_duplication_audit.md`.

### 1.1 Baseline Test & Build Execution Observations

1. **.NET Backend Unit Test Suite**:
   - Command: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"`
   - Output: Total 28 tests (`Total tests: 28. Passed: 27, Failed: 1`).
   - Failure: `XmlParserTests.Parse_ValidConfigXml_ExtractsCompleteGraph [FAIL]`
     ```text
     Assert.Equal() Failure: Strings differ
                ↓ (pos 0)
     Expected: "ThermalBreak"
     Actual:   "ISG"
                ↑ (pos 0)
     Stack Trace:
       at AHUVerification.Tests.XmlParserTests.Parse_ValidConfigXml_ExtractsCompleteGraph() in tests/AHUVerification.Tests/XmlParserTests.cs:line 33
     ```
   - Report Discrepancy: Section 5.3 (line 1228) states "*Pass Criteria*: 15 passed, 0 failed, 0 skipped." In reality, the test suite contains 28 tests across 6 test fixture classes.

2. **AST Converter Script Execution**:
   - Command: `node scripts/test_ast_converter.mjs`
   - Output: All 5 tests passed successfully in 12ms.

3. **Rule Pack Manifest Build**:
   - Command: `node scripts/build_rulepack.mjs`
   - Output: Rule Pack v14.0.0 built with bundle SHA `9bf21f8fe482fb7e9b6105510a25a1f29bb7d0e28c4da672f797151a159cb217`, 104 rules (99 active, 5 archived).

4. **Frontend Production Build**:
   - Command: `npm run build`
   - Output: `tsc && vite build` completed in 6.59s, generating `dist/index.html` and `dist/rule-editor.html` with 0 TypeScript compilation errors.

---

### 1.2 Direct Codebase & Citation Observations

1. **Dual-Stack XML Parser Divergence (DUP-01)**:
   - In `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs` (lines 127–128):
     ```csharp
     string rawStyle = GetChildText(constOptNode, "housingStyle", "ISG");
     graph.UnitOptions.Materials.HousingStyle = rawStyle.Equals("CAD", StringComparison.OrdinalIgnoreCase) ? "CAD" : "ISG";
     ```
   - In `src/services/xmlParser.ts` (lines 181, 210):
     ```typescript
     const housingStyle = defaultConstNode ? getChildText(defaultConstNode, 'housingStyle', 'ThermalBreak') : 'ThermalBreak';
     // ...
     housingStyle,
     ```
   - *Observation*: In C#, `HousingStyle` is forced to `"ISG"` whenever it is not `"CAD"`, overwriting `"ThermalBreak"`. In TypeScript, `housingStyle` preserves the literal parsed value `"ThermalBreak"`. This empirical test proves that cross-stack divergence has already occurred in production code.

2. **Rule Pack Hashing Citation (DUP-05)**:
   - In `audits/code_duplication_audit.md` (Table 2.2 line 83 and finding DUP-05): `src/ruleEditor/components/PublishModal.tsx:90-240` is cited as a duplicate of rule pack hashing logic.
   - *Observation*: Inspecting `PublishModal.tsx` lines 90–240 reveals it is React UI rendering (summary cards, change diff list, semver buttons, release notes input). The actual hashing is executed in backend C# (`RulePackManager.PublishToDirectory`) via IPC invocation from `desktopBridge.publishRulePack()`.

3. **Bridge DTO Exact Duplication (DUP-06)**:
   - `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs` (lines 15–40) and `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs` (lines 14–39) contain 100% byte-for-byte identical definitions of `BridgeRequest` and `BridgeResponse`.

4. **Batch Script SDK Detection Boilerplate (DUP-09)**:
   - The exact 24-line 64-bit .NET SDK and Node.js PATH discovery block is present in all 8 root `.bat` files (`build-all.bat:10-39`, `build-backend.bat:10-33`, `build-frontend.bat:10-26`, `launch-app.bat:10-33`, `launch-rule-editor.bat:10-33`, `publish-release.bat:10-39`, `run-tests.bat:10-39`, `setup.bat:9-39`).

---

## 2. Logic Chain

1. **Dual-Stack Parity & Split-Brain Risk (DUP-01, DUP-02, DUP-03)**:
   - *Premise*: The application supports two runtimes: (a) Windows WinForms WebView2 desktop application with C# .NET 10 backend, and (b) pure web browser preview.
   - *Observation*: `NormalizedXmlParser.cs` and `xmlParser.ts` contain existing divergence (`housingStyle` evaluation difference causing `XmlParserTests` failure).
   - *Inference*: If DRY refactoring implements Desktop Bridge delegation (`parseAhuXmlUnified`) where the desktop app uses C# and browser preview falls back to TypeScript without a shared test vector gate, the desktop and web versions will produce divergent fact derivations and verification outcomes for identical units.
   - *Mitigation Requirement*: Delegation must be accompanied by shared JSON test vector fixtures (`tests/fixtures/xml_parser_vectors.json` and `tests/fixtures/ast_evaluator_vectors.json`) executed continuously in both .NET xUnit and Vitest suites.

2. **Cryptographic Normalization (DUP-08)**:
   - *Premise*: Rule pack validation requires identical SHA-256 hash calculation regardless of host OS or git checkout line-ending configurations (`core.autocrlf`).
   - *Observation*: `RulePackManager.cs:333` and `build_rulepack.mjs:23` normalize text line endings via `.replace(/\r\n/g, '\n').replace(/\r/g, '\n')` before SHA-256 computation. Binary files (`template.xlsx`) and serialized project state (`DvlProjectManager.cs`) hash raw UTF-8/binary streams.
   - *Inference*: Extracting a shared `CryptoUtils.cs` is safe and recommended, provided it explicitly exposes two distinct methods: `ComputeSha256(byte[]/Stream)` for binary/raw data and `ComputeCanonicalTextSha256(string)` for LF-normalized JSON/text artifacts.

3. **AST Converter Test Script (DUP-04)**:
   - *Premise*: Eliminating the 168-line copy-pasted AST converter in `scripts/test_ast_converter.mjs` requires direct execution against `src/ruleEditor/services/astConverter.ts`.
   - *Observation*: Standard Node.js (`node`) does not natively import TypeScript files without a loader or compiler. `package.json` currently lacks `tsx`.
   - *Inference*: The refactoring must explicitly add `"tsx": "^4.19.2"` to `devDependencies` in `package.json` and configure `"scripts": { "test:ast": "tsx scripts/test_ast_converter.mjs" }`.

4. **Duplication Metrics & Scope Fidelity**:
   - *Observation*: 19 of 20 findings have 100% exact line ranges and file existence matching the real repository. Duplication percentages (ranging from 70% to 100%, averaging 89.3%) accurately reflect the shared AST, DOM parsing, and boilerplate footprints.
   - *Inference*: The audit report is grounded in factual codebase evidence with minimal hallucinations.

---

## 3. Caveats

1. **Native WebView2 UI Automation**: Verification was performed via unit tests, build commands, and script runners. Manual interactability of WinForms native menus was not verified in a headless environment.
2. **Pre-existing Failing Test**: The failure in `XmlParserTests.Parse_ValidConfigXml_ExtractsCompleteGraph` is a pre-existing codebase issue in `NormalizedXmlParser.cs`, not introduced by this audit.

---

## 4. Conclusion & Challenge Verdict

### **Verdict: APPROVE WITH RECOMMENDATIONS**

The `audits/code_duplication_audit.md` report is a comprehensive, highly rigorous, and well-structured architectural deliverable that meets all requirements of `ORIGINAL_REQUEST.md`. The 20 identified duplication clusters and the proposed shared utilities architecture (`AHUVerification.Core.Utils`, `src/utils/`, `ModalShell.tsx`, `init_env.bat`) are sound, low-risk, and high-value.

### Recommended Minor Adjustments for Final Version:
1. **Correct Test Suite Baseline Count**: Update Section 5.3 pass criteria from "15 passed" to "28 tests total (resolving pre-existing `housingStyle` assertion in `NormalizedXmlParser.cs`)".
2. **Correct DUP-05 Location Citation**: Clarify that `PublishModal.tsx` contains publishing UI flow, while SHA-256 hashing is executed via `RulePackManager.cs` and `scripts/build_rulepack.mjs`.
3. **Explicit `tsx` Dependency**: Note in DUP-04 and Section 4.4 that `tsx` must be added to `package.json` `devDependencies` to support direct execution of `astConverter.ts`.
4. **Canonical vs Raw Hashing API**: Ensure `CryptoUtils.cs` provides both `ComputeSha256` (raw) and `ComputeCanonicalTextSha256` (LF-normalized).

---

## 5. Verification Method

To independently verify all claims made in this challenge report:

1. **Run Full C# xUnit Test Suite**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
   ```
   *Expected Result*: 28 tests discovered; observes `XmlParserTests` line 33 failure proving cross-stack `housingStyle` divergence.

2. **Run Node.js AST Converter Test**:
   ```powershell
   node scripts/test_ast_converter.mjs
   ```
   *Expected Result*: 5/5 tests pass in < 20ms.

3. **Run Rule Pack Build Script**:
   ```powershell
   node scripts/build_rulepack.mjs
   ```
   *Expected Result*: Bundle SHA `9bf21f8fe482fb7e9b6105510a25a1f29bb7d0e28c4da672f797151a159cb217` generated.

4. **Run TypeScript Frontend Build**:
   ```powershell
   npm run build
   ```
   *Expected Result*: Builds cleanly with exit code 0.
