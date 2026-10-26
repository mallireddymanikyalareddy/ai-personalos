import type { AppState } from "../../store/state";
import type { Store } from "../../store/store";
import { MINUTE_MS } from "../date-utils";
import { plannedStatus } from "../task-engine";
import {
  createCaptureLog,
  type CaptureAttachment,
  type CaptureLog,
  type CaptureMode,
  type CaptureSource,
  type CaptureType,
  type RoutedEntityType,
} from "../../types/capture";
import type { ID, Timestamp } from "../../types/common";
import type { Mode } from "../../types/collaboration";
import { createEvent, type CalendarEvent } from "../../types/event";
import { createGoal, type Goal } from "../../types/goal";
import { createHabit, type Habit } from "../../types/habit";
import {
  createDocument,
  createMeeting,
  createRecording,
  type Document,
  type Meeting,
  type Recording,
} from "../../types/knowledge";
import { createNote, type Note } from "../../types/note";
import { createTask, type Task } from "../../types/task";
import { createAttachment } from "../../types/attachment";
import type { ResolvedCapture } from "./resolver";
import { findDuplicate, findRecentCapture } from "./dedupe";

export type CapturedEntity =
  | Task
  | Note
  | Goal
  | Habit
  | CalendarEvent
  | Meeting
  | Document
  | Recording;

export interface CaptureDraft extends Omit<ResolvedCapture, "raw"> {
  raw: string | null;
  source: CaptureSource;
  workspaceMode?: Mode;
  attachments?: CaptureAttachment[];
}

export interface CaptureOutcome {
  status: "created" | "duplicate" | "empty";
  entityType: RoutedEntityType | null;
  entity: CapturedEntity | null;
  log: CaptureLog | null;
  duplicateOf: { entityType: RoutedEntityType; entityId: ID; title: string } | null;
}

function routeType(type: CaptureType): RoutedEntityType {
  if (type === "voice") return "recording";
  if (type === "image") return "note";
  return type;
}

function nextSlot(now: Timestamp): Timestamp {
  const date = new Date(now + MINUTE_MS);
  date.setSeconds(0, 0);
  const minute = date.getMinutes();
  if (minute % 30 !== 0) date.setMinutes(Math.ceil(minute / 30) * 30);
  return date.getTime();
}

function attachFiles(
  store: Store,
  ownerType: RoutedEntityType,
  ownerId: ID,
  attachments: CaptureAttachment[],
  now: Timestamp,
): void {
  for (const attachment of attachments) {
    const entity = createAttachment(
      {
        ownerType,
        ownerId,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        source: "upload",
        url: attachment.url,
      },
      now,
    );
    store.insert("attachments", entity);
  }
}

