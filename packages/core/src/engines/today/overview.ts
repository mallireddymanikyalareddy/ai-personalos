import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import { addDays, isSameDay, startOfDay, startOfWeek } from "../date-utils";
import {
  buildFocusAnalytics,
  buildGoalAnalytics,
  buildHabitAnalytics,
} from "../analytics/engine";
import { selectFocusSessions } from "../focus/stats";
import { buildGamificationProfile } from "../gamification/engine";
import { selectTodayTasks } from "../task/transitions";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface TodayGlance {
  tasksDue: number;
  tasksDone: number;
  tasksTotal: number;
  meetings: number;
  planProgress: number;
  focusMinutes: number;
  rewardPoints: number;
}

export function buildTodayGlance(state: AppState, now: Timestamp): TodayGlance {
  const dayStart = startOfDay(now);
  const due = selectTodayTasks(state, now);
  const done = Object.values(state.tasks).filter(
    (task) =>
      task.status === "done" &&
      task.completedAt != null &&
      task.completedAt >= dayStart &&
      task.completedAt < dayStart + DAY,
  ).length;
  const total = due.length + done;

  const meetings = Object.values(state.meetings).filter(
    (meeting) => meeting.startsAt >= dayStart && meeting.startsAt < dayStart + DAY,
  ).length;

  const focusMinutes = selectFocusSessions(state, dayStart, now, now)
    .filter((row) => row.session.status !== "aborted")
    .reduce((sum, row) => sum + row.durationMin, 0);

  return {
    tasksDue: due.length,
    tasksDone: done,
    tasksTotal: total,
    meetings,
    planProgress: total > 0 ? Math.round((done / total) * 100) : 0,
    focusMinutes,
    rewardPoints: buildGamificationProfile(state).coins,
  };
}

export interface TodayCounts {
  tasksDue: number;
  goals: number;
  habitsDone: number;
  habitsTotal: number;
  projects: number;
  notes: number;
  papers: number;
  notebooks: number;
  templates: number;
  points: number;
}

export function buildTodayCounts(state: AppState, now: Timestamp): TodayCounts {
  const dayStart = startOfDay(now);
  const habits = Object.values(state.habits).filter((habit) => !habit.archived);
  const checked = new Set(
    Object.values(state.habitCheckins)
      .filter((checkin) => isSameDay(checkin.checkedAt, now))
      .map((checkin) => checkin.habitId),
  );

  return {
    tasksDue: selectTodayTasks(state, now).length,
    goals: Object.values(state.goals).filter((goal) => goal.status === "active").length,
    habitsDone: habits.filter((habit) => checked.has(habit.id)).length,
    habitsTotal: habits.length,
    projects: Object.values(state.projects).filter((project) => project.status === "active").length,
    notes: Object.values(state.notes).filter((note) => note.status !== "trashed").length,
    papers: Object.values(state.paperPages).filter((page) => page.status !== "trashed").length,
    notebooks: Object.values(state.notebooks).filter((notebook) => notebook.archivedAt == null).length,
    templates: Object.values(state.templates).filter((template) => template.status === "active").length,
    points: buildGamificationProfile(state).coins,
  };
}

export interface TodayWeekInsights {
  productivity: number;
  productivityDelta: number | null;
  focusHours: number;
  goalsProgress: number;
  habitAdherence: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function productivityScore(state: AppState, from: Timestamp, to: Timestamp, now: Timestamp): number {
  const focus = buildFocusAnalytics(state, from, to, now);
  const goals = buildGoalAnalytics(state, now);
  const habits = buildHabitAnalytics(state, now, 7);

  const focusScore = Math.min(100, Math.round((focus.totalMin / (4 * 60)) * 100));
  const goalScore = goals.length > 0
    ? Math.round(average(goals.map((goal) => goal.progress)))
    : 0;
  const habitScore = habits.length > 0
    ? Math.round(average(habits.map((habit) => habit.completionRate)))
    : 0;

  return Math.round(focusScore * 0.4 + goalScore * 0.3 + habitScore * 0.3);
}

export function buildTodayWeekInsights(state: AppState, now: Timestamp): TodayWeekInsights {
  const from = startOfWeek(now, state.settings.weekStart);
  const to = now;

  const focus = buildFocusAnalytics(state, from, to, now);
  const goals = buildGoalAnalytics(state, now);
  const habits = buildHabitAnalytics(state, now, 7);

  const productivity = productivityScore(state, from, to, now);
  const previousFrom = addDays(from, -7);
  const previous = productivityScore(state, previousFrom, from, now);
  const delta = previous > 0 ? Math.round(((productivity - previous) / previous) * 100) : null;

  return {
    productivity,
    productivityDelta: delta,
    focusHours: Math.round((focus.totalMin / 60) * 10) / 10,
    goalsProgress: goals.length > 0 ? Math.round(average(goals.map((goal) => goal.progress))) : 0,
    habitAdherence: habits.length > 0
      ? Math.round(average(habits.map((habit) => habit.completionRate)))
      : 0,
  };
}

export interface TodayDocumentRow {
  id: ID;
  title: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  updatedLabel: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function buildTodayDocuments(state: AppState, now: Timestamp, limit = 4): TodayDocumentRow[] {
  return Object.values(state.documents)
    .filter((document) => document.status !== "trashed")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((document) => {
      const hours = Math.max(0, Math.round((now - document.updatedAt) / HOUR));
      const updatedLabel = hours < 1 ? "Just now" : hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
      return {
        id: document.id,
        title: document.title,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        sizeLabel: formatFileSize(document.sizeBytes),
        updatedLabel,
      };
    });
}

export interface TodayMonthDay {
  at: Timestamp;
  date: number;
  inMonth: boolean;
  isToday: boolean;
  hasEvent: boolean;
}

export function buildTodayMonth(state: AppState, now: Timestamp, anchor: Timestamp): TodayMonthDay[] {
  const first = new Date(anchor);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  const offset = first.getDay();
  const gridStart = first.getTime() - offset * DAY;
  const todayKey = new Date(now).toDateString();

  const days: TodayMonthDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const at = gridStart + index * DAY;
    const date = new Date(at);
    const inMonth = date.getMonth() === first.getMonth();
    const hasEvent = Object.values(state.events).some(
      (event) => isSameDay(event.startsAt, at) || isSameDay(event.endsAt, at),
    );
    days.push({
      at,
      date: date.getDate(),
      inMonth,
      isToday: date.toDateString() === todayKey,
      hasEvent,
    });
  }
  return days;
}
