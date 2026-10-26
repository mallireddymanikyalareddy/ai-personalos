"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  CalendarClock,
  Filter,
  Grid2x2,
  List,
  MoreHorizontal,
  Notebook,
  Plus,
  Search,
} from "lucide-react";

import type { ID } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAppState, useOS } from "@/store/use-os";
import { useFocusNow } from "@/modules/focus/use-focus-now";

import { seedSampleNotebooks } from "./sample-notebooks";
import { downloadText } from "./notebook-export";
import { NoteEditorDialog } from "./notebook-note-editor";
import { NotebookRail } from "./notebook-rail";
import {
  notebookCollectionIcon,
  notebookDateLabel,
  notebookNoteIcon,
  notebookTagColor,
  relativeTime,
} from "./notebook-meta";

export type NotebookLayout = "list" | "grid" | "timeline";
export type NotebookSortKey = "updated" | "created" | "title" | "words";

const LAYOUTS: { value: NotebookLayout; label: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", icon: List },
  { value: "grid", label: "Grid", icon: Grid2x2 },
  { value: "timeline", label: "Timeline", icon: CalendarClock },
];

const SORTS: { value: NotebookSortKey; label: string }[] = [
  { value: "updated", label: "Last Modified" },
  { value: "created", label: "Date Created" },
  { value: "title", label: "Title" },
  { value: "words", label: "Word count" },
];

