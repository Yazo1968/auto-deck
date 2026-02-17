import { NormalizedPoint } from '../types';

/**
 * Ramer-Douglas-Peucker algorithm for simplifying a polyline.
 * Reduces the number of points while preserving the overall shape.
 *
 * @param points - Array of normalized points (0.0-1.0)
 * @param epsilon - Tolerance for simplification (smaller = more detail kept)
 * @returns Simplified array of points
 */
export function simplifyPath(points: NormalizedPoint[], epsilon: number = 0.003): NormalizedPoint[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line between start and end
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // If max distance exceeds epsilon, recursively simplify both halves
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPath(points.slice(maxIdx), epsilon);
    // Concatenate, removing duplicate point at the junction
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise, only keep start and end
  return [start, end];
}

/**
 * Calculate perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(
  point: NormalizedPoint,
  lineStart: NormalizedPoint,
  lineEnd: NormalizedPoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Start and end are the same point
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  // Project point onto line, clamped to segment
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Calculate the bounding box of a set of points.
 */
export function getBoundingBox(points: NormalizedPoint[]): {
  topLeft: NormalizedPoint;
  bottomRight: NormalizedPoint;
} {
  if (points.length === 0) {
    return { topLeft: { x: 0, y: 0 }, bottomRight: { x: 0, y: 0 } };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    topLeft: { x: minX, y: minY },
    bottomRight: { x: maxX, y: maxY },
  };
}

/**
 * Distance from a point to the nearest segment in a polyline.
 */
export function distanceToPolyline(point: NormalizedPoint, polyline: NormalizedPoint[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return Math.sqrt((point.x - polyline[0].x) ** 2 + (point.y - polyline[0].y) ** 2);
  }

  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = perpendicularDistance(point, polyline[i], polyline[i + 1]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Distance from a point to a line segment (used for arrow hit testing).
 */
export function distanceToSegment(
  point: NormalizedPoint,
  segStart: NormalizedPoint,
  segEnd: NormalizedPoint
): number {
  return perpendicularDistance(point, segStart, segEnd);
}
