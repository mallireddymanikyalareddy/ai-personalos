import type { ID, Timestamp } from "../../types/common";
import type { EntityRef } from "../../types/base";
import type { Actor } from "../../policy/policy";

export type AICapability =
  | "create_task"
  | "create_note"
  | "decompose_task"
  | "estimate_task"
  | "decompose_goal"
  | "plan_day"
  | "optimize_schedule"
  | "reschedule"
  | "summarize_note"
  | "semantic_search"
  | "answer_question"
  | "weekly_review"
  | "insights"
  | "recommendations"
  | "voice_command"
  | "meeting_intelligence"
  | "life_memory"
  | "log_life_event"
  | "journal_summarize"
  | "journal_extract_tasks"
  | "journal_extract_goals"
  | "journal_detect_mood"
  | "journal_tomorrow"
  | "journal_extract_highlights"
  | "journal_create_memory"
  | "notebook_outline"
  | "notebook_continue"
  | "notebook_summarize"
  | "notebook_backlinks"
  | "notebook_extract_notes";

export type AIResponseKind = "answer" | "proposal" | "error";

export type ProposalRisk = "low" | "medium" | "high";

export interface AIContextCounts {
  openTasks: number;
  overdueTasks: number;
  todayTasks: number;
  activeGoals: number;
  activeHabits: number;
  notes: number;
  todayEvents: number;
  todayMeetings: number;
  trashedNotes: number;
}

export interface AIContextBundle {
  now: Timestamp;
  actor: Actor;
  counts: AIContextCounts;
  authorizedIds: string[];
  authorizedTypes: Record<string, number>;
  windows: {
    today: { from: Timestamp; to: Timestamp };
    week: { from: Timestamp; to: Timestamp };
  };
  access: {
    tasks: boolean;
    calendar: boolean;
    goals: boolean;
    habits: boolean;
    notes: boolean;
    meetings: boolean;
    lifeMemory: boolean;
    preferences: boolean;
  };
  deniedCount: number;
}

export interface AiIntent {
  capability: AICapability;
  confidence: number;
  slots: Record<string, string>;
  targets: ID[];
  raw: string;
  reason: string;
}

export interface AIProposalPreviewItem {
  label: string;
  detail?: string;
}

export interface AIProposal {
  capability: AICapability;
  title: string;
  summary: string;
  risk: ProposalRisk;
  requiresConfirmation: boolean;
  preview: AIProposalPreviewItem[];
  refs: EntityRef[];
  payload: Record<string, unknown>;
  reasoning: string;
}

export interface AICitation {
  entityType: EntityRef["entityType"];
  entityId: ID;
  title: string;
  quote: string;
}

export interface AISuggestionItem {
  title: string;
  detail: string;
}

export interface AIResult {
  kind: AIResponseKind;
  message: string;
  capability: AICapability;
  citations: AICitation[];
  proposals: AIProposal[];
  data?: unknown;
  access?: AIContextBundle["access"];
  contextCounts?: AIContextCounts;
}

export interface AssistantRequest {
  input: string;
  now?: Timestamp;
  conversationId?: ID | null;
}

export interface AIConfirmationRules {
  proposeAllWrites: boolean;
  autoConfirmSingle: boolean;
}

export const DEFAULT_CONFIRMATION_RULES: AIConfirmationRules = {
  proposeAllWrites: true,
  autoConfirmSingle: false,
};

export function riskForCapability(capability: AICapability): ProposalRisk {
  switch (capability) {
    case "plan_day":
    case "optimize_schedule":
    case "reschedule":
      return "high";
    case "decompose_goal":
    case "meeting_intelligence":
      return "medium";
    case "create_task":
    case "create_note":
    case "decompose_task":
      return "low";
    default:
      return "low";
  }
}

export function requiresConfirmation(capability: AICapability, rules = DEFAULT_CONFIRMATION_RULES): boolean {
  if (!rules.proposeAllWrites && rules.autoConfirmSingle) {
    return riskForCapability(capability) !== "low";
  }
  return riskForCapability(capability) !== "low" || rules.proposeAllWrites;
}
