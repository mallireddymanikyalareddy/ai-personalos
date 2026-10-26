import type { AppState, CollectionName } from "../store/state";
import type { EntityType, ID } from "../types/common";

export type DeleteRule = "nullify" | "cascade" | "block";

export interface RefRule {
  from: CollectionName;
  field: string;
  to: CollectionName;
  onDelete: DeleteRule;
  many?: boolean;
}

export const REF_RULES: RefRule[] = [
  { from: "projects", field: "goalIds", to: "goals", onDelete: "nullify", many: true },
  { from: "tasks", field: "projectId", to: "projects", onDelete: "nullify" },
  { from: "tasks", field: "goalIds", to: "goals", onDelete: "nullify", many: true },
  { from: "tasks", field: "milestoneId", to: "milestones", onDelete: "nullify" },
  { from: "tasks", field: "parentTaskId", to: "tasks", onDelete: "cascade" },
  { from: "tasks", field: "habitId", to: "habits", onDelete: "nullify" },
  { from: "tasks", field: "routineId", to: "routines", onDelete: "nullify" },
  { from: "tasks", field: "calendarId", to: "calendars", onDelete: "nullify" },
  { from: "tasks", field: "lifeAreaId", to: "lifeAreas", onDelete: "nullify" },
  { from: "tasks", field: "categoryId", to: "categories", onDelete: "nullify" },
  { from: "tasks", field: "assigneeId", to: "members", onDelete: "nullify" },
  { from: "tasks", field: "workspaceId", to: "workspaces", onDelete: "cascade" },
  { from: "events", field: "taskId", to: "tasks", onDelete: "nullify" },
  { from: "events", field: "projectId", to: "projects", onDelete: "nullify" },
  { from: "events", field: "calendarId", to: "calendars", onDelete: "nullify" },
  { from: "notes", field: "projectId", to: "projects", onDelete: "nullify" },
  { from: "notes", field: "goalIds", to: "goals", onDelete: "nullify", many: true },
  { from: "habits", field: "goalId", to: "goals", onDelete: "nullify" },
  { from: "goals", field: "lifeAreaId", to: "lifeAreas", onDelete: "nullify" },
  { from: "habitCheckins", field: "habitId", to: "habits", onDelete: "cascade" },
  { from: "habitCheckins", field: "taskId", to: "tasks", onDelete: "nullify" },
  { from: "timeBlocks", field: "taskId", to: "tasks", onDelete: "nullify" },
  { from: "timeBlocks", field: "eventId", to: "events", onDelete: "nullify" },
  { from: "reminders", field: "taskId", to: "tasks", onDelete: "cascade" },
  { from: "reminders", field: "eventId", to: "events", onDelete: "cascade" },
  { from: "reminders", field: "habitId", to: "habits", onDelete: "cascade" },
  { from: "milestones", field: "projectId", to: "projects", onDelete: "cascade" },
    { from: "pages", field: "notebookId", to: "notebooks", onDelete: "cascade" },
    { from: "paperPages", field: "notebookId", to: "paperNotebooks", onDelete: "cascade" },
    { from: "paperPages", field: "folderId", to: "paperFolders", onDelete: "nullify" },
  { from: "documents", field: "attachmentId", to: "attachments", onDelete: "nullify" },
  { from: "recordings", field: "meetingId", to: "meetings", onDelete: "nullify" },
  { from: "transcripts", field: "meetingId", to: "meetings", onDelete: "nullify" },
  { from: "transcripts", field: "recordingId", to: "recordings", onDelete: "nullify" },
  { from: "meetings", field: "eventId", to: "events", onDelete: "nullify" },
  { from: "meetings", field: "projectId", to: "projects", onDelete: "nullify" },
  { from: "actionItems", field: "transcriptId", to: "transcripts", onDelete: "nullify" },
  { from: "actionItems", field: "meetingId", to: "meetings", onDelete: "nullify" },
  { from: "actionItems", field: "taskId", to: "tasks", onDelete: "nullify" },
  { from: "focusSessions", field: "taskId", to: "tasks", onDelete: "nullify" },
  { from: "focusSessions", field: "timeBlockId", to: "timeBlocks", onDelete: "nullify" },
  { from: "members", field: "userId", to: "users", onDelete: "nullify" },
  { from: "members", field: "teamId", to: "teams", onDelete: "nullify" },
  { from: "shifts", field: "memberId", to: "members", onDelete: "cascade" },
  { from: "approvals", field: "requesterId", to: "members", onDelete: "nullify" },
  { from: "approvals", field: "approverId", to: "members", onDelete: "nullify" },
  { from: "aiMessages", field: "conversationId", to: "aiConversations", onDelete: "cascade" },
  { from: "routines", field: "lifeAreaId", to: "lifeAreas", onDelete: "nullify" },
  { from: "categories", field: "parentId", to: "categories", onDelete: "nullify" },
];

