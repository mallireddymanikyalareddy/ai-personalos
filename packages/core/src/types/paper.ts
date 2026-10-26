import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";

export type PaperToolKind =
  | "pen"
  | "pencil"
  | "highlighter"
  | "marker"
  | "eraser"
  | "lasso"
  | "shapes"
  | "text"
  | "image"
  | "audio"
  | "sticker"
  | "diagram";

export type PaperBlend = "normal" | "multiply";

export type PaperShapeKind =
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "polygon"
  | "star"
  | "connector";

export type PaperTemplateKind = "blank" | "ruled" | "grid" | "dotted" | "isometric" | "cornell";

export type PaperStatus = "active" | "archived" | "trashed";

export type PaperPageKind = "handwritten" | "typed" | "template" | "scan" | "pdf" | "image";

export interface PaperFolder {
  type: "paper_folder";
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  name: string;
  color: string;
  icon: string;
  order: number;
  status: PaperStatus;
}

export function createPaperFolder(
  input: { name: string; color?: string; icon?: string; order?: number },
  now: Timestamp = Date.now(),
): PaperFolder {
  return {
    type: "paper_folder",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: input.name.trim() || "Folder",
    color: input.color ?? "#5751c7",
    icon: input.icon ?? "folder",
    order: input.order ?? now,
    status: "active",
  };
}

export interface PaperPoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface PaperStroke extends EntityMeta {
  type: "paper_stroke";
  notebookId: ID;
  pageId: ID;
  layerId: ID;
  tool: PaperToolKind;
  color: string;
  width: number;
  opacity: number;
  blend: PaperBlend;
  points: PaperPoint[];
  recognizedShape: PaperShapeKind | null;
  recognizedText: string | null;
  recognitionConfidence: number;
  closedPath: boolean;
}

export interface PaperLayer extends EntityMeta {
  type: "paper_layer";
  notebookId: ID;
  pageId: ID;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
}

