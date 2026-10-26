export type ID = string;

export type Timestamp = number;

export type EntityType =
  | "task"
  | "event"
  | "note"
  | "capture"
  | "project"
  | "goal"
  | "habit"
  | "habit_checkin"
  | "time_block"
  | "reminder"
  | "attachment"
  | "ai_object"
  | "user"
  | "workspace"
  | "team"
  | "member"
  | "shift"
  | "approval"
  | "life_area"
  | "milestone"
  | "routine"
  | "calendar"
  | "template"
  | "tag"
  | "category"
  | "notebook"
  | "page"
  | "document"
  | "recording"
  | "transcript"
  | "meeting"
  | "action_item"
  | "journal_entry"
  | "life_memory"
  | "life_memory_item"
  | "memory_moment"
  | "folder"
  | "paper_notebook"
  | "paper_folder"
  | "paper_page"
  | "paper_layer"
  | "paper_stroke"
  | "paper_diagram"
  | "paper_recognition"
  | "achievement"
  | "xp_transaction"
  | "reward"
  | "focus_session"
  | "notification"
  | "integration"
  | "ai_conversation"
  | "ai_message"
  | "ai_insight"
  | "comment"
  | "share"
  | "shift_swap"
  | "shift_pickup"
  | "time_off"
  | "journal_template";

export interface EntityMeta {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const PRIORITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const;

export type Priority = 0 | 1 | 2 | 3 | 4;

export type ThemeSetting = "system" | "light" | "dark";

export type TaskSort = "smart" | "due" | "priority" | "created" | "title";

export function newId(): ID {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
