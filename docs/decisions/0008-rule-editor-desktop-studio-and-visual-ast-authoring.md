# 8. Standalone Rule & Logic Editor Desktop Studio and Visual AST Authoring

Date: 2026-08-26
Status: Accepted

## Context

Verification checklist rules drive detailer workflows and deliverables based on declarative AST predicate logic (`rules.json`). Previously, modifying, adding, or archiving rules required directly editing large JSON files or translating engineering rules through code, which created friction for non-programmer team leads and risked syntax errors or invalid bundle hashes.

Furthermore, dynamic OpenXML synthesis (ADR 0005) obsoleted fixed Excel cell row mapping, making manual row coordinate authoring unnecessary.

## Decisions

1. **Standalone Desktop Application & Delivery (`RuleEditor.exe`)**:
   - The Rule Editor is delivered as an independent .NET 10 + WebView2 desktop host (`AHUVerification.RuleEditor`) and multi-page web entry (`rule-editor.html`), running independently from the main detailer verification application.
   - It reuses `AHUVerification.Core` for rule pack loading, AST evaluation, XML parsing, and canonical SHA-256 hashing.

2. **Visual No-Code AST Condition Builder**:
   - Predicate logic is authored via a visual condition tree (`ALL (AND)` / `ANY (OR)` blocks) with dropdowns for Fact fields, comparison operators (`=`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `contains`, `is true/false`, `is defined`), and context-aware value inputs.
   - The visual tree bidirectionally synchronizes with AST JSON and automatically derives `requiredFacts`.

3. **Built-in Fact Dictionary**:
   - A curated catalog provides domain facts categorized by scope (`Unit`, `Skid`, `Segment`, `Component`) with data types, units, enum options, and descriptions, eliminating guesswork of XML fact keys.

4. **Interactive Simulation Test Sandbox**:
   - A side-by-side simulation workbench allows team leads to tweak fact inputs live or test against sample unit models to immediately verify whether a rule evaluates to `Applicable`, `Not Applicable`, or `Needs Input`, complete with step-by-step logic traces.

5. **Draft Review, Semantic Versioning, and Publishing Pipeline**:
   - Team leads can author uncommitted draft changes, review a visual diff of added/modified/archived rules, select a semantic version bump (Patch / Minor / Major), and publish.
   - `RulePackManager.PublishToDirectory` generates LF-normalized JSON files, copies `template.xlsx`, calculates canonical UTF-8 SHA-256 hashes, and writes a validated `manifest.json`.

6. **Fully Decoupled from Physical Excel Coordinates**:
   - In accordance with dynamic deliverable synthesis (ADR 0005), rules reference abstract semantic keys only. Manual Excel row assignments are removed from the rule authoring UI.

## Consequences

- Engineering team leads can maintain, audit, and expand verification rules directly through a dedicated visual UI without manual JSON manipulation.
- Rule changes are verified before publishing using the built-in simulation sandbox.
- Published rule packs strictly adhere to canonical SHA-256 integrity checks across all Windows desktop installations.
