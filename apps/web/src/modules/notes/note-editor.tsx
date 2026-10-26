"use client";

import * as React from "react";

import {
  Bold,
  CheckSquare,
  Code,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Quote,
  Share2,
  Star,
  Underline,
  X,
} from "lucide-react";

import type { ID, NoteBlock } from "@personalos/core";

import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { BlockEditor } from "@/modules/notebook/block-editor";

import { NOTE_BLOCK_TYPES, formatNoteTimestamp, noteTagColor } from "./notes-meta";

export interface NoteEditorProps {
  noteId: ID;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  icon: string | null;
  pinned: boolean;
  status: "active" | "archived" | "trashed";
  versions: { id: string; at: number; title: string; wordCount: number; blockCount: number }[];
  updatedAt: number;
  onTitleChange: (title: string) => void;
  onBlocksChange: (blocks: NoteBlock[]) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onRestoreVersion: (versionId: string) => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onDelete: () => void;
}

const INLINE_ACTIONS: { id: string; label: string; icon: typeof Bold; marker: string }[] = [
  { id: "bold", label: "Bold", icon: Bold, marker: "**" },
  { id: "italic", label: "Italic", icon: Italic, marker: "_" },
  { id: "underline", label: "Underline", icon: Underline, marker: "__" },
];

