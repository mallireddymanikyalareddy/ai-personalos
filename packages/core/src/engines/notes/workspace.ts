import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Folder } from "../../types/folder";
import type { Goal } from "../../types/goal";
import type { Note, NoteBlock, NoteStatus } from "../../types/note";
import type { NewTaskInput } from "../../types/task";
import { createBlock, flattenBlocks } from "../notebook/blocks";
import { blocksToMarkdown } from "../notebook/markdown";

export type NoteSort = "updated" | "created" | "title" | "words";

export interface NoteListRow {
  id: ID;
  title: string;
  preview: string;
  tags: string[];
  icon: string | null;
  pinned: boolean;
  folderId: ID | null;
  folderName: string | null;
  folderColor: string;
  updatedAt: Timestamp;
  created: Timestamp;
  wordCount: number;
  readingTimeMinutes: number;
  blockCount: number;
  taskCount: number;
  checklist: { done: number; total: number };
  status: NoteStatus;
}

export interface NoteFolderRow {
  id: ID | "all" | "archive" | "trash";
  name: string;
  color: string;
  count: number;
}

export interface NoteTagRow {
  tag: string;
  count: number;
}

export interface NoteRelated {
  id: ID;
  title: string;
  type: "note" | "project" | "goal" | "task";
  href: string;
  meta: string | null;
}

export interface NoteDetail {
  id: ID;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  icon: string | null;
  pinned: boolean;
  status: NoteStatus;
  folderId: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  wordCount: number;
  readingTimeMinutes: number;
  checklist: { done: number; total: number };
  related: NoteRelated[];
  tasks: { id: ID; title: string; done: boolean }[];
  versions: { id: ID; at: Timestamp; title: string; wordCount: number; blockCount: number }[];
  backlinks: NoteListRow[];
}

export interface NotesWorkspace {
  rows: NoteListRow[];
  folders: NoteFolderRow[];
  tags: NoteTagRow[];
  counts: { all: number; archived: number; trashed: number; pinned: number };
  active: NoteDetail | null;
  folderName: string | null;
}

export interface NotesWorkspaceOptions {
  folderId?: ID | "all" | "archive" | "trash";
  tag?: string | null;
  query?: string;
  sort?: NoteSort;
  pinnedOnly?: boolean;
  activeId?: ID | null;
}

const ARCHIVED_COLOR = "var(--ink-3)";
const FOLDER_FALLBACK = [
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-8)",
  "var(--chart-1)",
];

export function notePreview(note: Note, length = 160): string {
  const text =
    note.body.trim().length > 0
      ? note.body
      : flattenBlocks(note.blocks)
          .map((entry) => entry.block.content)
          .join(" ");
  return text.trim().replace(/\s+/g, " ").slice(0, length);
}

export function folderColor(folder: Folder | undefined, index: number): string {
  return folder?.color ?? FOLDER_FALLBACK[index % FOLDER_FALLBACK.length]!;
}

function isActive(note: Note): boolean {
  return note.status === "active";
}

function isArchived(note: Note): boolean {
  return note.status === "archived";
}

function isTrashed(note: Note): boolean {
  return note.status === "trashed";
}

export function noteChecklist(note: Note): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const { block } of flattenBlocks(note.blocks)) {
    if (block.type !== "checkList") continue;
    total += 1;
    if (block.attrs?.checked === true) done += 1;
  }
  return { done, total };
}

/** Items that could become tasks: checklist entries first, then list entries. */
export function noteChecklistItems(note: Note): { id: string; text: string; checked: boolean }[] {
  const items: { id: string; text: string; checked: boolean }[] = [];
  for (const { block } of flattenBlocks(note.blocks)) {
    if (block.type !== "checkList") continue;
    const text = block.content.trim();
    if (text.length === 0) continue;
    items.push({ id: block.id, text, checked: block.attrs?.checked === true });
  }
  return items;
}

/** Candidate task titles from a note: checklist items, otherwise bullet/ordered items. */
export function noteTaskCandidates(note: Note): string[] {
  const checklist = noteChecklistItems(note).map((item) => item.text);
  if (checklist.length > 0) return checklist;
  const fromLists: string[] = [];
  for (const { block } of flattenBlocks(note.blocks)) {
    if (block.type !== "bulletList" && block.type !== "orderedList") continue;
    const text = block.content.trim();
    if (text.length > 0) fromLists.push(text);
  }
  if (fromLists.length > 0) return fromLists;
  return note.title.trim().length > 0 ? [note.title.trim()] : [];
}

