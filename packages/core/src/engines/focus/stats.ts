import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { FocusSession } from "../../types/engagement";
import { canUserRead } from "../ai/access";
import { formatMinutes } from "../ai/format";

const DAY = 86_400_000;

function authorizedSessions(state: AppState, from: Timestamp, to: Timestamp): FocusSession[] {
  return Object.values(state.focusSessions)
    .filter((session) => session.startedAt >= from && session.startedAt < to)
    .filter((session) => canUserRead(state, session))
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function focusSessionActiveMs(session: FocusSession, now: Timestamp = Date.now()): number {
  const computed = Math.max(0, (session.endsAt ?? now) - session.startedAt - (session.pausedMs ?? 0));
  return session.activeMs > 0 ? session.activeMs : computed;
}

function sessionDistractedMs(session: FocusSession): number {
  return (session.distractions ?? []).reduce((sum, distraction) => sum + (distraction.durationMs ?? 0), 0);
}

export interface FocusSessionRow {
  session: FocusSession;
  durationMin: number;
  distractedMin: number;
  focusRatio: number;
  taskTitle: string | null;
  goalTitle: string | null;
}

export function selectFocusSessions(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): FocusSessionRow[] {
  return authorizedSessions(state, from, to).map((session) => {
    const distractedMs = sessionDistractedMs(session);
    const durationMs = focusSessionActiveMs(session, now);
    const task = session.taskId ? state.tasks[session.taskId] : null;
    const goal = session.goalId ? state.goals[session.goalId] : null;
    return {
      session,
      durationMin: Math.round(durationMs / 60000),
      distractedMin: Math.round(distractedMs / 60000),
      focusRatio: durationMs > 0 ? Math.max(0, Math.min(1, 1 - distractedMs / durationMs)) : 1,
      taskTitle: task?.title ?? null,
      goalTitle: task == null && goal ? goal.title : null,
    };
  });
}

export interface FocusStats {
  sessionCount: number;
  completedCount: number;
  abortedCount: number;
  totalFocusMin: number;
  totalDistractedMin: number;
  averageSessionMin: number;
  longestSessionMin: number;
  focusRatio: number;
  distractionCount: number;
  distractionsPerHour: number;
  completionRate: number;
  byDay: Array<{ day: Timestamp; label: string; minutes: number; sessions: number }>;
  byTask: Array<{ taskId: ID | null; title: string; minutes: number; sessions: number }>;
  byGoal: Array<{ goalId: ID | null; title: string; minutes: number }>;
  byHour: Array<{ hour: number; minutes: number }>;
  byAmbient: Array<{ ambient: string; minutes: number; focusRatio: number }>;
  estimateAccuracy: Array<{ taskId: ID; title: string; estimateMin: number; actualMin: number; deltaMin: number }>;
}

function startOfDay(ts: Timestamp): Timestamp {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function computeFocusStats(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): FocusStats {
  const rows = selectFocusSessions(state, from, to, now);

  const totalMs = rows.reduce((sum, row) => sum + row.durationMin * 60000, 0);
  const distractedMs = rows.reduce((sum, row) => sum + row.distractedMin * 60000, 0);
  const completed = rows.filter((row) => row.session.status === "completed").length;
  const aborted = rows.filter((row) => row.session.status === "aborted").length;
  const distractionCount = rows.reduce((sum, row) => sum + row.session.distractions.length, 0);

  const byDayMap = new Map<Timestamp, { minutes: number; sessions: number }>();
  const byTaskMap = new Map<string, { title: string; minutes: number; sessions: number }>();
  const byGoalMap = new Map<string, { title: string; minutes: number }>();
  const byHourMap = new Map<number, number>();
  const byAmbientMap = new Map<string, { minutes: number; focusMs: number; totalMs: number }>();

  for (const row of rows) {
    const day = startOfDay(row.session.startedAt);
    const dayEntry = byDayMap.get(day) ?? { minutes: 0, sessions: 0 };
    dayEntry.minutes += row.durationMin;
    dayEntry.sessions += 1;
    byDayMap.set(day, dayEntry);

    const hour = new Date(row.session.startedAt).getHours();
    byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + row.durationMin);

    const taskKey = row.session.taskId ?? "__none__";
    const taskEntry = byTaskMap.get(taskKey) ?? {
      title: row.taskTitle ?? "Unlinked",
      minutes: 0,
      sessions: 0,
    };
    taskEntry.minutes += row.durationMin;
    taskEntry.sessions += 1;
    byTaskMap.set(taskKey, taskEntry);

    if (row.session.goalId) {
      const goalEntry = byGoalMap.get(row.session.goalId) ?? { title: row.goalTitle ?? "Goal", minutes: 0 };
      goalEntry.minutes += row.durationMin;
      byGoalMap.set(row.session.goalId, goalEntry);
    }

    const ambient = row.session.ambient ?? "none";
    const ambientEntry = byAmbientMap.get(ambient) ?? { minutes: 0, focusMs: 0, totalMs: 0 };
    ambientEntry.minutes += row.durationMin;
    ambientEntry.totalMs += row.durationMin * 60000;
    ambientEntry.focusMs += row.focusRatio * row.durationMin * 60000;
    byAmbientMap.set(ambient, ambientEntry);
  }

  const days = [...byDayMap.entries()].sort((a, b) => a[0] - b[0]);
  const [shortest, longest] = rows.length > 0
    ? rows.reduce(
        (acc, row) => [Math.min(acc[0], row.durationMin), Math.max(acc[1], row.durationMin)] as [number, number],
        [Number.POSITIVE_INFINITY, 0] as [number, number],
      )
    : [0, 0];

  const estimateAccuracy = rows
    .filter((row) => row.session.plannedMin != null && row.session.plannedMin >= 1 && row.durationMin > 0)
    .map((row) => ({
      taskId: row.session.taskId!,
      title: row.taskTitle ?? "Task",
      estimateMin: Math.round(row.session.plannedMin!),
      actualMin: row.durationMin,
      deltaMin: row.durationMin - row.session.plannedMin!,
    }))
    .filter((entry) => entry.taskId != null)
    .sort((a, b) => Math.abs(b.deltaMin) - Math.abs(a.deltaMin))
    .slice(0, 8);

  return {
    sessionCount: rows.length,
    completedCount: completed,
    abortedCount: aborted,
    totalFocusMin: rows.reduce((sum, row) => sum + row.durationMin, 0),
    totalDistractedMin: rows.reduce((sum, row) => sum + row.distractedMin, 0),
    averageSessionMin: rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.durationMin, 0) / rows.length) : 0,
    longestSessionMin: longest === 0 ? 0 : Number.isFinite(longest) ? longest : rows.reduce((max, row) => Math.max(max, row.durationMin), 0),
    focusRatio: totalMs > 0 ? Math.max(0, 1 - distractedMs / totalMs) : 1,
    distractionCount,
    distractionsPerHour:
      totalMs > 0 ? Math.round((distractionCount / (totalMs / 60)) * 100) / 100 : 0,
    completionRate: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
    byDay: days.map(([day, entry]) => ({
      day,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
      minutes: entry.minutes,
      sessions: entry.sessions,
    })),
    byTask: [...byTaskMap.entries()]
      .map(([key, entry]) => ({
        taskId: key === "__none__" ? null : key,
        title: entry.title,
        minutes: entry.minutes,
        sessions: entry.sessions,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10),
    byGoal: [...byGoalMap.entries()]
      .map(([key, entry]) => ({ goalId: key, title: entry.title, minutes: entry.minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10),
    byHour: [...byHourMap.entries()]
      .map(([hour, minutes]) => ({ hour, minutes }))
      .sort((a, b) => a.hour - b.hour),
    byAmbient: [...byAmbientMap.entries()]
      .map(([ambient, entry]) => ({
        ambient,
        minutes: entry.minutes,
        focusRatio: entry.totalMs > 0 ? Math.round((entry.focusMs / entry.totalMs) * 100) / 100 : 1,
      }))
      .sort((a, b) => b.minutes - a.minutes),
    estimateAccuracy,
  };
}

export interface DeepWorkBlock {
  sessionId: ID;
  taskTitle: string | null;
  startedAt: Timestamp;
  durationMin: number;
  focusRatio: number;
}

export function selectDeepWorkBlocks(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  minMinutes = 45,
  now: Timestamp = Date.now(),
): DeepWorkBlock[] {
  return selectFocusSessions(state, from, to, now)
    .filter((row) => row.durationMin >= minMinutes && row.focusRatio >= 0.9)
    .map((row) => ({
      sessionId: row.session.id,
      taskTitle: row.taskTitle,
      startedAt: row.session.startedAt,
      durationMin: row.durationMin,
      focusRatio: row.focusRatio,
    }))
    .sort((a, b) => b.durationMin - a.durationMin);
}

export interface FocusHeatCell {
  day: Timestamp;
  hour: number;
  minutes: number;
}

export function focusHeatmap(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): FocusHeatCell[] {
  const cells = new Map<string, FocusHeatCell>();
  for (const row of selectFocusSessions(state, from, to, now)) {
    const day = startOfDay(row.session.startedAt);
    const hour = new Date(row.session.startedAt).getHours();
    const key = `${day}:${hour}`;
    const cell = cells.get(key) ?? { day, hour, minutes: 0 };
    cell.minutes += row.durationMin;
    cells.set(key, cell);
  }
  return [...cells.values()];
}

export function bestFocusHours(state: AppState, from: Timestamp, to: Timestamp, now = Date.now()): number[] {
  return computeFocusStats(state, from, to, now)
    .byHour.slice()
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3)
    .map((entry) => entry.hour);
}

export function focusSessionsForTask(state: AppState, taskId: ID, limit = 10): FocusSessionRow[] {
  return Object.values(state.focusSessions)
    .filter((session) => session.taskId === taskId)
    .filter((session) => canUserRead(state, session))
    .map((session) => {
      const task = state.tasks[taskId];
      return {
        session,
        durationMin: Math.round(focusSessionActiveMs(session) / 60000),
        distractedMin: Math.round(sessionDistractedMs(session) / 60000),
        focusRatio: 1 - sessionDistractedMs(session) / Math.max(1, focusSessionActiveMs(session)),
        taskTitle: task?.title ?? null,
        goalTitle: session.goalId ? state.goals[session.goalId]?.title ?? null : null,
      };
    })
    .sort((a, b) => b.session.startedAt - a.session.startedAt)
    .slice(0, limit);
}

export function focusSessionsForGoal(state: AppState, goalId: ID, limit = 10): FocusSessionRow[] {
  return Object.values(state.focusSessions)
    .filter((session) => session.goalId === goalId)
    .filter((session) => canUserRead(state, session))
    .map((session) => ({
      session,
      durationMin: Math.round(focusSessionActiveMs(session) / 60000),
      distractedMin: Math.round(sessionDistractedMs(session) / 60000),
      focusRatio: 1 - sessionDistractedMs(session) / Math.max(1, focusSessionActiveMs(session)),
      taskTitle: session.taskId ? state.tasks[session.taskId]?.title ?? null : null,
      goalTitle: state.goals[goalId]?.title ?? null,
    }))
    .sort((a, b) => b.session.startedAt - a.session.startedAt)
    .slice(0, limit);
}

export function focusSummaryLine(state: AppState, from: Timestamp, to: Timestamp, now = Date.now()): string {
  const stats = computeFocusStats(state, from, to, now);
  if (stats.sessionCount === 0) return "No focus sessions in this window yet.";
  return `${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"} · ${formatMinutes(
    stats.totalFocusMin,
  )} focused · ${Math.round(stats.focusRatio * 100)}% focus · ${stats.distractionCount} distraction${
    stats.distractionCount === 1 ? "" : "s"
  }`;
}

export function estimateAccuracyForTask(state: AppState, taskId: ID): number | null {
  const rows = focusSessionsForTask(state, taskId, 20);
  const pairs = rows.filter((row) => row.session.plannedMin != null && row.durationMin > 0);
  if (pairs.length === 0) return null;
  const errors = pairs.map((row) => Math.abs(row.durationMin - row.session.plannedMin!));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const scale = Math.max(1, pairs.reduce((sum, row) => sum + row.session.plannedMin!, 0) / pairs.length);
  return Math.round(Math.max(0, 1 - meanError / scale) * 100);
}

export const FOCUS_DAY_RANGES = {
  today(from: Timestamp): { from: Timestamp; to: Timestamp } {
    const start = startOfDay(from);
    return { from: start, to: start + DAY };
  },
  week(from: Timestamp): { from: Timestamp; to: Timestamp } {
    const start = startOfDay(from) - 6 * DAY;
    return { from: start, to: start + 7 * DAY };
  },
  month(from: Timestamp): { from: Timestamp; to: Timestamp } {
    const start = startOfDay(from) - 29 * DAY;
    return { from: start, to: start + 30 * DAY };
  },
};
