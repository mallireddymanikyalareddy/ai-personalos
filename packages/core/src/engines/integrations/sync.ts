import { PRIORITY, type ID, type Timestamp } from "../../types/common";
import type { NewEventInput, NewNoteInput, NewTaskInput } from "../../types";
import type {
  ConflictStrategy,
  Integration,
  ResolutionAction,
  SyncConflictRecord,
  SyncConflictKind,
  SyncDirection,
  SyncLog,
  SyncLogStatus,
} from "../../types/integration";
import { createSyncConflictRecord, createSyncLog } from "../../types/integration";
import type { ExternalChangeSet, ExternalItem, MappedEntity, SyncPlan } from "./adapter";

export interface LocalEntityRef {
  entityType: "event" | "note";
  entityId: ID;
  externalId: string;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface BuildPlanRequest {
  integration: Integration;
  changes: ExternalChangeSet;
  local: LocalEntityRef[];
  calendarId: ID | null;
  folderId: ID | null;
  now: Timestamp;
}

function readTimestamp(value: unknown): Timestamp | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readEmailList(value: unknown): Array<{ id: string; name: string; email: string; status: "needs_action" | "accepted" | "declined" | "tentative"; isOrganizer: boolean }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const email = readString(entry);
    if (!email) return [];
    return [
      {
        id: `att_${index}`,
        name: email,
        email,
        status: "needs_action" as const,
        isOrganizer: false,
      },
    ];
  });
}

export function mapItemToEvent(item: ExternalItem, calendarId: ID | null, now: Timestamp): NewEventInput {
  const startsAt = readTimestamp(item.payload.startsAt) ?? now;
  const endsAt = readTimestamp(item.payload.endsAt) ?? startsAt + 30 * 60_000;
  return {
    title: readString(item.payload.title) ?? "Untitled event",
    notes: readString(item.payload.notes) ?? "",
    startsAt,
    endsAt,
    allDay: item.payload.allDay === true,
    location: readString(item.payload.location) ?? "",
    calendarId,
    source: "integration",
    attendees: readEmailList(item.payload.attendees),
    recurrenceId: null,
  };
}

export function mapItemToNote(item: ExternalItem, folderId: ID | null): NewNoteInput {
  const size = readTimestamp(item.payload.size);
  const lines = [
    `Source: ${readString(item.payload.webViewLink) ?? "Google Drive"}`,
    `Type: ${readString(item.payload.mimeType) ?? "unknown"}`,
    `Size: ${size != null ? `${(size / 1024).toFixed(1)} KB` : "unknown"}`,
    item.lastModified != null ? `Last modified: ${new Date(item.lastModified).toISOString()}` : null,
  ].filter((line): line is string => line != null);

  return {
    title: readString(item.payload.title) ?? "Untitled file",
    body: lines.join("\n"),
    tags: ["integration", "google-drive"],
    folderId,
    source: "integration",
  };
}

export function mapItemToInput(
  item: ExternalItem,
  request: { calendarId: ID | null; folderId: ID | null; now: Timestamp },
): { event?: NewEventInput; note?: NewNoteInput } {
  if (request.folderId != null || readString(item.payload.mimeType) != null) {
    return { note: mapItemToNote(item, request.folderId) };
  }
  return { event: mapItemToEvent(item, request.calendarId, request.now) };
}

const NO_RESPONSE_VALUES = ["needsAction", "needs_action", "notResponded", "not_responded"];

export function pendingResponseEmail(item: ExternalItem): string | null {
  const attendees = item.payload.attendeeResponses;
  if (!Array.isArray(attendees)) return null;
  for (const entry of attendees) {
    const record = entry as Record<string, unknown>;
    const status = String(record.status ?? record.responseStatus ?? "").trim();
    if (NO_RESPONSE_VALUES.includes(status)) {
      return readString(record.email) ?? readString(record.emailAddress);
    }
  }
  return null;
}

export function responseTaskInput(item: ExternalItem, now: Timestamp): NewTaskInput {
  const title = readString(item.payload.title) ?? "Meeting invitation";
  return {
    title: `Respond to ${title}`,
    notes: "The organiser asked for a reply and none was sent.",
    priority: PRIORITY.MEDIUM,
    dueAt: readTimestamp(item.payload.startsAt),
  };
}

