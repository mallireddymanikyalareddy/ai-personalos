import type { EntityMeta, EntityType, ID, Timestamp } from "./common";
import { newId } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";

export type IntegrationKind = "calendar" | "tasks" | "notes" | "files" | "health" | "communication";

export type IntegrationStatus = "connected" | "paused" | "error" | "disconnected" | "reauthorizing";

export type SyncDirection = "inbound" | "outbound" | "bidirectional";

export type ConflictStrategy = "manual" | "local_wins" | "remote_wins" | "newer_wins";

export type ProviderAuthType = "oauth2" | "oauth2_pkce" | "api_key";

export type ProviderStatus = "live" | "preparing";

export interface ProviderCapability {
  id: string;
  label: string;
  detail: string;
  supported: boolean;
}

export interface ProviderDefinition {
  id: string;
  kind: IntegrationKind;
  label: string;
  detail: string;
  authType: ProviderAuthType;
  status: ProviderStatus;
  scopes: string[];
  oauth?: {
    authorizeUrl: string;
    tokenUrl: string;
    revokeUrl?: string;
    scopeSeparator?: string;
    extraAuthorizeParams?: Record<string, string>;
  };
  capabilities: ProviderCapability[];
  docsUrl?: string;
}

export const INTEGRATION_PROVIDERS: ProviderDefinition[] = [
  {
    id: "google_calendar",
    kind: "calendar",
    label: "Google Calendar",
    detail: "Two-way sync of events, availability, and reminders.",
    authType: "oauth2_pkce",
    status: "live",
    scopes: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"],
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      scopeSeparator: " ",
      extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    },
      capabilities: [
      { id: "calendar_events_read", label: "Read events", detail: "Pull events into your calendar.", supported: true },
      { id: "calendar_events_write", label: "Create and update events", detail: "Push plans back to Google.", supported: false },
      { id: "availability", label: "Free/busy lookup", detail: "Respect meetings you do not own.", supported: false },
    ],
  },
  {
    id: "outlook_calendar",
    kind: "calendar",
    label: "Microsoft Outlook Calendar",
    detail: "Two-way sync with Microsoft 365 and Outlook.com calendars.",
    authType: "oauth2_pkce",
    status: "live",
    scopes: ["Calendars.ReadWrite", "Calendars.Read", "offline_access"],
    oauth: {
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopeSeparator: " ",
    },
    capabilities: [
      { id: "calendar_events_read", label: "Read events", detail: "Pull events into your calendar.", supported: true },
      { id: "calendar_events_write", label: "Create and update events", detail: "Push plans back to Outlook.", supported: false },
      { id: "availability", label: "Free/busy lookup", detail: "Respect meetings you do not own.", supported: false },
    ],
  },
  {
    id: "google_drive",
    kind: "files",
    label: "Google Drive",
    detail: "Attach documents and paper pages straight from Drive, and export back to your folders.",
    authType: "oauth2_pkce",
    status: "live",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      scopeSeparator: " ",
      extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    },
    capabilities: [
      { id: "files_list", label: "Browse files", detail: "Pick a document to attach or summarise.", supported: true },
      { id: "files_download", label: "Download files", detail: "Read-only import into the knowledge engine.", supported: true },
      { id: "files_upload", label: "Upload exports", detail: "Write PDFs and paper pages back.", supported: false },
    ],
  },
  {
    id: "icloud_calendar",
    kind: "calendar",
    label: "Apple / iCloud Calendar",
    detail: "CalDAV-based sync for Apple calendar accounts.",
    authType: "oauth2",
    status: "preparing",
    scopes: ["calendars"],
    capabilities: [
      { id: "calendar_events_read", label: "Read events", detail: "Pull events via CalDAV.", supported: false },
      { id: "calendar_events_write", label: "Create and update events", detail: "Write back over CalDAV.", supported: false },
    ],
  },
  {
    id: "dropbox",
    kind: "files",
    label: "Dropbox",
    detail: "Attach and export files through your Dropbox.",
    authType: "oauth2_pkce",
    status: "preparing",
    scopes: ["files.metadata.read", "files.content.read", "files.content.write"],
    capabilities: [
      { id: "files_list", label: "Browse files", detail: "Pick a document to attach.", supported: false },
      { id: "files_download", label: "Download files", detail: "Read-only import.", supported: false },
      { id: "files_upload", label: "Upload exports", detail: "Write documents back.", supported: false },
    ],
  },
  {
    id: "onedrive",
    kind: "files",
    label: "OneDrive",
    detail: "Attach and export files through your Microsoft account.",
    authType: "oauth2_pkce",
    status: "preparing",
    scopes: ["Files.Read", "Files.ReadWrite", "offline_access"],
    capabilities: [
      { id: "files_list", label: "Browse files", detail: "Pick a document to attach.", supported: false },
      { id: "files_download", label: "Download files", detail: "Read-only import.", supported: false },
      { id: "files_upload", label: "Upload exports", detail: "Write documents back.", supported: false },
    ],
  },
  {
    id: "notion",
    kind: "notes",
    label: "Notion",
    detail: "Bring Notion pages and databases into your knowledge base.",
    authType: "oauth2",
    status: "preparing",
    scopes: [],
    capabilities: [
      { id: "pages_read", label: "Read pages", detail: "Import pages and databases.", supported: false },
      { id: "pages_write", label: "Publish pages", detail: "Write summaries and notes back.", supported: false },
    ],
  },
  {
    id: "slack",
    kind: "communication",
    label: "Slack",
    detail: "Turn messages into tasks, and post reminders into channels.",
    authType: "oauth2",
    status: "preparing",
    scopes: ["channels:history", "chat:write"],
    capabilities: [
      { id: "messages_read", label: "Read messages", detail: "Capture action items from channels.", supported: false },
      { id: "messages_write", label: "Post messages", detail: "Send digests and reminders.", supported: false },
    ],
  },
];