export function NotebookWorkspace() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();

  const [layout, setLayout] = React.useState<NotebookLayout>("list");
  const [sort, setSort] = React.useState<NotebookSortKey>("updated");
  const [collectionId, setCollectionId] = React.useState<string>("all");
  const [tag, setTag] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [activeId, setActiveId] = React.useState<ID | null>(null);
  const [editId, setEditId] = React.useState<ID | null>(null);
  const [quickText, setQuickText] = React.useState("");
  const [quickKind, setQuickKind] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState<string | null>(null);

  const now = useFocusNow(60_000);
  const workspace = os.notebookWorkspace(
    {
      collectionId: collectionId as "all" | "archived" | "trash" | ID,
      tag,
      query,
      sort,
    },
    now,
  );

  const active = workspace.rows.find((row) => row.id === activeId) ?? null;
  const notebooks = os.notebooks();
  const targetNotebook =
    collectionId !== "all" &&
    collectionId !== "archived" &&
    collectionId !== "trash" &&
    collectionId !== "templates"
      ? os.getNotebook(collectionId)
      : null;

  const createNote = (title: string, body: string, tags: string[] = []) => {
    if (notebooks.length === 0) {
      const created = os.addNotebook({ title: "My Notebook" });
      const page = os.addPage({ notebookId: created.id, title, body, tags });
      setActiveId(page.id);
      setEditId(page.id);
      toast(`Created “${page.title}”`);
      return;
    }
    const page = os.addPage({
      notebookId: targetNotebook?.id ?? notebooks[0]!.id,
      title,
      body,
      tags,
    });
    setActiveId(page.id);
    setEditId(page.id);
    toast(`Created “${page.title}”`);
  };

  const openNote = (id: ID) => {
    setActiveId(id);
    setEditId(id);
  };

  const loadDefaults = () => {
    const ids = seedSampleNotebooks(os, now);
    toast(
      ids.length > 0
        ? `Added ${ids.length} sample note${ids.length === 1 ? "" : "s"}`
        : "Sample notes are already loaded",
    );
  };

  const capture = (kind: string) => {
    const text = quickText.trim();
    if (text.length === 0) {
      toast("Type something to capture first");
      return;
    }
    if (kind === "handwriting" || kind === "upload" || kind === "audio") {
      toast(`${kind[0]!.toUpperCase()}${kind.slice(1)} capture is not available offline yet`);
      return;
    }
    const prefix = kind === "checklist" ? "- [ ] " : kind === "idea" ? "Idea: " : "";
    createNote(kind === "checklist" ? "Quick checklist" : text, `${prefix}${text}`);
    setQuickText("");
    setQuickKind(kind);
  };

  const title =
    collectionId === "all"
      ? tag != null
        ? `#${tag}`
        : "All Notes"
      : (workspace.collections.find((row) => row.id === collectionId)?.name ?? "Notes");

  const trashNote = (id: ID) => {
    const target = os.getPage(id);
    if (target == null) return;
    if (target.status === "trashed") {
      os.deletePage(id);
      toast("Note permanently deleted");
    } else {
      os.deletePage(id);
      toast("Note moved to trash");
    }
    if (activeId === id) setActiveId(null);
  };

  const restoreNote = (id: ID) => {
    os.restorePage(id);
    toast("Note restored");
  };

  const renameNotebook = (id: ID, currentName: string) => {
    const next = window.prompt("Notebook name", currentName);
    if (next == null || next.trim().length === 0) return;
    os.updateNotebook(id, { title: next.trim() });
    toast("Notebook renamed");
  };

  const archiveNotebook = (id: ID) => {
    os.deleteNotebook(id);
    if (collectionId === id) setCollectionId("all");
    toast("Notebook archived");
  };

  const exportAll = () => {
    const lines: string[] = ["# Digital Notebook", ""];
    for (const notebook of os.notebooks()) {
      lines.push(os.notebookToMarkdown(notebook.id), "");
    }
    downloadText("all-notebooks.md", lines.join("\n"));
    toast("Exported every notebook as markdown");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="min-w-0" aria-label="Notebooks and tags">
        <div
          className="rounded-2xl border border-line bg-surface p-3 shadow-card"
          data-testid="notebook-menu"
        >
          <section aria-label="Notebooks" data-testid="notebook-collections">
            <header className="mb-1.5 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Notebooks</h2>
              <button
                type="button"
                onClick={() => {
                  const value = window.prompt("Notebook name");
                  if (value == null || value.trim().length === 0) return;
                  os.addNotebook({ title: value.trim() });
                }}
                aria-label="New notebook"
                className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </header>
            <ul className="space-y-0.5">
              {workspace.collections.map((row) => {
                const Icon = notebookCollectionIcon(row.icon);
                const activeRow = collectionId === row.id;
                return (
                  <li key={row.id} className="group/notebook relative flex items-center">
                    <button
                      type="button"
                      data-testid={`notebook-collection-${row.name}`}
                      onClick={() => {
                        setCollectionId(row.id);
                        setTag(null);
                      }}
                      aria-pressed={activeRow}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 pr-7 text-left text-[13px] transition-colors",
                        activeRow ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      <Icon className="size-4 shrink-0" style={{ color: row.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{row.count}</span>
                    </button>
                    {row.id !== "all" && row.id !== "templates" && row.id !== "archived" && row.id !== "trash" ? (
                      <DropdownMenu
                        align="end"
                        sections={[
                          {
                            label: row.name,
                            items: [
                              { label: "Rename", onSelect: () => renameNotebook(row.id, row.name) },
                              {
                                label: "Archive notebook",
                                danger: true,
                                onSelect: () => archiveNotebook(row.id),
                              },
                            ],
                          },
                        ]}
                        trigger={
                          <button
                            type="button"
                            aria-label={`${row.name} notebook options`}
                            className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink focus:opacity-100 group-hover/notebook:opacity-100"
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

          <div className="my-3 border-t border-line" aria-hidden="true" />

          <section aria-label="Tags" data-testid="notebook-tags">
            <header className="mb-1.5 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Tags</h2>
              <button
                type="button"
                onClick={() => {
                  const value = window.prompt("Tag name");
                  if (value == null || value.trim().length === 0 || activeId == null) return;
                  const page = os.getPage(activeId);
                  if (!page) return;
                  const next = value.trim().replace(/^#/, "").toLowerCase();
                  os.updatePage(activeId, { tags: [...page.tags, next] });
                }}
                aria-label="Add tag to note"
                className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </header>
            <ul className="space-y-0.5">
              {workspace.tags.map((row) => {
                const activeTag = tag === row.tag;
                return (
                  <li key={row.tag}>
                    <button
                      type="button"
                      data-testid={`notebook-tag-${row.tag}`}
                      onClick={() => {
                        setTag(activeTag ? null : row.tag);
                        setCollectionId("all");
                      }}
                      aria-pressed={activeTag}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
                        activeTag ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: notebookTagColor(row.tag) }}
                        aria-hidden="true"
                      >
                        #
                      </span>
                      <span className="min-w-0 flex-1 truncate">{row.tag}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{row.count}</span>
                    </button>
                  </li>
                );
              })}
              {workspace.tags.length === 0 ? (
                <li className="px-2 text-[12px] text-ink-3">No tags yet.</li>
              ) : null}
            </ul>
          </section>
        </div>
      </aside>


      <div className="min-w-0 space-y-3">
        <PageHeader
          icon={Notebook}
          title="Digital Notebook"
          subtitle="Capture ideas, take notes, organize your thoughts and turn them into action."
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => createNote("Untitled note", "")}
                data-testid="notebook-new-note"
              >
                <Plus className="size-4" aria-hidden="true" />
                New Note
              </Button>
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Notebook",
                    items: [
                      { label: "Load default data", onSelect: loadDefaults },
                      {
                        label: "New notebook",
                        onSelect: () => {
                          const value = window.prompt("Notebook name");
                          if (value != null && value.trim().length > 0) os.addNotebook({ title: value.trim() });
                        },
                      },
                      { label: "Export all as markdown", onSelect: exportAll },
                    ],
                  },
                ]}
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Notebook page options">
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            </>
          }
        />

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-line p-0.5" role="group" aria-label="Note layout">
                {LAYOUTS.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      data-testid={`notebook-layout-${entry.value}`}
                      onClick={() => setLayout(entry.value)}
                      aria-pressed={layout === entry.value}
                      aria-label={`${entry.label} layout`}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                        layout === entry.value
                          ? "bg-accent-soft text-accent-ink"
                          : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {entry.label}
                    </button>
                  );
                })}
              </div>

              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Sort notes",
                    items: SORTS.map((entry) => ({
                      label: entry.label,
                      selected: sort === entry.value,
                      onSelect: () => setSort(entry.value),
                    })),
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
                    aria-label="Sort notes"
                  >
                    {SORTS.find((entry) => entry.value === sort)?.label}
                  </button>
                }
              />

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search notes…"
                  aria-label="Search notes"
                  className="h-8 w-40 pl-8 text-[13px]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setTag(null);
                  setCollectionId("all");
                  setQuery("");
                }}
                className="grid size-8 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Reset note filters"
              >
                <Filter className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {workspace.rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-12 text-center">
            <p className="text-sm font-medium text-ink">No notes here yet</p>
            <p className="mt-1 text-[12px] text-ink-3">
              Write a note, or load the default set to explore the workspace.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={() => createNote("Untitled note", "")}>
                New note
              </Button>
              <Button variant="secondary" onClick={loadDefaults}>
                Load default data
              </Button>
            </div>
          </div>
        ) : layout === "grid" ? (
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" data-testid="notebook-grid">
            {workspace.rows.map((row) => (
              <NoteGridCard
                key={row.id}
                row={row}
                now={now}
                trashed={collectionId === "trash"}
                onOpen={openNote}
                onEdit={openNote}
                onTrash={trashNote}
                onRestore={restoreNote}
              />
            ))}
          </ul>
        ) : layout === "timeline" ? (
          <ol className="space-y-2" data-testid="notebook-timeline">
            {workspace.rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
                <span className="w-32 shrink-0 text-[11px] tabular-nums text-ink-3">
                  {notebookDateLabel(row.updatedAt, now)}
                </span>
                <span className="text-base" aria-hidden="true">
                  {notebookNoteIcon(row.icon)}
                </span>
                <button
                  type="button"
                  onClick={() => openNote(row.id)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink hover:text-accent-ink hover:underline"
                >
                  {row.title}
                </button>
                <span className="shrink-0 text-[11px] text-ink-3">{row.notebookTitle}</span>
                <NoteRowMenu
                  row={row}
                  trashed={collectionId === "trash"}
                  onEdit={openNote}
                  onTrash={trashNote}
                  onRestore={restoreNote}
                />
              </li>
            ))}
          </ol>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card" data-testid="notebook-list">
            {workspace.rows.map((row) => (
              <NoteListRow
                key={row.id}
                row={row}
                now={now}
                trashed={collectionId === "trash"}
                onOpen={openNote}
                onEdit={openNote}
                onTrash={trashNote}
                onRestore={restoreNote}
              />
            ))}
          </ul>
        )}
      </div>

      <NotebookRail
        rows={workspace.recent}
        now={now}
        quickText={quickText}
        quickKind={quickKind}
        answer={answer}
        onQuickTextChange={setQuickText}
        onCapture={capture}
        onOpenNote={openNote}
        onRun={(id) => runAssistant(id, active, os, setAnswer, toast)}
      />

      <NoteEditorDialog
        pageId={editId}
        onClose={() => setEditId(null)}
        onTrashed={(id) => {
          if (activeId === id) setActiveId(null);
        }}
      />
    </div>
  );
}

