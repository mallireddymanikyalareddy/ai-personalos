"use client";

import * as React from "react";

import { Hash, Plus } from "lucide-react";

import type { NoteFolderRow, NoteTagRow } from "@personalos/core";

import { cn } from "@/lib/cn";

import { noteFolderIcon, noteTagColor } from "./notes-meta";

export interface FoldersRailProps {
  folders: NoteFolderRow[];
  tags: NoteTagRow[];
  folderFilter: string;
  tagFilter: string | null;
  onSelectFolder: (id: string) => void;
  onSelectTag: (tag: string | null) => void;
  onNewFolder: () => void;
  onTagActiveNote: () => void;
  onDropNote?: (folderId: string, noteId: string) => void;
  tagLimit?: number;
}

export function FoldersRail({
  folders,
  tags,
  folderFilter,
  tagFilter,
  onSelectFolder,
  onSelectTag,
  onNewFolder,
  onTagActiveNote,
  onDropNote,
  tagLimit = 9,
}: FoldersRailProps) {
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const visibleTags = showAllTags ? tags : tags.slice(0, tagLimit);

  return (
    <div className="space-y-5">
      <section aria-label="Folders" data-testid="notes-folders">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Folders</h2>
          <button
            type="button"
            onClick={onNewFolder}
            aria-label="New folder"
            className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </header>
        <ul className="space-y-0.5">
          {folders.map((folder) => {
            const Icon = noteFolderIcon(folder.name);
            const active = folderFilter === folder.id;
            return (
              <li key={folder.id}>
                <button
                  type="button"
                  data-testid={`notes-folder-${folder.name}`}
                  onClick={() => onSelectFolder(folder.id)}
                  aria-pressed={active}
                  onDragOver={(event) => {
                    if (!onDropNote) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOver(folder.id);
                  }}
                  onDragLeave={() => setDragOver((current) => (current === folder.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);
                    const noteId = event.dataTransfer.getData("text/lifeos-note");
                    if (noteId) onDropNote?.(folder.id, noteId);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
                    active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                    dragOver === folder.id && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
                  )}
                >
                  <Icon className="size-4 shrink-0" style={{ color: folder.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{folder.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Tags" data-testid="notes-tags">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Tags</h2>
          <button
            type="button"
            onClick={onTagActiveNote}
            aria-label="Add tag to note"
            className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </header>
        <ul className="space-y-0.5">
          {visibleTags.map((row) => {
            const active = tagFilter === row.tag;
            return (
              <li key={row.tag}>
                <button
                  type="button"
                  data-testid={`notes-tag-${row.tag}`}
                  onClick={() => onSelectTag(active ? null : row.tag)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
                    active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <Hash className="size-3.5 shrink-0" style={{ color: noteTagColor(row.tag) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{row.tag}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{row.count}</span>
                </button>
              </li>
            );
          })}
          {tags.length === 0 ? <li className="px-2 text-[12px] text-ink-3">No tags yet.</li> : null}
        </ul>
        {tags.length > tagLimit ? (
          <button
            type="button"
            onClick={() => setShowAllTags((value) => !value)}
            className="mt-1 px-2 text-[12px] font-medium text-accent-ink hover:underline"
          >
            {showAllTags ? "Show less" : "Show more"}
          </button>
        ) : null}
      </section>
    </div>
  );
}