# Original User Request

## 2026-08-28T17:07:59Z

Conduct a comprehensive code duplication audit across the entire application codebase and generate a detailed markdown report in `audits/code_duplication_audit.md` containing categorized findings, importance ratings, and concrete drop-in DRY remediation snippets.

Working directory: c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project
Integrity mode: development

## Requirements

### R1. Comprehensive Duplication Identification & Classification
Analyze all source files across the project (including `src/`, `scripts/`, `tests/`, configuration files, and rules) and detect:
- **Exact Duplicates**: Identical copy-pasted blocks and identical functions across files.
- **Near Duplicates**: Equivalent logic with varying variable names or slight algorithmic variations.
- **Structural Duplicates**: Repeated boilerplates, recurring handler/service patterns, and similar workflow structures.
- **Data Duplication**: Repeated constants, magic numbers/strings, schema redundancies, and config duplications.

For every finding identified:
- State exact file paths, line number ranges, and identifiers (do not hallucinate non-existent files or symbols; mark uncertain context as "Unable to verify").
- Calculate the duplication percentage.
- Assign an importance score on a 1–10 scale.
- Estimate refactoring effort (Low / Medium / High).
- Specify the recommended extraction method (function, class, module, or configuration).

### R2. Concrete DRY Remediation & Utilities Module Architecture
For each finding and across the codebase as a whole:
- Provide concrete, minimal, drop-in remediation code snippets showing the refactored DRY implementation.
- Propose a consolidated shared utilities module design (e.g. within `src/utils/` or relevant domain utilities), specifying proposed file organization, exported helper function signatures, and migration guidance for callers.

### R3. Structured Audit Markdown Report Deliverable
Write the full audit report into `audits/code_duplication_audit.md`. The document must be well-structured with an executive summary, categorized duplication breakdown tables, detailed finding cards with code snippets, and a roadmap for refactoring.

## Acceptance Criteria

### Audit Scope & Fidelity
- [ ] Audit covers all primary application source directories (`src/`, `scripts/`, `tests/`).
- [ ] 100% of cited file paths, line ranges, and identifiers correspond to actual files and symbols present in the repository.
- [ ] Any ambiguous or unverified code paths are explicitly labeled as "Unable to verify" with explanation of what code would prove it.

### Finding Completeness
- [ ] Every duplication entry contains: classification type, duplication percentage, importance score (1–10), refactoring effort estimate, and suggested extraction method.
- [ ] Every high and medium priority finding includes a concrete drop-in code fix snippet demonstrating the DRY implementation.

### Deliverable Output
- [ ] The complete report is generated and saved to `audits/code_duplication_audit.md`.
- [ ] A dedicated section details the recommended shared utilities module architecture, including module structure and consolidated helper implementations.

## 2026-08-28T19:59:44Z

Audit all repository documentation for gaps, missing prerequisites, unstated assumptions, ambiguous steps, unguided error scenarios, and outdated or contradictory details from the perspective of an AI agent with a fresh context window.

Working directory: c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project
Integrity mode: development

## Scope & Target Documents

Audit all documentation files across the repository:
1. Root Documentation:
   - `README.md`
   - `PROJECT.md`
   - `AGENTS.md`
   - `GEMINI.md`
2. Architecture & Decisions:
   - `docs/architecture/README.md`
   - `docs/decisions/README.md`
   - `docs/decisions/0001-ahu-verification-desktop-architecture.md` through `0009-upz-baseline-fact-extraction-and-predicate-expansion.md`
3. Operations & Guides:
   - `docs/operations/development.md`
   - `docs/operations/validation.md`
   - `docs/rule_and_logic_editor_guide.md`
4. Historical Audits & Analysis Reports:
   - `docs/AHU_Verification_E2E_Workflow_Audit.md`
   - `docs/documentation_staleness_report.md`
   - `docs/field_derivation_report.md`
   - `audits/code_duplication_audit.md`
   - `docs/context-manifest.json`

## Requirements

### R1. Comprehensive Gap & Inaccuracy Audit Across All Target Documents
Conduct an in-depth audit of every target document from the perspective of a fresh AI agent onboarding to the project with no prior conversation memory. Evaluate the docs across five critical dimensions:
- **Missing Information**: Critical setup prerequisites, environment variables, dependencies, commands, data structures, or workflow steps required to build, test, run, debug, or extend the system effectively.
- **Unstated Assumptions**: Implicit knowledge assumed by the docs that a new agent would not know (e.g., specific OS/architecture dependencies, tool locations, implicit workflow orders).
- **Ambiguous Steps**: Instructions, procedures, or definitions that can be interpreted in multiple ways or lack concrete syntax/examples.
- **Unguided Error Scenarios**: Commands, builds, tests, or workflows prone to failure with zero troubleshooting guidance or recovery steps.
- **Outdated / Contradictory Information**: Sections that contradict current repository code, build batch scripts, solution structure, or standard conventions for the .NET 10 / React / TypeScript / OpenXML stack.

### R2. Prioritized Gap List Deliverable
Do NOT rewrite the documentation. Generate a structured, prioritized gap catalog saved to `audits/documentation_gap_audit.md` categorized strictly into three severity tiers:
1. **Blocks the Reader** (Critical): Gaps, errors, or missing steps that prevent building, running, testing, or correctly understanding core architectural boundaries and deliverables.
2. **Slows the Reader** (Moderate): Ambiguities, implicit assumptions, missing troubleshooting guidance, or incomplete workflow details that require trial-and-error, code diving, or guesswork.
3. **Minor** (Low): Outdated non-critical references, dead links, formatting inconsistencies, or minor documentation omissions that do not impede execution.

### R3. Structured Finding Schema & One-Sentence Fix Notes
Every finding in the gap catalog must follow this structured schema:
- **Finding ID & Title**: Short descriptive identifier (e.g., `[BLOCKER-01] Outdated Project Scope in PROJECT.md`).
- **Document & Section Reference**: Exact file path and section heading (e.g., `PROJECT.md` § Feature Inventory).
- **Gap Category**: One of `Missing Information`, `Unstated Assumption`, `Ambiguous Step`, `Unguided Error Scenario`, `Outdated / Contradictory`.
- **Impact Description**: Concrete explanation of what happens when a fresh AI agent attempts to follow or rely on this section.
- **One-Sentence Fix Note**: A concise, actionable 1-sentence instruction specifying the exact fix needed.

## Acceptance Criteria

### Audit Completeness
- [ ] All 20+ listed markdown documents across root, `docs/`, `docs/decisions/`, `docs/operations/`, and `audits/` are explicitly audited.
- [ ] Every finding is classified into one of the three severity levels (`Blocks the reader`, `Slows the reader`, `Minor`).
- [ ] Every finding addresses at least one of the 5 target categories (missing info, unstated assumptions, ambiguous steps, unguided error scenarios, outdated/contradictory info).
- [ ] Findings cite exact file paths and section headings.
- [ ] Every finding includes a concise 1-sentence fix note without rewriting the original document.

### Deliverable Format & Verification
- [ ] Deliverable is written to `audits/documentation_gap_audit.md`.
- [ ] Includes an Executive Summary with finding counts broken down by severity and document category.
- [ ] Findings are ordered by severity (Blockers first, then Slowdowns, then Minor).

