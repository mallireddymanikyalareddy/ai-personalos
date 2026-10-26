import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Notebook, Page } from "../../types/knowledge";
import { listNotebooks, listPages, notebookStats } from "./query";

export type NotebookView = "list" | "grid" | "timeline";
export type NotebookSort = "updated" | "created" | "title" | "words";

export interface NotebookNoteRow {
  id: ID;
  title: string;
  preview: string;
  tags: string[];
  notebookId: ID;
  notebookTitle: string;
  icon: string | null;
  color: string;
  wordCount: number;
  readingTimeMinutes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NotebookCollectionRow {
  id: ID | "all" | "templates" | "archived" | "trash";
  name: string;
  color: string;
  icon: string;
  count: number;
}

export interface NotebookTagRow {
  tag: string;
  count: number;
}

export interface NotebookWorkspaceData {
  rows: NotebookNoteRow[];
  collections: NotebookCollectionRow[];
  tags: NotebookTagRow[];
  recent: NotebookNoteRow[];
  stats: {
    notes: number;
    notebooks: number;
    words: number;
    readingTimeMinutes: number;
  };
}

export interface NotebookWorkspaceOptions {
  collectionId?: ID | "all" | "templates" | "archived" | "trash";
  tag?: string | null;
  query?: string;
  sort?: NotebookSort;
}

const COLLECTION_COLORS = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-8)",
];

export function notebookNotePreview(page: Page, length = 120): string {
  const text = page.body.trim().replace(/\s+/g, " ");
  if (text.length > 0) return text.slice(0, length);
  const blocks = page.blocks
    .map((block) => block.content)
    .filter(Boolean)
    .join(" ");
  return blocks.slice(0, length);
}

function toRow(page: Page, notebook: Notebook | undefined, index: number): NotebookNoteRow {
  return {
    id: page.id,
    title: page.title,
    preview: notebookNotePreview(page),
    tags: page.tags,
    notebookId: page.notebookId,
    notebookTitle: notebook?.title ?? "Notebook",
    icon: page.icon,
    color: notebook?.color ?? COLLECTION_COLORS[index % COLLECTION_COLORS.length]!,
    wordCount: page.wordCount,
    readingTimeMinutes: page.readingTimeMinutes,
    createdAt: page.createdAt,
    updatedAt: page.lastEditedAt || page.updatedAt,
  };
}

export function buildNotebookWorkspace(
  state: AppState,
  now: Timestamp,
  options: NotebookWorkspaceOptions = {},
): NotebookWorkspaceData {
  const collectionId = options.collectionId ?? "all";
  const sort = options.sort ?? "updated";
  const query = options.query?.trim().toLowerCase() ?? "";

  const notebooks = new Map<ID, Notebook>(
    listNotebooks(state, true).map((notebook) => [notebook.id, notebook]),
  );
  const allPages = Object.values(state.pages);
  const activePages = allPages.filter((page) => page.status !== "trashed");

  const counts = new Map<ID, number>();
  for (const page of activePages) {
    counts.set(page.notebookId, (counts.get(page.notebookId) ?? 0) + 1);
  }

  const collections: NotebookCollectionRow[] = [
    { id: "all", name: "All Notes", color: "var(--accent)", icon: "notebook", count: activePages.length },
  ];

  const activeNotebooks = listNotebooks(state, false);
  const grouped = new Map<string, Notebook[]>();
  for (const notebook of activeNotebooks) {
    const key = notebook.title.trim().toLowerCase();
    const list = grouped.get(key) ?? [];
    list.push(notebook);
    grouped.set(key, list);
  }

  const defaultIcons = [
    "notebook",
    "folder",
    "projects",
    "meeting notes",
    "ideas",
    "learning",
    "finance",
    "health",
    "travel",
    "journal",
    "reading",
    "templates",
  ];

  [...grouped.values()].forEach((group, index) => {
    const lead = group[0]!;
    const ids = new Set(group.map((notebook) => notebook.id));
    collections.push({
      id: lead.id,
      name: lead.title,
      color: lead.color ?? COLLECTION_COLORS[index % COLLECTION_COLORS.length]!,
      icon: lead.icon ?? defaultIcons[index % defaultIcons.length]!,
      count: activePages.filter((page) => ids.has(page.notebookId)).length,
    });
  });

  const archived = listNotebooks(state, true).filter((notebook) => notebook.status === "archived");
  if (archived.length > 0) {
    const archivedIds = new Set(archived.map((notebook) => notebook.id));
    collections.push({
      id: "archived",
      name: "Archived",
      color: "var(--ink-3)",
      icon: "archive",
      count: activePages.filter((page) => archivedIds.has(page.notebookId)).length,
    });
  }
  const trashed = allPages.filter((page) => page.status === "trashed");
  collections.push({
    id: "trash",
    name: "Trash",
    color: "var(--ink-3)",
    icon: "trash",
    count: trashed.length,
  });

  const tagCounts = new Map<string, number>();
  for (const page of activePages) {
    for (const tag of page.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const tags: NotebookTagRow[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  let scoped: Page[];
  if (collectionId === "trash") {
    scoped = trashed;
  } else if (collectionId === "archived") {
    const archivedIds = new Set(archived.map((notebook) => notebook.id));
    scoped = activePages.filter((page) => archivedIds.has(page.notebookId));
  } else if (collectionId === "all") {
    scoped = activePages;
  } else {
    const selected = notebooks.get(collectionId);
    const groupIds = new Set(
      selected != null
        ? listNotebooks(state, false)
            .filter((notebook) => notebook.title.trim().toLowerCase() === selected.title.trim().toLowerCase())
            .map((notebook) => notebook.id)
        : [collectionId],
    );
    scoped = activePages.filter((page) => groupIds.has(page.notebookId));
  }
  if (options.tag) scoped = scoped.filter((page) => page.tags.includes(options.tag!));
  if (query.length > 0) {
    scoped = scoped.filter((page) =>
      `${page.title} ${page.body} ${page.tags.join(" ")}`.toLowerCase().includes(query),
    );
  }

  const rows = scoped
    .map((page, index) => toRow(page, notebooks.get(page.notebookId), index))
    .sort((a, b) => {
      switch (sort) {
        case "created":
          return b.createdAt - a.createdAt;
        case "title":
          return a.title.localeCompare(b.title);
        case "words":
          return b.wordCount - a.wordCount;
        case "updated":
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

  const allNotebookIds = listNotebooks(state, false).map((notebook) => notebook.id);
  const stats = {
    notes: activePages.length,
    notebooks: allNotebookIds.length,
    words: allNotebookIds.reduce((sum, id) => sum + notebookStats(state, id).wordCount, 0),
    readingTimeMinutes: allNotebookIds.reduce(
      (sum, id) => sum + notebookStats(state, id).readingTimeMinutes,
      0,
    ),
  };

  const recent = activePages
    .map((page, index) => toRow(page, notebooks.get(page.notebookId), index))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  return { rows, collections, tags, recent, stats };
}
