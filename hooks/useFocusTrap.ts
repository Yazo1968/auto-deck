import { useEffect, useRef, useCallback } from 'react';

/**
 * Focus-trap hook for modal dialogs.
 *
 * Traps Tab/Shift+Tab focus cycling within the container,
 * optionally handles Escape to close, and returns focus
 * to the previously-focused element on unmount.
 *
 * Usage:
 *   const trapRef = useFocusTrap<HTMLDivElement>({ onEscape: onClose });
 *   <div ref={trapRef} role="dialog" aria-modal="true">...</div>
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UseFocusTrapOptions {
  /** Called when Escape is pressed inside the trap. If omitted, Escape is not handled. */
  onEscape?: () => void;
  /** Whether the trap is active. Defaults to true. */
  active?: boolean;
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(options: UseFocusTrapOptions = {}) {
  const { onEscape, active = true } = options;
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Stable reference to onEscape so we don't re-attach listeners on every render
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && onEscapeRef.current) {
      e.stopPropagation();
      onEscapeRef.current();
      return;
    }

    if (e.key !== 'Tab') return;
    const container = containerRef.current;
    if (!container) return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null,
    ); // exclude hidden elements

    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if focus is on first element (or container), wrap to last
      if (document.activeElement === first || document.activeElement === container) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if focus is on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Save the currently focused element so we can restore it later
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the container, or the container itself
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Make the container focusable as a fallback
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      container.focus();
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Return focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [active, handleKeyDown]);

  return containerRef;
}
