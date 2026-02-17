import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomViewState,
  AnnotationTool,
  NormalizedPoint,
  PinAnnotation,
  RectangleAnnotation,
  ArrowAnnotation,
  SketchAnnotation,
  ImageVersion,
  Palette,
} from '../../types';
import AnnotationToolbar from './AnnotationToolbar';
import { useAnnotations, createAnnotationId } from '../../hooks/useAnnotations';
import { renderAnnotations, canvasToNormalized, hitTestAnnotation, hitTestHandle, HandleType, RubberBand } from './CanvasRenderer';
import PinEditor from './PinEditor';
import RectangleEditor from './RectangleEditor';
import { simplifyPath } from '../../utils/geometry';
import { generateRedlineMap } from '../../utils/redline';
import { executeModification, executeContentModification } from '../../utils/modificationEngine';
import { useVersionHistory } from '../../hooks/useVersionHistory';

export interface AnnotationToolbarState {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationCount: number;
  onDiscardMarks: () => void;
  onModify: () => void;
  isModifying: boolean;
  activeColor: string;
  onColorChange: (color: string) => void;
  palette?: Palette;
  contentDirty?: boolean;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRequestFullscreen?: () => void;
  globalInstruction: string;
  onGlobalInstructionChange: (text: string) => void;
}

export interface AnnotationWorkbenchProps {
  imageUrl: string;
  headingId?: string | null;
  headingText?: string | null;
  palette?: Palette | null;
  style?: string;
  aspectRatio?: string;
  resolution?: string;
  imageHistory?: ImageVersion[];
  mode: 'inline' | 'fullscreen';
  onImageModified?: (headingId: string, newImageUrl: string, history: ImageVersion[]) => void;
  onRequestFullscreen?: () => void;
  contentDirty?: boolean;
  currentContent?: string;
  onZoomChange?: (scale: number) => void;
  onToolbarStateChange?: (state: AnnotationToolbarState) => void;
  overlay?: React.ReactNode;
}

const INLINE_MIN_SCALE = 0.5;
const INLINE_MAX_SCALE = 2.0;
const FULLSCREEN_MIN_SCALE = 0.5;
const FULLSCREEN_MAX_SCALE = 4.0;
const ZOOM_STEP = 0.05;
const SCROLL_ZOOM_STEP = 0.05;
const MIN_RECT_SIZE = 0.01;
const MIN_ARROW_LENGTH = 0.02;
const DEFAULT_SKETCH_STROKE_WIDTH = 0.025;
const DEFAULT_ANNOTATION_COLOR = '#E63946';

