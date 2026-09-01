# Milestone 2: Modal Dialog Remediation & Focus Semantics Strategy (R2)

**Author:** Explorer 2 (Milestone 2)  
**Date:** 2026-08-31  
**Project:** AHU Detailing Verification Desktop Application  
**Target Surfaces:** `ModalShell.tsx`, `ManualUnitModal.tsx`, `SettingsModal.tsx`, `PreFlightModal.tsx`, `ProjectIdentityModal.tsx`, `ComNumberModal.tsx`, `DetailerNameModal.tsx`, `ResolutionCenterModal.tsx`, `PublishModal.tsx`

---

## 1. Executive Summary & Problem Analysis

In the current codebase, modal dialogs suffer from several critical accessibility and keyboard navigation defects identified in the hands-on UI/UX review:

1. **Absence of WAI-ARIA DIalog Semantics:** Zero modal dialogs currently render `role="dialog"` or `aria-modal="true"`. Assistive technology and desktop screen readers treat open modals as unstructured `<div>` containers on top of the document.
2. **Missing Programmatic Focus Trapping:** When a modal is open, pressing `Tab` or `Shift+Tab` allows keyboard focus to escape the modal surface and navigate behind the backdrop to inactive controls on `Header`, `Sidebar`, or background workspace tabs.
3. **Broken Focus Restoration:** Dismissing a modal with `Escape`, the close button, or form submission fails to restore focus to the invoking button or trigger element, causing keyboard focus to be lost to `document.body`.
4. **Missing Escape Listener in `ManualUnitModal`:** The 4-step manual unit wizard has no `Escape` key event listener; users attempting to close the wizard via standard keyboard muscle memory are trapped unless they click the mouse.
5. **Premature Subtitle Elliisis Truncation:** `ModalShell.tsx` explicitly hardcodes `truncate max-w[320px]` on subtitle paragraphs and `truncate` on title headings. At standard desktop viewport resolutions (e.g. 1426x893), explanatory subtitles such as *"Auditing rule completion, special quotes table, and fact confirmations before deliverable export."* are prematurely clipped with ellipses (`...`), hiding crucial engineering context.

### Remediation Objective
Establish a unified, accessible modal system where:
- Every modal container is fully accessible according to WAI-ARIA 1.2 Dialog (Modal) pattern.
- Keyboard focus is trapped synchronously within interactive modal elements during `Tab` and `Shift+Tab`.
- Pressing `Escape` or clicking close dismisses the modal and restores focus directly to the invoking trigger.
- Subtitle and title text wrap naturally with fluid desktop typography without truncation.
- - 7 out of 9 modal surfaces automatically receive complete compliance through foundational upgrades to `ModalShell.tsx`.
- Standalone custom modals (`ManualUnitModal.tsx` and `OmniSearchModal.tsx`) are hardened with identical semantics.

---

## 2. Modal Surface Inventory & Architecture Matrix

