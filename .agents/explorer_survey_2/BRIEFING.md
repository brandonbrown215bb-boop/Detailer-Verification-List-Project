# BRIEFING — 2026-09-02T12:50:45Z

## Mission
Investigate the business logic and dual-engine architecture across C# and TypeScript, cataloging divergence, calculation/parsing duplication, AST evaluation, and browser preview mode decoupling requirements.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Investigation, Synthesis
- Working directory: c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_2
- Original parent: db58321e-5951-480e-859b-164602eb9f30
- Milestone: Survey Phase

## 🔒 Key Constraints
- Read-only investigation — do NOT modify source code or implement fixes.
- Metadata and reports go only inside `.agents/explorer_survey_2/`.
- Produce evidence-backed observations with exact paths and line numbers.

## Current Parent
- Conversation ID: db58321e-5951-480e-859b-164602eb9f30
- Updated: 2026-09-02T12:50:45Z

## Investigation State
- **Explored paths**:
  - `src/backend/AHUVerification.Core/` (Parsers, Services, Models, Bridge, Utils)
  - `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs`
  - `src/backend/AHUVerification.RuleEditor/Bridge/RuleEditorBridgeHandler.cs`
  - `tests/AHUVerification.Tests/`
  - `src/services/` (`xmlParser.ts`, `factRegistry.ts`, `ruleEvaluator.ts`, `desktopBridge.ts`, `excelExporter.ts`, `manualUnitFactory.ts`, `projectStorage.ts`, `rulesCatalog.ts`)
  - `src/ruleEditor/services/astConverter.ts`
  - `src/utils/` (`readiness.ts`, `formatters.ts`, `segmentCatalog.ts`)
  - `src/App.tsx`
- **Key findings**:
  1. Full mapping of C# and TS engines complete.
  2. Identified specific divergence in XML fallback defaults (`xmlParser.ts` hardcoded fallback dimensions 411x110x194 and weight 31376 vs C# `0`).
  3. Identified `thermalBreak` logic divergence on custom housing styles.
  4. Identified desktop runtime execution path disconnect (desktop UI calls TS DOMParser at runtime rather than C# parser).
  5. Identified deliverable generation divergence (C# OpenXML on `template.xlsx` vs TS SheetJS `aoa_to_sheet`).
  6. Detailed clean decoupling strategy between desktop host and browser preview mode.
- **Unexplored areas**: None within the survey scope.

## Key Decisions Made
- Completed survey report in `.agents/explorer_survey_2/handoff.md`.

## Artifact Index
- `.agents/explorer_survey_2/handoff.md` — Final 5-component handoff report
- `.agents/explorer_survey_2/progress.md` — Progress tracker and heartbeat
- `.agents/explorer_survey_2/DISPATCH.md` — Dispatch log
- `.agents/explorer_survey_2/BRIEFING.md` — Agent memory and identity
