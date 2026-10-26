import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Milestone } from "../../types/planning";

import { milestonesFor } from "./progress";

const DAY = 86_400_000;

export interface TimelineRange {
  start: Timestamp;
  end: Timestamp;
  days: number;
}

export interface TimelineSpan {
  milestone: Milestone;
  start: Timestamp;
  end: Timestamp;
  percent: number;
  complete: boolean;
  overdue: boolean;
}

export interface TimelinePosition {
  left: number;
  width: number;
}

function startOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function milestoneTasks(state: AppState, milestoneId: ID) {
  return Object.values(state.tasks).filter(
    (task) =>
      task.milestoneId === milestoneId &&
      task.status !== "archived" &&
      task.status !== "cancelled",
  );
}

export function milestoneStart(state: AppState, milestone: Milestone): Timestamp {
  const dates: Timestamp[] = [milestone.createdAt];
  for (const task of milestoneTasks(state, milestone.id)) {
    if (task.dueAt != null) dates.push(task.dueAt);
    if (task.scheduledAt != null) dates.push(task.scheduledAt);
    if (task.startedAt != null) dates.push(task.startedAt);
  }
  return startOfDay(Math.min(...dates));
}

export function milestoneEnd(state: AppState, milestone: Milestone): Timestamp {
  const dates: Timestamp[] = [];
  if (milestone.dueAt != null) dates.push(milestone.dueAt);
  for (const task of milestoneTasks(state, milestone.id)) {
    if (task.dueAt != null) dates.push(task.dueAt);
    if (task.completedAt != null) dates.push(task.completedAt);
  }
  const latest = dates.length > 0 ? Math.max(...dates) : milestoneStart(state, milestone) + 14 * DAY;
  return startOfDay(Math.max(latest, milestoneStart(state, milestone) + DAY));
}

export function timelineRange(
  state: AppState,
  projectId: ID,
  now: Timestamp = Date.now(),
  paddingDays = 14,
): TimelineRange {
  const today = startOfDay(now);
  const milestones = milestonesFor(state, projectId);

  let min = today;
  let max = today + 30 * DAY;

  for (const milestone of milestones) {
    const from = milestoneStart(state, milestone);
    const to = milestoneEnd(state, milestone);
    if (from < min) min = from;
    if (to > max) max = to;
  }

  return {
    start: min - paddingDays * DAY,
    end: max + paddingDays * DAY,
    days: Math.max(1, Math.ceil((max - min + 2 * paddingDays * DAY) / DAY)),
  };
}

export function timelineSpans(
  state: AppState,
  projectId: ID,
  now: Timestamp = Date.now(),
): TimelineSpan[] {
  const today = startOfDay(now);
  return milestonesFor(state, projectId).map((milestone) => {
    const tasks = milestoneTasks(state, milestone.id);
    const done = tasks.filter((task) => task.status === "done").length;
    const start = milestoneStart(state, milestone);
    const rawEnd = milestoneEnd(state, milestone);
    const complete = milestone.status === "completed" || milestone.completedAt != null;
    const end = complete && milestone.completedAt != null
      ? Math.min(rawEnd, startOfDay(milestone.completedAt))
      : rawEnd;

    return {
      milestone,
      start,
      end: Math.max(end, start + DAY),
      percent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
      complete,
      overdue: !complete && milestone.dueAt != null && milestone.dueAt < today,
    };
  });
}

export function spanPosition(
  span: { start: Timestamp; end: Timestamp },
  range: TimelineRange,
): TimelinePosition {
  const total = Math.max(1, range.end - range.start);
  const left = ((span.start - range.start) / total) * 100;
  const width = ((span.end - span.start) / total) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(1.5, Math.min(100 - Math.max(0, left), width)),
  };
}

export function todayPosition(range: TimelineRange, now: Timestamp = Date.now()): number {
  const total = Math.max(1, range.end - range.start);
  const pct = ((startOfDay(now) - range.start) / total) * 100;
  return Math.max(0, Math.min(100, pct));
}

export interface TimelineMonth {
  label: string;
  left: number;
  width: number;
}

export function timelineMonths(range: TimelineRange): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  const cursor = new Date(range.start);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  const total = Math.max(1, range.end - range.start);

  while (cursor.getTime() <= range.end) {
    const monthStart = cursor.getTime();
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime() - DAY;
    const left = ((monthStart - range.start) / total) * 100;
    const width = ((monthEnd - monthStart) / total) * 100;
    months.push({
      label: cursor.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      left: Math.max(0, left),
      width: Math.max(2, width),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}