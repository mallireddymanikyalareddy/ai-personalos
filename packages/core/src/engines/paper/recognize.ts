import type { ID, Timestamp } from "../../types/common";
import type { PaperDiagram, PaperPoint, PaperRecognition, PaperShapeKind } from "../../types/paper";
import { pointsBounds, strokeLength, type Bounds } from "./geometry";
import { recognizeShape, type ShapeRecognitionResult } from "./shapes";

export interface HandwritingRecognizer {
  readonly name: string;
  readonly ready: boolean;
  recognize(strokes: Array<{ id: ID; points: PaperPoint[] }>): Promise<HandwritingResult>;
}

export interface HandwritingResult {
  text: string;
  confidence: number;
  lines: Array<{ text: string; confidence: number; strokeIds: ID[] }>;
}

export interface MathRecognizer {
  readonly name: string;
  readonly ready: boolean;
  recognize(strokes: Array<{ id: ID; points: PaperPoint[] }>): Promise<MathRecognitionResult>;
}

export interface MathRecognitionResult {
  latex: string | null;
  confidence: number;
}

export interface DiagramRecognizer {
  readonly name: string;
  readonly ready: boolean;
  recognize(strokes: Array<{ id: ID; points: PaperPoint[] }>): Promise<DiagramRecognitionResult>;
}

export interface DiagramRecognitionResult {
  kind: "mindmap" | "flowchart" | "concept";
  confidence: number;
  nodes: PaperDiagram["nodes"];
  edges: PaperDiagram["edges"];
}

export interface OfflineInkRecognizer extends HandwritingRecognizer {
  readonly deterministic: boolean;
}

const SEGMENTATION_MIN_GAP = 14;

export function segmentInkIntoLayers(strokes: Array<{ id: ID; points: PaperPoint[] }>): {
  lines: Array<{ strokeIds: ID[]; points: PaperPoint[]; bounds: Bounds | null }>;
} {
  const withBounds = strokes
    .map((stroke) => ({ id: stroke.id, points: stroke.points, bounds: pointsBounds(stroke.points) }))
    .sort((a, b) => (a.bounds?.minY ?? 0) - (b.bounds?.minY ?? 0));

  const lines: Array<{ strokeIds: ID[]; points: PaperPoint[]; bounds: Bounds | null }> = [];

  for (const stroke of withBounds) {
    if (!stroke.bounds) continue;
    const target = lines.find((line) => {
      const bounds = line.bounds;
      if (!bounds) return true;
      const verticalOverlap = Math.min(bounds.maxY, stroke.bounds!.maxY) - Math.max(bounds.minY, stroke.bounds!.minY);
      const height = Math.min(bounds.height, stroke.bounds!.height) || 1;
      return verticalOverlap > height * 0.4;
    });

    if (target) {
      target.strokeIds.push(stroke.id);
      target.points.push(...stroke.points);
      const all = pointsBounds(target.points);
      target.bounds = all;
    } else {
      lines.push({ strokeIds: [stroke.id], points: [...stroke.points], bounds: stroke.bounds });
    }
  }

  void SEGMENTATION_MIN_GAP;
  return { lines };
}

export class DeterministicHandwritingRecognizer implements OfflineInkRecognizer {
  readonly name = "deterministic-offline";
  readonly deterministic = true;
  private readyFlag = false;

  get ready(): boolean {
    return this.readyFlag;
  }

  warmup(): void {
    this.readyFlag = true;
  }

  async recognize(strokes: Array<{ id: ID; points: PaperPoint[] }>): Promise<HandwritingResult> {
    const { lines } = segmentInkIntoLayers(strokes);
    if (lines.length === 0) return { text: "", confidence: 0, lines: [] };

    const results = lines.map((line) => {
      const length = strokeLength(line.points);
      const width = line.bounds?.width ?? 0;
      const height = line.bounds?.height ?? 0;
      if (height < 4 || line.strokeIds.length === 0) {
        return { text: "", confidence: 0, strokeIds: line.strokeIds, length, width, height };
      }
      const density = height > 0 ? (line.points.length / (width * height)) * 1000 : 0;
      return {
        text: "",
        confidence: Math.min(0.6, 0.25 + density / 12),
        strokeIds: line.strokeIds,
        length,
        width,
        height,
      };
    });

    const anyInk = results.some((line) => line.confidence > 0);
    return {
      text: "",
      confidence: anyInk ? Math.round(Math.min(...results.filter((line) => line.confidence > 0).map((line) => line.confidence)) * 100) / 100 : 0,
      lines: results.map((line) => ({ text: line.text, confidence: line.confidence, strokeIds: line.strokeIds })),
    };
  }
}

