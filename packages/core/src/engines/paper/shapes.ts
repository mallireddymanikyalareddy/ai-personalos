import type { PaperPoint, PaperShapeKind } from "../../types/paper";
import { pointsBounds, strokeLength, type Bounds } from "./geometry";

export interface ShapeRecognitionResult {
  shape: PaperShapeKind | null;
  confidence: number;
  closed: boolean;
  bounds: Bounds | null;
  vertices: number;
  straightness: number;
  circularity: number;
  aspectRatio: number;
  hasArrowHead: boolean;
}

function segmentLengths(points: PaperPoint[]): number[] {
  const lengths: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y));
  }
  return lengths;
}

function straightness(points: PaperPoint[]): number {
  if (points.length < 2) return 0;
  const endToEnd = Math.hypot(
    points[points.length - 1]!.x - points[0]!.x,
    points[points.length - 1]!.y - points[0]!.y,
  );
  const path = strokeLength(points);
  if (path === 0) return 0;
  return Math.min(1, endToEnd / path);
}

function circularity(points: PaperPoint[]): number {
  if (points.length < 3) return 0;
  const bounds = pointsBounds(points);
  if (!bounds || bounds.width === 0 || bounds.height === 0) return 0;
  const diagonal = Math.hypot(bounds.width, bounds.height);
  const path = strokeLength(points);
  if (path === 0) return 0;
  return Math.min(1, diagonal / path);
}

const MIN_CORNER_RAD = 0.5;

function turnAngles(points: PaperPoint[], wrap: boolean): number[] {
  if (points.length < 3) return [];
  const step = Math.max(1, Math.floor(points.length / 40));
  const list = wrap ? [...points, ...points.slice(0, step + 1)] : points;
  const angles: number[] = [];

  for (let index = step; index < list.length - step; index += 1) {
    const previous = list[index - step]!;
    const current = list[index]!;
    const next = list[index + step]!;
    const a1 = Math.atan2(current.y - previous.y, current.x - previous.x);
    const a2 = Math.atan2(next.y - current.y, next.x - current.x);
    let delta = Math.abs(a2 - a1);
    while (delta > Math.PI) delta = Math.PI * 2 - delta;
    angles.push(delta);
  }
  return angles;
}

function countCorners(points: PaperPoint[], minAngle = MIN_CORNER_RAD): number {
  const angles = turnAngles(points, true);
  if (angles.length === 0) return 0;

  let corners = 0;
  let runBest = 0;
  let inRun = false;

  for (const angle of angles) {
    if (angle > minAngle) {
      runBest = Math.max(runBest, angle);
      inRun = true;
      continue;
    }
    if (inRun) {
      corners += 1;
      inRun = false;
      runBest = 0;
    }
  }
  if (inRun) corners += 1;
  return corners;
}

function hasArrowHead(points: PaperPoint[]): boolean {
  if (points.length < 4) return false;
  const tail = points.slice(Math.floor(points.length * 0.6));
  const angles = turnAngles(tail, false);
  return angles.some((angle) => angle > 0.7);
}

function closure(points: PaperPoint[]): { distance: number; relative: number } {
  if (points.length < 2) return { distance: Number.POSITIVE_INFINITY, relative: 1 };
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const bounds = pointsBounds(points);
  const diagonal = bounds ? Math.hypot(bounds.width, bounds.height) : 1;
  const distance = Math.hypot(last.x - first.x, last.y - first.y);
  return { distance, relative: diagonal === 0 ? 1 : distance / diagonal };
}

export function recognizeShape(points: PaperPoint[], epsilon = 2): ShapeRecognitionResult {
  const bounds = pointsBounds(points);
  const straight = straightness(points);
  const round = circularity(points);
  const corners = countCorners(points);
  const closed = closure(points);
  const arrowHead = hasArrowHead(points);

  const aspectRatio =
    bounds && bounds.height > 0 ? bounds.width / bounds.height : 0;

  const result: ShapeRecognitionResult = {
    shape: null,
    confidence: 0,
    closed: closed.relative < 0.18,
    bounds,
    vertices: corners,
    straightness: straight,
    circularity: round,
    aspectRatio,
    hasArrowHead: arrowHead,
  };

  if (points.length < 8 || !bounds) {
    return { ...result, confidence: result.confidence };
  }

  const span = Math.max(bounds.width, bounds.height);

  if (result.closed && corners <= 1 && span > 20 && round > 0.2) {
    return { ...result, shape: "ellipse", confidence: Math.min(0.95, 0.6 + round) };
  }

  if (result.closed && corners >= 3 && corners <= 12) {
    const squareness = Math.abs(aspectRatio - 1);
    if (corners === 4 && squareness < 0.4) {
      return { ...result, shape: "rectangle", confidence: 0.85 };
    }
    if (corners === 3) {
      return { ...result, shape: "triangle", confidence: 0.78 };
    }
    return { ...result, shape: "polygon", confidence: 0.6 + Math.min(0.25, 0.1 * corners) };
  }

  if (arrowHead && straight > 0.6) {
    return { ...result, shape: "arrow", confidence: 0.8 };
  }

  if (!result.closed && straight > 0.94 && strokeLength(points) > 24) {
    return { ...result, shape: "line", confidence: 0.85 };
  }

  return result;
}

export function recognizeShapeKind(points: PaperPoint[]): PaperShapeKind | null {
  return recognizeShape(points).shape;
}

export function shouldReplaceWithShape(points: PaperPoint[]): ShapeRecognitionResult | null {
  const result = recognizeShape(points);
  if (!result.shape || result.confidence < 0.7) return null;
  return result;
}