export const PROVIDER_BY_ID: Record<string, ProviderDefinition> = INTEGRATION_PROVIDERS.reduce(
  (map, provider) => {
    map[provider.id] = provider;
    return map;
  },
  {} as Record<string, ProviderDefinition>,
);

export const INTEGRATION_PROVIDER_BY_ID = PROVIDER_BY_ID;

export interface IntegrationSettings {
  autoSync: boolean;
  pushBack: boolean;
  importRangeDays: number;
  conflictStrategy: ConflictStrategy;
  targetCalendarId?: ID | null;
  targetFolderId?: ID | null;
  webhookEnabled: boolean;
}

export function defaultIntegrationSettings(): IntegrationSettings {
  return {
    autoSync: true,
    pushBack: false,
    importRangeDays: 90,
    conflictStrategy: "manual",
    targetCalendarId: null,
    targetFolderId: null,
    webhookEnabled: false,
  };
}

export type SyncConflictKind =
  | "event_time"
  | "event_cancelled"
  | "file_deleted"
  | "title_mismatch"
  | "duplicate";

export type SyncConflictStatus = "pending" | "resolved";

export type ResolutionAction = "local_wins" | "remote_wins" | "merge" | "ignore";

export interface NewSyncConflictRecordInput extends CanonicalInput {
  integrationId: ID;
  entityType: EntityType;
  entityId: ID;
  externalId: string;
  kind: SyncConflictKind;
  localValue: Record<string, unknown>;
  remoteValue: Record<string, unknown>;
  reason: string;
}

export interface SyncConflictRecord extends CanonicalEntity {
  type: "sync_conflict";
  integrationId: ID;
  entityType: EntityType;
  entityId: ID;
  externalId: string;
  kind: SyncConflictKind;
  localValue: Record<string, unknown>;
  remoteValue: Record<string, unknown>;
  reason: string;
  status: SyncConflictStatus;
  resolvedAt: Timestamp | null;
  resolution: ResolutionAction | null;
}

