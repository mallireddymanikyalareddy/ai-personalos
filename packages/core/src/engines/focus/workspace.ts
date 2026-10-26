import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { FocusSession } from "../../types/engagement";

import { DAY_MS, startOfDay } from "../date-utils";
import { focusSessionActiveMs } from "./stats";

export type FocusEnvironmentId = "nature" | "library" | "office" | "cafe";

export interface FocusEnvironment {
  id: FocusEnvironmentId;
  label: string;
  blurb: string;
  ambient: "none" | "white" | "brown" | "rain" | "waves";
  gradient: string;
  accent: string;
}

export const FOCUS_ENVIRONMENTS: readonly FocusEnvironment[] = [
  {
    id: "nature",
    label: "Nature",
    blurb: "Green and open air",
    ambient: "waves",
    gradient: "linear-gradient(140deg, #0f3d33 0%, #14584a 45%, #2f7d63 100%)",
    accent: "#4ade9b",
  },
  {
    id: "library",
    label: "Library",
    blurb: "Warm, quiet, studious",
    ambient: "brown",
    gradient: "linear-gradient(140deg, #3a2a1d 0%, #5c4130 45%, #8a6547 100%)",
    accent: "#e0b183",
  },
  {
    id: "office",
    label: "Office",
    blurb: "Cool and structured",
    ambient: "white",
    gradient: "linear-gradient(140deg, #1b2733 0%, #27414f 45%, #3d6478 100%)",
    accent: "#7dd3fc",
  },
  {
    id: "cafe",
    label: "Café",
    blurb: "Low hum, soft light",
    ambient: "rain",
    gradient: "linear-gradient(140deg, #3d2a1c 0%, #6b4423 45%, #a9713c 100%)",
    accent: "#fbbf72",
  },
];

export function focusEnvironment(id: string): FocusEnvironment {
  return FOCUS_ENVIRONMENTS.find((entry) => entry.id === id) ?? FOCUS_ENVIRONMENTS[0]!;
}

/* ------------------------------------------------------------------ */
/* Streak                                                              */
/* ------------------------------------------------------------------ */

export interface FocusStreak {
  current: number;
  longest: number;
  activeToday: boolean;
  lastSessionAt: Timestamp | null;
  totalDays: number;
}

export interface FocusStreakDay {
  day: Timestamp;
  label: string;
  minutes: number;
  active: boolean;
}

function sessionDayMinutes(sessions: FocusSession[], now: Timestamp): Map<Timestamp, number> {
  const map = new Map<Timestamp, number>();
  for (const session of sessions) {
    if (session.status === "aborted") continue;
    const minutes = Math.round(focusSessionActiveMs(session, now) / 60000);
    if (minutes <= 0) continue;
    const day = startOfDay(session.startedAt);
    map.set(day, (map.get(day) ?? 0) + minutes);
  }
  return map;
}

