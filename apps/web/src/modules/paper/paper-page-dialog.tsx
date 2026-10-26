"use client";

import * as React from "react";

import { Download, FileText, PenLine, Trash2 } from "lucide-react";

import {
  PAPER_TEMPLATE_LABELS,
  PAPER_TEMPLATES,
  type ID,
  type PaperPage,
  type PaperTemplateKind,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { downloadText } from "@/modules/notebook/notebook-export";
import { useAppState, useOS } from "@/store/use-os";

import { paperKindMeta } from "./paper-meta";

function splitTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "paper-page"
  );
}

export function PaperPageDialog({
  pageId,
  onClose,
  onOpenCanvas,
}: {
  pageId: ID | null;
  onClose: () => void;
  onOpenCanvas?: (id: ID) => void;
}) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const page: PaperPage | null = pageId ? (state.paperPages[pageId] ?? null) : null;

  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [folderId, setFolderId] = React.useState("none");
  const [favorite, setFavorite] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [template, setTemplate] = React.useState<PaperTemplateKind>("blank");

  React.useEffect(() => {
    if (!page) return;
    setName(page.name);
    setText(page.textContent);
    setTags(page.tags.join(", "));
    setFolderId(page.folderId ?? "none");
    setFavorite(page.favorite);
    setShared(page.shared);
    setTemplate(page.template);
  }, [page]);

  if (!page) return null;

  const images = os.paperImages(page.id);
  const photos = images.filter((image) => image.mimeType.startsWith("image/"));
  const pdfs = images.filter(
    (image) => image.mimeType === "application/pdf" || /\.pdf$/i.test(image.name),
  );
  const documents = images.filter(
    (image) => !photos.includes(image) && !pdfs.includes(image),
  );
  const folders = os.paperFolders().filter((folder) => folder.status === "active");
  const kind = paperKindMeta(page.kind);

  const save = () => {
    os.updatePaperPage(page.id, {
      name: name.trim() || "Untitled page",
      textContent: text,
      tags: splitTags(tags),
      folderId: folderId === "none" ? null : folderId,
      favorite,
      shared,
      template,
    });
    toast("Page saved", { tone: "success" });
    onClose();
  };

  const moveToTrash = () => {
    os.updatePaperPage(page.id, { status: "trashed" });
    toast(`"${page.name}" moved to trash`, {
      tone: "success",
      action: {
        label: "Undo",
        onClick: () => os.updatePaperPage(page.id, { status: "active" }),
      },
    });
    onClose();
  };

  const exportPage = () => {
    downloadText(
      `${slug(name || page.name)}.md`,
      `# ${name || page.name}\n\n${text.trim()}\n`,
    );
    toast("Page exported", { tone: "success" });
  };

  return (
    <Modal
      open={pageId != null}
      onClose={onClose}
      title="Edit page"
      description={`${kind.label} · ${PAPER_TEMPLATE_LABELS[page.template] ?? page.template}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="danger" onClick={moveToTrash} data-testid="paper-page-trash">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Move to trash
          </Button>
          <div className="flex items-center gap-2">
            {onOpenCanvas ? (
              <Button
                variant="ghost"
                onClick={() => onOpenCanvas(page.id)}
                data-testid="paper-page-canvas"
              >
                <PenLine className="size-3.5" aria-hidden="true" />
                Canvas
              </Button>
            ) : null}
            <Button variant="ghost" onClick={exportPage} data-testid="paper-page-export">
              <Download className="size-3.5" aria-hidden="true" />
              Export
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} data-testid="paper-page-save">
              Save page
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="paper-page-name">Name</FieldLabel>
          <Input
            id="paper-page-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Page name"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <FieldLabel htmlFor="paper-page-body">Content</FieldLabel>
            <span className="text-[11px] tabular-nums text-ink-3">
              {text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0} words
            </span>
          </div>
          <Textarea
            id="paper-page-body"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={12}
            placeholder="Write or paste the page content…"
            className="min-h-56"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="paper-page-tags">Tags</FieldLabel>
            <Input
              id="paper-page-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="work, ideas"
            />
          </div>
          <div>
            <FieldLabel htmlFor="paper-page-folder">Folder</FieldLabel>
            <Select
              id="paper-page-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
            >
              <option value="none">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="paper-page-template">Paper style</FieldLabel>
            <Select
              id="paper-page-template"
              value={template}
              onChange={(event) => setTemplate(event.target.value as PaperTemplateKind)}
            >
              {PAPER_TEMPLATES.map((value) => (
                <option key={value} value={value}>
                  {PAPER_TEMPLATE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={favorite}
            onClick={() => setFavorite((value) => !value)}
            className={
              favorite
                ? "rounded-lg border border-warning bg-warning-soft px-2.5 py-1 text-[11px] font-medium text-warning"
                : "rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
            }
          >
            {favorite ? "Favourite" : "Add to favourites"}
          </button>
          <button
            type="button"
            aria-pressed={shared}
            onClick={() => setShared((value) => !value)}
            className={
              shared
                ? "rounded-lg border border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink"
                : "rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
            }
          >
            {shared ? "Shared" : "Share"}
          </button>
          <Badge tone="neutral">{kind.label}</Badge>
          <Badge tone="outline">{PAPER_TEMPLATE_LABELS[page.template] ?? page.template}</Badge>
        </div>

        {photos.length > 0 ? (
          <div>
            <FieldLabel>Imported images</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {photos.map((image) => (
                <a
                  key={image.id}
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-lg border border-line"
                  title={image.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.name}
                    className="size-20 object-cover transition-transform group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {pdfs.length > 0 ? (
          <div>
            <FieldLabel>PDF preview</FieldLabel>
            <div className="space-y-2">
              {pdfs.map((pdf) => (
                <div key={pdf.id} className="overflow-hidden rounded-lg border border-line">
                  <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
                    <span className="truncate text-[12px] text-ink-2">{pdf.name}</span>
                    <a
                      href={pdf.url}
                      download={pdf.name}
                      className="shrink-0 text-[11px] font-medium text-accent-ink hover:underline"
                    >
                      Download
                    </a>
                  </div>
                  <iframe
                    src={pdf.url}
                    title={pdf.name}
                    className="h-96 w-full bg-surface"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {documents.length > 0 ? (
          <div>
            <FieldLabel>Documents</FieldLabel>
            <ul className="space-y-2">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center gap-2 rounded-lg border border-line p-2.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">
                      {document.name}
                    </span>
                    <span className="block text-[11px] text-ink-3">
                      Extracted text appears in the content above when available.
                    </span>
                  </span>
                  <a
                    href={document.url}
                    download={document.name}
                    className="shrink-0 text-[11px] font-medium text-accent-ink hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