export interface PaperImage extends EntityMeta {
  type: "paper_image";
  notebookId: ID;
  pageId: ID;
  layerId: ID;
  url: string;
  name: string;
  mimeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PaperAudio extends EntityMeta {
  type: "paper_audio";
  notebookId: ID;
  pageId: ID;
  x: number;
  y: number;
  url: string;
  durationMs: number;
  transcript: string | null;
}

export interface PaperSticker extends EntityMeta {
  type: "paper_sticker";
  notebookId: ID;
  pageId: ID;
  stickerId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface PaperDiagramNode {
  id: ID;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  shape: "rounded" | "ellipse" | "diamond" | "cloud";
}

export interface PaperDiagramEdge {
  id: ID;
  from: ID;
  to: ID;
  label: string;
  style: "solid" | "dashed";
}

export interface PaperDiagram extends EntityMeta {
  type: "paper_diagram";
  notebookId: ID;
  pageId: ID;
  kind: "mindmap" | "flowchart" | "concept";
  title: string;
  nodes: PaperDiagramNode[];
  edges: PaperDiagramEdge[];
  recognitionConfidence: number;
}

export type PaperRecognitionKind = "handwriting" | "shape" | "diagram" | "math";

export type PaperRecognitionStatus = "pending" | "accepted" | "rejected";

export interface PaperRecognitionCandidate {
  text: string;
  confidence: number;
}

export interface PaperRecognition extends EntityMeta {
  type: "paper_recognition";
  notebookId: ID;
  pageId: ID;
  kind: PaperRecognitionKind;
  strokeIds: ID[];
  text: string;
  candidates: PaperRecognitionCandidate[];
  shape: PaperShapeKind | null;
  math: string | null;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
  status: PaperRecognitionStatus;
}

export interface PaperPage extends EntityMeta {
  type: "paper_page";
  notebookId: ID;
  name: string;
  template: PaperTemplateKind;
  paperColor: string;
  patternScale: number;
  order: number;
  status: PaperStatus;
  kind: PaperPageKind;
  folderId: ID | null;
  tags: string[];
  favorite: boolean;
  shared: boolean;
  textContent: string;
  wordCount: number;
}

export interface PaperNotebook extends EntityMeta {
  type: "paper_notebook";
  title: string;
  description: string;
  coverColor: string;
  template: PaperTemplateKind;
  pageIds: ID[];
  status: PaperStatus;
  goalIds: ID[];
  projectIds: ID[];
  lastOpenedAt: Timestamp | null;
}

export interface NewPaperNotebookInput {
  title: string;
  description?: string;
  coverColor?: string;
  template?: PaperTemplateKind;
  goalIds?: ID[];
  projectIds?: ID[];
  firstPageName?: string;
}

export interface NewPaperPageInput {
  notebookId: ID;
  name?: string;
  template?: PaperTemplateKind;
  paperColor?: string;
  patternScale?: number;
  order?: number;
  kind?: PaperPageKind;
  folderId?: ID | null;
  tags?: string[];
  favorite?: boolean;
  shared?: boolean;
  textContent?: string;
}

export interface NewPaperStrokeInput {
  notebookId: ID;
  pageId: ID;
  layerId: ID;
  tool: PaperToolKind;
  color?: string;
  width?: number;
  opacity?: number;
  blend?: PaperBlend;
  points: PaperPoint[];
}

export const PAPER_COLORS = [
  "#111827",
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
] as const;

export const HIGHlighter_COLORS = [
  "rgba(250, 204, 21, 0.45)",
  "rgba(74, 222, 128, 0.45)",
  "rgba(96, 165, 250, 0.45)",
  "rgba(244, 114, 182, 0.45)",
] as const;

export const PAPER_TEMPLATE_LABELS: Record<PaperTemplateKind, string> = {
  blank: "Blank",
  ruled: "Ruled",
  grid: "Grid",
  dotted: "Dotted",
  isometric: "Isometric",
  cornell: "Cornell",
};

export const PAPER_TEMPLATES: PaperTemplateKind[] = ["blank", "ruled", "grid", "dotted", "isometric", "cornell"];

export const SHAPE_LABELS: Record<PaperShapeKind, string> = {
  line: "Line",
  arrow: "Arrow",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  polygon: "Polygon",
  star: "Star",
  connector: "Connector",
};

export function defaultInkWidth(tool: PaperToolKind): number {
  switch (tool) {
    case "pen":
      return 3;
    case "pencil":
      return 2;
    case "highlighter":
      return 22;
    case "marker":
      return 8;
    case "eraser":
      return 24;
    default:
      return 3;
  }
}

export function defaultInkColor(tool: PaperToolKind): string {
  switch (tool) {
    case "highlighter":
      return HIGHlighter_COLORS[0]!;
    case "pencil":
      return "#4b5563";
    default:
      return PAPER_COLORS[0]!;
  }
}

export function defaultBlend(tool: PaperToolKind): PaperBlend {
  return tool === "highlighter" ? "multiply" : "normal";
}

export const DEFAULT_PAGE_W = 900;
export const DEFAULT_PAGE_H = 1200;

export function createPaperStroke(input: NewPaperStrokeInput, now: Timestamp = Date.now()): PaperStroke {
  return {
    type: "paper_stroke",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    notebookId: input.notebookId,
    pageId: input.pageId,
    layerId: input.layerId,
    tool: input.tool,
    color: input.color ?? defaultInkColor(input.tool),
    width: input.width ?? defaultInkWidth(input.tool),
    opacity: input.opacity ?? (input.tool === "highlighter" ? 0.45 : 1),
    blend: input.blend ?? defaultBlend(input.tool),
    points: input.points,
    recognizedShape: null,
    recognizedText: null,
    recognitionConfidence: 0,
    closedPath: false,
  };
}

export function createPaperPage(input: NewPaperPageInput, now: Timestamp = Date.now()): PaperPage {
  const textContent = input.textContent ?? "";
  return {
    type: "paper_page",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    notebookId: input.notebookId,
    name: input.name?.trim() || "Page",
    template: input.template ?? "blank",
    paperColor: input.paperColor ?? "#fbf8f3",
    patternScale: input.patternScale ?? 24,
    order: input.order ?? now,
    status: "active",
    kind: input.kind ?? "handwritten",
    folderId: input.folderId ?? null,
    tags: input.tags ?? [],
    favorite: input.favorite ?? false,
    shared: input.shared ?? false,
    textContent,
    wordCount: countPaperWords(textContent),
  };
}

export function countPaperWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function createPaperLayer(
  input: { notebookId: ID; pageId: ID; name?: string; order?: number },
  now: Timestamp = Date.now(),
): PaperLayer {
  return {
    type: "paper_layer",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    notebookId: input.notebookId,
    pageId: input.pageId,
    name: input.name?.trim() || "Layer",
    visible: true,
    locked: false,
    opacity: 1,
    order: input.order ?? now,
  };
}

export function movePaperPageToTrash(page: PaperPage, now: Timestamp = Date.now()): PaperPage {
  return { ...page, status: "trashed", updatedAt: now };
}

export function restorePaperPage(page: PaperPage, now: Timestamp = Date.now()): PaperPage {
  return { ...page, status: "active", updatedAt: now };
}

export function createPaperNotebook(input: NewPaperNotebookInput, now: Timestamp = Date.now()): PaperNotebook {
  return {
    type: "paper_notebook",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    description: input.description ?? "",
    coverColor: input.coverColor ?? "#1f2937",
    template: input.template ?? "blank",
    pageIds: [],
    status: "active",
    goalIds: input.goalIds ?? [],
    projectIds: input.projectIds ?? [],
    lastOpenedAt: null,
  };
}