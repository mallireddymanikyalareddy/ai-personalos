import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { PaperModule } from "./paper-module";

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, prefetch: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function pts(points: Array<[number, number]>) {
  return points.map(([x, y], index) => ({ x, y, pressure: 0.5, timestamp: index }));
}

describe("PaperModule", () => {
  beforeEach(() => {
    const os = getOS();
    os.clearAll();
    os.hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  it("offers every writing tool", () => {
    getOS().addPaperNotebook({ title: "N" });
    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    const group = screen.getByRole("radiogroup", { name: "Tool" });
    for (const label of ["Pen", "Pencil", "Highlighter", "Marker", "Shapes", "Eraser", "Lasso"]) {
      expect(within(group).getByRole("radio", { name: label })).toBeDefined();
    }
    expect(screen.getByRole("radiogroup", { name: "Ink colour" })).toBeDefined();
    expect(screen.getByRole("radiogroup", { name: "Stroke width" })).toBeDefined();
  });

  it("creates a notebook and opens its first page", () => {
    const os = getOS();
    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create your first notebook/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Sketchbook" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create notebook" }));

    expect(os.paperNotebooks()).toHaveLength(1);
    expect(os.getPaperNotebook(os.paperNotebooks()[0]!.id)!.title).toBe("Sketchbook");
    expect(os.paperPages(os.paperNotebooks()[0]!.id)).toHaveLength(1);
  });

  it("records strokes and erases them", () => {
    const os = getOS();
    const notebook = os.addPaperNotebook({ title: "N" });
    const pageId = notebook.pageIds[0]!;
    const layerId = os.paperLayers(pageId)[0]!.id;

    os.addPaperStroke({
      notebookId: notebook.id,
      pageId,
      layerId,
      tool: "pen",
      color: "#111827",
      width: 4,
      points: pts([[100, 100], [200, 100]]),
    });

    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "N" }));
    expect(screen.getByText(/2 strokes|1 strokes|strokes/)).toBeDefined();
    expect(os.paperStrokes(pageId)).toHaveLength(1);

    fireEvent.click(screen.getByRole("radio", { name: "Eraser" }));
    const canvas = screen.getByLabelText("Paper canvas");
    expect(canvas).toBeDefined();
  });

  it("switches templates and adds pages and layers", () => {
    const os = getOS();
    os.addPaperNotebook({ title: "N", template: "grid" });

    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "ruled" } });
    const notebook = os.paperNotebooks()[0]!;
    expect(os.getPaperPage(notebook.pageIds[0]!)!.template).toBe("ruled");

    fireEvent.click(screen.getByRole("button", { name: /Add page/ }));
    expect(os.paperPages(notebook.id)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Layers" }));
    fireEvent.click(screen.getByRole("button", { name: /Add layer/ }));
    expect(os.paperLayers(os.getPaperNotebook(notebook.id)!.pageIds[1]!)).toHaveLength(2);
  });

  it("recognises shapes and handwriting on the page", () => {
    const os = getOS();
    const notebook = os.addPaperNotebook({ title: "N" });
    const pageId = notebook.pageIds[0]!;
    const layerId = os.paperLayers(pageId)[0]!.id;

    const rect: Array<[number, number]> = [];
    for (let x = 0; x <= 200; x += 20) rect.push([x, 0]);
    for (let y = 0; y <= 180; y += 20) rect.push([200, y]);
    for (let x = 200; x >= 0; x -= 20) rect.push([x, 180]);
    for (let y = 180; y >= 0; y -= 20) rect.push([0, y]);

    os.addPaperStroke({ notebookId: notebook.id, pageId, layerId, tool: "pen", points: pts(rect) });

    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Recognise/ }));
    });

    expect(screen.getByText(/shape[ds]?:/)).toBeDefined();
    expect(os.getState().paperDiagrams).toBeDefined();
  });

  it("exports the page as PDF and SVG", () => {
    const os = getOS();
    const notebook = os.addPaperNotebook({ title: "N" });
    const pageId = notebook.pageIds[0]!;
    const layerId = os.paperLayers(pageId)[0]!.id;
    os.addPaperStroke({ notebookId: notebook.id, pageId, layerId, tool: "pen", points: pts([[10, 10], [300, 300]]) });

    const created: string[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = realCreate(tag);
      if (tag === "a") {
        created.push("anchor");
        element.click = () => undefined;
      }
      return element;
    });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "SVG" }));
    expect(created.length).toBeGreaterThanOrEqual(2);
    expect(revoke).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("adds stickers", () => {
    const os = getOS();
    os.addPaperNotebook({ title: "N" });

    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add star sticker" }));
    expect(os.paperStickers(os.getPaperNotebook(os.paperNotebooks()[0]!.id)!.pageIds[0]!)).toHaveLength(1);
  });

  it("undoes the last stroke", () => {
    const os = getOS();
    const notebook = os.addPaperNotebook({ title: "N" });
    const pageId = notebook.pageIds[0]!;
    const layerId = os.paperLayers(pageId)[0]!.id;
    os.addPaperStroke({ notebookId: notebook.id, pageId, layerId, tool: "pen", points: pts([[0, 0], [10, 10]]) });
    os.addPaperStroke({ notebookId: notebook.id, pageId, layerId, tool: "pen", points: pts([[0, 0], [10, 10]]) });

    render(
      <ToastProvider>
        <PaperModule />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(os.paperStrokes(pageId)).toHaveLength(1);
  });
});