import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { NewTaskInput, Task } from "../../types/task";
import type { NewEventInput, CalendarEvent } from "../../types/event";
import type { NewNoteInput, Note } from "../../types/note";
import type { NewProjectInput, Project } from "../../types/project";
import type { NewMilestoneInput, Milestone } from "../../types/planning";
import type { NewHabitInput, Habit } from "../../types/habit";
import type { Meeting } from "../../types/knowledge";
import type { Transcript } from "../../types/knowledge";
import type { NewActionItemInput, ActionItem } from "../../types/knowledge";
import { addOccurrence } from "../../types/life-memory";
import type { LifeMemoryItem, NewLifeMemoryItemInput } from "../../types/life-memory";
import type { NewAIObjectInput, AIObject } from "../../types/ai-object";
import type { NewAIInsightInput, AIInsight } from "../../types/ai";
import type { PlanProposal } from "../planner";
import { applyPlan, diffPlan } from "../planner";
import type { AIProposal } from "./types";
import { authorizeProposalApply, describeAccess, hasAccess } from "./access";

export interface ProposalExecutor {
  getState(): AppState;
  addTask(input: NewTaskInput, now?: Timestamp): Task;
  addSubtask(parentId: ID, title: string, now?: Timestamp): Task | null;
  updateTask(id: ID, patch: Partial<Task>): Task | null;
  addNote(input: NewNoteInput, now?: Timestamp): Note;
  updateNote(id: ID, patch: Partial<Note>): Note | null;
  addProject(input: NewProjectInput | string, now?: Timestamp): Project;
  updateProject(id: ID, patch: Partial<Project>): Project | null;
  addMilestone(input: NewMilestoneInput, now?: Timestamp): Milestone;
  addHabit(input: NewHabitInput | string, now?: Timestamp): Habit;
  addTimeBlock(input: never, now?: Timestamp): unknown;
  updateTimeBlock(id: ID, patch: Record<string, unknown>): unknown;
  addAIObject(input: NewAIObjectInput, now?: Timestamp): AIObject;
  addInsight(input: NewAIInsightInput, now?: Timestamp): AIInsight;
  updateInsight(id: ID, patch: Partial<AIInsight>): AIInsight | null;
  updateMeeting(id: ID, patch: Partial<Meeting>): Meeting | null;
  updateTranscript(id: ID, patch: Partial<Transcript>): Transcript | null;
  addActionItem(input: NewActionItemInput, now?: Timestamp): ActionItem;
  updateActionItem(id: ID, patch: Partial<ActionItem>): ActionItem | null;
  addLifeMemoryItem(input: NewLifeMemoryItemInput, now?: Timestamp): LifeMemoryItem;
  addEvent(input: NewEventInput, now?: Timestamp): CalendarEvent;
  updateLifeMemoryItem(id: ID, patch: Partial<LifeMemoryItem>): LifeMemoryItem | null;
}

export interface ProposalApplyResult {
  ok: boolean;
  message: string;
  created: Array<{ type: string; id: ID; title: string }>;
  taskIds: ID[];
  eventIds: ID[];
  blockedByPolicy: string[];
}

function deniedResult(rule: string): ProposalApplyResult {
  return {
    ok: false,
    message: `This action was blocked by your permissions (${rule}).`,
    created: [],
    taskIds: [],
    eventIds: [],
    blockedByPolicy: [rule],
  };
}