export function focusStreak(
  state: AppState,
  now: Timestamp = Date.now(),
  minimumMinutes = 1,
): FocusStreak {
  const sessions = Object.values(state.focusSessions);
  const byDay = sessionDayMinutes(sessions, now);
  const days = [...byDay.keys()].sort((a, b) => a - b);

  const qualifying = days.filter((day) => (byDay.get(day) ?? 0) >= minimumMinutes);

  const today = startOfDay(now);
  const activeToday = qualifying.includes(today);

  let current = 0;
  let cursor = today;
  if (!activeToday) cursor -= DAY_MS;
  while (qualifying.includes(cursor)) {
    current += 1;
    cursor -= DAY_MS;
  }

  let longest = 0;
  let run = 0;
  let previous: Timestamp | null = null;
  for (const day of qualifying) {
    if (previous !== null && day - previous === DAY_MS) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const lastSessionAt = sessions.reduce<Timestamp | null>(
    (latest, session) => (latest == null || session.startedAt > latest ? session.startedAt : latest),
    null,
  );

  return { current, longest, activeToday, lastSessionAt, totalDays: qualifying.length };
}

export function focusStreakWeek(
  state: AppState,
  now: Timestamp = Date.now(),
): FocusStreakDay[] {
  const byDay = sessionDayMinutes(Object.values(state.focusSessions), now);
  const today = startOfDay(now);
  const weekStart = today - 6 * DAY_MS;

  return Array.from({ length: 7 }, (_, index) => {
    const day = weekStart + index * DAY_MS;
    const minutes = byDay.get(day) ?? 0;
    return {
      day,
      label: new Date(day).toLocaleDateString(undefined, { weekday: "narrow" }),
      minutes,
      active: minutes > 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

export interface FocusPlanSlot {
  id: ID;
  timeBlockId: ID;
  start: Timestamp;
  end: Timestamp;
  title: string;
  taskId: ID | null;
  taskTitle: string | null;
  priority: number;
  done: boolean;
  minutes: number;
}

export function focusPlanForDay(
  state: AppState,
  day: Timestamp,
): FocusPlanSlot[] {
  const start = startOfDay(day);
  const end = start + DAY_MS - 1;

  return Object.values(state.timeBlocks)
    .filter((block) => block.startsAt >= start && block.startsAt <= end)
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((block) => {
      const task = block.taskId != null ? (state.tasks[block.taskId] ?? null) : null;
      return {
        id: block.id,
        timeBlockId: block.id,
        start: block.startsAt,
        end: block.endsAt,
        title: task?.title ?? block.title,
        taskId: block.taskId ?? null,
        taskTitle: task?.title ?? null,
        priority: task?.priority ?? 0,
        done: block.completedAt != null || task?.status === "done",
        minutes: Math.max(0, Math.round((block.endsAt - block.startsAt) / 60000)),
      };
    });
}

export interface FocusTaskRow {
  id: ID;
  title: string;
  done: boolean;
  priority: number;
  plannedMin: number;
  focusedMin: number;
  projectName: string | null;
}

export function focusTasksForDay(
  state: AppState,
  day: Timestamp,
  now: Timestamp = Date.now(),
): FocusTaskRow[] {
  const start = startOfDay(day);
  const end = start + DAY_MS - 1;
  const focused = new Map<ID, number>();

  for (const session of Object.values(state.focusSessions)) {
    if (session.taskId == null) continue;
    if (session.startedAt < start || session.startedAt > end) continue;
    const minutes = Math.round(focusSessionActiveMs(session, now) / 60000);
    focused.set(session.taskId, (focused.get(session.taskId) ?? 0) + minutes);
  }

  const taskIds = new Set<ID>(focused.keys());

  for (const block of Object.values(state.timeBlocks)) {
    if (block.startsAt < start || block.startsAt > end) continue;
    if (block.taskId != null) taskIds.add(block.taskId);
  }

  const scheduled = Object.values(state.tasks).filter(
    (task) =>
      task.dueAt != null &&
      task.dueAt >= start &&
      task.dueAt <= end &&
      task.status !== "archived" &&
      task.status !== "cancelled",
  );
  for (const task of scheduled) taskIds.add(task.id);

  return [...taskIds]
    .map((id) => state.tasks[id])
    .filter((task): task is NonNullable<typeof task> => task != null)
    .map((task) => ({
      id: task.id,
      title: task.title,
      done: task.status === "done",
      priority: task.priority,
      plannedMin: task.estimateMin ?? 0,
      focusedMin: focused.get(task.id) ?? 0,
      projectName: task.projectId != null ? (state.projects[task.projectId]?.name ?? null) : null,
    }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.focusedMin - a.focusedMin;
    });
}

export interface FocusSlice {
  label: string;
  minutes: number;
  kind: "deep" | "task" | "study" | "planning" | "other";
}

export function focusBreakdownToday(
  state: AppState,
  now: Timestamp = Date.now(),
): FocusSlice[] {
  const start = startOfDay(now);
  const slices = new Map<FocusSlice["kind"], number>();

  for (const session of Object.values(state.focusSessions)) {
    if (session.startedAt < start) continue;
    if (session.status === "aborted") continue;
    const minutes = Math.round(focusSessionActiveMs(session, now) / 60000);
    if (minutes <= 0) continue;

    let kind: FocusSlice["kind"] = "other";
    if (session.taskId != null) {
      const task = state.tasks[session.taskId];
      if (task?.tags.some((tag) => /learn|study|read|course/i.test(tag))) kind = "study";
      else if (task?.projectId != null) kind = "task";
      else kind = "task";
    } else if (session.goalId != null) {
      kind = "planning";
    } else if ((session.plannedMin ?? 0) >= 45) {
      kind = "deep";
    }

    slices.set(kind, (slices.get(kind) ?? 0) + minutes);
  }

  const labels: Record<FocusSlice["kind"], string> = {
    deep: "Deep Work",
    task: "Tasks",
    study: "Study",
    planning: "Planning",
    other: "Other",
  };

  return (["deep", "task", "study", "planning", "other"] as FocusSlice["kind"][])
    .map((kind) => ({ kind, label: labels[kind], minutes: slices.get(kind) ?? 0 }))
    .filter((slice) => slice.minutes > 0);
}
