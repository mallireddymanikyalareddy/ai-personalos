import type { AppState } from "../../store/state";
import type { PageRef, PageRefType, Page } from "../../types/knowledge";

import { blocksText } from "./blocks";

const REF_TYPES: PageRefType[] = [
  "note",
  "page",
  "task",
  "event",
  "goal",
  "habit",
  "journal",
  "life_memory",
  "document",
  "meeting",
];

export const PAGE_REF_PATTERN = /\[\[([a-z_]+):([A-Za-z0-9_-]+)(?:\|([^\]]*))?\]\]/g;

export function isPageRefType(value: string): value is PageRefType {
  return (REF_TYPES as string[]).includes(value);
}

export function parseMentions(text: string): PageRef[] {
  const refs: PageRef[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(PAGE_REF_PATTERN)) {
    const [, type, id, label] = match;
    if (!isPageRefType(type)) continue;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ type, id, label: label?.trim() ?? "" });
  }
  return refs;
}

export function mentionText(ref: PageRef): string {
  return ref.label.length > 0 ? `[[${ref.type}:${ref.id}|${ref.label}]]` : `[[${ref.type}:${ref.id}]]`;
}

export function pageRefKeys(page: Page): Set<string> {
  const keys = new Set<string>();
  for (const ref of page.refs ?? []) {
    keys.add(`${ref.type}:${ref.id}`);
  }
  for (const ref of parseMentions(page.blocks.map((block) => block.content).join("\n"))) {
    keys.add(`${ref.type}:${ref.id}`);
  }
  for (const id of page.relatedPageIds ?? []) {
    keys.add(`page:${id}`);
  }
  return keys;
}

export function pageLinks(page: Page): PageRef[] {
  const byKey = new Map<string, PageRef>();
  for (const ref of page.refs ?? []) {
    byKey.set(`${ref.type}:${ref.id}`, ref);
  }
  const text = blocksText(page.blocks);
  for (const ref of parseMentions(text)) {
    const key = `${ref.type}:${ref.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ref);
    } else if (existing.label.length === 0 && ref.label.length > 0) {
      byKey.set(key, { ...existing, label: ref.label });
    }
  }
  for (const id of page.relatedPageIds ?? []) {
    const key = `page:${id}`;
    if (!byKey.has(key)) byKey.set(key, { type: "page", id, label: "" });
  }
  return [...byKey.values()];
}

export function pagesLinkingTo(state: AppState, target: { type: PageRefType; id: string }): Page[] {
  const key = `${target.type}:${target.id}`;
  return Object.values(state.pages)
    .filter((page) => page.status !== "trashed")
    .filter((page) => pageRefKeys(page).has(key));
}

export function notesLinkingToPage(state: AppState, pageId: string): string[] {
  return Object.values(state.notes)
    .filter((note) => note.status !== "trashed")
    .filter((note) => note.notebookId === pageId || parseMentions(`${note.title}\n${note.body}`).some((ref) => ref.type === "page" && ref.id === pageId))
    .map((note) => note.id);
}

export function outgoingRefs(state: AppState, page: Page): Array<PageRef & { title: string }> {
  return pageLinks(page)
    .map((ref) => ({ ...ref, title: resolveRefTitle(state, ref) }))
    .filter((ref) => ref.title.length > 0);
}

export function resolveRefTitle(state: AppState, ref: PageRef): string {
  if (ref.label.trim().length > 0) return ref.label.trim();
  switch (ref.type) {
    case "note":
      return state.notes[ref.id]?.title ?? "";
    case "page":
      return state.pages[ref.id]?.title ?? "";
    case "task":
      return state.tasks[ref.id]?.title ?? "";
    case "event":
      return state.events[ref.id]?.title ?? "";
    case "goal":
      return state.goals[ref.id]?.title ?? "";
    case "habit":
      return state.habits[ref.id]?.title ?? "";
    case "document":
      return state.documents[ref.id]?.title ?? "";
    case "meeting":
      return state.meetings[ref.id]?.title ?? "";
    case "life_memory":
      return state.lifeMemories[ref.id]?.title || state.lifeMemories[ref.id]?.text.slice(0, 60) || "";
    case "journal":
      return state.journalEntries[ref.id]?.title ?? "";
    default:
      return "";
  }
}

export function refHref(ref: PageRef): string | null {
  switch (ref.type) {
    case "note":
      return `/notes/${ref.id}`;
    case "page":
      return `/notebook/page/${ref.id}`;
    case "task":
      return `/tasks?focus=${ref.id}`;
    case "event":
      return `/calendar?focus=${ref.id}`;
    case "goal":
      return `/goals?focus=${ref.id}`;
    case "habit":
      return `/habits?focus=${ref.id}`;
    case "document":
      return `/notebook?document=${ref.id}`;
    case "meeting":
      return `/meetings?focus=${ref.id}`;
    case "life_memory":
      return `/memory/entries/${ref.id}`;
    case "journal":
      return `/journal?day=${ref.id}`;
    default:
      return null;
  }
}

export function pageRefSuggestions(state: AppState, query: string, limit = 6): PageRef[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const out: PageRef[] = [];

  const push = (type: PageRefType, id: string, title: string) => {
    if (out.length >= limit) return;
    if (title.toLowerCase().includes(needle)) out.push({ type, id, label: title });
  };

  for (const note of Object.values(state.notes)) {
    if (note.status === "trashed") continue;
    push("note", note.id, note.title);
  }
  for (const page of Object.values(state.pages)) {
    if (page.status === "trashed") continue;
    push("page", page.id, page.title);
  }
for (const task of Object.values(state.tasks)) {
    if (task.status === "archived" || task.status === "cancelled" || task.status === "done") continue;
    push("task", task.id, task.title);
  }
  return out.slice(0, limit);
}
