import type { EntityMeta, EntityType, ID, Timestamp } from "./common";
import { newId } from "./common";

export type LifeMemoryCategory =
  | "home"
  | "vehicle"
  | "health"
  | "appliance"
  | "garden"
  | "pet"
  | "finance"
  | "document"
  | "other";

export const LIFE_MEMORY_CATEGORIES: readonly LifeMemoryCategory[] = [
  "home",
  "vehicle",
  "health",
  "appliance",
  "garden",
  "pet",
  "finance",
  "document",
  "other",
];

export const LIFE_MEMORY_CATEGORY_LABELS: Record<LifeMemoryCategory, string> = {
  home: "Home",
  vehicle: "Vehicle",
  health: "Health",
  appliance: "Appliance",
  garden: "Garden",
  pet: "Pet",
  finance: "Finance",
  document: "Document",
  other: "Other",
};

export type LifeMemoryItemStatus = "active" | "archived" | "trashed";

export interface LifeMemoryOccurrence {
  id: ID;
  completedAt: Timestamp;
  note: string;
  attachmentIds: ID[];
  createdAt: Timestamp;
}

export interface NewLifeMemoryOccurrenceInput {
  completedAt: Timestamp;
  note?: string;
  attachmentIds?: ID[];
}

export interface LifeMemoryItem extends EntityMeta {
  type: "life_memory_item";
  title: string;
  description: string;
  category: LifeMemoryCategory;
  tags: string[];
  targetIntervalDays: number | null;
  thresholdDays: number;
  notes: string;
  lastCompletedAt: Timestamp | null;
  history: LifeMemoryOccurrence[];
  status: LifeMemoryItemStatus;
  trashedAt: Timestamp | null;
  searchVector: string;
  embedding: number[] | null;
  linkedGoalIds: ID[];
}

export interface NewLifeMemoryItemInput {
  title: string;
  description?: string;
  category?: LifeMemoryCategory;
  tags?: string[];
  targetIntervalDays?: number | null;
  thresholdDays?: number;
  notes?: string;
  linkedGoalIds?: ID[];
  firstCompletionAt?: Timestamp | null;
  firstCompletionNote?: string;
  firstCompletionAttachmentIds?: ID[];
}

export const LIFE_MEMORY_ENTITY_TYPE: EntityType = "life_memory_item";

export const DEFAULT_LIFE_MEMORY_THRESHOLD_DAYS = 14;

export function createLifeMemoryItem(
  input: NewLifeMemoryItemInput,
  now: Timestamp = Date.now(),
): LifeMemoryItem {
  const history: LifeMemoryOccurrence[] = [];
  let lastCompletedAt: Timestamp | null = null;

  if (input.firstCompletionAt != null) {
    lastCompletedAt = input.firstCompletionAt;
    history.push({
      id: newId(),
      completedAt: input.firstCompletionAt,
      note: input.firstCompletionNote ?? "",
      attachmentIds: input.firstCompletionAttachmentIds ?? [],
      createdAt: now,
    });
  }

  const searchVector = `${input.title.trim()} ${input.description ?? ""} ${(input.tags ?? []).join(" ")}`.toLowerCase();

  return {
    type: "life_memory_item",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    description: input.description ?? "",
    category: input.category ?? "other",
    tags: input.tags ?? [],
    targetIntervalDays: input.targetIntervalDays ?? null,
    thresholdDays: input.thresholdDays ?? DEFAULT_LIFE_MEMORY_THRESHOLD_DAYS,
    notes: input.notes ?? "",
    lastCompletedAt,
    history,
    status: "active",
    trashedAt: null,
    searchVector,
    embedding: null,
    linkedGoalIds: input.linkedGoalIds ?? [],
  };
}

export function addOccurrence(
  item: LifeMemoryItem,
  input: NewLifeMemoryOccurrenceInput,
  now: Timestamp = Date.now(),
): LifeMemoryItem {
  const occurrence: LifeMemoryOccurrence = {
    id: newId(),
    completedAt: input.completedAt,
    note: input.note ?? "",
    attachmentIds: input.attachmentIds ?? [],
    createdAt: now,
  };

  const history = [...item.history, occurrence].sort((a, b) => a.completedAt - b.completedAt);
  const lastCompletedAt = history.length > 0 ? history[history.length - 1]!.completedAt : null;
  const notes = input.note && input.note.trim() ? appendNote(item.notes, input.note.trim(), now) : item.notes;

  return {
    ...item,
    history,
    lastCompletedAt,
    notes,
    updatedAt: now,
  };
}

function appendNote(notes: string, note: string, now: Timestamp): string {
  const stamp = new Date(now).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const entry = `${stamp} — ${note}`;
  return notes.trim().length === 0 ? entry : `${notes.trim()}\n\n${entry}`;
}

export function removeOccurrence(
  item: LifeMemoryItem,
  occurrenceId: ID,
  now: Timestamp = Date.now(),
): LifeMemoryItem {
  const history = item.history.filter((occurrence) => occurrence.id !== occurrenceId);
  const lastCompletedAt = history.length > 0 ? history[history.length - 1]!.completedAt : null;
  return { ...item, history, lastCompletedAt, updatedAt: now };
}

export function moveLifeMemoryItemToTrash(item: LifeMemoryItem, now: Timestamp = Date.now()): LifeMemoryItem {
  return { ...item, status: "trashed", trashedAt: now, updatedAt: now };
}

export function restoreLifeMemoryItem(item: LifeMemoryItem, now: Timestamp = Date.now()): LifeMemoryItem {
  return { ...item, status: "active", trashedAt: null, updatedAt: now };
}

export function archiveLifeMemoryItem(item: LifeMemoryItem, now: Timestamp = Date.now()): LifeMemoryItem {
  return { ...item, status: "archived", updatedAt: now };
}

export function unarchiveLifeMemoryItem(item: LifeMemoryItem, now: Timestamp = Date.now()): LifeMemoryItem {
  return { ...item, status: "active", updatedAt: now };
}

export function isActiveLifeMemoryItem(item: LifeMemoryItem): boolean {
  return item.status === "active";
}
