import type { EntityMeta, ID, Timestamp } from "./common";
import { newId } from "./common";

export type TimeBlockKind = "focus" | "meeting" | "routine" | "buffer" | "personal";
export type TimeBlockSource = "manual" | "ai";

export interface TimeBlock extends EntityMeta {
  type: "time_block";
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  kind: TimeBlockKind;
  taskId: ID | null;
  eventId: ID | null;
  completedAt: Timestamp | null;
  source: TimeBlockSource;
}

export interface NewTimeBlockInput {
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  kind?: TimeBlockKind;
  taskId?: ID | null;
  eventId?: ID | null;
  source?: TimeBlockSource;
}

export function createTimeBlock(input: NewTimeBlockInput, now: Timestamp = Date.now()): TimeBlock {
  return {
    type: "time_block",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: input.title.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    kind: input.kind ?? "focus",
    taskId: input.taskId ?? null,
    eventId: input.eventId ?? null,
    completedAt: null,
    source: input.source ?? "manual",
  };
}
