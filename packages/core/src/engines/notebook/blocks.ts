import type { NoteBlock } from "../../types/note";
import { newId } from "../../types/common";

export type NotebookBlockType = NoteBlock["type"];

export const LIST_TYPES: NotebookBlockType[] = ["bulletList", "orderedList", "checkList"];
export const TEXT_TYPES: NotebookBlockType[] = ["paragraph", "heading", "blockquote", "codeBlock"];
export const CONTAINER_TYPES: NotebookBlockType[] = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "checkList",
  "blockquote",
  "codeBlock",
  "callout",
  "image",
  "audio",
  "file",
  "table",
];

export function createBlock(type: NotebookBlockType, content = ""): NoteBlock {
  return { id: newId(), type, content };
}

export function normalizeBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return blocks.map((block) => ({
    id: block.id || newId(),
    type: block.type,
    content: block.content ?? "",
    ...(block.attrs ? { attrs: block.attrs } : {}),
    ...(block.children && block.children.length > 0
      ? { children: normalizeBlocks(block.children) }
      : {}),
  }));
}

export function flattenBlocks(blocks: NoteBlock[], depth = 0): Array<{ block: NoteBlock; depth: number }> {
  const out: Array<{ block: NoteBlock; depth: number }> = [];
  for (const block of blocks) {
    out.push({ block, depth });
    if (block.children && block.children.length > 0) {
      out.push(...flattenBlocks(block.children, depth + 1));
    }
  }
  return out;
}

export function blockText(block: NoteBlock): string {
  const own = block.content.trim();
  const kids = block.children ? block.children.map(blockText).filter(Boolean).join(" ") : "";
  return [own, kids].filter(Boolean).join(" ");
}

export function blocksText(blocks: NoteBlock[]): string {
  return flattenBlocks(blocks)
    .map((entry) => blockText(entry.block))
    .filter(Boolean)
    .join("\n");
}

export function blockById(blocks: NoteBlock[], id: string): NoteBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = blockById(block.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function updateBlockContent(
  blocks: NoteBlock[],
  id: string,
  content: string,
): NoteBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return { ...block, content };
    if (block.children) {
      return { ...block, children: updateBlockContent(block.children, id, content) };
    }
    return block;
  });
}

export function updateBlock(
  blocks: NoteBlock[],
  id: string,
  patch: Partial<Omit<NoteBlock, "id">>,
): NoteBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return { ...block, ...patch, id: block.id };
    if (block.children) {
      return { ...block, children: updateBlock(block.children, id, patch) };
    }
    return block;
  });
}

export function insertBlockAfter(blocks: NoteBlock[], anchorId: string, block: NoteBlock): NoteBlock[] {
  const index = blocks.findIndex((candidate) => candidate.id === anchorId);
  if (index >= 0) {
    const next = [...blocks];
    next.splice(index + 1, 0, block);
    return next;
  }
  for (let i = 0; i < blocks.length; i += 1) {
    const current = blocks[i];
    if (!current.children) continue;
    const nested = insertBlockAfter(current.children, anchorId, block);
    if (nested !== current.children) {
      const next = [...blocks];
      next[i] = { ...current, children: nested };
      return next;
    }
  }
  return [...blocks, block];
}

export function insertBlockAt(blocks: NoteBlock[], index: number, block: NoteBlock): NoteBlock[] {
  const clamped = Math.max(0, Math.min(index, blocks.length));
  const next = [...blocks];
  next.splice(clamped, 0, block);
  return next;
}

export function appendBlock(blocks: NoteBlock[], block: NoteBlock): NoteBlock[] {
  return [...blocks, block];
}

function removeFromList(list: NoteBlock[], id: string): { blocks: NoteBlock[]; removed: NoteBlock | null } {
  const index = list.findIndex((candidate) => candidate.id === id);
  if (index >= 0) {
    const removed = list[index];
    const next = [...list];
    next.splice(index, 1);
    return { blocks: next, removed };
  }
  for (let i = 0; i < list.length; i += 1) {
    const current = list[i];
    if (!current.children) continue;
    const result = removeFromList(current.children, id);
    if (result.removed) {
      const next = [...list];
      next[i] = { ...current, children: result.blocks };
      return { blocks: next, removed: result.removed };
    }
  }
  return { blocks: list, removed: null };
}

