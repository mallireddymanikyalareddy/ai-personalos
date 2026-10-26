import {
  bigserial,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { UserPreferences } from "@personalos/api-contract/account";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  email: text("email").unique(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("en"),
  avatarUrl: text("avatar_url"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  preferences: jsonb("preferences")
    .$type<UserPreferences>()
    .notNull()
    .default({} as UserPreferences),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    secretHash: text("secret_hash"),
    credentialId: text("credential_id").unique(),
    counter: integer("counter").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [index("credentials_user_idx").on(table.userId)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Unknown device"),
    platform: text("platform").notNull(),
    fingerprint: text("fingerprint").notNull(),
    pushToken: text("push_token"),
    appVersion: text("app_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("devices_user_idx").on(table.userId),
    unique("devices_user_fingerprint_unique").on(table.userId, table.fingerprint),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    deviceId: uuid("device_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("personal"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

export const documents = pgTable(
  "documents",
  {
    collection: text("collection").notNull(),
    id: uuid("id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    scope: text("scope").notNull().default("private"),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    document: jsonb("document").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collection, table.id] }),
    index("documents_owner_idx").on(table.ownerId, table.updatedAt),
    index("documents_workspace_idx").on(table.workspaceId, table.updatedAt),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id"),
    actorKind: text("actor_kind").notNull(),
    deviceId: uuid("device_id"),
    sessionId: uuid("session_id"),
    action: text("action").notNull(),
    resourceCollection: text("resource_collection"),
    resourceId: uuid("resource_id"),
    workspaceId: uuid("workspace_id"),
    requestId: text("request_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("audit_actor_ts_idx").on(table.actorUserId, table.ts),
    index("audit_workspace_ts_idx").on(table.workspaceId, table.ts),
    index("audit_resource_idx").on(table.resourceCollection, table.resourceId),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_tokens_user_kind_idx").on(table.userId, table.kind),
    index("auth_tokens_expires_idx").on(table.expiresAt),
  ],
);

export const oauthConnections = pgTable(
  "oauth_connections",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    unique("oauth_connections_provider_subject_unique").on(
      table.provider,
      table.providerSubject,
    ),
    index("oauth_connections_user_idx").on(table.userId),
  ],
);

export const outbox = pgTable(
  "outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: text("event_id").notNull().unique(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => [index("outbox_status_idx").on(table.status, table.id)],
);
