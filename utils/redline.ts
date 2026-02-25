import { Annotation, NormalizedPoint } from '../types';

/**
 * Generate a high-contrast redline map from annotations.
 * The redline is rendered on a black background at the image's natural resolution
 * with ALL annotations in bright red for maximum AI readability.
 *
 * Returns: { redlineDataUrl: string, instructions: string }
 */
export function generateRedlineMap(
  annotations: Annotation[],
  naturalW: number,
  naturalH: number,
): { redlineDataUrl: string; instructions: string } {
  // Create offscreen canvas at natural resolution
  const canvas = document.createElement('canvas');
  canvas.width = naturalW;
  canvas.height = naturalH;
  const ctx = canvas.getContext('2d')!;

  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, naturalW, naturalH);

  const RED = '#FF0000';
  const WHITE = '#FFFFFF';
  const STROKE_WIDTH = 4;

  // Track pin numbering
  let pinIndex = 1;

  // Render each annotation in high-contrast red
  for (const a of annotations) {
    if (a.type === 'pin') {
      renderRedlinePin(ctx, a.position, naturalW, naturalH, pinIndex, RED, WHITE);
      pinIndex++;
    } else if (a.type === 'rectangle') {
      renderRedlineRectangle(ctx, a.topLeft, a.bottomRight, naturalW, naturalH, RED, WHITE, STROKE_WIDTH);
    } else if (a.type === 'arrow') {
      renderRedlineArrow(ctx, a.start, a.end, naturalW, naturalH, RED, STROKE_WIDTH);
    } else if (a.type === 'sketch') {
      renderRedlineSketch(ctx, a.points, a.strokeWidth, naturalW, naturalH, RED, STROKE_WIDTH);
    }
  }

  const redlineDataUrl = canvas.toDataURL('image/png');
  const instructions = synthesizeInstructions(annotations);

  return { redlineDataUrl, instructions };
}

// --- Redline renderers (AI-facing, high-contrast) ---

function toCanvas(p: NormalizedPoint, w: number, h: number): { x: number; y: number } {
  return { x: p.x * w, y: p.y * h };
}

function renderRedlinePin(
  ctx: CanvasRenderingContext2D,
  position: NormalizedPoint,
  w: number,
  h: number,
  index: number,
  red: string,
  white: string,
) {
  const { x, y } = toCanvas(position, w, h);
  const radius = Math.max(16, Math.min(w, h) * 0.02);

  // Outer circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = red;
  ctx.fill();
  ctx.strokeStyle = white;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Number
  ctx.fillStyle = white;
  ctx.font = `bold ${Math.max(14, radius)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index), x, y);
}

function renderRedlineRectangle(
  ctx: CanvasRenderingContext2D,
  topLeft: NormalizedPoint,
  bottomRight: NormalizedPoint,
  w: number,
  h: number,
  red: string,
  white: string,
  strokeWidth: number,
) {
  const tl = toCanvas(topLeft, w, h);
  const br = toCanvas(bottomRight, w, h);
  const rw = br.x - tl.x;
  const rh = br.y - tl.y;

  // Dashed red border
  ctx.strokeStyle = red;
  ctx.lineWidth = strokeWidth;
  ctx.setLineDash([12, 6]);
  ctx.strokeRect(tl.x, tl.y, rw, rh);
  ctx.setLineDash([]);

  // 10% white fill for visibility
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(tl.x, tl.y, rw, rh);
}

function renderRedlineArrow(
  ctx: CanvasRenderingContext2D,
  start: NormalizedPoint,
  end: NormalizedPoint,
  w: number,
  h: number,
  red: string,
  strokeWidth: number,
) {
  const s = toCanvas(start, w, h);
  const e = toCanvas(end, w, h);

  // Line
  ctx.strokeStyle = red;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(e.y - s.y, e.x - s.x);
  const headSize = Math.max(18, Math.min(w, h) * 0.025);
  const halfAngle = Math.PI / 6;

  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(e.x - headSize * Math.cos(angle - halfAngle), e.y - headSize * Math.sin(angle - halfAngle));
  ctx.lineTo(e.x - headSize * Math.cos(angle + halfAngle), e.y - headSize * Math.sin(angle + halfAngle));
  ctx.closePath();
  ctx.fill();
}

function renderRedlineSketch(
  ctx: CanvasRenderingContext2D,
  points: NormalizedPoint[],
  strokeWidth: number,
  w: number,
  h: number,
  red: string,
  _lineWidth: number,
) {
  if (points.length < 2) return;

  // Closed region matching rectangle redline style
  ctx.save();

  ctx.beginPath();
  const first = toCanvas(points[0], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = toCanvas(points[i], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  // Dashed red border
  ctx.strokeStyle = red;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 10% white fill for visibility
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();

  ctx.restore();
}

// --- Instruction synthesis ---

/**
 * Generate a numbered instruction list referencing spatial positions.
 * This is the text sent alongside the redline map to guide the AI.
 */
function synthesizeInstructions(annotations: Annotation[]): string {
  const lines: string[] = [];
  let pinIndex = 1;

  for (const a of annotations) {
    switch (a.type) {
      case 'pin': {
        const instruction = a.instruction || '(no instruction provided)';
        lines.push(
          `${lines.length + 1}. [PIN #${pinIndex} at (${fmt(a.position.x)}, ${fmt(a.position.y)})]: "${instruction}"`,
        );
        pinIndex++;
        break;
      }
      case 'rectangle': {
        const instruction = a.instruction || '(no instruction provided)';
        lines.push(
          `${lines.length + 1}. [RECTANGLE covering (${fmt(a.topLeft.x)}, ${fmt(a.topLeft.y)}) to (${fmt(a.bottomRight.x)}, ${fmt(a.bottomRight.y)})]: "${instruction}"`,
        );
        break;
      }
      case 'arrow': {
        const instruction = a.instruction || '(no instruction provided)';
        lines.push(
          `${lines.length + 1}. [ARROW from (${fmt(a.start.x)}, ${fmt(a.start.y)}) to (${fmt(a.end.x)}, ${fmt(a.end.y)})]: "${instruction}"`,
        );
        break;
      }
      case 'sketch': {
        if (a.points.length > 0) {
          // Compute bounding box for spatial description
          let minX = 1,
            maxX = 0,
            minY = 1,
            maxY = 0;
          for (const p of a.points) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const instruction = a.instruction || '(no instruction provided)';
          lines.push(
            `${lines.length + 1}. [HIGHLIGHTED AREA covering (${fmt(minX)}, ${fmt(minY)}) to (${fmt(maxX)}, ${fmt(maxY)})]: "${instruction}"`,
          );
        }
        break;
      }
    }
  }

  return lines.join('\n');
}

function fmt(n: number): string {
  return n.toFixed(2);
}