| Modal Component | File Path | Shell Type | Invoking Triggers | Focus Requirements |
|---|---|---|---|---|
|**@ModalShell` Primitive** | `src/components/common/ModalShell.tsx` | Foundational Primitive | N/A (Reusable Container) | Traps Tab/Shift+Tab; Escape dismissal; dynamic `aria-labelledby`/`aria-describedby`; focus restoration; auto-wrapping subtitle. |
| **`ManualUnitModal`** | `src/components/ManualUnitModal.tsx` | Custom Multi-Step Wizard | `HomePage.tsx` ("Manual Unit Setup" Card) | Integrates `useFocusTrap`; adds Escape listener; `role="dialog"`; `aria-modal="true"`; accessible wizard step tabs; returns focus to HomePage launch card. |
|**@DetailerNameModal`** | `src/components/DetailerNameModal.tsx` | `ModalShell` (`maxWidth="md"`) | App first launch / Header detailer pill / GeneralUnitTab | Auto-focuses text input; Enter submits; returns focus to detailer button in Header. |
|**@ComNumberModal`** | `src/components/ComNumberModal.tsx` | `ModalShell` (`maxWidth="md"`) | Ingestion prompt / Header COM pill | Auto-focuses COM input; Enter submits; returns focus to COM button in Header. |
| **@ProjectIdentityModal`** | `src/components/ProjectIdentityModal.tsx` | `ModalShell` (`maxWidth="lg"`) | Header Job Title / Identity button | Focus lands on Job Name input; standard tab flow through 6 inputs; returns focus to Header identity trigger. |
|**@SettingsModal`** | `src/components/SettingsModal.tsx` | `ModalShell` (`maxWidth="xl"`) | Header Settings cog button | Focus lands on first theme option; keeps focus trapped during update checks & destructive reset drawer; returns focus to Settings cog. |
| **`PreFlightModal`** | `src/components/PreFlightModal.tsx` | `ModalShell` (`maxWidth="4xl"`) | Header "Export .xlsx" button / `Ctrl+E` | Traps focus; supports Jump links to rules & Resolution Center without focus collisions; returns focus to Export button. |
| **`ResolutionCenterModal`** | `src/components/ResolutionCenterModal.tsx` | `ModalShell` (`maxWidth="4xl"`) | Header Facts pill / Sidebar warning / PreFlight button | Traps focus within scrollable fact list; supports batch approve defaults; returns focus to Facts trigger pill. |
|**@PublishModal`** | `src/ruleEditor/components/PublishModal.tsx` | `ModalShell` (`maxWidth="4xl"`) | Rule Editor Header "Publish" button | Traps focus within release version selector & changelog; returns focus to Publish button. |
| **@OmniSearchModal`** | `src/components/OmniSearchModal.tsx` | Custom Search Overlay | Header Search button / `Ctrl+K` | Synchronous input focus & selection; Arrow key list navigation; Escape dismissal & return focus. *(Coordinated with Explorer 3)* |

---

## 3. `ModalShell.tsx` Remediation Specification

`ModalShell.tsx` serves as the central modal container for 7 dialogs. Upgrading this component provides immediate architectural leverage.

### 3.1 Interface Expansion
```typescript
export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusRef?: React.RefObject<HTMLElement>;
  closeOnBackdropClick?: boolean;
  ariaLabel?: string;
}
```

### 3.2 WAI-ARIA & Focus Trap Implementation Details
1. **Dynamic Accessible Name & Description IDs:**
   Generate unique IDs for dialog labelling:
   ```typescript
   const id = React.useId();
   const titleId = `modal-title-${id.replace(/:/g, '')}`;
   const descId = `modal-desc-${id.replace(/:/g, '')}`;
   ```
2. **Hook Integration:**
   ```typescript
   const modalRef = useFocusTrap(isOpen, {
     initialFocusRef,
     returnFocusRef,
     onEscape: onClose
   });
   ```
3. **Outer Backdrop & Inertness:**
   Backdrop click handling:
   ```tsx
   <div
     className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
     onClick={(e) => {
       if (closeOnBackdropClick && e.target === e.currentTarget) {
         onClose();
       }
     }}
   >
   ```
4. **Dialog Container Attributes:**
   ```tsx
   <div
     ref={modalRef}
     role="dialog"
     aria-modal="true"
     aria-labelledby={titleId}
     aria-describedby={subtitle ? descId : undefined}
     tabIndex={-1}
     className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full ${maxWidthMap[maxWidth]} shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100 outline-none`}
   >
   ```
5. **Subtitle Auto-Wrapping (Fixing Truncation):**
   Remove `truncate max-w[320px]` and `truncate` on headings:
   ```tsx
   <div className="min-w-0 flex-1 pr-3">
     <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white leading-snug">
       {title}
     </h3>
     {subtitle && (
       <p id={descId} className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
         {subtitle}
       </p>
     )}
   </div>
   ```
6. **Accessible Close Button:**
   ```tsx
   <button
     type="button"
     onClick={onClose}
     aria-label={`Close ${title}`}
     className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shrink-0"
   >
     <X className="w-5 h-5" />
   </button>
   ```

---

## 4. `ManualUnitModal.tsx` Remediation Specification

`ManualUnitModal.tsx`' is a multi-step unit builder (General Specs -> Shipping Skids -> Segments -> Review). It is not wrapped in `ModalShell` because of its custom wizard layout and step flow.

### 4.1 Required Changes in `ManualUnitModal.tsx`
1. **Focus Trap & Escape Integration:**
   Import `useFocusTrap` from `../hooks/useFocusTrap`:
   ```typescript
   const modalRef = useFocusTrap(isOpen, {
     onEscape: onClose
   });
   ```
