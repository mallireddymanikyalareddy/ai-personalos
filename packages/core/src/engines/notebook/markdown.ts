import type { NoteBlock } from "../../types/note";
import type { Notebook, Page } from "../../types/knowledge";

import type { AppState } from "../../store/state";

import { blockText } from "./blocks";
import { anchorSlug, pageToc } from "./toc";

export const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

export function safeFileName(title: string, fallback = "untitled"): string {
  const cleaned = title.replace(INVALID_FILENAME_CHARS, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return fallback;
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const base = reserved.test(cleaned) ? `${cleaned}-page` : cleaned;
  return base.slice(0, 120);
}

function checkedOf(block: NoteBlock): boolean {
  return block.attrs?.checked === true;
}

function indentOf(block: NoteBlock, depth: number): string {
  return "  ".repeat(Math.max(0, depth));
}

function orderedMarker(index: number): string {
  return `${index + 1}.`;
}

export function blocksToMarkdown(blocks: NoteBlock[], depth = 0): string {
  const lines: string[] = [];
  let orderedIndex = 0;

  for (const block of blocks) {
    const content = block.content.replace(/\s+$/, "");
    switch (block.type) {
      case "heading": {
        const level = Number(block.attrs?.level ?? 1);
        const safe = Math.min(6, Math.max(1, Number.isFinite(level) ? Math.round(level) : 1));
        lines.push(`${"#".repeat(safe)} ${content}`);
        orderedIndex = 0;
        break;
      }
      case "paragraph":
        lines.push(content);
        orderedIndex = 0;
        break;
      case "blockquote":
        lines.push(
          content
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        );
        orderedIndex = 0;
        break;
      case "codeBlock": {
        const language = typeof block.attrs?.language === "string" ? block.attrs.language : "";
        lines.push(`\`\`\`${language}`, content, "```");
        orderedIndex = 0;
        break;
      }
      case "bulletList":
        lines.push(`${indentOf(block, depth)}- ${content}`);
        orderedIndex = 0;
        break;
      case "orderedList":
        lines.push(`${indentOf(block, depth)}${orderedMarker(orderedIndex)} ${content}`);
        orderedIndex += 1;
        break;
      case "checkList":
        lines.push(`${indentOf(block, depth)}- [${checkedOf(block) ? "x" : " "}] ${content}`);
        orderedIndex = 0;
        break;
      case "callout": {
        const kind = typeof block.attrs?.tone === "string" ? block.attrs.tone : "note";
        lines.push(`> [!${kind}]`, ...content.split("\n").map((line) => `> ${line}`));
        orderedIndex = 0;
        break;
      }
      case "image": {
        const src = typeof block.attrs?.src === "string" ? block.attrs.src : "";
        const alt = content || (typeof block.attrs?.alt === "string" ? block.attrs.alt : "image");
        lines.push(`![${alt}](${src})`);
        orderedIndex = 0;
        break;
      }
      case "audio": {
        const src = typeof block.attrs?.src === "string" ? block.attrs.src : "";
        lines.push(`[audio](${src})`);
        orderedIndex = 0;
        break;
      }
      case "file": {
        const src = typeof block.attrs?.src === "string" ? block.attrs.src : "";
        lines.push(`[${content || "file"}](${src})`);
        orderedIndex = 0;
        break;
      }
      case "divider":
        lines.push("---");
        orderedIndex = 0;
        break;
      default:
        lines.push(content);
        orderedIndex = 0;
    }

    if (block.children && block.children.length > 0) {
      const childDepth = ["bulletList", "orderedList", "checkList"].includes(block.type)
        ? depth + 1
        : depth;
      const nested = blocksToMarkdown(block.children, childDepth);
      if (nested.length > 0) lines.push(nested);
    }
  }

  return lines.filter((line) => line.length > 0).join("\n");
}

export function pageToMarkdown(page: Page, options: { toc?: boolean } = {}): string {
  const parts: string[] = [`# ${page.title.trim() || "Untitled"}`, ""];

  if (options.toc) {
    const entries = pageToc(page.blocks);
    if (entries.length >= 2) {
      parts.push("## Contents", "");
      for (const entry of entries) {
        parts.push(`${"  ".repeat(Math.max(0, entry.level - 1))}- [${entry.title}](#${anchorSlug(entry.title)})`);
      }
      parts.push("");
    }
  }

  const body = blocksToMarkdown(page.blocks);
  if (body.length > 0) {
    parts.push(body, "");
  }

  if (page.tags.length > 0) {
    parts.push(`Tags: ${page.tags.map((tag) => `#${tag}`).join(" ")}`, "");
  }

  const updated = new Date(page.lastEditedAt || page.updatedAt).toISOString().slice(0, 10);
  parts.push(`_Last edited ${updated}_`);

  return parts.join("\n");
}

export function notebookToMarkdown(notebook: Notebook, pages: Page[], options: { toc?: boolean } = {}): string {
  const parts: string[] = [`# ${notebook.title.trim() || "Notebook"}`, ""];

  if (notebook.description.trim().length > 0) {
    parts.push(notebook.description.trim(), "");
  }

  parts.push("## Pages", "");
  for (const page of pages) {
    parts.push(`- [${page.title.trim() || "Untitled"}](#${anchorSlug(page.title.trim() || "untitled")})`);
  }
  parts.push("");

  for (const page of pages) {
    const body = blocksToMarkdown(page.blocks);
    parts.push(`# ${page.title.trim() || "Untitled"}`, "");
    if (body.length > 0) parts.push(body, "");
    parts.push("---", "");
  }

  return parts.join("\n");
}

export function pagePlainText(page: Page): string {
  return page.blocks
    .map((block) => blockText(block))
    .filter(Boolean)
    .join("\n");
}

export function notebookWordCount(pages: Page[]): number {
  return pages.reduce((total, page) => total + page.wordCount, 0);
}

export function pagesInNotebook(state: AppState, notebookId: string): Page[] {
  return Object.values(state.pages)
    .filter((page) => page.notebookId === notebookId && page.status !== "trashed")
    .sort((a, b) => a.order - b.order);
}