## 2026-08-31T20:05:48-05:00

You are the Worker for Milestone 2 (R2: Keyboard Speed & Accessible Dialog Focus Semantics).

Your working directory is:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\worker_m2_1

Project Root:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project

MANDATORY FIRST STEP:
Read c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\ORIGINAL_REQUEST.md and c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\PROJECT.md before doing anything else.

EXPLORER BLUEPRINTS TO READ:
- `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m2_1\m2_strategy_focustrap.md`
- `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m2_2\m2_strategy_modals.md`
- `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_m2_3\m2_strategy_omnisearch.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
- `src/hooks/useFocusTrap.ts` (create)
- `src/components/common/ModalShell.tsx`
- `src/components/OmniSearchModal.tsx`
- `src/components/ManualUnitModal.tsx`
- `src/components/SettingsModal.tsx`
- `src/components/PreFlightModal.tsx`
- `src/components/ProjectIdentityModal.tsx`
- `src/components/ComNumberModal.tsx`
- `src/components/DetailerNameModal.tsx`
- `scripts/test_modal_accessibility.mjs` (create)
- `run-tests.bat` (integrate modal test)
- `package.json`

YOUR MISSION & IMPLEMENTATION REQUIREMENTS:
1. Create `src/hooks/useFocusTrap.ts`:
   - Trap `Tab` and `Shift+Tab` within container.
   - Capture `document.activeElement` before opening and restore focus on close/unmount.
   - Listen for `Escape` and invoke `onEscape`.
   - Focus `initialFocusRef` or first focusable element synchronously on mount.
2. Upgrade `src/components/common/ModalShell.tsx`:
   - Attach `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
   - Auto-wrap subtitle (remove `truncate max-w-[320px]`).
   - Integrate `useFocusTrap`.
3. Upgrade `src/components/OmniSearchModal.tsx`:
   - Synchronous autofocus and text selection (`.select()`) on open without 50ms `setTimeout`.
   - WAI-ARIA 1.2 Combobox semantics (`role="dialog"`, `aria-modal="true"`, `role="combobox"`, `role="listbox"`, `role="option"`).
   - Cyclic arrow navigation, `Enter` select, `Escape` close + focus restoration.
4. Upgrade `src/components/ManualUnitModal.tsx`:
   - Add `role="dialog"`, `aria-modal="true"`, `Escape` listener, and focus trapping.
5. Create live test suite `scripts/test_modal_accessibility.mjs` and integrate into `run-tests.bat` and `package.json`.
6. Run verification commands:
   - `npm run build`
   - `node scripts/test_modal_accessibility.mjs`
   - `node scripts/test_readiness.mjs`
   - `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`

DELIVERABLE:
Write a complete `handoff.md` in your working directory documenting:
1. Observation (files changed and test results)
2. Logic Chain
3. Caveats
4. Conclusion
5. Verification Method & Output
Communicate completion back to caller via send_message.
