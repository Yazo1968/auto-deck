import {
  Annotation,
  NormalizedPoint,
  PinAnnotation,
  RectangleAnnotation,
  ArrowAnnotation,
  SketchAnnotation,
} from '../../types';
import { distanceToSegment, distanceToPolyline, getBoundingBox } from '../../utils/geometry';

// --- Type guards for annotation union narrowing ---

const isPin = (a: Annotation): a is PinAnnotation => a.type === 'pin';
const isRectangle = (a: Annotation): a is RectangleAnnotation => a.type === 'rectangle';
const isArrow = (a: Annotation): a is ArrowAnnotation => a.type === 'arrow';
const isSketch = (a: Annotation): a is SketchAnnotation => a.type === 'sketch';

// --- Coordinate conversion helpers ---
// "logical" = the base display size (img.offsetWidth/Height), independent of zoom/DPR

const normalizedToCanvas = (p: NormalizedPoint, w: number, h: number): { x: number; y: number } => ({
  x: p.x * w,
  y: p.y * h,
});

export const canvasToNormalized = (cx: number, cy: number, w: number, h: number): NormalizedPoint => ({
  x: Math.max(0, Math.min(1, cx / w)),
  y: Math.max(0, Math.min(1, cy / h)),
});

// --- Hit testing (operates in logical/display coordinates) ---

const PIN_RADIUS_BASE = 10; // px at zoom 1
const HIT_TOLERANCE = 8; // px
const ARROW_HIT_TOLERANCE = 10; // px
const SKETCH_HIT_TOLERANCE = 20; // px — wider to match thick brush stroke

export const hitTestAnnotation = (
  annotations: Annotation[],
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
  zoomScale: number = 1,
): string | null => {
  // Mark sizes shrink with zoom, so hit radii must also shrink
  const s = Math.max(0.25, 1 / zoomScale);
  const pinRadius = PIN_RADIUS_BASE * s;
  const hitTol = HIT_TOLERANCE * s;
  const arrowHitTol = ARROW_HIT_TOLERANCE * s;
  const sketchHitTol = SKETCH_HIT_TOLERANCE * s;

  // Test in reverse order (topmost first)
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (isPin(a)) {
      const { x, y } = normalizedToCanvas(a.position, canvasW, canvasH);
      const dist = Math.sqrt((canvasX - x) ** 2 + (canvasY - y) ** 2);
      if (dist <= pinRadius + hitTol) return a.id;
    } else if (isRectangle(a)) {
      const tl = normalizedToCanvas(a.topLeft, canvasW, canvasH);
      const br = normalizedToCanvas(a.bottomRight, canvasW, canvasH);
      const margin = hitTol;
      if (
        canvasX >= tl.x - margin &&
        canvasX <= br.x + margin &&
        canvasY >= tl.y - margin &&
        canvasY <= br.y + margin
      ) {
        return a.id;
      }
    } else if (isArrow(a)) {
      const normPt = canvasToNormalized(canvasX, canvasY, canvasW, canvasH);
      const dist = distanceToSegment(normPt, a.start, a.end);
      const avgDim = (canvasW + canvasH) / 2;
      if (dist * avgDim <= arrowHitTol) return a.id;
    } else if (isSketch(a)) {
      if (a.points.length > 0) {
        const normPt = canvasToNormalized(canvasX, canvasY, canvasW, canvasH);
        const dist = distanceToPolyline(normPt, a.points);
        const avgDim = (canvasW + canvasH) / 2;
        if (dist * avgDim <= sketchHitTol) return a.id;
      }
    }
  }
  return null;
};

// --- Handle hit testing for resize ---

export type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'start' | 'end' | null;
const HANDLE_SIZE_BASE = 8;

export const hitTestHandle = (
  annotation: Annotation,
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
  zoomScale: number = 1,
): HandleType => {
  const s = Math.max(0.25, 1 / zoomScale);
  const handleSize = HANDLE_SIZE_BASE * s;

  if (isRectangle(annotation)) {
    const tl = normalizedToCanvas(annotation.topLeft, canvasW, canvasH);
    const br = normalizedToCanvas(annotation.bottomRight, canvasW, canvasH);
    const corners: { type: HandleType; x: number; y: number }[] = [
      { type: 'tl', x: tl.x, y: tl.y },
      { type: 'tr', x: br.x, y: tl.y },
      { type: 'bl', x: tl.x, y: br.y },
      { type: 'br', x: br.x, y: br.y },
    ];
    for (const c of corners) {
      if (Math.abs(canvasX - c.x) <= handleSize && Math.abs(canvasY - c.y) <= handleSize) {
        return c.type;
      }
    }
  } else if (isArrow(annotation)) {
    const s2 = normalizedToCanvas(annotation.start, canvasW, canvasH);
    const e = normalizedToCanvas(annotation.end, canvasW, canvasH);
    if (Math.abs(canvasX - s2.x) <= handleSize && Math.abs(canvasY - s2.y) <= handleSize) return 'start';
    if (Math.abs(canvasX - e.x) <= handleSize && Math.abs(canvasY - e.y) <= handleSize) return 'end';
  }
  return null;
};

