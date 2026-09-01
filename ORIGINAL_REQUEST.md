# Original User Request

## Initial Request — 2026-09-01T00:41:15Z

Execute a hardened UI/UX remediation and live validation suite for the AHU Detailing Verification desktop application based on the hands-on findings in `ui-ux-review/`.

Working directory: `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project`

## Requirements

### R1. Reconcile Facts, Shell Warnings, and Readiness into a Single Predicate
- Unify readiness logic across the Header, Sidebar, Facts Resolution Center, General Unit Tab, Skid Views, and Preflight Modal so that "All Facts Confirmed" is never reported when verification checks or facts require input or confirmation.
- Surface distinct, synchronized counts for: unconfirmed domain facts, checks blocked by missing/unconfirmed facts, and completed vs pending verification checks.

### R2. Keyboard Speed & Accessible Dialog Focus Semantics
- Ensure `Ctrl+K` global search immediately focuses and selects the search input, traps `Tab` focus, and restores focus to the invoking element on `Escape` or dismissal.
- Implement standard accessible dialog behavior across all modal surfaces (`ModalShell`, `OmniSearchModal`, `ManualUnitModal`, `SettingsModal`, `PreFlightModal`, `ProjectIdentityModal`, `ComNumberModal`, `DetailerNameModal`): proper ARIA attributes (`role="dialog"`, `aria-modal="true"`, accessible name/description), programmatic focus trapping, backdrop inertness, subtitle wrapping without truncation, and focus restoration upon close.

### R3. File Import, Rule Editor Launch & Action Feedback
- Add explicit loading/progress and durable error states for `Config.xml` and `.upz` file ingestion in `HomePage` and the native file picker workflow, ensuring users receive actionable feedback (filename, error description, next steps) instead of a silent return to Home.
- Surface clear pending/error feedback for external actions in Settings (such as launching the Rule & Logic Editor).

### R4. User Copy & Typography Cleanup (AI-Slop & Leaked Internals Removal)
- Eliminate raw formatting artifacts (e.g., `$N \ge 1$`), raw enum tokens (e.g., `StructuralSteel`), and internal implementation jargon ("normalized XML", "domain facts", "AST verification rules", "OpenXML deliverables", "Download .dvl") in favor of clear desktop domain language ("one or more", "Structural Steel", "Save Project (.dvl)", "Official Excel Workbook").
- Reduce nested container borders and excessive badge pill repetition; structure lists (such as shipping sequences and feature summaries) cleanly.

### R5. Responsive Column Prioritization & Theme Contrast Hardening
- Implement automatic sidebar collapse below constrained window breakpoints and prioritize core verification columns (rule description gets primary width, check/NA fixed) with expandable row drawers for secondary metadata (provenance, comments, AST traces).
- Correct Light and Dark theme surface tokens to ensure WCAG 2.2 AA contrast compliance and fix mixed-theme surface ownership in modals.

## Acceptance Criteria

### State Trust & Readiness
- [ ] No surface displays "All Facts Confirmed" or full readiness while any required fact or checklist rule remains in `Unknown`, `RequiresConfirmation`, or `NeedsInput` state.
- [ ] Sidebar, Header fact pill, and Export Preflight counts match the exact number of pending facts and blocked checklist items.

### Keyboard & Modal Accessibility
- [ ] Pressing `Ctrl+K` opens the search modal with the text input instantly focused and ready for typing without mouse interaction.
- [ ] Every modal dialog captures `Tab` / `Shift+Tab` within its interactive elements, closes on `Escape`, and returns focus to the previously active element.
- [ ] Modal titles and subtitles render without premature clipping or ellipsis truncation at standard desktop resolutions (1426x893).

### Desktop Workflow Feedback
- [ ] Ingesting an invalid or unsupported `Config.xml` displays a visible error banner/dialog explaining the failure rather than silently resetting Home.
- [ ] Rule Editor launch action in Settings displays a status toast or failure notification if the external process cannot be spawned.

### Copy & Visual Quality
- [ ] Zero instances of LaTeX math markup (`$N \ge 1$`), unformatted PascalCase enums, or browser terms ("Download") remain in user-facing views.
- [ ] Light mode modal dialogs render cohesive light background surfaces without dark container outer shells.

### Verification & Automated Testing
- [ ] Frontend build (`npm run build`) passes with zero TypeScript errors or broken imports.
- [ ] Backend tests (`dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`) pass cleanly.
- [ ] Rule pack manifest verification (`node scripts/build_rulepack.mjs`) succeeds.
