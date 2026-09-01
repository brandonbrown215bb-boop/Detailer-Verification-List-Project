# Implementation Plan — UI/UX Remediation & Live Validation

## Overview
Comprehensive plan to remediate UI/UX issues identified in `ui-ux-review/` and required by `ORIGINAL_REQUEST.md`, maintaining strict adherence to project architectural boundaries and test suites.

## Phase 0: Survey & Scope Mapping
- **Action**: Dispatch 3 parallel survey agents:
  1. `teamwork_preview_spec_miner_survey_1`: Deeply analyze `ui-ux-review/` markdown files, notes, and screenshots/findings to catalogue every concrete issue, UI component, and target behavior for R1-R5.
  2. `teamwork_preview_explorer_survey_2`: Investigate frontend source code (`src/` in web/desktop UI, components, state stores, modals, tables, theme tokens, styling) to locate files, data flows, and current implementation.
  3. `teamwork_preview_explorer_survey_3`: Investigate backend, build scripts, tests (`tests/AHUVerification.Tests/`, `scripts/build_rulepack.mjs`, `package.json`, etc.) to map out verification pipelines and test harness capabilities.
- **Output**: Synthesized `PROJECT.md` containing Feature Inventory, Milestones, Interface Contracts, and Code Layout.

## Phase 1: E2E & Validation Infrastructure Setup (Dual Track)
- Create `TEST_INFRA.md`.
- Establish automated and unit/integration testing checks for UI readiness logic, dialog accessibility, copy cleanup, and file import handlers.

## Phase 2: Milestone Iterations (Explorer -> Worker -> Reviewer -> Challenger -> Auditor)
- **Milestone 1 (R1)**: Single Readiness Predicate & Synchronized Fact Counts across Header, Sidebar, Facts Resolution Center, General Unit Tab, Skid Views, Preflight Modal.
- **Milestone 2 (R2)**: Accessible Dialog Semantics, ModalShell ARIA, Focus Trap/Restore, Subtitle Wrapping, and Instant Ctrl+K OmniSearch Focus/Trap.
- **Milestone 3 (R3)**: Config.xml / .upz Import Loading/Error State Banners, Action Feedback for Settings External Process Launches (Rule Editor).
- **Milestone 4 (R4)**: Clean Typography & Copy, Elimination of LaTeX Artifacts ($N \ge 1$), PascalCase Enum Tokens, Browser Jargon, Nested Border/Pill De-cluttering.
- **Milestone 5 (R5)**: Responsive Column Prioritization, Rule Description Expandable Row Drawers for Metadata, Light/Dark Theme Token Hardening & WCAG 2.2 AA Contrast Compliance.

## Phase 3: Final Verification & Audit Hardening
- Full frontend build verification (`npm run build`).
- Full backend tests (`dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`).
- Rule pack manifest verification (`node scripts/build_rulepack.mjs`).
- Complete adversarial & forensic audit verification.