export function noteToTaskInputs(note: Note): NewTaskInput[] {
  return noteTaskCandidates(note).map((title) => ({
    title,
    tags: note.tags,
    projectId: note.projectId,
    goalIds: note.goalIds,
    source: "ai",
  }));
}

/** Deterministic tidy: collapse spacing, fix punctuation spacing, capitalise sentences. */
export function tidyNoteText(text: string): string {
  const collapsed = text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
  const trimmed = collapsed
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
  return trimmed.replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

export function tidyNoteBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return blocks.map((block) => ({
    ...block,
    content: tidyNoteText(block.content),
    ...(block.children ? { children: tidyNoteBlocks(block.children) } : {}),
  }));
}

export function projectPlanBlocks(): NoteBlock[] {
  return [
    createBlock("heading", "Project plan"),
    createBlock("paragraph", "Outcome, scope and owners for this project."),
    createBlock("checkList", "Define the goal and success criteria"),
    createBlock("checkList", "List deliverables and owners"),
    createBlock("checkList", "Break each deliverable into tasks"),
    createBlock("checkList", "Set milestones and dates"),
    createBlock("checkList", "Identify risks and dependencies"),
  ];
}

/** Convert every bullet/ordered list into an actionable checklist. */
export function actionItemBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return blocks.map((block) => {
    if (block.type === "bulletList" || block.type === "orderedList") {
      return { ...block, type: "checkList" as const, attrs: { ...block.attrs, checked: false } };
    }
    return block;
  });
}

function relatedNotesFor(state: AppState, note: Note, limit = 4): NoteListRow[] {
  const tags = new Set(note.tags);
  if (tags.size === 0) return [];
  return Object.values(state.notes)
    .filter((other) => other.id !== note.id && isActive(other))
    .map((other) => ({
      other,
      shared: other.tags.filter((tag) => tags.has(tag)).length,
    }))
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.other.updatedAt - a.other.updatedAt)
    .slice(0, limit)
    .map((entry) => toRow(state, entry.other));
}

