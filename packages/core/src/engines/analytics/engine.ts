import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { Goal } from "../../types/goal";
import { computeFocusStats } from "../focus/stats";
import { computeGoalProgress } from "../planning/progress";
import { habitStats } from "../habit/habits";
import {
  computePlanningAccuracy,
  computeScheduleChurn,
  computeTaskMetrics,
  computeTimeUtilization,
  startOfLocalDay,
} from "./metrics";
import { canRead } from "./metrics";
import { generateInsights, type AnalyticsInsight } from "./insights";

const DAY = 86_400_000;

export interface TodaySummary {
  date: Timestamp;
  completed: number;
  created: number;
  dueToday: number;
  overdue: number;
  focusMin: number;
  meetings: number;
  busyMin: number;
  plannedMin: number;
  completionRate: number;
  headline: string;
  nextUp: Array<{ id: string; title: string; reason: string }>;
}

export function buildTodaySummary(state: AppState, now: Timestamp = Date.now()): TodaySummary {
  const from = startOfLocalDay(now);
  const to = from + DAY;
  const tasks = computeTaskMetrics(state, from, to, now);
  const focus = computeFocusStats(state, from, to, now);
  const time = computeTimeUtilization(state, from, to, now);

  const overdueTasks = Object.values(state.tasks)
    .filter((task) => (task.status === "open" || task.status === "in_progress") && task.dueAt != null && task.dueAt < now)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));

  const nextUp = overdueTasks.slice(0, 3).map((task) => ({
    id: task.id,
    title: task.title,
    reason: `overdue since ${new Date(task.dueAt!).toLocaleDateString()}`,
  }));

  if (nextUp.length === 0) {
    const dueToday = Object.values(state.tasks)
      .filter(
        (task) =>
          (task.status === "open" || task.status === "in_progress") &&
          task.dueAt != null &&
          task.dueAt >= from &&
          task.dueAt < to,
      )
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || (a.dueAt ?? 0) - (b.dueAt ?? 0));
    for (const task of dueToday.slice(0, 3)) {
      nextUp.push({ id: task.id, title: task.title, reason: "due today" });
    }
  }

  const headline =
    overdueTasks.length > 0
      ? `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} need attention — the oldest is ${Math.max(
          1,
          Math.round((now - overdueTasks[0]!.dueAt!) / DAY),
        )} days past due.`
      : tasks.completed > 0
        ? `You finished ${tasks.completed} task${tasks.completed === 1 ? "" : "s"} today.`
        : "A quiet day so far — a good moment to plan something meaningful.";

  return {
    date: from,
    completed: tasks.completed,
    created: tasks.created,
    dueToday: tasks.created - tasks.stillOpen,
    overdue: tasks.overdueNow,
    focusMin: focus.totalFocusMin,
    meetings: time.meetingShare > 0 ? Math.round(time.meetingMinutes / 30) : 0,
    busyMin: time.busyMinutes,
    plannedMin: time.blockMinutes,
    completionRate: tasks.completionRate,
    headline,
    nextUp,
  };
}

export interface Review {
  kind: "week" | "month";
  from: Timestamp;
  to: Timestamp;
  label: string;
  tasks: {
    completed: number;
    created: number;
    cancelled: number;
    net: number;
    completionRate: number;
    overdueNow: number;
  };
  focus: { minutes: number; sessions: number; focusRatio: number; distractions: number };
  habits: Array<{ title: string; completionRate: number; currentStreak: number; delta: number }>;
  goals: Array<{ title: string; progress: number; delta: number }>;
  planning: {
    sessionsTimed: number;
    meanErrorMin: number | null;
    direction: "under" | "over" | "balanced" | null;
  };
  schedule: { blocks: number; aiMoved: number; churnRate: number | null; meetings: number };
  utilization: number;
  insights: AnalyticsInsight[];
  wins: string[];
  watch: string[];
}

function periodLabel(from: Timestamp, to: Timestamp, kind: "week" | "month"): string {
  const a = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(from);
  const b = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(to - 1);
  return `${a} – ${b}`;
}

function goalProgressValue(state: AppState, goal: Goal, now: Timestamp): number {
  return computeGoalProgress(state, goal, now, state.settings.weekStart).progress;
}