export interface PreparedMathRecognizer extends MathRecognizer {
  readonly pluggable: boolean;
}

export class DeterministicMathRecognizer implements PreparedMathRecognizer {
  readonly name = "deterministic-offline";
  readonly pluggable = true;
  private readyFlag = false;

  get ready(): boolean {
    return this.readyFlag;
  }

  warmup(): void {
    this.readyFlag = true;
  }

  async recognize(strokes: Array<{ id: ID; points: PaperPoint[] }>): Promise<MathRecognitionResult> {
    const { lines } = segmentInkIntoLayers(strokes);
    if (lines.length === 0) return { latex: null, confidence: 0 };

    const symbols = lines.map((line) => {
      const bounds = line.bounds;
      if (!bounds) return null;
      const height = bounds.height;
      const strokeCount = line.strokeIds.length;
      if (strokeCount === 1 && height < 12 && (bounds.width ?? 0) > 6) {
        return { symbol: "-", confidence: 0.45 };
      }
      if (strokeCount >= 1 && height >= 12 && height <= 60) {
        return { symbol: "?", confidence: 0.3 };
      }
      return null;
    });

    const found = symbols.filter((symbol): symbol is { symbol: string; confidence: number } => symbol != null);
    if (found.length === 0) return { latex: null, confidence: 0 };
    return { latex: found.map((symbol) => symbol.symbol).join(""), confidence: Math.min(...found.map((f) => f.confidence)) };
  }
}

export class DeterministicDiagramRecognizer implements DiagramRecognizer {
  readonly name = "deterministic-offline";
  private readyFlag = false;

  get ready(): boolean {
    return this.readyFlag;
  }

  warmup(): void {
    this.readyFlag = true;
  }

  async recognize(strokes: Array<{ id: ID; points: PaperPoint[] }>): Promise<DiagramRecognitionResult> {
    const recognized = strokes
      .map((stroke) => ({ stroke, shape: recognizeShape(stroke.points) }))
      .filter((entry) => entry.shape.shape !== null && entry.shape.confidence > 0.6);

    if (recognized.length === 0) {
      return { kind: "concept", confidence: 0, nodes: [], edges: [] };
    }

    const nodes = recognized.map((entry, index) => ({
      id: entry.stroke.id,
      label: `Node ${index + 1}`,
      x: entry.shape.bounds?.x ?? 0,
      y: entry.shape.bounds?.y ?? 0,
      width: entry.shape.bounds?.width ?? 0,
      height: entry.shape.bounds?.height ?? 0,
      color: null,
      shape:
        entry.shape.shape === "ellipse"
          ? ("ellipse" as const)
          : entry.shape.shape === "diamond"
            ? ("diamond" as const)
            : ("rounded" as const),
    }));

    const edges = nodes.slice(1).map((node, index) => ({
      id: `edge_${index}`,
      from: nodes[index]!.id,
      to: node.id,
      label: "",
      style: "solid" as const,
    }));

    return {
      kind: nodes.length >= 3 ? "mindmap" : "flowchart",
      confidence: Math.min(...recognized.map((entry) => entry.shape.confidence)),
      nodes,
      edges,
    };
  }
}

export const REGISTRY = {
  handwriting: new DeterministicHandwritingRecognizer(),
  math: new DeterministicMathRecognizer(),
  diagram: new DeterministicDiagramRecognizer(),
};

export function warmupRecognizers(): void {
  REGISTRY.handwriting.warmup();
  REGISTRY.math.warmup();
  REGISTRY.diagram.warmup();
}

export function recognizeShapesBatch(
  strokes: Array<{ id: ID; points: PaperPoint[] }>,
  minConfidence = 0.7,
): Array<{ strokeId: ID; shape: PaperShapeKind; confidence: number; bounds: Bounds | null }> {
  return strokes
    .map((stroke) => ({ strokeId: stroke.id, result: recognizeShape(stroke.points) }))
    .filter((entry) => entry.result.shape != null && entry.result.confidence >= minConfidence)
    .map((entry) => ({
      strokeId: entry.strokeId,
      shape: entry.result.shape!,
      confidence: entry.result.confidence,
      bounds: entry.result.bounds,
    }));
}