## 2026-08-28T20:00:12Z
You are the Project Orchestrator for the Detailer-Verification-List-Project repository documentation audit.

Your working directory is: `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\orchestrator`
The original user request is recorded in: `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\ORIGINAL_REQUEST.md`

## Task Overview
Audit all repository documentation for gaps, missing prerequisites, unstated assumptions, ambiguous steps, unguided error scenarios, and outdated or contradictory details from the perspective of an AI agent with a fresh context window.

Target deliverable: `audits/documentation_gap_audit.md`
Do NOT rewrite the original documentation files.

## Target Documents (20+ files)
1. Root Documentation:
   - `README.md`
   - `PROJECT.md`
   - `AGENTS.md`
   - `GEMINI.md`
2. Architecture & Decisions:
   - `docs/architecture/README.md`
   - `docs/decisions/README.md`
   - `docs/decisions/0001-ahu-verification-desktop-architecture.md` through `0009-upz-baseline-fact-extraction-and-predicate-expansion.md` (0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009)
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
Evaluate across 5 critical dimensions:
- Missing Information
- Unstated Assumptions
- Ambiguous Steps
- Unguided Error Scenarios
- Outdated / Contradictory Information

### R2. Prioritized Gap List Deliverable
Save to `audits/documentation_gap_audit.md` categorized strictly into three severity tiers:
1. **Blocks the Reader** (Critical)
2. **Slows the Reader** (Moderate)
3. **Minor** (Low)

### R3. Structured Finding Schema & One-Sentence Fix Notes
Every finding in the gap catalog must follow:
- **Finding ID & Title**: Short descriptive identifier (e.g. `[BLOCKER-01] Outdated Project Scope in PROJECT.md`)
- **Document & Section Reference**: Exact file path and section heading (e.g. `PROJECT.md` § Feature Inventory)
- **Gap Category**: One of `Missing Information`, `Unstated Assumption`, `Ambiguous Step`, `Unguided Error Scenario`, `Outdated / Contradictory`
- **Impact Description**: Concrete explanation of what happens when a fresh AI agent attempts to follow or rely on this section
- **One-Sentence Fix Note**: A concise, actionable 1-sentence instruction specifying the exact fix needed

### Acceptance Criteria
- All 20+ listed markdown documents across root, `docs/`, `docs/decisions/`, `docs/operations/`, and `audits/` are explicitly audited.
- Every finding is classified into one of the three severity levels (`Blocks the reader`, `Slows the reader`, `Minor`).
- Every finding addresses at least one of the 5 target categories.
- Findings cite exact file paths and section headings.
- Every finding includes a concise 1-sentence fix note without rewriting the original document.
- Deliverable is written to `audits/documentation_gap_audit.md`.
- Includes an Executive Summary with finding counts broken down by severity and document category.
- Findings are ordered by severity (Blockers first, then Slowdowns, then Minor).
