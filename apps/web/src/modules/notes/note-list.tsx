"use client";

import * as React from "react";

import { Filter, LayoutGrid, List, MoreHorizontal, Pin, Plus, Search } from "lucide-react";

import type { NoteListRow, NoteSort } from "@personalos/core";

import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

import { formatNoteDate, noteTagColor, NOTE_SORT_OPTIONS } from "./notes-meta";

export type NoteListView = "list" | "grid";

export interface NoteListProps {
  title: string;
  rows: NoteListRow[];
  activeId: string | null;
  sort: NoteSort;
  view: NoteListView;
  query: string;
  pinnedOnly: boolean;
  onSortChange: (sort: NoteSort) => void;
  onViewChange: (view: NoteListView) => void;
  onQueryChange: (query: string) => void;
  onTogglePinnedOnly: () => void;
  onOpen: (id: string) => void;
  onPin: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export function NoteList({
  title,
  rows,
  activeId,
  sort,
  view,
  query,
  pinnedOnly,
  onSortChange,
  onViewChange,
  onQueryChange,
  onTogglePinnedOnly,
  onOpen,
  onPin,
  onArchive,
  onRestore,
  onDelete,
  onCreate,
}: NoteListProps) {
  return (
    <section
      aria-label="Notes list"
      data-testid="notes-list"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-line p-0.5" role="group" aria-label="Note layout">
            <button
              type="button"
              data-testid="notes-view-list"
              onClick={() => onViewChange("list")}
              aria-pressed={view === "list"}
              aria-label="List layout"
              className={cn(
                "grid size-6 place-items-center rounded-md transition-colors",
                view === "list" ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2",
              )}
            >
              <List className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="notes-view-grid"
              onClick={() => onViewChange("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid layout"
              className={cn(
                "grid size-6 place-items-center rounded-md transition-colors",
                view === "grid" ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2",
              )}
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Sort notes",
                items: NOTE_SORT_OPTIONS.map((option) => ({
                  label: option.label,
                  selected: sort === option.value,
                  onSelect: () => onSortChange(option.value),
                })),
              },
            ]}
            trigger={
              <button
                type="button"
                className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
                aria-label="Sort notes"
              >
                {NOTE_SORT_OPTIONS.find((option) => option.value === sort)?.label}
              </button>
            }
          />

          <button
            type="button"
            data-testid="notes-filter"
            onClick={onTogglePinnedOnly}
            aria-pressed={pinnedOnly}
            aria-label="Show pinned notes only"
            className={cn(
              "grid size-7 place-items-center rounded-lg border transition-colors",
              pinnedOnly
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Filter className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="relative border-b border-line px-3 py-2">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-ink-3">No notes match these filters.</p>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New note
          </button>
        </div>
      ) : (
        <ul
          className={cn(
            "min-h-0 flex-1 overflow-y-auto p-2",
            view === "grid" ? "grid grid-cols-2 gap-2" : "space-y-1.5",
          )}
        >
          {rows.map((row) => (
            <NoteListCard
              key={row.id}
              row={row}
              active={row.id === activeId}
              view={view}
              onOpen={onOpen}
              onPin={onPin}
              onArchive={onArchive}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteListCard({
  row,
  active,
  view,
  onOpen,
  onPin,
  onArchive,
  onRestore,
  onDelete,
}: {
  row: NoteListRow;
  active: boolean;
  view: NoteListView;
  onOpen: (id: string) => void;
  onPin: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li
      data-testid="note-list-item"
      data-note-id={row.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/lifeos-note", row.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group relative rounded-xl border p-2.5 transition-colors",
        active ? "border-accent bg-accent-soft/60" : "border-line bg-surface hover:bg-surface-2/60",
      )}
    >
      <button type="button" onClick={() => onOpen(row.id)} className="w-full text-left" aria-label={`Open ${row.title || "Untitled note"}`}>
        <div className="flex items-start gap-2">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg text-base"
            style={{ backgroundColor: "var(--surface-2)" }}
            aria-hidden="true"
          >
            {row.icon ?? "📄"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", active ? "text-accent-ink" : "text-ink")}>
                {row.title || "Untitled note"}
              </span>
              {row.pinned ? <Pin className="size-3 shrink-0 text-accent-ink" aria-hidden="true" /> : null}
            </span>
            {row.preview ? (
              <span className={cn("mt-0.5 block text-[12px] leading-snug text-ink-3", view === "grid" ? "line-clamp-2" : "line-clamp-3")}>
                {row.preview}
              </span>
            ) : null}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {row.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: noteTagColor(tag) }}
            >
              #{tag}
            </span>
          ))}
          {row.folderName ? (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-3">{row.folderName}</span>
          ) : null}
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-3">{formatNoteDate(row.updatedAt)}</span>
        </div>
      </button>

      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DropdownMenu
          align="end"
          sections={[
            {
              label: row.title || "Untitled note",
              items: [
                ...(row.status === "active"
                  ? [
                      { label: row.pinned ? "Unpin note" : "Pin note", onSelect: () => onPin(row.id) },
                      { label: "Open note", onSelect: () => onOpen(row.id) },
                      { label: "Archive note", onSelect: () => onArchive(row.id) },
                      { label: "Delete note", danger: true, onSelect: () => onDelete(row.id) },
                    ]
                  : [
                      { label: "Open note", onSelect: () => onOpen(row.id) },
                      { label: "Restore note", onSelect: () => onRestore(row.id) },
                      {
                        label: row.status === "trashed" ? "Delete permanently" : "Delete note",
                        danger: true,
                        onSelect: () => onDelete(row.id),
                      },
                    ]),
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              aria-label={`${row.title || "Untitled note"} options`}
              className="grid size-6 place-items-center rounded-md bg-surface/80 text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </li>
  );
}