# Handoff Report — UI/UX Specification Mining (R1 to R5)

**Agent:** UI/UX Spec Miner (`spec_miner_survey_1`)  
**Parent Agent:** `parent` (`52919dba-58f2-4525-8ff2-81599136d595`)  
**Date:** 2026-09-01  
**Handoff Type:** Hard (Task complete)  
**Deliverable File:** `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\spec_miner_survey_1\survey_specs.md`

---

## 1. Observation

Direct observations from review documents and repository source code:

1. **Facts & Readiness False-Success Contradiction**:
   - `src/components/ResolutionCenterModal.tsx:28–30` filters:
     ```ts
     const pendingFacts = Object.values(facts).filter(
       f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
     );
     ```
   - When `pendingFacts.length === 0`, `ResolutionCenterModal.tsx:56` renders `<h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed!</h4>` and says all parameters are authoritative, even when:
     - `Sidebar.tsx:111–116` simultaneously warns `{allNeedsInput} input needed` because checklist rules have `applicability === 'NeedsInput'`.
     - `Sidebar.tsx:268–278` shows per-skid warning badges `{needsInput}`.
     - `PreFlightModal.tsx:52` evaluates `isReadyForFinal = incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0`, blocking final export.
   - Recorded in `ui-ux-review/findings.md` (Issue #1) and `ui-ux-review/screen-notes.md` (Note #08).

2. **Ctrl+K Omni-Search Focus Failure**:
   - `src/components/OmniSearchModal.tsx:28–30` attempts autofocus via `setTimeout(() => inputRef.current?.focus(), 50)`.
   - In WebView2 desktop host, focus remains on the root document. Typing "seismic" produces nothing until the user clicks the input with the mouse (`ui-ux-review/findings.md` Issue #2, `interaction-matrix.md` row 15).
   - No `role="dialog"`, no `aria-modal="true"`, no Tab trapping, and no focus restoration upon close.

3. **Modal Semantics & Accessibility Gaps**:
   - `src/components/common/ModalShell.tsx:48` renders a plain `<div>` without `role="dialog"` or `aria-modal="true"`.
   - `ModalShell.tsx:60` hardcodes `<p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]">{subtitle}</p>`, causing subtitle truncation on wide displays (1426x893).
   - `src/components/ManualUnitModal.tsx` does not use `ModalShell` and has no `Escape` key listener (`ui-ux-review/interaction-matrix.md` row 11).
   - Modals do not contain Tab focus, allowing keyboard users to tab out into background elements.

4. **File Import & Rule Editor Silent Feedback**:
   - In `src/components/HomePage.tsx:43–78` and `src/App.tsx:272–308`, file ingestion uses browser `alert()` upon exception or fails silently with no durable error view when an unsupported or invalid file is selected.
   - In `src/components/SettingsModal.tsx:336–345`, "Open Rule & Logic Editor" is rendered as `<a href="/rule-editor.html" target="_blank">`. In the WebView2 host, `BridgeHandler.cs` has no `launchRuleEditor` action, so clicking produces no outcome or feedback (`findings.md` Top 10 #14, `interaction-matrix.md` row 26).

5. **User Copy & Typography Artifacts**:
   - `src/components/ManualUnitModal.tsx:732` renders `$N \ge 1$` literally in user copy.
   - `src/components/ManualUnitModal.tsx:1224` renders raw enum token `StructuralSteel`.
   - `src/components/ManualUnitModal.tsx:1258–1260` renders internal jargon: *"synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules... and generate compliant OpenXML deliverables."*
   - `src/components/HomePage.tsx:321` renders *"OpenXML 3.1.1 Deliverable Engine • Zero Schema Corruption"*.
   - `src/components/PreFlightModal.tsx:180` renders browser verb *"Download .dvl"*.

6. **Responsive Layout & Theme Contrast**:
   - At 1086px window width with sidebar expanded, project title truncates, rule IDs wrap, and tables force horizontal scroll (`ui-ux-review/findings.md` Issue #5).
   - In Dark mode, `text-slate-500` on `slate-950` has contrast ratio ~4.1:1 (fails WCAG 2.2 AA 4.5:1 requirement).
   - In Light mode, `text-slate-400` on `#ffffff` has contrast ratio 2.3:1 (severe failure).
   - Light mode modal shells render dark container frames (`bg-black/60 dark:bg-black/75`) around light inner content (`screenshots/16-settings-light-theme.jpg`).

---

## 2. Logic Chain

1. **Premise 1**: The application must establish user trust in readiness and completion states.
   - *Observation*: Resolution Center reports "All Facts Confirmed!" while the shell warns that 15 inputs are required.
   - *Inference*: Distinct counts must be surfaced for unconfirmed domain facts, blocked verification rules, and incomplete checklist items, all derived from a single predicate engine (`computeUnitReadiness`).
2. **Premise 2**: Keyboard shortcuts and dialogs must adhere to desktop accessibility and productivity standards.
   - *Observation*: `Ctrl+K` does not focus the input; modals lack dialog roles, focus traps, and subtitle space; `Escape` fails in `ManualUnitModal`.
   - *Inference*: `OmniSearchModal` must synchronously focus/select its input, `ModalShell` must provide WAI-ARIA `role="dialog"`, `aria-modal="true"`, focus trapping via a unified hook, subtitle auto-wrapping, and focus restoration to the invoking element.
3. **Premise 3**: Desktop operations must provide transparent progress and actionable recovery.
   - *Observation*: `Config.xml` import and Rule Editor launch provide no visible loading or error states in the desktop host.
   - *Inference*: An explicit ingestion state machine (`idle`, `loading`, `error`, `success`) and a backend bridge action (`launchRuleEditor`) must be introduced with durable user-facing banners and status toasts.
4. **Premise 4**: Technical jargon and raw code artifacts degrade the professional engineering desktop experience.
   - *Observation*: `$N \ge 1$`, `StructuralSteel`, "normalized XML", "AST rules", and "Download .dvl" are visible to end users.
   - *Inference*: Text must be sanitized to natural English ("at least 1 skid", "Structural Steel", "Save Project (.dvl)", "verification checklist").
5. **Premise 5**: Constrained desktop viewports and diverse lighting conditions require deliberate layout priorities and certified contrast.
   - *Observation*: At 1086px, grids compress the requirement description column; dark/light secondary text fails WCAG 2.2 AA contrast.
   - *Inference*: Auto-collapse sidebar below 1200px, prioritize the rule description column with expandable row drawers for secondary metadata, and harden Tailwind text tokens to meet WCAG 2.2 AA.

---

## 3. Caveats

1. **Licensed UPZ Binaries**: The native licensed UPZ unpacker binary was not available in this test environment; specification accounts for both native desktop bridge and browser fallback paths.
2. **Automated E2E Test Suite**: Full browser/host end-to-end testing with screen readers (NVDA/Narrator) should be conducted in the validation suite milestone to verify UI Automation element exposure.
3. **No Implementation Changes Made**: In accordance with the Specification Miner role, this output is strictly read-only and provides the exhaustive architectural and behavioral specifications for downstream implementation agents.

---

## 4. Conclusion

All UI/UX defects identified in `ui-ux-review/` have been mapped to exhaustive, granular requirements across R1 to R5 in `survey_specs.md`. The design rules, state predicates, keyboard semantics, copy sanitization tables, and contrast token formulas are fully documented and ready for direct implementation and live validation suite construction.

---

## 5. Verification Method

To independently verify the observations and specifications:
1. Inspect `survey_specs.md` at `.agents/spec_miner_survey_1/survey_specs.md`.
2. Verify code references and line numbers in:
   - `src/components/ResolutionCenterModal.tsx` (Line 28, Line 56)
   - `src/components/OmniSearchModal.tsx` (Line 28)
   - `src/components/common/ModalShell.tsx` (Line 48, Line 60)
   - `src/components/HomePage.tsx` (Line 43, Line 321)
   - `src/components/ManualUnitModal.tsx` (Line 732, Line 1224, Line 1258)
   - `src/components/SettingsModal.tsx` (Line 336)
   - `src/components/Sidebar.tsx` (Line 51, Line 111, Line 268)
   - `src/components/Header.tsx` (Line 75, Line 245)
3. Check against test commands:
   - Frontend: `npm run build`
   - Backend: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`
   - Rulepack: `node scripts/build_rulepack.mjs`
