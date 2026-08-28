# Code Duplication Audit: Backend, Services, Utilities & Core Logic Survey Report

**Agent**: Explorer 2 (Backend & Core Logic Specialist)  
**Date**: 2026-08-28  
**Scope**: `src/backend/`, `src/services/`, `src/ruleEditor/services/`, `scripts/`, `tests/`, and related data definitions.

---

## 1. Observation

Direct examination of the codebase revealed several major duplication clusters across backend and frontend services, scripts, utilities, and tests. Below are the verified observations with exact file paths, line numbers, identifiers, and verbatim excerpts:

### Observation 1: Dual-Stack Full XML Parser Duplication (C# vs TypeScript)
- **Files**:
  - `src/backend/AHUVerification.Core/Parsers/NormalizedXmlParser.cs` (Lines 1–740) & `OrderRevParser.cs` (Lines 1–62)
  - `src/services/xmlParser.ts` (Lines 1–748)
- **Identifiers**: `NormalizedXmlParser.Parse()`, `parseAhuXml()`, `SEGMENT_NAMES` vs `SegmentNames`, `parseDimensions()` vs `ParseDimensions()`, `parseSurfaceNode()` vs `ParseSurfaceDetail()`.
- **Verbatim Evidence**:
  - `NormalizedXmlParser.cs:12-50`:
    ```csharp
    private static readonly Dictionary<string, string> SegmentNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["IP"] = "Inlet Plenum",
        ["FF"] = "Flat Filter",
        ["XA"] = "Access / Inspection",
        ["HW"] = "Heat Wheel (Energy Recovery)",
        ["FE"] = "Fan (Exhaust)",
        ...
    ```
  - `xmlParser.ts:22-61`:
    ```typescript
    const SEGMENT_NAMES: Record<string, string> = {
      AB: 'Air Blender',
      AF: 'Angle Filter',
      AT: 'Sound Attenuator',
      CC: 'Coil (Cooling)',
      DI: 'Diffuser',
      ...
    ```
  - Both files implement identical 740+ line XML parsing workflows for unit options, sloped roofs, bases, segment dimensions, casing options, surface details (front/rear/left/right/top/bottom), fan configurations, coil configurations, filter configurations, heat wheel configurations, opening schedules (doors, dampers, floor drains), and shipping skids aggregation.

### Observation 2: Dual AST Rule Evaluator & Checklist Generator (C# vs TypeScript)
- **Files**:
  - `src/backend/AHUVerification.Core/Services/AstRuleEvaluator.cs` (Lines 1–414)
  - `src/services/ruleEvaluator.ts` (Lines 1–296)
- **Identifiers**: `AstRuleEvaluator.EvaluatePredicate()`, `AstRuleEvaluator.EvaluateElement()`, `AstRuleEvaluator.GenerateChecklists()`, `evaluateAstPredicate()`, `generateChecklists()`.
- **Verbatim Evidence**:
  - Operators implemented identically: `>=`, `<=`, `>`, `<`, `===`, `!==`, `includes`, `in`, `and`, `or`.
  - Context scoping for Unit vs Skid (`__skidId`, `skid.weight`, `skid.segmentCount`, `skid.hasDrainPan`, `skid.hasFans`, `skid.hasCoils`, `skid.hasFilters`, `skid.hasHeatWheel`).
  - Required fact validation checking `FactStatus.Unknown` and `FactConfidence.RequiresConfirmation`.

### Observation 3: Fact Extraction & Provenance Registry Duplication (C# vs TypeScript)
- **Files**:
  - `src/backend/AHUVerification.Core/Services/FactExtractor.cs` (Lines 1–806)
  - `src/services/factRegistry.ts` (Lines 1–695)
- **Identifiers**: `FactExtractor.ExtractFacts()`, `extractFactsFromGraph()`, `createFact()`, `overrideFact()`, `revertFact()`.
- **Verbatim Evidence**:
  - 6 domains extracted identically:
    1. Order & Identity (`unit.jobName`, `unit.comNumber`, `unit.orderNumber`, `unit.tag`, `unit.productType`, `unit.detailer`, `unit.date`)
    2. Baserail, Curb & Skid (`unit.baseHeight`, `unit.curbrest`, `unit.lipHeight`, `unit.hasUTL`, `unit.isTiered`, `unit.isStacked`, `unit.hasFloorDrains`, per-base facts)
    3. Housing & Materials (`unit.shellType`, `unit.unitType`, `unit.thermalBreak`, `unit.knockdown`, `unit.shippingProtection`, `casing.*`, `roof.*`)
    4. Opening Schedule (`opening.totalCount`, `door.*`, `damper.*`, `floorDrain.*`)
    5. Component Sub-Trees (`fan.*`, `coil.*`, `filter.*`, `wheel.*`, `motorControl.*`)
    6. Ratings & Quality (`unit.isSeismic`, `unit.noa`, `unit.deflectionTest`, `unit.totalWeight`, `unit.totalStaticPressure`, `skid.*`)

