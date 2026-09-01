# BRIEFING — 2026-09-01T00:45:30Z

## Mission
Probe and catalogue exhaustive, granular UI/UX remediation requirements across R1-R5 from `ui-ux-review/`, ADRs, and related docs.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: UI/UX Specification Miner, Teamwork Specialist
- Working directory: c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\spec_miner_survey_1
- Original parent: 52919dba-58f2-4525-8ff2-81599136d595
- Milestone: UI/UX Spec Mining & Catalogue

## 🔒 Key Constraints
- Read-only specification miner: do NOT implement code changes.
- Read `ORIGINAL_REQUEST.md` first.
- Exhaustively probe files in `ui-ux-review/`, review docs, findings, screenshots references, design docs, ADRs in `docs/architecture/`.
- Catalogue requirements for R1 (Readiness Predicate & Fact Sync), R2 (Keyboard Speed & Dialog Focus/ARIA), R3 (File Import/Launch Feedback), R4 (Copy & Typography Cleanup), R5 (Responsive Columns & Contrast Hardening).
- Deliver survey_specs.md and handoff.md, message caller via send_message.

## Current Parent
- Conversation ID: 52919dba-58f2-4525-8ff2-81599136d595
- Updated: 2026-09-01T00:45:30Z

## Task Summary
- **What to build**: Specification catalogue of all UI/UX issues and requirements (R1 to R5).
- **Success criteria**: Exhaustive survey_specs.md and handoff.md referencing all review findings, ADRs, edge cases, and interfaces.
- **Interface contracts**: `docs/architecture/` ADRs, `ui-ux-review/` docs, `ORIGINAL_REQUEST.md`.
- **Code layout**: Documentation outputs in `.agents/spec_miner_survey_1/`.

## Key Decisions Made
- Fully mined and documented requirements across all 5 pillars:
  - R1: Single Readiness Predicate (`computeUnitReadiness`) synchronizing Header, Sidebar, Resolution Center, General Unit Tab, Skid Views, and Preflight.
  - R2: Keyboard speed (`Ctrl+K` synchronous autofocus/select/trap/restore) and accessible `ModalShell` (`role="dialog"`, `aria-modal="true"`, focus trap, background inertness, subtitle auto-wrapping).
  - R3: Ingestion state machine with durable error alerts for `Config.xml`/`.upz` in HomePage, plus bridge-backed Rule Editor launch feedback in Settings.
  - R4: Replacement of `$N \ge 1$`, `StructuralSteel`, leaked internal jargon, and excessive card borders/pills.
  - R5: Auto-collapsing sidebar (<1200px), prioritized description column with expandable row detail drawers, and WCAG 2.2 AA theme contrast hardening.

## Artifact Index
- `.agents/spec_miner_survey_1/survey_specs.md` — Complete Granular Specification Catalogue
- `.agents/spec_miner_survey_1/handoff.md` — 5-Component Handoff Report
- `.agents/spec_miner_survey_1/progress.md` — Progress Tracking
- `.agents/spec_miner_survey_1/DISPATCH.md` — Mission Dispatch Record
