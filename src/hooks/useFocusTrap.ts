import React, { useEffect, useLayoutEffect, useRef } from 'react';

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
   * Whether to disable focus restoration upon close. Default: false.
   */
  disableRestoreFocus?: boolean;

  /**
   * Whether background siblings should be marked inert and aria-hidden. Default: true.
   */
  enableInertBackground?: boolean;
}

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

export function isFocusable(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) {
    return false;
  }
  if ((el as any).disabled) {
    return false;
  }
  if (el.getAttribute('tabindex') === '-1') {
    return false;
  }
  // Check offset dimensions or getClientRects to ensure element is rendered
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter(isFocusable);
}

function applyInertToSiblings(modalElement: HTMLElement): () => void {
  if (typeof document === 'undefined') return () => {};

  let topAncestor: HTMLElement = modalElement;
  while (topAncestor.parentElement && topAncestor.parentElement !== document.body) {
    topAncestor = topAncestor.parentElement;
  }

  const affectedElements: Array<{ el: HTMLElement; prevInert: string | null; prevAriaHidden: string | null }> = [];
  const root = document.getElementById('root') || document.body;

  Array.from(root.children).forEach(child => {
    const el = child as HTMLElement;
    if (el !== modalElement && !el.contains(modalElement) && el !== topAncestor && !topAncestor.contains(el)) {
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
      if (prevInert !== null) {
        el.setAttribute('inert', prevInert);
      } else {
        el.removeAttribute('inert');
      }
      if (prevAriaHidden !== null) {
        el.setAttribute('aria-hidden', prevAriaHidden);
      } else {
        el.removeAttribute('aria-hidden');
      }
    });
  };
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  options?: UseFocusTrapOptions
): React.RefObject<T> {
  const containerRef = useRef<T>(null);
  const invokingElementRef = useRef<HTMLElement | null>(null);

  // Capture invoking element synchronously before modal overtakes focus
  useLayoutEffect(() => {
    if (isOpen) {
      if (!invokingElementRef.current && typeof document !== 'undefined') {
        invokingElementRef.current = (document.activeElement as HTMLElement) || null;
      }
    }
  }, [isOpen]);

  // Initial focus and text selection
  useEffect(() => {
    if (!isOpen) return;

    const focusTarget = () => {
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

        // Select text if requested (e.g. OmniSearch)
        if (options?.selectOnFocus && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
          target.select();
        }
      }
    };

    // Execute immediately synchronously and schedule frame backup
    focusTarget();
    const frameId = requestAnimationFrame(focusTarget);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isOpen, options?.initialFocusRef, options?.selectOnFocus, options?.preventScroll]);

  // Keydown & Tab focus trapping + Escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (options?.onEscape) {
          e.preventDefault();
          e.stopPropagation();
          options.onEscape();
        }
        return;
      }

      if (e.key === 'Tab') {
        if (!containerRef.current) return;
        const focusable = getFocusableElements(containerRef.current);

        if (focusable.length === 0) {
          e.preventDefault();
          containerRef.current.focus();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];
        const currentActive = document.activeElement;

        if (e.shiftKey) {
          if (currentActive === firstElement || !containerRef.current.contains(currentActive)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (currentActive === lastElement || !containerRef.current.contains(currentActive)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, options?.onEscape]);

  // Inert background manager
  useEffect(() => {
    if (!isOpen || options?.enableInertBackground === false || !containerRef.current) {
      return;
    }

    const cleanupInert = applyInertToSiblings(containerRef.current);
    return () => {
      cleanupInert();
    };
  }, [isOpen, options?.enableInertBackground]);

  // Focus restoration on close or unmount
  useEffect(() => {
    if (!isOpen && invokingElementRef.current && !options?.disableRestoreFocus) {
      const elementToRestore = options?.returnFocusRef?.current || invokingElementRef.current;
      if (elementToRestore && typeof elementToRestore.focus === 'function' && document.body.contains(elementToRestore)) {
        requestAnimationFrame(() => {
          elementToRestore.focus({ preventScroll: true });
        });
      }
      invokingElementRef.current = null;
    }
  }, [isOpen, options?.disableRestoreFocus, options?.returnFocusRef]);

  useEffect(() => {
    return () => {
      if (invokingElementRef.current && !options?.disableRestoreFocus) {
        const elementToRestore = options?.returnFocusRef?.current || invokingElementRef.current;
        if (elementToRestore && typeof elementToRestore.focus === 'function' && document.body.contains(elementToRestore)) {
          requestAnimationFrame(() => {
            elementToRestore.focus({ preventScroll: true });
          });
        }
      }
    };
  }, [options?.disableRestoreFocus, options?.returnFocusRef]);

  return containerRef;
}
