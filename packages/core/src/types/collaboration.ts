import type { ID, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";

export type Mode = "personal" | "work";

export const DEFAULT_MODE: Mode = "personal";

export type ShareableEntityType = "task" | "project" | "note" | "event";

export type ShareRole = "viewer" | "commenter" | "editor" | "admin";

export const SHARE_ROLE_RANK: Record<ShareRole, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  admin: 4,
};

export const SHARE_ROLE_LABELS: Record<ShareRole, string> = {
  viewer: "Can view",
  commenter: "Can comment",
  editor: "Can edit",
  admin: "Admin",
};

export interface Share extends CanonicalEntity {
  type: "share";
  entityType: ShareableEntityType;
  entityId: ID;
  memberId: ID;
  role: ShareRole;
}

export interface NewShareInput extends CanonicalInput {
  entityType: ShareableEntityType;
  entityId: ID;
  memberId: ID;
  role: ShareRole;
}

export function createShare(input: NewShareInput, now: Timestamp = Date.now()): Share {
  return {
    ...createCanonicalBase(input, now),
    type: "share",
    entityType: input.entityType,
    entityId: input.entityId,
    memberId: input.memberId,
    role: input.role,
  };
}

export type CommentTargetType = ShareableEntityType | "meeting";

export interface Comment extends CanonicalEntity {
  type: "comment";
  targetType: CommentTargetType;
  targetId: ID;
  body: string;
  mentions: ID[];
  parentId: ID | null;
  edited: boolean;
  editedAt: Timestamp | null;
}

export interface NewCommentInput extends CanonicalInput {
  targetType: CommentTargetType;
  targetId: ID;
  body: string;
  mentions?: ID[];
  parentId?: ID | null;
}

export const MENTION_PATTERN = /@([a-zA-Z0-9_-]{2,64})/g;

export function extractMentions(
  body: string,
  members: Array<{ id: ID; displayName: string }>,
): ID[] {
  const mentioned = new Set<ID>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(MENTION_PATTERN.source, "g");
  while ((match = pattern.exec(body)) !== null) {
    const token = match[1]!.toLowerCase();
    for (const member of members) {
      const name = member.displayName.toLowerCase().trim();
      const compact = name.replace(/\s+/g, "");
      if (name === token || compact === token || compact.startsWith(token)) {
        mentioned.add(member.id);
      }
    }
  }
  return [...mentioned];
}

export function createComment(input: NewCommentInput, now: Timestamp = Date.now()): Comment {
  return {
    ...createCanonicalBase(input, now),
    type: "comment",
    targetType: input.targetType,
    targetId: input.targetId,
    body: input.body.trim(),
    mentions: input.mentions ?? [],
    parentId: input.parentId ?? null,
    edited: false,
    editedAt: null,
  };
}

export function editComment(comment: Comment, body: string, now: Timestamp = Date.now()): Comment {
  return {
    ...comment,
    body: body.trim(),
    edited: true,
    editedAt: now,
    updatedAt: now,
  };
}

export type AccessCheck = {
  allowed: boolean;
  role: ShareRole | "owner";
  reason: string;
};

export function mayRead(check: AccessCheck): boolean {
  return check.allowed;
}

export function mayWrite(check: AccessCheck): boolean {
  return check.allowed && (check.role === "owner" || check.role === "editor" || check.role === "admin");
}

export function mayComment(check: AccessCheck): boolean {
  return check.allowed && check.role !== "viewer";
}