import type { EntityType, ID, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput, EntityRef } from "./base";
import { createCanonicalBase } from "./base";

export type AIConversationStatus = "active" | "archived";

export interface NewAIConversationInput extends CanonicalInput {
  title?: string;
  model?: string | null;
  contextRefs?: EntityRef[];
}

export interface AIConversation extends CanonicalEntity {
  type: "ai_conversation";
  title: string;
  summary: string;
  model: string | null;
  pinnedAt: Timestamp | null;
  lastMessageAt: Timestamp | null;
  contextRefs: EntityRef[];
  status: AIConversationStatus;
}

export function createAIConversation(
  input: NewAIConversationInput,
  now: Timestamp = Date.now(),
): AIConversation {
  return {
    ...createCanonicalBase({ ...input, origin: input.origin ?? "ai" }, now),
    type: "ai_conversation",
    title: input.title?.trim() || "New conversation",
    summary: "",
    model: input.model ?? null,
    pinnedAt: null,
    lastMessageAt: null,
    contextRefs: input.contextRefs ?? [],
    status: "active",
  };
}

export type AIMessageRole = "user" | "assistant" | "system";

export type AIMessageStatus = "complete" | "streaming" | "error";

export type AIMessageFeedback = "up" | "down";

export interface AIMessageResult {
  kind: "answer" | "proposal" | "error";
  capability: string;
  citations: Array<{ entityType: EntityType; entityId: ID; title: string; quote: string }>;
  data?: unknown;
}

export interface NewAIMessageInput extends CanonicalInput {
  conversationId: ID;
  role: AIMessageRole;
  content: string;
  model?: string | null;
  refs?: EntityRef[];
  result?: AIMessageResult | null;
  feedback?: AIMessageFeedback | null;
}

export interface AIMessage extends CanonicalEntity {
  type: "ai_message";
  conversationId: ID;
  role: AIMessageRole;
  content: string;
  model: string | null;
  tokens: number | null;
  refs: EntityRef[];
  result: AIMessageResult | null;
  feedback: AIMessageFeedback | null;
  status: AIMessageStatus;
}

export function createAIMessage(input: NewAIMessageInput, now: Timestamp = Date.now()): AIMessage {
  return {
    ...createCanonicalBase({ ...input, origin: "ai" }, now),
    type: "ai_message",
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    model: input.model ?? null,
    tokens: null,
    refs: input.refs ?? [],
    result: input.result ?? null,
    feedback: input.feedback ?? null,
    status: "complete",
  };
}

export type AIInsightKind = "trend" | "risk" | "suggestion" | "summary";

export type AIInsightSeverity = "info" | "warning" | "action";

export type AIInsightStatus = "pending" | "read" | "acted" | "dismissed";

export interface NewAIInsightInput extends CanonicalInput {
  kind: AIInsightKind;
  title: string;
  body?: string;
  refs?: EntityRef[];
  confidence?: number;
  severity?: AIInsightSeverity;
  dedupeKey?: string | null;
}

export interface AIInsight extends CanonicalEntity {
  type: "ai_insight";
  kind: AIInsightKind;
  title: string;
  body: string;
  refs: EntityRef[];
  confidence: number;
  severity: AIInsightSeverity;
  dedupeKey: string | null;
  readAt: Timestamp | null;
  status: AIInsightStatus;
}

export function createAIInsight(input: NewAIInsightInput, now: Timestamp = Date.now()): AIInsight {
  return {
    ...createCanonicalBase({ ...input, origin: "ai" }, now),
    type: "ai_insight",
    kind: input.kind,
    title: input.title.trim(),
    body: input.body ?? "",
    refs: input.refs ?? [],
    confidence: input.confidence ?? 1,
    severity: input.severity ?? "info",
    dedupeKey: input.dedupeKey ?? null,
    readAt: null,
    status: "pending",
  };
}
