import type { EntityMeta, EntityType, ID, Timestamp } from "./common";
import { newId } from "./common";

export type PermissionScope = "private" | "workspace" | "team" | "link";

export type EntityOrigin = "manual" | "capture" | "ai" | "import" | "system" | "integration";

export const LOCAL_USER_ID = "user_local";

export const LOCAL_WORKSPACE_ID = "workspace_local";

export interface EntityRef {
  entityType: EntityType;
  entityId: ID;
}

export interface AuditInfo {
  createdBy: ID;
  updatedBy: ID;
  origin: EntityOrigin;
  templateId: ID | null;
}

export type SyncConflict = "none" | "local" | "remote";

export interface SyncMeta {
  revision: number;
  syncedAt: Timestamp | null;
  pending: boolean;
  conflict: SyncConflict;
}

export interface CanonicalEntity extends EntityMeta {
  workspaceId: ID;
  ownerId: ID;
  scope: PermissionScope;
  deletedAt: Timestamp | null;
  archivedAt: Timestamp | null;
  version: number;
  audit: AuditInfo;
  sync: SyncMeta;
}

export interface CanonicalInput {
  ownerId?: ID;
  workspaceId?: ID;
  scope?: PermissionScope;
  origin?: EntityOrigin;
}

export function createCanonicalBase(
  input: CanonicalInput = {},
  now: Timestamp = Date.now(),
): CanonicalEntity {
  const ownerId = input.ownerId ?? LOCAL_USER_ID;
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    workspaceId: input.workspaceId ?? LOCAL_WORKSPACE_ID,
    ownerId,
    scope: input.scope ?? "private",
    deletedAt: null,
    archivedAt: null,
    version: 1,
    audit: {
      createdBy: ownerId,
      updatedBy: ownerId,
      origin: input.origin ?? "manual",
      templateId: null,
    },
    sync: {
      revision: 1,
      syncedAt: null,
      pending: true,
      conflict: "none",
    },
  };
}
