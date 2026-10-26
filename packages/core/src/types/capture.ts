import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";

export const CAPTURE_TYPES = [
  "task",
  "note",
  "voice",
  "image",
  "document",
  "goal",
  "habit",
  "event",
  "meeting",
] as const;

export type CaptureType = (typeof CAPTURE_TYPES)[number];

export type CaptureMode = "ai" | CaptureType;

export type CaptureSource = "text" | "voice" | "image" | "camera" | "document" | "quick";

export type CaptureAttachmentKind = "image" | "audio" | "document";

export interface CaptureAttachment {
  id: ID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: CaptureAttachmentKind;
  url: string | null;
}

export type CaptureStatus = "created" | "duplicate";

export type RoutedEntityType =
  | "task"
  | "note"
  | "goal"
  | "habit"
  | "event"
  | "meeting"
  | "document"
  | "recording";

export interface CaptureLog extends EntityMeta {
  type: "capture";
  mode: CaptureMode;
  source: CaptureSource;
  raw: string | null;
  title: string;
  entityType: RoutedEntityType | null;
  entityId: ID | null;
  duplicateOfType: RoutedEntityType | null;
  duplicateOfId: ID | null;
  status: CaptureStatus;
  attachments: CaptureAttachment[];
  confidence: number | null;
}

export interface NewCaptureLogInput {
  mode: CaptureMode;
  source: CaptureSource;
  raw: string | null;
  title: string;
  entityType?: RoutedEntityType | null;
  entityId?: ID | null;
  duplicateOfType?: RoutedEntityType | null;
  duplicateOfId?: ID | null;
  status?: CaptureStatus;
  attachments?: CaptureAttachment[];
  confidence?: number | null;
}

export function createCaptureLog(input: NewCaptureLogInput, now: Timestamp = Date.now()): CaptureLog {
  return {
    type: "capture",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    mode: input.mode,
    source: input.source,
    raw: input.raw,
    title: input.title,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    duplicateOfType: input.duplicateOfType ?? null,
    duplicateOfId: input.duplicateOfId ?? null,
    status: input.status ?? "created",
    attachments: input.attachments ?? [],
    confidence: input.confidence ?? null,
  };
}