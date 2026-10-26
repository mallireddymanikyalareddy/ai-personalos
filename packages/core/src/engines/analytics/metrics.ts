import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import type { CalendarEvent } from "../../types/event";
import type { TimeBlock } from "../../types/time-block";
import type { FocusSession } from "../../types/engagement";
import { LOCAL_USER_ID } from "../../types/base";

export function canRead(entity: unknown): boolean {
  const ownerId = (entity as { ownerId?: string | null }).ownerId;
  return ownerId == null || ownerId === LOCAL_USER_ID;
}

const DAY = 86_400_000;

export function startOfLocalDay(ts: Timestamp): Timestamp {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isOpenTask(task: Task): boolean {
  return task.status === "open" || task.status === "in_progress" || task.status === "inbox";
}

function inWindow(from: Timestamp, to: Timestamp, ts: Timestamp | null): boolean {
  return ts != null && ts >= from && ts < to;
}

export interface TaskMetrics {
  created: number;
  completed: number;
  cancelled: number;
  stillOpen: number;
  completionRate: number;
  overdueNow: number;
  overdueAgeDays: { median: number; oldest: number } | null;
  createdVsCompleted: { created: number; completed: number; net: number };
  byPriority: Array<{ priority: number; completed: number; total: number }>;
  byDay: Array<{ day: Timestamp; label: string; completed: number; created: number }>;
  completionByHour: Array<{ hour: number; completed: number }>;
  averageDurationMin: number | null;
  medianDurationMin: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2) : Math.round(sorted[middle]!);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function taskDurationMinutes(task: Task): number | null {
  if (task.completedAt == null) return null;
  const start = task.startedAt ?? task.createdAt;
  if (start == null || task.completedAt <= start) return null;
  return Math.round((task.completedAt - start) / 60000);
}

export function computeTaskMetrics(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): TaskMetrics {
  const tasks = Object.values(state.tasks).filter((task) => canRead(task));
  const created = tasks.filter((task) => inWindow(from, to, task.createdAt));
  const completed = tasks.filter((task) => inWindow(from, to, task.completedAt));
  const cancelled = tasks.filter(
    (task) => task.status === "cancelled" && inWindow(from, to, task.updatedAt),
  );

  const overdueNow = tasks.filter((task) => isOpenTask(task) && task.dueAt != null && task.dueAt < now);
  const overdueAges = overdueNow.map((task) => Math.max(0, Math.round((now - task.dueAt!) / DAY)));
  const overdueAgeDays =
    overdueAges.length > 0
      ? { median: median(overdueAges) ?? 0, oldest: Math.max(...overdueAges) }
      : null;

  const byPriorityMap = new Map<number, { completed: number; total: number }>();
  for (const task of created) {
    const entry = byPriorityMap.get(task.priority) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (task.status === "done") entry.completed += 1;
    byPriorityMap.set(task.priority, entry);
  }

  const byDayMap = new Map<Timestamp, { completed: number; created: number }>();
  for (const task of completed) {
    const day = startOfLocalDay(task.completedAt!);
    const entry = byDayMap.get(day) ?? { completed: 0, created: 0 };
    entry.completed += 1;
    byDayMap.set(day, entry);
  }
  for (const task of created) {
    const day = startOfLocalDay(task.createdAt);
    const entry = byDayMap.get(day) ?? { completed: 0, created: 0 };
    entry.created += 1;
    byDayMap.set(day, entry);
  }

  const byHourMap = new Map<number, number>();
  for (const task of completed) {
    const hour = new Date(task.completedAt!).getHours();
    byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + 1);
  }

  const durations = completed
    .map(taskDurationMinutes)
    .filter((duration): duration is number => duration != null && duration > 0 && duration < 60 * DAY);

  return {
    created: created.length,
    completed: completed.length,
    cancelled: cancelled.length,
    stillOpen: created.filter(isOpenTask).length,
    completionRate:
      created.length > 0 ? Math.round((created.filter((task) => task.status === "done").length / created.length) * 100) : 0,
    overdueNow: overdueNow.length,
    overdueAgeDays,
    createdVsCompleted: {
      created: created.length,
      completed: completed.length,
      net: created.length - completed.length,
    },
    byPriority: [...byPriorityMap.entries()]
      .map(([priority, entry]) => ({ priority, completed: entry.completed, total: entry.total }))
      .sort((a, b) => b.priority - a.priority),
    byDay: [...byDayMap.entries()]
      .map(([day, entry]) => ({
        day,
        label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
        completed: entry.completed,
        created: entry.created,
      }))
      .sort((a, b) => a.day - b.day),
    completionByHour: [...byHourMap.entries()]
      .map(([hour, completed]) => ({ hour, completed }))
      .sort((a, b) => a.hour - b.hour),
    averageDurationMin: average(durations),
    medianDurationMin: median(durations),
  };
}

