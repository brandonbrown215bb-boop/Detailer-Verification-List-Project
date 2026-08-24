---
kind: architecture
verified_at_commit: UNCOMMITTED
scope:
  - implementation_plan.md
  - spike/**
  - src/**
---

# Architecture: AHU Detailing Verification Desktop Application

## Purpose

The **AHU Detailing Verification** system is a Windows desktop application (.NET 8 + WebView2) designed for Air Handling Unit (AHU) detailers. It ingests engineering unit configurations (`Config.xml`), maps facts through a 4-state provenance-aware registry, evaluates scoped verification checklists against declarative AST rules, enables detailers to manage Special Quotes (SQs) and component checks, and outputs an official, fully validated `Detailing Verification List.xlsx` workbook for checkers using OpenXML.

## Boundaries

```mermaid
flowchart TD
    subgraph Rule Pack Distribution ["Rule Pack (SharePoint / OneDrive / UNC)"]
        RP[Rule Pack Bundle<br/>• manifest.json<br/>• rules.json (Semantic Keys & AST)<br/>• template_map.json (Physical Cell Map)<br/>• approved_mappings.json (Confirmed Only)<br/>• template.xlsx]
    end

    subgraph Sync & Cache ["Sync Engine & Local Rule Store"]
        SYNC[Atomic Staging & Hash Validator] --> CACHE[(Local Rule Store<br/>Version Pinned / LKG Rollback)]
    end

    RP --> SYNC

    subgraph Data Pipeline
        XML[Config.xml] --> PARSER[Relational XML Parser & Schema Validator]
        PARSER --> RAW_MODEL[Layer 1: Normalized XML Graph<br/>Faithful Structural Representation]
        
        RAW_MODEL --> EXTRACTOR[Fact Extractor]
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
        UI --> PATCHER[OpenXML Template Patcher]
        CACHE -.->|Provides template.xlsx & template_map.json| PATCHER
        PATCHER --> OUT[Detailing Verification List.xlsx<br/>Official Deliverable for Checker]
    end
```

### 1. Rule Pack & Sync Engine
- **Responsibility**: Manages declarative rule definitions (`rules.json`), physical Excel mapping coordinates (`template_map.json`), confirmed code mappings (`approved_mappings.json`), and the official Excel template (`template.xlsx`).
- **Sync**: Atomic background download and hash verification from OneDrive/SharePoint/UNC with Last Known Good (LKG) rollback.

### 2. Data Pipeline
- **Layer 1: Normalized XML Graph (`NormalizedXmlGraph`)**: Pure, uninterpreted structural graph of `Config.xml` (Units, Skids, Bases, Segments, Components/Internals).
- **Layer 2: Provenance-Aware Fact Registry (`FactRegistry`)**: Strongly-typed business facts with 4-state status (`Known`, `Derived`, `Unknown`, `ManuallyOverridden`) and confidence flags (`Authoritative`, `RequiresConfirmation`).
- **Scoped Rule Evaluator**: JSON-AST predicate engine evaluating rules across `Unit`, `Skid`, `Segment`, and `Component` scopes to produce `Applicable`, `Not Applicable`, or `Needs Input`.

### 3. Desktop Application & Persistence (`.dvl`)
- **Responsibility**: C#/.NET 8 hosting Edge WebView2 interface.
- **Single Source of Truth**: `.dvl` JSON file storing source XML, extracted facts, manual overrides, SQ entries, and checklist completion states.

### 4. OpenXML Deliverable Patcher
- **Responsibility**: Generates the final `Detailing Verification List.xlsx` workbook by patching cell values via `DocumentFormat.OpenXml` without altering Excel schemas, data validation dropdowns, or formula recalculation chains.

## Invariants and Sharp Edges

1. **Excel Template Integrity**:
   - `DocumentFormat.OpenXml` (v3.1.1+) must be used for template patching.
   - Must preserve all 12 `DataValidations` elements and all 23 formula chains on `Check Information` (e.g. `='Drain Pan'!F1`).
2. **Strict Skid Weight Semantics**:
   - Do not guess or auto-calculate aggregate skid weight unless explicitly authored or approved.
   - Missing skid weights remain `status: 'Unknown'` and evaluate dependent rules to `Needs Input`.
3. **No Speculative Code Mappings**:
   - Unrecognized equipment vendor/model codes (e.g., `vendorType="DDPG2"`) must never be silently mapped to standard types. They must be recorded with `confidence: 'RequiresConfirmation'`.
4. **Decoupled Rule Keys**:
   - Verification rules reference abstract semantic keys (`BASE_LIFTING_LUG_SUPPORT`), never hardcoded Excel cell addresses (`X29`). `template_map.json` translates semantic keys to cell coordinates at patch time.
5. **Local-First & Offline Resilience**:
   - Application must function 100% offline with pinned local rule packs if remote network shares are unavailable.

## Validation

- **Spike Validation**: Completed OpenXML roundtrip verification against `Detailing Verification List.xlsx` confirming 0 schema errors and intact formulas/validations.
- **Rule Evaluator Verification**: Unit tests against AST evaluation logic across all scope levels.
- **Roundtrip Project Persistence**: Unit tests verifying `.dvl` save/load fidelity.
