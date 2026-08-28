# Project: Code Duplication Audit & DRY Remediation

## Architecture
- Dual-Stack Air Handling Unit (AHU) Engineering Verification System:
  - C# .NET 10 Core Engine (`src/backend/AHUVerification.Core/`)
  - Desktop Host Apps (`src/backend/AHUVerification.App/`, `src/backend/AHUVerification.RuleEditor/`)
  - React 18 / TypeScript Frontend SPAs (`src/`, `src/ruleEditor/`)
  - Shared Rule Pack Bundles (`resources/rulepack/`)
  - Automated Test Suites (`tests/AHUVerification.Tests/`)
  - Build & Dev Scripts (`scripts/`, root `.bat` scripts)
- Deliverable: `audits/code_duplication_audit.md` (64 KB, 1,250 LOC)

## Feature Inventory
| # | Feature / Duplication Cluster | Description | Milestone | Source | Status |
|---|-------------------------------|-------------|-----------|--------|--------|
| 1 | Dual-Stack XML Parsers | Cross-lang near-duplicate: `NormalizedXmlParser.cs` (740 LOC) vs `xmlParser.ts` (748 LOC) | M1 | Survey (Exp 1 & 2) | DONE |
| 2 | Dual-Stack Fact Extractors | Cross-lang near-duplicate: `FactExtractor.cs` (806 LOC) vs `factRegistry.ts` (695 LOC) | M1 | Survey (Exp 1 & 2) | DONE |
| 3 | Dual-Stack AST Rule Evaluators | Cross-lang near-duplicate: `AstRuleEvaluator.cs` (414 LOC) vs `ruleEvaluator.ts` (296 LOC) | M1 | Survey (Exp 1 & 2) | DONE |
| 4 | AST Converter Script Duplicate | Exact duplicate: `scripts/test_ast_converter.mjs` (168 LOC) vs `src/ruleEditor/services/astConverter.ts` (240 LOC) | M1 | Survey (Exp 1, 2, 3) | DONE |
| 5 | Rule Pack Hashing & Manifest Build | Structural/algorithmic duplicate: `RulePackManager.cs` vs `build_rulepack.mjs` vs `PublishModal.tsx` | M1 | Survey (Exp 1, 2, 3) | DONE |
| 6 | Desktop Bridge Models & Handlers | Exact duplicate: `BridgeRequest`/`BridgeResponse` in App vs RuleEditor host | M1 | Survey (Exp 1, 2, 3) | DONE |
| 7 | Repo Root Directory Traversal | Exact duplicate (4x): `MainForm.cs` (App & RuleEditor), `RuleEditorBridgeHandler.cs`, `TestPathHelper.cs` | M1 | Survey (Exp 1, 2, 3) | DONE |
| 8 | C# Cryptographic Utilities | Exact duplicate: `DvlProjectManager.cs` vs `RulePackManager.cs` SHA-256 helpers | M1 | Survey (Exp 2) | DONE |
| 9 | Batch Script Environment Checks | Exact duplicate (8x): 24-line 64-bit .NET SDK & Node checks across root `.bat` files | M1 | Survey (Exp 1, 3) | DONE |
| 10 | Desktop App Launcher Scripts | Near duplicate (98%): `launch-app.bat` vs `launch-rule-editor.bat` | M1 | Survey (Exp 1, 3) | DONE |
| 11 | Test Fixture Mock Graph Builders | Exact duplicate (100%): 46-line graph in `FactRegistryTests.cs` vs `OpenXmlPatcherTests.cs` | M1 | Survey (Exp 3) | DONE |
| 12 | Test Pipeline Setup Boilerplate | Structural duplicate (90%): 8-12 line pipeline across 5 C# test classes | M1 | Survey (Exp 3) | DONE |
| 13 | React Modal Shell Boilerplate | Structural duplicate (80%): backdrop, card shell, header across 7 modal dialogs | M1 | Survey (Exp 1, 3) | DONE |
| 14 | Project Identity Sub-Modals | Structural duplicate: `ComNumberModal.tsx` & `DetailerNameModal.tsx` subset of `ProjectIdentityModal.tsx` | M1 | Survey (Exp 1) | DONE |
| 15 | Domain Model & Schema Mirroring | Structural duplicate (100%): 20+ types in `src/types/index.ts` vs `AHUVerification.Core/Models/` | M1 | Survey (Exp 3) | DONE |
| 16 | Fact Dictionaries & Catalogs | Data/Schema redundancy: `FactExtractor.cs`, `factRegistry.ts`, `FactDictionaryCatalog.ts` | M1 | Survey (Exp 1, 2, 3) | DONE |
| 17 | Segment Type & Colors Catalogs | Data redundancy: `SEGMENT_NAMES`, `SegmentNames`, `AVAILABLE_SEGMENT_TEMPLATES`, `SEGMENT_COLORS` | M1 | Survey (Exp 1) | DONE |
| 18 | Excel Category Routing & Sheets | Structural duplicate: `OpenXmlTemplatePatcher.cs` vs `excelExporter.ts` vs `template_map.json` | M1 | Survey (Exp 1, 2) | DONE |
| 19 | Magic Strings & LocalStorage Keys | Data redundancy: fact keys, fallback strings, localStorage keys scattered in 15+ files | M1 | Survey (Exp 1, 3) | DONE |
| 20 | MSBuild Asset Packaging Targets | Structural duplicate (85%): `ValidatePackagedAssets` target in App vs RuleEditor csproj | M1 | Survey (Exp 3) | DONE |
| 21 | Shared Utilities Module Architecture | Consolidated utility design for C# (`AHUVerification.Core.Utils`) and TS (`src/utils/`) | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 22 | Concrete Drop-In DRY Remediation Snippets | Working, production-grade refactoring snippets for all high/med findings | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 23 | Comprehensive Audit Report Deliverable | Complete markdown deliverable in `audits/code_duplication_audit.md` | M2 | ORIGINAL_REQUEST §R3 | DONE |
| 24 | Verification & Integrity Audit Gate | Ground-truth 100% line check, challenge testing, and forensic integrity audit | M3 | ORIGINAL_REQUEST Criteria | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Scope Mapping | Map all directories, components, and duplication hotspots via 3 Explorers | none | DONE |
| M1 | Duplication Cataloging & Deep Analysis | Full catalog of all 20 duplication clusters with line ranges, metrics, and extraction methods | M0 | DONE |
| M2 | Utilities Architecture & Report Generation | Author complete `audits/code_duplication_audit.md` with drop-in snippets & utilities design | M1 | DONE |
| M3 | Review, Challenge & Forensic Gate | Independent review (100% ground truth), adversarial challenge, and forensic audit | M2 | DONE |

## Code Layout
- Repository Root: `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project`
- Deliverable: `audits/code_duplication_audit.md`
- Core C# Backend: `src/backend/AHUVerification.Core/`
- WinForms Desktop Apps: `src/backend/AHUVerification.App/`, `src/backend/AHUVerification.RuleEditor/`
- React Frontends: `src/`, `src/components/`, `src/ruleEditor/`
- Frontend Services: `src/services/`
- Unit Tests: `tests/AHUVerification.Tests/`
- Build Scripts: `scripts/`, `*.bat`
- Agent Working Directories: `.agents/<agent_name>/`
