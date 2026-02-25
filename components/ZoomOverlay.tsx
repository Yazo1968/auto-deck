import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ZoomState, ZoomViewState } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ZoomOverlayProps {
  zoomState: ZoomState;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;
const ZOOM_STEP = 1.5;
const SCROLL_ZOOM_STEP = 1.15;

const ZoomOverlay: React.FC<ZoomOverlayProps> = ({ zoomState, onClose }) => {
  const [view, setView] = useState<ZoomViewState>({ scale: 1, panX: 0, panY: 0, isPanning: false });
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ onEscape: onClose });
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const didPanRef = useRef(false);

  // Clamp pan so the image can't be dragged entirely off-screen.
  // Allows up to half the viewport past each edge so users can still
  // inspect corners, but prevents runaway transform values that crash the GPU compositor.
  const clampPan = useCallback((px: number, py: number, scale: number): { panX: number; panY: number } => {
    const viewport = viewportRef.current;
    const img = imgRef.current;
    if (!viewport || !img) return { panX: px, panY: py };
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const iw = img.offsetWidth * scale;
    const ih = img.offsetHeight * scale;
    // Image is centered via flexbox; compute offset from transform-origin (0,0) to centered position
    const originX = (vw - img.offsetWidth) / 2;
    const originY = (vh - img.offsetHeight) / 2;
    // Allow panning until only 20% of the scaled image remains visible
    const margin = 0.2;
    const minX = -(iw * (1 - margin)) + vw * 0.1 - originX;
    const maxX = vw * (1 - 0.1) - iw * margin - originX;
    const minY = -(ih * (1 - margin)) + vh * 0.1 - originY;
    const maxY = vh * (1 - 0.1) - ih * margin - originY;
    return {
      panX: Math.max(minX, Math.min(maxX, px)),
      panY: Math.max(minY, Math.min(maxY, py)),
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset on image change
  useEffect(() => {
    setView({ scale: 1, panX: 0, panY: 0, isPanning: false });
  }, [zoomState.imageUrl]);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? SCROLL_ZOOM_STEP : 1 / SCROLL_ZOOM_STEP;
      setView((prev) => {
        const ns = clampScale(prev.scale * factor);
        const r = ns / prev.scale;
        const rawPanX = vx - r * (vx - prev.panX);
        const rawPanY = vy - r * (vy - prev.panY);
        const clamped = clampPan(rawPanX, rawPanY, ns);
        return { ...prev, scale: ns, ...clamped };
      });
    },
    [clampPan],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
      didPanRef.current = false;
      setView((prev) => ({ ...prev, isPanning: true }));
    },
    [view.panX, view.panY],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
      setView((prev) => {
        const rawPanX = panStartRef.current!.panX + dx;
        const rawPanY = panStartRef.current!.panY + dy;
        const clamped = clampPan(rawPanX, rawPanY, prev.scale);
        return { ...prev, ...clamped };
      });
    },
    [clampPan],
  );

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
    setView((prev) => ({ ...prev, isPanning: false }));
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didPanRef.current) {
        didPanRef.current = false;
        return;
      }
      // Click to zoom in, ctrl+click to zoom out
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      const factor = e.ctrlKey || e.metaKey ? 1 / ZOOM_STEP : ZOOM_STEP;
      setView((prev) => {
        const ns = clampScale(prev.scale * factor);
        const r = ns / prev.scale;
        const rawPanX = vx - r * (vx - prev.panX);
        const rawPanY = vy - r * (vy - prev.panY);
        const clamped = clampPan(rawPanX, rawPanY, ns);
        return { ...prev, scale: ns, ...clamped };
      });
    },
    [clampPan],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!zoomState.imageUrl) return null;

  return createPortal(
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image zoom"
      className="fixed inset-0 z-[120] bg-black/50 dark:bg-black/60 animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all z-[130]"
        onClick={onClose}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Top-left zoom info */}
      <div className="absolute top-8 left-8 z-[130] flex items-center space-x-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-100 dark:border-zinc-700 shadow-sm">
          {Math.round(view.scale * 100)}%
        </span>
        {view.scale !== 1 && (
          <button
            onClick={() => setView({ scale: 1, panX: 0, panY: 0, isPanning: false })}
            className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-3 py-2 rounded-full border border-zinc-100 dark:border-zinc-700 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Card info */}
      {zoomState.cardText && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[130] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-6 py-3 rounded-full border border-zinc-100 dark:border-zinc-700 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            {zoomState.cardText}
          </span>
        </div>
      )}

      {/* Viewport */}
      <div
        ref={viewportRef}
        className={`absolute inset-0 flex items-center justify-center overflow-hidden select-none ${view.isPanning ? 'cursor-grabbing' : 'cursor-zoom-in'}`}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})`,
            transformOrigin: '0 0',
            transition: view.isPanning ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <img
            ref={imgRef}
            src={zoomState.imageUrl}
            alt="Zoom View"
            draggable={false}
            className="max-w-[90vw] max-h-[85vh] object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_50px_100px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_50px_100px_rgba(0,0,0,0.3)]"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ZoomOverlay;
