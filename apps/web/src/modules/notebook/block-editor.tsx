"use client";

import * as React from "react";

import {
Braces,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Code,
  Heading1,
  Heading2,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table2,
  Trash2,
} from "lucide-react";

import {
  LIST_TYPES,
  canIndentBlock,
  changeBlockType,
  createBlock,
  cycleHeadingLevel,
  flattenBlocks,
  headingLevel,
indentBlock,
  insertBlockAfter,
  moveBlock,
  outdentBlock,
  removeBlock,
  splitBlock,
  toggleCheckList,
  updateBlockContent,
  type NotebookBlockType,
} from "@personalos/core";
import type { NoteBlock } from "@personalos/core";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const TYPE_OPTIONS: Array<{
  value: NotebookBlockType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "paragraph", label: "Text", icon: Pilcrow },
  { value: "heading", label: "Heading", icon: Heading1 },
  { value: "bulletList", label: "Bulleted list", icon: List },
  { value: "orderedList", label: "Numbered list", icon: ListOrdered },
  { value: "checkList", label: "Checklist", icon: CheckSquare },
  { value: "blockquote", label: "Quote", icon: Quote },
  { value: "codeBlock", label: "Code", icon: Code },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "table", label: "Table", icon: Table2 },
  { value: "divider", label: "Divider", icon: Minus },
];

export interface BlockEditorProps {
  blocks: NoteBlock[];
  onChange: (blocks: NoteBlock[]) => void;
  readOnly?: boolean;
  onActiveBlockChange?: (id: string) => void;
}

const TABLE_STATUS_TONE: Record<string, string> = {
  done: "bg-success-soft text-success",
  "in progress": "bg-warning-soft text-warning",
  "not started": "bg-surface-2 text-ink-3",
  overdue: "bg-danger-soft text-danger",
};

