import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Notebook, Page } from "../../types/knowledge";

export interface NotebookStats {
  pageCount: number;
  wordCount: number;
  readingTimeMinutes: number;
  lastEditedAt: Timestamp | null;
  tagCount: number;
}

export interface NotebookSummary extends NotebookStats {
  notebook: Notebook;
}

export function listNotebooks(state: AppState, includeArchived = false): Notebook[] {
  return Object.values(state.notebooks)
    .filter((notebook) => includeArchived || notebook.status === "active")
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function listArchivedNotebooks(state: AppState): Notebook[] {
  return Object.values(state.notebooks)
    .filter((notebook) => notebook.status === "archived")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listPages(state: AppState, notebookId: ID, includeTrashed = false): Page[] {
  return Object.values(state.pages)
    .filter((page) => page.notebookId === notebookId)
    .filter((page) => includeTrashed || page.status !== "trashed")
    .sort((a, b) => a.order - b.order || b.lastEditedAt - a.lastEditedAt);
}

export function listTrashedPages(state: AppState): Page[] {
  return Object.values(state.pages)
    .filter((page) => page.status === "trashed")
    .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
}

export function notebookStats(state: AppState, notebookId: ID): NotebookStats {
  const pages = listPages(state, notebookId);
  const tags = new Set<string>();
  for (const page of pages) {
    for (const tag of page.tags) tags.add(tag);
  }
  const wordCount = pages.reduce((total, page) => total + page.wordCount, 0);
  const lastEditedAt = pages.reduce<Timestamp | null>(
    (latest, page) => (latest == null || page.lastEditedAt > latest ? page.lastEditedAt : latest),
    null,
  );
  return {
    pageCount: pages.length,
    wordCount,
    readingTimeMinutes: pages.reduce((total, page) => total + page.readingTimeMinutes, 0),
    lastEditedAt,
    tagCount: tags.size,
  };
}

export function notebookSummaries(state: AppState): NotebookSummary[] {
  return listNotebooks(state).map((notebook) => ({ notebook, ...notebookStats(state, notebook.id) }));
}

export function notebookTagIndex(state: AppState, notebookId: ID): string[] {
  const tags = new Set<string>();
  for (const page of listPages(state, notebookId)) {
    for (const tag of page.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function searchNotebookPages(
  state: AppState,
  notebookId: ID,
  query: string,
): Page[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return listPages(state, notebookId);
  return listPages(state, notebookId).filter((page) => {
    if (page.title.toLowerCase().includes(needle)) return true;
    if (page.searchVector.includes(needle)) return true;
    return page.tags.some((tag) => tag.toLowerCase().includes(needle));
  });
}

export function searchAllPages(state: AppState, query: string, limit = 20): Page[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  return Object.values(state.pages)
    .filter((page) => page.status !== "trashed")
    .filter(
      (page) =>
        page.title.toLowerCase().includes(needle) ||
        page.searchVector.includes(needle) ||
        page.tags.some((tag) => tag.toLowerCase().includes(needle)),
    )
    .sort((a, b) => b.lastEditedAt - a.lastEditedAt)
    .slice(0, limit);
}

export function reorderPages(state: AppState, notebookId: ID, orderedIds: ID[]): Page[] {
  const base = listPages(state, notebookId);
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  return base.sort((a, b) => {
    const left = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const right = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.order - b.order;
  });
}

export function nextPageOrder(state: AppState, notebookId: ID): Timestamp {
  const pages = listPages(state, notebookId);
  if (pages.length === 0) return Date.now();
  return Math.max(...pages.map((page) => page.order)) + 1;
}

export function orphanPages(state: AppState): Page[] {
  return Object.values(state.pages).filter(
    (page) => page.status !== "trashed" && !state.notebooks[page.notebookId],
  );
}