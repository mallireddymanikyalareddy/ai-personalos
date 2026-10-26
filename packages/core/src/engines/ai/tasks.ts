import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import { PRIORITY } from "../../types/common";
import type { AIProposal, AIResult } from "../ai/types";

export interface TaskSubtaskSuggestion {
  title: string;
  priority: number;
  estimateMin: number | null;
  reason: string;
}

export interface TaskEstimate {
  taskId: ID;
  estimateMin: number;
  confidence: number;
  basis: "history" | "heuristic" | "priority";
  samples: number;
  note: string;
}

const COMPLEXITY_HINTS: Array<{ pattern: RegExp; minutes: number; label: string }> = [
  { pattern: /\b(research|investigate|explore|learn|read|study)\b/i, minutes: 60, label: "research work" },
  { pattern: /\b(write|draft|compose|document)\b/i, minutes: 75, label: "writing work" },
  { pattern: /\b(design|prototype|sketch|wireframe|mock)\b/i, minutes: 120, label: "design work" },
  { pattern: /\b(code|implement|build|develop|refactor|fix|debug)\b/i, minutes: 120, label: "engineering work" },
  { pattern: /\b(review|check|verify|test|audit)\b/i, minutes: 45, label: "review work" },
  { pattern: /\b(call|meet|meeting|sync|interview|1:1)\b/i, minutes: 30, label: "conversation" },
  { pattern: /\b(email|reply|send|message|follow ?up)\b/i, minutes: 15, label: "communication" },
  { pattern: /\b(plan|organi[sz]e|prepare|set ?up|arrange)\b/i, minutes: 40, label: "planning work" },
  { pattern: /\b(clean|tidy|organi[sz]e|file|sort)\b/i, minutes: 20, label: "admin work" },
];

const PRIORITY_BASE_MINUTES: Record<number, number> = {
  [PRIORITY.NONE]: 30,
  [PRIORITY.LOW]: 30,
  [PRIORITY.MEDIUM]: 60,
  [PRIORITY.HIGH]: 90,
  [PRIORITY.URGENT]: 120,
};

function splitCompoundTitle(title: string): string[] {
  const parts = title
    .split(/\s*(?:,|;|\+|\band\b|\bthen\b|&)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !/^(the|a|an|to|of|for|and|then|with)$/i.test(part));
  return parts;
}

export function decomposeTask(task: Task): TaskSubtaskSuggestion[] {
  const title = task.title.trim();
  const parts = splitCompoundTitle(title);

  if (parts.length >= 2) {
    return parts.map((part) => ({
      title: part,
      priority: task.priority,
      estimateMin: null,
      reason: "split from a compound task title",
    }));
  }

  const base = PRIORITY_BASE_MINUTES[task.priority] ?? 45;
  const outline: TaskSubtaskSuggestion[] = [
    {
      title: `Define what done looks like for "${title}"`,
      priority: task.priority,
      estimateMin: Math.max(10, Math.round(base * 0.2)),
      reason: "clarify the outcome before starting",
    },
    {
      title: `Gather inputs and references for "${title}"`,
      priority: task.priority,
      estimateMin: Math.max(10, Math.round(base * 0.25)),
      reason: "collect everything needed up front",
    },
    {
      title: `Do the main work on "${title}"`,
      priority: task.priority,
      estimateMin: base,
      reason: "the core effort",
    },
    {
      title: `Review and confirm "${title}" meets the goal`,
      priority: task.priority,
      estimateMin: Math.max(10, Math.round(base * 0.15)),
      reason: "verify before marking done",
    },
  ];

  return outline;
}

export function estimatingEnabled(): boolean {
  return true;
}

function actualDurationMinutes(task: Task): number | null {
  if (task.completedAt == null) return null;
  const start = task.startedAt ?? task.createdAt;
  if (start == null || task.completedAt <= start) return null;
  return Math.round((task.completedAt - start) / 60000);
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2));
  const tokensB = new Set(b.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared += 1;
  return shared / Math.min(tokensA.size, tokensB.size);
}

export function estimateTask(state: AppState, task: Task, now: Timestamp = Date.now()): TaskEstimate {
  if (task.estimateMin != null && task.estimateMin > 0) {
    return {
      taskId: task.id,
      estimateMin: task.estimateMin,
      confidence: 0.95,
      basis: "history",
      samples: 1,
      note: "the task carries its own estimate",
    };
  }

  const similar: Array<{ score: number; minutes: number }> = [];
  for (const other of Object.values(state.tasks)) {
    if (other.id === task.id) continue;
    if (other.status !== "done") continue;
    const minutes = actualDurationMinutes(other);
    if (minutes == null || minutes <= 0) continue;
    const score = tokenOverlap(task.title, other.title);
    if (score >= 0.34) similar.push({ score, minutes });
  }

  if (similar.length > 0) {
    similar.sort((a, b) => b.score - a.score);
    const top = similar.slice(0, 5);
    const weighted = top.reduce((sum, s) => sum + s.minutes * s.score, 0);
    const weight = top.reduce((sum, s) => sum + s.score, 0);
    const estimate = Math.max(5, Math.round(weighted / Math.max(weight, 0.0001) / 5) * 5);
    return {
      taskId: task.id,
      estimateMin: estimate,
      confidence: Math.min(0.9, 0.5 + top.length * 0.08),
      basis: "history",
      samples: top.length,
      note: `based on ${top.length} similar completed task${top.length === 1 ? "" : "s"}`,
    };
  }

  for (const hint of COMPLEXITY_HINTS) {
    if (hint.pattern.test(task.title)) {
      return {
        taskId: task.id,
        estimateMin: hint.minutes,
        confidence: 0.5,
        basis: "heuristic",
        samples: 0,
        note: `looks like ${hint.label}`,
      };
    }
  }

  return {
    taskId: task.id,
    estimateMin: PRIORITY_BASE_MINUTES[task.priority] ?? 30,
    confidence: 0.35,
    basis: "priority",
    samples: 0,
    note: "priority-based default",
  };
}

export function decomposeTaskResult(
  state: AppState,
  task: Task,
  now: Timestamp = Date.now(),
): AIResult {
  const subtasks = decomposeTask(task);
  const estimate = estimateTask(state, task, now);
  return {
    kind: "proposal",
    message: `Broken "${task.title}" into ${subtasks.length} steps (est. ${estimate.estimateMin} min).`,
    capability: "decompose_task",
    citations: [{ entityType: "task", entityId: task.id, title: task.title, quote: task.title }],
    proposals: [
      {
        capability: "decompose_task",
        title: `Add ${subtasks.length} subtasks to "${task.title}"`,
        summary: `Estimate ${estimate.estimateMin} min (${estimate.basis}, ${estimate.note}).`,
        risk: "low",
        requiresConfirmation: true,
        reasoning:
          subtasks.map((s) => s.title).join("; ") === ""
            ? "derived from the task title"
            : subtasks.map((s) => `${s.title} (${s.reason})`).join("; "),
      preview: subtasks.map((subtask) => ({
        label: subtask.title,
        detail: subtask.estimateMin != null ? `~${subtask.estimateMin} min` : "no estimate",
      })),
      refs: [{ entityType: "task", entityId: task.id }],
      payload: {
        parentTaskId: task.id,
        subtasks: subtasks.map((subtask) => ({
          title: subtask.title,
          priority: subtask.priority,
          estimateMin: subtask.estimateMin,
        })),
      },
      },
    ],
  };
}