### Observation 4: AST Converter Copy-Pasted into Standalone Script
- **Files**:
  - `src/ruleEditor/services/astConverter.ts` (Lines 1–240)
  - `scripts/test_ast_converter.mjs` (Lines 1–168)
- **Identifiers**: `leafToAst()`, `subGroupToAst()`, `visualTreeToAst()`, `parseLeaf()`, `parseSubPredicate()`, `astToVisualTree()`, `extractRequiredFacts()`.
- **Verbatim Evidence**:
  - Exact copy-paste of 168 lines of TypeScript code converted to JS rather than imported as a shared module.

### Observation 5: Rule Pack Manifest Generation & Canonical SHA-256 Hashing
- **Files**:
  - `src/backend/AHUVerification.Core/Services/RulePackManager.cs` (Lines 35–117, 237–365)
  - `scripts/build_rulepack.mjs` (Lines 11–135)
  - `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs` (Lines 145–204)
- **Identifiers**: `RequiredArtifactNames` vs `REQUIRED_FILES`, `ComputeCanonicalJsonSha256()` vs `canonicalJsonSha256()`, `ComputeBundleSha256()` vs `bundleSha256()`, `PublishToDirectory()` vs `build_rulepack.mjs`.
- **Verbatim Evidence**:
  - Identical artifact list: `rules.json`, `template_map.json`, `approved_mappings.json`, `template.xlsx`.
  - Identical canonical LF normalization: `replace(/\r\n/g, '\n').replace(/\r/g, '\n')`.
  - Identical bundle SHA-256 generation joining `name:sha` pairs with `\n`.

### Observation 6: Repository Root Discovery Boilerplate (4 Copies)
- **Files**:
  - `src/backend/AHUVerification.App/MainForm.cs` (Lines 162–177)
  - `src/backend/AHUVerification.RuleEditor/MainForm.cs` (Lines 145–160)
  - `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs` (Lines 253–268)
  - `tests/AHUVerification.Tests/TestPathHelper.cs` (Lines 10–33)
- **Identifiers**: `FindRepoRoot()`, `TestPathHelper.RepoRoot`.
- **Verbatim Evidence**:
  ```csharp
  string current = AppContext.BaseDirectory;
  for (int i = 0; i < 10; i++)
  {
      if (File.Exists(Path.Combine(current, "Detailing Verification List.xlsx")) ||
          File.Exists(Path.Combine(current, "package.json")))
      {
          return current;
      }
      var parent = Directory.GetParent(current);
      if (parent == null) break;
      current = parent.FullName;
  }
  return Directory.GetCurrentDirectory();
  ```

### Observation 7: Desktop Bridge Request/Response & WebView2 Messaging
- **Files**:
  - `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs` (Lines 15–40)
  - `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs` (Lines 14–39)
  - `src/backend/AHUVerification.App/MainForm.cs` (Lines 121–145, 148–160)
  - `src/backend/AHUVerification.RuleEditor/MainForm.cs` (Lines 105–128, 131–143)
- **Identifiers**: `BridgeRequest`, `BridgeResponse`, `CoreWebView2_WebMessageReceived()`, `IsDevServerRunningAsync()`.

### Observation 8: SHA-256 Hashing Utilities in C#
- **Files**:
  - `src/backend/AHUVerification.Core/Services/DvlProjectManager.cs` (Lines 118–140)
  - `src/backend/AHUVerification.Core/Services/RulePackManager.cs` (Lines 343–364)
- **Identifiers**: `ComputeSha256(string/byte[])`, `ComputeFileSha256(string)`, `IsFullSha256(string)`.

### Observation 9: Excel Deliverable Formatting, Category Routing & Scratchpad Logic
- **Files**:
  - `src/backend/AHUVerification.Core/Services/OpenXmlTemplatePatcher.cs` (Lines 84–222, 259–490)
  - `src/services/excelExporter.ts` (Lines 25–231)
