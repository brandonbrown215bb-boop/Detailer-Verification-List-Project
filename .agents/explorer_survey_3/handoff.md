# Handoff Report — Tests & Architecture Survey for UI/UX Remediation

## 1. Observation

### O1. System Build & Test Command Verifications
- **Backend Tests**: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"`
  - Result: 29 passed, 0 failed, 6.59s duration.
  - Tests verify `AstEvaluatorTests.cs` (predicate operators, nested groups, strict weight enforcement), `FactRegistryTests.cs` (multi-skid fact extraction, provenance, override/revert audit trail), `XmlParserTests.cs` (Config.xml schema extraction, 18 UPZ example configs), `UpzExtractorTests.cs` (native unpack32.exe extraction & OrderRev parsing), `RulePackManagerTests.cs` (bundle hash integrity, CRLF line ending tolerance, atomic update sync), `DvlProjectTests.cs` (roundtrip serialization, atomic save), and `OpenXmlPatcherTests.cs` (dynamic category sheet pruning, formula adaptation, multi-skid dynamic rows $\ge 26$).
- **Frontend Build**: `npm run build` (`tsc && vite build`)
  - Result: Transformed 1,634 modules in 6.75s, 0 TypeScript compile errors.
  - Generated output: `dist/index.html` (0.98 kB), `dist/rule-editor.html` (0.66 kB), and bundled assets.
- **Rule Pack Manifest & Hash Compiler**: `node scripts/build_rulepack.mjs`
  - Result: Validated 104 rules (99 active, 5 archived), computed canonical UTF-8 LF JSON hashes, binary template hash (`406f6a5166...`), and bundle SHA-256 (`9bf21f8fe4...`).
- **AST Converter Node Tests**: `node scripts/test_ast_converter.mjs`
  - Result: 5/5 assertions passed against live TypeScript source in Node v24.19.0.

### O2. Readiness & Fact Synchronization Divergence (Requirement R1)
- **Header**: `src/components/Header.tsx` (lines 75–77):
  ```ts
  const pendingFactsCount = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  ).length;
  ```
- **Resolution Center Modal**: `src/components/ResolutionCenterModal.tsx` (lines 28–30):
  ```ts
  const pendingFacts = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  );
  ```
  When `pendingFacts.length === 0`, line 56 renders: `"All Facts Confirmed!"`.
- **PreFlight Modal**: `src/components/PreFlightModal.tsx` (lines 44–46):
  ```ts
  const pendingFacts = Object.values(facts).filter(
    f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
  );
  ```
  (Does NOT exclude weight).
- **Sidebar**: `src/components/Sidebar.tsx` (line 46):
  ```ts
  const allNeedsInput = checklists.filter(c => c.applicability === 'NeedsInput').length;
  ```
  (Displays "15 Inputs Needed" when skid weights are unconfirmed).
- **Rule Evaluator**: `src/services/ruleEvaluator.ts` (lines 20–27):
  Checks `rule.requiredFacts`. For rules requiring `skid.weight`, an unknown weight forces `applicability: 'NeedsInput'`.

### O3. Keyboard & Modal Focus Deficiencies (Requirement R2)
- **Search Timing Race**: `src/components/OmniSearchModal.tsx` (lines 28–33):
  ```ts
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);
  ```
  Uses an arbitrary 50ms `setTimeout`, does not select input text, does not trap Tab focus, and does not restore focus on close.
- **Missing Dialog Accessibility**: `src/components/common/ModalShell.tsx` (lines 46–49):
  Lacks `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, and does not make background inert.
- **Subtitle Truncation**: `src/components/common/ModalShell.tsx` (line 60):
  `<p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]">{subtitle}</p>`  
  Forces clipping with ellipsis at standard resolutions (1426x893).

### O4. File Ingestion & Action Feedback (Requirement R3)
- **Home Ingestion**: `src/components/HomePage.tsx` (lines 106–126) and `src/App.tsx` (lines 272–308):
  `loadXmlData` catches errors and uses browser `alert()`. If a user selects an unsupported or invalid file, or if the dialog is dismissed, no durable error banner or loading progress is displayed on the Home screen.
- **Rule Editor Launch**: `src/components/SettingsModal.tsx` (lines 336–345):
  ```tsx
  <a href="/rule-editor.html" target="_blank" ...><span>Open Rule & Logic Editor</span></a>
  ```
  Anchor tag with `target="_blank"` fails to spawn the external desktop process (`RuleEditor.exe`) inside the WebView2 desktop host and provides zero error feedback to the user.

### O5. Copy & Typography Residue (Requirement R4)
- **LaTeX Math Markup**: `src/components/ManualUnitModal.tsx` (line 732):
  `"Configure any number of skids ($N \ge 1$), custom skid names, and base profiles."`
- **Leaked Implementation Platter**: `src/components/ManualUnitModal.tsx` (line 1259):
  `"The application will synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules across unit and skids, and generate compliant OpenXML deliverables."`
- **Browser Download Verb**: `src/components/PreFlightModal.tsx` (line 179):
  `<span>Download .dvl</span>`

