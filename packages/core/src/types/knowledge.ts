import type { ID, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput, EntityRef } from "./base";
import { createCanonicalBase } from "./base";
import { newId } from "./common";
import type { NoteBlock } from "./note";
import type { RecurrenceRule } from "./task";

export type NotebookStatus = "active" | "archived";

export interface NewNotebookInput extends CanonicalInput {
  title: string;
  description?: string;
  color?: string | null;
  icon?: string | null;
  order?: number;
}

export interface Notebook extends CanonicalEntity {
  type: "notebook";
  title: string;
  description: string;
  color: string | null;
  icon: string | null;
  order: number;
  status: NotebookStatus;
  embedding: number[] | null;
  aiSummary: string | null;
}

export function createNotebook(input: NewNotebookInput, now: Timestamp = Date.now()): Notebook {
  return {
    ...createCanonicalBase(input, now),
    type: "notebook",
    title: input.title.trim(),
    description: input.description ?? "",
    color: input.color ?? null,
    icon: input.icon ?? null,
    order: input.order ?? now,
    status: "active",
    embedding: null,
    aiSummary: null,
  };
}

export type PageStatus = "draft" | "active" | "archived" | "trashed";

export type PageRefType =
  | "note"
  | "page"
  | "task"
  | "event"
  | "goal"
  | "habit"
  | "journal"
  | "life_memory"
  | "document"
  | "meeting";

export interface PageRef {
  type: PageRefType;
  id: ID;
  label: string;
}

export interface NewPageInput extends CanonicalInput {
  notebookId: ID;
  title: string;
  body?: string;
  blocks?: NoteBlock[];
  tags?: string[];
  folderId?: ID | null;
  order?: number;
  refs?: PageRef[];
}

export interface Page extends CanonicalEntity {
  type: "page";
  notebookId: ID;
  title: string;
  body: string;
  blocks: NoteBlock[];
  tags: string[];
  folderId: ID | null;
  icon: string | null;
  order: number;
  status: PageStatus;
  trashedAt: Timestamp | null;
  wordCount: number;
  readingTimeMinutes: number;
  searchVector: string;
  embedding: number[] | null;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiEntities: PageEntity[];
  relatedPageIds: ID[];
  refs: PageRef[];
  lastEditedAt: Timestamp;
}

export interface PageEntity {
  type: "person" | "project" | "date" | "location" | "organization" | "task" | "goal" | "concept";
  name: string;
  refId?: ID;
  confidence: number;
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

export function createPage(input: NewPageInput, now: Timestamp = Date.now()): Page {
  const blocks = input.blocks ?? [
    {
      id: newId(),
      type: "paragraph",
      content: input.body ?? "",
    },
  ];
  const wordCount = countWords(input.body ?? "");
  return {
    ...createCanonicalBase(input, now),
    type: "page",
    notebookId: input.notebookId,
    title: input.title.trim(),
    body: input.body ?? "",
    blocks,
    tags: input.tags ?? [],
    folderId: input.folderId ?? null,
    icon: null,
    order: input.order ?? now,
    status: "active",
    trashedAt: null,
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount),
    searchVector: `${input.title.trim()} ${extractSearchVector(blocks)}`.toLowerCase(),
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiEntities: [],
    relatedPageIds: [],
    refs: input.refs ?? [],
    lastEditedAt: now,
  };
}

export function updatePageBlocks(page: Page, blocks: NoteBlock[], now: Timestamp = Date.now()): Page {
  const wordCount = countWords(blocks.flatMap((b) => b.content).join(" "));
  return {
    ...page,
    blocks,
    body: blocks.flatMap((b) => b.content).join("\n"),
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount),
    searchVector: `${page.title.trim()} ${extractSearchVector(blocks)}`.toLowerCase(),
    updatedAt: now,
    lastEditedAt: now,
  };
}

export function movePageToTrash(page: Page, now: Timestamp = Date.now()): Page {
  return {
    ...page,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
  };
}

export function restorePage(page: Page, now: Timestamp = Date.now()): Page {
  return {
    ...page,
    status: "active",
    trashedAt: null,
    updatedAt: now,
  };
}

export function archivePage(page: Page, now: Timestamp = Date.now()): Page {
  return {
    ...page,
    status: "archived",
    updatedAt: now,
  };
}

