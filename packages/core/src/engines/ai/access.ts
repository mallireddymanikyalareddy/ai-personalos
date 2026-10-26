import { LOCAL_USER_ID, LOCAL_WORKSPACE_ID } from "../../types/base";
import type { ID, Timestamp } from "../../types/common";
import type { Actor, Resource } from "../../policy/policy";
import { can, type Decision } from "../../policy/policy";
import type { AppState } from "../../store/state";

export function userActor(): Actor {
  return { kind: "user", userId: LOCAL_USER_ID, workspaceRole: "owner" };
}

export function aiActor(contextRefIds: readonly string[]): Actor {
  return { kind: "ai", userId: LOCAL_USER_ID, contextRefIds };
}

export function readResource(entity: {
  id: ID;
  ownerId?: string | null;
  workspaceId?: string | null;
  scope?: "private" | "workspace" | "team" | "link";
}): Resource {
  return {
    id: entity.id,
    type: undefined,
    ownerId: entity.ownerId ?? LOCAL_USER_ID,
    workspaceId: entity.workspaceId ?? LOCAL_WORKSPACE_ID,
    scope: entity.scope ?? "private",
  };
}

export function canUserRead(state: AppState, entity: { ownerId?: string | null }): boolean {
  const ownerId = entity.ownerId ?? LOCAL_USER_ID;
  if (ownerId === LOCAL_USER_ID) return true;
  const user = Object.values(state.users)[0];
  return user !== undefined && ownerId === user.id;
}

export function authorizeAiRead(
  actor: Actor,
  entity: { id: ID; ownerId?: string | null; workspaceId?: string | null; scope?: "private" | "workspace" | "team" | "link" },
): Decision {
  return can(actor, "read", readResource(entity));
}

export function authorizeProposalApply(
  entity: { type: string; id: ID },
): Decision {
  return can(userActor(), "create", { type: entity.type, id: entity.id, scope: "private", ownerId: LOCAL_USER_ID });
}

export interface AuthorizedRef {
  id: ID;
  type: string;
}

export function collectAuthorizedIds(
  state: AppState,
  collections: ReadonlyArray<{ name: string; items: Record<string, unknown> }>,
): string[] {
  const ids: string[] = [];
  for (const collection of collections) {
    for (const item of Object.values(collection.items)) {
      const entity = item as { id?: ID; ownerId?: string | null; scope?: string };
      if (!entity.id) continue;
      if (canUserRead(state, { ownerId: entity.ownerId })) {
        ids.push(entity.id);
      }
    }
  }
  return ids;
}

export function hasAccess(decision: Decision): boolean {
  return decision.allowed;
}

export function describeAccess(decision: Decision): string {
  return decision.rule;
}

export const AI_ACCESS_DOMAIN = {
  tasks: "tasks",
  calendar: "calendar",
  goals: "goals",
  habits: "habits",
  notes: "notes",
  meetings: "meetings",
  lifeMemory: "lifeMemory",
  preferences: "preferences",
} as const;

export type AIAccessDomain = (typeof AI_ACCESS_DOMAIN)[keyof typeof AI_ACCESS_DOMAIN];

export function domainResource(domain: AIAccessDomain): string {
  switch (domain) {
    case "tasks":
      return "tasks";
    case "calendar":
      return "events";
    case "goals":
      return "goals";
    case "habits":
      return "habits";
    case "notes":
      return "notes";
    case "meetings":
      return "meetings";
    case "lifeMemory":
      return "lifeMemories";
    case "preferences":
      return "profile";
  }
}

export function nowWindow(now: Timestamp): { today: { from: number; to: number }; week: { from: number; to: number } } {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const from = dayStart.getTime();
  const to = from + 86_400_000;
  return { today: { from, to }, week: { from, to: from + 7 * 86_400_000 } };
}