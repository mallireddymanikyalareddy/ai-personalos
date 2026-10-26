import type { Note } from "@personalos/core";
import { noteToMarkdown, safeFileName } from "@personalos/core";

import { downloadText } from "@/modules/notebook/notebook-export";


export function exportNoteMarkdown(note: Note): void {
  downloadText(`${safeFileName(note.title || "note")}.md`, noteToMarkdown(note), "text/markdown");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blocksToHtml(blocks: Note["blocks"]): string {
  return blocks
    .map((block) => {
      const content = escapeHtml(block.content);
      switch (block.type) {
        case "heading": {
          const level = Number(block.attrs?.level ?? 1);
          const tag = `h${Math.min(6, Math.max(1, Number.isFinite(level) ? Math.round(level) : 1))}`;
          return `<${tag}>${content}</${tag}>`;
        }
        case "blockquote":
          return `<blockquote>${content}</blockquote>`;
        case "codeBlock":
          return `<pre><code>${content}</code></pre>`;
        case "divider":
          return "<hr />";
        case "image":
          return block.content.startsWith("data:") || block.content.startsWith("http")
            ? `<img src="${escapeHtml(block.content)}" alt="" />`
            : "";
        case "checkList":
          return `<li>${block.attrs?.checked === true ? "☑" : "☐"} ${content}</li>`;
        case "bulletList":
          return `<li>${content}</li>`;
        case "orderedList":
          return `<li>${content}</li>`;
        default:
          return content.length > 0 ? `<p>${content}</p>` : "";
      }
    })
    .join("\n");
}

export function exportNotePdf(note: Note): boolean {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) return false;

  const tags = note.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(note.title || "Note")}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b1e1c; margin: 40px auto; max-width: 720px; line-height: 1.6; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2, h3, h4, h5, h6 { margin: 20px 0 6px; }
  h2 { font-size: 22px; } h3 { font-size: 18px; } h4 { font-size: 16px; }
  p { margin: 0 0 10px; }
  blockquote { border-left: 3px solid #d6d6cd; margin: 12px 0; padding-left: 12px; color: #4f5551; }
  pre { background: #f4f4f0; padding: 10px; border-radius: 8px; overflow-wrap: anywhere; white-space: pre-wrap; }
  .meta { color: #7f857f; font-size: 13px; margin-bottom: 20px; }
  img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
  hr { border: 0; border-top: 1px solid #e7e7e0; margin: 18px 0; }
  ul { padding-left: 20px; }
</style></head><body>
<h1>${escapeHtml(note.title || "Untitled note")}</h1>
<p class="meta">${tags}${tags ? " · " : ""}${note.wordCount} words · ${new Date(note.updatedAt).toLocaleDateString()}</p>
${blocksToHtml(note.blocks)}
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
  win.document.close();
  return true;
}
