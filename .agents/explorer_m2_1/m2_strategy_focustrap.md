# Milestone 2 Architecture Strategy: Accessible Focus Management Hook (`useFocusTrap`)

## Executive Summary

This strategy establishes the technical blueprint for Milestone 2 (R2: Keyboard Speed & Accessible Dialog Focus Semantics) in the **AHU Detailing Verification** desktop application.

Based on UI/UX review findings ([ui-ux-review/findings.md](../../ui-ux-review/findings.md) §2, §3), the application currently suffers from two critical accessibility and keyboard workflow issues:
1. **`Ctrl+K` Global Search Keyboard Stall**: Opening search via `Ctrl+K` renders the overlay but leaves UI Automation and browser focus on the root document. The detailer must reach for the mouse to click the input before typing.
2. **Missing Accessible Dialog Semantics & Leaking Focus**: Modals (`ModalShell`, `OmniSearchModal`, `ManualUnitModal`) lack programmatic `Tab` containment, `aria-modal="true"`, background `inert` isolation, dynamic `aria-labelledby`/`aria-describedby` IDs, and reliable focus restoration to the invoking control upon `Escape` or dismissal. Furthermore, modal subtitles prematurely truncate with ellipsis at standard desktop resolutions (1426×893).

This document details the architectural specification for `src/hooks/useFocusTrap.ts` and its integration across all modal dialog surfaces.

---

## 1. Inventory of Target Modal Surfaces

The application contains 3 modal shell implementations and 7 wrapped modal consumers:

| Surface Component | Implementation Type | Current Semantics | Target Integration |
|---|---|---|---|
| `src/components/common/ModalShell.tsx` | Reusable Container | Raw `<div>`, no ARIA dialog, no focus trap, subtitle clipped | Integrates `useFocusTrap`, `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`/`aria-describedby`, unwrapped subtitle |
| `src/components/OmniSearchModal.tsx` | Custom Overlay | Raw `<div>`, `setTimeout(50)` focus (no select), no focus trap, no focus restoration | Integrates `useFocusTrap` with `initialFocusRef` + text auto-select, `role="dialog"`, `aria-modal="true"`, `aria-label` |
| `src/components/ManualUnitModal.tsx` | Custom Wizard Overlay | Raw `<div>`, no `Escape` handler, no focus trap, no focus restoration | Integrates `useFocusTrap`, `role="dialog"`, `aria-modal="true"`, dynamic IDs, `Escape` key dismissal |
| `src/components/SettingsModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |
| `src/components/PreFlightModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |
| `src/components/ResolutionCenterModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |
| `src/components/ProjectIdentityModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |
| `src/components/ComNumberModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |
| `src/components/DetailerNameModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |
| `src/ruleEditor/components/PublishModal.tsx` | Uses `ModalShell` | Inherits from `ModalShell` | Automatically receives focus trap & ARIA semantics via `ModalShell` |

---

## 2. Hook Contract & API Design (`src/hooks/useFocusTrap.ts`)

The hook contract strictly adheres to `PROJECT.md` §2 while providing extensible configuration for text auto-selection, custom return elements, and background inertness:

### 2.1 TypeScript Signature

```typescript
export interface UseFocusTrapOptions {
  /**
   * Optional ref to the element that should receive focus when the trap activates.
   * If omitted, focus falls back to the first focusable element inside the container,
   * or the container itself if no focusable children exist.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;

  /**
   * Optional ref to the element that should receive focus when the trap deactivates.
   * If omitted, focus restores to document.activeElement recorded at the moment of activation.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;

  /**
   * Callback invoked when the user presses the 'Escape' key while focus is within the trap.
   */
  onEscape?: () => void;

  /**
   * If true and initial focus lands on an HTMLInputElement or HTMLTextAreaElement,
   * all text inside the input is automatically highlighted/selected. Default: false.
   */
  selectOnFocus?: boolean;

  /**
   * If true, prevents browser scrolling when focusing the initial element. Default: true.
   */
  preventScroll?: boolean;

  /**
   * Whether background siblings should be marked inert and aria-hidden. Default: true.
   */
  enableInertBackground?: boolean;
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  options?: UseFocusTrapOptions
): React.RefObject<T>;
```

---

## 3. Focus Trapping & Keyboard Listener Algorithm

### 3.1 Comprehensive Focusable Element Selector

To support all HTML and ARIA interactive elements, the selector queries:

```typescript
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'area[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'iframe:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])'
].join(', ');
```

### 3.2 Visibility & Interactivity Filtering

Elements matching the query are filtered to eliminate hidden or zero-dimension nodes:

```typescript
function isFocusable(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) {
    return false;
  }
  // Check offset dimensions or getClientRects to ensure element is rendered
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter(isFocusable);
}
```

### 3.3 Keyboard Event Routing (`Tab`, `Shift+Tab`, `Escape`)

