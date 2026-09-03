# Dual-Engine Architecture & Business Logic Survey Report

**Author**: Explorer 2  
**Date**: 2026-09-02  
**Workspace**: `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_2`  
**Mission**: Remediate CI/action failures, eliminate dual-engine divergence, and establish authoritative single-path business logic between .NET C# and TypeScript frontend engines.

---

## Executive Summary

The AHU Detailing Verification project maintains two parallel business logic and calculation implementations: a .NET 8 C# engine (`AHUVerification.Core`) and a browser TypeScript engine (`src/services/`). While the C# engine is the authoritative backend for OpenXML deliverable generation and UPZ package decompression, runtime UI interactions and client-side XML ingest currently execute primarily in TypeScript inside WebView2, creating multiple subtle divergence points in XML fallback defaults, thermal break logic, and Excel deliverable fidelity. A clean architectural decoupling is required to establish C# as the single authoritative pipeline while safely preserving browser preview capabilities.

---

# 1. Observation

### 1.1 C# Core Calculation, Parsing, Fact Extraction & Export Engine Map

The C# engine is located in `src/backend/AHUVerification.Core` with host runners in `src/backend/AHUVerification.App` and `src/backend/AHUVerification.RuleEditor`:

| Subsystem | File Path | Line Range | Responsibilities & Core Logic |
|---|---|---|---|
| **Relational XML Parser** | `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs` | 1–740 | Uses `System.Xml.Linq.XDocument` with ordinal case-insensitive matching. Extracts 24+ segment types, `Dimensions`, `UnitOptions`, `RoofOptions`, `CurbOptions`, `TestingOptions`, `UnitBaseList` (with lip height and upper deck detection `by > 15`), `SegmentList` (elevation tiered detection: `Y > defaultBaseH + 10` without base below), component subtrees (`FanConfig`, `CoilConfig`, `FilterConfig`, `HeatWheelConfig`), openings (`UnitDoor`, `UnitDamper`, `UnitFloorDrain`, `UnitDuctOpening`), shipping skids, and motor controls. Missing numerical properties default strictly to `0`. |
| **OrderRev Parser** | `src/backend/AHUVerification.Core/Parsers/OrderRevParser.cs` | 1–62 | Parses `OrderRev.xml` from `.upz` packages, extracting `jobName`, `orderNumber`, `lineNumber`, `productType`, `projectName`, `projectId`, `baseSQOrderNumber`, and `tagList` (`PrimaryTag = TagList[0]`). |
| **Fact Registry Extractor** | `src/backend/AHUVerification.Core/Services/FactExtractor.cs` | 1–816 | Maps `NormalizedXmlGraph` and `OrderRevisionData` into a strongly-typed `Dictionary<string, Fact>` across 6 domain groups (Order & Identity, Baserail & Skid, Housing & Materials, Opening Schedule, Components, Ratings & Options). Implements 4-state provenance (`Known`, `Derived`, `Unknown`, `ManuallyOverridden`) and confidence flags (`Authoritative`, `RequiresConfirmation`). Manages `OverrideFact` (with audit history) and `RevertFact`. |
| **AST Rule Evaluator** | `src/backend/AHUVerification.Core/Services/AstRuleEvaluator.cs` | 1–415 | Evaluates JSON-AST predicate trees against scoped fact contexts. Checks `requiredFacts` for `Unknown` or `RequiresConfirmation` (triggers `NeedsInput`). Implements operators `>=`, `<=`, `>`, `<`, `===`, `!==`, `includes`, `in` (with array and CSV string support), `and` (short-circuiting), `or`. Generates scoped `ChecklistInstance` lists across `Unit` and `Skid` levels with full `FactTrace` provenance. |
| **OpenXML Deliverable Patcher** | `src/backend/AHUVerification.Core/Services/OpenXmlTemplatePatcher.cs` | 1–676 | Uses `DocumentFormat.OpenXml` (v3.1.1+). Opens official `template.xlsx`, dynamically prunes inactive category worksheets (`Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, `MOM`), adapts formulas on `Check Information` (`B8..B15`, `C8..C15`, `B19`, `B20`) replacing pruned references with `0` to prevent `#REF!`, deletes `CalculationChainPart`, dynamically synthesizes `Verification List` rows $\ge 26$ with zebra striping and schema-valid `MergeCells`. |
| **Persistence & Hash Engine** | `src/backend/AHUVerification.Core/Services/DvlProjectManager.cs` | 1–118 | Serializes `.dvl` project bundles, verifies UTF-8 SHA-256 integrity of embedded `Config.xml` and rule pack, executes atomic sibling temp file replace (`.{name}.{guid}.tmp` -> move). |
| **Rule Pack Manager** | `src/backend/AHUVerification.Core/Services/RulePackManager.cs` | 1–250+ | Manages rule pack validation, canonical LF-normalized hashing, remote SharePoint/UNC atomic staging, version pin validation, and Last Known Good (LKG) rollback. |
| **UPZ Native Decompressor** | `src/backend/AHUVerification.Core/Services/UpzBundleExtractor.cs` | 1–150+ | Invokes native `unpack32.exe` / `ywunpack.dll` in temp workspaces to extract `.upz` archives into `Config.xml`, `OrderRev.xml`, and `Manifest.xml`. |

### 1.2 TypeScript Business Logic & Browser Preview Mode Map

The TypeScript implementation is located in `src/services/`, `src/ruleEditor/`, and `src/utils/`:

| Subsystem | File Path | Line Range | Responsibilities & Core Logic |
|---|---|---|---|
| **Frontend XML Parser** | `src/services/xmlParser.ts` | 1–708 | Re-implements `NormalizedXmlParser.cs` using browser `DOMParser`. Extracts identical structural graph. Contains hardcoded fallback constants (`unitWeight = 31376`, `totalStaticPressure = 6.26`, `cabLength = 411`, `cabHeight = 110`, `cabWidth = 194`) when XML nodes are absent. |
| **Frontend Fact Registry** | `src/services/factRegistry.ts` | 1–705 | Re-implements `FactExtractor.cs`. Extracts 50+ domain facts, handles `overrideFact` and `revertFact`. Reads `localStorage.getItem('dvl_detailer_name')` on load. |
| **Frontend AST Rule Evaluator** | `src/services/ruleEvaluator.ts` | 1–297 | Re-implements `AstRuleEvaluator.cs`. Evaluates AST predicates in-browser during live UI state changes. Supports `>=`, `<=`, `>`, `<`, `===`, `!==`, `includes`, `in`, `and`, `or`. |
| **Visual AST Converter** | `src/ruleEditor/services/astConverter.ts` | 1–240 | Bi-directional converter between Visual Condition Trees (`VisualConditionGroup`/`VisualConditionLeaf`) and JSON-AST predicates for `RuleEditor.exe`. |
| **Manual Unit Factory** | `src/services/manualUnitFactory.ts` | 1–847 | Synthesizes a valid `NormalizedXmlGraph`, `FactRegistry`, `Checklists`, and synthetic `Config.xml` markup for manual unit entry workflows without engineering XML. |
| **Browser Excel Exporter** | `src/services/excelExporter.ts` | 1–233 | Generates an `.xlsx` workbook purely in the browser using SheetJS (`xlsx`) and `file-saver`. Produces a unstyled 4-sheet approximation (`Revision List`, `Verification List`, scratchpads, `Check Information`) without `template.xlsx` or OpenXML formulas. |
| **Desktop Bridge Protocol** | `src/services/desktopBridge.ts` | 1–269 | Detects `window.chrome.webview`. In desktop mode, delegates IPC messages (`getAppInfo`, `openFileDialog`, `saveDvl`, `exportExcelDeliverable`, `checkRulePackUpdate`, `syncRulePack`, `getRulePack`). In browser mode, routes to client-side fallbacks (`exportToExcel`, `saveDvlToFile`, local storage). |
| **Readiness & Verification Metrics** | `src/utils/readiness.ts` | 1–203 | Deterministic calculation of unconfirmed facts, blocked checks (`NeedsInput`), completed checks, incomplete checks, progress percentage, and `isReadyForFinal` export readiness gate. |

---

# 2. Logic Chain: Dual-Engine Divergence Analysis

```
[Observation: Dual Codebases in C# and TypeScript]
       │
       ├─► 1. XML Ingestion Divergence: C# defaults missing dimensions to 0; TS defaults to 411x110x194 (Config.xml sample values).
       │
       ├─► 2. ThermalBreak Logic Divergence: C# checks `rawStyle.Contains("ThermalBreak") || !rawStyle.Equals("Standard")`; TS checks only `includes('thermalbreak')`.
       │
       ├─► 3. Native vs Browser Execution Flow: Desktop Bridge delegates OpenXML export to C#, but XML parsing in desktop mode runs in TS via DOMParser!
       │
       ├─► 4. Deliverable Quality Divergence: C# uses OpenXML SDK on template.xlsx with dynamic pruning & formula zeroing; TS SheetJS generates raw unstyled workbook.
       │
       └─► 5. Fact Derivation / State: C# initializes `unit.detailer` as Unknown; TS initializes from localStorage if present.
```

### 2.1 Direct Comparison & Divergence Points

#### Point 1: XML Parsing Defaults (Silent Data Injection)
- **C# (`NormalizedXmlParser.cs:64-72`)**:
  ```csharp
  graph.Dimensions = new UnitDimensions {
      Length = GetChildDouble(root, "cabLength", 0),
      Height = GetChildDouble(root, "cabHeight", 0),
      Width = GetChildDouble(root, "cabWidth", 0)
  };
  graph.UnitWeight = GetChildDouble(root, "unitWeight", 0);
  graph.TotalStaticPressure = GetChildDouble(root, "totalStaticPressure", 0);
  ```
- **TypeScript (`src/services/xmlParser.ts:114-118`)**:
  ```typescript
  const unitWeight = getChildNumber(root, 'unitWeight', 31376);
  const totalStaticPressure = getChildNumber(root, 'totalStaticPressure', 6.26);
  const cabLength = getChildNumber(root, 'cabLength', 411);
  const cabHeight = getChildNumber(root, 'cabHeight', 110);
  const cabWidth = getChildNumber(root, 'cabWidth', 194);
  ```
- **Impact**: If an ingested XML file omits `cabLength` or `unitWeight`, C# produces `0` (which flags as invalid/empty in downstream rules), whereas TS injects specific hardcoded sample numbers (`411`, `31376`) from the demo fixture!

#### Point 2: Thermal Break Semantic Evaluation
- **C# (`NormalizedXmlParser.cs:129`)**:
  ```csharp
  graph.UnitOptions.ThermalBreak = rawStyle.Contains("ThermalBreak", StringComparison.OrdinalIgnoreCase) || !rawStyle.Equals("Standard", StringComparison.OrdinalIgnoreCase);
  ```
- **TypeScript (`src/services/xmlParser.ts:142`)**:
  ```typescript
  const thermalBreak = housingStyle.toLowerCase().includes('thermalbreak');
  ```
- **Impact**: For custom housing styles (e.g. `housingStyle = "CustomISG"`), C# sets `ThermalBreak = true` because it is not `"Standard"`, while TypeScript sets `ThermalBreak = false`. This creates divergent checklist applicability outcomes for `HOUS-21`.

#### Point 3: Execution Path Disconnect in Desktop Host
- In `BridgeHandler.cs` (line 146), `openFileDialog` reads raw XML string from disk and passes `content: string` over IPC to the WebView2 frontend.
- In `App.tsx` (line 306), `loadXmlData` parses the XML directly in JavaScript via `parseAhuXml(xmlString)` and extracts facts via `extractFactsFromGraph`.
- **Finding**: In production desktop execution, the C# `NormalizedXmlParser.cs` and `FactExtractor.cs` are **bypassed at runtime**. They only run in backend xUnit tests (`tests/AHUVerification.Tests`). The desktop UI actually relies on the TypeScript implementation of the parser and fact registry.

#### Point 4: Excel Deliverable Synthesis Divergence
- **C# (`OpenXmlTemplatePatcher.cs`)**:
  - Operates on `template.xlsx` (official engineering template with existing macros, print setups, and styles).
  - Prunes unreferenced worksheets (`Base`, `Drain Pan`, `Housing`, etc.) using OpenXML SDK.
  - Dynamically rewrites formulas on `Check Information` (replacing deleted sheet references with `0` and clearing `CalculationChainPart`).
  - Reconstructs dynamic rows $\ge 26$ with exact typography, border styles, and merged cells.
- **TypeScript (`src/services/excelExporter.ts`)**:
  - Uses SheetJS `XLSX.utils.aoa_to_sheet` to build a plain workbook from scratch.
  - Does not use `template.xlsx`, cannot preserve cell styles or OpenXML themes, and creates unlinked summary text instead of live Excel formulas.
- **Impact**: The browser preview export is visually and structurally non-compliant with the official deliverable specification.

---

# 3. Decoupling Requirements for Browser Preview vs Production Native Host

To establish an authoritative single-engine architecture while preserving fast browser preview:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (UI & INTERACTION)                     │
│  React UI • Skid Views • SQs • Inline Overrides • OmniSearch • Preview │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    ┌─────────────────────────┐             ┌─────────────────────────┐
    │     PRODUCTION HOST     │             │     BROWSER PREVIEW     │
    │  (WebView2 / .NET 8)    │             │   (Standalone Dev Mode) │
    ├─────────────────────────┤             ├─────────────────────────┤
    │ • C# Native Ingestion   │             │ • TypeScript Parser     │
    │ • OpenXML Deliverables  │             │ • Mock/Local Rule Pack  │
    │ • UPZ Decompression     │             │ • Watermarked Draft     │
    │ • Atomic Disk Persist   │             │   Preview Export        │
    │ • Live RulePack Sync    │             │ • No Native Bridges     │
    └─────────────────────────┘             └─────────────────────────┘
```

### 3.1 Required Decoupling Steps

1. **Strict Interface Abstraction (`INativeBridge`)**:
   - Refactor `desktopBridge.ts` into a clean interface `INativeBridge` with two concrete implementations:
     - `WebView2DesktopBridge`: Strictly validates message payloads and delegates all ingestion, extraction, and export actions to C#.
     - `BrowserPreviewBridge`: Explicitly mock/preview driver. Returns marked `isDesktopHost: false` metadata and clear user-facing warnings for native-only features.

2. **Align Client Parser & Fact Defaults with C# Authority**:
   - Remove hardcoded constants (`31376`, `6.26`, `411`, `110`, `194`) from `src/services/xmlParser.ts`; default strictly to `0` matching `NormalizedXmlParser.cs`.
   - Align `thermalBreak` calculation in `xmlParser.ts` to match C# `NormalizedXmlParser.cs` logic.
   - Align `unit.detailer` initialization in `FactExtractor.cs` vs `factRegistry.ts`.

3. **Deliverable Export Guardrails**:
   - In Browser Preview mode: Watermark exported workbooks as `[BROWSER PREVIEW DRAFT - NOT FOR PRODUCTION CHECKING]` or present an in-app banner explaining that official OpenXML synthesis requires the Windows desktop host.
   - In Native Desktop mode: Guarantee 100% of Excel deliverable generation routes through `OpenXmlTemplatePatcher.cs`.

4. **Bi-Directional Schema Validation & Contract Parity**:
   - Define formal JSON Schemas or TypeScript interfaces matching C# DTOs (`BridgeModels.cs`) for all IPC messages.
   - Add automated cross-engine parity tests comparing `parseAhuXml` vs `NormalizedXmlParser.Parse` and `generateChecklists` vs `AstRuleEvaluator.GenerateChecklists` across fixture files.

---

# 4. Caveats

- **No modifications made**: This investigation was strictly read-only; no production or test source files were altered.
- **Apprentice COM / Native Binaries**: Native UPZ extraction depends on `unpack32.exe` / `ywunpack.dll` under `resources/bin/`, which only execute in 32/64-bit Windows environments.
- **Rule Editor**: `RuleEditor.exe` has its own bridge handler (`RuleEditorBridgeHandler.cs`) for rule pack authoring and publishing; its condition tree converter (`astConverter.ts`) is well-structured and aligns with the AST schema.

---

# 5. Conclusion

The codebase possesses a solid .NET 8 core engine and an interactive TypeScript frontend, but currently suffers from dual-engine duplication where parsing and fact extraction logic are maintained separately across C# and TypeScript without cross-engine parity tests. In desktop mode, client-side TypeScript parsing is used at runtime, while OpenXML deliverable synthesis is correctly handled by C#. By eliminating hardcoded XML fallback values in TypeScript, aligning predicate evaluation semantics, and structuring `desktopBridge.ts` with explicit host vs preview drivers, the system can achieve full architectural consistency and zero silent divergence.

---

# 6. Verification Method

To independently verify these findings:

1. **Verify C# Core Engine Tests**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release
   ```
2. **Verify Frontend Build & Script Verification Suite**:
   ```powershell
   npm run build
   node scripts/test_ast_converter.mjs
   node scripts/test_readiness.mjs
   node scripts/stress_test_readiness_adversarial.mjs
   ```
3. **Inspect Divergent Files**:
   - Inspect `NormalizedXmlParser.cs` (lines 64–72) vs `src/services/xmlParser.ts` (lines 114–118) for dimension and weight fallback differences.
   - Inspect `NormalizedXmlParser.cs` (line 129) vs `src/services/xmlParser.ts` (line 142) for `thermalBreak` differences.
   - Inspect `OpenXmlTemplatePatcher.cs` vs `src/services/excelExporter.ts` for OpenXML vs SheetJS generation divergence.