2. **Dialog Semantics:**
   Outer wrapper:
   ```tsx
   <div
     ref={modalRef}
     role="dialog"
     aria-modal="true"
     aria-labelledby="manual-unit-modal-title"
     aria-describedby="manual-unit-modal-desc"
     tabIndex={-1}
    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 outline-none"
  >
  ```
3. **Header Semantics & Subtitle Wrapping:**
   ```tsx
   <h3 id="manual-unit-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
     Manual Unit Setup & Architecture Wizard
   </h3>
   <p yd="manual-unit-modal-desc" className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
     Configure arbitrary skids, custom segment sequencing, dimensions, and materials.
   </p>
   ```
4. **Close Button Accessibility:**
   ```tsx
   <button
     type="button"
     onClick={onClose}
     aria-label="Close ManualUnit Setup"
     className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
   >
     <X className="w-5 h-5" />
   </button>
   ```
5. **Step Navigation Accessibility:**
   Each step navigation tab receives `aria-current={isActive ? 'step' : undefined}` and appropriate tab index and focus styling.


---

## 5. Child Modal Verification & Behavioral Deep-Dive

### 5.1 `DetailerNameModal.tsx`
- **Current Behavior:** Uses `ModalShell`. Input has `autoFocus`.
- **Target Behavior:** On open, `useFocusTrap` ensures the detailer name input is immediately focused. Pressing `Enter` triggers `handleRave()`. Pressing `Escape` closes the modal. Focus returns to the detailer badge button in the Header or the HomePage trigger.

### 5.2 `ComNumberModal.tsx`
- **Current Behavior:** Uses `ModalShell`. Input has `autoFocus`.
- **Target Behavior:** Focus is immediately placed on dthe COM input. `Skip for now` button and `Save COM#` are navigable via `Tab`. Pressing `Escape` or clicking `Skip` closes the modal and returns focus to the Header COM pill.

