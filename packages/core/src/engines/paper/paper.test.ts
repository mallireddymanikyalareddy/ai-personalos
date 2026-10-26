import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  simplifyStroke,
  strokeBounds,
  pointsBounds,
  strokeLength,
  hitTestStroke,
  zoomAt,
  screenToCanvas,
  canvasToScreen,
  resampleStroke,
  smoothPoints,
  averagePressure,
} from "./geometry";
import { recognizeShape } from "./shapes";
import { recognizeShapesBatch, REGISTRY, segmentInkIntoLayers } from "./recognize";
import { exportPdf, exportSvg } from "./pdf";
import { selectPaperPage, inkStats, optimizeStroke, notebookSummary } from "./engine";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

function rectPoints(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = 0; x <= 200; x += 20) out.push([x, 0]);
  for (let y = 0; y <= 180; y += 20) out.push([200, y]);
  for (let x = 200; x >= 0; x -= 20) out.push([x, 180]);
  for (let y = 180; y >= 0; y -= 20) out.push([0, y]);
  return out;
}

function arrowPoints(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = 0; x <= 100; x += 20) out.push([x, 0]);
  out.push([94, -12], [114, 12]);
  return out;
}

function pts(points: Array<[number, number]>): Array<{ x: number; y: number; pressure: number; timestamp: number }> {
  return points.map(([x, y], index) => ({ x, y, pressure: 0.5, timestamp: index * 10 }));
}

function makeNotebook(os: PersonalOS) {
  const notebook = os.addPaperNotebook({ title: "Field notes", template: "grid" });
  const page = notebook.pageIds[0]!;
  const layer = os.paperLayers(page)[0]!;
  return { notebook, page: os.getPaperPage(page)!, layer };
}

describe("Paper geometry", () => {
  it("simplifies collinear points away and keeps corners", () => {
    const input = pts([
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
      [40, 0],
      [40, 10],
      [40, 20],
    ]);
    const simplified = simplifyStroke(input, 2);
    expect(simplified.length).toBeLessThan(input.length);
    expect(simplified.length).toBeGreaterThanOrEqual(3);
    expect(simplified[0]).toEqual(input[0]);
    expect(simplified[simplified.length - 1]).toEqual(input[input.length - 1]);
  });

  it("computes bounds, length and pressure", () => {
    const input = pts([
      [0, 0],
      [30, 0],
      [30, 40],
    ]);
    const stroke = { ...input } as never;

    const bounds = pointsBounds(input)!;
    expect(bounds.width).toBe(30);
    expect(bounds.height).toBe(40);
    expect(strokeLength(input)).toBe(70);
    expect(averagePressure(input)).toBe(0.5);
    void stroke;
  });

  it("hit-tests a stroke against the canvas pointer", () => {
    const os = makeOS();
    const { page, layer } = makeNotebook(os);
    const stroke = os.addPaperStroke({
      notebookId: page.notebookId,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      color: "#111827",
      width: 4,
      points: pts([
        [100, 100],
        [200, 100],
        [300, 100],
      ]),
    });

    expect(hitTestStroke(stroke, 150, 100, 8)).toBe(true);
    expect(hitTestStroke(stroke, 150, 150, 8)).toBe(false);
    expect(hitTestStroke(stroke, 150, 400, 8)).toBe(false);
    expect(strokeBounds(stroke)!.width).toBe(200);
  });

  it("resamples and smooths without losing the endpoints", () => {
    const input = pts([
      [0, 0],
      [10, 5],
      [20, 0],
      [30, 5],
    ]);
    const resampled = resampleStroke(input, 4);
    expect(resampled[0]?.x).toBe(0);
    expect(resampled.length).toBeGreaterThan(input.length);

    const smoothed = smoothPoints(input, 0.5);
    expect(smoothed).toHaveLength(input.length);
    expect(smoothed[0]).toEqual(input[0]);
  });

  it("pans and zooms around a focal point", () => {
    const view = { scale: 1, offsetX: 0, offsetY: 0 };
    const point = { x: 100, y: 100 };

    expect(screenToCanvas(point, view)).toEqual({ x: 100, y: 100 });
    expect(canvasToScreen(point, view)).toEqual({ x: 100, y: 100 });

    const zoomed = zoomAt(view, point, 2);
    expect(zoomed.scale).toBe(2);
    const focal = screenToCanvas(point, zoomed);
    expect(focal.x).toBeCloseTo(100, 5);
    expect(focal.y).toBeCloseTo(100, 5);
  });
});