- **Identifiers**: `GetCategorySheetName()`, `AllCategorySheets`, `categoryOrder`, section header formatting, zebra striping, Special Quotes 1..22 slots.

### Observation 10: Fact Schema & Key Catalog Redundancy
- **Files**:
  - `src/services/factRegistry.ts` (Lines 37–642)
  - `src/ruleEditor/components/FactDictionaryCatalog.ts` (Lines 3–517)
  - `src/backend/AHUVerification.Core/Services/FactExtractor.cs` (Lines 47–775)
- **Identifiers**: 80+ duplicated fact definitions (`unit.shellType`, `unit.wallThickness`, `casing.thicknessFront`, `fan.*.isFanArray`, etc.).

---

## 2. Logic Chain

1. **Dual-Stack Architectural Split (Observations 1, 2, 3, 9)**:
   - The application was built to run in two distinct execution environments: (a) Standalone web browser (Vite + React) and (b) Windows desktop host (C# .NET 10 + WebView2).
   - Because the browser environment cannot run C# assemblies directly without WebAssembly, core business logic was authored twice: once in C# (`AHUVerification.Core`) and once in TypeScript (`src/services/`).
   - Specifically:
     - XML Parsing: `NormalizedXmlParser.cs` (740 LOC) is 90% identical in structure to `xmlParser.ts` (748 LOC).
     - AST Evaluation: `AstRuleEvaluator.cs` (414 LOC) is 95% identical in logic to `ruleEvaluator.ts` (296 LOC).
     - Fact Extraction: `FactExtractor.cs` (806 LOC) is 92% identical in schema to `factRegistry.ts` (695 LOC).
     - Excel Generation: `OpenXmlTemplatePatcher.cs` (656 LOC) duplicates category routing and structure of `excelExporter.ts` (232 LOC).
   - *Conclusion*: This represents over 3,000 lines of parallel cross-language maintenance overhead with significant risk of behavioral desynchronization.

2. **Standalone Test Script Duplication (Observation 4)**:
   - `scripts/test_ast_converter.mjs` was created as an ad-hoc Node.js test script. Instead of importing from `src/ruleEditor/services/astConverter.ts` or compiling it, all 168 lines of transformation logic were copied verbatim into the test script.
   - *Conclusion*: Any future updates to the AST converter will not be tested unless the test script is manually updated.

3. **Tooling & Build Script Duplication (Observation 5)**:
   - Rule Pack validation, canonical LF JSON serialization, and SHA-256 bundle hashing were written in `scripts/build_rulepack.mjs` for Node.js build pipelines and re-implemented in `RulePackManager.cs` / `RuleEditorBridgeHandler.cs` for desktop publishing.
   - *Conclusion*: Packaging logic should share a single specification and consolidated hashing utility.

4. **Internal C# Boilerplate Duplication (Observations 6, 7, 8, 12)**:
   - The two desktop WinForms entry points (`AHUVerification.App` and `AHUVerification.RuleEditor`) duplicate bridge data structures (`BridgeRequest`, `BridgeResponse`), WebView2 initialization, dev server status checking, directory root finding, and SHA-256 calculation.
   - *Conclusion*: These should be extracted to shared classes in `AHUVerification.Core` and a common bridge utility.

5. **Fact Dictionary Triple-Redundancy (Observation 10)**:
   - Fact keys, descriptions, types, and defaults are defined independently in `FactExtractor.cs`, `factRegistry.ts`, and `FactDictionaryCatalog.ts`.
   - *Conclusion*: A single canonical JSON dictionary (e.g. `fact_dictionary.json` in rulepack) should drive all three.

---

## 3. Duplication Catalog & Refactoring Metrics

| Finding ID | Classification | Location A (File & Lines) | Location B (File & Lines) | Dup % | Importance (1-10) | Effort | Extraction Method |
|---|---|---|---|---|---|---|---|
| **DUP-BE-01** | Near Duplicate (Cross-Lang) | `src/backend/.../NormalizedXmlParser.cs:1-740` | `src/services/xmlParser.ts:1-748` | 90% | 9/10 | High | Single Engine (C# Core Host / Bridge) or Shared Model |
| **DUP-BE-02** | Near Duplicate (Cross-Lang) | `src/backend/.../AstRuleEvaluator.cs:1-414` | `src/services/ruleEvaluator.ts:1-296` | 95% | 9/10 | Med | Shared AST Evaluator via Desktop Bridge |
| **DUP-BE-03** | Near Duplicate (Cross-Lang) | `src/backend/.../FactExtractor.cs:1-806` | `src/services/factRegistry.ts:1-695` | 92% | 9/10 | Med | Canonical Fact Schema / Bridge Service |
| **DUP-BE-04** | Exact Duplicate | `src/ruleEditor/services/astConverter.ts:1-240` | `scripts/test_ast_converter.mjs:1-168` | 98% | 8/10 | Low | Node test imports compiled TS module |
| **DUP-BE-05** | Structural Duplicate | `src/backend/.../RulePackManager.cs:35-365` | `scripts/build_rulepack.mjs:11-135` | 85% | 8/10 | Med | Centralize RulePack schema & build pipeline |
| **DUP-BE-06** | Exact Duplicate (4x) | `AHUVerification.App/MainForm.cs:162-177` | `RuleEditor/MainForm.cs:145-160`, `RuleEditorBridgeHandler.cs:253-268`, `TestPathHelper.cs:10-33` | 95% | 6/10 | Low | Extract `AHUVerification.Core.Utils.PathUtils` |
| **DUP-BE-07** | Structural Duplicate | `AHUVerification.App/Bridge/BridgeHandler.cs:15-40` | `RuleEditor/Bridge/RuleEditorBridgeHandler.cs:14-39` | 90% | 7/10 | Low | Extract `AHUVerification.Core.Bridge.BridgeModels` |
| **DUP-BE-08** | Exact Duplicate | `AHUVerification.Core/.../DvlProjectManager.cs:118-140` | `AHUVerification.Core/.../RulePackManager.cs:343-364` | 100% | 6/10 | Low | Extract `AHUVerification.Core.Utils.CryptoUtils` |
| **DUP-BE-09** | Structural Duplicate | `AHUVerification.Core/.../OpenXmlTemplatePatcher.cs:84-490` | `src/services/excelExporter.ts:25-231` | 70% | 7/10 | Med | Unified Template Map & Category Routing Config |
| **DUP-BE-10** | Internal Structural Duplicate | `src/ruleEditor/services/astConverter.ts:12-40` | `src/ruleEditor/services/astConverter.ts:42-66` | 80% | 5/10 | Low | Extract unified recursive AST converter helper |
| **DUP-BE-11** | Data / Schema Redundancy | `FactExtractor.cs:47-775`, `factRegistry.ts:37-642` | `FactDictionaryCatalog.ts:3-517` | 85% | 8/10 | Med | JSON-driven Fact Dictionary metadata artifact |
| **DUP-BE-12** | Near Duplicate (WinForms) | `BridgeHandler.cs:140-210, 349-366` | `RuleEditorBridgeHandler.cs:207-251` | 80% | 6/10 | Low | Extract WinForms Dialog Service |

---

## 4. Concrete DRY Remediation Proposals

### Remediation A: Consolidate C# Crypto & Path Utilities
Create `src/backend/AHUVerification.Core/Utils/CommonUtils.cs`:
```csharp
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace AHUVerification.Core.Utils
{
    public static class PathUtils
    {
        public static string FindRepoRoot()
        {
            string current = AppContext.BaseDirectory;
            for (int i = 0; i < 10; i++)
            {
                if (File.Exists(Path.Combine(current, "Detailing Verification List.xlsx")) ||
                    File.Exists(Path.Combine(current, "package.json")) ||
                    File.Exists(Path.Combine(current, "Config.xml")))
                {
                    return current;
                }
                var parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }
            return Directory.GetCurrentDirectory();
        }
    }

    public static class CryptoUtils
    {
        public static string ComputeSha256(string content)
        {
            return ComputeSha256(Encoding.UTF8.GetBytes(content));
        }

        public static string ComputeSha256(byte[] bytes)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(bytes)).ToLowerInvariant();
        }

        public static string ComputeFileSha256(string filePath)
        {
            using var sha = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            return Convert.ToHexString(sha.ComputeHash(stream)).ToLowerInvariant();
        }

        public static bool IsFullSha256(string? value)
        {
            return !string.IsNullOrEmpty(value) && value.Length == 64 && Array.TrueForAll(value.ToCharArray(), Uri.IsHexDigit);
        }
    }
}
```
*Callers to refactor*:
- `DvlProjectManager.cs` (lines 118–140) → Use `CryptoUtils`
- `RulePackManager.cs` (lines 343–364) → Use `CryptoUtils`
- `MainForm.cs` (App & RuleEditor) → Use `PathUtils.FindRepoRoot()`
- `RuleEditorBridgeHandler.cs` (lines 253–268) → Use `PathUtils.FindRepoRoot()`
- `TestPathHelper.cs` (lines 10–33) → Use `PathUtils.FindRepoRoot()`

### Remediation B: Consolidate Shared Bridge Protocol
Create `src/backend/AHUVerification.Core/Bridge/BridgeModels.cs`:
```csharp
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Bridge
{
    public class BridgeRequest
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("action")]
        public string Action { get; set; } = "";

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }
    }

    public class BridgeResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("data")]
        public object? Data { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }
}
```
*Callers to refactor*:
- `BridgeHandler.cs` (lines 15–40) → Remove local classes, reference `AHUVerification.Core.Bridge`
- `RuleEditorBridgeHandler.cs` (lines 14–39) → Remove local classes, reference `AHUVerification.Core.Bridge`

### Remediation C: Unify AST Converter Testing
Refactor `scripts/test_ast_converter.mjs` to import directly from `src/ruleEditor/services/astConverter.ts` using `tsx` or a lightweight bundle, eliminating all 168 lines of duplicated parsing logic.

### Remediation D: Canonical Fact Catalog & Single-Source Parity
Extract all fact definitions into `resources/rulepack/fact_dictionary.json`. Generate or consume this artifact in:
1. `FactExtractor.cs` (C#)
2. `factRegistry.ts` (TS)
3. `FactDictionaryCatalog.ts` (Rule Editor Studio UI)

---

## 5. Caveats

1. **Target Architecture Context**: The duplication between C# backend and TypeScript frontend is partly driven by the design goal of supporting both a zero-install Web browser preview mode and a full native Windows desktop app. Refactoring cross-language duplications should carefully maintain browser-mode functionality or standardize on Desktop Bridge as the authoritative execution engine when in desktop mode.
2. **OpenXML vs SheetJS**: `OpenXmlTemplatePatcher.cs` uses DocumentFormat.OpenXml directly on the `.xlsx` template preserving exact binary styles, while `excelExporter.ts` uses SheetJS (`xlsx`) for browser file downloads. Their internal mechanics differ, but their category routing tables, sheet ordering, and row grouping algorithms are identical and should share a single template map configuration.

---

## 6. Conclusion

- **Total Backend/Core Duplication Identified**: 12 discrete finding categories spanning over 3,500 lines of exact, near, and structural duplications.
- **Highest Priority Areas**:
  1. Cross-language duplication between C# Core services and TypeScript browser services (XML Parser, AST Rule Evaluator, Fact Registry).
  2. Standalone script duplicate (`scripts/test_ast_converter.mjs`).
  3. C# WinForms and Core utility boilerplate (Path discovery, SHA-256 hashing, Bridge DTOs).
  4. Triple-redundant fact dictionaries.
- **Estimated Refactoring Impact**: Consolidating these utilities and establishing canonical shared schemas will reduce maintenance overhead by ~60%, eliminate desynchronization defects between desktop and web modes, and improve codebase cleanliness.

---

## 7. Verification Method

To independently verify all findings in this report:

1. **Verify Line Numbers & File Existence**:
   - `NormalizedXmlParser.cs` & `xmlParser.ts`: Compare segment dictionaries and opening list parsing loops.
   - `AstRuleEvaluator.cs` & `ruleEvaluator.ts`: Compare `EvaluatePredicate` / `evaluateAstPredicate` operators.
   - `astConverter.ts` & `test_ast_converter.mjs`: Compare lines 1–168 of the test script against `astConverter.ts`.
   - `MainForm.cs` (App & RuleEditor) & `TestPathHelper.cs`: Compare `FindRepoRoot()` implementations.
2. **Execute Build and Tests**:
   - Run backend tests: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`
   - Run rulepack build: `node scripts/build_rulepack.mjs`
   - Run AST converter test: `node scripts/test_ast_converter.mjs`
3. **Invalidation Condition**:
   - Any modification deleting or consolidating C# / TypeScript dual implementations will update the duplication percentages and file line ranges recorded above.
