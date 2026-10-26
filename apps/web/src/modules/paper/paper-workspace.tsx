"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  FilePlus2,
  Files,
  Filter,
  FolderPlus,
  Grid2x2,
  LayoutList,
  MoreHorizontal,
  PenLine,
  ScanLine,
  Search,
  Share2,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";

import type { ID, PaperPageKind, PaperTemplateKind } from "@personalos/core";
import { plainLanguageText } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAppState, useOS } from "@/store/use-os";
import { useFocusNow } from "@/modules/focus/use-focus-now";

import { PaperPageDialog } from "./paper-page-dialog";
import { extractDocxText, extractRtfText } from "./docx-text";
import { PaperAssistant, QuickCapture, RecentPages } from "./paper-rail";
import { PAPER_FOLDER_ICONS, PAPER_TAG_COLORS, paperKindMeta, paperTagColor, relativeTime } from "./paper-meta";
import { PAPER_SORTS, type PaperSort, type PaperView } from "./paper-workspace-types";
import { seedSamplePaper } from "./sample-paper";

type GridView = "grid" | "list";

const VIEWS: { value: PaperView; label: string }[] = [
  { value: "all", label: "All Pages" },
  { value: "recent", label: "Recent" },
  { value: "favorites", label: "Favorites" },
  { value: "shared", label: "Shared" },
];

const ACTION_CARDS: { id: string; label: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { id: "quick", label: "Quick Note", hint: "Start writing instantly", icon: FilePlus2, tone: "bg-accent-soft text-accent-ink" },
  { id: "template", label: "From Template", hint: "Use ready templates", icon: Files, tone: "bg-danger-soft text-danger" },
  { id: "import", label: "Import Files", hint: "PDF, DOC, images", icon: Upload, tone: "bg-info-soft text-info" },
  { id: "scan", label: "Scan Document", hint: "Upload or scan", icon: ScanLine, tone: "bg-accent-soft text-accent-ink" },
  { id: "summarize", label: "AI Summarize", hint: "Summarize any content", icon: Sparkles, tone: "bg-danger-soft text-danger" },
];