When the focus trap container receives a `keydown` event:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (!isOpen || !containerRef.current) return;

  // 1. Escape Key Handling
  if (e.key === 'Escape') {
    if (options?.onEscape) {
      e.preventDefault();
      e.stopPropagation();
      options.onEscape();
    }
    return;
  }

  // 2. Tab & Shift+Tab Trapping Loop
  if (e.key === 'Tab') {
    const focusable = getFocusableElements(containerRef.current);

    if (focusable.length === 0) {
      // If modal contains no interactive controls, keep focus on container
      e.preventDefault();
      containerRef.current.focus();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const currentActive = document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: If on first element or outside modal, loop to last
      if (currentActive === firstElement || !containerRef.current.contains(currentActive)) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: If on last element or outside modal, loop to first
      if (currentActive === lastElement || !containerRef.current.contains(currentActive)) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
};
```

### 3.4 Outside Focus Watchdog (`focusin` Containment)

To prevent focus from escaping when the user clicks browser chrome or assistive tools shift focus outside:

```typescript
const handleGlobalFocusIn = (e: FocusEvent) => {
  if (!isOpen || !containerRef.current) return;
  const target = e.target as Node | null;
  if (target && !containerRef.current.contains(target)) {
    e.preventDefault();
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      containerRef.current.focus();
    }
  }
};
```

---

## 4. Active Element Tracking & Focus Restoration Lifecycle

### 4.1 Invoking Element Tracking

1. When `isOpen` transitions `false -> true`:
   - Capture `invokingElementRef.current = (document.activeElement as HTMLElement) || null`.
   - If the user launched the dialog via `Ctrl+K` or a keyboard shortcut while focused on a table row, that exact table row or header button is saved.

### 4.2 Initial Focus Dispatch

1. Initial focus is scheduled on the next animation frame (`requestAnimationFrame`) or microtask to ensure React has fully committed the DOM tree and rendered all inputs:
   ```typescript
   requestAnimationFrame(() => {
     if (!containerRef.current) return;

     let target: HTMLElement | null = null;

     // 1. Explicit initialFocusRef
     if (options?.initialFocusRef?.current && isFocusable(options.initialFocusRef.current)) {
       target = options.initialFocusRef.current;
     }

     // 2. Element with [autofocus] or [data-autofocus]
     if (!target) {
       target = containerRef.current.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
     }

     // 3. First focusable child
     if (!target) {
       const focusable = getFocusableElements(containerRef.current);
       if (focusable.length > 0) target = focusable[0];
     }

     // 4. Fallback to container itself (requires tabIndex={-1})
     if (!target) {
       if (!containerRef.current.hasAttribute('tabindex')) {
         containerRef.current.setAttribute('tabindex', '-1');
       }
       target = containerRef.current;
     }

     if (target) {
       target.focus({ preventScroll: options?.preventScroll ?? true });

       // Select text if requested (crucial for Ctrl+K OmniSearch)
       if (options?.selectOnFocus && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
         target.select();
       }
     }
   });
   ```

### 4.3 Focus Restoration on Unmount / Close

1. When `isOpen` transitions `true -> false` OR when the component unmounts:
   ```typescript
   const elementToRestore = options?.returnFocusRef?.current || invokingElementRef.current;

   if (elementToRestore && typeof elementToRestore.focus === 'function') {
     // Ensure element is still connected to the DOM
     if (document.body.contains(elementToRestore)) {
       // Microtask delay prevents focus collision during unmount animations
       requestAnimationFrame(() => {
         elementToRestore.focus({ preventScroll: true });
       });
     }
   }
   ```

---

## 5. Background Inertness & Containment Architecture

### 5.1 WebView2 & Accessibility Isolation

In a desktop WebView2 / Chromium environment, background elements outside the active modal must not accept tab clicks, keyboard events, or screen reader cursor navigation.

We employ a robust **Sibling Node Inertness Manager**:
1. When `useFocusTrap` activates with `enableInertBackground: true`:
   - Locate all top-level sibling elements of the modal overlay (or sibling branches of `#root`).
   - Store their previous `inert` and `aria-hidden` attributes in a map.
   - Set `sibling.setAttribute('inert', '')` and `sibling.setAttribute('aria-hidden', 'true')`.
2. When `useFocusTrap` deactivates:
   - Restore all modified siblings to their original state.
3. **Portal-Safe Guarantee**:
   - Because `containerRef.current` is tracked directly, the inert manager navigates up to the common ancestor and isolates all siblings *except* the branch containing the modal container.

```typescript
function applyInertToSiblings(modalElement: HTMLElement): () => void {
  const root = document.getElementById('root') || document.body;
  const affectedElements: Array<{ el: HTMLElement; prevInert: string | null; prevAriaHidden: string | null }> = [];

  // Find all sibling elements at root level that do not contain the modal
  Array.from(root.children).forEach(child => {
    const el = child as HTMLElement;
    if (el !== modalElement && !el.contains(modalElement)) {
      affectedElements.push({
        el,
        prevInert: el.getAttribute('inert'),
        prevAriaHidden: el.getAttribute('aria-hidden')
      });
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    }
  });

  return () => {
    affectedElements.forEach(({ el, prevInert, prevAriaHidden }) => {
      if (prevInert !== null) el.setAttribute('inert', prevInert);
      else el.removeAttribute('inert');

      if (prevAriaHidden !== null) el.setAttribute('aria-hidden', prevAriaHidden);
      else el.removeAttribute('aria-hidden');
    });
  };
}
```