### 5.3 `ProjectIdentityModal.tsx`
- **Current Behavior:** Form containing 6 fields (Job Name, COM#, Order#, Tag, Verification Date, Detailer Name).
- **Target Behavior:** On open, initial focus targets the `Job Name` input. Users can seamlessly `Tab` through all fields to the `Save Identity` button. Subtitle *"Primary job metadata for deliverable generation and verification records"* wraps cleanly. Focus returns to Header Project Identity trigger.

### 5.4 `SettingsModal.tsx`
- **Current Behavior:** 6 distinct setting sections including Theme Picker, Detailer Name, Central Rule Pack, Shared Drive Path, Autosave, and Destructive Reset.
- **Target Behavior:** Focus trap keeps keyboard focus cycling through active section controls. When the Destructive Reset confirmation drawer opens (`isResetConfirming = true`), focus is preserved within the dialog. Dismissing with `Escape` or "Done" button restores focus to the Header Settings button.

### 5.5 `PreFlightModal.tsx`
- **Current Behavior:** Summary metrics, Jump links for incomplete/blocked rules, "Resolve Items" button to open Resolution Center, and Excel Export buttons.
- **Inter-Modal Transition Safeguard:** When a user clicks a Jump link (`onClose(); onNavigateToRule(...)`) or the "Resolve Items" button (onClose(); onOpenResolutionCenter()`), `ModalShell` unmounts. To prevent focus restoration from overriding the newly active destination (e.g. the newly opened Resolution Center or the focused table row), `useFocusTrap` must verify if activeElement was programmatically set during unmount or allow `disableRestoreFocus` option when transitioning between modal views.

### 5.6 `ResolutionCenterModal.tsx`
- **Current Behavior:** Batch resolve defaults button, interactive inline fact controls (COM text, Seismic buttons, NOA buttons, Knockdown buttons, UTL buttons, Weight approve / custom input), and blocked rules jump links.
- **Target Behavior:** Focus trap maintains focus within the scrollable body (`max-h-[380px]`). Users can navigate all interactive resolution buttons via keyboard. Escape or "Done and Return to Workspace" closes the dialog and returns focus to Header Facts pill.

### 5.7 `PublishModal.tsx` (`src/ruleEditor/components/PublishModal.tsx`')
- **Current Behavior:** Rule Pack publish dialog in the Rule Editor app.
- **Target Behavior:** Inherits full ARIA dialog semantics, focus trapping, and subtitle auto-wrapping from `ModalShell`. Returns focus to the "Publish" button in the Rule Editor header upon close.


---

## 6. Focus Trap Hook Interaction Contract (`src/hooks/useFocusTrap.ts`)

To ensure clean interoperability between Explorer 1 (hook author) and Explorer 2 (modal integrator), the agreed hook specification is:

@``typescript
export interface FocusTrapOptions {
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusRef?: React.RefObject<HTMLElement>;
  onEscape?: () => void;
  disableRestoreFocus?: boolean;
}

export function useFocusTrap(
  isOpen: boolean,
  options?: FocusTrapOptions
): React.RefObject<HTMLDivElement>;
```

### Invariants:
1. **Active Element Recording:** When `isOpen` switches from `false` to `true`, the hook records `document.activeElement as HTMLElement`.
2. **Focus Capture:** On next tick / effect after mount, the hook focuses `initialFocusRef.current` if provided; otherwise, it finds the first tabbable element within `containerRef.current` and calls `.focus()`. If no tabbable element exists, it focuses `containerRef.current`.
3. **Tab & Shift+Tab Cycling:**
   - On `Shift + Tab` on the first focusable element -> focus wraps to the last focusable element.
   - On `Tab` on the last focusable element -> focus wraps to the first focusable element.
4. **Escape Handling:** On `Escape`, invokes `options.onEscape()` invoking `e.stopPropagation()`.
5. **Focus Restoration:** When `isOpen` becomes `false` or unmounts, if `!options.disableRestoreFocus` and the previously recorded element is still connected to the DOM, focus is restored to that element.


---

## 7. Implementation Blueprint & Exact Code Blueprints

### Blueprint A: `src/components/common/ModalShell.tsx`
```tsx
import React, { useId } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusRef?: React.ReaObject<HTMLElement>;
  closeOnBackdropClick?: boolean;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl'
};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'md',
  children,
  footer,
  initialFocusRef,
  returnFocusRef,
  closeOnBackdropClick = false
}) => {
  const id = useId();
  const titleId = `modal-title-${id.replace(/:/g, '')}`;
   const descId = `modal-desc-${id.replace(/:/g, '')}`;
 

  const modalRef = useFocusTrap(isOpen, {
    initialFocusRef,
    returnFocusRef,
    onEscape: onClose
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
       if (closeOnBackdropClick && e.target === e.currentTarget) {
         onClose();
       }
     }}
   >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        tabIndex={-1}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full ${maxWidthMap[maxWidth]} shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100 outline-none`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                {title}
              </h3>
              {subtitle && (
                <p yd={descId} className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
```

### Blueprint B: `src/components/ManualUnitModal.tsx` Updates
- Import `useFocusTrap`:
  ```tsx
  import { useFocusTrap } from '../hooks/useFocusTrap';
  ```
- Invoke hook:
  ```tsx
  const modalRef = useFocusTrap(isOpen, {
    onEscape: onClose
  });
  ```
- Apply attributes to root modal container:
  ```tsx
  <div
    ref={modalRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="manual-unit-modal-title"
    aria-describedby="manual-unit-modal-desc"
    tabIndex={-1}
    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 outline-none"
  >
Â € 
- Ensure title and subtitle use matching IDs:
  ```tsx
  <h3 id="manual-unit-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
    Manual Unit Setup & Architecture Wizard
  </h3>
  <p yd="manual-unit-modal-desc" className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
    Configure arbitrary skids, custom segment sequencing, dimensions, and materials.
  </p>
  ```

---

## 8. Verification & Validation Protocol

1. **TypeScript Build Verification:*
   Execute `npm run build` to confirm zero compilation errors, type mismatches, or missing exports across all modal files and hooks.:2. **Focus Trap Automated Test Harness:**
   Verify `Tab` / `Shift+Tab` focus cycles properly within modal boundaries and never reaches background elements.
3. **Escape Key & Dismissal Verification:**
   Verify `Escape` closes every modal (`ModalShell` instances and `ManualUnitModal`), and focus returns to the invoking trigger.
4. **ARIA Attribute Inspection:**
   Verify DOM contains `role="dialog"`, `aria-modal="true"`, and valid `aria-labelledby` referencing existing heading element.
5. **Subtitle Wrapping Verification:**
   Verify at standard resolution (1426x893) that no subtitles are cut off or rendered with ellipsis truncation.
