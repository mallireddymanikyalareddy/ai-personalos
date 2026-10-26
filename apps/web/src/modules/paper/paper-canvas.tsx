"use client";

import * as React from "react";

import type { PaperPage, PaperStroke } from "@personalos/core";

import { PaperTemplatePattern } from "./paper-template";
import { drawPencilStroke, drawStroke, usePaperCanvas, type CanvasView } from "./use-paper-canvas";

export interface PaperCanvasProps {
  page: PaperPage;
  strokes: PaperStroke[];
  tool: PaperStroke["tool"];
  color: string;
  width: number;
  opacity: number;
  eraserRadius: number;
  notebookId: string;
  layerId: string;
  onStrokeComplete: (stroke: PaperStroke) => void;
  onEraseAt: (x: number, y: number) => void;
  fitToContent: boolean;
  children?: (view: CanvasView) => React.ReactNode;
}

export const PAPER_WIDTH = 900;
export const PAPER_HEIGHT = 1200;

export function PaperCanvas(props: PaperCanvasProps) {
  const {
    page,
    strokes,
    tool,
    color,
    width,
    opacity,
    eraserRadius,
    notebookId,
    layerId,
    onStrokeComplete,
    onEraseAt,
    children,
  } = props;

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [view, setView] = React.useState<CanvasView>({ scale: 1, offsetX: 24, offsetY: 24 });

  const { handlers, live, phase } = usePaperCanvas(canvasRef, {
    tool,
    color,
    width,
    opacity,
    pageId: page.id,
    layerId,
    notebookId,
    eraserRadius,
    onStrokeComplete,
    onEraseAt,
  });

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    setView((current) => ({ ...current }));
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e9e5dd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = view.scale;
    ctx.save();
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = page.paperColor;
    ctx.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);

    ctx.save();
    ctx.lineWidth = 1 / scale;
    PaperTemplatePattern(ctx, page, scale, PAPER_WIDTH, PAPER_HEIGHT);
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);

    for (const stroke of strokes) {
      if (stroke.tool === "pencil") drawPencilStroke(ctx, stroke, scale);
      else drawStroke(ctx, stroke, scale);
    }

    if (phase === "drawing" && live.length > 0) {
      const pending: PaperStroke = {
        type: "paper_stroke",
        id: "live",
        createdAt: 0,
        updatedAt: 0,
        notebookId,
        pageId: page.id,
        layerId,
        tool,
        color,
        width,
        opacity,
        blend: tool === "highlighter" ? "multiply" : "normal",
        points: live,
        recognizedShape: null,
        recognizedText: null,
        recognitionConfidence: 0,
        closedPath: false,
      };
      if (tool === "pencil") drawPencilStroke(ctx, pending, scale);
      else drawStroke(ctx, pending, scale);
    }

    ctx.restore();
  }, [strokes, live, phase, page, tool, color, width, opacity, notebookId, layerId, view]);

  const cursor =
    tool === "eraser"
      ? "cell"
      : phase === "panning"
        ? "grabbing"
        : tool === "lasso"
          ? "crosshair"
          : "crosshair";

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor }}
        data-role={tool}
        aria-label="Paper canvas"
        {...handlers}
      />
      {children?.(view)}
    </div>
  );
}