export function createSyncConflictRecord(input: NewSyncConflictRecordInput, now: Timestamp = Date.now()): SyncConflictRecord {
  return {
    ...createCanonicalBase({ ...input, origin: "system" }, now),
    type: "sync_conflict",
    integrationId: input.integrationId,
    entityType: input.entityType,
    entityId: input.entityId,
    externalId: input.externalId,
    kind: input.kind,
    localValue: input.localValue,
    remoteValue: input.remoteValue,
    reason: input.reason,
    status: "pending",
    resolvedAt: null,
    resolution: null,
  };
}

export type SyncLogStatus = "started" | "success" | "partial" | "failed";

export interface NewSyncLogInput extends CanonicalInput {
  integrationId: ID;
  status: SyncLogStatus;
  direction: SyncDirection;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  conflictsFound: number;
  durationMs: number;
  errorMessage?: string | null;
}

export interface SyncLog extends CanonicalEntity {
  type: "sync_log";
  integrationId: ID;
  status: SyncLogStatus;
  direction: SyncDirection;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  conflictsFound: number;
  durationMs: number;
  errorMessage: string | null;
}

export function createSyncLog(input: NewSyncLogInput, now: Timestamp = Date.now()): SyncLog {
  return {
    ...createCanonicalBase({ ...input, origin: "system" }, now),
    type: "sync_log",
    integrationId: input.integrationId,
    status: input.status,
    direction: input.direction,
    itemsCreated: input.itemsCreated,
    itemsUpdated: input.itemsUpdated,
    itemsDeleted: input.itemsDeleted,
    conflictsFound: input.conflictsFound,
    durationMs: input.durationMs,
    errorMessage: input.errorMessage ?? null,
  };
}

export interface NewIntegrationInput extends CanonicalInput {
  provider: string;
  kind: IntegrationKind;
  accountLabel?: string;
  scopes?: string[];
  credentialRef?: string;
  externalAccountId?: string;
  direction?: SyncDirection;
  settings?: Partial<IntegrationSettings>;
}

export interface Integration extends CanonicalEntity {
  type: "integration";
  provider: string;
  kind: IntegrationKind;
  accountLabel: string;
  scopes: string[];
  settings: IntegrationSettings;
  mappings: Record<string, string>;
  credentialRef: string | null;
  externalAccountId: string | null;
  tokenExpiresAt: Timestamp | null;
  lastSyncAt: Timestamp | null;
  lastErrorAt: Timestamp | null;
  lastError: string | null;
  status: IntegrationStatus;
  connectedAt: Timestamp | null;
  direction: SyncDirection;
}

export function createIntegration(input: NewIntegrationInput, now: Timestamp = Date.now()): Integration {
  return {
    ...createCanonicalBase({ ...input, origin: "system" }, now),
    type: "integration",
    provider: input.provider.trim().toLowerCase(),
    kind: input.kind,
    accountLabel: input.accountLabel ?? "",
    scopes: input.scopes ?? [],
    settings: { ...defaultIntegrationSettings(), ...(input.settings ?? {}) },
    mappings: {},
    credentialRef: input.credentialRef ?? null,
    externalAccountId: input.externalAccountId ?? null,
    tokenExpiresAt: null,
    lastSyncAt: null,
    lastErrorAt: null,
    lastError: null,
    status: "disconnected",
    connectedAt: null,
    direction: input.direction ?? "inbound",
  };
}

export function isExpiringSoon(expiresAt: Timestamp | null, now: Timestamp = Date.now()): boolean {
  if (expiresAt == null) return false;
  return expiresAt - now < 5 * 60_000;
}

export function needsReauthorization(integration: Integration, now: Timestamp = Date.now()): boolean {
  if (integration.status === "error" && integration.lastError?.includes("invalid_grant")) return true;
  return isExpiringSoon(integration.tokenExpiresAt, now);
}