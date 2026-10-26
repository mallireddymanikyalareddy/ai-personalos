import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";
import { DEFAULT_MODE, type Mode } from "./collaboration";

export type NoteSource = "manual" | "capture" | "ai" | "import" | "integration";

export type NoteStatus = "active" | "archived" | "trashed";

export interface NoteVersion {
  id: ID;
  at: Timestamp;
  title: string;
  blocks: NoteBlock[];
  wordCount: number;
}

export interface NoteBlock {
  id: string;
  type: "paragraph" | "heading" | "bulletList" | "orderedList" | "checkList" | "codeBlock" | "blockquote" | "image" | "audio" | "file" | "divider" | "callout" | "table";
  content: string;
  attrs?: Record<string, unknown>;
  children?: NoteBlock[];
}

export interface Note extends EntityMeta {
  type: "note";
  title: string;
  body: string;
  blocks: NoteBlock[];
  tags: string[];
  folderId: ID | null;
  notebookId: ID | null;
  projectId: ID | null;
  goalIds: ID[];
  taskIds: ID[];
  icon: string | null;
  pinned: boolean;
  source: NoteSource;
  status: NoteStatus;
  trashedAt: Timestamp | null;
  wordCount: number;
  readingTimeMinutes: number;
  searchVector: string;
  embedding: number[] | null;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiEntities: NoteEntity[];
  relatedNoteIds: ID[];
  versions: NoteVersion[];
  lastEditedAt: Timestamp;
  mode: Mode;
  sharedWith: ID[];
}

export interface NoteEntity {
  type: "person" | "project" | "date" | "location" | "organization" | "task" | "goal" | "concept";
  name: string;
  refId?: ID;
  confidence: number;
}

export interface NewNoteInput {
  title: string;
  body?: string;
  blocks?: NoteBlock[];
  tags?: string[];
  folderId?: ID | null;
  notebookId?: ID | null;
  projectId?: ID | null;
  goalIds?: ID[];
  taskIds?: ID[];
  icon?: string | null;
  pinned?: boolean;
  source?: NoteSource;
  status?: NoteStatus;
  mode?: Mode;
  sharedWith?: ID[];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}

function extractSearchVector(blocks: NoteBlock[]): string {
  const texts: string[] = [];
  for (const block of blocks) {
    if (block.content) texts.push(block.content);
    if (block.children) texts.push(...block.children.flatMap(extractTextFromBlock));
  }
  return texts.join(" ").toLowerCase();
}

function extractTextFromBlock(block: NoteBlock): string {
  const texts: string[] = [];
  if (block.content) texts.push(block.content);
  if (block.children) {
    for (const child of block.children) {
      texts.push(...extractTextFromBlock(child).split(" "));
    }
  }
  return texts.join(" ");
}

export function createNote(input: NewNoteInput, now: Timestamp = Date.now()): Note {
  const blocks = input.blocks ?? [
    {
      id: newId(),
      type: "paragraph",
      content: input.body ?? "",
    },
  ];
  const wordCount = countWords(input.body ?? "");
  return {
    type: "note",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    body: input.body ?? "",
    blocks,
    tags: input.tags ?? [],
    folderId: input.folderId ?? null,
    notebookId: input.notebookId ?? null,
    projectId: input.projectId ?? null,
    goalIds: input.goalIds ?? [],
    taskIds: input.taskIds ?? [],
    icon: input.icon ?? null,
    pinned: input.pinned ?? false,
    source: input.source ?? "manual",
    status: input.status ?? "active",
    trashedAt: null,
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount),
    searchVector: `${input.title.trim()} ${extractSearchVector(blocks)}`.toLowerCase(),
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiEntities: [],
    relatedNoteIds: [],
    versions: [],
    lastEditedAt: now,
    mode: input.mode ?? DEFAULT_MODE,
    sharedWith: input.sharedWith ?? [],
  };
}

export function updateNoteBlocks(note: Note, blocks: NoteBlock[], now: Timestamp = Date.now()): Note {
  const wordCount = countWords(blocks.flatMap((b) => b.content).join(" "));
  const previous = note.versions ?? [];
  const changed = JSON.stringify(note.blocks) !== JSON.stringify(blocks);
  const versions = changed
    ? [
        {
          id: newId(),
          at: note.updatedAt,
          title: note.title,
          blocks: note.blocks,
          wordCount: note.wordCount,
        },
        ...previous,
      ].slice(0, 20)
    : previous;
  return {
    ...note,
    blocks,
    versions,
    body: blocks.flatMap((b) => b.content).join("\n"),
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount),
    searchVector: `${note.title.trim()} ${extractSearchVector(blocks)}`.toLowerCase(),
    updatedAt: now,
    lastEditedAt: now,
  };
}

export function moveNoteToTrash(note: Note, now: Timestamp = Date.now()): Note {
  return {
    ...note,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
  };
}

export function restoreNote(note: Note, now: Timestamp = Date.now()): Note {
  return {
    ...note,
    status: "active",
    trashedAt: null,
    updatedAt: now,
  };
}

export function archiveNote(note: Note, now: Timestamp = Date.now()): Note {
  return {
    ...note,
    status: "archived",
    updatedAt: now,
  };
}

export function unarchiveNote(note: Note, now: Timestamp = Date.now()): Note {
  return {
    ...note,
    status: "active",
    updatedAt: now,
  };
}