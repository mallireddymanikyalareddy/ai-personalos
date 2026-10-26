import type { ID, Timestamp } from "../../types/common";
import type { Integration, ProviderDefinition, SyncConflictRecord, SyncDirection } from "../../types/integration";
import type { TokenVaultEntry } from "./oauth";

export interface ExternalItem {
  externalId: string;
  etag: string | null;
  lastModified: Timestamp | null;
  payload: Record<string, unknown>;
  deleted: boolean;
}

export interface ExternalChangeSet {
  items: ExternalItem[];
  nextSyncToken: string | null;
}

export interface MappedEntity {
  entityType: "event" | "note" | "document" | "task";
  entityId: ID | null;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

export interface SyncPlan {
  creates: MappedEntity[];
  updates: Array<{
    entityType: "event" | "note";
    entityId: ID;
    patch: Record<string, unknown>;
    externalId: string;
  }>;
  deletes: Array<{ entityType: "event" | "note"; entityId: ID; externalId: string }>;
  conflicts: SyncConflictRecord[];
}

export interface ProviderAdapter {
  readonly providerId: string;
  readonly capabilities: string[];

  pullChanges(
    integration: Integration,
    vaultEntry: TokenVaultEntry | null,
    from: Timestamp,
    to: Timestamp,
  ): Promise<ExternalChangeSet>;

  buildPlan(
    integration: Integration,
    changes: ExternalChangeSet,
    local: Array<{ entityType: string; entityId: ID; externalId: string; updatedAt: Timestamp }>,
  ): SyncPlan;

  pushChanges?(
    integration: Integration,
    vaultEntry: TokenVaultEntry | null,
    changes: Array<{ entityType: string; entityId: ID }>,
  ): Promise<{ pushed: number; failed: number }>;
}

const READ_CAPABILITIES = [
  "calendar_events_read",
  "files_list",
  "files_download",
  "pages_read",
  "messages_read",
];

const WRITE_CAPABILITIES = [
  "calendar_events_write",
  "files_upload",
  "pages_write",
  "messages_write",
];

function supportsCapability(definition: ProviderDefinition, capabilityIds: string[]): boolean {
  return definition.capabilities.some((c) => capabilityIds.includes(c.id) && c.supported);
}

export function supportsDirection(
  definition: ProviderDefinition,
  direction: SyncDirection,
): boolean {
  const read = supportsCapability(definition, READ_CAPABILITIES);
  const write = supportsCapability(definition, WRITE_CAPABILITIES);
  if (direction === "inbound") return read;
  if (direction === "outbound") return write;
  return read && write;
}

export function timeField(integration: Integration, item: ExternalItem): Timestamp | null {
  const payload = item.payload;
  const candidates = ["startsAt", "updatedAt", "createdAt", "modifiedTime"];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function numberField(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function booleanField(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true;
}