function TableBlock({
  block,
  readOnly,
  onChange,
}: {
  block: NoteBlock;
  readOnly: boolean;
  onChange: (attrs: Record<string, unknown>) => void;
}) {
  const columns = Array.isArray(block.attrs?.columns) ? (block.attrs!.columns as string[]) : [];
  const rows = Array.isArray(block.attrs?.rows) ? (block.attrs!.rows as string[][]) : [];

  const update = (nextColumns: string[], nextRows: string[][]) => {
    onChange({ ...(block.attrs ?? {}), columns: nextColumns, rows: nextRows });
  };

  if (readOnly) {
    return (
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-ink-3">
            <tr>
              {columns.map((column, index) => (
                <th key={`${column}-${index}`} scope="col" className="px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => {
                  const tone = TABLE_STATUS_TONE[cell.toLowerCase()];
                  return (
                    <td key={cellIndex} className="px-3 py-2 text-ink-2">
                      {tone ? (
                        <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium", tone)}>
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-2/50 p-2">
      <div className="flex flex-wrap items-center gap-1">
        {columns.map((column, index) => (
          <label key={index} className="min-w-24 flex-1">
            <span className="sr-only">{column}</span>
            <input
              value={column}
              onChange={(event) => {
                const next = [...columns];
                next[index] = event.target.value;
                update(next, rows);
              }}
              aria-label={`Column ${index + 1} header`}
              className="w-full rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink outline-none focus:border-accent"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() =>
            update(
              [...columns, `Column ${columns.length + 1}`],
              rows.map((row) => [...row, ""]),
            )
          }
          aria-label="Add column"
          className="rounded-md border border-dashed border-line px-2 py-1 text-[11px] text-ink-3 hover:border-accent hover:text-accent-ink"
        >
          + Column
        </button>
      </div>

      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-1">
            {columns.map((_, columnIndex) => (
              <label key={columnIndex} className="min-w-0 flex-1">
                <span className="sr-only">{row[columnIndex] ?? ""}</span>
                <input
                  value={row[columnIndex] ?? ""}
                  onChange={(event) => {
                    const next = rows.map((entry, index) =>
                      index === rowIndex
                        ? columns.map((__, cellIndex) =>
                            cellIndex === columnIndex ? event.target.value : (entry[cellIndex] ?? ""),
                          )
                        : entry,
                    );
                    update(columns, next);
                  }}
                  aria-label={`Row ${rowIndex + 1} column ${columnIndex + 1}`}
                  className="w-full rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-ink-2 outline-none focus:border-accent"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => update(columns, rows.filter((_, index) => index !== rowIndex))}
              aria-label={`Remove row ${rowIndex + 1}`}
              className="grid size-6 shrink-0 place-items-center rounded text-ink-3 hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-3" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => update(columns, [...rows, columns.map(() => "")])}
          aria-label="Add row"
          className="rounded-md border border-dashed border-line px-2 py-1 text-[11px] text-ink-3 hover:border-accent hover:text-accent-ink"
        >
          + Row
        </button>
        {columns.length > 1 ? (
          <button
            type="button"
            onClick={() =>
              update(
                columns.slice(0, -1),
                rows.map((row) => row.slice(0, -1)),
              )
            }
            className="text-[11px] text-ink-3 hover:text-danger"
          >
            Remove last column
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function BlockEditor({ blocks, onChange, readOnly = false, onActiveBlockChange }: BlockEditorProps) {
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const inputs = React.useRef(new Map<string, HTMLTextAreaElement | HTMLInputElement>());
  const activeRef = React.useRef(onActiveBlockChange);
  activeRef.current = onActiveBlockChange;

  const focusBlock = React.useCallback((id: string, atEnd = true) => {
    const node = inputs.current.get(id);
    if (!node) return;
    node.focus();
    if (atEnd && node instanceof HTMLInputElement) {
      const end = node.value.length;
      try {
        node.setSelectionRange(end, end);
      } catch {
        return;
      }
    }
  }, []);

  const register = React.useCallback(
    (id: string, node: HTMLTextAreaElement | HTMLInputElement | null) => {
      if (node) {
        inputs.current.set(id, node);
        node.onfocus = () => activeRef.current?.(id);
      } else {
        inputs.current.delete(id);
      }
    },
    [],
  );

  const onKeyDown = (event: React.KeyboardEvent, block: NoteBlock) => {
    if (readOnly) return;
    const target = event.target as HTMLTextAreaElement | HTMLInputElement;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const result = splitBlock(blocks, block.id, target.selectionStart ?? target.value.length);
      onChange(result.blocks);
      window.requestAnimationFrame(() => focusBlock(result.nextId));
      return;
    }

    if (event.key === "Backspace" && target.value.length === 0) {
      event.preventDefault();
      const flat = flattenBlocks(blocks);
      const index = flat.findIndex((entry) => entry.block.id === block.id);
      const previous = index > 0 ? flat[index - 1].block : null;
      onChange(removeBlock(blocks, block.id));
      if (previous) window.requestAnimationFrame(() => focusBlock(previous.id));
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        if (canIndentBlock(blocks, block.id) || flattenBlocks(blocks).length > 1) {
          onChange(outdentBlock(blocks, block.id));
        }
        return;
      }
      if (canIndentBlock(blocks, block.id)) {
        onChange(indentBlock(blocks, block.id));
      } else {
        const next = createBlock("bulletList", "");
        onChange(changeBlockType(insertBlockAfter(blocks, block.id, next), next.id, "bulletList"));
        window.requestAnimationFrame(() => focusBlock(next.id));
      }
      return;
    }

    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault();
      onChange(moveBlock(blocks, block.id, "down"));
      return;
    }

    if (event.key === "ArrowUp" && event.altKey) {
      event.preventDefault();
      onChange(moveBlock(blocks, block.id, "up"));
    }
  };

  const renderInput = (block: NoteBlock) => {
    if (block.type === "divider") return null;
    if (block.type === "table") {
      return (
        <TableBlock
          block={block}
          readOnly={readOnly}
          onChange={(attrs) =>
            onChange(
              blocks.map((entry) => (entry.id === block.id ? { ...entry, attrs } : entry)),
            )
          }
        />
      );
    }
    if (block.type === "codeBlock") {
      return (
        <textarea
          ref={(node) => register(block.id, node)}
          value={block.content}
          readOnly={readOnly}
          rows={Math.max(3, block.content.split("\n").length)}
          onChange={(event) => onChange(updateBlockContent(blocks, block.id, event.target.value))}
          onKeyDown={(event) => onKeyDown(event, block)}
          placeholder="Code"
          spellCheck={false}
          className="w-full resize-y rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none ring-accent/40 focus:ring-2"
        />
      );
    }
    if (block.type === "heading") {
      const level = headingLevel(block) ?? 1;
      const sizes = [
        "text-lg font-semibold",
        "text-base font-semibold",
        "text-[15px] font-semibold",
        "text-sm font-semibold",
        "text-sm font-medium",
        "text-sm font-medium",
      ];
      return (
        <input
          ref={(node) => register(block.id, node)}
          value={block.content}
          readOnly={readOnly}
          onChange={(event) => onChange(updateBlockContent(blocks, block.id, event.target.value))}
          onKeyDown={(event) => onKeyDown(event, block)}
          placeholder="Heading"
          aria-label={`Heading level ${level}`}
          className={cn(
            "w-full bg-transparent text-ink outline-none placeholder:text-ink-3",
            sizes[level - 1],
          )}
        />
      );
    }
    return (
      <textarea
        ref={(node) => register(block.id, node)}
        value={block.content}
        readOnly={readOnly}
        rows={1}
        onChange={(event) => onChange(updateBlockContent(blocks, block.id, event.target.value))}
        onKeyDown={(event) => onKeyDown(event, block)}
        placeholder={LIST_TYPES.includes(block.type) ? "List item" : "Write something"}
        aria-label={block.type === "paragraph" ? "Paragraph" : "Block text"}
        className="w-full resize-none bg-transparent py-0.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
      />
    );
  };

  return (
    <div className="space-y-0.5">
      {flattenBlocks(blocks).map(({ block, depth }) => {
        const isList = LIST_TYPES.includes(block.type);
        const open = menuFor === block.id;
        const checked = block.attrs?.checked === true;
        return (
          <div
            key={block.id}
            className="group relative flex items-start gap-2 rounded-lg px-1 py-0.5 hover:bg-surface-2/60"
            style={{ paddingLeft: `${depth * 20 + 4}px` }}
            data-block-type={block.type}
            data-block-id={block.id}
          >
            <div className="flex shrink-0 items-center gap-0.5 pt-1">
              {isList && block.type === "checkList" ? (
                <button
                  type="button"
                  aria-label="Toggle checked"
                  aria-pressed={checked}
                  disabled={readOnly}
                  onClick={() => onChange(toggleCheckList(blocks, block.id))}
                  className={cn(
                    "size-4 rounded border",
                    checked ? "border-accent bg-accent text-white" : "border-line-strong",
                  )}
                >
                  {checked ? <CheckSquare className="size-3" /> : null}
                </button>
              ) : isList ? (
                <span aria-hidden="true" className="px-1 text-xs text-ink-3">
                  {block.type === "orderedList" ? <ListOrdered className="size-3.5" /> : <List className="size-3.5" />}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              {block.type === "divider" ? (
                <div className="my-3 border-t border-line" role="separator" />
              ) : block.type === "blockquote" ? (
                <blockquote className="border-l-2 border-accent/50 pl-3 italic text-ink-2">
                  <textarea
                    ref={(node) => register(block.id, node)}
                    value={block.content}
                    readOnly={readOnly}
                    rows={1}
                    onChange={(event) => onChange(updateBlockContent(blocks, block.id, event.target.value))}
                    onKeyDown={(event) => onKeyDown(event, block)}
                    placeholder="Quote"
                    aria-label="Quote"
                    className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-ink-3"
                  />
                </blockquote>
              ) : block.type === "image" ? (
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                    <input
                      ref={(node) => register(block.id, node)}
                      value={block.content}
                      readOnly={readOnly}
                      onChange={(event) => onChange(updateBlockContent(blocks, block.id, event.target.value))}
                      onKeyDown={(event) => onKeyDown(event, block)}
                      placeholder="Image URL"
                      aria-label="Image URL"
                      className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                    />
                  </div>
                  {block.content.trim().length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.content}
                      alt=""
                      className="mt-2 max-h-56 rounded-lg border border-line object-contain"
                    />
                  ) : null}
                </div>
              ) : (
                renderInput(block)
              )}
            </div>

            {!readOnly ? (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Turn into heading"
                  title="Turn into heading"
                  onClick={() => onChange(cycleHeadingLevel(blocks, block.id, 1))}
                  className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"
                >
                  {block.type === "heading" ? (
                    <Heading2 className="size-3.5" />
                  ) : (
                    <Heading1 className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Move block up"
                  onClick={() => onChange(moveBlock(blocks, block.id, "up"))}
                  className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move block down"
                  onClick={() => onChange(moveBlock(blocks, block.id, "down"))}
                  className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove block"
                  onClick={() => onChange(removeBlock(blocks, block.id))}
                  className="rounded p-1 text-ink-3 hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Change block type"
                  aria-expanded={open}
                  onClick={() => setMenuFor(open ? null : block.id)}
                  className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"
                >
                  <Braces className="size-3.5" />
                </button>
              </div>
            ) : null}

            {open && !readOnly ? (
              <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-line bg-surface p-1 shadow-lg">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(changeBlockType(blocks, block.id, option.value));
                      setMenuFor(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                      block.type === option.value
                        ? "bg-surface-3 text-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <option.icon className="size-3.5 shrink-0" />
                    {option.label}
                  </button>
                ))}
                {!isList && block.type !== "divider" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = createBlock("paragraph", "");
                      onChange(insertBlockAfter(blocks, block.id, next));
                      setMenuFor(null);
                      window.requestAnimationFrame(() => focusBlock(next.id));
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded border-t border-line px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <Pilcrow className="size-3.5 shrink-0" />
                    Add block below
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {blocks.length === 0 ? (
        <Button variant="ghost" size="sm" onClick={() => onChange([createBlock("paragraph")])}>
          Add your first block
        </Button>
) : null}
    </div>
  );
}