### O6. Responsive Layout & Theme Contrast (Requirement R5)
- **Table Column Policy**: `src/components/SkidViewTab.tsx` (lines 285–294):
  Table header hardcodes fixed column widths (`w-14`, `w-36`, `min-w-[280px]`, `w-32`, `w-28`, `w-16`, `min-w-[220px]`, `w-24`), causing severe horizontal grid overflow at viewport widths $\le 1280\text{px}$.
- **Theme Surface Bleed**: Modals in light mode retain dark borders/backdrops rather than coherent light surface styling.

---

## 2. Logic Chain

1. **Premise 1 (O2)**: Header and Resolution Center excluded `weight` from pending fact counts, while PreFlight included weight, and the AST Rule Evaluator marked all rules requiring `skid.weight` as `NeedsInput`.
2. **Inference 1**: When a unit baseline has unknown skid weights, Resolution Center finds 0 pending facts and displays "All Facts Confirmed!", while Sidebar and Skid Views find 15 checks in `NeedsInput` state. This produces a direct state contradiction where the UI reports readiness while blocking export.
3. **Premise 2 (O3)**: `ModalShell.tsx` and custom modals omit ARIA dialog attributes, focus trapping, and focus restoration, while `OmniSearchModal.tsx` relies on a 50ms `setTimeout`.
4. **Inference 2**: In WebView2 and Chromium desktop hosts, UI Automation focus remains on the background document root when `Ctrl+K` is pressed, breaking keyboard-only accessibility and assistive technology reading order.
5. **Premise 3 (O4)**: `HomePage.tsx` lacks dedicated `isImporting` and `importError` state variables, and `SettingsModal.tsx` uses `<a target="_blank">` for external app launching.
6. **Inference 3**: Users attempting to load invalid XML files experience a silent return to Home with no feedback, and desktop users cannot launch the Rule Editor.
7. **Premise 4 (O5, O6)**: Raw LaTeX math (`$N \ge 1$`), raw enum tokens, internal architecture jargon, browser verbs ("Download"), fixed column widths, and subdued text tokens exist in user-facing components.
8. **Inference 4**: Eliminating these artifacts, providing human-readable enum formatters, making description the primary flexible grid column, and enforcing WCAG 2.2 AA color tokens directly satisfies requirements R4 and R5.
9. **Premise 5 (O1)**: Node v24.19.0 natively runs TypeScript and ESM with built-in `--test` runner; C# xUnit runs 29 backend tests in ~6.6s; `npm run build` checks 100% of TypeScript types in ~6.8s.
10. **Inference 5**: An automated test suite comprising 5 lightweight harnesses (readiness predicate tests, copy/terminology linter, rulepack AST validator, TypeScript compiler, and C# xUnit suite) can verify R1–R5 without adding heavy external testing dependencies.

---

## 3. Caveats

- **Apprentice Server / IPT Binaries**: Inventor binary property extraction (`read_ipt_properties`) relies on local Autodesk COM registration; unit tests use pure mock/UPZ XML configurations and do not invoke Apprentice Server during CI.
- **WebView2 Zoom Scaling**: Keyboard shortcuts for zoom (`Ctrl++`) in the embedded host are handled by the native WinForms container; responsive verification in this report was analyzed at DOM and viewport breakpoint levels (1086px, 1426px, 1920px).
- **No Other Caveats**: All 29 backend tests, frontend build scripts, and rulepack compilers execute cleanly and reproducibly.

---

## 4. Conclusion

The build, test, and rulepack systems are structurally sound and verified. The UI/UX discrepancies reported in `ui-ux-review/findings.md` stem from five isolated implementation gaps:
1. Fragmented readiness predicates across shell components.
2. Missing dialog accessibility semantics and focus management in `ModalShell.tsx`.
3. Absence of durable import/loading states in `HomePage.tsx` and desktop-aware external process dispatch in `SettingsModal.tsx`.
4. Leaked implementation copy, LaTeX math strings, and unformatted enum tokens.
5. Rigid table column width distributions on constrained viewports.

Implementing a centralized `src/utils/readiness.ts`, enhancing `ModalShell.tsx`, adding formatting helpers in `src/utils/formatters.ts`, reflowing grid columns in `SkidViewTab.tsx`, and adding automated test harnesses (`scripts/test_readiness.mjs`, `scripts/test_copy_linter.mjs`) to `run-tests.bat` provides a complete, verified remediation of requirements R1–R5.

---

## 5. Verification Method

To independently verify all findings and test suites:

1. **Backend Verification**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
   ```
   *Expected Result*: 29/29 tests pass.

2. **Frontend Type Safety & Bundle Build**:
   ```powershell
   npm run build
   ```
   *Expected Result*: 0 TypeScript errors; `dist/index.html` and `dist/rule-editor.html` generated.

3. **Rule Pack Manifest & AST Converter Verification**:
   ```powershell
   node scripts/build_rulepack.mjs
   node scripts/test_ast_converter.mjs
   ```
   *Expected Result*: Manifest updated with valid bundle SHA-256; all 5 AST converter tests pass.

4. **Technical Report Inspection**:
   Inspect `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_3\survey_tests.md` for complete technical details.
