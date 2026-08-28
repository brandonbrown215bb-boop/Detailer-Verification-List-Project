# Handoff Report — Explorer 2 (ADRs 0004–0009 Audit)

**Date**: 2026-08-28T20:04:00Z  
**Agent**: Teamwork Explorer 2 (Documentation & Architecture Auditor)  
**Assigned Scope**: ADRs 0004 through 0009  
**Deliverable Report**: `.agents/teamwork_preview_explorer_g2/analysis.md`  

---

## 1. Observation

1. **Document Identity Reconciliation**:
   - The user request assigned working/draft titles for several ADRs (`0004-wpf-generic-host-mvvm-structure.md`, `0005-air-handling-logic-decomposition.md`, `0006-testing-strategy-and-coverage-matrix.md`, `0007-excel-export-and-reporting-pipeline.md`, `0008-rule-authoring-and-dsl-boundary.md`).
   - Direct filesystem inspection of `docs/decisions/` verified the authoritative filenames on disk:
     - `0004-upz-bundle-ingestion-and-order-metadata-traces.md` (2,765 bytes, 38 lines)
     - `0005-dynamic-openxml-deliverable-synthesis.md` (3,108 bytes, 37 lines)
     - `0006-manual-unit-graph-synthesis.md` (2,115 bytes, 32 lines)
     - `0007-typed-ipc-bridge-protocol.md` (3,278 bytes, 44 lines)
     - `0008-rule-editor-desktop-studio-and-visual-ast-authoring.md` (3,076 bytes, 40 lines)
     - `0009-upz-baseline-fact-extraction-and-predicate-expansion.md` (4,694 bytes, 51 lines)

2. **Framework & Host Observations**:
   - `AHUVerification.App.csproj` (line 21): `<TargetFramework>net8.0-windows</TargetFramework>` and `<UseWindowsForms>true</UseWindowsForms>`.
   - `AHUVerification.Core.csproj` (line 4): `<TargetFramework>net8.0</TargetFramework>`.
   - `AHUVerification.RuleEditor.csproj` (line 13): `<TargetFramework>net8.0-windows</TargetFramework>` with `<AssemblyName>RuleEditor</AssemblyName>`.
   - ADR 0007 (§ Title & § Context) and ADR 0008 (§ Decisions 1) refer to `.NET 10`, which contradicts the active `.NET 8.0` SDK configuration.

3. **Bridge Protocol & Method Catalog Observations**:
   - ADR 0007 § Decisions 2 lists an 11-action catalog containing `parseXml`.
   - `BridgeHandler.cs` (lines 66-80) implements: `getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `checkRulePackUpdate`, `syncRulePack`, `selectFolderDialog`.
   - `parseXml` is NOT implemented in `BridgeHandler.cs`; XML parsing is handled client-side in TypeScript via `xmlParser.ts`.
   - `publishRulePack` is implemented in `RuleEditorBridgeHandler.cs` (lines 61-68).

4. **UPZ Extraction & Fallback Observations**:
   - `UpzBundleExtractor.cs` (lines 43-45) contains a hardcoded developer path: `string devPath = @"C:\Users\jbrow263\source\repos\JCI.MOM.Legacy\SolutionSource\BoundaryUpz";`.
   - `UpzBundleExtractor.cs` (lines 79-88) does not check `process.ExitCode` after `process.WaitForExit(30000)`.
   - `FactExtractor.cs` (line 51) and `factRegistry.ts` (line 41) hardcode fallback Job Name to `"Medical Center Phase 3"` when `OrderRev.xml` is absent.

5. **OpenXML Synthesis Observations**:
   - `OpenXmlTemplatePatcher.cs` (lines 14-16, lines 464-490) maps 20+ rule categories to 8 scratchpad worksheets using `GetCategorySheetName`.
   - `OpenXmlTemplatePatcher.cs` (lines 577, 589, 615) hardcodes numeric OpenXML `StyleIndex` values (`98U`, `70U`, `42U`, etc.) tied directly to `template.xlsx`.
   - Excel file locking during export is unhandled and throws unguided `IOException`.

6. **Manual Unit Synthesis Observations**:
   - `src/services/manualUnitFactory.ts` implements `createManualUnit` and `AVAILABLE_SEGMENT_TEMPLATES` in TypeScript (847 lines).
   - No C# counterpart for `manualUnitFactory` exists in `AHUVerification.Core`.

7. **Rule Pack Publishing Observations**:
   - `RulePackManager.cs` (lines 82-86, 261-265, 333-346) enforces LF (`\n`) normalization, JSON indentation, individual artifact SHA-256 checks, and composite `bundleSha256` hashing over 4 artifacts (`rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`).
   - `RulePackManager.cs` (lines 200-236) implements an atomic 4-stage synchronization pipeline with LKG backup and rollback.

8. **Test Execution Observations**:
   - `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`: 28 passed, 0 failed, 0 skipped in 5s.
   - `node scripts/test_ast_converter.mjs`: 5 tests passed successfully.

---

## 2. Logic Chain

1. **Premise 1**: Documentation must accurately reflect the codebase entry points, target frameworks, and runtime architecture so that fresh AI agents or developers can build and extend the system without failure.
2. **Premise 2**: Referencing `.NET 10` (when `.NET 8.0` is used), citing non-existent bridge actions (`parseXml`), omitting required asset locations (`resources/bin/unpack32.exe`), or omitting critical OpenXML style dependencies causes agents to run incorrect build commands, write failing bridge calls, or generate corrupt spreadsheets.
3. **Premise 3**: Evaluating ADRs 0004 through 0009 across the 5 required dimensions revealed 24 concrete findings:
   - 6 Blockers (Critical)
   - 12 Slowdowns (Moderate)
   - 6 Minors (Low)
4. **Deduction**: All 24 findings are fully supported by verified code lines and test executions. Applying the 1-sentence fix notes to the documentation will completely eliminate ambiguity and align the ADRs with the production system.

---

## 3. Caveats

- **No Source Code Modified**: In accordance with the explorer read-only mandate, no production or documentation files were modified; all findings and remediation notes are recorded in `analysis.md` and this handoff.
- **WPF vs WinForms Scope**: ADRs 0001–0003 were audited by Explorer 1; this report focuses strictly on ADRs 0004–0009.

---

## 4. Conclusion

ADRs 0004 through 0009 provide a strong conceptual foundation for UPZ ingestion, dynamic OpenXML export, manual unit synthesis, IPC bridge protocols, rule authoring, and predicate expansion. However, critical gaps exist regarding runtime framework versions (.NET 8 vs 10), bridge action definitions (`parseXml` vs client-side parsing), OpenXML style index dependencies, canonical LF hashing specifications, and error handling for 32-bit decompressors and file locks.

All 24 categorized findings with one-sentence actionable fixes have been cataloged in `.agents/teamwork_preview_explorer_g2/analysis.md`.

---

## 5. Verification Method

To independently verify all findings and claims:
1. **Run C# Unit Test Suite**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
   ```
2. **Run Node.js AST Converter Test Suite**:
   ```powershell
   node scripts/test_ast_converter.mjs
   ```
3. **Verify Target Frameworks & Host Properties**:
   Inspect `src/backend/AHUVerification.App/AHUVerification.App.csproj` and `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj`.
4. **Verify Bridge Action Implementation**:
   Inspect `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs` (lines 65-80) and `src/services/desktopBridge.ts`.
5. **Inspect Full Analysis Report**:
   Read `.agents/teamwork_preview_explorer_g2/analysis.md`.

