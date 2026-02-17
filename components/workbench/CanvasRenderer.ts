import {
  Annotation,
  NormalizedPoint,
  PinAnnotation,
  RectangleAnnotation,
  ArrowAnnotation,
  SketchAnnotation,
} from '../../types';
import { distanceToSegment, distanceToPolyline, getBoundingBox } from '../../utils/geometry';

// --- Coordinate conversion helpers ---

export const normalizedToCanvas = (p: NormalizedPoint, w: number, h: number): { x: number; y: number } => ({
  x: p.x * w,
  y: p.y * h,
});

export const canvasToNormalized = (cx: number, cy: number, w: number, h: number): NormalizedPoint => ({
  x: Math.max(0, Math.min(1, cx / w)),
  y: Math.max(0, Math.min(1, cy / h)),
});

// --- Hit testing ---

const PIN_RADIUS = 10; // px on canvas
const HIT_TOLERANCE = 8; // px
const ARROW_HIT_TOLERANCE = 10; // px
const SKETCH_HIT_TOLERANCE = 20; // px — wider to match thick brush stroke

export const hitTestAnnotation = (
  annotations: Annotation[],
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number
): string | null => {
  // Test in reverse order (topmost first)
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.type === 'pin') {
      const { x, y } = normalizedToCanvas(a.position, canvasW, canvasH);
      const dist = Math.sqrt((canvasX - x) ** 2 + (canvasY - y) ** 2);
      if (dist <= PIN_RADIUS + HIT_TOLERANCE) return a.id;
    } else if (a.type === 'rectangle') {
      const tl = normalizedToCanvas(a.topLeft, canvasW, canvasH);
      const br = normalizedToCanvas(a.bottomRight, canvasW, canvasH);
      const margin = HIT_TOLERANCE;
      if (
        canvasX >= tl.x - margin && canvasX <= br.x + margin &&
        canvasY >= tl.y - margin && canvasY <= br.y + margin
      ) {
        return a.id;
      }
    } else if (a.type === 'arrow') {
      // Hit test against the line segment
      const normPt = canvasToNormalized(canvasX, canvasY, canvasW, canvasH);
      const dist = distanceToSegment(normPt, a.start, a.end);
      // Convert normalized distance to pixel distance (approximate using average of w/h)
      const avgDim = (canvasW + canvasH) / 2;
      if (dist * avgDim <= ARROW_HIT_TOLERANCE) return a.id;
    } else if (a.type === 'sketch') {
      if (a.points.length > 0) {
        const normPt = canvasToNormalized(canvasX, canvasY, canvasW, canvasH);
        const dist = distanceToPolyline(normPt, a.points);
        const avgDim = (canvasW + canvasH) / 2;
        if (dist * avgDim <= SKETCH_HIT_TOLERANCE) return a.id;
      }
    }
  }
  return null;
};

// --- Handle hit testing for resize ---

export type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'start' | 'end' | null;
const HANDLE_SIZE = 8;

