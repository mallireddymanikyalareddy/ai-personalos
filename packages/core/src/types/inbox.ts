import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";
import type { ID, Timestamp } from "./common";
import { newId } from "./common";

export type InboxItemStatus = "new" | "processing" | "triaged" | "archived";

export type InboxItemKind = "note" | "document" | "recording" | "web_clip" | "email" | "capture";

export interface NewInboxItemInput extends CanonicalInput {
  kind: InboxItemKind;
  title: string;
  content?: string;
  sourceUrl?: string | null;
  sourceMetadata?: Record<string, unknown>;
  tags?: string[];
  noteId?: ID | null;
  documentId?: ID | null;
  recordingId?: ID | null;
}

export interface InboxItem extends CanonicalEntity {
  type: "inbox_item";
  kind: InboxItemKind;
  title: string;
  content: string;
  sourceUrl: string | null;
  sourceMetadata: Record<string, unknown>;
  tags: string[];
  noteId: ID | null;
  documentId: ID | null;
  recordingId: ID | null;
  status: InboxItemStatus;
  triagedAt: Timestamp | null;
  aiSuggestedTags: string[];
  aiSuggestedFolderId: ID | null;
  aiSuggestedNotebookId: ID | null;
}

export function createInboxItem(input: NewInboxItemInput, now: Timestamp = Date.now()): InboxItem {
  return {
    ...createCanonicalBase(input, now),
    type: "inbox_item",
    kind: input.kind,
    title: input.title.trim(),
    content: input.content ?? "",
    sourceUrl: input.sourceUrl ?? null,
    sourceMetadata: input.sourceMetadata ?? {},
    tags: input.tags ?? [],
    noteId: input.noteId ?? null,
    documentId: input.documentId ?? null,
    recordingId: input.recordingId ?? null,
    status: "new",
    triagedAt: null,
    aiSuggestedTags: [],
    aiSuggestedFolderId: null,
    aiSuggestedNotebookId: null,
  };
}

export function triageInboxItem(item: InboxItem, now: Timestamp = Date.now()): InboxItem {
  return {
    ...item,
    status: "triaged",
    triagedAt: now,
    updatedAt: now,
  } as InboxItem;
}

export function archiveInboxItem(item: InboxItem, now: Timestamp = Date.now()): InboxItem {
  return {
    ...item,
    status: "archived",
    updatedAt: now,
  } as InboxItem;
}