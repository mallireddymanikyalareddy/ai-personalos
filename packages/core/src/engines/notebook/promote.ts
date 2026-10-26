import type { AppState } from "../../store/state";
import type { Note } from "../../types/note";
import type { NewPageInput, Page } from "../../types/knowledge";

import { normalizeBlocks } from "./blocks";

export interface PromoteResult {
  page: Page;
  note: Note;
}

export function canPromoteNote(note: Note): boolean {
  return note.status !== "trashed" && note.wordCount > 0;
}

export function promoteNoteToPageInput(note: Note, notebookId: string): NewPageInput {
  return {
    notebookId,
    title: note.title.trim().length > 0 ? note.title.trim() : "Untitled",
    body: note.body,
    blocks: normalizeBlocks(
      note.blocks.length > 0
        ? note.blocks
        : [
            {
              id: `promote-${note.id}`,
              type: "paragraph",
              content: note.body,
            },
          ],
    ),
    tags: [...note.tags],
  };
}

export function buildPageSeed(title: string): NewPageInput {
  return {
    notebookId: "",
    title,
    body: "",
    blocks: [{ id: `seed-${title}`, type: "paragraph", content: "" }],
  };
}

export function notebookFromNote(note: Note): { title: string; description: string } {
  const title = note.title.trim().length > 0 ? `${note.title.trim()} notebook` : "New notebook";
  return {
    title,
    description: note.body.trim().length > 0 ? note.body.trim().slice(0, 160) : "",
  };
}

export function suggestedRelatedPages(state: AppState, page: Page, limit = 5): Page[] {
  const terms = new Set(
    page.tags
      .map((tag) => tag.toLowerCase())
      .concat(page.title.toLowerCase().split(/\s+/).filter((word) => word.length > 3)),
  );
  if (terms.size === 0) return [];
  return Object.values(state.pages)
    .filter((candidate) => candidate.id !== page.id && candidate.status === "active")
    .filter((candidate) => candidate.notebookId === page.notebookId)
    .map((candidate) => {
      const haystack = `${candidate.title} ${candidate.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
      }
      return { candidate, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.candidate.lastEditedAt - a.candidate.lastEditedAt)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}