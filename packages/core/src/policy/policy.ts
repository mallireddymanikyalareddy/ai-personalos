import { AppError } from "@personalos/api-contract/errors";

export type WorkspaceRole = "owner" | "admin" | "member" | "guest";

export type Scope = "private" | "workspace" | "team" | "link";

export type ActorKind = "user" | "ai" | "guest" | "system" | "support";

export type Action = "read" | "create" | "update" | "delete" | "share" | "restore" | "export";

export const ACTIONS: readonly Action[] = [
  "read",
  "create",
  "update",
  "delete",
  "share",
  "restore",
  "export",
];

export const AI_WRITABLE_TYPES: readonly string[] = [
  "aiConversations",
  "aiMessages",
  "aiInsights",
  "aiObjects",
];

export interface Actor {
  kind: ActorKind;
  userId?: string;
  workspaceRole?: WorkspaceRole;
  contextRefIds?: readonly string[];
}

export interface Resource {
  id?: string;
  type?: string;
  ownerId?: string | null;
  workspaceId?: string | null;
  scope: Scope;
}

export type Decision =
  | { allowed: true; rule: string }
  | { allowed: false; rule: string };

function allow(rule: string): Decision {
  return { allowed: true, rule };
}

function deny(rule: string): Decision {
  return { allowed: false, rule };
}

function canAi(actor: Actor, action: Action, resource: Resource): Decision {
  switch (action) {
    case "read": {
      const refs = actor.contextRefIds ?? [];
      return resource.id !== undefined && refs.includes(resource.id)
        ? allow("ai-ref-read")
        : deny("ai-refs-only");
    }
    case "create":
    case "update":
      return resource.type !== undefined && AI_WRITABLE_TYPES.includes(resource.type)
        ? allow("ai-writable-type")
        : deny("ai-writable-type");
    case "delete":
    case "restore":
      return deny("ai-never-delete");
    case "share":
      return deny("ai-never-share");
    case "export":
      return deny("ai-never-export");
  }
}

function canGuest(action: Action, resource: Resource): Decision {
  if (action !== "read") return deny("guest-read-only");
  return resource.scope === "link" ? allow("guest-link-read") : deny("guest-link-only");
}

function canActorUser(actor: Actor, action: Action, resource: Resource): Decision {
  const isOwner =
    actor.userId !== undefined &&
    actor.userId.length > 0 &&
    resource.ownerId !== undefined &&
    resource.ownerId !== null &&
    resource.ownerId === actor.userId;
  const role = actor.workspaceRole;

  if (role === "owner") return allow("workspace-owner");

  if (role === "admin") {
    switch (action) {
      case "delete":
      case "restore":
        return isOwner ? allow("admin-own-content") : deny("admin-foreign-content");
      default:
        return allow("workspace-admin");
    }
  }

  if (role === "member") {
    switch (action) {
      case "read":
        return isOwner || resource.scope !== "private"
          ? allow("member-read")
          : deny("member-foreign-private");
      case "create":
        return allow("member-create");
      case "update":
      case "delete":
      case "restore":
        return isOwner ? allow("member-own-content") : deny("member-foreign-content");
      case "share":
        return deny("member-no-share");
      case "export":
        return deny("member-no-export");
    }
  }

  switch (action) {
    case "read":
    case "update":
    case "delete":
    case "restore":
      return isOwner ? allow("owner-without-role") : deny("no-membership");
    case "create":
    case "share":
    case "export":
      return deny("no-membership");
  }
}

export function can(actor: Actor, action: Action, resource: Resource): Decision {
  switch (actor.kind) {
    case "system":
      return allow("system");
    case "support":
      return action === "read" ? allow("support-read") : deny("support-read-only");
    case "ai":
      return canAi(actor, action, resource);
    case "guest":
      return canGuest(action, resource);
    case "user":
      return canActorUser(actor, action, resource);
  }
}

export function isAllowed(decision: Decision): boolean {
  return decision.allowed;
}

export function assertCan(actor: Actor, action: Action, resource: Resource): Decision {
  const decision = can(actor, action, resource);
  if (!decision.allowed) {
    throw new AppError("POLICY_DENIED", {
      detail: `Policy denied: ${decision.rule}.`,
    });
  }
  return decision;
}