---

## 6. ARIA Requirements & Dynamic ID Generation

### 6.1 Standard Dialog Semantics

Every dialog root container must render:
- `role="dialog"` (identifies surface to UI Automation & Narrator/NVDA).
- `aria-modal="true"` (notifies accessibility tree that content outside is inert).
- `aria-labelledby={titleId}` (points to heading element).
- `aria-describedby={subtitleId}` (points to subtitle/description element, if present).

### 6.2 Dynamic Unique ID Strategy (`useId`)

To prevent duplicate DOM IDs across multiple dialogs or re-renders, use React 18's `useId()`:

```typescript
const baseId = useId();
const titleId = `modal-title-${baseId}`;
const subtitleId = subtitle ? `modal-desc-${baseId}` : undefined;
```

### 6.3 Subtitle Truncation Elimination (`ModalShell.tsx`)

In `src/components/common/ModalShell.tsx` line 60, remove `truncate max-w-[320px]`:

**Before:**
```tsx
<h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{title}</h3>
{subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]">{subtitle}</p>}
```

**After:**
```tsx
<h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white leading-snug">
  {title}
</h3>
{subtitle && (
  <p id={subtitleId} className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed break-words">
    {subtitle}
  </p>
)}
```

---

## 7. Concrete Integration Specifications

### 7.1 `ModalShell.tsx` Integration

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
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

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
  returnFocusRef
}) => {
  const baseId = useId();
  const titleId = `modal-title-${baseId}`;
  const subtitleId = subtitle ? `modal-desc-${baseId}` : undefined;

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
    initialFocusRef,
    returnFocusRef
  });

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 outline-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full ${maxWidthMap[maxWidth]} shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
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
                <p id={subtitleId} className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed break-words">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors shrink-0"
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

---

### 7.2 `OmniSearchModal.tsx` Integration (`Ctrl+K` Immediate Focus & Select)

In `OmniSearchModal.tsx`:
1. Use `useFocusTrap` with `initialFocusRef={inputRef}`, `selectOnFocus: true`, and `onEscape: onClose`.
2. Remove unreliable custom `setTimeout` focus logic.
3. Render `role="dialog"`, `aria-modal="true"`, `aria-label="Global search"`.

```tsx
export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  isOpen,
  onClose,
  rules,
  facts,
  sqItems,
  graph,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    initialFocusRef: inputRef,
    selectOnFocus: true,
    onEscape: onClose
  });

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search verification rules, specifications, skids, and special quotes"
      tabIndex={-1}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 outline-none"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-850">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules, specifications, skids, special quotes..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          {/* Controls & Badges */}
          ...
        </div>
        ...
      </div>
    </div>
  );
};
```

---

### 7.3 `ManualUnitModal.tsx` Integration

In `ManualUnitModal.tsx`:
1. Use `useFocusTrap` with `onEscape: onClose`.
2. Add `useId()` for `titleId` and `subtitleId`.
3. Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`, `aria-describedby={subtitleId}`.
4. Replace raw `$N \ge 1$` LaTeX markup in skid subtitle with natural wording ("one or more skids").

```tsx
export const ManualUnitModal: React.FC<ManualUnitModalProps> = ({
  isOpen,
  onClose,
  onCreateUnit
}) => {
  const baseId = useId();
  const titleId = `manual-unit-title-${baseId}`;
  const subtitleId = `manual-unit-desc-${baseId}`;

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose
  });

  ...

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 outline-none"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">
                  Manual Unit Setup & Architecture Wizard
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30">
                  Custom Engineering
                </span>
              </div>
              <p id={subtitleId} className="text-xs text-slate-500 dark:text-slate-400">
                Configure arbitrary skids, custom segment sequencing, dimensions, and materials.
              </p>
            </div>
          </div>
          ...
        </div>
        ...
      </div>
    </div>
  );
};
```

---

## 8. Verification & Test Plan

An automated validation script `scripts/test_modal_focus_trap.mjs` should verify:
1. **Focus Trap Looping**: Simulating `Tab` on the last focusable element wraps focus back to the first focusable element.
2. **Reverse Shift+Tab Looping**: Simulating `Shift+Tab` on the first focusable element wraps focus to the last element.
3. **`Escape` Key Binding**: Dispatches the `onEscape` callback and restores focus.
4. **Initial Focus & Text Selection**: Verifies `initialFocusRef` is immediately focused and input text is selected.
5. **Focus Restoration**: Verifies that when a modal closes, the element that was focused prior to modal opening is refocused.
6. **ARIA Semantics Check**: Verifies `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby` exist on all modal root containers.
7. **Subtitle No-Truncation Check**: Verifies no `truncate max-w-[320px]` class remains in `ModalShell.tsx`.
8. **TypeScript Compilation**: `npm run build` succeeds with zero errors across the application.
