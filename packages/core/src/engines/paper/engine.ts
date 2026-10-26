import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type {
  PaperDiagram,
  PaperImage,
  PaperLayer,
  PaperNotebook,
  PaperPage,
  PaperRecognition,
  PaperShapeKind,
  PaperSticker,
  PaperStroke,
  PaperTemplateKind,
} from "../../types/paper";
import { pointsBounds, strokeBounds, simplifyStroke, smoothPoints, unionBounds, type Bounds } from "./geometry";
import { recognizeShape, type ShapeRecognitionResult } from "./shapes";
import { recognizeShapesBatch, REGISTRY } from "./recognize";

export interface PaperPageBundle {
  page: PaperPage;
  notebook: PaperNotebook;
  layers: PaperLayer[];
  strokes: PaperStroke[];
  images: PaperImage[];
  audio: PaperSticker[];
  stickers: PaperSticker[];
  diagrams: PaperDiagram[];
  recognitions: PaperRecognition[];
  bounds: Bounds | null;
}

export function selectPaperPage(state: AppState, pageId: ID, now: Timestamp = Date.now()): PaperPageBundle | null {
  const page = state.paperPages[pageId];
  if (!page) return null;
  const notebook = state.paperNotebooks[page.notebookId] ?? null;

  const layers = Object.values(state.paperLayers)
    .filter((layer) => layer.pageId === pageId)
    .sort((a, b) => a.order - b.order);

  const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));

  const strokes = Object.values(state.paperStrokes)
    .filter((stroke) => stroke.pageId === pageId && visibleLayerIds.has(stroke.layerId))
    .sort((a, b) => a.createdAt - b.createdAt);

  const layerId = layers[0]?.id ?? "";
  const images: PaperImage[] = Object.values(state.attachments)
    .filter((attachment) => (attachment.ownerType as string) === "paper_image" && attachment.ownerId === pageId)
    .map((attachment) => ({
      type: "paper_image",
      id: attachment.id,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
      notebookId: page.notebookId,
      pageId,
      layerId,
      url: attachment.url ?? "",
      name: attachment.name,
      mimeType: attachment.mimeType,
      x: 0,
      y: 0,
      width: 320,
      height: 240,
      rotation: 0,
    }));

  const emptyNotebook: PaperNotebook = {
    type: "paper_notebook",
    id: page.notebookId,
    createdAt: now,
    updatedAt: now,
    title: "Notebook",
    description: "",
    coverColor: "#1f2937",
    template: page.template,
    pageIds: [pageId],
    status: "active",
    goalIds: [],
    projectIds: [],
    lastOpenedAt: null,
  };

  return {
    page,
    notebook: notebook ?? emptyNotebook,
    layers,
    strokes,
    images,
    audio: [],
    stickers: [],
    diagrams: Object.values(state.paperDiagrams).filter((diagram) => diagram.pageId === pageId),
    recognitions: Object.values(state.paperRecognitions).filter((record) => record.pageId === pageId),
    bounds: unionBounds(strokes.map((stroke) => strokeBounds(stroke))),
  };
}

export function optimizeStroke(stroke: PaperStroke, epsilon = 1.8): PaperStroke {
  const smoothed = smoothPoints(stroke.points, stroke.tool === "pencil" ? 0.2 : 0.45);
  return { ...stroke, points: simplifyStroke(smoothed, epsilon) };
}

export function suggestShapeForStroke(points: Array<{ x: number; y: number; pressure: number; timestamp: number }>): ShapeRecognitionResult | null {
  const result = recognizeShape(points);
  if (!result.shape || result.confidence < 0.7) return null;
  return result;
}

export async function recognizePageShapes(state: AppState, pageId: ID): Promise<Array<{ strokeId: ID; shape: PaperShapeKind }>> {
  const strokes = Object.values(state.paperStrokes).filter((stroke) => stroke.pageId === pageId);
  return recognizeShapesBatch(strokes, 0.75).map((entry) => ({
    strokeId: entry.strokeId,
    shape: entry.shape,
  }));
}

export async function recognizeHandwriting(state: AppState, pageId: ID): Promise<string> {
  const recognizer = REGISTRY.handwriting;
  const strokes = Object.values(state.paperStrokes)
    .filter((stroke) => stroke.pageId === pageId && stroke.tool !== "highlighter")
    .map((stroke) => ({ id: stroke.id, points: stroke.points }));
  const result = await recognizer.recognize(strokes);
  return result.text;
}

export function inkStats(strokes: PaperStroke[]): {
  strokeCount: number;
  pointCount: number;
  inkLength: number;
  bounds: Bounds | null;
  toolCounts: Record<string, number>;
} {
  const toolCounts: Record<string, number> = {};
  let pointCount = 0;
  let inkLength = 0;

  for (const stroke of strokes) {
    pointCount += stroke.points.length;
    toolCounts[stroke.tool] = (toolCounts[stroke.tool] ?? 0) + 1;
    const bounds = strokeBounds(stroke);
    if (bounds) inkLength += bounds.width + bounds.height;
  }

  return {
    strokeCount: strokes.length,
    pointCount,
    inkLength,
    bounds: unionBounds(strokes.map((stroke) => strokeBounds(stroke))),
    toolCounts,
  };
}

export function templateSpacing(template: PaperTemplateKind, scale: number): number {
  if (template === "blank") return 0;
  return scale;
}

export function notebookSummary(state: AppState, notebookId: ID): { pages: number; strokes: number; recognitions: number } {
  const pages = Object.values(state.paperPages).filter((page) => page.notebookId === notebookId);
  const pageIds = new Set(pages.map((page) => page.id));
  const strokes = Object.values(state.paperStrokes).filter((stroke) => pageIds.has(stroke.pageId));
  const recognitions = Object.values(state.paperRecognitions).filter((record) => pageIds.has(record.pageId));
  return { pages: pages.length, strokes: strokes.length, recognitions: recognitions.length };
}

export function pageThumbnailStrokes(strokes: PaperStroke[], max = 400): PaperStroke[] {
  if (strokes.length <= max) return strokes;
  const step = Math.ceil(strokes.length / max);
  return strokes.filter((_, index) => index % step === 0);
}

export { pointsBounds, strokeBounds };