function NoteRowMenu({
  row,
  trashed = false,
  onEdit,
  onTrash,
  onRestore,
}: {
  row: import("@personalos/core").NotebookNoteRow;
  trashed?: boolean;
  onEdit: (id: ID) => void;
  onTrash: (id: ID) => void;
  onRestore?: (id: ID) => void;
}) {
  return (
    <DropdownMenu
      align="end"
      sections={[
        {
          label: row.title,
          items: trashed
            ? [
                { label: "Restore note", onSelect: () => onRestore?.(row.id) },
                { label: "Delete forever", danger: true, onSelect: () => onTrash(row.id) },
              ]
            : [
                { label: "Edit note", onSelect: () => onEdit(row.id) },
                {
                  label: "Open in editor",
                  onSelect: () => window.location.assign(`/notebook/view?book=${row.notebookId}&page=${row.id}`),
                },
                { label: "Move to trash", danger: true, onSelect: () => onTrash(row.id) },
              ],
        },
      ]}
      trigger={
        <button
          type="button"
          aria-label={`${row.title} options`}
          data-testid={`notebook-note-menu-${row.id}`}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      }
    />
  );
}

function NoteListRow({
  row,
  now,
  onOpen,
  onEdit,
  onTrash,
  onRestore,
  trashed = false,
}: {
  row: import("@personalos/core").NotebookNoteRow;
  now: number;
  onOpen: (id: ID) => void;
  onEdit: (id: ID) => void;
  onTrash: (id: ID) => void;
  onRestore?: (id: ID) => void;
  trashed?: boolean;
}) {
  return (
    <li data-testid="notebook-note-row" className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-surface-2/50">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl text-lg"
        style={{ backgroundColor: "var(--surface-2)" }}
        aria-hidden="true"
      >
        {notebookNoteIcon(row.icon)}
      </span>
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        className="min-w-0 flex-1 text-left"
        aria-label={`Open ${row.title}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{row.title}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
            {notebookDateLabel(row.updatedAt, now)}
          </span>
        </span>
        {row.preview ? (
          <span className="mt-0.5 block line-clamp-1 text-[12px] text-ink-3">{row.preview}</span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          {row.tags.map((entry) => (
            <span
              key={entry}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: notebookTagColor(entry) }}
            >
              #{entry}
            </span>
          ))}
        </span>
      </button>
      <NoteRowMenu
          row={row}
          trashed={trashed}
          onEdit={onEdit}
          onTrash={onTrash}
          onRestore={onRestore}
        />
    </li>
  );
}

function NoteGridCard({
  row,
  now,
  onOpen,
  onEdit,
  onTrash,
  onRestore,
  trashed = false,
}: {
  row: import("@personalos/core").NotebookNoteRow;
  now: number;
  onOpen: (id: ID) => void;
  onEdit: (id: ID) => void;
  onTrash: (id: ID) => void;
  onRestore?: (id: ID) => void;
  trashed?: boolean;
}) {
  return (
    <li
      data-testid="notebook-note-card"
      className="relative rounded-2xl border border-line bg-surface p-3 shadow-card"
    >
      <button type="button" onClick={() => onOpen(row.id)} className="w-full text-left" aria-label={`Open ${row.title}`}>
        <span
          className="mb-2 flex h-20 items-center justify-center rounded-xl text-3xl"
          style={{ backgroundColor: "var(--surface-2)" }}
          aria-hidden="true"
        >
          {notebookNoteIcon(row.icon)}
        </span>
        <span className="block truncate text-[13px] font-semibold text-ink">{row.title}</span>
        {row.preview ? (
          <span className="mt-1 block line-clamp-2 text-[12px] leading-snug text-ink-3">{row.preview}</span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-1">
          {row.tags.slice(0, 3).map((entry) => (
            <span
              key={entry}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: notebookTagColor(entry) }}
            >
              #{entry}
            </span>
          ))}
        </span>
        <span className="mt-2 block text-[11px] text-ink-3">{relativeTime(row.updatedAt, now)}</span>
      </button>
      <span className="absolute right-2 top-2">
        <NoteRowMenu
          row={row}
          trashed={trashed}
          onEdit={onEdit}
          onTrash={onTrash}
          onRestore={onRestore}
        />
      </span>
    </li>
  );
}

function runAssistant(
  id: string,
  active: import("@personalos/core").NotebookNoteRow | null,
  os: ReturnType<typeof useOS>,
  setAnswer: (value: string) => void,
  toast: (message: string, options?: { tone?: "default" | "success" | "danger" }) => void,
) {
  const page = active ? os.getPage(active.id) : null;
  const text = page
    ? page.body.trim().length > 0
      ? page.body
      : page.blocks.map((block) => block.content).filter(Boolean).join("\n")
    : "";
  if (id === "summarize") {
    setAnswer(
      text.length > 0
        ? `Summary: ${text}`
        : "Select a note first and I can summarize it.",
    );
    return;
  }
  if (id === "actions") {
    const actions = extractActionLines(text);
    setAnswer(
      actions.length > 0
        ? `${actions.length} action item${actions.length === 1 ? "" : "s"}:\n${actions.map((line) => `• ${line}`).join("\n")}`
        : "No action items were detected in this note.",
    );
    return;
  }
  if (id === "improve") {
    const improved = text.replace(/\s{2,}/g, " ").trim();
    setAnswer(improved.length > 0 ? `Tightened writing: ${improved}` : "There is no text to improve yet.");
    return;
  }
  if (id === "translate") {
    setAnswer(
      text.length > 0
        ? `Plain English: ${text.replace(/\b(basically|actually|really|just|very)\b/gi, "").replace(/\s{2,}/g, " ").trim()}`
        : "Add some text and I can rewrite it in plain English.",
    );
    return;
  }
  if (id === "ideas" || id === "explain") {
    const terms = extractKeyTerms(text);
    setAnswer(
      terms.length > 0
        ? `Key terms: ${terms.join(", ")}.\n\nBuild on them:\n${terms.map((term) => `• ${term} — what would you do with this?`).join("\n")}`
        : "This note is too short to expand yet.",
    );
    return;
  }
  if (id === "tasks") {
    const actions = extractActionLines(text);
    if (actions.length === 0) {
      setAnswer("There are no action items in this note to turn into tasks.");
      return;
    }
    for (const action of actions) os.addTask({ title: action });
    setAnswer(`Created ${actions.length} task${actions.length === 1 ? "" : "s"} from this note.`);
    toast(`${actions.length} tasks created`);
  }
}

function extractActionLines(text: string): string[] {
  return text
    .split(/[.\n]/)
    .map((line) => line.replace(/^[-*\[\]\s]+/, "").trim())
    .filter((line) => /\b(will|should|must|need to|to)\b/i.test(line) && line.length > 8)
    .slice(0, 6);
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