export type DocumentSource = "upload" | "import" | "generated";

export type DocumentStatus = "processing" | "ready" | "failed" | "archived" | "trashed";

export interface NewDocumentInput extends CanonicalInput {
  title: string;
  mimeType: string;
  sizeBytes: number;
  source?: DocumentSource;
  url?: string | null;
  attachmentId?: ID | null;
  tags?: string[];
  folderId?: ID | null;
}

export interface Document extends CanonicalEntity {
  type: "document";
  title: string;
  mimeType: string;
  sizeBytes: number;
  source: DocumentSource;
  url: string | null;
  storageKey: string | null;
  attachmentId: ID | null;
  text: string;
  tags: string[];
  folderId: ID | null;
  status: DocumentStatus;
  trashedAt: Timestamp | null;
  pageCount: number;
  embedding: number[] | null;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiEntities: DocumentEntity[];
  relatedDocumentIds: ID[];
}

export interface DocumentEntity {
  type: "person" | "project" | "date" | "location" | "organization" | "concept";
  name: string;
  refId?: ID;
  confidence: number;
  pageNumber?: number;
}

export function createDocument(input: NewDocumentInput, now: Timestamp = Date.now()): Document {
  return {
    ...createCanonicalBase(input, now),
    type: "document",
    title: input.title.trim(),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    source: input.source ?? "upload",
    url: input.url ?? null,
    storageKey: null,
    attachmentId: input.attachmentId ?? null,
    text: "",
    tags: input.tags ?? [],
    folderId: input.folderId ?? null,
    status: "processing",
    trashedAt: null,
    pageCount: 0,
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiEntities: [],
    relatedDocumentIds: [],
  };
}

export function moveDocumentToTrash(doc: Document, now: Timestamp = Date.now()): Document {
  return {
    ...doc,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
  };
}

export function restoreDocument(doc: Document, now: Timestamp = Date.now()): Document {
  return {
    ...doc,
    status: "ready",
    trashedAt: null,
    updatedAt: now,
  };
}

export function archiveDocument(doc: Document, now: Timestamp = Date.now()): Document {
  return {
    ...doc,
    status: "archived",
    updatedAt: now,
  };
}

export type RecordingStatus = "recording" | "ready" | "failed" | "archived" | "trashed";

export interface NewRecordingInput extends CanonicalInput {
  title: string;
  startedAt: Timestamp;
  meetingId?: ID | null;
  mimeType?: string;
  status?: RecordingStatus;
  tags?: string[];
  folderId?: ID | null;
  url?: string | null;
}

export interface Recording extends CanonicalEntity {
  type: "recording";
  title: string;
  startedAt: Timestamp;
  endsAt: Timestamp | null;
  durationMs: number | null;
  mimeType: string;
  url: string | null;
  meetingId: ID | null;
  documentId: ID | null;
  tags: string[];
  folderId: ID | null;
  status: RecordingStatus;
  trashedAt: Timestamp | null;
  embedding: number[] | null;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiActionItems: string[];
  aiSpeakers: RecordingSpeaker[];
}

export interface RecordingSpeaker {
  id: string;
  name: string;
  durationMs: number;
  confidence: number;
}

export function createRecording(input: NewRecordingInput, now: Timestamp = Date.now()): Recording {
  return {
    ...createCanonicalBase(input, now),
    type: "recording",
    title: input.title.trim(),
    startedAt: input.startedAt,
    endsAt: null,
    durationMs: null,
    mimeType: input.mimeType ?? "audio/webm",
    url: input.url ?? null,
    meetingId: input.meetingId ?? null,
    documentId: null,
    tags: input.tags ?? [],
    folderId: input.folderId ?? null,
    status: input.status ?? "recording",
    trashedAt: null,
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiActionItems: [],
    aiSpeakers: [],
  };
}

export function moveRecordingToTrash(rec: Recording, now: Timestamp = Date.now()): Recording {
  return {
    ...rec,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
  };
}

export function restoreRecording(rec: Recording, now: Timestamp = Date.now()): Recording {
  return {
    ...rec,
    status: "ready",
    trashedAt: null,
    updatedAt: now,
  };
}