export interface TimeUtilization {
  busyMinutes: number;
  focusMinutes: number;
  meetingMinutes: number;
  blockMinutes: number;
  availableMinutes: number;
  utilization: number;
  focusShare: number;
  meetingShare: number;
  byDay: Array<{ day: Timestamp; label: string; busyMin: number }>;
}

function overlapMinutes(aFrom: Timestamp, aTo: Timestamp, bFrom: Timestamp, bTo: Timestamp): number {
  return Math.max(0, Math.min(aTo, bTo) - Math.max(aFrom, bFrom)) / 60000;
}

export function computeTimeUtilization(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): TimeUtilization {
  const prefs = state.settings.planning;
  const parse = (value: string): number => {
    const [h = "9", m = "0"] = value.split(":");
    return Number(h) * 60 + Number(m);
  };
  const dayStart = parse(prefs.dayStart);
  const dayEnd = parse(prefs.dayEnd);
  const workingDays = prefs.workDays;

  let availableMinutes = 0;
  for (let day = from; day < to; day += DAY) {
    const weekday = (new Date(day).getDay() + 6) % 7;
    if (!workingDays.includes(weekday === 0 ? 6 : weekday)) continue;
    availableMinutes += Math.max(0, dayEnd - dayStart);
  }

  const events = Object.values(state.events).filter(
    (event) => canRead(event) && inWindow(from, to, event.startsAt),
  );
  const blocks = Object.values(state.timeBlocks).filter(
    (block) => canRead(block) && inWindow(from, to, block.startsAt),
  );
  const sessions = Object.values(state.focusSessions).filter(
    (session) => canRead(session) && inWindow(from, to, session.startedAt),
  );

  const busyRanges: Array<[Timestamp, Timestamp]> = [];
  for (const event of events) busyRanges.push([event.startsAt, event.endsAt]);
  for (const block of blocks) busyRanges.push([block.startsAt, block.endsAt]);

  let busyMinutes = 0;
  const byDayMap = new Map<Timestamp, number>();
  for (const [start, end] of busyRanges) {
    let minutes = 0;
    for (let day = startOfLocalDay(start); day < startOfLocalDay(end) + DAY - 1; day += DAY) {
      if (day < from || day >= to) continue;
      minutes += overlapMinutes(
        start,
        end,
        Math.max(day, from),
        Math.min(day + DAY, to),
      );
    }
    if (minutes === 0 && start >= from && start < to) {
      minutes = Math.max(0, end - start) / 60000;
    }
    busyMinutes += minutes;
    const day = startOfLocalDay(start);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + minutes);
  }

  const focusMinutes = Math.round(
    sessions
      .filter((session) => session.status === "completed")
      .reduce((sum, session) => sum + Math.max(0, (session.endsAt ?? now) - session.startedAt - (session.pausedMs ?? 0)), 0) / 60000,
  );
  const meetingMinutes = Math.round(
    events
      .filter((event) => event.attendees.length > 0 || false)
      .reduce((sum, event) => sum + (event.endsAt - event.startsAt), 0) / 60000,
  );
  const blockMinutes = Math.round(
    blocks.reduce((sum, block) => sum + (block.endsAt - block.startsAt), 0) / 60000,
  );

  return {
    busyMinutes: Math.round(busyMinutes),
    focusMinutes,
    meetingMinutes,
    blockMinutes,
    availableMinutes,
    utilization: availableMinutes > 0 ? Math.min(100, Math.round((busyMinutes / availableMinutes) * 100)) : 0,
    focusShare: busyMinutes > 0 ? Math.round((focusMinutes / busyMinutes) * 100) : 0,
    meetingShare: busyMinutes > 0 ? Math.round((meetingMinutes / busyMinutes) * 100) : 0,
    byDay: [...byDayMap.entries()]
      .map(([day, minutes]) => ({
        day,
        label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
        busyMin: Math.round(minutes),
      }))
      .sort((a, b) => a.day - b.day),
  };
}

export interface PlanningAccuracy {
  totalTasksWithEstimate: number;
  overEstimateCount: number;
  underEstimateCount: number;
  accurateCount: number;
  meanErrorMin: number | null;
  medianErrorMin: number | null;
  meanAbsoluteErrorMin: number | null;
  commonDirection: "under" | "over" | "balanced" | null;
  byBucket: Array<{ label: string; count: number; meanErrorMin: number }>;
}

