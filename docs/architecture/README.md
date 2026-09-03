---
kind: architecture
verified_at_commit: 2f34eff38488
scope:
  - src/**
  - tests/**
  - scripts/**
  - resources/**
---

# Architecture: AHU Detailing Verification Desktop Application

## Purpose

The **AHU Detailing Verification** system is a Windows desktop application (.NET 8 + WebView2) designed for Air Handling Unit (AHU) detailers. It ingests engineering unit configurations (`Config.xml` or `.upz` unit package bundles), maps facts through a 4-state provenance-aware registry, evaluates scoped verification checklists against declarative AST rules, enables detailers to manage Special Quotes (SQs) and component checks, and outputs an official `Detailing Verification List.xlsx` workbook for checkers using OpenXML.

## Boundaries

```mermaid
flowchart TD
    subgraph Ingestion Sources ["Ingestion Sources"]
        UPZ[".upz Archive Bundle<br/>(Config.xml, OrderRev.xml, Manifest.xml)"] --> UNPACK[Native Decompressor<br/>unpack32.exe / ywunpack.dll]
        UNPACK --> XML[Config.xml]
        UNPACK --> ORDER_REV[OrderRev.xml]
        RAW_XML[Standalone Config.xml] --> XML
    end

    subgraph Rule Pack Distribution ["Rule Pack (SharePoint / OneDrive / UNC)"]
        RP[Rule Pack Bundle<br/>• manifest.json<br/>• rules.json (Semantic Keys & AST)<br/>• template_map.json (Physical Cell Map)<br/>• approved_mappings.json (Confirmed Only)<br/>• template.xlsx]
    end

    subgraph Sync & Cache ["Sync Engine & Local Rule Store"]
        SYNC[Atomic Staging & Hash Validator] --> CACHE[(Local Rule Store<br/>Version Pinned / LKG Rollback)]
    end

    RP --> SYNC

    subgraph Data Pipeline
        XML --> PARSER[Relational XML Parser & Schema Validator]
        PARSER --> RAW_MODEL[Layer 1: Normalized XML Graph<br/>Faithful Structural Representation]
        
        RAW_MODEL --> EXTRACTOR[Fact Extractor]
        ORDER_REV --> EXTRACTOR
        CACHE -.->|Approved Mappings Only| EXTRACTOR
        
        EXTRACTOR --> FACT_REG[Layer 2: Provenance-Aware Fact Registry<br/>Known | Derived | Unknown | Overridden]
        
        CACHE --> EVAL[Scoped Rule Evaluator<br/>JSON-AST Predicates]
        FACT_REG --> EVAL
        
        EVAL --> CHECKLIST[Checklist Instance Generator<br/>Applicable | Not Applicable | Needs Input]
    end

    subgraph Project Persistence
        UI[Detailer Desktop UI<br/>Specs | SQs | Checklists | Overrides] <--> DVL[(.dvl Project File<br/>Header + Pinned RulePack + Raw Model + Facts + Checklist State)]
        CHECKLIST <--> UI
    end

    subgraph Handoff Deliverable
        UI --> PATCHER[OpenXML Deliverable Patcher<br/>Dynamic Sheet Pruning & Formula Adaptation]
        CACHE -.->|Provides template.xlsx & template_map.json| PATCHER
        PATCHER --> OUT[Detailing Verification List.xlsx<br/>Official Deliverable for Checker]
    end
```

### 1. Rule Pack & Sync Engine
- **Responsibility**: Manages declarative rule definitions (`rules.json`), physical Excel mapping coordinates (`template_map.json`), confirmed code mappings (`approved_mappings.json`), and the official Excel template (`template.xlsx`).
- **Identity**: Every JSON member is hashed as UTF-8 with LF-normalized line endings, `template.xlsx` is hashed by exact bytes, and `bundleSha256` covers the ordered member hashes.
- **Sync**: A complete staged pack is verified before directory promotion, with Last Known Good (LKG) rollback.

### 2. Ingestion & Data Pipeline
- **Package Decompression (`UpzBundleExtractor`)**: When provided a `.upz` bundle, the host invokes the bundled `unpack32.exe` / `ywunpack.dll` in an isolated temp directory to extract `Config.xml`, `OrderRev.xml`, and `Manifest.xml`.
- **Layer 1: Normalized XML Graph (`NormalizedXmlGraph`)**: Pure, uninterpreted structural graph of `Config.xml` representing the authoritative unit baseline. Captures complete opening schedules (`UnitDoor`, `UnitDamper`, `UnitFloorDrain`), component sub-trees (`FanConfig`, `CoilConfig`, `FilterConfig`, `HeatWheelConfig`), per-face casing details, decimal floor gauges, and upper-deck elevations. Also synthesized cleanly for manual unit configurations without XML.
- **Layer 2: Provenance-Aware Fact Registry (`FactRegistry`)**: Strongly-typed business facts with 4-state status (`Known`, `Derived`, `Unknown`, `ManuallyOverridden`) and confidence flags (`Authoritative`, `RequiresConfirmation`). Features 50+ domain facts across Order & Identity, Baserail & Skid, Housing & Materials, Opening Schedule, Components, and Ratings. Order-level facts (`unit.jobName`, `unit.orderNumber`, `unit.tag`, `unit.productType`) are populated authoritatively from `OrderRev.xml`, while `unit.comNumber` (COM #) remains an explicit manual entry field for detailers.
- **Structural Topology (Tiered vs. Stacked)**: Distinguishes tiered units (`unit.isTiered`, `segment.isTiered`, `segment.tierLevel` $\ge 2$—segments on top of other segments without independent unit bases) from stacked units (`unit.isStacked`, `base.isUpperBase`—unit bases elevated atop lower segments).
- **Scoped Rule Evaluator**: JSON-AST predicate engine evaluating rules across `Unit`, `Skid`, `Segment`, and `Component` scopes to produce `Applicable`, `Not Applicable`, or `Needs Input`.

### 3. Desktop Host & Typed Asynchronous IPC Bridge
- **Responsibility**: C#/.NET 8 hosting Edge WebView2 interface.
- **Typed Asynchronous IPC Bridge**: Main-host actions are `getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `checkRulePackUpdate`, `syncRulePack`, `selectFolderDialog`, and `launchRuleEditor`. XML parsing is currently invoked in the TypeScript frontend; it is not registered in `BridgeHandler`. The Rule Editor has its own bridge: `getAppInfo`, `getRulePack`, `publishRulePack`, `openFileDialog`, and `selectFolderDialog`.
- **Single Source of Truth**: `.dvl` JSON file storing source XML, extracted facts, manual overrides, SQ entries, checklist completion states, full source XML SHA-256, and pinned Rule Pack bundle identity.
- **Save Contract**: First Save chooses a path, later Save reuses it, Save As chooses a new path, and the host replaces files atomically through a sibling temporary file.

### 4. Dynamic OpenXML Deliverable Synthesis
- **Responsibility**: Generates the final `Detailing Verification List.xlsx` workbook using `DocumentFormat.OpenXml` (v3.1.1+).
- **Dynamic Category Pruning**: Inactive category scratchpad sheets (`Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, `MOM`) with zero applicable checks are pruned from the workbook package.
- **Formula Adaptation**: Adapts `Check Information` formula calculation chains (`B8..B15`, `C8..C15`, `B19`, `B20`) replacing pruned category links with numeric `0` to prevent `#REF!` errors, and removes `CalculationChainPart` to force fresh formula evaluation upon opening in Excel.
- **Dynamic Skid Row Generation**: Rebuilds `Verification List` rows $\ge 26$ dynamically with structured shipping skid and general unit section headers containing only applicable checks.

### 5. Desktop Delivery
- **Artifact**: A framework-dependent `win-x64` publish folder containing the desktop host executable, `dist/` (frontend web assets), `resources/rulepack/` (rule pack files), and, for the main host, `resources/bin/` (`unpack32.exe` and `ywunpack.dll`). The target machine needs the .NET 8 runtime and WebView2 Runtime.
- **Runtime Resolution**: Release builds load adjacent packaged assets only. Debug builds may use the repository bundle or a running Vite development server.

### 6. UI Architecture & Productivity Engine
- **Responsibility**: Embedded Vite + TypeScript SPA inside WebView2 container.
- **Theme**: User configurable (System Default, Dark, Light).
- **Navigation**: Skid-centric tabs (`General Unit`, `Skid 1..N`) with real-time completion badges.
- **Fact Resolution**: Inline quick-resolve popovers + global Resolution Center modal.
- **Pre-Flight Export**: Verification audit with jump links and Draft vs Final deliverable modes.
- **Productivity**: Global search (`Ctrl+K`), full keyboard navigation, and dynamic unbounded SQ manager (detailer-managed from MAPICS).

### 7. Rule & Logic Editor Desktop Studio (`RuleEditor.exe`)
- **Responsibility**: Dedicated standalone application for engineering team leads to maintain, edit, and archive verification rules.
- **Visual AST Condition Builder**: No-code visual condition trees with Fact selectors, comparison operators, and compound AND/OR groups.
- **Fact Dictionary Catalog**: Built-in catalog of domain facts across Unit, Skid, Segment, Component, and Opening scopes.
- **Live Test Sandbox**: Real-time simulation of rule logic against live fact tweaks or imported sample XML models.
- **Publishing Engine**: Canonical LF-normalized SHA-256 hash generation and automatic `manifest.json` updating.

## Invariants and Sharp Edges

1. **Excel Deliverable Synthesis**:
   - `DocumentFormat.OpenXml` (v3.1.1+) must be used for deliverable synthesis.
   - Inactive category scratchpad worksheets are pruned when no applicable checks exist; dependent formulas on `Check Information` must be adapted dynamically to eliminate `#REF!` errors.
2. **Strict Skid Weight Semantics**:
   - Do not guess or auto-calculate aggregate skid weight unless explicitly authored or approved.
   - Missing skid weights remain `status: 'Unknown'` and evaluate dependent rules to `Needs Input`.
3. **No Speculative Code Mappings**:
   - Unrecognized equipment vendor/model codes (e.g., `vendorType="DDPG2"`) must never be silently mapped to standard types. They must be recorded with `confidence: 'RequiresConfirmation'`.
4. **Decoupled Rule Keys**:
   - Verification rules reference abstract semantic keys (`BASE_LIFTING_LUG_SUPPORT`), never hardcoded Excel cell addresses (`X29`). `template_map.json` translates semantic keys to cell coordinates at patch time.
5. **Local-First & Offline Resilience**:
   - Application must function 100% offline with pinned local rule packs if remote network shares are unavailable.
6. **Artifact Completeness**:
   - A release is incomplete unless `dist/index.html`, every manifest-declared baseline Rule Pack artifact in `resources/rulepack/`, and native decompression binaries (`unpack32.exe` / `ywunpack.dll` in `resources/bin/`) are present beside the executable in the publish folder.

## Validation

- **OpenXML Deliverable Validation**: Automated unit tests verify dynamic worksheet pruning, formula adaptation, and schema compliance on generated Excel workbooks.
- **Rule Evaluator Verification**: Unit tests against AST evaluation logic across all scope levels.
- **Roundtrip Project Persistence**: Unit tests verify `.dvl` save/load fidelity, full Rule Pack identity, source XML identity, and absolute atomic save behavior.
- **Rule Pack Integrity**: Unit tests reject missing or tampered members and accept JSON line-ending conversion without weakening content hashes.
- **UPZ Decompression**: Automated unit tests verify native extraction of XML artifacts and order metadata parsing.
- **E2E & Accessibility Smoke Suite**: Automated Playwright smoke tests verify WCAG 2.2 AA accessibility compliance (zero serious/critical violations), focus trap management, keyboard shortcuts (`Ctrl+K`, `Escape`), and durable error handling across responsive viewports.
- **Cross-Engine Parity & IPC Bridge Hardening**: Node.js and C# test suites verify strict semantic parity across dual XML parsers, typed message contract validation, and WebView2 IPC isolation.

