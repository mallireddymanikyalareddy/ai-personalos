"use client";

import type { PaperPage, PaperTemplateKind } from "@personalos/core";

export function PaperTemplatePattern(
  ctx: CanvasRenderingContext2D,
  page: PaperPage,
  scale: number,
  width: number,
  height: number,
): void {
  const spacing = page.template === "blank" ? 0 : page.patternScale;

  ctx.save();
  ctx.strokeStyle = "rgba(120,116,104,0.35)";
  ctx.lineWidth = 1 / scale;

  if (page.template === "grid" || page.template === "isometric") {
    ctx.beginPath();
    for (let x = spacing; x < width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = spacing; y < height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (page.template === "ruled" || page.template === "cornell") {
    ctx.beginPath();
    for (let y = spacing; y < height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (page.template === "dotted") {
    ctx.fillStyle = "rgba(120,116,104,0.45)";
    for (let y = spacing / 2; y < height; y += spacing) {
      for (let x = spacing / 2; x < width; x += spacing) {
        ctx.fillRect(x - 1 / scale, y - 1 / scale, 2 / scale, 2 / scale);
      }
    }
    ctx.restore();
    return;
  }

  ctx.restore();
}

export const TEMPLATE_LABELS: Record<PaperTemplateKind, string> = {
  blank: "Blank",
  ruled: "Ruled",
  grid: "Grid",
  dotted: "Dotted",
  isometric: "Isometric",
  cornell: "Cornell",
};