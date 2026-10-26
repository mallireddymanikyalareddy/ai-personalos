import type { PaperStroke } from "../../types/paper";

export interface PdfExportOptions {
  title: string;
  width: number;
  height: number;
  background: string;
  guidelineSpacing?: number;
  guidelineColor?: string;
  template?: "blank" | "ruled" | "grid" | "dotted" | "isometric" | "cornell";
}

export interface PdfInputStroke {
  color: string;
  width: number;
  opacity: number;
  points: Array<{ x: number; y: number; pressure: number }>;
}

function escapePdf(text: string): string {
  return text.replace(/([()\\])/g, "\\$1").replace(/[\r\n]/g, " ");
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.trim().toLowerCase();
  const match = /^#?([0-9a-f]{6})$/.exec(value);
  if (!match) return [0, 0, 0];
  const int = Number.parseInt(match[1]!, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

function strokeOps(stroke: PdfInputStroke): string {
  if (stroke.points.length === 0) return "";
  const [r, g, b] = hexToRgb(stroke.color);
  const parts: string[] = [];

  if (stroke.opacity < 1) {
    parts.push("/GS0 gs");
    parts.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    parts.push(`${stroke.width.toFixed(2)} w`);
  } else {
    parts.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    parts.push(`${stroke.width.toFixed(2)} w`);
  }

  const first = stroke.points[0]!;
  parts.push(`${first.x.toFixed(2)} ${(pdfHeight(stroke, first.y) as number).toFixed(2)} m`);

  let previous = first;
  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index]!;
    parts.push(`${point.x.toFixed(2)} ${(pdfHeight(stroke, point.y) as number).toFixed(2)} l`);
    previous = point;
  }
  void previous;

  if (stroke.points.length === 1) {
    const point = stroke.points[0]!;
    parts.push(`${(point.x + 0.5).toFixed(2)} ${(pdfHeight(stroke, point.y) as number).toFixed(2)} l`);
  }

  parts.push("S");
  return parts.join("\n");
}

let pdfPageHeight = 792;

function pdfHeight(stroke: PdfInputStroke, y: number): number {
  void stroke;
  return pdfPageHeight - y;
}

function backgroundOps(options: PdfExportOptions): string {
  const [r, g, b] = hexToRgb(options.background);
  const ops: string[] = [];
  ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  ops.push(`0 0 ${options.width.toFixed(2)} ${options.height.toFixed(2)} re`);
  ops.push("f");

  const spacing = options.guidelineSpacing ?? 0;
  if (spacing > 0 && options.template && options.template !== "blank") {
    const [gr, gg, gb] = hexToRgb(options.guidelineColor ?? "#d8d2c8");
    ops.push(`${gr.toFixed(3)} ${gg.toFixed(3)} ${gb.toFixed(3)} RG`);
    ops.push("0.4 w");

    if (options.template === "grid" || options.template === "isometric") {
      for (let x = spacing; x < options.width; x += spacing) {
        ops.push(`${x.toFixed(2)} 0 m ${x.toFixed(2)} ${options.height.toFixed(2)} l S`);
      }
      for (let y = spacing; y < options.height; y += spacing) {
        ops.push(`0 ${(options.height - y).toFixed(2)} m ${options.width.toFixed(2)} ${(options.height - y).toFixed(2)} l S`);
      }
    } else if (options.template === "ruled" || options.template === "cornell") {
      for (let y = spacing; y < options.height; y += spacing) {
        ops.push(`0 ${(options.height - y).toFixed(2)} m ${options.width.toFixed(2)} ${(options.height - y).toFixed(2)} l S`);
      }
    } else if (options.template === "dotted") {
      for (let y = spacing / 2; y < options.height; y += spacing) {
        for (let x = spacing / 2; x < options.width; x += spacing) {
          ops.push(`${x.toFixed(2)} ${(options.height - y).toFixed(2)} m ${(x + 0.2).toFixed(2)} ${(options.height - y).toFixed(2)} l S`);
        }
      }
    }
  }

  return ops.join("\n");
}

function buildPdfDocument(options: PdfExportOptions, strokes: PdfInputStroke[]): string {
  pdfPageHeight = options.height;

  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const contentParts: string[] = [backgroundOps(options)];
  for (const stroke of strokes) {
    const ops = strokeOps(stroke);
    if (ops) contentParts.push(ops);
  }
  const content = contentParts.join("\n");

  const hasTransparency = strokes.some((stroke) => stroke.opacity < 1);

  const contentId = addObject(
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  );

  let graphicsId: number | null = null;
  if (hasTransparency) {
    graphicsId = addObject(`<< /Type /ExtGState /Subtype /GState /ca 0.55 /CA 0.55 >>`);
  }

  const resourcesParts = ["/ProcSet [/PDF /Text]"];
  if (graphicsId) {
    resourcesParts.push(`/ExtGState << /GS0 ${graphicsId} 0 R >>`);
  }
  const resources = `<< ${resourcesParts.join(" ")} >>`;

  const pageId = addObject(
    `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 ${options.width.toFixed(2)} ${options.height.toFixed(2)}] /Contents ${contentId} 0 R /Resources ${resources} >>`,
  );
  void pageId;

  const pagesId = addObject(`<< /Type /Pages /Kids [4 0 R] /Count 1 >>`);
  void pagesId;

  addObject(
    `<< /Type /Catalog /Pages 2 0 R >>`,
  );

  const infoId = addObject(
    `<< /Title (${escapePdf(options.title)}) /Producer (PersonalOS Digital Paper) /Creator (PersonalOS) >>`,
  );

  let pdf = "%PDF-1.4\n";
  objects.forEach((body, index) => {
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  let offset = "%PDF-1.4\n".length;
  for (let index = 0; index < objects.length; index += 1) {
    const body = objects[index]!;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    offset += `${index + 1} 0 obj\n${body}\nendobj\n`.length;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 2 0 R /Info ${infoId} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;
  return pdf;
}

export function exportPdf(
  options: PdfExportOptions,
  strokes: PaperStroke[] | PdfInputStroke[],
): string {
  const input: PdfInputStroke[] = strokes.map((stroke) => ({
    color: "color" in stroke ? stroke.color : "#111827",
    width: stroke.width,
    opacity: stroke.opacity,
    points: stroke.points.map((point) => ({ x: point.x, y: point.y, pressure: point.pressure })),
  }));
  return buildPdfDocument(options, input);
}

export function pdfByteLength(options: PdfExportOptions, strokes: PdfInputStroke[]): number {
  return buildPdfDocument(options, strokes).length;
}

export function exportSvg(options: { width: number; height: number; background: string }, strokes: PdfInputStroke[]): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">`,
    `<rect width="${options.width}" height="${options.height}" fill="${options.background}" />`,
  ];

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const d = stroke.points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    parts.push(
      `<path d="${d}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}" />`,
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}

export function pngDataUrlPlaceholder(width: number, height: number): string {
  const canvas = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fbf8f3"/></svg>`,
  )}`;
  return canvas;
}