import type { PaperPoint, PaperStroke } from "../../types/paper";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function strokeBounds(stroke: PaperStroke): Bounds | null {
  return pointsBounds(stroke.points);
}

export function pointsBounds(points: PaperPoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function unionBounds(boundsList: Array<Bounds | null>): Bounds | null {
  const valid = boundsList.filter((bounds): bounds is Bounds => bounds != null);
  if (valid.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const bounds of valid) {
    if (bounds.minX < minX) minX = bounds.minX;
    if (bounds.minY < minY) minY = bounds.minY;
    if (bounds.maxX > maxX) maxX = bounds.maxX;
    if (bounds.maxY > maxY) maxY = bounds.maxY;
  }
  return { minX, minY, maxX, maxY, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsIntersect(a: Bounds, b: Bounds, padding = 0): boolean {
  return (
    a.minX - padding <= b.maxX &&
    a.maxX + padding >= b.minX &&
    a.minY - padding <= b.maxY &&
    a.maxY + padding >= b.minY
  );
}

export function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    ...bounds,
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function perpendicularDistance(point: PaperPoint, start: PaperPoint, end: PaperPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

export function simplifyStroke(points: PaperPoint[], epsilon = 1.6): PaperPoint[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop()!;
    if (endIndex - startIndex < 2) continue;

    const start = points[startIndex]!;
    const end = points[endIndex]!;
    let maxDistance = 0;
    let maxIndex = startIndex;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = perpendicularDistance(points[index]!, start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = index;
      }
    }

    if (maxDistance > epsilon) {
      keep[maxIndex] = true;
      stack.push([startIndex, maxIndex]);
      stack.push([maxIndex, endIndex]);
    }
  }

  const simplified: PaperPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (keep[index]) simplified.push(points[index]!);
  }
  return simplified;
}

export function resampleStroke(points: PaperPoint[], spacing = 3): PaperPoint[] {
  if (points.length < 2) return [...points];
  const result: PaperPoint[] = [{ ...points[0]! }];
  let carry = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (distance === 0) continue;

    let remaining = distance;
    let startX = previous.x;
    let startY = previous.y;

    while (remaining + carry >= spacing) {
      const needed = spacing - carry;
      const ratio = needed / distance;
      const newX = startX + ratio * (current.x - previous.x);
      const newY = startY + ratio * (current.y - previous.y);
      result.push({
        x: newX,
        y: newY,
        pressure: previous.pressure + (current.pressure - previous.pressure) * ratio,
        timestamp: previous.timestamp + (current.timestamp - previous.timestamp) * ratio,
      });
      carry = 0;
      startX = newX;
      startY = newY;
      remaining -= needed;
    }
    carry += remaining;
  }

  const last = points[points.length - 1]!;
  const final = result[result.length - 1]!;
  if (Math.hypot(last.x - final.x, last.y - final.y) > spacing * 0.5) result.push({ ...last });
  return result;
}

export function strokeLength(points: PaperPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y);
  }
  return total;
}

export function averageSpeed(points: PaperPoint[]): number {
  if (points.length < 2) return 0;
  const duration = points[points.length - 1]!.timestamp - points[0]!.timestamp;
  if (duration <= 0) return strokeLength(points);
  return strokeLength(points) / duration;
}

export function averagePressure(points: PaperPoint[]): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, point) => sum + point.pressure, 0) / points.length;
}

export function hitTestStroke(
  stroke: PaperStroke,
  x: number,
  y: number,
  tolerance = 8,
): boolean {
  const bounds = strokeBounds(stroke);
  if (!bounds) return false;
  if (x < bounds.minX - tolerance || x > bounds.maxX + tolerance) return false;
  if (y < bounds.minY - tolerance || y > bounds.maxY + tolerance) return false;
  return distanceToStroke(stroke.points, x, y) <= tolerance + stroke.width / 2;
}

export function distanceToStroke(points: PaperPoint[], x: number, y: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < min) min = distance;
  }
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    let t = ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const distance = Math.hypot(x - projX, y - projY);
    if (distance < min) min = distance;
  }
  return min;
}

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function screenToCanvas(point: Point, view: ViewTransform): Point {
  return {
    x: (point.x - view.offsetX) / view.scale,
    y: (point.y - view.offsetY) / view.scale,
  };
}

export function canvasToScreen(point: Point, view: ViewTransform): Point {
  return {
    x: point.x * view.scale + view.offsetX,
    y: point.y * view.scale + view.offsetY,
  };
}

export function zoomAt(
  view: ViewTransform,
  focal: Point,
  factor: number,
  minScale = 0.1,
  maxScale = 8,
): ViewTransform {
  const nextScale = Math.max(minScale, Math.min(maxScale, view.scale * factor));
  const ratio = nextScale / view.scale;
  return {
    scale: nextScale,
    offsetX: focal.x - ratio * (focal.x - view.offsetX),
    offsetY: focal.y - ratio * (focal.y - view.offsetY),
  };
}

export function clampView(view: ViewTransform, canvasWidth: number, canvasHeight: number): ViewTransform {
  return view;
}

export function smoothPoints(input: PaperPoint[], strength = 0.45): PaperPoint[] {
  if (input.length < 3) return [...input];
  const output: PaperPoint[] = [{ ...input[0]! }];
  for (let index = 1; index < input.length - 1; index += 1) {
    const previous = input[index - 1]!;
    const current = input[index]!;
    const next = input[index + 1]!;
    output.push({
      x: current.x * (1 - strength) + ((previous.x + next.x) / 2) * strength,
      y: current.y * (1 - strength) + ((previous.y + next.y) / 2) * strength,
      pressure: current.pressure,
      timestamp: current.timestamp,
    });
  }
  output.push({ ...input[input.length - 1]! });
  return output;
}

export function lineDashFromTool(tool: string): number[] | null {
  if (tool === "highlighter") return null;
  return null;
}

export function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}