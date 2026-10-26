import type { EntityType, ID, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";

export type UserStatus = "active" | "invited" | "suspended" | "deleted";

export interface NewUserInput extends CanonicalInput {
  handle: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
  locale?: string;
  status?: UserStatus;
}

export interface User extends CanonicalEntity {
  type: "user";
  handle: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  lastSeenAt: Timestamp | null;
  status: UserStatus;
}

export function createUser(input: NewUserInput, now: Timestamp = Date.now()): User {
  return {
    ...createCanonicalBase(input, now),
    type: "user",
    handle: input.handle.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    email: input.email ?? null,
    avatarUrl: input.avatarUrl ?? null,
    timezone: input.timezone ?? "UTC",
    locale: input.locale ?? "en",
    lastSeenAt: null,
    status: input.status ?? "active",
  };
}

export type WorkspaceStatus = "active" | "archived";

export type WorkspacePlan = "free" | "pro" | "team";

export interface NewWorkspaceInput extends CanonicalInput {
  name: string;
  plan?: WorkspacePlan;
}

export interface Workspace extends CanonicalEntity {
  type: "workspace";
  name: string;
  plan: WorkspacePlan;
  color: string | null;
  icon: string | null;
  settings: Record<string, unknown>;
  status: WorkspaceStatus;
}

export function createWorkspace(
  input: NewWorkspaceInput,
  now: Timestamp = Date.now(),
): Workspace {
  return {
    ...createCanonicalBase(input, now),
    type: "workspace",
    name: input.name.trim(),
    plan: input.plan ?? "free",
    color: null,
    icon: null,
    settings: {},
    status: "active",
  };
}

export type TeamStatus = "active" | "archived";

export interface NewTeamInput extends CanonicalInput {
  name: string;
  description?: string;
}

export interface Team extends CanonicalEntity {
  type: "team";
  name: string;
  description: string;
  color: string | null;
  icon: string | null;
  status: TeamStatus;
}

export function createTeam(input: NewTeamInput, now: Timestamp = Date.now()): Team {
  return {
    ...createCanonicalBase(input, now),
    type: "team",
    name: input.name.trim(),
    description: input.description ?? "",
    color: null,
    icon: null,
    status: "active",
  };
}

export type MemberRole = "owner" | "admin" | "member" | "guest";

export type MemberStatus = "active" | "invited" | "suspended" | "left";

export interface NewMemberInput extends CanonicalInput {
  userId: ID;
  role: MemberRole;
  teamId?: ID | null;
  displayName?: string | null;
}

export interface Member extends CanonicalEntity {
  type: "member";
  userId: ID;
  role: MemberRole;
  teamId: ID | null;
  displayName: string | null;
  avatarUrl: string | null;
  joinedAt: Timestamp | null;
  status: MemberStatus;
}

export function createMember(input: NewMemberInput, now: Timestamp = Date.now()): Member {
  return {
    ...createCanonicalBase(input, now),
    type: "member",
    userId: input.userId,
    role: input.role,
    teamId: input.teamId ?? null,
    displayName: input.displayName ?? null,
    avatarUrl: null,
    joinedAt: now,
    status: "active",
  };
}

export type ShiftStatus = "scheduled" | "active" | "completed" | "cancelled" | "swapped";

export interface NewShiftInput extends CanonicalInput {
  memberId: ID;
  startsAt: Timestamp;
  endsAt: Timestamp;
  title?: string;
  teamId?: ID | null;
}

export interface Shift extends CanonicalEntity {
  type: "shift";
  memberId: ID;
  teamId: ID | null;
  startsAt: Timestamp;
  endsAt: Timestamp;
  title: string;
  location: string;
  notes: string;
  breakMin: number | null;
  status: ShiftStatus;
}

export function createShift(input: NewShiftInput, now: Timestamp = Date.now()): Shift {
  return {
    ...createCanonicalBase(input, now),
    type: "shift",
    memberId: input.memberId,
    teamId: input.teamId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    title: input.title ?? "",
    location: "",
    notes: "",
    breakMin: null,
    status: "scheduled",
  };
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export interface NewApprovalInput extends CanonicalInput {
  requesterId: ID;
  entityType: EntityType;
  entityId: ID;
  approverId?: ID | null;
  dueAt?: Timestamp | null;
}

export interface Approval extends CanonicalEntity {
  type: "approval";
  requesterId: ID;
  approverId: ID | null;
  entityType: EntityType;
  entityId: ID;
  comment: string;
  decidedAt: Timestamp | null;
  dueAt: Timestamp | null;
  status: ApprovalStatus;
}

export function createApproval(input: NewApprovalInput, now: Timestamp = Date.now()): Approval {
  return {
    ...createCanonicalBase(input, now),
    type: "approval",
    requesterId: input.requesterId,
    approverId: input.approverId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    comment: "",
    decidedAt: null,
    dueAt: input.dueAt ?? null,
    status: "pending",
  };
}
