import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomState, ZoomViewState } from '../types';

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
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const didPanRef = useRef(false);

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? SCROLL_ZOOM_STEP : 1 / SCROLL_ZOOM_STEP;
    setView(prev => {
      const ns = clampScale(prev.scale * factor);
      const r = ns / prev.scale;
      return { ...prev, scale: ns, panX: vx - r * (vx - prev.panX), panY: vy - r * (vy - prev.panY) };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
    didPanRef.current = false;
    setView(prev => ({ ...prev, isPanning: true }));
  }, [view.panX, view.panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
    setView(prev => ({ ...prev, panX: panStartRef.current!.panX + dx, panY: panStartRef.current!.panY + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
    setView(prev => ({ ...prev, isPanning: false }));
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didPanRef.current) { didPanRef.current = false; return; }
    // Click to zoom in, ctrl+click to zoom out
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const factor = e.ctrlKey || e.metaKey ? 1 / ZOOM_STEP : ZOOM_STEP;
    setView(prev => {
      const ns = clampScale(prev.scale * factor);
      const r = ns / prev.scale;
      return { ...prev, scale: ns, panX: vx - r * (vx - prev.panX), panY: vy - r * (vy - prev.panY) };
    });
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!zoomState.imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-50 border border-zinc-100 text-zinc-900 hover:bg-zinc-100 transition-all z-[110]"
        onClick={onClose}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>

      {/* Top-left zoom info */}
      <div className="absolute top-8 left-8 z-[110] flex items-center space-x-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-100 shadow-sm">
          {Math.round(view.scale * 100)}%
        </span>
        {view.scale !== 1 && (
          <button
            onClick={() => setView({ scale: 1, panX: 0, panY: 0, isPanning: false })}
            className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-full border border-zinc-100 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Heading info */}
      {zoomState.headingText && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border border-zinc-100 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">{zoomState.headingText}</span>
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
            src={zoomState.imageUrl}
            alt="Zoom View"
            draggable={false}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-[20px] shadow-[0_50px_100px_rgba(0,0,0,0.1)]"
          />
        </div>
      </div>
    </div>
  );
};

export default ZoomOverlay;