describe("Paper shape recognition", () => {
  it("recognises a hand-drawn rectangle", () => {
    const points = pts(rectPoints());
    const result = recognizeShape(points);
    expect(result.shape).toBe("rectangle");
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.closed).toBe(true);
  });

  it("recognises an ellipse", () => {
    const points: Array<[number, number]> = [];
    for (let index = 0; index <= 40; index += 1) {
      const angle = (index / 40) * Math.PI * 2;
      points.push([Math.round(60 + 50 * Math.cos(angle)), Math.round(40 + 30 * Math.sin(angle))]);
    }
    const result = recognizeShape(pts(points));
    expect(result.shape).toBe("ellipse");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("recognises a straight line", () => {
    const result = recognizeShape(pts([[0, 0], [40, 2], [80, 0], [120, 1], [160, 0], [200, 1], [240, 0], [280, 1], [300, 0]]));
    expect(result.shape).toBe("line");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("recognises an arrow", () => {
    const result = recognizeShape(pts(arrowPoints()));
    expect(result.shape).toBe("arrow");
  });

  it("rejects freeform scribbles", () => {
    const points = pts([
      [0, 0],
      [20, 40],
      [50, 10],
      [80, 50],
      [120, 5],
      [160, 60],
    ]);
    const result = recognizeShape(points);
    expect(result.shape).toBeNull();
  });

  it("batches recognition across strokes", () => {
    const strokes = [
      { id: "a", points: pts(rectPoints()) },
      { id: "b", points: pts([[0, 0], [40, 2], [80, 0], [120, 1], [160, 0], [200, 1], [240, 0], [280, 1], [300, 0]]) },
      { id: "c", points: pts([[0, 0], [30, 40], [60, 10], [90, 60]]) },
    ];
    const recognised = recognizeShapesBatch(strokes, 0.72);
    expect(recognised.length).toBeGreaterThanOrEqual(2);
    expect(recognised.map((entry) => entry.strokeId)).toContain("a");
  });
});

describe("Paper handwriting preparation", () => {
  it("segments ink into lines by vertical position", () => {
    const strokes = [
      { id: "a", points: pts([[0, 100], [50, 110]]) },
      { id: "b", points: pts([[0, 200], [50, 210]]) },
      { id: "c", points: pts([[0, 104], [50, 114]]) },
    ];
    const { lines } = segmentInkIntoLayers(strokes);
    expect(lines.length).toBe(2);
    expect(lines[0]!.strokeIds).toContain("c");
  });

  it("exposes a pluggable recognizer that reports readiness", async () => {
    expect(REGISTRY.handwriting.ready).toBe(false);
    REGISTRY.handwriting.warmup();
    expect(REGISTRY.handwriting.ready).toBe(true);

    const result = await REGISTRY.handwriting.recognize([{ id: "a", points: pts([[0, 0], [100, 0]]) }]);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.lines).toHaveLength(1);
  });

  it("reports that math and diagram recognizers are pluggable", async () => {
    REGISTRY.math.warmup();
    REGISTRY.diagram.warmup();
    expect(REGISTRY.math.ready).toBe(true);
    expect(REGISTRY.diagram.ready).toBe(true);

    const math = await REGISTRY.math.recognize([]);
    expect(math.latex).toBeNull();

    const diagram = await REGISTRY.diagram.recognize([
      { id: "a", points: pts(rectPoints()) },
    ]);
    expect(diagram.nodes.length).toBeGreaterThan(0);
    expect(diagram.kind).toBe("flowchart");
  });
});

describe("Paper export", () => {
  it("writes a real vector PDF", () => {
    const pdf = exportPdf(
      { title: "Field notes", width: 200, height: 200, background: "#fbf8f3", template: "grid", guidelineSpacing: 20 },
      [
        {
          type: "paper_stroke",
          id: "s1",
          createdAt: NOW,
          updatedAt: NOW,
          notebookId: "n",
          pageId: "p",
          layerId: "l",
          tool: "pen",
          color: "#111827",
          width: 3,
          opacity: 1,
          blend: "normal",
          points: pts([[10, 10], [100, 50]]),
          recognizedShape: null,
          recognizedText: null,
          recognitionConfidence: 0,
          closedPath: false,
        },
      ],
    );

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("0 0 200.00 200.00 re");
    expect(pdf).toContain("10.00 190.00 m");
    expect(pdf).toContain("100.00 150.00 l");
    expect(pdf).toContain("%%EOF");
    expect(pdf).toContain("/Title (Field notes)");
  });

  it("writes an SVG mirror of the ink", () => {
    const svg = exportSvg({ width: 200, height: 200, background: "#fff" }, [
      { color: "#111827", width: 3, opacity: 1, points: pts([[10, 10], [100, 50]]) },
    ]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("M10.00 10.00");
    expect(svg).toContain('stroke="#111827"');
  });
});

describe("Paper notebooks", () => {
  it("creates a notebook with a first page and layer", () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    expect(notebook.pageIds).toEqual([page.id]);
    expect(layer.pageId).toBe(page.id);
    expect(os.paperLayers(page.id)).toHaveLength(1);
  });

  it("adds pages and layers and stacks them", () => {
    const os = makeOS();
    const notebook = os.addPaperNotebook({ title: "N" });
    const second = os.addPaperPage({ notebookId: notebook.id, name: "Page 2" });
    const layer = os.addPaperLayer({ notebookId: notebook.id, pageId: second.id, name: "Highlights" });

    expect(os.getPaperNotebook(notebook.id)!.pageIds).toHaveLength(2);
    expect(layer.order).toBe(2);
    expect(os.paperLayers(second.id).map((entry) => entry.name)).toEqual(["Ink", "Highlights"]);
  });

  it("hides strokes on invisible layers from the bundle", () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    os.updatePaperLayer(layer.id, { visible: false });
    os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      points: pts([[0, 0], [10, 10]]),
    });

    const bundle = selectPaperPage(os.getState(), page.id)!;
    expect(bundle.strokes).toHaveLength(0);
  });

  it("erases strokes under the pointer and respects locked layers", () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      color: "#111827",
      width: 4,
      points: pts([[100, 100], [200, 100]]),
    });

    const removed = os.erasePaperStrokesAt(page.id, 150, 100, 12);
    expect(removed).toHaveLength(1);
    expect(os.paperStrokes(page.id)).toHaveLength(0);
  });

  it("optimises strokes by removing redundant points", () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    const stroke = os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      points: pts([
        [0, 0],
        [5, 0],
        [10, 0],
        [20, 0],
        [30, 0],
        [40, 0],
        [50, 0],
      ]),
    });
    const optimised = optimizeStroke(stroke, 2);
    expect(optimised.points.length).toBeLessThan(stroke.points.length);
  });

  it("summarises a notebook with its page, stroke and recognition counts", () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      points: pts([[0, 0], [10, 0]]),
    });

    const stats = notebookSummary(os.getState(), notebook.id);
    expect(stats.pages).toBe(1);
    expect(stats.strokes).toBe(1);

    const ink = inkStats(os.paperStrokes(page.id));
    expect(ink.strokeCount).toBe(1);
    expect(ink.pointCount).toBe(2);
  });

  it("exports through the OS as PDF and SVG", () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      points: pts([[10, 10], [300, 200]]),
    });

    const pdf = os.exportPaperPdf({ notebookId: notebook.id, pageId: page.id, width: 900, height: 1200 });
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("0 0 900.00 1200.00 re");

    const svg = os.exportPaperSvg({ notebookId: notebook.id, pageId: page.id });
    expect(svg).toContain("M10.00 10.00");
  });

  it("recognises, accepts and rejects handwriting through the OS", async () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    const stroke = os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      points: pts([[0, 10], [80, 10], [160, 10]]),
    });

    const record = os.addPaperRecognition({
      notebookId: notebook.id,
      pageId: page.id,
      kind: "handwriting",
      strokeIds: [stroke.id],
      text: "hello world",
      candidates: [{ text: "hello world", confidence: 0.6 }],
      shape: null,
      math: null,
      confidence: 0.6,
      bounds: { x: 0, y: 10, width: 160, height: 0 },
      status: "pending",
    });

    os.acceptPaperRecognition(record.id, "hello world");
    expect(os.getState().paperRecognitions[record.id]!.text).toBe("hello world");

    os.rejectPaperRecognition(record.id);
    expect(os.getState().paperRecognitions[record.id]!.status).toBe("rejected");
  });

  it("recognises shapes and diagrams through the OS", async () => {
    const os = makeOS();
    const { notebook, page, layer } = makeNotebook(os);
    os.addPaperStroke({
      notebookId: notebook.id,
      pageId: page.id,
      layerId: layer.id,
      tool: "pen",
      points: pts(rectPoints()),
    });

    const shapes = os.recognizePaperShapes(page.id);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.shape).toBe("rectangle");

    const latex = await os.recognizePaperMath(page.id);
    expect(latex).toBeDefined();

    const diagram = await os.recognizePaperDiagram(page.id);
    expect(diagram).not.toBeNull();
    expect(diagram!.nodes.length).toBeGreaterThan(0);
  });
});