export function buildReview(
  state: AppState,
  kind: "week" | "month",
  now: Timestamp = Date.now(),
): Review {
  const spanDays = kind === "week" ? 7 : 30;
  const to = now;
  const from = now - spanDays * DAY;
  const previousFrom = from - spanDays * DAY;

  const tasks = computeTaskMetrics(state, from, to, now);
  const focus = computeFocusStats(state, from, to, now);
  const time = computeTimeUtilization(state, from, to, now);
  const accuracy = computePlanningAccuracy(state, from, to);
  const churn = computeScheduleChurn(state, from, to);
  const insights = generateInsights(state, from, to, now);

  const habits = Object.values(state.habits)
    .filter((habit) => !habit.archived)
    .map((habit) => {
      const stats = habitStats(state, habit, now, state.settings.weekStart, spanDays);
      return {
        title: habit.title,
        completionRate: stats.completionRate,
        currentStreak: stats.currentStreak,
        delta: 0,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate);

  const goals = Object.values(state.goals)
    .filter((goal) => goal.status === "active")
    .map((goal) => ({
      title: goal.title,
      progress: goalProgressValue(state, goal, now),
      delta: goalProgressValue(state, goal, previousFrom) - goalProgressValue(state, goal, now),
    }))
    .sort((a, b) => b.progress - a.progress);

  const wins: string[] = [];
  const watch: string[] = [];

  if (tasks.completed >= 1) wins.push(`${tasks.completed} task${tasks.completed === 1 ? "" : "s"} completed`);
  if (focus.totalFocusMin >= 30) wins.push(`${Math.round(focus.totalFocusMin / 60 * 10) / 10} hours of protected focus`);
  const strongHabit = habits.find((habit) => habit.completionRate >= 70);
  if (strongHabit) wins.push(`"${strongHabit.title}" held at ${strongHabit.completionRate}%`);
  if (goals.some((goal) => goal.progress >= 50)) wins.push("a goal past the halfway mark");

  if (tasks.overdueNow > 0) watch.push(`${tasks.overdueNow} overdue task${tasks.overdueNow === 1 ? "" : "s"}`);
  if (accuracy.underEstimateCount > accuracy.overEstimateCount * 2 && accuracy.underEstimateCount >= 3) {
    watch.push("estimates running short");
  }
  const weakHabit = habits.find((habit) => habit.completionRate < 40);
  if (weakHabit) watch.push(`"${weakHabit.title}" at ${weakHabit.completionRate}%`);

  return {
    kind,
    from,
    to,
    label: periodLabel(from, to, kind),
    tasks: {
      completed: tasks.completed,
      created: tasks.created,
      cancelled: tasks.cancelled,
      net: tasks.createdVsCompleted.net,
      completionRate: tasks.completionRate,
      overdueNow: tasks.overdueNow,
    },
    focus: {
      minutes: focus.totalFocusMin,
      sessions: focus.sessionCount,
      focusRatio: focus.focusRatio,
      distractions: focus.distractionCount,
    },
    habits,
    goals,
    planning: {
      sessionsTimed: accuracy.totalTasksWithEstimate,
      meanErrorMin: accuracy.meanErrorMin,
      direction: accuracy.commonDirection,
    },
    schedule: {
      blocks: churn.createdBlocks,
      aiMoved: churn.aiMovedBlocks,
      churnRate: churn.churnRate,
      meetings: time.meetingMinutes,
    },
    utilization: time.utilization,
    insights,
    wins,
    watch,
  };
}

export interface GoalProgressRow {
  id: string;
  title: string;
  horizon: string;
  progress: number;
  metricRows: Array<{ label: string; current: number; target: number; unit: string; percent: number }>;
  projects: Array<{ id: string; name: string; progress: number }>;
  openTasks: number;
  habits: number;
  focusMinThisWeek: number;
}

export function buildGoalAnalytics(state: AppState, now: Timestamp = Date.now()): GoalProgressRow[] {
  const weekFrom = now - 7 * DAY;

  return Object.values(state.goals)
    .filter((goal) => goal.status !== "archived")
    .map((goal) => {
      const progress = computeGoalProgress(state, goal, now, state.settings.weekStart);
      const projects = Object.values(state.projects)
        .filter((project) => project.goalIds.includes(goal.id))
        .map((project) => ({
          id: project.id,
          name: project.name,
          progress: Math.round(
            (() => {
              const tasks = Object.values(state.tasks).filter((task) => task.projectId === project.id);
              if (tasks.length === 0) return 0;
              return (tasks.filter((task) => task.status === "done").length / tasks.length) * 100;
            })(),
          ),
        }));

      const focusMin = Math.round(
        Object.values(state.focusSessions)
          .filter(
            (session) =>
              session.goalId === goal.id &&
              session.status === "completed" &&
              session.startedAt >= weekFrom,
          )
          .reduce(
            (sum, session) =>
              sum + Math.max(0, (session.endsAt ?? now) - session.startedAt - (session.pausedMs ?? 0)),
            0,
          ) / 60000,
      );

      return {
        id: goal.id,
        title: goal.title,
        horizon: goal.horizon,
        progress: progress.progress,
        metricRows: goal.metrics.map((metric) => ({
          label: metric.label,
          current: metric.current,
          target: metric.target,
          unit: metric.unit,
          percent: metric.target > 0 ? Math.min(100, Math.round((metric.current / metric.target) * 100)) : 0,
        })),
        projects,
        openTasks: Object.values(state.tasks).filter(
          (task) =>
            task.goalIds.includes(goal.id) &&
            (task.status === "open" || task.status === "in_progress"),
        ).length,
        habits: Object.values(state.habits).filter((habit) => habit.goalId === goal.id && !habit.archived).length,
        focusMinThisWeek: focusMin,
      };
    })
    .sort((a, b) => b.progress - a.progress);
}

export interface HabitAnalyticsRow {
  id: string;
  title: string;
  cadence: string;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  totalCheckIns: number;
  attendedDays: number;
  lastCheckedAt: Timestamp | null;
  trend: "rising" | "falling" | "flat";
  deltaPct: number;
}

export function buildHabitAnalytics(
  state: AppState,
  now: Timestamp = Date.now(),
  windowDays = 28,
): HabitAnalyticsRow[] {
  const half = Math.floor(windowDays / 2);

  return Object.values(state.habits)
    .filter((habit) => !habit.archived)
    .map((habit) => {
      const stats = habitStats(state, habit, now, state.settings.weekStart, windowDays);
      const recent = habitStats(state, habit, now, state.settings.weekStart, half);
      const earlier = habitStats(state, habit, now - half * DAY, state.settings.weekStart, half);
      const delta = recent.completionRate - earlier.completionRate;
      return {
        id: habit.id,
        title: habit.title,
        cadence: habit.cadence,
        completionRate: stats.completionRate,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        totalCheckIns: stats.totalCheckIns,
        attendedDays: stats.attendedDays,
        lastCheckedAt: stats.lastCheckedAt,
        trend: delta >= 5 ? ("rising" as const) : delta <= -5 ? ("falling" as const) : ("flat" as const),
        deltaPct: delta,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate);
}

export interface FocusAnalytics {
  totalMin: number;
  sessionCount: number;
  averageSessionMin: number;
  focusRatio: number;
  distractions: number;
  byDay: Array<{ day: Timestamp; label: string; minutes: number }>;
  byHour: Array<{ hour: number; minutes: number }>;
  byTask: Array<{ title: string; minutes: number }>;
  byGoal: Array<{ title: string; minutes: number }>;
  ambient: Array<{ ambient: string; minutes: number; focusRatio: number }>;
  estimateError: Array<{ title: string; estimateMin: number; actualMin: number; deltaMin: number }>;
  bestHours: number[];
}

export function buildFocusAnalytics(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): FocusAnalytics {
  const stats = computeFocusStats(state, from, to, now);
  const estimateError = Object.values(state.focusSessions)
    .filter((session) => canRead(session))
    .filter((session) => session.status === "completed" && session.completedAt != null)
    .filter((session) => session.completedAt! >= from && session.completedAt! < to)
    .filter((session) => session.plannedMin != null && session.plannedMin >= 1)
    .map((session) => {
      const actualMin = Math.round(
        Math.max(0, (session.endsAt ?? session.completedAt!) - session.startedAt - (session.pausedMs ?? 0)) / 60000,
      );
      const task = session.taskId ? state.tasks[session.taskId] : null;
      return {
        title: task?.title ?? (session.note || "Focus session"),
        estimateMin: session.plannedMin!,
        actualMin,
        deltaMin: actualMin - session.plannedMin!,
      };
    })
    .filter((entry) => entry.actualMin >= 1)
    .sort((a, b) => Math.abs(b.deltaMin) - Math.abs(a.deltaMin))
    .slice(0, 8);

  return {
    totalMin: stats.totalFocusMin,
    sessionCount: stats.sessionCount,
    averageSessionMin: stats.averageSessionMin,
    focusRatio: stats.focusRatio,
    distractions: stats.distractionCount,
    byDay: stats.byDay.map((day) => ({ day: day.day, label: day.label, minutes: day.minutes })),
    byHour: stats.byHour,
    byTask: stats.byTask.map((entry) => ({ title: entry.title, minutes: entry.minutes })),
    byGoal: stats.byGoal.map((entry) => ({ title: entry.title, minutes: entry.minutes })),
    ambient: stats.byAmbient,
    estimateError,
    bestHours: stats.byHour
      .slice()
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3)
      .map((entry) => entry.hour),
  };
}

export interface MeetingAnalytics {
  count: number;
  minutes: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  averageAttendees: number;
  byDay: Array<{ day: Timestamp; label: string; count: number; minutes: number }>;
}

export function buildMeetingAnalytics(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): MeetingAnalytics {
  const durationMinutes = (startsAt: Timestamp, endsAt: Timestamp | null): number =>
    Math.max(0, Math.round(((endsAt ?? startsAt + 30 * 60_000) - startsAt) / 60_000));

  const meetings = Object.values(state.meetings).filter(
    (meeting) => canRead(meeting) && meeting.startsAt >= from && meeting.startsAt < to,
  );
  const linkedEventIds = new Set(
    meetings.map((meeting) => meeting.eventId).filter((id): id is string => id != null),
  );
  const events = Object.values(state.events).filter(
    (event) =>
      canRead(event) &&
      event.startsAt >= from &&
      event.startsAt < to &&
      event.attendees.length > 0 &&
      !linkedEventIds.has(event.id),
  );

  const active = meetings.filter(
    (meeting) => meeting.status !== "cancelled" && meeting.status !== "archived",
  );
  const entries = [
    ...active.map((meeting) => ({
      startsAt: meeting.startsAt,
      minutes: durationMinutes(meeting.startsAt, meeting.endsAt),
      attendees: meeting.attendees.length,
    })),
    ...events.map((event) => ({
      startsAt: event.startsAt,
      minutes: durationMinutes(event.startsAt, event.endsAt),
      attendees: event.attendees.length,
    })),
  ];

  const byDayMap = new Map<Timestamp, { count: number; minutes: number }>();
  for (const entry of entries) {
    const day = startOfLocalDay(entry.startsAt);
    const bucket = byDayMap.get(day) ?? { count: 0, minutes: 0 };
    bucket.count += 1;
    bucket.minutes += entry.minutes;
    byDayMap.set(day, bucket);
  }
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short" });

  return {
    count: entries.length,
    minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    completed: meetings.filter((meeting) => meeting.status === "completed").length,
    cancelled: meetings.filter((meeting) => meeting.status === "cancelled").length,
    upcoming: meetings.filter((meeting) => meeting.status === "scheduled" && meeting.startsAt >= now).length,
    averageAttendees:
      entries.length > 0
        ? Math.round(
            (entries.reduce((sum, entry) => sum + entry.attendees, 0) / entries.length) * 10,
          ) / 10
        : 0,
    byDay: [...byDayMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, bucket]) => ({ day, label: dayLabel.format(day), ...bucket })),
  };
}
export interface AnalyticsOverview {
  tasks: ReturnType<typeof computeTaskMetrics>;
  time: ReturnType<typeof computeTimeUtilization>;
  focus: ReturnType<typeof computeFocusStats>;
  planning: ReturnType<typeof computePlanningAccuracy>;
  schedule: ReturnType<typeof computeScheduleChurn>;
  insights: AnalyticsInsight[];
}

export function buildAnalyticsOverview(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): AnalyticsOverview {
  return {
    tasks: computeTaskMetrics(state, from, to, now),
    time: computeTimeUtilization(state, from, to, now),
    focus: computeFocusStats(state, from, to, now),
    planning: computePlanningAccuracy(state, from, to),
    schedule: computeScheduleChurn(state, from, to),
    insights: generateInsights(state, from, to, now),
  };
}
