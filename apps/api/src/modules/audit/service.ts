import { auditLog } from "../../db/schema";
import type { Db } from "../../db/index";

export type AuditActorKind = "user" | "ai" | "guest" | "system" | "support";

export interface AuditEntry {
  actorUserId?: string | null;
  actorKind: AuditActorKind;
  deviceId?: string | null;
  sessionId?: string | null;
  action: string;
  resourceCollection?: string | null;
  resourceId?: string | null;
  workspaceId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  diff?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

type InsertTarget = { insert: Db["insert"] };

export async function writeAudit(target: InsertTarget, entry: AuditEntry): Promise<void> {
  await target.insert(auditLog).values(entry);
}
