import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { PaperFolder, PaperNotebook, PaperPage, PaperPageKind } from "../../types/paper";
import { countPaperWords } from "../../types/paper";

export type PaperView = "all" | "recent" | "favorites" | "shared";
export type PaperSort = "updated" | "created" | "title" | "words";

export interface PaperPageRow {
  id: ID;
  name: string;
  kind: PaperPageKind;
  notebookId: ID;
  notebookTitle: string;
  folderId: ID | null;
  folderName: string | null;
  folderColor: string;
  folderIcon: string;
  tags: string[];
  favorite: boolean;
  shared: boolean;
  preview: string;
  textContent: string;
  wordCount: number;
  strokeCount: number;
  paperColor: string;
  template: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaperFolderRow {
  id: ID | "all" | "trash";
  name: string;
  color: string;
  icon: string;
  count: number;
}

export interface PaperTagRow {
  tag: string;
  count: number;
}

export interface PaperStats {
  pages: number;
  notebooks: number;
  handwritten: number;
  typed: number;
  templates: number;
  scans: number;
  favorites: number;
  words: number;
}

export interface PaperWorkspace {
  rows: PaperPageRow[];
  folders: PaperFolderRow[];
  tags: PaperTagRow[];
  stats: PaperStats;
  recent: PaperPageRow[];
}

export interface PaperWorkspaceOptions {
  folderId?: ID | "all" | "trash";
  tag?: string | null;
  query?: string;
  sort?: PaperSort;
  view?: PaperView;
}

const FOLDER_COLORS = [
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-8)",
];

export function paperPreview(page: PaperPage, length = 120): string {
  const text = page.textContent.trim().replace(/\s+/g, " ");
  if (text.length > 0) return text.slice(0, length);
  return "";
}

/** Rewrites a passage into plainer language: drops filler words and long clauses. */
export function plainLanguageText(text: string): string {
  return text
    .replace(/\b(basically|actually|literally|simply|really|very|just|obviously|essentially)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\bwe are going to\b/gi, (match) => (match[0] === "W" ? "We'll" : "we'll"))
    .replace(/\bit is important to note that\b/gi, "")
    .replace(/\bin order to\b/gi, "to")
    .trim();
}

function pageKindLabel(kind: PaperPageKind): string {
  switch (kind) {
    case "handwritten":
      return "Handwritten";
    case "typed":
      return "Typed document";
    case "template":
      return "Template";
    case "scan":
      return "Scanned file";
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
  }
}

export { pageKindLabel };

function sortRows(rows: PaperPageRow[], sort: PaperSort): PaperPageRow[] {
  return [...rows].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    switch (sort) {
      case "created":
        return b.createdAt - a.createdAt;
      case "title":
        return a.name.localeCompare(b.name);
      case "words":
        return b.wordCount - a.wordCount;
      case "updated":
      default:
        return b.updatedAt - a.updatedAt;
    }
  });
}

export function buildPaperWorkspace(
  state: AppState,
  now: Timestamp,
  options: PaperWorkspaceOptions = {},
): PaperWorkspace {
  const folderFilter = options.folderId ?? "all";
  const view = options.view ?? "all";
  const sort = options.sort ?? "updated";
  const query = options.query?.trim().toLowerCase() ?? "";

  const notebooks = new Map<ID, PaperNotebook>(
    Object.values(state.paperNotebooks).map((notebook) => [notebook.id, notebook]),
  );
  const folders = new Map<ID, PaperFolder>(
    Object.values(state.paperFolders ?? {}).map((folder) => [folder.id, folder]),
  );

  const allPages = Object.values(state.paperPages);
  const active = allPages.filter((page) => page.status === "active");
  const trashed = allPages.filter((page) => page.status === "trashed");

  const toRow = (page: PaperPage): PaperPageRow => {
    const notebook = notebooks.get(page.notebookId);
    const folder = page.folderId != null ? folders.get(page.folderId) : undefined;
    const strokes = Object.values(state.paperStrokes).filter((stroke) => stroke.pageId === page.id);
    return {
      id: page.id,
      name: page.name,
      kind: page.kind,
      notebookId: page.notebookId,
      notebookTitle: notebook?.title ?? "Notebook",
      folderId: page.folderId,
      folderName: folder?.name ?? null,
      folderColor: folder?.color ?? "var(--chart-8)",
      folderIcon: folder?.icon ?? "folder",
      tags: page.tags,
      favorite: page.favorite,
      shared: page.shared,
      preview: paperPreview(page),
      textContent: page.textContent,
      wordCount: page.wordCount,
      strokeCount: strokes.length,
      paperColor: page.paperColor,
      template: page.template,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  };

  const activeRows = active.map(toRow);

  const folderRows: PaperFolderRow[] = [
    { id: "all", name: "All Pages", color: "var(--accent)", icon: "layers", count: active.length },
  ];
  [...folders.values()]
    .filter((folder) => folder.status === "active")
    .sort((a, b) => a.order - b.order)
    .forEach((folder, index) => {
      folderRows.push({
        id: folder.id,
        name: folder.name,
        color: folder.color ?? FOLDER_COLORS[index % FOLDER_COLORS.length]!,
        icon: folder.icon ?? "folder",
        count: active.filter((page) => page.folderId === folder.id).length,
      });
    });
  folderRows.push({
    id: "trash",
    name: "Trash",
    color: "var(--ink-3)",
    icon: "trash",
    count: trashed.length,
  });

  const tagCounts = new Map<string, number>();
  for (const page of active) {
    for (const tag of page.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const tagRows: PaperTagRow[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  let scoped = activeRows;
  if (folderFilter === "trash") {
    scoped = trashed.map(toRow);
  } else if (folderFilter !== "all") {
    scoped = scoped.filter((row) => row.folderId === folderFilter);
  }
  if (view === "favorites") scoped = scoped.filter((row) => row.favorite);
  if (view === "shared") scoped = scoped.filter((row) => row.shared);
  if (options.tag) scoped = scoped.filter((row) => row.tags.includes(options.tag!));
  if (query.length > 0) {
    scoped = scoped.filter((row) =>
      `${row.name} ${row.preview} ${row.tags.join(" ")} ${row.notebookTitle}`.toLowerCase().includes(query),
    );
  }

  const stats: PaperStats = {
    pages: active.length,
    notebooks: notebooks.size,
    handwritten: active.filter((page) => page.kind === "handwritten").length,
    typed: active.filter((page) => page.kind === "typed").length,
    templates: active.filter((page) => page.kind === "template").length,
    scans: active.filter((page) => page.kind === "scan" || page.kind === "pdf" || page.kind === "image").length,
    favorites: active.filter((page) => page.favorite).length,
    words: active.reduce((sum, page) => sum + page.wordCount, 0),
  };

  return {
    rows: sortRows(scoped, sort),
    folders: folderRows,
    tags: tagRows,
    stats,
    recent: sortRows(activeRows, "updated").slice(0, 5),
  };
}

export function pageWords(text: string): number {
  return countPaperWords(text);
}
