import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { Goal } from "../../types/goal";
import type { Habit } from "../../types/habit";
import { computeFocusStats } from "../focus/stats";
import { computeGoalProgress } from "../planning/progress";
import {
  computePlanningAccuracy,
  computeScheduleChurn,
  computeTaskMetrics,
  computeTimeUtilization,
  percentChange,
  direction,
} from "./metrics";

const DAY = 86_400_000;

export type InsightTone = "positive" | "warning" | "neutral" | "action";

export interface AnalyticsInsight {
  id: string;
  tone: InsightTone;
  headline: string;
  detail: string;
  metric: string;
  value: number | string;
  sampleSize: number;
  area: "tasks" | "focus" | "habits" | "goals" | "planning" | "schedule";
}

export function peakHour(counts: Array<{ hour: number; completed: number }>): { hour: number; count: number } | null {
  if (counts.length === 0) return null;
  let best = counts[0]!;
  for (const entry of counts) if (entry.completed > best.completed) best = entry;
  return best.completed === 0 ? null : { hour: best.hour, count: best.completed };
}

function hourLabel(hour: number): string {
  if (hour < 12) return `${hour === 0 ? 12 : hour} AM`;
  return `${hour === 12 ? 12 : hour - 12} PM`;
}

function shareBefore(counts: Array<{ hour: number; completed: number }>, cutoff: number): number {
  const total = counts.reduce((sum, entry) => sum + entry.completed, 0);
  if (total === 0) return 0;
  const before = counts.filter((entry) => entry.hour < cutoff).reduce((sum, entry) => sum + entry.completed, 0);
  return Math.round((before / total) * 100);
}

export function generateInsights(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp = Date.now(),
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  const tasks = computeTaskMetrics(state, from, to, now);
  const focus = computeFocusStats(state, from, to, now);
  const time = computeTimeUtilization(state, from, to, now);
  const accuracy = computePlanningAccuracy(state, from, to);
  const churn = computeScheduleChurn(state, from, to);

  if (tasks.completed >= 5) {
    const peak = peakHour(tasks.completionByHour);
    if (peak) {
      const beforeNoon = shareBefore(tasks.completionByHour, 12);
      insights.push({
        id: "focus-window",
        tone: "positive",
        headline: `You complete most high-priority work before ${beforeNoon >= 50 ? "noon" : "midnight"}`,
        detail: `${beforeNoon}% of your ${tasks.completed} completions happen before noon, peaking around ${hourLabel(
          peak.hour,
        )}.`,
        metric: "completion_before_noon",
        value: beforeNoon,
        sampleSize: tasks.completed,
        area: "tasks",
      });
    }
  }

  if (accuracy.totalTasksWithEstimate >= 4 && accuracy.meanErrorMin != null) {
    const under = accuracy.underEstimateCount > accuracy.overEstimateCount;
    const magnitude = Math.abs(accuracy.meanErrorMin);
    insights.push({
      id: "estimate-accuracy",
      tone: magnitude > 60 ? "warning" : "neutral",
      headline: under
        ? `You regularly underestimate task duration`
        : `You regularly overestimate task duration`,
      detail: `Across ${accuracy.totalTasksWithEstimate} timed sessions you ran an average of ${magnitude} min ${
        under ? "longer" : "shorter"
      } than planned.`,
      metric: "estimate_error_min",
      value: accuracy.meanErrorMin,
      sampleSize: accuracy.totalTasksWithEstimate,
      area: "planning",
    });
  }

  const habitTrend = describeHabitTrend(state, from, to, now);
  if (habitTrend) insights.push(habitTrend);

  if (tasks.createdVsCompleted.net > 3 && tasks.created > 0) {
    insights.push({
      id: "backlog-growth",
      tone: "warning",
      headline: "Your backlog is growing",
      detail: `You captured ${tasks.createdVsCompleted.created} tasks and finished ${tasks.completed}. That's +${tasks.createdVsCompleted.net} net.`,
      metric: "net_task_change",
      value: tasks.createdVsCompleted.net,
      sampleSize: tasks.createdVsCompleted.created,
      area: "tasks",
    });
  } else if (tasks.createdVsCompleted.net < -2 && tasks.completed > 0) {
    insights.push({
      id: "backlog-shrinking",
      tone: "positive",
      headline: "You are steadily clearing backlog",
      detail: `You finished ${tasks.completed} tasks against ${tasks.createdVsCompleted.created} captured — net ${tasks.createdVsCompleted.net}.`,
      metric: "net_task_change",
      value: tasks.createdVsCompleted.net,
      sampleSize: tasks.completed,
      area: "tasks",
    });
  }

  if (tasks.overdueNow >= 3 && tasks.overdueAgeDays) {
    insights.push({
      id: "overdue-age",
      tone: "warning",
      headline: `${tasks.overdueNow} tasks are overdue, the oldest by ${tasks.overdueAgeDays.oldest} days`,
      detail: `Median overdue age is ${tasks.overdueAgeDays.median} days. Clearing the oldest first frees the most attention.`,
      metric: "overdue_count",
      value: tasks.overdueNow,
      sampleSize: tasks.overdueNow,
      area: "tasks",
    });
  }

  if (focus.sessionCount >= 3) {
    insights.push({
      id: "focus-quality",
      tone: focus.focusRatio >= 0.85 ? "positive" : "neutral",
      headline: `Your focus sessions stay ${Math.round(focus.focusRatio * 100)}% clean`,
      detail: `${focus.sessionCount} sessions · ${focus.averageSessionMin} min average · ${focus.distractionCount} distraction${
        focus.distractionCount === 1 ? "" : "s"
      } in the window.`,
      metric: "focus_ratio",
      value: Math.round(focus.focusRatio * 100),
      sampleSize: focus.sessionCount,
      area: "focus",
    });
  }

  if (time.busyMinutes > 0 && time.focusShare > 0) {
    insights.push({
      id: "time-mix",
      tone: time.meetingShare > 50 ? "warning" : "neutral",
      headline:
        time.meetingShare > 50
          ? "Meetings take more than half your scheduled time"
          : `Your calendar is ${time.utilization}% booked`,
      detail: `${time.focusShare}% of scheduled time is protected focus, ${time.meetingShare}% meetings across ${time.busyMinutes} minutes.`,
      metric: "meeting_share",
      value: time.meetingShare,
      sampleSize: Math.round(time.busyMinutes / 30),
      area: "schedule",
    });
  }

  if (churn.movedBlocks >= 3 && churn.createdBlocks > 0) {
    insights.push({
      id: "schedule-churn",
      tone: "neutral",
      headline: "I moved about a third of your schedule to fit the plan",
      detail: `${churn.movedBlocks} of ${churn.createdBlocks} blocks were relocated to keep your commitments. Lower churn usually means more realistic planning.`,
      metric: "schedule_churn_pct",
      value: churn.churnRate ?? 0,
      sampleSize: churn.createdBlocks,
      area: "schedule",
    });
  }

  return insights.slice(0, 8);
}