// --- Rubber band types ---

interface RectangleRubberBand {
  type: 'rectangle';
  topLeft: NormalizedPoint;
  bottomRight: NormalizedPoint;
  color: string;
}

interface ArrowRubberBand {
  type: 'arrow';
  start: NormalizedPoint;
  end: NormalizedPoint;
  color: string;
}

interface SketchRubberBand {
  type: 'sketch';
  points: NormalizedPoint[];
  color: string;
  strokeWidth: number;
}

export type RubberBand = RectangleRubberBand | ArrowRubberBand | SketchRubberBand;

// --- Main render function ---
// canvasW/canvasH = the actual canvas buffer dimensions (may be upscaled for hi-DPI / zoom)
// logicalW/logicalH = the CSS display size of the canvas (img.offsetWidth/Height)
// zoomScale = current zoom level — annotation marks scale inversely to stay the same screen size

export const renderAnnotations = (
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId: string | null,
  canvasW: number,
  canvasH: number,
  rubberBand?: RubberBand | null,
  zoomScale: number = 1,
) => {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (canvasW === 0 || canvasH === 0) return;

  // s = inverse-zoom scaling factor for mark sizes (clamped so marks don't get infinitely large at low zoom)
  const s = Math.max(0.25, 1 / zoomScale);

  // Draw rubber-band (in-progress drawing)
  if (rubberBand) {
    if (rubberBand.type === 'rectangle') {
      const tl = normalizedToCanvas(rubberBand.topLeft, canvasW, canvasH);
      const br = normalizedToCanvas(rubberBand.bottomRight, canvasW, canvasH);
      ctx.save();
      ctx.strokeStyle = rubberBand.color;
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([8 * s, 4 * s]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.fillStyle = rubberBand.color + '10';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    } else if (rubberBand.type === 'arrow') {
      const sp = normalizedToCanvas(rubberBand.start, canvasW, canvasH);
      const ep = normalizedToCanvas(rubberBand.end, canvasW, canvasH);
      ctx.save();
      ctx.strokeStyle = rubberBand.color;
      ctx.lineWidth = 2.5 * s;
      ctx.setLineDash([6 * s, 4 * s]);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ep.x, ep.y);
      ctx.stroke();
      drawArrowhead(ctx, sp.x, sp.y, ep.x, ep.y, rubberBand.color, 12 * s);
      ctx.restore();
    } else if (rubberBand.type === 'sketch') {
      drawSketchPath(ctx, rubberBand.points, canvasW, canvasH, rubberBand.color, rubberBand.strokeWidth, false, s);
    }
  }

  // Number pins sequentially
  let pinIndex = 1;

  for (const a of annotations) {
    const isSelected = a.id === selectedId;

    if (isPin(a)) {
      drawPin(ctx, a, canvasW, canvasH, isSelected, pinIndex, s);
      pinIndex++;
    } else if (isRectangle(a)) {
      drawRectangle(ctx, a, canvasW, canvasH, isSelected, s);
    } else if (isArrow(a)) {
      drawArrow(ctx, a, canvasW, canvasH, isSelected, s);
    } else if (isSketch(a)) {
      drawSketch(ctx, a, canvasW, canvasH, isSelected, s);
    }
  }
};

// --- Individual annotation renderers ---

const drawPin = (
  ctx: CanvasRenderingContext2D,
  pin: PinAnnotation,
  w: number,
  h: number,
  isSelected: boolean,
  index: number,
  s: number = 1,
) => {
  const { x, y } = normalizedToCanvas(pin.position, w, h);
  const r = PIN_RADIUS_BASE * s;

  ctx.save();

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6 * s;
  ctx.shadowOffsetY = 2 * s;

  // Main circle
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = pin.color;
  ctx.fill();

  // Reset shadow for text
  ctx.shadowColor = 'transparent';

  // Selection ring
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, r + 4 * s, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a9fd4';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();
  }

  // Number label
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(10 * s, r)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index), x, y);

  // Instruction indicator (small dot if has instruction)
  if (pin.instruction) {
    ctx.beginPath();
    ctx.arc(x + r - 2 * s, y - r + 2 * s, 3 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#2a9fd4';
    ctx.fill();
  }

  ctx.restore();
};

