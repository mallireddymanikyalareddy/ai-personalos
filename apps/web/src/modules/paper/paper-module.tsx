"use client";

import * as React from "react";

import {
  Download,
  FileDown,
  Layers,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";

import type { PaperPage, PaperSticker, PaperStroke, PaperTemplateKind } from "@personalos/core";
import { PAPER_TEMPLATE_LABELS, PAPER_TEMPLATES } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldLabel, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { PaperCanvas } from "./paper-canvas";
import { PaperToolbar } from "./paper-toolbar";
import { useAppState, useOS } from "@/store/use-os";

const STICKERS = ["star", "flag", "heart", "idea", "warning", "check", "question", "clock"];

const STICKER_GLYPH: Record<string, string> = {
  star: "★",
  flag: "⚑",
  heart: "♥",
  idea: "💡",
  warning: "⚠",
  check: "✓",
  question: "?",
  clock: "◷",
};

function NotebookDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const os = useOS();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [template, setTemplate] = React.useState<PaperTemplateKind>("grid");
  const [cover, setCover] = React.useState("#1f2937");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setTemplate("grid");
      setCover("#1f2937");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New notebook"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!title.trim()}
            onClick={() => {
              os.addPaperNotebook({ title: title.trim(), description: description.trim(), coverColor: cover, template });
              onClose();
            }}
          >
            Create notebook
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="nb-title">Title</FieldLabel>
          <Input id="nb-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sketchbook, field notes…" autoFocus />
        </div>
        <div>
          <FieldLabel htmlFor="nb-desc">Description</FieldLabel>
          <Input id="nb-desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What lives in this notebook?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="nb-template">Default template</FieldLabel>
            <Select id="nb-template" value={template} onChange={(event) => setTemplate(event.target.value as PaperTemplateKind)}>
              {PAPER_TEMPLATES.map((value) => (
                <option key={value} value={value}>
                  {PAPER_TEMPLATE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="nb-cover">Cover colour</FieldLabel>
            <Input id="nb-cover" type="color" value={cover} onChange={(event) => setCover(event.target.value)} className="h-9" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function PaperModule({ initialPageId }: { initialPageId?: string | null } = {}) {
  const os = useOS();
  useAppState();
  const { toast } = useToast();

  const notebooks = os.paperNotebooks();
  const initialPage = initialPageId ? os.getPaperPage(initialPageId) : null;
  const [notebookId, setNotebookId] = React.useState<string | null>(
    () => initialPage?.notebookId ?? notebooks[0]?.id ?? null,
  );
  const [pageId, setPageId] = React.useState<string | null>(
    () => initialPage?.id ?? notebooks[0]?.pageIds[0] ?? null,
  );
  const [layerId, setLayerId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [layersOpen, setLayersOpen] = React.useState(false);

  const [tool, setTool] = React.useState<PaperStroke["tool"]>("pen");
  const [color, setColor] = React.useState("#111827");
  const [width, setWidth] = React.useState(3);
  const [opacity, setOpacity] = React.useState(1);
  const [recognized, setRecognized] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initialPageId) return;
    const target = os.getPaperPage(initialPageId);
    if (!target) return;
    setNotebookId(target.notebookId);
    setPageId(target.id);
  }, [initialPageId, os]);

  React.useEffect(() => {
    if (!notebookId && notebooks.length > 0) {
      setNotebookId(notebooks[0]!.id);
      const pages = os.paperPages(notebooks[0]!.id);
      if (pages.length > 0) setPageId(pages[0]!.id);
    }
  }, [notebookId, notebooks, os]);

  const notebook = notebookId ? os.getPaperNotebook(notebookId) : null;
  const pages: PaperPage[] = notebookId ? os.paperPages(notebookId) : [];
  const layers = React.useMemo(() => (pageId ? os.paperLayers(pageId) : []), [os, pageId]);
  const strokes = pageId ? os.paperStrokes(pageId) : [];

  React.useEffect(() => {
    if (!pageId) return;
    if (layers.length > 0) setLayerId(layers[layers.length - 1]!.id);
  }, [pageId, layers]);

  React.useEffect(() => {
    if (tool === "highlighter" && opacity === 1) setOpacity(0.45);
    if (tool !== "highlighter" && opacity === 0.45) setOpacity(1);
  }, [tool, opacity]);

  const addPage = () => {
    if (!notebookId) return;
    const page = os.addPaperPage({ notebookId, name: `Page ${pages.length + 1}`, template: notebook?.template });
    setPageId(page.id);
  };

  const addLayer = () => {
    if (!pageId || !notebookId) return;
    const layer = os.addPaperLayer({ notebookId, pageId, name: `Layer ${layers.length + 1}` });
    setLayerId(layer.id);
    setLayersOpen(true);
  };

  const addSticker = (stickerId: string) => {
    if (!pageId || !notebookId) return;
    const sticker: PaperSticker = os.addPaperSticker({ notebookId, pageId, stickerId, x: 200, y: 200 });
    toast(`Added ${stickerId} sticker`);
    return sticker;
  };

  const undoLast = () => {
    if (!pageId) return;
    const all = os.paperStrokes(pageId);
    const last = all[all.length - 1];
    if (!last) return;
    os.deletePaperStroke(last.id);
  };

  const recognizePage = async () => {
    if (!pageId) return;
    const shapes = os.recognizePaperShapes(pageId);
    if (shapes.length === 0) {
      setRecognized("No recognisable shapes on this page yet.");
      return;
    }
    const summary = shapes.map((entry) => entry.shape).join(", ");
    setRecognized(`${shapes.length} shape${shapes.length === 1 ? "" : "s"}: ${summary}`);

    await os.recognizePaperHandwriting(pageId);
    const diagram = await os.recognizePaperDiagram(pageId);
    if (diagram) setRecognized(`Mind map detected with ${diagram.nodes.length} nodes and ${diagram.edges.length} links.`);
  };

  const exportPdf = () => {
    if (!notebookId || !pageId) return;
    const pdf = os.exportPaperPdf({ notebookId, pageId });
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${notebook?.title ?? "notebook"}-page.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast("PDF exported");
  };

  const exportSvg = () => {
    if (!notebookId || !pageId) return;
    const svg = os.exportPaperSvg({ notebookId, pageId });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${notebook?.title ?? "notebook"}-page.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast("SVG exported");
  };

  if (notebooks.length === 0) {
    return (
      <>
        <EmptyState
          icon={PenLine}
          title="No notebooks yet"
          description="Digital paper with pen, pencil, highlighter, shapes, stickers, images, and an infinite canvas."
          action={
            <Button variant="primary" size="md" onClick={() => setDialogOpen(true)}>
              Create your first notebook
            </Button>
          }
        />
        <NotebookDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </>
    );
  }

  const page = pages.find((entry) => entry.id === pageId) ?? null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {notebooks.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setNotebookId(entry.id);
                setPageId(entry.pageIds[0] ?? null);
              }}
              className={
                entry.id === notebookId
                  ? "rounded-xl border border-accent px-3 py-1.5 text-xs font-medium"
                  : "rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-3 hover:text-ink"
              }
              style={entry.id === notebookId ? { backgroundColor: entry.coverColor, color: "#fff", borderColor: entry.coverColor } : undefined}
            >
              {entry.title}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Notebook
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setLayersOpen((value) => !value)}>
            <Layers className="size-4" />
            Layers
          </Button>
          <Button variant="ghost" size="sm" onClick={undoLast} disabled={strokes.length === 0}>
            <Undo2 className="size-4" />
            Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={recognizePage} disabled={strokes.length === 0}>
            <Sparkles className="size-4" />
            Recognise
          </Button>
          <Button variant="secondary" size="sm" onClick={exportSvg} disabled={strokes.length === 0}>
            <FileDown className="size-4" />
            SVG
          </Button>
          <Button variant="secondary" size="sm" onClick={exportPdf} disabled={strokes.length === 0}>
            <Download className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={pageId ?? ""}
          onChange={(event) => setPageId(event.target.value)}
          aria-label="Page"
          className="w-48"
        >
          {pages.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={addPage}>
          <Plus className="size-4" />
          Add page
        </Button>
        <Select
          value={page?.template ?? "blank"}
          onChange={(event) => {
            if (!page) return;
            os.updatePaperPage(page.id, { template: event.target.value as PaperTemplateKind });
          }}
          aria-label="Template"
          className="w-36"
        >
          {PAPER_TEMPLATES.map((value) => (
            <option key={value} value={value}>
              {PAPER_TEMPLATE_LABELS[value]}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1">
          {STICKERS.map((stickerId) => (
            <button
              key={stickerId}
              type="button"
              aria-label={`Add ${stickerId} sticker`}
              title={stickerId}
              onClick={() => addSticker(stickerId)}
              className="grid size-8 place-items-center rounded-lg border border-line text-sm text-ink-2 transition-colors hover:bg-surface-2"
            >
              {STICKER_GLYPH[stickerId]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <PaperToolbar
          tool={tool}
          color={color}
          width={width}
          opacity={opacity}
          onToolChange={setTool}
          onColorChange={setColor}
          onWidthChange={setWidth}
          onOpacityChange={setOpacity}
        />
      </div>

      {recognized && (
        <div className="mb-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink-2">
          <Sparkles className="mr-1.5 inline size-3.5" aria-hidden="true" />
          {recognized}
        </div>
      )}

      <div className="relative h-[clamp(480px,68vh,900px)] overflow-hidden rounded-2xl border border-line">
        {page && layerId ? (
          <PaperCanvas
            page={page}
            strokes={strokes}
            notebookId={notebookId!}
            layerId={layerId}
            tool={tool}
            color={color}
            width={width}
            opacity={opacity}
            eraserRadius={14}
            fitToContent={false}
            onStrokeComplete={(stroke) => os.addPaperStroke({
              notebookId: stroke.notebookId,
              pageId: stroke.pageId,
              layerId: stroke.layerId,
              tool: stroke.tool,
              color: stroke.color,
              width: stroke.width,
              opacity: stroke.opacity,
              points: stroke.points,
            })}
            onEraseAt={(x, y) => os.erasePaperStrokesAt(page.id, x, y, 14)}
          />
        ) : (
          <EmptyState title="Pick a page" description="Choose or add a page to start writing on." />
        )}
      </div>

      {layersOpen && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Layers</h3>
            <Button variant="secondary" size="sm" onClick={addLayer}>
              <Plus className="size-4" />
              Add layer
            </Button>
          </div>
          <ul className="space-y-1.5">
            {layers.map((layer) => (
              <li
                key={layer.id}
                className={
                  layer.id === layerId
                    ? "flex items-center justify-between gap-3 rounded-xl border border-accent px-3 py-2"
                    : "flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2"
                }
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-sm text-ink"
                  onClick={() => setLayerId(layer.id)}
                >
                  {layer.name}
                  {layer.id === layerId && <span className="ml-2 text-xs text-accent-ink">active</span>}
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                    onClick={() => os.updatePaperLayer(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${layer.name}`}
                    disabled={layers.length <= 1}
                    onClick={() => {
                      os.deletePaperLayer(layer.id);
                      setLayerId(layers[0]!.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{strokes.length} strokes</Badge>
        <Badge tone="outline">{layers.length} layers</Badge>
        <Badge tone="outline">{pages.length} pages</Badge>
        <span className="text-xs text-ink-3">Space-drag or Alt-drag to pan · Ctrl + wheel to zoom · Hold the pen to build a shape and it auto-recognises.</span>
      </div>

      <NotebookDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}