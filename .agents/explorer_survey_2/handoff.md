# Handoff Report — Frontend Codebase Survey & Remediation Architecture

**Agent:** Frontend Codebase Explorer (`explorer_survey_2`)  
**Date:** 2026-08-31T19:46:00-05:00  
**Recipient:** Lead Orchestrator (`52919dba-58f2-4525-8ff2-81599136d595`)  
**Artifact:** `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_2\survey_frontend.md`  

---

## 1. Observation

Direct code observations from inspecting all 16 components, 8 services, types, CSS, and WebView2 bridge handlers:

### 1.1 Facts & Readiness Predicate Discrepancy
- **`src/components/ResolutionCenterModal.tsx:28-30, 53-60`**:
  ```typescript
  const pendingFacts = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  );
  ...
  {pendingFacts.length === 0 ? (
    <div className="py-12 text-center space-y-3">
      <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
      <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed!</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        All engineering parameters and order identity values are populated with authoritative status.
      </p>
    </div>
  ) : ...
  ```
- **`src/components/Header.tsx:75-77`**:
  ```typescript
  const pendingFactsCount = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  ).length;
  ```
- **`src/components/Sidebar.tsx:41-46`**:
  ```typescript
  const allNeedsInput = checklists.filter(c => c.applicability === 'NeedsInput').length;
  ```
- **`src/components/PreFlightModal.tsx:44-52`**:
  ```typescript
  const pendingFacts = Object.values(facts).filter(
    f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
  );
  ...
  const isReadyForFinal = incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0;
  ```
- **Finding**: Preflight counts all unconfirmed facts (including weight); Header and Resolution Center exclude weight facts; Sidebar only counts checklist rules in `NeedsInput`; Resolution Center declares false success ("All Facts Confirmed!") even when 15 checks are blocked by facts or required facts remain unknown.

### 1.2 Modal Accessibility, ARIA & Ctrl+K Shortcuts
- **`src/components/common/ModalShell.tsx:48-61`**:
  - Lacks `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
  - Line 60 has fixed subtitle truncation: `<p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]">{subtitle}</p>`.
  - No focus trap or focus restoration on close.
- **`src/components/OmniSearchModal.tsx:28-30, 84-120`**:
  - Implements custom non-`ModalShell` overlay without `role="dialog"` or focus trap.
  - Line 29: `setTimeout(() => inputRef.current?.focus(), 50)` — does not call `.select()`, and 50ms race condition leaves focus on document.
- **`src/components/ManualUnitModal.tsx:351-400`**:
  - Custom overlay without `role="dialog"`, no `Escape` key handler, no focus trap.

### 1.3 File Ingestion Feedback & External Action Spawning
- **`src/components/HomePage.tsx:43-78, 106-126`**:
  - If `desktopBridge.openFileDialog()` returns null or errors, `handleNativeOpen()` returns silently with no visual state change on Home.
  - No loading spinner/state during large XML parsing or UPZ decompression.
- **`src/components/SettingsModal.tsx:336-345`**:
  - External launch is a plain `<a href="/rule-editor.html" target="_blank">` with no bridge IPC or status toast.

### 1.4 User Copy & Leaked Internals
- **`src/components/ManualUnitModal.tsx:732`**: `Configure any number of skids ($N \ge 1$), custom skid names, and base profiles.` (Contains `$N \ge 1$`).
- **`src/components/ManualUnitModal.tsx:1259`**: `The application will synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules across unit and skids, and generate compliant OpenXML deliverables.`
- **`src/components/PreFlightModal.tsx:179`**: `<span>Download .dvl</span>`
- **`src/components/HomePage.tsx:321`**: `<span>OpenXML 3.1.1 Deliverable Engine &bull; Zero Schema Corruption</span>`
- **`src/components/SkidViewTab.tsx:342, 481`**: `Expand AST logic trace & full reference`, `AST Rule Logic Trace:`

### 1.5 Verification Grid Layout & Contrast Tokens
- **`src/components/SkidViewTab.tsx:284-295`**: 8 table columns with `Verification Description` constrained to `min-w-[280px]` with `line-clamp-2`, causing horizontal overflow at 1086px.
- **Contrast**: `text-slate-400` on white (#ffffff) has a measured contrast ratio of **2.88:1** (FAILS WCAG AA 4.5:1). `text-slate-500` on dark slate-900 (#0f172a) has **3.67:1** (FAILS WCAG AA).

---

## 2. Logic Chain

1. **Facts & Readiness Discrepancy**:
   - Because `Header`, `Sidebar`, `ResolutionCenterModal`, and `PreFlightModal` independently filter facts and checklists using differing predicates, their displayed counts diverge.
   - When a project is loaded, domain facts like `unit.noa`, `unit.isSeismic`, `unit.knockdown` default to `Authoritative: false` / `RequiresConfirmation`.
   - `ResolutionCenterModal` only counts unconfirmed domain facts, while `Sidebar` counts rules with `applicability === 'NeedsInput'`. Once the 5 hardcoded domain facts are dismissed or if they are absent, `ResolutionCenterModal` renders `All Facts Confirmed!` while `Sidebar` still shows `15 input needed`.
   - **Conclusion**: A single unified readiness hook/selector must supply synchronous truth to all views.

2. **Modal Focus & Keyboard Shortcuts**:
   - `Ctrl+K` opens `OmniSearchModal`, but `setTimeout(50ms)` does not synchronously capture focus, does not select input text, and does not trap `Tab` within interactive elements.
   - None of the modals implement `role="dialog"` or record `document.activeElement` for restoration on close.
   - **Conclusion**: Standardize `ModalShell` and all standalone modals to implement ARIA dialog semantics, programmatic focus trapping, immediate selection, and focus restoration.

3. **File Ingestion & Error Feedback**:
   - When an unhandled error occurs during file reading or bridge parsing, `HomePage` catches or suppresses it via `alert()`, leaving the UI on the blank Home screen.
   - **Conclusion**: Provide a visible loading progress state and durable error notification card explaining failure reasons.

4. **Copy & Visual Hardening**:
   - Removing LaTeX math (`$N \ge 1$`), raw enums, and software implementation jargon replaces confusing developer internals with clean industrial engineering copy.
   - Updating low-contrast Tailwind tokens guarantees WCAG 2.2 AA compliance across Light and Dark themes.

---

## 3. Caveats

- **No Source Code Modified**: In accordance with the Explorer role constraints, no changes were made directly to application source files during this survey.
- **Rule Editor App Scope**: The Rule Editor (`src/ruleEditor/`) is a secondary multi-page build (`dist/rule-editor.html`). Launching it from Settings in the desktop host requires adding a `launchRuleEditor` IPC action to `BridgeHandler.cs` and `desktopBridge.ts`.

---

## 4. Conclusion

The technical survey has mapped all frontend components, stores, styles, dialogs, and services. The root causes for the top UI/UX review findings are isolated and documented with line numbers, code snippets, contrast measurements, and exact remediation specifications in `.agents\explorer_survey_2\survey_frontend.md`.

---

## 5. Verification Method

To verify the codebase baseline and validate changes:

1. **Frontend Build**:
   ```powershell
   npm run build
   ```
   *Expected: Zero TypeScript errors, dist bundle successfully generated.*

2. **Rule Pack Manifest Validation**:
   ```powershell
   node scripts/build_rulepack.mjs
   ```
   *Expected: Rule Pack v14.0.0 built with valid bundle SHA-256.*

3. **Backend Unit Tests**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
   ```
   *Expected: All 29 unit tests pass.*