const AnnotationWorkbench: React.FC<AnnotationWorkbenchProps> = ({
  imageUrl,
  headingId,
  headingText,
  palette,
  style,
  aspectRatio,
  resolution,
  imageHistory,
  mode,
  onImageModified,
  onRequestFullscreen,
  contentDirty,
  currentContent,
  onZoomChange,
  onToolbarStateChange,
  overlay,
}) => {
  const isInline = mode === 'inline';
  const MIN_SCALE = isInline ? INLINE_MIN_SCALE : FULLSCREEN_MIN_SCALE;
  const MAX_SCALE = isInline ? INLINE_MAX_SCALE : FULLSCREEN_MAX_SCALE;

  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [zoomView, setZoomView] = useState<ZoomViewState>({ scale: 1, panX: 0, panY: 0, isPanning: false });
  const [imageNaturals, setImageNaturals] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  const [activeColor, setActiveColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [globalInstruction, setGlobalInstruction] = useState('');

  // Notify parent of zoom changes
  useEffect(() => {
    onZoomChange?.(zoomView.scale);
  }, [zoomView.scale, onZoomChange]);

  // Ref for toolbar state change callback (avoids re-triggering effect on parent re-render)
  const onToolbarStateChangeRef = useRef(onToolbarStateChange);
  onToolbarStateChangeRef.current = onToolbarStateChange;

  // Modification state
  const [isModifying, setIsModifying] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // Version history
  const {
    versions,
    currentIndex,
    canUndo,
    canRedo,
    modificationCount,
    pushVersion,
    restorePrevious,
    restoreNext,
    restoreByIndex,
  } = useVersionHistory(imageHistory, imageUrl);

  // Annotation state
  const { annotations, selectedAnnotationId, add, update, remove, select, clearAll, moveAnnotation } = useAnnotations();

  // Editor popover state
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editingRectId, setEditingRectId] = useState<string | null>(null);
  const [editingArrowId, setEditingArrowId] = useState<string | null>(null);
  const [editingSketchId, setEditingSketchId] = useState<string | null>(null);

  // Rubber-band state
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);
  const rectStartRef = useRef<NormalizedPoint | null>(null);
  const arrowStartRef = useRef<NormalizedPoint | null>(null);
  const sketchPointsRef = useRef<NormalizedPoint[]>([]);
  const isSketchingRef = useRef(false);

  // Select tool: drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ annotationId: string; startNorm: NormalizedPoint; handle: HandleType } | null>(null);

  // Version strip visibility
  const [showVersionStrip, setShowVersionStrip] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const didPanRef = useRef(false);
  const animFrameRef = useRef<number>(0);

  const isEditing = editingPinId || editingRectId || editingArrowId || editingSketchId;
  const displayImageUrl = currentImageUrl || imageUrl;

  // Reset when image changes
  useEffect(() => {
    setZoomView({ scale: 1, panX: 0, panY: 0, isPanning: false });
    setActiveTool('select');
    clearAll();
    setEditingPinId(null);
    setEditingRectId(null);
    setEditingArrowId(null);
    setEditingSketchId(null);
    setRubberBand(null);
    setCurrentImageUrl(null);
    setModifyError(null);
    setShowVersionStrip(false);
    setGlobalInstruction('');
  }, [imageUrl]);

  // Keyboard: modifier tracking + shortcuts
  useEffect(() => {
    const target = isInline ? viewportRef.current : window;
    if (!target) return;

    const handleKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') {
        if (isModifying) return;
        if (isEditing) {
          setEditingPinId(null);
          setEditingRectId(null);
          setEditingArrowId(null);
          setEditingSketchId(null);
          return;
        }
        if (selectedAnnotationId) {
          select(null);
          return;
        }
      }
      if (ke.key === 'Delete' || ke.key === 'Backspace') {
        if (selectedAnnotationId && !isEditing) {
          remove(selectedAnnotationId);
        }
      }
      if (ke.key === 'Control' || ke.key === 'Meta') setCtrlHeld(true);
      if (ke.key === 'Alt') { ke.preventDefault(); setAltHeld(true); }
    };
    const handleKeyUp = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Control' || ke.key === 'Meta') setCtrlHeld(false);
      if (ke.key === 'Alt') setAltHeld(false);
    };

    target.addEventListener('keydown', handleKeyDown);
    target.addEventListener('keyup', handleKeyUp);
    return () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedAnnotationId, isEditing, isModifying, select, remove, isInline]);

  // Image load
  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      setImageNaturals({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  }, []);

  // Sync canvas size
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const sync = () => {
      const dw = img.offsetWidth;
      const dh = img.offsetHeight;
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(img);
    return () => observer.disconnect();
  }, [imageNaturals]);

  // Canvas render loop
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderAnnotations(ctx, annotations, selectedAnnotationId, canvas.width, canvas.height, rubberBand);
      animFrameRef.current = requestAnimationFrame(render);
    };
    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [annotations, selectedAnnotationId, rubberBand]);

  // --- Coordinate helpers ---
  const getCanvasCoords = (e: React.MouseEvent): { cx: number; cy: number } | null => {
    const img = imgRef.current;
    if (!img) return null;
    const imgRect = img.getBoundingClientRect();
    const cx = (e.clientX - imgRect.left) / zoomView.scale;
    const cy = (e.clientY - imgRect.top) / zoomView.scale;
    return { cx, cy };
  };

  const getNormCoords = (e: React.MouseEvent): NormalizedPoint | null => {
    const img = imgRef.current;
    if (!img) return null;
    const coords = getCanvasCoords(e);
    if (!coords) return null;
    return canvasToNormalized(coords.cx, coords.cy, img.offsetWidth, img.offsetHeight);
  };

  // --- Zoom helpers ---
  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const direction = e.deltaY < 0 ? 1 : -1;
    setZoomView(prev => {
      const ns = clampScale(prev.scale + direction * SCROLL_ZOOM_STEP);
      const r = ns / prev.scale;
      return { ...prev, scale: ns, panX: vx - r * (vx - prev.panX), panY: vy - r * (vy - prev.panY) };
    });
  }, [MIN_SCALE, MAX_SCALE]);

  const zoomToward = useCallback((vx: number, vy: number, newScale: number) => {
    setZoomView(prev => {
      const c = clampScale(newScale);
      const r = c / prev.scale;
      return { ...prev, scale: c, panX: vx - r * (vx - prev.panX), panY: vy - r * (vy - prev.panY) };
    });
  }, [MIN_SCALE, MAX_SCALE]);

  // Center-based zoom in/out (for toolbar buttons)
  const handleZoomIn = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    zoomToward(rect.width / 2, rect.height / 2, zoomView.scale + ZOOM_STEP);
  }, [zoomView.scale, zoomToward]);

  const handleZoomOut = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    zoomToward(rect.width / 2, rect.height / 2, zoomView.scale - ZOOM_STEP);
  }, [zoomView.scale, zoomToward]);

  const handleZoomReset = useCallback(() => {
    setZoomView({ scale: 1, panX: 0, panY: 0, isPanning: false });
  }, []);

  // --- VERSION HISTORY HELPERS ---
  const handleRestorePrevious = useCallback(() => {
    const url = restorePrevious();
    if (url) { setCurrentImageUrl(url); clearAll(); select(null); }
  }, [restorePrevious, clearAll, select]);

  const handleRestoreNext = useCallback(() => {
    const url = restoreNext();
    if (url) { setCurrentImageUrl(url); clearAll(); select(null); }
  }, [restoreNext, clearAll, select]);

  const handleRestoreByIndex = useCallback((index: number) => {
    const url = restoreByIndex(index);
    if (url) { setCurrentImageUrl(url); clearAll(); select(null); }
  }, [restoreByIndex, clearAll, select]);

  // --- MODIFICATION ENGINE ---
  const canModify = annotations.length > 0 || !!contentDirty || !!globalInstruction.trim();

  const handleModify = useCallback(async () => {
    if (!canModify || isModifying) return;
    if (!displayImageUrl) return;

    const hasAnnotations = annotations.length > 0;
    const hasGlobalText = !!globalInstruction.trim();
    const isContentOnly = !hasAnnotations && !hasGlobalText && !!contentDirty && !!currentContent;

    // Annotation-based modification needs image naturals for redline
    if (hasAnnotations && (imageNaturals.w === 0 || imageNaturals.h === 0)) return;

    setIsModifying(true);
    setModifyError(null);

    try {
      let result;

      if (isContentOnly) {
        // Content-only: send reference image + new content
        result = await executeContentModification({
          originalImageUrl: displayImageUrl,
          content: currentContent,
          headingText,
          style,
          palette: palette ? {
            background: palette.background,
            primary: palette.primary,
            secondary: palette.secondary,
            accent: palette.accent,
            text: palette.text,
          } : undefined,
          aspectRatio,
          resolution,
        });
      } else {
        // Annotation-based (or global instruction): send original + redline + instructions
        const { redlineDataUrl, instructions } = hasAnnotations
          ? generateRedlineMap(annotations, imageNaturals.w, imageNaturals.h)
          : { redlineDataUrl: '', instructions: '' };

        // Prepend global instruction before spatial annotations
        let combinedInstructions = '';
        if (hasGlobalText) {
          combinedInstructions += `[GLOBAL INSTRUCTION]: "${globalInstruction.trim()}"`;
          if (instructions) combinedInstructions += '\n\n';
        }
        if (instructions) combinedInstructions += instructions;

        result = await executeModification({
          originalImageUrl: displayImageUrl,
          redlineDataUrl,
          instructions: combinedInstructions,
          headingText,
          aspectRatio,
          resolution,
        });
      }

      setCurrentImageUrl(result.newImageUrl);
      const label = isContentOnly
        ? `Content Update ${modificationCount + 1}`
        : `Modification ${modificationCount + 1}`;
      pushVersion(result.newImageUrl, label);
      clearAll();
      select(null);
      setGlobalInstruction('');

      if (onImageModified && headingId) {
        const updatedVersions: ImageVersion[] = [
          ...versions.slice(0, currentIndex + 1),
          { imageUrl: result.newImageUrl, timestamp: Date.now(), label },
        ];
        while (updatedVersions.length > 10) updatedVersions.shift();
        onImageModified(headingId, result.newImageUrl, updatedVersions);
      }
    } catch (err: any) {
      console.error('Modification failed:', err);
      setModifyError(err.message || 'Modification failed. Please try again.');
    } finally {
      setIsModifying(false);
    }
  }, [canModify, isModifying, annotations, globalInstruction, contentDirty, currentContent, imageNaturals, displayImageUrl, headingText, headingId, style, palette, aspectRatio, resolution, onImageModified, clearAll, select, pushVersion, modificationCount, versions, currentIndex]);

  // Refs to avoid stale closures in toolbar state callback
  const handleModifyRef = useRef(handleModify);
  handleModifyRef.current = handleModify;
  const handleZoomInRef = useRef(handleZoomIn);
  handleZoomInRef.current = handleZoomIn;
  const handleZoomOutRef = useRef(handleZoomOut);
  handleZoomOutRef.current = handleZoomOut;

  // Notify parent of toolbar state changes
  useEffect(() => {
    onToolbarStateChangeRef.current?.({
      activeTool,
      onToolChange: setActiveTool,
      annotationCount: annotations.length,
      onDiscardMarks: clearAll,
      onModify: () => handleModifyRef.current(),
      isModifying,
      activeColor,
      onColorChange: (color: string) => setActiveColor(color),
      palette: palette || undefined,
      contentDirty,
      hasSelection: !!selectedAnnotationId,
      onDeleteSelected: () => { if (selectedAnnotationId) remove(selectedAnnotationId); },
      zoomScale: zoomView.scale,
      onZoomIn: () => handleZoomInRef.current(),
      onZoomOut: () => handleZoomOutRef.current(),
      onZoomReset: handleZoomReset,
      onRequestFullscreen: isInline ? onRequestFullscreen : undefined,
      globalInstruction,
      onGlobalInstructionChange: (text: string) => setGlobalInstruction(text),
    });
  }, [activeTool, annotations.length, isModifying, activeColor, palette, contentDirty, selectedAnnotationId, clearAll, remove, zoomView.scale, globalInstruction]);

  // --- Mouse handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing || isModifying) return;

    const norm = getNormCoords(e);
    const canvas = canvasRef.current;
    const coords = getCanvasCoords(e);

    // PAN: zoom tool + alt
    if (activeTool === 'zoom' && altHeld) {
      e.preventDefault();
      e.stopPropagation();
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: zoomView.panX, panY: zoomView.panY };
      didPanRef.current = false;
      setZoomView(prev => ({ ...prev, isPanning: true }));
      return;
    }

    // SELECT TOOL
    if (activeTool === 'select' && coords && canvas) {
      if (selectedAnnotationId) {
        const selAnn = annotations.find(a => a.id === selectedAnnotationId);
        if (selAnn) {
          const handle = hitTestHandle(selAnn, coords.cx, coords.cy, canvas.width, canvas.height);
          if (handle && norm) {
            e.preventDefault();
            e.stopPropagation();
            dragStartRef.current = { annotationId: selectedAnnotationId, startNorm: norm, handle };
            setIsDragging(true);
            return;
          }
        }
      }
      const hitId = hitTestAnnotation(annotations, coords.cx, coords.cy, canvas.width, canvas.height);
      if (hitId && norm) {
        e.preventDefault();
        e.stopPropagation();
        select(hitId);
        dragStartRef.current = { annotationId: hitId, startNorm: norm, handle: null };
        setIsDragging(true);
        return;
      }
      select(null);
      if (zoomView.scale > 1) {
        e.preventDefault();
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: zoomView.panX, panY: zoomView.panY };
        didPanRef.current = false;
        setZoomView(prev => ({ ...prev, isPanning: true }));
      }
      return;
    }

    // RECTANGLE TOOL
    if (activeTool === 'rectangle' && norm) {
      e.preventDefault();
      e.stopPropagation();
      rectStartRef.current = norm;
      setRubberBand({ type: 'rectangle', topLeft: norm, bottomRight: norm, color: activeColor });
      return;
    }

    // ARROW TOOL
    if (activeTool === 'arrow' && norm) {
      e.preventDefault();
      e.stopPropagation();
      arrowStartRef.current = norm;
      setRubberBand({ type: 'arrow', start: norm, end: norm, color: activeColor });
      return;
    }

    // SKETCH TOOL
    if (activeTool === 'sketch' && norm) {
      e.preventDefault();
      e.stopPropagation();
      isSketchingRef.current = true;
      sketchPointsRef.current = [norm];
      setRubberBand({ type: 'sketch', points: [norm], color: activeColor, strokeWidth: DEFAULT_SKETCH_STROKE_WIDTH });
      return;
    }
  }, [activeTool, altHeld, zoomView, annotations, selectedAnnotationId, activeColor, isEditing, isModifying, select]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panStartRef.current) {
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
      setZoomView(prev => ({ ...prev, panX: panStartRef.current!.panX + dx, panY: panStartRef.current!.panY + dy }));
      return;
    }

    if (rectStartRef.current && activeTool === 'rectangle') {
      const norm = getNormCoords(e);
      if (!norm) return;
      const s = rectStartRef.current;
      setRubberBand({
        type: 'rectangle',
        topLeft: { x: Math.min(s.x, norm.x), y: Math.min(s.y, norm.y) },
        bottomRight: { x: Math.max(s.x, norm.x), y: Math.max(s.y, norm.y) },
        color: activeColor,
      });
      return;
    }

    if (arrowStartRef.current && activeTool === 'arrow') {
      const norm = getNormCoords(e);
      if (!norm) return;
      setRubberBand({ type: 'arrow', start: arrowStartRef.current, end: norm, color: activeColor });
      return;
    }

    if (isSketchingRef.current && activeTool === 'sketch') {
      const norm = getNormCoords(e);
      if (!norm) return;
      sketchPointsRef.current.push(norm);
      setRubberBand({ type: 'sketch', points: [...sketchPointsRef.current], color: activeColor, strokeWidth: DEFAULT_SKETCH_STROKE_WIDTH });
      return;
    }

    if (isDragging && dragStartRef.current) {
      const norm = getNormCoords(e);
      if (!norm) return;
      const { annotationId, startNorm, handle } = dragStartRef.current;
      const dx = norm.x - startNorm.x;
      const dy = norm.y - startNorm.y;

      if (handle) {
        const ann = annotations.find(a => a.id === annotationId);
        if (ann && ann.type === 'rectangle') {
          const newRect = { ...ann };
          if (handle === 'tl') {
            newRect.topLeft = { x: Math.min(norm.x, ann.bottomRight.x - 0.01), y: Math.min(norm.y, ann.bottomRight.y - 0.01) };
          } else if (handle === 'tr') {
            newRect.topLeft = { ...ann.topLeft, y: Math.min(norm.y, ann.bottomRight.y - 0.01) };
            newRect.bottomRight = { ...ann.bottomRight, x: Math.max(norm.x, ann.topLeft.x + 0.01) };
          } else if (handle === 'bl') {
            newRect.topLeft = { ...ann.topLeft, x: Math.min(norm.x, ann.bottomRight.x - 0.01) };
            newRect.bottomRight = { ...ann.bottomRight, y: Math.max(norm.y, ann.topLeft.y + 0.01) };
          } else if (handle === 'br') {
            newRect.bottomRight = { x: Math.max(norm.x, ann.topLeft.x + 0.01), y: Math.max(norm.y, ann.topLeft.y + 0.01) };
          }
          update(annotationId, { topLeft: newRect.topLeft, bottomRight: newRect.bottomRight });
          dragStartRef.current = { ...dragStartRef.current, startNorm: norm };
        } else if (ann && ann.type === 'arrow') {
          if (handle === 'start') update(annotationId, { start: norm });
          else if (handle === 'end') update(annotationId, { end: norm });
          dragStartRef.current = { ...dragStartRef.current, startNorm: norm };
        }
      } else {
        moveAnnotation(annotationId, dx, dy);
        dragStartRef.current = { ...dragStartRef.current, startNorm: norm };
      }
      return;
    }
  }, [activeTool, activeColor, isDragging, annotations, update, moveAnnotation]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (panStartRef.current) {
      panStartRef.current = null;
      setZoomView(prev => ({ ...prev, isPanning: false }));
      return;
    }

    if (rectStartRef.current && activeTool === 'rectangle') {
      const norm = getNormCoords(e);
      if (norm) {
        const s = rectStartRef.current;
        const tl: NormalizedPoint = { x: Math.min(s.x, norm.x), y: Math.min(s.y, norm.y) };
        const br: NormalizedPoint = { x: Math.max(s.x, norm.x), y: Math.max(s.y, norm.y) };
        if (br.x - tl.x >= MIN_RECT_SIZE && br.y - tl.y >= MIN_RECT_SIZE) {
          const newRect: RectangleAnnotation = {
            id: createAnnotationId(), type: 'rectangle', color: activeColor, createdAt: Date.now(),
            topLeft: tl, bottomRight: br, instruction: '',
          };
          add(newRect);
          setEditingRectId(newRect.id);
        }
      }
      rectStartRef.current = null;
      setRubberBand(null);
      return;
    }

    if (arrowStartRef.current && activeTool === 'arrow') {
      const norm = getNormCoords(e);
      if (norm) {
        const s = arrowStartRef.current;
        const length = Math.sqrt((norm.x - s.x) ** 2 + (norm.y - s.y) ** 2);
        if (length >= MIN_ARROW_LENGTH) {
          const newArrow: ArrowAnnotation = {
            id: createAnnotationId(), type: 'arrow', color: activeColor, createdAt: Date.now(),
            start: s, end: norm, instruction: '',
          };
          add(newArrow);
          setEditingArrowId(newArrow.id);
        }
      }
      arrowStartRef.current = null;
      setRubberBand(null);
      return;
    }

    if (isSketchingRef.current && activeTool === 'sketch') {
      const points = sketchPointsRef.current;
      if (points.length >= 2) {
        const simplified = simplifyPath(points, 0.003);
        const newSketch: SketchAnnotation = {
          id: createAnnotationId(), type: 'sketch', color: activeColor, createdAt: Date.now(),
          points: simplified, strokeWidth: DEFAULT_SKETCH_STROKE_WIDTH, instruction: '',
        };
        add(newSketch);
        setEditingSketchId(newSketch.id);
      }
      isSketchingRef.current = false;
      sketchPointsRef.current = [];
      setRubberBand(null);
      return;
    }

    if (isDragging) {
      dragStartRef.current = null;
      setIsDragging(false);
      return;
    }
  }, [activeTool, activeColor, isDragging, add]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didPanRef.current) { didPanRef.current = false; return; }
    if (isEditing || isModifying) return;

    if (activeTool === 'zoom' && !altHeld) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      if (ctrlHeld) zoomToward(vx, vy, zoomView.scale - ZOOM_STEP);
      else zoomToward(vx, vy, zoomView.scale + ZOOM_STEP);
      return;
    }

    if (activeTool === 'pin') {
      const norm = getNormCoords(e);
      if (!norm) return;
      const newPin: PinAnnotation = {
        id: createAnnotationId(), type: 'pin', color: activeColor, createdAt: Date.now(),
        position: norm, instruction: '',
      };
      add(newPin);
      setEditingPinId(newPin.id);
      return;
    }

    if (activeTool === 'select' && selectedAnnotationId) {
      const selAnn = annotations.find(a => a.id === selectedAnnotationId);
      if (selAnn?.type === 'pin') setEditingPinId(selectedAnnotationId);
      else if (selAnn?.type === 'rectangle') setEditingRectId(selectedAnnotationId);
      else if (selAnn?.type === 'arrow') setEditingArrowId(selectedAnnotationId);
      else if (selAnn?.type === 'sketch') setEditingSketchId(selectedAnnotationId);
    }
  }, [activeTool, altHeld, ctrlHeld, zoomView.scale, zoomToward, activeColor, add, selectedAnnotationId, annotations, isEditing, isModifying]);

  // --- Editor popover screen positions ---
  const getAnnotationScreenPos = (id: string): { x: number; y: number } => {
    const ann = annotations.find(a => a.id === id);
    const img = imgRef.current;
    if (!ann || !img) return { x: 0, y: 0 };
    const imgRect = img.getBoundingClientRect();
    if (ann.type === 'pin') {
      return {
        x: imgRect.left + ann.position.x * img.offsetWidth * zoomView.scale,
        y: imgRect.top + ann.position.y * img.offsetHeight * zoomView.scale,
      };
    }
    if (ann.type === 'rectangle') {
      const midX = (ann.topLeft.x + ann.bottomRight.x) / 2;
      return {
        x: imgRect.left + midX * img.offsetWidth * zoomView.scale,
        y: imgRect.top + ann.topLeft.y * img.offsetHeight * zoomView.scale,
      };
    }
    if (ann.type === 'arrow') {
      const midX = (ann.start.x + ann.end.x) / 2;
      const midY = (ann.start.y + ann.end.y) / 2;
      return {
        x: imgRect.left + midX * img.offsetWidth * zoomView.scale,
        y: imgRect.top + midY * img.offsetHeight * zoomView.scale,
      };
    }
    if (ann.type === 'sketch' && ann.points.length > 0) {
      let minX = 1, maxX = 0, minY = 1;
      for (const p of ann.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
      }
      const midX = (minX + maxX) / 2;
      return {
        x: imgRect.left + midX * img.offsetWidth * zoomView.scale,
        y: imgRect.top + minY * img.offsetHeight * zoomView.scale,
      };
    }
    return { x: 0, y: 0 };
  };

  const getCursorClass = () => {
    if (isModifying) return 'zoom-tool-select';
    if (activeTool === 'zoom') {
      if (zoomView.isPanning) return 'zoom-tool-zoom alt-held panning';
      if (altHeld) return 'zoom-tool-zoom alt-held';
      if (ctrlHeld) return 'zoom-tool-zoom ctrl-held';
      return 'zoom-tool-zoom';
    }
    if (activeTool === 'select') return 'zoom-tool-select';
    if (activeTool === 'pin') return 'zoom-tool-pin';
    if (activeTool === 'text') return 'zoom-tool-select';
    if (activeTool === 'rectangle' || activeTool === 'arrow' || activeTool === 'sketch') return 'zoom-tool-crosshair';
    return 'zoom-tool-crosshair';
  };

  const handleColorChange = useCallback((color: string) => setActiveColor(color), []);

  const handleMouseLeave = useCallback(() => {
    panStartRef.current = null;
    if (rectStartRef.current) { rectStartRef.current = null; setRubberBand(null); }
    if (arrowStartRef.current) { arrowStartRef.current = null; setRubberBand(null); }
    if (isSketchingRef.current) {
      const points = sketchPointsRef.current;
      if (points.length >= 2) {
        const simplified = simplifyPath(points, 0.003);
        const sketchId = createAnnotationId();
        add({
          id: sketchId, type: 'sketch', color: activeColor, createdAt: Date.now(),
          points: simplified, strokeWidth: DEFAULT_SKETCH_STROKE_WIDTH, instruction: '',
        });
        setEditingSketchId(sketchId);
      }
      isSketchingRef.current = false;
      sketchPointsRef.current = [];
      setRubberBand(null);
    }
    if (isDragging) { dragStartRef.current = null; setIsDragging(false); }
    setZoomView(prev => ({ ...prev, isPanning: false }));
  }, [activeColor, isDragging, add]);

  if (!displayImageUrl) return null;

  const editingPin = editingPinId ? annotations.find(a => a.id === editingPinId && a.type === 'pin') as PinAnnotation | undefined : undefined;
  const editingRect = editingRectId ? annotations.find(a => a.id === editingRectId && a.type === 'rectangle') as RectangleAnnotation | undefined : undefined;
  const editingArrow = editingArrowId ? annotations.find(a => a.id === editingArrowId && a.type === 'arrow') as ArrowAnnotation | undefined : undefined;
  const editingSketch = editingSketchId ? annotations.find(a => a.id === editingSketchId && a.type === 'sketch') as SketchAnnotation | undefined : undefined;

  const imageClasses = isInline
    ? 'w-full object-contain'
    : 'max-w-[90vw] max-h-[85vh] object-contain shadow-[0_50px_100px_rgba(0,0,0,0.1)]';

  return (
    <div className="relative w-full h-full" tabIndex={isInline ? 0 : undefined} style={{ outline: 'none' }}>
      {/* Top-right controls: version history + fullscreen */}
      <div className={`absolute top-3 right-3 z-[15] flex items-center space-x-2`}>
        {versions.length > 1 && (
          <>
            <button
              onClick={handleRestorePrevious}
              disabled={!canUndo || isModifying}
              title="Undo"
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                canUndo && !isModifying
                  ? 'bg-white/80 backdrop-blur-sm border border-zinc-100 text-zinc-500 hover:text-zinc-900'
                  : 'bg-white/40 border border-zinc-50 text-zinc-200 cursor-not-allowed'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
              </svg>
            </button>
            <button
              onClick={handleRestoreNext}
              disabled={!canRedo || isModifying}
              title="Redo"
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                canRedo && !isModifying
                  ? 'bg-white/80 backdrop-blur-sm border border-zinc-100 text-zinc-500 hover:text-zinc-900'
                  : 'bg-white/40 border border-zinc-50 text-zinc-200 cursor-not-allowed'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 14l5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
              </svg>
            </button>
            <button
              onClick={() => setShowVersionStrip(!showVersionStrip)}
              title="Version History"
              className="text-[8px] font-bold text-zinc-400 bg-white/80 backdrop-blur-sm px-2 py-1.5 rounded-full border border-zinc-100 hover:text-zinc-900 transition-colors"
            >
              v{currentIndex + 1}/{versions.length}
            </button>
          </>
        )}
      </div>

      {/* Version history thumbnail strip */}
      {showVersionStrip && versions.length > 1 && (
        <div className={`absolute top-12 right-3 z-[16] bg-white/95 backdrop-blur-xl rounded-[6px] border border-black p-3 animate-in fade-in slide-in-from-top-2 duration-200 ${isInline ? 'max-w-[280px]' : 'max-w-[400px]'}`}>
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-black mb-2 px-1">Version History</div>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {versions.map((v, i) => (
              <button
                key={`${v.timestamp}-${i}`}
                onClick={() => handleRestoreByIndex(i)}
                disabled={isModifying}
                title={`${v.label} — ${new Date(v.timestamp).toLocaleTimeString()}`}
                className={`relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition-all hover:scale-110 ${
                  i === currentIndex
                    ? 'border-[#ccff00] shadow-[0_0_0_2px_rgba(204,255,0,0.3)]'
                    : 'border-zinc-200 hover:border-zinc-400'
                } ${isModifying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <img src={v.imageUrl} alt={v.label} className="w-full h-full object-cover" />
                {i === currentIndex && <div className="absolute inset-0 bg-[#ccff00]/10" />}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[7px] text-zinc-300">{versions[currentIndex]?.label}</span>
            <span className="text-[7px] text-zinc-300">
              {versions[currentIndex] ? new Date(versions[currentIndex].timestamp).toLocaleTimeString() : ''}
            </span>
          </div>
        </div>
      )}

      {/* Modification overlay */}
      {isModifying && (
        <div className="absolute inset-0 z-[18] flex items-center justify-center bg-[#ccff00]/10 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center space-y-3 animate-pulse">
            <div className="w-12 h-12 rounded-full border-4 border-[#ccff00] border-t-transparent animate-spin" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-700">Refining...</span>
            <span className="text-[9px] text-zinc-400 max-w-[240px] text-center">AI is applying your modifications</span>
          </div>
        </div>
      )}

      {/* Error toast */}
      {modifyError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[20] bg-red-50 border border-red-200 rounded-2xl px-4 py-2 flex items-center space-x-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span className="text-[10px] text-red-700 max-w-[300px]">{modifyError}</span>
          <button onClick={() => setModifyError(null)} className="text-red-400 hover:text-red-600 transition-colors ml-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Viewport */}
      <div
        ref={viewportRef}
        tabIndex={0}
        className={`relative w-full h-full overflow-hidden select-none outline-none ${getCursorClass()}`}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Transform layer */}
        <div
          className={`absolute inset-0 flex items-center justify-center`}
          style={{
            transform: `translate(${zoomView.panX}px, ${zoomView.panY}px) scale(${zoomView.scale})`,
            transformOrigin: '0 0',
            transition: zoomView.isPanning || isDragging || rubberBand ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <div className="relative inline-block">
            <img
              ref={imgRef}
              src={displayImageUrl}
              alt="Asset"
              draggable={false}
              onLoad={handleImageLoad}
              className={imageClasses}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{}}
            />
            {overlay}
          </div>
        </div>
      </div>

      {/* Pin Editor Popover */}
      {editingPin && editingPinId && (
        <PinEditor
          instruction={editingPin.instruction}
          position={getAnnotationScreenPos(editingPinId)}
          onSave={(instruction) => update(editingPinId, { instruction })}
          onDelete={() => { remove(editingPinId); setEditingPinId(null); }}
          onClose={() => setEditingPinId(null)}
        />
      )}

      {/* Rectangle Editor Popover */}
      {editingRect && editingRectId && (
        <RectangleEditor
          instruction={editingRect.instruction}
          position={getAnnotationScreenPos(editingRectId)}
          onSave={(instruction) => update(editingRectId, { instruction })}
          onDelete={() => { remove(editingRectId); setEditingRectId(null); }}
          onClose={() => setEditingRectId(null)}
        />
      )}

      {/* Arrow Editor Popover */}
      {editingArrow && editingArrowId && (
        <RectangleEditor
          instruction={editingArrow.instruction}
          position={getAnnotationScreenPos(editingArrowId)}
          onSave={(instruction) => update(editingArrowId, { instruction })}
          onDelete={() => { remove(editingArrowId); setEditingArrowId(null); }}
          onClose={() => setEditingArrowId(null)}
        />
      )}

      {/* Sketch Editor Popover */}
      {editingSketch && editingSketchId && (
        <RectangleEditor
          instruction={editingSketch.instruction}
          position={getAnnotationScreenPos(editingSketchId)}
          onSave={(instruction) => update(editingSketchId, { instruction })}
          onDelete={() => { remove(editingSketchId); setEditingSketchId(null); }}
          onClose={() => setEditingSketchId(null)}
        />
      )}

      {/* Annotation Toolbar: render inline only if parent doesn't handle it */}
      {!onToolbarStateChange && (
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          annotationCount={annotations.length}
          onDiscardMarks={clearAll}
          onModify={handleModify}
          isModifying={isModifying}
          activeColor={activeColor}
          onColorChange={handleColorChange}
          palette={palette || undefined}
          contentDirty={contentDirty}
          hasSelection={!!selectedAnnotationId}
          onDeleteSelected={() => { if (selectedAnnotationId) remove(selectedAnnotationId); }}
          globalInstruction={globalInstruction}
          onGlobalInstructionChange={setGlobalInstruction}
        />
      )}
    </div>
  );
};

export default AnnotationWorkbench;