export interface PolymorphicRefRule {
  from: CollectionName;
  ownerField: string;
  idField: string;
  onDelete: DeleteRule;
  soft?: boolean;
}

export const POLYMORPHIC_REFS: PolymorphicRefRule[] = [
  { from: "attachments", ownerField: "ownerType", idField: "ownerId", onDelete: "cascade" },
  { from: "xpTransactions", ownerField: "entityType", idField: "entityId", onDelete: "nullify" },
  { from: "notifications", ownerField: "entityType", idField: "entityId", onDelete: "nullify" },
  { from: "approvals", ownerField: "entityType", idField: "entityId", onDelete: "nullify" },
  { from: "aiObjects", ownerField: "refs", idField: "refs", onDelete: "nullify", soft: true },
  { from: "aiInsights", ownerField: "refs", idField: "refs", onDelete: "nullify", soft: true },
  { from: "aiMessages", ownerField: "refs", idField: "refs", onDelete: "nullify", soft: true },
  { from: "aiConversations", ownerField: "contextRefs", idField: "contextRefs", onDelete: "nullify", soft: true },
  { from: "lifeMemories", ownerField: "sourceRefs", idField: "sourceRefs", onDelete: "nullify", soft: true },
];

export const ENTITY_COLLECTION: Record<EntityType, CollectionName> = {
  task: "tasks",
  event: "events",
  note: "notes",
  capture: "captures",
  project: "projects",
  goal: "goals",
  habit: "habits",
  habit_checkin: "habitCheckins",
  time_block: "timeBlocks",
  reminder: "reminders",
  attachment: "attachments",
  ai_object: "aiObjects",
  user: "users",
  workspace: "workspaces",
  team: "teams",
  member: "members",
  shift: "shifts",
  approval: "approvals",
  life_area: "lifeAreas",
  milestone: "milestones",
  routine: "routines",
  calendar: "calendars",
  template: "templates",
  tag: "tags",
  category: "categories",
  notebook: "notebooks",
  page: "pages",
  document: "documents",
  recording: "recordings",
  transcript: "transcripts",
  meeting: "meetings",
  action_item: "actionItems",
  journal_entry: "journalEntries",
  journal_template: "journalTemplates",
  life_memory: "lifeMemories",
  life_memory_item: "lifeMemoryItems",
  memory_moment: "memoryMoments",
  paper_notebook: "paperNotebooks",
  paper_folder: "paperFolders",
  paper_page: "paperPages",
  paper_layer: "paperLayers",
  paper_stroke: "paperStrokes",
  paper_diagram: "paperDiagrams",
  paper_recognition: "paperRecognitions",
  folder: "folders",
  achievement: "achievements",
  xp_transaction: "xpTransactions",
  reward: "rewards",
  focus_session: "focusSessions",
  notification: "notifications",
  integration: "integrations",
  ai_conversation: "aiConversations",
  ai_message: "aiMessages",
  ai_insight: "aiInsights",
  comment: "comments",
  share: "shares",
  shift_swap: "shiftSwaps",
  shift_pickup: "shiftPickups",
  time_off: "timeOffRequests",
};