export function removeBlock(blocks: NoteBlock[], id: string): NoteBlock[] {
  return removeFromList(blocks, id).blocks;
}

export function removeBlockAndReturn(blocks: NoteBlock[], id: string): NoteBlock | null {
  return removeFromList(blocks, id).removed;
}

function parentListOf(
  blocks: NoteBlock[],
  id: string,
  trail: NoteBlock[] = [],
): { siblings: NoteBlock[]; trail: NoteBlock[] } | null {
  const index = blocks.findIndex((candidate) => candidate.id === id);
  if (index >= 0) return { siblings: blocks, trail };
  for (const block of blocks) {
    if (!block.children) continue;
    const found = parentListOf(block.children, id, [...trail, block]);
    if (found) return found;
  }
  return null;
}

export function canIndentBlock(blocks: NoteBlock[], id: string): boolean {
  const parent = parentListOf(blocks, id);
  if (!parent) return false;
  const index = parent.siblings.findIndex((candidate) => candidate.id === id);
  if (index <= 0) return false;
  if (!LIST_TYPES.includes(parent.siblings[index - 1].type)) return false;
  return true;
}

export function indentBlock(blocks: NoteBlock[], id: string): NoteBlock[] {
  const parent = parentListOf(blocks, id);
  if (!parent) return blocks;
  const index = parent.siblings.findIndex((candidate) => candidate.id === id);
  if (index <= 0) return blocks;
  const host = parent.siblings[index - 1];
  if (!LIST_TYPES.includes(host.type)) return blocks;
  const moved = parent.siblings[index];
  const stripped = parent.siblings.filter((candidate) => candidate.id !== id);
  const nextHost: NoteBlock = { ...host, children: [...(host.children ?? []), moved] };
  const replaced = stripped.map((candidate) => (candidate.id === host.id ? nextHost : candidate));
  if (parent.trail.length === 0) return replaced;
  return replaceSiblings(blocks, parent.trail, replaced);
}

export function canOutdentBlock(blocks: NoteBlock[], id: string): boolean {
  const parent = parentListOf(blocks, id);
  if (!parent) return false;
  return parent.trail.length > 0;
}

export function outdentBlock(blocks: NoteBlock[], id: string): NoteBlock[] {
  const parent = parentListOf(blocks, id);
  if (!parent) return blocks;
  const host = parent.trail[parent.trail.length - 1];
  if (!host) return blocks;
  const moved = parent.siblings.find((candidate) => candidate.id === id);
  if (!moved) return blocks;
  const remaining = (host.children ?? []).filter((child) => child.id !== id);
  const withoutNested: NoteBlock = { ...host };
  if (remaining.length > 0) {
    withoutNested.children = remaining;
  } else {
    delete withoutNested.children;
  }
  const updated = replaceBlock(blocks, host.id, withoutNested);
  return insertBlockAfter(updated, host.id, moved);
}

export function replaceBlock(blocks: NoteBlock[], id: string, next: NoteBlock): NoteBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return next;
    if (block.children) return { ...block, children: replaceBlock(block.children, id, next) };
    return block;
  });
}

export function moveBlock(blocks: NoteBlock[], id: string, direction: "up" | "down"): NoteBlock[] {
  const parent = parentListOf(blocks, id);
  if (!parent) return blocks;
  const index = parent.siblings.findIndex((candidate) => candidate.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= parent.siblings.length) return blocks;
  const next = [...parent.siblings];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  if (parent.trail.length === 0) return next;
  return replaceSiblings(blocks, parent.trail, next);
}

function replaceSiblings(
  blocks: NoteBlock[],
  trail: NoteBlock[],
  siblings: NoteBlock[],
): NoteBlock[] {
  const host = trail[trail.length - 1];
  const hostIndex = blocks.findIndex((candidate) => candidate.id === host.id);
  if (hostIndex < 0) return blocks;
  const next = [...blocks];
  next[hostIndex] = {
    ...host,
    children: trail.length > 1 ? replaceSiblings(host.children ?? [], trail.slice(0, -1), siblings) : siblings,
  };
  return next;
}