export function NoteEditor({
  noteId,
  title,
  blocks,
  tags,
  icon,
  pinned,
  status,
  versions,
  updatedAt,
  onTitleChange,
  onBlocksChange,
  onAddTag,
  onRemoveTag,
  onTogglePin,
  onArchive,
  onRestore,
  onRestoreVersion,
  onExportMarkdown,
  onExportPdf,
  onDelete,
}: NoteEditorProps) {
  const [activeBlockId, setActiveBlockId] = React.useState<ID | null>(blocks[0]?.id ?? null);
  const [tagInput, setTagInput] = React.useState("");
  const blocksRef = React.useRef(blocks);
  blocksRef.current = blocks;

  React.useEffect(() => {
    setActiveBlockId(blocksRef.current[0]?.id ?? null);
    setTagInput("");
  }, [noteId]);

  const activeIndex = blocks.findIndex((block) => block.id === activeBlockId);

  const changeActiveType = (type: string) => {
    const next = [...blocks];
    const index = activeIndex >= 0 ? activeIndex : 0;
    const block = next[index];
    if (!block) return;
    if (type === "table") {
      next.splice(index, 1, {
        id: block.id,
        type: "table",
        content: "",
        attrs: {
          columns: ["Phase", "Task", "Timeline", "Status"],
          rows: [["Phase 1", "Task", "Date", "Not Started"]],
        },
      });
    } else {
      next.splice(index, 1, { ...block, type: type as NoteBlock["type"] });
    }
    onBlocksChange(next);
  };

  const insertBlock = (type: NoteBlock["type"], content = "") => {
    const block: NoteBlock = {
      id: `blk-${Math.random().toString(36).slice(2, 10)}`,
      type,
      content,
    };
    const index = activeIndex >= 0 ? activeIndex + 1 : blocks.length;
    const next = [...blocks];
    next.splice(index, 0, block);
    onBlocksChange(next);
    setActiveBlockId(block.id);
  };

  const applyInline = (marker: string) => {
    const element = document.activeElement as HTMLTextAreaElement | null;
    if (!element || typeof element.selectionStart !== "number" || typeof element.value !== "string") return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const value = element.value;
    const selected = value.slice(start, end) || "text";
    const next = `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(element, next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const submitTag = () => {
    const tag = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (tag.length === 0 || tags.includes(tag)) return;
    onAddTag(tag);
    setTagInput("");
  };

  return (
    <section
      aria-label="Note editor"
      data-testid="note-editor"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Note
        </span>
        <span className="text-[11px] text-ink-3" data-testid="note-updated">
          Last updated: {formatNoteTimestamp(updatedAt)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            data-testid="note-star"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin note" : "Pin note"}
            className={cn(
              "grid size-7 place-items-center rounded-lg transition-colors hover:bg-surface-2",
              pinned ? "text-warning" : "text-ink-3 hover:text-ink",
            )}
          >
            <Star className={cn("size-4", pinned && "fill-current")} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Share note"
            onClick={() => window.location.assign("/settings")}
            className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Share2 className="size-4" aria-hidden="true" />
          </button>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Note",
                items: [
                  ...(status === "active"
                    ? [
                        { label: pinned ? "Unpin note" : "Pin note", onSelect: onTogglePin },
                        { label: "Archive note", onSelect: onArchive },
                        { label: "Delete note", danger: true, onSelect: onDelete },
                      ]
                    : [
                        { label: "Restore note", onSelect: onRestore },
                        {
                          label: status === "trashed" ? "Delete permanently" : "Delete note",
                          danger: true,
                          onSelect: onDelete,
                        },
                      ]),
                  { label: "Export as Markdown", onSelect: onExportMarkdown },
                  { label: "Export as PDF", onSelect: onExportPdf },
                ],
              },
              ...(versions.length > 0
                ? [
                    {
                      separatorBefore: true,
                      label: "Version history",
                      items: versions.slice(0, 8).map((version) => ({
                        label: `Restore ${new Intl.DateTimeFormat(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(version.at))} · ${version.wordCount} words`,
                        onSelect: () => onRestoreVersion(version.id),
                      })),
                    },
                  ]
                : []),
            ]}
            trigger={
              <button
                type="button"
                aria-label="Note options"
                className="grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Untitled note"
            aria-label="Note title"
            className="min-w-0 flex-1 bg-transparent text-xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-3"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="note-tags">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: noteTagColor(tag) }}
            >
              #{tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="text-ink-3 hover:text-danger"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <Input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitTag();
              }
            }}
            placeholder="+ Add tag"
            aria-label="Add tag"
            className="h-6 w-24 border-dashed px-2 text-[11px]"
          />
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface-2/60 px-1.5 py-1"
          data-testid="note-toolbar"
          role="toolbar"
          aria-label="Formatting"
        >
          <DropdownMenu
            align="start"
            sections={[
              {
                label: "Block type",
                items: NOTE_BLOCK_TYPES.map((option) => ({
                  label: option.label,
                  selected: activeIndex >= 0 && blocks[activeIndex]?.type === option.value,
                  onSelect: () => changeActiveType(option.value),
                })),
              },
            ]}
            trigger={
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
                aria-label="Block type"
              >
                {(() => {
                  const type = activeIndex >= 0 ? blocks[activeIndex]?.type : "paragraph";
                  return NOTE_BLOCK_TYPES.find((option) => option.value === type)?.label ?? "Paragraph";
                })()}
              </button>
            }
          />
          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />

          {INLINE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={`note-format-${action.id}`}
                aria-label={action.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyInline(action.marker)}
                className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </button>
            );
          })}

          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />

          {[
            { id: "bullets", label: "Bulleted list", icon: List, type: "bulletList" as const },
            { id: "numbered", label: "Numbered list", icon: ListOrdered, type: "orderedList" as const },
            { id: "checklist", label: "Checklist", icon: CheckSquare, type: "checkList" as const },
            { id: "quote", label: "Quote", icon: Quote, type: "blockquote" as const },
            { id: "code", label: "Code block", icon: Code, type: "codeBlock" as const },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={`note-format-${action.id}`}
                aria-label={action.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => changeActiveType(action.type)}
                className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </button>
            );
          })}

          <button
            type="button"
            data-testid="note-format-link"
            aria-label="Insert link"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyInline("[")}
            className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Link2 className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="note-format-image"
            aria-label="Insert image"
            onClick={() => insertBlock("image", "https://")}
            className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ImageIcon className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="note-format-divider"
            aria-label="Insert divider"
            onClick={() => insertBlock("divider")}
            className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3">
          <BlockEditor blocks={blocks} onChange={onBlocksChange} onActiveBlockChange={setActiveBlockId} />
        </div>
      </div>
    </section>
  );
}