function backlinksFor(state: AppState, note: Note, limit = 6): NoteListRow[] {
  const title = note.title.trim().toLowerCase();
  if (title.length === 0) return [];
  const needle = `[[${title}]]`;
  return Object.values(state.notes)
    .filter((other) => other.id !== note.id && isActive(other))
    .filter((other) => {
      if (other.relatedNoteIds.includes(note.id)) return true;
      const text = `${other.title}\n${other.body}\n${other.blocks.map((block) => block.content).join(" ")}`.toLowerCase();
      return text.includes(needle);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((other) => toRow(state, other));
}

export function noteToMarkdown(note: Note): string {
  const parts: string[] = [`# ${note.title || "Untitled note"}`, ""];
  if (note.tags.length > 0) parts.push(note.tags.map((tag) => `#${tag}`).join(" "), "");
  const body = blocksToMarkdown(note.blocks).trim();
  if (body.length > 0) parts.push(body);
  parts.push("", `_Exported from LifeOS on ${new Date().toLocaleDateString()}_`);
  return parts.join("\n");
}

function toDetail(state: AppState, note: Note): NoteDetail {
  const project = note.projectId != null ? state.projects[note.projectId] : undefined;
  const goals = note.goalIds.map((id) => state.goals[id]).filter((goal): goal is Goal => goal != null);
  const tasks = note.taskIds
    .map((id) => state.tasks[id])
    .filter((task) => task != null)
    .map((task) => ({ id: task!.id, title: task!.title, done: task!.status === "done" }));

  const related: NoteRelated[] = [];
  if (project) {
    related.push({ id: project.id, title: project.name, type: "project", href: "/work", meta: "Project" });
  }
  for (const goal of goals) {
    related.push({ id: goal.id, title: goal.title, type: "goal", href: "/goals", meta: "Goal" });
  }
  const backlinks = backlinksFor(state, note);
  for (const row of relatedNotesFor(state, note)) {
    related.push({ id: row.id, title: row.title || "Untitled note", type: "note", href: "/notes", meta: "Note" });
  }

  return {
    id: note.id,
    title: note.title,
    blocks: note.blocks,
    tags: note.tags,
    icon: note.icon,
    pinned: note.pinned,
    status: note.status,
    folderId: note.folderId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    wordCount: note.wordCount,
    readingTimeMinutes: note.readingTimeMinutes,
    checklist: noteChecklist(note),
    related,
    tasks,
    versions: (note.versions ?? []).map((version) => ({
      id: version.id,
      at: version.at,
      title: version.title,
      wordCount: version.wordCount,
      blockCount: version.blocks.length,
    })),
    backlinks,
  };
}

function toRow(state: AppState, note: Note): NoteListRow {
  const folder = note.folderId != null ? state.folders[note.folderId] : undefined;
  const index = note.folderId != null ? Object.keys(state.folders).indexOf(note.folderId) : 0;
  return {
    id: note.id,
    title: note.title,
    preview: notePreview(note),
    tags: note.tags,
    icon: note.icon,
    pinned: note.pinned,
    folderId: note.folderId,
    folderName: folder?.name ?? null,
    folderColor: folder ? folderColor(folder, index) : "var(--chart-8)",
    updatedAt: note.updatedAt,
    created: note.createdAt,
    wordCount: note.wordCount,
    readingTimeMinutes: note.readingTimeMinutes,
    blockCount: flattenBlocks(note.blocks).length,
    taskCount: note.taskIds.length,
    checklist: noteChecklist(note),
    status: note.status,
  };
}

function compareRows(a: NoteListRow, b: NoteListRow, sort: NoteSort): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  switch (sort) {
    case "created":
      return b.created - a.created;
    case "title":
      return a.title.localeCompare(b.title);
    case "words":
      return b.wordCount - a.wordCount;
    case "updated":
    default:
      return b.updatedAt - a.updatedAt;
  }
}

export function buildNotesWorkspace(
  state: AppState,
  _now: Timestamp,
  options: NotesWorkspaceOptions = {},
): NotesWorkspace {
  const folderFilter = options.folderId ?? "all";
  const sort = options.sort ?? "updated";
  const query = options.query?.trim().toLowerCase() ?? "";

  const all = Object.values(state.notes);
  const active = all.filter(isActive);
  const archived = all.filter(isArchived);
  const trashed = all.filter(isTrashed);

  const folders: NoteFolderRow[] = [
    { id: "all", name: "All Notes", color: "var(--accent)", count: active.length },
    { id: "archive", name: "Archive", color: ARCHIVED_COLOR, count: archived.length },
    { id: "trash", name: "Trash", color: "var(--danger)", count: trashed.length },
  ];
  const folderOrder = Object.values(state.folders).filter((folder) => folder.status === "active");
  folderOrder.forEach((folder, index) => {
    folders.push({
      id: folder.id,
      name: folder.name,
      color: folderColor(folder, index),
      count: active.filter((note) => note.folderId === folder.id).length,
    });
  });

  const tagCounts = new Map<string, number>();
  for (const note of active) {
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tags: NoteTagRow[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const pool = folderFilter === "archive" ? archived : folderFilter === "trash" ? trashed : active;
  const scoped = pool
    .filter((note) => {
      if (folderFilter === "all" || folderFilter === "archive" || folderFilter === "trash") return true;
      return note.folderId === folderFilter;
    })
    .filter((note) => (options.tag ? note.tags.includes(options.tag) : true))
    .filter((note) => (options.pinnedOnly ? note.pinned : true))
    .filter((note) =>
      query.length === 0
        ? true
        : `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(query),
    );

  const rows = scoped.map((note) => toRow(state, note)).sort((a, b) => compareRows(a, b, sort));

  const activeNote = options.activeId != null ? state.notes[options.activeId] : undefined;
  const folderName =
    folderFilter === "all" || folderFilter === "archive"
      ? null
      : (state.folders[folderFilter]?.name ?? null);

  return {
    rows,
    folders,
    tags,
    counts: {
      all: active.length,
      archived: archived.length,
      trashed: trashed.length,
      pinned: active.filter((note) => note.pinned).length,
    },
    active: activeNote ? toDetail(state, activeNote) : null,
    folderName,
  };
}