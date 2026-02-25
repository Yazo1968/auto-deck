import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Configuration for the panel overlay hook.
 */
export interface PanelOverlayConfig {
  /** Whether the panel is currently open (controlled by parent). */
  isOpen: boolean;
  /** Default width in pixels (or a dynamic expression). Reset on each open. */
  defaultWidth: number;
  /** Minimum width during resize drag. Defaults to 300. */
  minWidth?: number;
}

/**
 * Return value from the usePanelOverlay hook.
 */
export interface PanelOverlayState {
  /** Ref to attach to the strip button element (used for positioning). */
  stripRef: React.RefObject<HTMLButtonElement | null>;
  /** Whether the overlay should be rendered at all (true during open + close animation). */
  shouldRender: boolean;
  /** Whether the close animation is currently playing. */
  isClosing: boolean;
  /** Current overlay width in pixels (resizable). */
  overlayWidth: number;
  /** Mouse-down handler to attach to the resize drag handle. */
  handleResizeStart: (e: React.MouseEvent) => void;
  /** Inline style object for the overlay's position/size/animation. */
  overlayStyle: React.CSSProperties;
}

const ANIMATION_DURATION = 400; // ms — matches panel-roll-in / panel-roll-out keyframes

/**
 * Shared hook that manages the portal-based overlay panel pattern used by
 * ProjectsPanel, SourcesPanel, ChatPanel, and AutoDeckPanel.
 *
 * Encapsulates:
 * - Open/close animation state (shouldRender, isClosing, 400ms timeout)
 * - Width state with reset-on-open
 * - Resize drag-handle logic (mouse listeners, cursor management)
 * - Overlay positioning via stripRef.getBoundingClientRect()
 */
export function usePanelOverlay({ isOpen, defaultWidth, minWidth = 300 }: PanelOverlayConfig): PanelOverlayState {
  const stripRef = useRef<HTMLButtonElement>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [overlayWidth, setOverlayWidth] = useState(defaultWidth);
  const isDragging = useRef(false);

  // ── Open/close animation ──
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const t = setTimeout(() => {
        setIsClosing(false);
      }, ANIMATION_DURATION);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shouldRender is derived from isOpen; including it would break the open/close toggle
  }, [isOpen]);

  // ── Reset width on open ──
  useEffect(() => {
    if (isOpen) setOverlayWidth(defaultWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset width when panel opens/closes, not when defaultWidth expression re-evaluates
  }, [isOpen]);

  // ── Resize drag handler ──
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:ew-resize;';
      document.body.appendChild(overlay);
      const startX = e.clientX;
      const startW = overlayWidth;
      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        setOverlayWidth(Math.max(minWidth, startW + ev.clientX - startX));
      };
      const onUp = () => {
        isDragging.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        overlay.remove();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [overlayWidth, minWidth],
  );

  // ── Overlay positioning style ──
  const rect = stripRef.current?.getBoundingClientRect();
  const overlayStyle: React.CSSProperties = {
    transformOrigin: 'left',
    ...(!isOpen && !isClosing
      ? { display: 'none' }
      : { animation: `${isClosing ? 'panel-roll-in' : 'panel-roll-out'} 0.4s ease-out forwards` }),
    top: rect?.top ?? 0,
    left: rect?.right ?? 0,
    height: rect?.height ?? 0,
    width: overlayWidth,
  };

  return {
    stripRef,
    shouldRender,
    isClosing,
    overlayWidth,
    handleResizeStart,
    overlayStyle,
  };
}
