import type { EntityMeta, EntityType, ID, Timestamp } from "./common";
import { newId } from "./common";

export type AIObjectKind = "suggestion" | "plan" | "summary" | "insight" | "draft" | "answer";
export type AIObjectStatus = "pending" | "accepted" | "dismissed";

export interface AIObjectRef {
  entityType: EntityType;
  entityId: ID;
}

export interface AIObject extends EntityMeta {
  type: "ai_object";
  kind: AIObjectKind;
  title: string;
  body: string;
  status: AIObjectStatus;
  payload: Record<string, unknown> | null;
  refs: AIObjectRef[];
  model: string | null;
  prompt: string | null;
}

export interface NewAIObjectInput {
  kind: AIObjectKind;
  title: string;
  body?: string;
  status?: AIObjectStatus;
  payload?: Record<string, unknown> | null;
  refs?: AIObjectRef[];
  model?: string | null;
  prompt?: string | null;
}

export function createAIObject(input: NewAIObjectInput, now: Timestamp = Date.now()): AIObject {
  return {
    type: "ai_object",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    kind: input.kind,
    title: input.title.trim(),
    body: input.body ?? "",
    status: input.status ?? "pending",
    payload: input.payload ?? null,
    refs: input.refs ?? [],
    model: input.model ?? null,
    prompt: input.prompt ?? null,
  };
}