export function archiveRecording(rec: Recording, now: Timestamp = Date.now()): Recording {
  return {
    ...rec,
    status: "archived",
    updatedAt: now,
  };
}

export type TranscriptSource = "meeting" | "recording" | "upload";

export type TranscriptStatus = "processing" | "ready" | "failed" | "archived" | "trashed";

export interface TranscriptSegment {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface NewTranscriptInput extends CanonicalInput {
  title: string;
  source: TranscriptSource;
  meetingId?: ID | null;
  recordingId?: ID | null;
  language?: string;
  folderId?: ID | null;
}

export interface Transcript extends CanonicalEntity {
  type: "transcript";
  title: string;
  source: TranscriptSource;
  meetingId: ID | null;
  recordingId: ID | null;
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  confidence: number | null;
  folderId: ID | null;
  status: TranscriptStatus;
  trashedAt: Timestamp | null;
  embedding: number[] | null;
  aiSummary: string | null;
  aiKeyPoints: string[];
  aiActionItems: string[];
  aiDecisions: string[];
  aiEntities: TranscriptEntity[];
}

export interface TranscriptEntity {
  type: "person" | "project" | "date" | "location" | "organization" | "task" | "goal" | "concept";
  name: string;
  refId?: ID;
  confidence: number;
  segmentIndex?: number;
}

export function createTranscript(input: NewTranscriptInput, now: Timestamp = Date.now()): Transcript {
  return {
    ...createCanonicalBase(input, now),
    type: "transcript",
    title: input.title.trim(),
    source: input.source,
    meetingId: input.meetingId ?? null,
    recordingId: input.recordingId ?? null,
    language: input.language ?? "en",
    fullText: "",
    segments: [],
    confidence: null,
    folderId: input.folderId ?? null,
    status: "processing",
    trashedAt: null,
    embedding: null,
    aiSummary: null,
    aiKeyPoints: [],
    aiActionItems: [],
    aiDecisions: [],
    aiEntities: [],
  };
}

export function moveTranscriptToTrash(transcript: Transcript, now: Timestamp = Date.now()): Transcript {
  return {
    ...transcript,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
  };
}

export function restoreTranscript(transcript: Transcript, now: Timestamp = Date.now()): Transcript {
  return {
    ...transcript,
    status: "ready",
    trashedAt: null,
    updatedAt: now,
  };
}

export function archiveTranscript(transcript: Transcript, now: Timestamp = Date.now()): Transcript {
  return {
    ...transcript,
    status: "archived",
    updatedAt: now,
  };
}

export type MeetingStatus = "scheduled" | "completed" | "cancelled" | "archived";

export interface MeetingAttendee {
  id: ID;
  name: string;
  email: string;
}

export interface NewMeetingInput extends CanonicalInput {
  title: string;
  startsAt: Timestamp;
  endsAt?: Timestamp | null;
  notes?: string;
  attendeeIds?: ID[];
  attendees?: MeetingAttendee[];
  eventId?: ID | null;
  projectId?: ID | null;
  tags?: string[];
  recurrence?: RecurrenceRule | null;
  recurrenceId?: ID | null;
  recurrenceOrdinal?: number;
}

export interface Meeting extends CanonicalEntity {
  type: "meeting";
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp | null;
  notes: string;
  location: string;
  attendeeIds: ID[];
  attendees: MeetingAttendee[];
  eventId: ID | null;
  projectId: ID | null;
  tags: string[];
  recurrence: RecurrenceRule | null;
  recurrenceId: ID | null;
  recurrenceOrdinal: number;
  status: MeetingStatus;
  embedding: number[] | null;
  aiSummary: string | null;
  aiActionItems: string[];
  aiDecisions: string[];
  aiKeyPoints: string[];
}

export function createMeeting(input: NewMeetingInput, now: Timestamp = Date.now()): Meeting {
  return {
    ...createCanonicalBase(input, now),
    type: "meeting",
    title: input.title.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    notes: input.notes ?? "",
    location: "",
    attendeeIds: input.attendeeIds ?? [],
    attendees: input.attendees ?? [],
    eventId: input.eventId ?? null,
    projectId: input.projectId ?? null,
    tags: input.tags ?? [],
    recurrence: input.recurrence ?? null,
    recurrenceId: input.recurrenceId ?? null,
    recurrenceOrdinal: input.recurrenceOrdinal ?? 1,
    status: "scheduled",
    embedding: null,
    aiSummary: null,
    aiActionItems: [],
    aiDecisions: [],
    aiKeyPoints: [],
  };
}

export type ActionItemStatus = "open" | "converted" | "dismissed" | "done";

export interface NewActionItemInput extends CanonicalInput {
  title: string;
  transcriptId?: ID | null;
  meetingId?: ID | null;
  assigneeId?: ID | null;
  dueAt?: Timestamp | null;
  order?: number;
}

export interface ActionItem extends CanonicalEntity {
  type: "action_item";
  title: string;
  transcriptId: ID | null;
  meetingId: ID | null;
  taskId: ID | null;
  assigneeId: ID | null;
  dueAt: Timestamp | null;
  order: number;
  status: ActionItemStatus;
}

export function createActionItem(input: NewActionItemInput, now: Timestamp = Date.now()): ActionItem {
  return {
    ...createCanonicalBase(input, now),
    type: "action_item",
    title: input.title.trim(),
    transcriptId: input.transcriptId ?? null,
    meetingId: input.meetingId ?? null,
    taskId: null,
    assigneeId: input.assigneeId ?? null,
    dueAt: input.dueAt ?? null,
    order: input.order ?? now,
    status: "open",
  };
}

export type LifeMemoryKind = "observation" | "preference" | "pattern" | "milestone" | "relationship";

export type LifeMemoryStatus = "active" | "stale" | "forgotten";

export interface NewLifeMemoryInput extends CanonicalInput {
  kind: LifeMemoryKind;
  text: string;
  title?: string;
  confidence?: number;
  sourceRefs?: EntityRef[];
}

export interface LifeMemory extends CanonicalEntity {
  type: "life_memory";
  kind: LifeMemoryKind;
  title: string;
  text: string;
  confidence: number;
  sourceRefs: EntityRef[];
  reinforcedAt: Timestamp | null;
  decayedAt: Timestamp | null;
  status: LifeMemoryStatus;
  embedding: number[] | null;
  relatedMemoryIds: ID[];
  relatedNoteIds: ID[];
  relatedPageIds: ID[];
  relatedDocumentIds: ID[];
}

export function createLifeMemory(input: NewLifeMemoryInput, now: Timestamp = Date.now()): LifeMemory {
  return {
    ...createCanonicalBase({ ...input, origin: input.origin ?? "ai" }, now),
    type: "life_memory",
    kind: input.kind,
    title: input.title ?? "",
    text: input.text,
    confidence: input.confidence ?? 1,
    sourceRefs: input.sourceRefs ?? [],
    reinforcedAt: null,
    decayedAt: null,
    status: "active",
    embedding: null,
    relatedMemoryIds: [],
    relatedNoteIds: [],
    relatedPageIds: [],
    relatedDocumentIds: [],
  };
}

export type KnowledgeRelationshipType = "references" | "cites" | "contradicts" | "supports" | "extends" | "summarizes" | "derived_from" | "related_to";

export interface NewKnowledgeRelationshipInput extends CanonicalInput {
  sourceType: "note" | "page" | "document" | "transcript" | "journal_entry" | "life_memory";
  sourceId: ID;
  targetType: "note" | "page" | "document" | "transcript" | "journal_entry" | "life_memory";
  targetId: ID;
  type: KnowledgeRelationshipType;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeRelationship extends CanonicalEntity {
  type: "knowledge_relationship";
  sourceType: "note" | "page" | "document" | "transcript" | "journal_entry" | "life_memory";
  sourceId: ID;
  targetType: "note" | "page" | "document" | "transcript" | "journal_entry" | "life_memory";
  targetId: ID;
  relationshipType: KnowledgeRelationshipType;
  confidence: number;
  metadata: Record<string, unknown>;
}

export function createKnowledgeRelationship(
  input: NewKnowledgeRelationshipInput,
  now: Timestamp = Date.now(),
): KnowledgeRelationship {
  return {
    ...createCanonicalBase(input, now),
    type: "knowledge_relationship",
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    relationshipType: input.type,
    confidence: input.confidence,
    metadata: input.metadata ?? {},
  };
}