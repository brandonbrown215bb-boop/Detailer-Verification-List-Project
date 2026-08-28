# Project Plan: Repository Documentation Gap & Inaccuracy Audit

## Objective
Audit all 20+ repository documentation files across the codebase to identify missing information, unstated assumptions, ambiguous steps, unguided error scenarios, and outdated/contradictory information from the perspective of an onboarding AI agent. Save the categorized, prioritized catalog to `audits/documentation_gap_audit.md`.

## Scope & Target Documents
1. **Root Documentation**:
   - `README.md`
   - `PROJECT.md`
   - `AGENTS.md`
   - `GEMINI.md`
2. **Architecture & Decisions**:
   - `docs/architecture/README.md`
   - `docs/decisions/README.md`
   - `docs/decisions/0001-ahu-verification-desktop-architecture.md`
   - `docs/decisions/0002-rules-engine-selection.md`
   - `docs/decisions/0003-hybrid-excel-read-strategy.md`
   - `docs/decisions/0004-wpf-generic-host-mvvm-structure.md`
   - `docs/decisions/0005-air-handling-logic-decomposition.md`
   - `docs/decisions/0006-testing-strategy-and-coverage-matrix.md`
   - `docs/decisions/0007-excel-export-and-reporting-pipeline.md`
   - `docs/decisions/0008-rule-authoring-and-dsl-boundary.md`
   - `docs/decisions/0009-upz-baseline-fact-extraction-and-predicate-expansion.md`
3. **Operations & Guides**:
   - `docs/operations/development.md`
   - `docs/operations/validation.md`
   - `docs/rule_and_logic_editor_guide.md`
4. **Historical Audits & Analysis Reports**:
   - `docs/AHU_Verification_E2E_Workflow_Audit.md`
   - `docs/documentation_staleness_report.md`
   - `docs/field_derivation_report.md`
   - `audits/code_duplication_audit.md`
   - `docs/context-manifest.json`

## Audit Dimensions (R1)
1. **Missing Information**: Critical prerequisites, env vars, tools, dependencies, workflows missing.
2. **Unstated Assumptions**: Implicit Windows, .NET 10, Autodesk Apprentice, or UI workflow assumptions.
3. **Ambiguous Steps**: Underspecified instructions or ambiguous definitions.
4. **Unguided Error Scenarios**: Commands/operations with failure risks but no troubleshooting guidance.
5. **Outdated / Contradictory Information**: Sections contradicting current solution, code, or scripts.

## Severity Tiers (R2)
1. **Blocks the Reader** (Critical)
2. **Slows the Reader** (Moderate)
3. **Minor** (Low)

## Finding Schema (R3)
- Finding ID & Title: e.g. `[BLOCKER-01] ...`
- Document & Section Reference: Exact file path and section heading
- Gap Category: One of the 5 dimensions
- Impact Description: Concrete explanation of onboarding impact
- One-Sentence Fix Note: Concise actionable 1-sentence fix instruction

## Execution Phases
1. **Phase 1: Deep Parallel Audit**
   - Dispatch Explorer 1: Root docs & Architecture / ADRs 0001-0003
   - Dispatch Explorer 2: ADRs 0004 through 0009
   - Dispatch Explorer 3: Operations, Guides, Historical Audits & Analysis Reports
2. **Phase 2: Aggregation & Worker Synthesis**
   - Dispatch Worker to write `audits/documentation_gap_audit.md` with full Executive Summary and categorized finding cards.
3. **Phase 3: Multi-Agent Review & Forensic Audit**
   - Dispatch 2 Reviewers, 2 Challengers, and 1 Forensic Auditor (`teamwork_preview_auditor`).
4. **Phase 4: Gate Evaluation & Final Victory Report**
   - Verify all acceptance criteria and report to Sentinel.