export function applyProposal(
  executor: ProposalExecutor,
  proposal: AIProposal,
  now: Timestamp = Date.now(),
): ProposalApplyResult {
  const payload = proposal.payload ?? {};
  const kind = typeof payload.kind === "string" ? payload.kind : proposal.capability;
  const created: ProposalApplyResult["created"] = [];
  const taskIds: ID[] = [];
  const eventIds: ID[] = [];

  const guard = authorizeProposalApply({ type: "tasks", id: "ai-proposal" });
  if (!hasAccess(guard)) return deniedResult(describeAccess(guard));

  switch (kind) {
    case "decompose_task": {
      const parentId = payload.parentTaskId as ID | undefined;
      const subtasks = (payload.subtasks ?? []) as Array<{
        title: string;
        priority?: number;
        estimateMin?: number | null;
      }>;
      if (!parentId) break;
      for (const subtask of subtasks) {
        const task = executor.addSubtask(parentId, subtask.title, now);
        if (!task) continue;
        const patch: Partial<Task> = {};
        if (subtask.priority != null) patch.priority = subtask.priority as Task["priority"];
        if (subtask.estimateMin != null) patch.estimateMin = subtask.estimateMin;
        if (Object.keys(patch).length > 0) executor.updateTask(task.id, patch);
        created.push({ type: "task", id: task.id, title: task.title });
      }
      break;
    }

    case "create_task": {
      const input = payload.input as NewTaskInput | undefined;
      if (!input?.title) break;
      const task = executor.addTask(input, now);
      created.push({ type: "task", id: task.id, title: task.title });
      break;
    }

    case "create_note": {
      const input = payload.input as NewNoteInput | undefined;
      if (!input?.title) break;
      const note = executor.addNote(input, now);
      created.push({ type: "note", id: note.id, title: note.title });
      break;
    }

    case "plan": {
      const proposalData = payload.proposal as unknown as PlanProposal | undefined;
      if (!proposalData) break;
      const state = executor.getState();
      const result = applyPlan(
        {
          getState: () => executor.getState(),
          addTimeBlock: (input: Parameters<ProposalExecutor["addTimeBlock"]>[0]) =>
            executor.addTimeBlock(input, now),
          updateTimeBlock: (id: ID, patch: Parameters<ProposalExecutor["updateTimeBlock"]>[1]) =>
            executor.updateTimeBlock(id, patch),
          updateTask: (id: ID, patch: Partial<Task>) => executor.updateTask(id, patch),
        } as unknown as Parameters<typeof applyPlan>[0],
        diffPlan(state, proposalData),
      );
      for (const blockId of result.createdBlockIds) {
        created.push({ type: "time_block", id: blockId, title: "time block" });
      }
      break;
    }

    case "note_summary": {
      const noteId = payload.noteId as ID | undefined;
      if (!noteId) break;
      executor.updateNote(noteId, {
        aiSummary: String(payload.summary ?? ""),
        aiKeyPoints: (payload.keyPoints as string[] | undefined) ?? [],
      });
      created.push({ type: "note", id: noteId, title: "summary saved" });
      break;
    }

    case "insights": {
      const insights = (payload.insights ?? []) as Array<{
        kind: NewAIInsightInput["kind"];
        severity?: NewAIInsightInput["severity"];
        title: string;
        body?: string;
        confidence?: number;
        dedupeKey?: string | null;
      }>;
      for (const insight of insights) {
        const existing = Object.values(executor.getState().aiInsights).find(
          (row) => row.dedupeKey != null && row.dedupeKey === insight.dedupeKey,
        );
        if (existing) continue;
        const saved = executor.addInsight({
          kind: insight.kind,
          title: insight.title,
          body: insight.body ?? "",
          confidence: insight.confidence ?? 0.7,
          severity: insight.severity ?? "info",
          dedupeKey: insight.dedupeKey ?? null,
          refs: [],
        });
        created.push({ type: "ai_insight", id: saved.id, title: saved.title });
      }
      break;
    }

    case "ai_summary": {
      const saved = executor.addAIObject({
        kind: "summary",
        title: String(payload.title ?? "AI summary"),
        body: String(payload.summary ?? ""),
        status: "pending",
        refs: proposal.refs.map((ref) => ({ entityType: ref.entityType, entityId: ref.entityId })),
        model: "deterministic",
      });
      created.push({ type: "ai_object", id: saved.id, title: saved.title });
      break;
    }

    case "meeting_tasks": {
      const transcriptId = payload.transcriptId as ID | undefined;
      const meetingId = (payload.meetingId as ID | null | undefined) ?? null;
      const items = (payload.actionItems ?? []) as Array<{
        title: string;
        transcriptId?: ID;
        segmentIndex?: number | null;
        confidence?: number;
      }>;
      for (const item of items) {
        const task = executor.addTask(
          {
            title: item.title,
            status: "inbox",
            goalIds: [],
            tags: [],
          },
          now,
        );
        if (transcriptId || meetingId) {
          const actionItem = executor.addActionItem(
            {
              title: item.title,
              transcriptId: transcriptId ?? null,
              meetingId: meetingId ?? null,
            },
            now,
          );
          executor.updateActionItem(actionItem.id, { taskId: task.id });
          created.push({ type: "action_item", id: actionItem.id, title: actionItem.title });
        }
        created.push({ type: "task", id: task.id, title: task.title });
      }
      break;
    }

    case "meeting_summary": {
      const meetingId = payload.meetingId as ID | undefined;
      if (!meetingId) break;
      const meeting = executor.getState().meetings[meetingId] as Meeting | undefined;
      if (!meeting) break;
      executor.updateMeeting(meetingId, {
        aiSummary: String(payload.summary ?? ""),
        aiKeyPoints: (payload.keyPoints as string[] | undefined) ?? [],
        aiDecisions: (payload.decisions as string[] | undefined) ?? [],
      });
      created.push({ type: "meeting", id: meeting.id, title: meeting.title });
      break;
    }

    case "transcript_processing": {
      const transcriptId = payload.transcriptId as ID | undefined;
      if (!transcriptId) break;
      const transcript = executor.getState().transcripts[transcriptId] as Transcript | undefined;
      if (!transcript) break;
      const analysis = payload.analysis as
        | { summary: string; keyPoints: string[]; decisions: string[]; actionItems: Array<{ title: string }> }
        | undefined;
      if (analysis) {
        executor.updateTranscript(transcriptId, {
          aiSummary: analysis.summary,
          aiKeyPoints: analysis.keyPoints,
          aiDecisions: analysis.decisions,
          aiActionItems: analysis.actionItems.map((item) => item.title),
          status: "ready",
        });
      }
      created.push({ type: "transcript", id: transcript.id, title: transcript.title });
      break;
    }

    case "goal_projects":
    case "decompose_goal": {
      const projects = (payload.projects ?? []) as Array<{ name: string; goalIds?: ID[] }>;
      const goalId = payload.goalId as ID | undefined;
      const createdProjectIds: ID[] = [];
      for (const project of projects) {
        const saved = executor.addProject({ name: project.name, goalIds: project.goalIds ?? (goalId ? [goalId] : []) }, now);
        createdProjectIds.push(saved.id);
        created.push({ type: "project", id: saved.id, title: saved.name });
      }

      const milestones = (payload.milestones ?? []) as Array<{ title: string }>;
      const projectIndex = typeof payload.projectIndex === "number" ? payload.projectIndex : 0;
      if (milestones.length > 0 && createdProjectIds[projectIndex]) {
        for (const milestone of milestones) {
          const saved = executor.addMilestone(
            { projectId: createdProjectIds[projectIndex]!, title: milestone.title },
            now,
          );
          created.push({ type: "milestone", id: saved.id, title: saved.title });
        }
      }

      const tasks = (payload.tasks ?? []) as Array<{
        title: string;
        priority?: number;
        estimateMin?: number | null;
        goalIds?: ID[];
      }>;
      for (const task of tasks) {
        const saved = executor.addTask(
          {
            title: task.title,
            status: "open",
            priority: (task.priority ?? 2) as Task["priority"],
            goalIds: task.goalIds ?? (goalId ? [goalId] : []),
            ...(task.estimateMin != null ? { estimateMin: task.estimateMin } : {}),
            ...(createdProjectIds[projectIndex] ? { projectId: createdProjectIds[projectIndex] } : {}),
          },
          now,
        );
        created.push({ type: "task", id: saved.id, title: saved.title });
      }

      const habits = (payload.habits ?? []) as Array<{ title: string; cadence?: Habit["cadence"]; goalId?: ID | null }>;
      for (const habit of habits) {
        const saved = executor.addHabit(
          { title: habit.title, cadence: habit.cadence ?? "daily", goalId: habit.goalId ?? goalId ?? null },
          now,
        );
        created.push({ type: "habit", id: saved.id, title: saved.title });
      }
      break;
    }

    case "life_memory_completion": {
      const itemId = payload.itemId as ID | undefined;
      if (!itemId) break;
      const item = executor.getState().lifeMemoryItems[itemId];
      if (!item) break;
      const updated = addOccurrence(
        item,
        {
          completedAt: (payload.completedAt as Timestamp | undefined) ?? now,
          note: String(payload.note ?? ""),
          attachmentIds: (payload.attachmentIds as ID[] | undefined) ?? [],
        },
        now,
      );
      executor.updateLifeMemoryItem(itemId, updated);
      created.push({ type: "life_memory_item", id: item.id, title: item.title });
      break;
    }

    case "life_memory_create": {
      const title = String(payload.title ?? "").trim();
      if (!title) break;
      const created2 = executor.addLifeMemoryItem(
        {
          title,
          description: "",
          category: "other",
          firstCompletionAt: (payload.completedAt as Timestamp | undefined) ?? now,
          firstCompletionNote: String(payload.note ?? ""),
        },
        now,
      );
      created.push({ type: "life_memory_item", id: created2.id, title: created2.title });
      break;
    }

    case "meeting_task": {
      const title = String(payload.title ?? "").trim();
      if (!title) break;
      const meetingId = (payload.meetingId as ID | null | undefined) ?? null;
      const input = {
        title,
        status: payload.dueAt != null ? ("open" as const) : ("inbox" as const),
        priority: 2,
        goalIds: [],
        tags: [] as string[],
        ...(payload.dueAt != null ? { dueAt: payload.dueAt as Timestamp } : {}),
        ...(payload.estimateMin != null ? { estimateMin: payload.estimateMin as number } : {}),
      };
      const task = executor.addTask(input as NewTaskInput, now);
      if (meetingId || payload.transcriptId) {
        const item = executor.addActionItem(
          {
            title,
            transcriptId: (payload.transcriptId as ID | null | undefined) ?? null,
            meetingId,
            dueAt: (payload.dueAt as Timestamp | null | undefined) ?? null,
          },
          now,
        );
        executor.updateActionItem(item.id, { taskId: task.id });
        created.push({ type: "action_item", id: item.id, title: item.title });
      }
      taskIds.push(task.id);
      created.push({ type: "task", id: task.id, title: task.title });
      break;
    }

    case "meeting_event": {
      const title = String(payload.title ?? "").trim();
      const startsAt = payload.startsAt as Timestamp | undefined;
      const endsAt = payload.endsAt as Timestamp | undefined;
      if (!title || startsAt == null || endsAt == null) break;
      const event = executor.addEvent(
        {
          title,
          startsAt,
          endsAt,
          source: "ai",
          notes: `Created from a meeting action item (${payload.transcriptId ? "transcript linked" : "meeting"}).`,
        },
        now,
      );
      eventIds.push(event.id);
      created.push({ type: "event", id: event.id, title: event.title });
      break;
    }

    default:
      return {
        ok: false,
        message: `I do not know how to apply "${kind}" yet.`,
        created: [],
        taskIds: [],
        eventIds: [],
        blockedByPolicy: [],
      };
  }

  if (created.length === 0) {
    return {
      ok: false,
      message: "Nothing needed changing — the proposal is already applied or empty.",
      created,
      taskIds: [],
      eventIds: [],
      blockedByPolicy: [],
    };
  }

  return {
    ok: true,
    message: `Applied: ${created.map((item) => item.title).join(", ")}.`,
    created,
    taskIds,
    eventIds,
    blockedByPolicy: [],
  };
}