export const hitTestHandle = (
  annotation: Annotation,
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number
): HandleType => {
  if (annotation.type === 'rectangle') {
    const tl = normalizedToCanvas(annotation.topLeft, canvasW, canvasH);
    const br = normalizedToCanvas(annotation.bottomRight, canvasW, canvasH);
    const corners: { type: HandleType; x: number; y: number }[] = [
      { type: 'tl', x: tl.x, y: tl.y },
      { type: 'tr', x: br.x, y: tl.y },
      { type: 'bl', x: tl.x, y: br.y },
      { type: 'br', x: br.x, y: br.y },
    ];
    for (const c of corners) {
      if (Math.abs(canvasX - c.x) <= HANDLE_SIZE && Math.abs(canvasY - c.y) <= HANDLE_SIZE) {
        return c.type;
      }
    }
  } else if (annotation.type === 'arrow') {
    const s = normalizedToCanvas(annotation.start, canvasW, canvasH);
    const e = normalizedToCanvas(annotation.end, canvasW, canvasH);
    if (Math.abs(canvasX - s.x) <= HANDLE_SIZE && Math.abs(canvasY - s.y) <= HANDLE_SIZE) return 'start';
    if (Math.abs(canvasX - e.x) <= HANDLE_SIZE && Math.abs(canvasY - e.y) <= HANDLE_SIZE) return 'end';
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

export const renderAnnotations = (
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId: string | null,
  canvasW: number,
  canvasH: number,
  rubberBand?: RubberBand | null
) => {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (canvasW === 0 || canvasH === 0) return;

  // Draw rubber-band (in-progress drawing)
  if (rubberBand) {
    if (rubberBand.type === 'rectangle') {
      const tl = normalizedToCanvas(rubberBand.topLeft, canvasW, canvasH);
      const br = normalizedToCanvas(rubberBand.bottomRight, canvasW, canvasH);
      ctx.save();
      ctx.strokeStyle = rubberBand.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.fillStyle = rubberBand.color + '10';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    } else if (rubberBand.type === 'arrow') {
      const s = normalizedToCanvas(rubberBand.start, canvasW, canvasH);
      const e = normalizedToCanvas(rubberBand.end, canvasW, canvasH);
      ctx.save();
      ctx.strokeStyle = rubberBand.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      drawArrowhead(ctx, s.x, s.y, e.x, e.y, rubberBand.color, 12);
      ctx.restore();
    } else if (rubberBand.type === 'sketch') {
      drawSketchPath(ctx, rubberBand.points, canvasW, canvasH, rubberBand.color, rubberBand.strokeWidth, false);
    }
  }

  // Number pins sequentially
  let pinIndex = 1;

  for (const a of annotations) {
    const isSelected = a.id === selectedId;

    if (a.type === 'pin') {
      drawPin(ctx, a, canvasW, canvasH, isSelected, pinIndex);
      pinIndex++;
    } else if (a.type === 'rectangle') {
      drawRectangle(ctx, a, canvasW, canvasH, isSelected);
    } else if (a.type === 'arrow') {
      drawArrow(ctx, a, canvasW, canvasH, isSelected);
    } else if (a.type === 'sketch') {
      drawSketch(ctx, a, canvasW, canvasH, isSelected);
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
  index: number
) => {
  const { x, y } = normalizedToCanvas(pin.position, w, h);
  const r = PIN_RADIUS;

  ctx.save();

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

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
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#ccff00';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Number label
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(10, r)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index), x, y);

  // Instruction indicator (small dot if has instruction)
  if (pin.instruction) {
    ctx.beginPath();
    ctx.arc(x + r - 2, y - r + 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ccff00';
    ctx.fill();
  }

  ctx.restore();
};

const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  rect: RectangleAnnotation,
  w: number,
  h: number,
  isSelected: boolean
) => {
  const tl = normalizedToCanvas(rect.topLeft, w, h);
  const br = normalizedToCanvas(rect.bottomRight, w, h);
  const rw = br.x - tl.x;
  const rh = br.y - tl.y;

  ctx.save();

  // Dashed border
  ctx.strokeStyle = rect.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(tl.x, tl.y, rw, rh);

  // Semi-transparent fill
  ctx.fillStyle = rect.color + '0D';
  ctx.fillRect(tl.x, tl.y, rw, rh);

  // Instruction indicator
  if (rect.instruction) {
    ctx.setLineDash([]);
    const labelX = tl.x + 4;
    const labelY = tl.y - 6;
    ctx.fillStyle = rect.color;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY - 12, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', labelX + 8, labelY - 4);
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
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Selection highlight border
    ctx.strokeStyle = '#ccff00';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(tl.x - 3, tl.y - 3, rw + 6, rh + 6);
  }

  ctx.restore();
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  arrow: ArrowAnnotation,
  w: number,
  h: number,
  isSelected: boolean
) => {
  const s = normalizedToCanvas(arrow.start, w, h);
  const e = normalizedToCanvas(arrow.end, w, h);

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  // Line
  ctx.strokeStyle = arrow.color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  // Arrowhead
  drawArrowhead(ctx, s.x, s.y, e.x, e.y, arrow.color, 14);

  // Instruction indicator at midpoint
  if (arrow.instruction) {
    const mx = (s.x + e.x) / 2;
    const my = (s.y + e.y) / 2;
    ctx.fillStyle = arrow.color;
    ctx.beginPath();
    ctx.arc(mx, my - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', mx, my - 12);
  }

  // Selection: endpoint handles
  if (isSelected) {
    for (const pt of [s, e]) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = arrow.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Selection glow
    ctx.strokeStyle = '#ccff00';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
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
  size: number
) => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const halfAngle = Math.PI / 7; // ~25.7 degrees

  ctx.save();
  ctx.fillStyle = color;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - halfAngle),
    toY - size * Math.sin(angle - halfAngle)
  );
  ctx.lineTo(
    toX - size * Math.cos(angle + halfAngle),
    toY - size * Math.sin(angle + halfAngle)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawSketch = (
  ctx: CanvasRenderingContext2D,
  sketch: SketchAnnotation,
  w: number,
  h: number,
  isSelected: boolean
) => {
  if (sketch.points.length < 2) return;

  drawSketchPath(ctx, sketch.points, w, h, sketch.color, sketch.strokeWidth, false);

  // Instruction indicator near the center of the stroke
  if (sketch.instruction) {
    const bbox = getBoundingBox(sketch.points);
    const cx = ((bbox.topLeft.x + bbox.bottomRight.x) / 2) * w;
    const cy = bbox.topLeft.y * h - 10;

    ctx.save();
    ctx.fillStyle = sketch.color;
    ctx.beginPath();
    ctx.roundRect(cx - 8, cy - 12, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', cx, cy - 4);
    ctx.restore();
  }

  // Selection: bounding box
  if (isSelected) {
    const bbox = getBoundingBox(sketch.points);
    const tl = normalizedToCanvas(bbox.topLeft, w, h);
    const br = normalizedToCanvas(bbox.bottomRight, w, h);

    ctx.save();
    ctx.strokeStyle = '#ccff00';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(tl.x - 5, tl.y - 5, br.x - tl.x + 10, br.y - tl.y + 10);
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
  _isSelected: boolean
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
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.stroke();

  // Semi-transparent fill (matching rectangle style)
  ctx.fillStyle = color + '0D';
  ctx.fill();

  ctx.restore();
};