export function PaperWorkspace() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();

  const [view, setView] = React.useState<PaperView>("all");
  const [sort, setSort] = React.useState<PaperSort>("updated");
  const [grid, setGrid] = React.useState<GridView>("grid");
  const [query, setQuery] = React.useState("");
  const [folderId, setFolderId] = React.useState<string>("all");
  const [tag, setTag] = React.useState<string | null>(null);
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [activeId, setActiveId] = React.useState<ID | null>(null);
  const [canvasOpen, setCanvasOpen] = React.useState(false);
  const [assistant, setAssistant] = React.useState<string | null>(null);
  const [quickText, setQuickText] = React.useState("");
  const [quickKind, setQuickKind] = React.useState<string | null>(null);
  const [pageDialogId, setPageDialogId] = React.useState<ID | null>(null);
  const [canvasPageId, setCanvasPageId] = React.useState<ID | null>(null);
  const [confirmTrashId, setConfirmTrashId] = React.useState<ID | null>(null);
  const importRef = React.useRef<HTMLInputElement | null>(null);
  const [importKind, setImportKind] = React.useState<"import" | "scan">("import");

  const now = useFocusNow(60_000);
  const workspace = os.paperWorkspace(
    { folderId: folderId as "all" | "trash" | ID, tag, query, sort, view },
    now,
  );
  const active = workspace.rows.find((row) => row.id === activeId) ?? null;

  const visibleTags = showAllTags ? workspace.tags : workspace.tags.slice(0, 7);

  const headerMenuSections = React.useMemo(() => ([
    {
      label: "Paper",
      items: [
        { label: "Open handwriting canvas", onSelect: () => {
          setCanvasPageId(activeId);
          setCanvasOpen(true);
        } },
        { label: "New folder", onSelect: () => {
          const name = window.prompt("Folder name");
          if (name != null && name.trim().length > 0) os.addPaperFolder({ name: name.trim() });
        } },
        { label: "Load sample papers", onSelect: () => {
          const ids = seedSamplePaper(os);
          toast(`Added ${ids.length} sample papers — edit or delete them any time`);
        } },
      ],
    },
  ]), [activeId, os, toast]);

  const ensureNotebook = React.useCallback(() => {
    const list = os.paperNotebooks();
    if (list[0]) return list[0].id;
    return os.addPaperNotebook({ title: "All documents" }).id;
  }, [os]);

  const freshPage = React.useRef<{ id: string; name: string; text: string } | null>(null);

  const closePageDialog = () => {
    const fresh = freshPage.current;
    freshPage.current = null;
    setPageDialogId(null);
    if (!fresh || fresh.id !== pageDialogId) return;
    const state = os.getState();
    const page = state.paperPages[fresh.id];
    const hasStrokes = Object.values(state.paperStrokes).some((stroke) => stroke.pageId === fresh.id);
    if (page && page.name === fresh.name && page.textContent === fresh.text && !hasStrokes) {
      os.deletePaperPage(fresh.id);
    }
  };

  const createPage = (input: {
    name: string;
    kind: PaperPageKind;
    text?: string;
    tags?: string[];
    template?: PaperTemplateKind;
  }) => {
    const notebookId = ensureNotebook();
    const page = os.addPaperPage({
      notebookId,
      name: input.name,
      kind: input.kind,
      textContent: input.text ?? "",
      tags: input.tags ?? [],
      template: input.template,
      folderId:
        folderId !== "all" && folderId !== "trash" ? folderId : null,
    });
    setActiveId(page.id);
    freshPage.current = { id: page.id, name: page.name, text: page.textContent };
    setPageDialogId(page.id);
    setView("all");
    toast(`"${page.name}" created`);
  };

  const runAction = (id: string) => {
    if (id === "quick") {
      createPage({ name: "Quick note", kind: "typed" });
      return;
    }
    if (id === "template") {
      createPage({
        name: "Untitled template",
        kind: "template",
        template: "grid",
        text: "Objective\n\nSteps\n\nOwner\n\nDue date",
      });
      return;
    }
    if (id === "import" || id === "scan") {
      setImportKind(id === "scan" ? "scan" : "import");
      importRef.current?.click();
      return;
    }
    if (id === "summarize") {
      if (active == null) {
        toast("Select a page to summarize", { tone: "danger" });
        return;
      }
      setAssistant(summarizePage(active.textContent));
    }
  };

  const toggleFavorite = (id: ID) => {
    const row = workspace.rows.find((entry) => entry.id === id);
    os.setPaperPageFavorite(id, !(row?.favorite ?? false));
  };

  const toggleShared = (id: ID) => {
    const row = workspace.rows.find((entry) => entry.id === id);
    os.setPaperPageShared(id, !(row?.shared ?? false));
  };

  const capture = (kind: string) => {
    const text = quickText.trim();
    if (kind === "image" || kind === "file" || kind === "audio") {
      toast(`${kind[0]!.toUpperCase()}${kind.slice(1)} capture is not available offline yet`);
      return;
    }
    if (text.length === 0) {
      toast("Type something to capture first");
      return;
    }
    createPage({
      name: kind === "checklist" ? "Quick checklist" : "Quick note",
      kind: "typed",
      text: kind === "checklist" ? `- [ ] ${text}` : text,
    });
    setQuickText("");
    setQuickKind(kind);
  };

  const handleImportFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const notebookId = ensureNotebook();
    let count = 0;
    for (const file of Array.from(files)) {
      if (file.size > 5_000_000) {
        toast(`${file.name} is too large to import`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const isText = file.type.startsWith("text/") || /\.(md|txt|csv|json)$/i.test(file.name);
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isDocx = /\.docx$/i.test(file.name) || file.type.includes("wordprocessingml");
      const isRtf = /\.rtf$/i.test(file.name) || file.type === "application/rtf";
      const isDoc = /\.doc$/i.test(file.name) || file.type === "application/msword";
      const kind: PaperPageKind = isImage
        ? importKind === "scan"
          ? "scan"
          : "image"
        : isPdf
          ? "pdf"
          : "typed";
      const page = os.addPaperPage({
        notebookId,
        name: file.name.replace(/\.[^.]+$/, "") || "Imported page",
        kind,
        folderId: folderId !== "all" && folderId !== "trash" ? folderId : null,
        tags: [importKind],
      });
      count += 1;
      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          const layer = os.paperLayers(page.id)[0];
          if (layer) {
            os.addPaperImage({
              notebookId,
              pageId: page.id,
              layerId: layer.id,
              url: String(reader.result),
              name: file.name,
              mimeType: file.type || "image/*",
              sizeBytes: file.size,
            });
          }
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        const reader = new FileReader();
        reader.onload = () => os.updatePaperPage(page.id, { textContent: String(reader.result) });
        reader.readAsText(file);
      } else if (isPdf || isDocx || isDoc || isRtf) {
        const reader = new FileReader();
        reader.onload = () => {
          const layer = os.paperLayers(page.id)[0];
          if (layer) {
            os.addPaperImage({
              notebookId,
              pageId: page.id,
              layerId: layer.id,
              url: String(reader.result),
              name: file.name,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
            });
          }
        };
        reader.readAsDataURL(file);

        if (isDocx) {
          void extractDocxText(file).then((text) => {
            if (text.trim()) os.updatePaperPage(page.id, { textContent: text });
          });
        } else if (isRtf) {
          void file.text().then((raw) => {
            os.updatePaperPage(page.id, { textContent: extractRtfText(raw) });
          });
        } else if (isDoc) {
          os.updatePaperPage(page.id, {
            textContent: `Imported Word document: ${file.name}\n\nOpen the file to read the full document.`,
          });
        }
      } else {
        os.updatePaperPage(page.id, {
          textContent: `Imported file: ${file.name}\n\nOpen the original file to review it.`,
        });
      }
      setActiveId(page.id);
      setPageDialogId(page.id);
    }
    if (count > 0) toast(`${count} file${count === 1 ? "" : "s"} imported`);
  };

  const restorePage = (id: ID) => {
    os.updatePaperPage(id, { status: "active" });
    setConfirmTrashId(null);
    toast("Page restored");
  };

  const deleteForever = (id: ID) => {
    if (confirmTrashId !== id) {
      setConfirmTrashId(id);
      return;
    }
    os.deletePaperPage(id);
    setConfirmTrashId(null);
    toast("Page deleted forever");
  };

  const emptyTrash = () => {
    const rows = workspace.rows;
    for (const row of rows) os.deletePaperPage(row.id);
    setConfirmTrashId(null);
    toast(
      rows.length > 0
        ? `Deleted ${rows.length} page${rows.length === 1 ? "" : "s"} forever`
        : "Trash is already empty",
    );
  };

  const renameFolder = (id: ID, currentName: string) => {
    const next = window.prompt("Folder name", currentName);
    if (next == null || next.trim().length === 0) return;
    os.updatePaperFolder(id, { name: next.trim() });
    toast("Folder renamed", { tone: "success" });
  };

  const deleteFolder = (id: ID) => {
    os.deletePaperFolder(id);
    if (folderId === id) setFolderId("all");
    toast("Folder deleted", { tone: "success" });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
      <aside className="min-w-0 space-y-4" aria-label="Paper folders and tags">
        <section aria-label="Folders" data-testid="paper-folders">
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Folders</h2>
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("Folder name");
                if (name == null || name.trim().length === 0) return;
                os.addPaperFolder({ name: name.trim() });
              }}
              aria-label="New folder"
              className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <FolderPlus className="size-3.5" aria-hidden="true" />
            </button>
          </header>
          <ul className="space-y-0.5">
            {workspace.folders.map((folder) => {
              const Icon = PAPER_FOLDER_ICONS[folder.icon] ?? Files;
              const activeFolder = folderFilterActive(folder.id, folderId);
              return (
                <li key={folder.id} className="group/folder relative flex items-center">
                  <button
                    type="button"
                    data-testid={`paper-folder-${folder.name}`}
                    onClick={() => {
                      setFolderId(folder.id);
                      setTag(null);
                    }}
                    aria-pressed={activeFolder}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 pr-7 text-left text-[13px] transition-colors",
                      activeFolder ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    <Icon className="size-4 shrink-0" style={{ color: folder.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{folder.count}</span>
                  </button>
                  {folder.id !== "all" && folder.id !== "trash" ? (
                    <DropdownMenu
                      align="end"
                      sections={[
                        {
                          label: folder.name,
                          items: [
                            {
                              label: "Rename",
                              onSelect: () => renameFolder(folder.id, folder.name),
                            },
                            {
                              label: "Delete",
                              danger: true,
                              onSelect: () => deleteFolder(folder.id),
                            },
                          ],
                        },
                      ]}
                      trigger={
                        <button
                          type="button"
                          aria-label={`${folder.name} options`}
                          className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink focus:opacity-100 group-hover/folder:opacity-100"
                        >
                          <MoreHorizontal className="size-3.5" aria-hidden="true" />
                        </button>
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Tags" data-testid="paper-tags">
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Tags</h2>
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("Tag name");
                if (name == null || name.trim().length === 0 || activeId == null) return;
                const page = os.getPaperPage(activeId);
                if (!page) return;
                const tag = name.trim().replace(/^#/, "").toLowerCase();
                os.updatePaperPage(activeId, { tags: [...page.tags, tag] });
              }}
              aria-label="Add tag to page"
              className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <span aria-hidden="true">+</span>
            </button>
          </header>
          <ul className="space-y-0.5">
            {visibleTags.map((row) => {
              const activeTag = tag === row.tag;
              return (
                <li key={row.tag}>
                  <button
                    type="button"
                    data-testid={`paper-tag-${row.tag}`}
                    onClick={() => {
                      setTag(activeTag ? null : row.tag);
                      setFolderId("all");
                    }}
                    aria-pressed={activeTag}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
                      activeTag ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    <span className="text-[13px] font-semibold" style={{ color: paperTagColor(row.tag) }} aria-hidden="true">
                      #
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.tag}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{row.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {workspace.tags.length > 7 ? (
            <button
              type="button"
              onClick={() => setShowAllTags((value) => !value)}
              className="mt-1 px-2 text-[12px] font-medium text-accent-ink hover:underline"
            >
              {showAllTags ? "Show less" : "Show more"}
            </button>
          ) : null}
        </section>
      </aside>

      <div className="min-w-0 space-y-4">
        <PageHeader
          icon={PenLine}
          title="Digital Paper"
          subtitle="A clean space to capture, write, organize and manage all your ideas, documents and information."
          actions={
            <>
              <Button variant="primary" onClick={() => createPage({ name: "New page", kind: "typed" })} data-testid="paper-new-page">
                <PenLine className="size-4" aria-hidden="true" />
                New Page
              </Button>
              <DropdownMenu
                align="end"
                sections={headerMenuSections}
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Paper page options">
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            </>
          }
        />

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {ACTION_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                data-testid={`paper-action-${card.id}`}
                onClick={() => runAction(card.id)}
                className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-2/60"
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${card.tone}`} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink">{card.label}</span>
                  <span className="block truncate text-[11px] text-ink-3">{card.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Paper views">
            {VIEWS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="tab"
                data-testid={`paper-view-${entry.value}`}
                aria-selected={view === entry.value}
                onClick={() => setView(entry.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors",
                  view === entry.value ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-line p-0.5" role="group" aria-label="Paper layout">
              <button
                type="button"
                data-testid="paper-layout-grid"
                onClick={() => setGrid("grid")}
                aria-pressed={grid === "grid"}
                aria-label="Grid layout"
                className={cn(
                  "grid size-6 place-items-center rounded-md",
                  grid === "grid" ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2",
                )}
              >
                <Grid2x2 className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="paper-layout-list"
                onClick={() => setGrid("list")}
                aria-pressed={grid === "list"}
                aria-label="List layout"
                className={cn(
                  "grid size-6 place-items-center rounded-md",
                  grid === "list" ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2",
                )}
              >
                <LayoutList className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Sort pages",
                  items: PAPER_SORTS.map((option) => ({
                    label: option.label,
                    selected: sort === option.value,
                    onSelect: () => setSort(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
                  aria-label="Sort pages"
                >
                  {PAPER_SORTS.find((option) => option.value === sort)?.label}
                </button>
              }
            />

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages…"
                aria-label="Search pages"
                className="h-8 w-40 pl-8 text-[13px]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setTag(null);
                setFolderId("all");
                setQuery("");
              }}
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label="Reset page filters"
            >
              <Filter className="size-3.5" aria-hidden="true" />
            </button>

            {folderId === "trash" ? (
              <Button
                variant="danger"
                size="sm"
                onClick={emptyTrash}
                disabled={workspace.rows.length === 0}
                data-testid="paper-empty-trash"
              >
                Empty trash
              </Button>
            ) : null}
          </div>
        </div>

        <ul
          className={cn(grid === "grid" ? "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-2")}
          data-testid="paper-grid"
        >
          {workspace.rows.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-line p-10 text-center">
              <p className="text-sm font-medium text-ink">
                {folderId === "trash" ? "Trash is empty" : "No pages here yet"}
              </p>
              <p className="mt-1 text-[12px] text-ink-3">
                {folderId === "trash"
                  ? "Deleted pages stay here until you delete them forever."
                  : "Create a page, import a file, or load the sample set."}
              </p>
            </li>
          ) : (
            workspace.rows.map((row) => (
              <PaperCard
                key={row.id}
                row={row}
                now={now}
                active={row.id === activeId}
                trashed={folderId === "trash"}
                confirmDelete={confirmTrashId === row.id}
                onOpen={(id) => {
                  setActiveId(id);
                  setPageDialogId(id);
                }}
                onToggleFavorite={toggleFavorite}
                onToggleShared={toggleShared}
                onRestore={restorePage}
                onDeleteForever={deleteForever}
                onDelete={(id) => {
                  const page = os.getPaperPage(id);
                  if (!page) return;
                  os.updatePaperPage(id, { status: "trashed" });
                  toast(`"${page.name}" moved to trash`, {
                    tone: "success",
                    action: {
                      label: "Undo",
                      onClick: () => os.updatePaperPage(id, { status: "active" }),
                    },
                  });
                }}
              />
            ))
          )}
        </ul>
      </div>

      <aside className="min-w-0 space-y-4" aria-label="Paper tools">
        <PaperAssistant
          pageName={active?.name ?? null}
          pageText={active?.textContent ?? ""}
          answer={assistant}
          onRun={(id) => runAssistantAction(id, active?.textContent ?? "", activeId, os, setAssistant, toast)}
        />
        <RecentPages
          rows={workspace.recent}
          now={now}
          onOpen={(id) => {
            setActiveId(id);
            setPageDialogId(id);
          }}
        />
        <QuickCapture
          text={quickText}
          onChange={setQuickText}
          onCapture={capture}
          lastKind={quickKind}
        />
      </aside>

      <input
        ref={importRef}
        type="file"
        multiple
        accept={importKind === "scan" ? "image/*" : undefined}
        className="sr-only"
        aria-label="Import files"
        onChange={(event) => {
          handleImportFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <PaperPageDialog
        pageId={pageDialogId}
        onClose={closePageDialog}
        onOpenCanvas={(id) => {
          freshPage.current = null;
          setPageDialogId(null);
          setCanvasPageId(id);
          setCanvasOpen(true);
        }}
      />

      {canvasOpen ? (
        <PaperCanvasDialog
          pageId={canvasPageId}
          onClose={() => {
            setCanvasOpen(false);
            setCanvasPageId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function folderFilterActive(id: string, current: string): boolean {
  return id === current;
}

function PaperCard({
  row,
  now,
  active,
  onOpen,
  onToggleFavorite,
  onToggleShared,
  onDelete,
  onRestore,
  onDeleteForever,
  trashed = false,
  confirmDelete = false,
}: {
  row: import("@personalos/core").PaperPageRow;
  now: number;
  active: boolean;
  onOpen: (id: ID) => void;
  onToggleFavorite: (id: ID) => void;
  onToggleShared: (id: ID) => void;
  onDelete: (id: ID) => void;
  onRestore?: (id: ID) => void;
  onDeleteForever?: (id: ID) => void;
  trashed?: boolean;
  confirmDelete?: boolean;
}) {
  const kind = paperKindMeta(row.kind);
  const KindIcon = kind.icon;

  return (
    <li
      data-testid="paper-card"
      data-page-id={row.id}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-colors",
        active ? "border-accent" : "border-line hover:border-line-strong",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        className="text-left"
        aria-label={`Open ${row.name}`}
      >
        <span
          className="flex h-24 items-center justify-center border-b border-line"
          style={{ backgroundColor: row.paperColor }}
        >
          <span className="flex flex-col items-center gap-1 text-ink-3">
            <KindIcon className="size-6" aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-wide">{kind.label}</span>
          </span>
        </span>
        <span className="block p-3">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{row.name}</span>
            {trashed ? <Badge tone="neutral">Trash</Badge> : null}
            {row.favorite ? <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-hidden="true" /> : null}
          </span>
          {row.preview ? (
            <span className="mt-1 block line-clamp-2 text-[12px] leading-snug text-ink-3">{row.preview}</span>
          ) : null}
          <span className="mt-2 flex flex-wrap items-center gap-1">
            {row.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "var(--surface-2)", color: paperTagColor(tag) }}
              >
                #{tag}
              </span>
            ))}
          </span>
          <span className="mt-2 block text-[11px] text-ink-3">Updated {relativeTime(row.updatedAt, now)}</span>
        </span>
      </button>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!trashed ? (
          <>
            <button
              type="button"
              onClick={() => onToggleFavorite(row.id)}
              aria-label={row.favorite ? `Unfavourite ${row.name}` : `Favourite ${row.name}`}
              className="grid size-6 place-items-center rounded-md bg-surface/90 text-ink-3 hover:text-warning"
            >
              <Star className={cn("size-3.5", row.favorite && "fill-warning text-warning")} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onToggleShared(row.id)}
              aria-label={row.shared ? `Unshare ${row.name}` : `Share ${row.name}`}
              className="grid size-6 place-items-center rounded-md bg-surface/90 text-ink-3 hover:text-accent-ink"
            >
              <Share2 className="size-3.5" aria-hidden="true" />
            </button>
          </>
        ) : null}
        <DropdownMenu
          align="end"
          sections={[
            {
              label: row.name,
              items: trashed
                ? [
                    { label: "Restore", onSelect: () => onRestore?.(row.id) },
                    {
                      label: confirmDelete ? "Confirm delete forever" : "Delete forever",
                      danger: true,
                      onSelect: () => onDeleteForever?.(row.id),
                    },
                  ]
                : [
                    { label: "Open", onSelect: () => onOpen(row.id) },
                    { label: row.favorite ? "Remove from favourites" : "Add to favourites", onSelect: () => onToggleFavorite(row.id) },
                    { label: row.shared ? "Stop sharing" : "Share", onSelect: () => onToggleShared(row.id) },
                    { label: "Move to trash", danger: true, onSelect: () => onDelete(row.id) },
                  ],
            },
          ]}
          trigger={
            <button
              type="button"
              aria-label={`${row.name} options`}
              className="grid size-6 place-items-center rounded-md bg-surface/90 text-ink-3 hover:text-ink"
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </li>
  );
}

function summarizePage(text: string): string {
  if (text.trim().length === 0) return "This page has no text to summarize yet.";
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, 3).join(" ") || text.slice(0, 240);
}

function runAssistantAction(
  id: string,
  text: string,
  pageId: ID | null,
  os: ReturnType<typeof useOS>,
  setAnswer: (value: string) => void,
  toast: (message: string, options?: { tone?: "default" | "success" | "danger" }) => void,
) {
  if (id === "summarize") {
    setAnswer(summarizePage(text));
    return;
  }
  if (id === "improve") {
    const improved = plainLanguageText(text);
    if (pageId != null && improved.length > 0) {
      os.updatePaperPage(pageId, { textContent: improved });
    }
    setAnswer(improved.length > 0 ? improved : "This page has no text to improve yet.");
    toast("Writing simplified");
    return;
  }
  if (id === "actions") {
    const actions = extractActionLines(text);
    setAnswer(
      actions.length > 0
        ? `Found ${actions.length} action item${actions.length === 1 ? "" : "s"}:\n${actions.map((line) => `• ${line}`).join("\n")}`
        : "No action items were detected in this page.",
    );
    return;
  }
  if (id === "translate") {
    setAnswer(
      text.trim().length > 0
        ? `Plain English:\n${plainLanguageText(text)}`
        : "Add some text and I can rewrite it in plain English.",
    );
    return;
  }
  if (id === "explain") {
    const terms = extractKeyTerms(text);
    setAnswer(
      terms.length > 0
        ? `Key terms: ${terms.join(", ")}.`
        : "This page is too short to explain yet.",
    );
    return;
  }
  if (id === "tasks") {
    const actions = extractActionLines(text);
    if (actions.length === 0) {
      setAnswer("There are no action items in this page to turn into tasks.");
      return;
    }
    for (const action of actions) {
      os.addTask({ title: action });
    }
    setAnswer(`Created ${actions.length} task${actions.length === 1 ? "" : "s"} from this page.`);
    toast(`${actions.length} tasks created`);
  }
}

function extractActionLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\[\]\s]+/, "").trim())
    .filter((line) => /\b(will|should|must|need to|to)\b/i.test(line) && line.length > 4)
    .slice(0, 8);
}

function extractKeyTerms(text: string): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length < 5) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

function PaperCanvasDialog({
  pageId,
  onClose,
}: {
  pageId?: string | null;
  onClose: () => void;
}) {
  const [PaperModule, setPaperModule] = React.useState<React.ComponentType<{
    initialPageId?: string | null;
  }> | null>(null);

  React.useEffect(() => {
    void import("./paper-module").then((module) => {
      setPaperModule(() => module.PaperModule);
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-label="Handwriting canvas"
      data-testid="paper-canvas-dialog"
    >
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-line bg-surface p-4 shadow-pop">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Handwriting canvas</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2 py-1 text-[12px] font-medium text-ink-2 hover:bg-surface-2"
          >
            Close
          </button>
        </div>
        {PaperModule == null ? (
          <p className="py-10 text-center text-sm text-ink-3">Loading the canvas…</p>
        ) : (
          <PaperModule initialPageId={pageId} />
        )}
      </div>
    </div>
  );
}

export { PAPER_TAG_COLORS };
