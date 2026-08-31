# Project: AHU Detailing Verification System

Windows desktop tooling for AHU detailers and engineering leads. It reads `Config.xml` and desktop-extracted `.upz` bundles, derives provenance-aware facts, evaluates JSON-AST verification rules, and produces the official `Detailing Verification List.xlsx` with OpenXML.

## Architecture

- C#/.NET 8 core (`net8.0`) for parsing, facts, rules, `.dvl` persistence, rule-pack integrity, and OpenXML patching.
- .NET 8 Windows/WebView2 detailer host plus `RuleEditor.exe`.
- React/TypeScript Vite frontend in `src/`, including `src/ruleEditor/`.
- Baseline rule pack in `resources/rulepack/`; native UPZ tools in `resources/bin/`.

## Product Surface

| Area | Responsibility |
| --- | --- |
| Ingestion | Parse XML; desktop extraction of UPZ bundles and order metadata. |
| Rules | Validate the rule-pack manifest and evaluate scope-aware predicates. |
| Detailer workflow | Resolve facts, manage SQs, save `.dvl`, and export workbooks. |
| Rule editor | Author, simulate, version, and publish rule packs. |
| Delivery | Folder-based Windows publish artifacts with frontend, rule-pack, and native assets. |

## Working Boundaries

- The desktop OpenXML path is the official workbook generator; browser exports are preview-only.
- `.dvl` files capture source XML, normalized graph, facts, manual state, and pinned rule-pack identity. Browser autosave is separate from an explicit `.dvl` save.
- Rule-pack changes require `node scripts/build_rulepack.mjs` before integrity tests.
- The active project targets are `net8.0` and `net8.0-windows`. A newer SDK may build them only when its .NET 8 targeting pack is present.

## Code Layout

- `src/backend/AHUVerification.Core/` — domain and delivery engine.
- `src/backend/AHUVerification.App/` — main desktop host and bridge.
- `src/backend/AHUVerification.RuleEditor/` — Rule Editor host and bridge.
- `src/` — frontend, services, and browser fallbacks.
- `tests/AHUVerification.Tests/` — xUnit tests.
- `resources/rulepack/` — baseline rules and Excel template.
- `resources/bin/` — `unpack32.exe` and `ywunpack.dll`.
- `scripts/` and root `.bat` files — build, launch, test, and publish entry points.

## Current Direction

1. Preserve rule-pack, `.dvl`, and release-asset integrity contracts.
2. Keep desktop certification behavior distinct from browser preview behavior.
3. Extend parsing, fact coverage, rule authoring, and workbook synthesis only with source-backed validation.