export function buildSyncPlan(request: BuildPlanRequest): SyncPlan {
  const localByExternal = new Map(request.local.map((entity) => [entity.externalId, entity]));
  const creates: MappedEntity[] = [];
  const updates: SyncPlan["updates"] = [];
  const deletes: SyncPlan["deletes"] = [];
  const conflicts: SyncPlan["conflicts"] = [];

  for (const item of request.changes.items) {
    const local = localByExternal.get(item.externalId);
    if (item.deleted) {
      if (local && local.deletedAt == null) {
        deletes.push({
          entityType: local.entityType,
          entityId: local.entityId,
          externalId: item.externalId,
        });
      }
      continue;
    }
    if (!local) {
      const mapped = mapItemToInput(item, request);
      const payload = { ...(mapped.note ?? mapped.event) };
      creates.push({
        entityType: mapped.note ? "note" : "event",
        entityId: null,
        create: {
          ...payload,
          externalId: item.externalId,
          needsResponse: mapped.note == null && pendingResponseEmail(item) != null,
        },
        update: {},
      });
      continue;
    }
    if (item.lastModified == null) continue;

    if (item.lastModified > local.updatedAt) {
      const mapped = mapItemToInput(item, request);
      updates.push({
        entityType: local.entityType,
        entityId: local.entityId,
        patch: { ...(mapped.note ?? mapped.event) },
        externalId: item.externalId,
      });
      continue;
    }

    if (item.lastModified < local.updatedAt) {
      const mapped = mapItemToInput(item, request);
      conflicts.push(
        createSyncConflictRecord(
          {
            integrationId: request.integration.id,
            entityType: local.entityType === "note" ? "note" : "event",
            entityId: local.entityId,
            externalId: item.externalId,
            kind: "event_time",
            localValue: { updatedAt: local.updatedAt },
            remoteValue: { ...(mapped.note ?? mapped.event), updatedAt: item.lastModified },
            reason: "Both copies changed since the last sync.",
          },
          request.now,
        ),
      );
    }
  }

  return { creates, updates, deletes, conflicts };
}

export function buildConflictRecord(input: {
  integrationId: ID;
  entityType: "event" | "note";
  entityId: ID;
  externalId: string;
  kind: SyncConflictKind;
  localValue: Record<string, unknown>;
  remoteValue: Record<string, unknown>;
  reason: string;
  now: Timestamp;
}): SyncConflictRecord {
  return createSyncConflictRecord(input, input.now);
}

export function resolveConflictRecord(
  conflict: SyncConflictRecord,
  action: ResolutionAction,
  now: Timestamp = Date.now(),
): SyncConflictRecord {
  return {
    ...conflict,
    status: "resolved",
    resolution: action,
    resolvedAt: now,
    updatedAt: now,
  };
}

export function resolutionKeepsLocal(action: ResolutionAction): boolean {
  return action !== "remote_wins";
}

export function shouldAutoResolve(
  strategy: ConflictStrategy,
  localUpdatedAt: Timestamp,
  remoteModifiedAt: Timestamp | null,
): ResolutionAction | null {
  if (strategy === "local_wins") return "local_wins";
  if (strategy === "remote_wins") return "remote_wins";
  if (strategy === "newer_wins") {
    if (remoteModifiedAt == null) return "local_wins";
    return remoteModifiedAt > localUpdatedAt ? "remote_wins" : "local_wins";
  }
  return null;
}

export function buildSyncLog(input: {
  integrationId: ID;
  direction: SyncDirection;
  status: SyncLogStatus;
  created: number;
  updated: number;
  removed: number;
  conflicts: number;
  errorMessage?: string | null;
  now: Timestamp;
}): SyncLog {
  return createSyncLog(
    {
      integrationId: input.integrationId,
      status: input.status,
      direction: input.direction,
      itemsCreated: input.created,
      itemsUpdated: input.updated,
      itemsDeleted: input.removed,
      conflictsFound: input.conflicts,
      durationMs: 0,
      errorMessage: input.errorMessage ?? null,
    },
    input.now,
  );
}

export function finishSyncLog(log: SyncLog, now: Timestamp): SyncLog {
  const status: SyncLogStatus = log.conflictsFound > 0 && log.status === "success" ? "partial" : log.status;
  return { ...log, status, durationMs: now - log.createdAt, updatedAt: now };
}

export function planSummary(plan: SyncPlan): string {
  const parts: string[] = [];
  if (plan.creates.length > 0) parts.push(`${plan.creates.length} new`);
  if (plan.updates.length > 0) parts.push(`${plan.updates.length} updated`);
  if (plan.deletes.length > 0) parts.push(`${plan.deletes.length} removed`);
  if (plan.conflicts.length > 0) parts.push(`${plan.conflicts.length} conflicts`);
  return parts.length === 0 ? "Nothing to sync" : parts.join(", ");
}

export function conflictBreakdown(conflicts: SyncConflictRecord[]): Record<SyncConflictKind, number> {
  const counts: Record<SyncConflictKind, number> = {
    event_time: 0,
    event_cancelled: 0,
    file_deleted: 0,
    title_mismatch: 0,
    duplicate: 0,
  };
  for (const conflict of conflicts) {
    counts[conflict.kind] += 1;
  }
  return counts;
}

export function syncStatusLabel(status: Integration["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "paused":
      return "Paused";
    case "error":
      return "Needs attention";
    case "reauthorizing":
      return "Reconnect needed";
    case "disconnected":
      return "Not connected";
  }
}

export function relativeSyncTime(
  lastSyncAt: Timestamp | null,
  now: Timestamp = Date.now(),
): string {
  if (lastSyncAt == null) return "Never synced";
  const diff = now - lastSyncAt;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}

export function pendingConflicts(state: { syncConflicts: Record<ID, SyncConflictRecord> }): SyncConflictRecord[] {
  return Object.values(state.syncConflicts)
    .filter((conflict) => conflict.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function lastSyncFor(
  integrations: Integration[],
  providerId: string,
): Integration | null {
  return integrations.find((integration) => integration.provider === providerId) ?? null;
}