const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  rect: RectangleAnnotation,
  w: number,
  h: number,
  isSelected: boolean,
  s: number = 1,
) => {
  const tl = normalizedToCanvas(rect.topLeft, w, h);
  const br = normalizedToCanvas(rect.bottomRight, w, h);
  const rw = br.x - tl.x;
  const rh = br.y - tl.y;

  ctx.save();

  // Dashed border
  ctx.strokeStyle = rect.color;
  ctx.lineWidth = 2 * s;
  ctx.setLineDash([8 * s, 4 * s]);
  ctx.strokeRect(tl.x, tl.y, rw, rh);

  // Semi-transparent fill
  ctx.fillStyle = rect.color + '0D';
  ctx.fillRect(tl.x, tl.y, rw, rh);

  // Instruction indicator
  if (rect.instruction) {
    ctx.setLineDash([]);
    const labelX = tl.x + 4 * s;
    const labelY = tl.y - 6 * s;
    const labelW = 16 * s;
    const labelH = 16 * s;
    ctx.fillStyle = rect.color;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY - 12 * s, labelW, labelH, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${9 * s}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', labelX + labelW / 2, labelY - 4 * s);
  }

  // Selection handles
  if (isSelected) {
    ctx.setLineDash([]);
    const handles = [
      { x: tl.x, y: tl.y },
      { x: br.x, y: tl.y },
      { x: tl.x, y: br.y },
      { x: br.x, y: br.y },
    ];
    for (const handle of handles) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Selection highlight border
    ctx.strokeStyle = '#2a9fd4';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([4 * s, 2 * s]);
    ctx.strokeRect(tl.x - 3 * s, tl.y - 3 * s, rw + 6 * s, rh + 6 * s);
  }

  ctx.restore();
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  arrow: ArrowAnnotation,
  w: number,
  h: number,
  isSelected: boolean,
  s: number = 1,
) => {
  const sp = normalizedToCanvas(arrow.start, w, h);
  const ep = normalizedToCanvas(arrow.end, w, h);

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 4 * s;
  ctx.shadowOffsetY = 1 * s;

  // Line
  ctx.strokeStyle = arrow.color;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sp.x, sp.y);
  ctx.lineTo(ep.x, ep.y);
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  // Arrowhead
  drawArrowhead(ctx, sp.x, sp.y, ep.x, ep.y, arrow.color, 14 * s);

  // Instruction indicator at midpoint
  if (arrow.instruction) {
    const mx = (sp.x + ep.x) / 2;
    const my = (sp.y + ep.y) / 2;
    ctx.fillStyle = arrow.color;
    ctx.beginPath();
    ctx.arc(mx, my - 12 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${8 * s}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', mx, my - 12 * s);
  }

  // Selection: endpoint handles
  if (isSelected) {
    for (const pt of [sp, ep]) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = arrow.color;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Selection glow
    ctx.strokeStyle = '#2a9fd4';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([4 * s, 2 * s]);
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y);
    ctx.lineTo(ep.x, ep.y);
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * Draw a filled arrowhead triangle at the end of a line.
 */
const drawArrowhead = (
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  size: number,
) => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const halfAngle = Math.PI / 7; // ~25.7 degrees

  ctx.save();
  ctx.fillStyle = color;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - halfAngle), toY - size * Math.sin(angle - halfAngle));
  ctx.lineTo(toX - size * Math.cos(angle + halfAngle), toY - size * Math.sin(angle + halfAngle));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawSketch = (
  ctx: CanvasRenderingContext2D,
  sketch: SketchAnnotation,
  w: number,
  h: number,
  isSelected: boolean,
  s: number = 1,
) => {
  if (sketch.points.length < 2) return;

  drawSketchPath(ctx, sketch.points, w, h, sketch.color, sketch.strokeWidth, false, s);

  // Instruction indicator near the center of the stroke
  if (sketch.instruction) {
    const bbox = getBoundingBox(sketch.points);
    const cx = ((bbox.topLeft.x + bbox.bottomRight.x) / 2) * w;
    const cy = bbox.topLeft.y * h - 10 * s;
    const labelW = 16 * s;
    const labelH = 16 * s;

    ctx.save();
    ctx.fillStyle = sketch.color;
    ctx.beginPath();
    ctx.roundRect(cx - labelW / 2, cy - 12 * s, labelW, labelH, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${9 * s}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', cx, cy - 4 * s);
    ctx.restore();
  }

  // Selection: bounding box
  if (isSelected) {
    const bbox = getBoundingBox(sketch.points);
    const tl = normalizedToCanvas(bbox.topLeft, w, h);
    const br = normalizedToCanvas(bbox.bottomRight, w, h);

    ctx.save();
    ctx.strokeStyle = '#2a9fd4';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([4 * s, 2 * s]);
    ctx.strokeRect(tl.x - 5 * s, tl.y - 5 * s, br.x - tl.x + 10 * s, br.y - tl.y + 10 * s);
    ctx.restore();
  }
};

/**
 * Draw a thick semi-transparent highlighter brush path from normalized points.
 * Used for both final sketches and rubber-band preview.
 */
const drawSketchPath = (
  ctx: CanvasRenderingContext2D,
  points: NormalizedPoint[],
  w: number,
  h: number,
  color: string,
  strokeWidth: number,
  _isSelected: boolean,
  s: number = 1,
) => {
  if (points.length < 2) return;

  ctx.save();

  ctx.beginPath();
  const first = normalizedToCanvas(points[0], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normalizedToCanvas(points[i], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  // Dashed border (matching rectangle style)
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.setLineDash([8 * s, 4 * s]);
  ctx.stroke();

  // Semi-transparent fill (matching rectangle style)
  ctx.fillStyle = color + '0D';
  ctx.fill();

  ctx.restore();
};
