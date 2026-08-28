# Plan: Comprehensive Code Duplication Audit

## Objective
Deliver a thorough, 100% verified, and high-impact code duplication audit across the Detailer Verification List application codebase (`src/`, `scripts/`, `tests/`, configuration files, and rules) and generate `audits/code_duplication_audit.md` with categorized findings, importance ratings (1-10), refactoring effort estimates, concrete drop-in DRY remediation snippets, and a proposed shared utilities module architecture.

## Phases & Milestones

### Phase 0: Survey & Scope Mapping (Parallel Explorers)
- Dispatch 3 Explorers in parallel to map the codebase structure, languages (e.g., Python/TypeScript/C#/etc.), module boundaries, tests, scripts, and initial duplication hotspots.
  - Explorer 1: Core application source code (`src/` or equivalent business logic, UI, services, models).
  - Explorer 2: Scripts, automation tools, rules, configs (`scripts/`, config files, rule definitions).
  - Explorer 3: Test suites (`tests/`, unit tests, fixtures, integration test harnesses).
- Synthesize survey findings into `PROJECT.md § Feature Inventory` and refine milestones.

### Phase 1: Deep Duplication Analysis & Extraction Design
- Dispatch Explorers/Workers to perform deep semantic, structural, exact, and data duplication analysis.
- Identify exact file paths, line numbers, symbols, duplication %, importance score, and refactoring effort.
- Formulate concrete drop-in DRY remediation snippets for each finding.
- Design the shared utilities module architecture with exported function signatures and caller migration paths.

### Phase 2: Audit Report Generation
- Dispatch Worker to write the comprehensive report to `audits/code_duplication_audit.md`.
- Ensure all sections meet acceptance criteria:
  - Executive Summary & Duplication Breakdown Tables
  - Detailed Finding Cards (Classification, Paths/Lines, %, Importance 1-10, Effort, Extraction Method, DRY Remediation Snippets)
  - Shared Utilities Module Architecture (`src/utils/` or domain modules)
  - Refactoring Roadmap & Phased Migration Plan

### Phase 3: Review, Verification, Challenge & Forensic Integrity Audit
- Dispatch Reviewers to verify line-by-line file path and line number accuracy (100% ground truth check, zero hallucinations).
- Dispatch Challengers to test/verify remediation snippets and validate that no regressions or semantic drift would occur.
- Dispatch Forensic Auditor for integrity check (no dummy content, genuine analysis, full fidelity).
- Gate check: approve and finalize delivery.
