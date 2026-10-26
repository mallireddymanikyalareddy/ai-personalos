import type { NoteBlock } from "../../types/note";

import { flattenBlocks, headingLevel } from "./blocks";

export interface TocEntry {
  blockId: string;
  title: string;
  level: number;
  depth: number;
}

export interface TocNode extends TocEntry {
  children: TocNode[];
}

export function pageToc(blocks: NoteBlock[]): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const { block, depth } of flattenBlocks(blocks)) {
    if (block.type !== "heading") continue;
    const title = block.content.trim();
    if (title.length === 0) continue;
    entries.push({ blockId: block.id, title, level: headingLevel(block) ?? 1, depth });
  }
  return entries;
}

function nestEntries(entries: TocEntry[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const entry of entries) {
    const node: TocNode = { ...entry, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return roots;
}

export function tocTree(blocks: NoteBlock[]): TocNode[] {
  return nestEntries(pageToc(blocks));
}

export function flattenToc(nodes: TocNode[]): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (list: TocNode[]) => {
    for (const node of list) {
      out.push({ blockId: node.blockId, title: node.title, level: node.level, depth: node.depth });
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function tocToMarkdown(entries: TocEntry[]): string {
  return entries
    .map((entry) => `${"  ".repeat(Math.max(0, entry.level - 1))}- [${entry.title}](#${anchorSlug(entry.title)})`)
    .join("\n");
}

export function anchorSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function hasToc(blocks: NoteBlock[]): boolean {
  return pageToc(blocks).length >= 2;
}