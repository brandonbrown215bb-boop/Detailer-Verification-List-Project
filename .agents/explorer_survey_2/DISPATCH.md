## 2026-08-31T19:42:00Z
Investigate the frontend codebase (UI components, stores, views, styles, dialogs, modals, tables, theme system):
1. Locate where facts and readiness are computed and consumed (Header, Sidebar, Facts Resolution Center, GeneralUnitTab, SkidViews, PreflightModal).
2. Locate all modal dialogs (`ModalShell`, `OmniSearchModal`, `ManualUnitModal`, `SettingsModal`, `PreFlightModal`, `ProjectIdentityModal`, `ComNumberModal`, `DetailerNameModal`), how focus trapping, ARIA, and `Ctrl+K` are implemented.
3. Locate file ingestion logic for `Config.xml` and `.upz` (HomePage, file picker handlers, error handling / loading state), and Settings external action handlers (Rule & Logic Editor launch).
4. Identify user copy, LaTeX math formatting ($N \ge 1$), raw enum tokens, internal jargon, nested borders, and badge pill usage across views.
5. Identify table layouts, column widths, rule description rendering, expandable rows, sidebar responsive behavior, and theme tokens (light/dark colors, contrast).

Deliverable:
`c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_2\survey_frontend.md`
and `handoff.md`.
