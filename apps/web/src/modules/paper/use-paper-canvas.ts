"use client";

import * as React from "react";

import type { PaperPoint, PaperStroke, PaperToolKind } from "@personalos/core";

export interface CanvasView {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type PointerPhase = "idle" | "drawing" | "erasing" | "panning";

export interface UsePaperCanvasOptions {
  tool: PaperToolKind;
  color: string;
  width: number;
  opacity: number;
  pageId: string;
  layerId: string;
  notebookId: string;
  eraserRadius: number;
  onStrokeComplete: (stroke: PaperStroke) => void;
  onEraseAt: (x: number, y: number) => void;
}

export function usePaperCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UsePaperCanvasOptions,
) {
  const [view, setView] = React.useState<CanvasView>({ scale: 1, offsetX: 24, offsetY: 24 });
  const [phase, setPhase] = React.useState<PointerPhase>("idle");
  const liveRef = React.useRef<PaperPoint[]>([]);
  const [live, setLive] = React.useState<PaperPoint[]>([]);
  const panRef = React.useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const spaceRef = React.useRef(false);

  const clamp = React.useCallback((next: CanvasView): CanvasView => {
    const scale = Math.max(0.15, Math.min(5, next.scale));
    return { scale, offsetX: next.offsetX, offsetY: next.offsetY };
  }, []);

  const toCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - view.offsetX) / view.scale;
      const y = (clientY - rect.top - view.offsetY) / view.scale;
      return { x, y };
    },
    [canvasRef, view],
  );

  const zoomBy = React.useCallback(
    (factor: number, focal: { x: number; y: number }) => {
      setView((current) => {
        const scale = Math.max(0.15, Math.min(5, current.scale * factor));
        const ratio = scale / current.scale;
        return clamp({
          scale,
          offsetX: focal.x - ratio * (focal.x - current.offsetX),
          offsetY: focal.y - ratio * (focal.y - current.offsetY),
        });
      });
    },
    [clamp],
  );

  const zoomTo = React.useCallback((scale: number) => {
    setView((current) => clamp({ ...current, scale }));
  }, [clamp]);

  const resetView = React.useCallback(() => setView({ scale: 1, offsetX: 24, offsetY: 24 }), []);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.button === 1 || spaceRef.current || event.altKey) {
        panRef.current = {
          x: event.clientX,
          y: event.clientY,
          offsetX: view.offsetX,
          offsetY: view.offsetY,
        };
        setPhase("panning");
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const point = toCanvas(event.clientX, event.clientY);
      if (options.tool === "eraser") {
        setPhase("erasing");
        options.onEraseAt(point.x, point.y);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (options.tool === "lasso") {
        setPhase("drawing");
        liveRef.current = [];
        return;
      }

      const pressure = event.pressure > 0 ? event.pressure : 0.5;
      liveRef.current = [{ x: point.x, y: point.y, pressure, timestamp: Date.now() }];
      setLive(liveRef.current);
      setPhase("drawing");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [options, toCanvas, view.offsetX, view.offsetY],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (phase === "panning" && panRef.current) {
        const pan = panRef.current;
        setView((current) =>
          clamp({
            scale: current.scale,
            offsetX: pan.offsetX + (event.clientX - pan.x),
            offsetY: pan.offsetY + (event.clientY - pan.y),
          }),
        );
        return;
      }

      if (phase === "erasing") {
        const point = toCanvas(event.clientX, event.clientY);
        options.onEraseAt(point.x, point.y);
        return;
      }

      if (phase === "drawing") {
        const pressure = event.pressure > 0 ? event.pressure : 0.5;
        const source = (event as unknown as { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.() ?? [];
        const racyPoints = source.length > 0 ? source : [event as unknown as PointerEvent];
        for (const raw of racyPoints) {
          const rawPoint = toCanvas(raw.clientX, raw.clientY);
          const last = liveRef.current[liveRef.current.length - 1];
          if (last && Math.hypot(rawPoint.x - last.x, rawPoint.y - last.y) < 1) continue;
          const rawPressure = raw.pressure > 0 ? raw.pressure : pressure;
          liveRef.current.push({ x: rawPoint.x, y: rawPoint.y, pressure: rawPressure, timestamp: Date.now() });
        }
        setLive(liveRef.current);
      }
    },
    [clamp, options, phase, toCanvas],
  );

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (phase === "drawing" && liveRef.current.length > 0) {
        const stroke: PaperStroke = {
          type: "paper_stroke",
          id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          notebookId: options.notebookId,
          pageId: options.pageId,
          layerId: options.layerId,
          tool: options.tool,
          color: options.color,
          width: options.width,
          opacity: options.opacity,
          blend: options.tool === "highlighter" ? "multiply" : "normal",
          points: liveRef.current,
          recognizedShape: null,
          recognizedText: null,
          recognitionConfidence: 0,
          closedPath: false,
        };
        options.onStrokeComplete(stroke);
      }
      liveRef.current = [];
      setLive([]);
      panRef.current = null;
      setPhase("idle");
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [options, phase],
  );

  const onWheel = React.useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, { x: event.clientX - rect.left, y: event.clientY - rect.top });
        return;
      }
      event.preventDefault();
      setView((current) =>
        clamp({
          scale: current.scale,
          offsetX: current.offsetX - event.deltaX,
          offsetY: current.offsetY - event.deltaY,
        }),
      );
    },
    [clamp, zoomBy],
  );

  React.useEffect(() => {
    const isSpace = (event: KeyboardEvent) => event.code === "Space" && document.activeElement === document.body;
    const down = (event: KeyboardEvent) => {
      if (isSpace(event)) {
        spaceRef.current = true;
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (isSpace(event)) spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return {
    view,
    setView,
    phase,
    live,
    zoomBy,
    zoomTo,
    resetView,
    toCanvas,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onWheel,
    },
  };
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: PaperStroke,
  scale: number,
): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  if (stroke.blend === "multiply") ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "highlighter") {
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x * scale, stroke.points[0]!.y * scale);
    for (const point of stroke.points) ctx.lineTo(point.x * scale, point.y * scale);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === "pencil") {
    ctx.lineWidth = stroke.width * 0.8;
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  if (stroke.points.length === 1) {
    const point = stroke.points[0]!;
    ctx.arc(point.x * scale, point.y * scale, stroke.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.moveTo(stroke.points[0]!.x * scale, stroke.points[0]!.y * scale);
    for (const point of stroke.points) ctx.lineTo(point.x * scale, point.y * scale);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPencilStroke(
  ctx: CanvasRenderingContext2D,
  stroke: PaperStroke,
  scale: number,
): void {
  const offsets = [-0.35, 0, 0.35];
  for (const offset of offsets) {
    ctx.save();
    ctx.globalAlpha = stroke.opacity * (offset === 0 ? 0.5 : 0.22);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * 0.55;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (stroke.points.length === 1) {
      const point = stroke.points[0]!;
      ctx.arc(point.x * scale, point.y * scale, stroke.width / 3, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(stroke.points[0]!.x * scale + offset, stroke.points[0]!.y * scale);
      for (const point of stroke.points) ctx.lineTo(point.x * scale + offset, point.y * scale);
      ctx.stroke();
    }
    ctx.restore();
  }
}