export function computePlanningAccuracy(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): PlanningAccuracy {
  const rows = Object.values(state.focusSessions)
    .filter((session) => canRead(session))
    .filter((session) => session.status === "completed" && inWindow(from, to, session.completedAt))
    .map((session) => {
      const activeMin = Math.round(
        Math.max(0, (session.endsAt ?? session.completedAt!) - session.startedAt - (session.pausedMs ?? 0)) / 60000,
      );
      return { estimateMin: session.plannedMin ?? null, actualMin: activeMin > 0 ? activeMin : null };
    })
    .filter((row): row is { estimateMin: number; actualMin: number } =>
      row.estimateMin != null && row.estimateMin >= 1 && row.actualMin != null && row.actualMin >= 1,
    );

  const errors = rows.map((row) => row.actualMin - row.estimateMin);
  const under = errors.filter((error) => error > 5).length;
  const over = errors.filter((error) => error < -5).length;

  const buckets = [
    { label: ">60 over", min: -Infinity, max: -60 },
    { label: "30–60 over", min: -60, max: -30 },
    { label: "10–30 over", min: -30, max: -10 },
    { label: "Within 10", min: -10, max: 10 },
    { label: "10–30 under", min: 10, max: 30 },
    { label: "30–60 under", min: 30, max: 60 },
    { label: ">60 under", min: 60, max: Infinity },
  ];

  return {
    totalTasksWithEstimate: rows.length,
    overEstimateCount: over,
    underEstimateCount: under,
    accurateCount: rows.length - under - over,
    meanErrorMin: average(errors),
    medianErrorMin: median(errors),
    meanAbsoluteErrorMin: average(errors.map(Math.abs)),
    commonDirection:
      under === 0 && over === 0 ? "balanced" : under > over * 1.5 ? "under" : over > under * 1.5 ? "over" : "balanced",
    byBucket: buckets
      .map(({ label, min, max }) => {
        const inBucket = rows.filter(
          (row) => row.actualMin - row.estimateMin >= min && row.actualMin - row.estimateMin < max,
        );
        return {
          label,
          count: inBucket.length,
          meanErrorMin: average(inBucket.map((row) => row.actualMin - row.estimateMin)) ?? 0,
        };
      })
      .filter((bucket) => bucket.count > 0),
  };
}

export interface ScheduleChurn {
  createdBlocks: number;
  movedBlocks: number;
  deletedBlocks: number;
  aiMovedBlocks: number;
  churnRate: number | null;
  eventCount: number;
  cancelledEvents: number;
}

export function computeScheduleChurn(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
): ScheduleChurn {
  const blocks = Object.values(state.timeBlocks).filter(
    (block) => canRead(block) && inWindow(from, to, block.startsAt),
  );
  const aiBlocks = blocks.filter((block) => block.source === "ai");
  const events = Object.values(state.events).filter(
    (event) => canRead(event) && inWindow(from, to, event.startsAt),
  );
  const cancelledEvents = Object.values(state.events).filter(
    (event) => canRead(event) && false && inWindow(from, to, event.updatedAt),
  );

  return {
    createdBlocks: blocks.length,
    movedBlocks: aiBlocks.length,
    deletedBlocks: 0,
    aiMovedBlocks: aiBlocks.length,
    churnRate: blocks.length > 0 ? Math.round((aiBlocks.length / blocks.length) * 100) : null,
    eventCount: events.length,
    cancelledEvents: cancelledEvents.length,
  };
}

export interface TrendPoint<T = number> {
  label: string;
  value: T;
}

export function direction(values: number[]): "rising" | "falling" | "flat" {
  if (values.length < 2) return "flat";
  const half = Math.floor(values.length / 2);
  const first = values.slice(0, half);
  const second = values.slice(half);
  const firstAvg = first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondAvg = second.reduce((sum, value) => sum + value, 0) / second.length;
  const threshold = Math.max(1, firstAvg * 0.1);
  if (secondAvg > firstAvg + threshold) return "rising";
  if (secondAvg < firstAvg - threshold) return "falling";
  return "flat";
}

export function percentChange(values: number[]): number | null {
  if (values.length < 2) return null;
  const half = Math.floor(values.length / 2);
  const first = values.slice(0, half);
  const second = values.slice(half);
  const firstAvg = first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondAvg = second.reduce((sum, value) => sum + value, 0) / second.length;
  if (firstAvg === 0) return null;
  return Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
}