export interface DanglingRef {
  collection: CollectionName;
  id: ID;
  field: string;
  target: CollectionName;
  targetId: ID;
}

function exists(state: AppState, collection: CollectionName, id: ID): boolean {
  const map = state[collection] as Record<ID, unknown>;
  return id in map;
}

export function findDanglingRefs(state: AppState): DanglingRef[] {
  const dangling: DanglingRef[] = [];

  for (const rule of REF_RULES) {
    const rows = Object.values(state[rule.from] as unknown as Record<ID, Record<string, unknown>>);
    for (const row of rows) {
      const raw = row[rule.field];
      if (raw == null) continue;
      const ids = rule.many ? (Array.isArray(raw) ? raw : []) : [raw];
      for (const targetId of ids) {
        if (typeof targetId !== "string") continue;
        if (!exists(state, rule.to, targetId)) {
          dangling.push({
            collection: rule.from,
            id: row.id as ID,
            field: rule.field,
            target: rule.to,
            targetId,
          });
        }
      }
    }
  }

  for (const rule of POLYMORPHIC_REFS) {
    if (rule.soft) continue;
    const rows = Object.values(state[rule.from] as unknown as Record<ID, Record<string, unknown>>);
    for (const row of rows) {
      const entityType = row[rule.ownerField];
      const targetId = row[rule.idField];
      if (typeof entityType !== "string" || typeof targetId !== "string") continue;
      const target = ENTITY_COLLECTION[entityType as EntityType];
      if (!target) continue;
      if (!exists(state, target, targetId)) {
        dangling.push({
          collection: rule.from,
          id: row.id as ID,
          field: rule.idField,
          target,
          targetId,
        });
      }
    }
  }

  return dangling;
}

export interface CascadePlan {
  remove: Array<{ collection: CollectionName; id: ID }>;
  nullify: Array<{ collection: CollectionName; id: ID; field: string; many?: boolean }>;
}

export function planCascade(
  state: AppState,
  collection: CollectionName,
  id: ID,
): CascadePlan {
  const plan: CascadePlan = { remove: [], nullify: [] };
  const visited = new Set<string>([`${collection}:${id}`]);

  const visit = (col: CollectionName, targetId: ID): void => {
    for (const rule of REF_RULES) {
      if (rule.to !== col) continue;
      const rows = Object.values(state[rule.from] as unknown as Record<ID, Record<string, unknown>>);
      for (const row of rows) {
        const raw = row[rule.field];
        if (raw == null) continue;
        const hit = rule.many
          ? Array.isArray(raw) && raw.includes(targetId)
          : raw === targetId;
        if (!hit) continue;
        const rowId = row.id as ID;
        if (rule.onDelete === "cascade") {
          const key = `${rule.from}:${rowId}`;
          if (visited.has(key)) continue;
          visited.add(key);
          plan.remove.push({ collection: rule.from, id: rowId });
          visit(rule.from, rowId);
        } else {
          plan.nullify.push({
            collection: rule.from,
            id: rowId,
            field: rule.field,
            ...(rule.many ? { many: true } : {}),
          });
        }
      }
    }

    for (const rule of POLYMORPHIC_REFS) {
      if (rule.soft) continue;
      const rows = Object.values(state[rule.from] as unknown as Record<ID, Record<string, unknown>>);
      for (const row of rows) {
        const entityType = row[rule.ownerField];
        const rowTargetId = row[rule.idField];
        if (typeof entityType !== "string" || rowTargetId !== targetId) continue;
        if (ENTITY_COLLECTION[entityType as EntityType] !== col) continue;
        const rowId = row.id as ID;
        if (rule.onDelete === "cascade") {
          const key = `${rule.from}:${rowId}`;
          if (visited.has(key)) continue;
          visited.add(key);
          plan.remove.push({ collection: rule.from, id: rowId });
        } else {
          plan.nullify.push({ collection: rule.from, id: rowId, field: rule.idField });
        }
      }
    }
  };

  plan.remove.push({ collection, id });
  visit(collection, id);
  return plan;
}