function describeHabitTrend(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): AnalyticsInsight | null {
  const habits = Object.values(state.habits).filter((habit) => !habit.archived);
  if (habits.length === 0) return null;

  const windowLength = Math.max(1, Math.round((to - from) / DAY));
  const previousFrom = from - windowLength * DAY;

  const delta = habits.map((habit) => {
    const current = rate(state, habit, from, now);
    const previous = rate(state, habit, previousFrom, from);
    return { habit, current, previous, delta: current - previous };
  });

  const improved = delta.filter((entry) => entry.delta >= 15).sort((a, b) => b.delta - a.delta);
  const declined = delta.filter((entry) => entry.delta <= -15).sort((a, b) => a.delta - b.delta);

  if (improved.length > 0) {
    const top = improved[0]!;
    return {
      id: "habit-improved",
      tone: "positive",
      headline: `Your ${top.habit.title.toLowerCase()} consistency improved this month`,
      detail: `${top.previous}% → ${top.current}% over the equivalent period before.`,
      metric: "habit_delta_pct",
      value: top.delta,
      sampleSize: improved.length,
      area: "habits",
    };
  }

  if (declined.length > 0) {
    const bottom = declined[0]!;
    return {
      id: "habit-declined",
      tone: "action",
      headline: `"${bottom.habit.title}" has slipped`,
      detail: `${bottom.previous}% → ${bottom.current}%. Try shrinking the habit or attaching it to an existing routine.`,
      metric: "habit_delta_pct",
      value: bottom.delta,
      sampleSize: declined.length,
      area: "habits",
    };
  }

  return null;
}

function rate(state: AppState, habit: Habit, from: Timestamp, to: Timestamp): number {
  let expected = 0;
  let kept = 0;
  for (let day = from; day < to; day += DAY) {
    const weekday = (new Date(day).getDay() + 6) % 7;
    const dueToday =
      habit.cadence === "daily"
        ? true
        : habit.cadence === "weekdays"
          ? weekday < 5
          : habit.cadence === "weekly"
            ? weekday === 0
            : habit.cadence === "monthly"
              ? new Date(day).getDate() === 1
              : habit.daysOfWeek.includes(weekday);
    if (!dueToday) continue;
    expected += 1;
    if (os_habitKept(state, habit, day)) kept += 1;
  }
  return expected === 0 ? 0 : Math.round((kept / expected) * 100);
}

function os_habitKept(state: AppState, habit: Habit, day: Timestamp): boolean {
  const from = day;
  const to = day + DAY;
  const checkin = Object.values(state.habitCheckins).some(
    (entry) => entry.habitId === habit.id && entry.checkedAt >= from && entry.checkedAt < to,
  );
  if (checkin) return true;
  const task = Object.values(state.tasks).find(
    (entry) =>
      entry.habitId === habit.id &&
      entry.status === "done" &&
      entry.completedAt != null &&
      entry.completedAt >= from &&
      entry.completedAt < to,
  );
  return task != null;
}

export function trendLabel(values: number[]): string {
  const dir = direction(values);
  const change = percentChange(values);
  if (dir === "flat" || change == null) return "holding steady";
  return `${dir === "rising" ? "up" : "down"} ${Math.abs(change)}%`;
}