export function changeBlockType(
  blocks: NoteBlock[],
  id: string,
  type: NotebookBlockType,
): NoteBlock[] {
  const block = blockById(blocks, id);
  if (!block) return blocks;
  if (type === "divider") {
    const { children: _children, ...rest } = block;
    return replaceBlock(blocks, id, { ...rest, type });
  }
  if (type === "table") {
    const { children: _children, ...rest } = block;
    const attrs = block.attrs ?? {};
    const hasTable = Array.isArray(attrs.columns) && Array.isArray(attrs.rows);
    return replaceBlock(blocks, id, {
      ...rest,
      type,
      attrs: hasTable
        ? attrs
        : {
            ...attrs,
            columns: ["Column 1", "Column 2"],
            rows: [
              ["", ""],
              ["", ""],
            ],
          },
    });
  }
  return updateBlock(blocks, id, { type });
}

export function toggleCheckList(blocks: NoteBlock[], id: string): NoteBlock[] {
  const block = blockById(blocks, id);
  if (!block || block.type !== "checkList") return blocks;
  const checked = block.attrs?.checked === true;
  return updateBlock(blocks, id, { attrs: { ...block.attrs, checked: !checked } });
}

export function headingLevel(block: NoteBlock): number | null {
  if (block.type !== "heading") return null;
  const raw = Number(block.attrs?.level ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(6, Math.max(1, Math.round(raw)));
}

export function setHeadingLevel(blocks: NoteBlock[], id: string, level: number): NoteBlock[] {
  const clamped = Math.min(6, Math.max(1, Math.round(level)));
  return updateBlock(blocks, id, { attrs: { level: clamped } });
}

export function cycleHeadingLevel(blocks: NoteBlock[], id: string, direction: 1 | -1 = 1): NoteBlock[] {
  const block = blockById(blocks, id);
  if (!block) return blocks;
  if (block.type !== "heading") return setHeadingLevel(blocks, id, 1);
  const current = headingLevel(block) ?? 1;
  return setHeadingLevel(blocks, id, current + direction);
}

export function ensureTrailingParagraph(blocks: NoteBlock[]): NoteBlock[] {
  if (blocks.length === 0) return [createBlock("paragraph")];
  const flat = flattenBlocks(blocks);
  const last = flat[flat.length - 1];
  if (last && LIST_TYPES.includes(last.block.type)) return [...blocks, createBlock("paragraph")];
  return blocks;
}

export function splitBlock(blocks: NoteBlock[], id: string, caret: number): { blocks: NoteBlock[]; nextId: string } {
  const block = blockById(blocks, id);
  if (!block) return { blocks, nextId: id };
  const content = block.content;
  const head = content.slice(0, caret);
  const tail = content.slice(caret);
  const isList = LIST_TYPES.includes(block.type);
  const nextType: NotebookBlockType = isList ? block.type : "paragraph";
  const next = createBlock(nextType, tail);
  const trimmed = head;
  const updated = updateBlock(blocks, id, { content: trimmed });
  return { blocks: insertBlockAfter(updated, id, next), nextId: next.id };
}

export function mergeBlockWithPrevious(blocks: NoteBlock[], id: string): NoteBlock[] {
  const parent = parentListOf(blocks, id);
  if (!parent) return blocks;
  const index = parent.siblings.findIndex((candidate) => candidate.id === id);
  if (index <= 0) return blocks;
  const previous = parent.siblings[index - 1];
  const current = parent.siblings[index];
  const mergedContent = `${previous.content}${current.content}`;
  const merged = { ...previous, content: mergedContent };
  const withoutCurrent = parent.siblings.filter((candidate) => candidate.id !== id);
  const replaced = withoutCurrent.map((candidate) =>
    candidate.id === previous.id ? merged : candidate,
  );
  if (parent.trail.length === 0) return replaced;
  return replaceSiblings(blocks, parent.trail, replaced);
}