export function applyCapture(
  store: Store,
  draft: CaptureDraft,
  now: Timestamp = Date.now(),
): CaptureOutcome {
  const state = store.getState();
  const raw = draft.raw ?? draft.title;
  const attachments = draft.attachments ?? [];

  if (!draft.title && !raw && attachments.length === 0) {
    return { status: "empty", entityType: null, entity: null, log: null, duplicateOf: null };
  }

  const recent = findRecentCapture(state, raw, now);
  if (recent && (recent.entityId || recent.duplicateOfId)) {
    const source = recent.entityId ? recent : null;
    const duplicateSource = recent.duplicateOfId
      ? {
          entityType: recent.duplicateOfType ?? "task",
          entityId: recent.duplicateOfId,
          title: recent.title,
        }
      : null;
    return {
      status: "duplicate",
      entityType: source?.entityType ?? duplicateSource?.entityType ?? null,
      entity: null,
      log: recent,
      duplicateOf: duplicateSource ?? {
        entityType: source?.entityType ?? "task",
        entityId: source?.entityId ?? "",
        title: recent.title,
      },
    };
  }

  const routed = routeType(draft.type);
  const dup = findDuplicate(state, routed, draft.title);
  if (dup.duplicate) {
    const log = createCaptureLog(
      {
        mode: draft.mode,
        source: draft.source,
        raw,
        title: draft.title,
        duplicateOfType: routed,
        duplicateOfId: dup.id,
        status: "duplicate",
        attachments,
        confidence: draft.confidence,
      },
      now,
    );
    store.insert("captures", log);
    return {
      status: "duplicate",
      entityType: routed,
      entity: null,
      log,
      duplicateOf: { entityType: routed, entityId: dup.id, title: draft.title },
    };
  }

  const body = draft.body ?? "";
  const durationMs =
    (draft.durationMin ?? draft.estimateMin ?? 60) * MINUTE_MS;

  let entity: CapturedEntity | null = null;

  switch (draft.type) {
    case "task": {
      const tags = [...draft.tags];
      let projectId: ID | null = null;
      const projects = Object.values(state.projects);
      for (const tag of [...tags]) {
        const match = projects.find((project) => project.name.toLowerCase() === tag);
        if (match) {
          projectId = match.id;
          tags.splice(tags.indexOf(tag), 1);
        }
      }
      entity = createTask(
        {
          title: draft.title,
          notes: body,
          status: plannedStatus({
            status: "inbox",
            dueAt: draft.dueAt,
            scheduledAt: null,
            projectId,
          }),
          priority: draft.priority,
          dueAt: draft.dueAt,
          estimateMin: draft.estimateMin,
          tags,
          projectId,
          source: "capture",
          mode: draft.workspaceMode,
        },
        now,
      );
      store.insert("tasks", entity);
      attachFiles(store, "task", entity.id, attachments, now);
      break;
    }
    case "note": {
      entity = createNote(
        { title: draft.title, body, tags: draft.tags, source: "capture", mode: draft.workspaceMode },
        now,
      );
      store.insert("notes", entity);
      attachFiles(store, "note", entity.id, attachments, now);
      break;
    }
    case "image": {
      entity = createNote(
        { title: draft.title, body, tags: draft.tags, source: "capture", mode: draft.workspaceMode },
        now,
      );
      store.insert("notes", entity);
      attachFiles(store, "note", entity.id, attachments, now);
      break;
    }
    case "goal": {
      entity = createGoal(
        {
          title: draft.title,
          description: body,
          horizon: draft.goalHorizon ?? "quarter",
          targetAt: draft.dueAt,
        },
        now,
      );
      store.insert("goals", entity);
      break;
    }
    case "habit": {
      entity = createHabit(
        {
          title: draft.title,
          cadence: draft.cadence ?? "daily",
          daysOfWeek: draft.daysOfWeek ?? [],
        },
        now,
      );
      store.insert("habits", entity);
      break;
    }
    case "event": {
      const startsAt = draft.startsAt ?? nextSlot(now);
      entity = createEvent(
        {
          title: draft.title,
          startsAt,
          endsAt: draft.endsAt ?? startsAt + durationMs,
          notes: body,
          allDay: draft.allDay,
          source: "capture",
          mode: draft.workspaceMode,
        },
        now,
      );
      store.insert("events", entity);
      attachFiles(store, "event", entity.id, attachments, now);
      break;
    }
    case "meeting": {
      const startsAt = draft.startsAt ?? nextSlot(now);
      entity = createMeeting(
        {
          title: draft.title,
          startsAt,
          endsAt: draft.endsAt ?? startsAt + durationMs,
          notes: body,
          origin: "capture",
          attendeeIds: [],
        },
        now,
      );
      store.insert("meetings", entity);
      attachFiles(store, "meeting", entity.id, attachments, now);
      break;
    }
    case "document": {
      const first = attachments[0];
      entity = createDocument(
        {
          title: draft.title,
          mimeType: first?.mimeType ?? "application/octet-stream",
          sizeBytes: first?.sizeBytes ?? 0,
          source: "upload",
          url: first?.url ?? null,
          origin: "capture",
        },
        now,
      );
      store.insert("documents", entity);
      if (first) {
        const attachment = createAttachment(
          {
            ownerType: "document",
            ownerId: entity.id,
            name: first.name,
            mimeType: first.mimeType,
            sizeBytes: first.sizeBytes,
            source: "upload",
            url: first.url,
          },
          now,
        );
        store.insert("attachments", attachment);
        store.update("documents", entity.id, {
          attachmentId: attachment.id,
          status: "ready",
        });
        entity = store.getState().documents[entity.id] ?? entity;
      }
      break;
    }
    case "voice": {
      const first = attachments[0];
      entity = createRecording(
        {
          title: draft.title,
          startedAt: now,
          mimeType: first?.mimeType ?? "audio/webm",
          origin: "capture",
        },
        now,
      );
      store.insert("recordings", entity);
      attachFiles(store, "recording", entity.id, attachments, now);
      break;
    }
  }

  const log = createCaptureLog(
    {
      mode: draft.mode,
      source: draft.source,
      raw,
      title: draft.title,
      entityType: routed,
      entityId: entity?.id ?? null,
      status: "created",
      attachments,
      confidence: draft.confidence,
    },
    now,
  );
  store.insert("captures", log);

  return {
    status: "created",
    entityType: routed,
    entity,
    log,
    duplicateOf: null,
  };
}