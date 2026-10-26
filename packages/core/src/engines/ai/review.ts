import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import { habitStats, habitStreaks } from "../habit/habits";
import { computeGoalProgress } from "../planning/progress";
import { canUserRead } from "./access";
import type { AICitation, AIResult } from "./types";
import { percent } from "./format";

export interface WeeklyReview {
  from: Timestamp;
  to: Timestamp;
  completedCount: number;
  completedByDay: Array<{ day: Timestamp; count: number; label: string }>;
  createdCount: number;
  overdueNow: number;
  bestDay: { label: string; count: number } | null;
  habitLines: Array<{ title: string; completionRate: number; streak: number }>;
  goalLines: Array<{ title: string; progress: number; horizon: string }>;
  wins: string[];
  risks: string[];
  focusNextWeek: string[];
}

const DAY = 86_400_000;

function startOfWeek(ts: Timestamp, weekStart: 0 | 1): Timestamp {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const offset = weekStart === 1 ? (day + 6) % 7 : day;
  return date.getTime() - offset * DAY;
}

function isOpenTask(task: Task): boolean {
  return task.status === "open" || task.status === "in_progress" || task.status === "inbox";
}

export function buildWeeklyReview(state: AppState, now: Timestamp = Date.now(), weekStart: 0 | 1 = 1): WeeklyReview {
  const from = startOfWeek(now, weekStart);
  const to = from + 7 * DAY;

  const completed = Object.values(state.tasks).filter(
    (task) => task.status === "done" && task.completedAt != null && task.completedAt >= from && task.completedAt < to,
  );
  const created = Object.values(state.tasks).filter((task) => task.createdAt >= from && task.createdAt < to);

  const byDay = new Map<Timestamp, number>();
  for (let i = 0; i < 7; i += 1) {
    byDay.set(from + i * DAY, 0);
  }
  for (const task of completed) {
    const dayStart = Math.floor(task.completedAt! / DAY) * DAY;
    byDay.set(dayStart, (byDay.get(dayStart) ?? 0) + 1);
  }
  const completedByDay = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, count]) => ({
      day,
      count,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
    }));

  let best: { label: string; count: number } | null = null;
  for (const entry of completedByDay) {
    if (!best || entry.count > best.count) best = { label: entry.label, count: entry.count };
  }
  if (best && best.count === 0) best = null;

  const overdueNow = Object.values(state.tasks).filter(
    (task) => isOpenTask(task) && task.dueAt != null && task.dueAt < now,
  ).length;

  const habitLines = Object.values(state.habits)
    .filter((habit) => !habit.archived)
    .map((habit) => {
      const stats = habitStats(state, habit, now, weekStart, 28);
      const streaks = habitStreaks(state, habit, now, weekStart);
      return { title: habit.title, completionRate: stats.completionRate, streak: streaks.current };
    })
    .sort((a, b) => b.completionRate - a.completionRate);

  const goalLines = Object.values(state.goals)
    .filter((goal) => goal.status === "active")
    .map((goal) => {
      const progress = computeGoalProgress(state, goal, now, weekStart);
      return { title: goal.title, progress: progress.progress, horizon: goal.horizon };
    })
    .sort((a, b) => b.progress - a.progress);

  const wins: string[] = [];
  const risks: string[] = [];
  const focusNextWeek: string[] = [];

  if (completed.length > 0) {
    wins.push(`Completed ${completed.length} task${completed.length === 1 ? "" : "s"} this week.`);
  } else {
    risks.push("Nothing was completed this week.");
  }
  if (best) {
    wins.push(`${best.label} was your strongest day (${best.count} completed).`);
  }
  const strongHabits = habitLines.filter((habit) => habit.completionRate >= 70);
  if (strongHabits.length > 0) {
    wins.push(
      `Holding ${strongHabits.length} habit${strongHabits.length === 1 ? "" : "s"} at ${percent(
        strongHabits[0]!.completionRate,
      )}+ consistency.`,
    );
  }
  const weakHabits = habitLines.filter((habit) => habit.completionRate < 40);
  if (weakHabits.length > 0) {
    risks.push(`${weakHabits.length} habit${weakHabits.length === 1 ? " is" : "s are"} below 40% consistency.`);
  }
  if (overdueNow > 0) {
    risks.push(`${overdueNow} task${overdueNow === 1 ? " is" : "s are"} overdue.`);
  }
  const stalledGoals = goalLines.filter((goal) => goal.progress < 25);
  if (stalledGoals.length > 0) {
    risks.push(`${stalledGoals.length} goal${stalledGoals.length === 1 ? "" : "s"} under 25% progress.`);
  }

  const upcoming = Object.values(state.tasks)
    .filter((task) => isOpenTask(task) && task.dueAt != null && task.dueAt >= from && task.dueAt < to + 7 * DAY)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
    .slice(0, 5);
  for (const task of upcoming) {
    focusNextWeek.push(task.title);
  }
  if (overdueNow > 0) {
    focusNextWeek.unshift(`Clear ${overdueNow} overdue task${overdueNow === 1 ? "" : "s"}`);
  }

  return {
    from,
    to,
    completedCount: completed.length,
    completedByDay,
    createdCount: created.length,
    overdueNow,
    bestDay: best,
    habitLines,
    goalLines,
    wins,
    risks,
    focusNextWeek,
  };
}

export function weeklyReviewResult(state: AppState, now: Timestamp = Date.now()): AIResult {
  const review = buildWeeklyReview(state, now, state.settings.weekStart);
  const citations: AICitation[] = [];

  const completed = Object.values(state.tasks).filter(
    (task) => task.status === "done" && task.completedAt != null && task.completedAt >= review.from && task.completedAt < review.to,
  );
  for (const task of completed.slice(0, 6)) {
    citations.push({
      entityType: "task",
      entityId: task.id,
      title: task.title,
      quote: `completed ${new Date(task.completedAt!).toLocaleDateString()}`,
    });
  }
  for (const goal of goalAuthorizedTargets(state).slice(0, 4)) {
    citations.push({
      entityType: "goal",
      entityId: goal.id,
      title: goal.title,
      quote: `${goal.progress}% progress`,
    });
  }

  const range = `${new Date(review.from).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${new Date(review.to - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  const lines: string[] = [];
  lines.push(`Weekly review · ${range}`);
  lines.push(`Completed ${review.completedCount} · created ${review.createdCount} · overdue ${review.overdueNow}`);
  if (review.bestDay) lines.push(`Best day: ${review.bestDay.label} (${review.bestDay.count})`);
  if (review.wins.length > 0) lines.push(`Wins: ${review.wins.join(" ")}`);
  if (review.risks.length > 0) lines.push(`Watch: ${review.risks.join(" ")}`);
  if (review.focusNextWeek.length > 0) lines.push(`Next: ${review.focusNextWeek.slice(0, 3).join("; ")}`);

  return {
    kind: "answer",
    message: lines.join("\n"),
    capability: "weekly_review",
    citations,
    proposals: [
      {
        capability: "weekly_review",
        title: "Save this weekly review as an AI summary",
        summary: `Stores the ${range} review so you can find it later.`,
        risk: "low",
        requiresConfirmation: true,
        reasoning: "Reviews are saved as AI objects you can re-open.",
        preview: [{ label: "Review", detail: lines.slice(1).join(" · ").slice(0, 200) }],
        refs: [],
        payload: {
          kind: "ai_summary",
          summary: lines.join("\n"),
          title: `Weekly review ${range}`,
        },
      },
    ],
    data: review,
  };
}

function goalAuthorizedTargets(state: AppState) {
  return Object.values(state.goals)
    .filter((goal) => goal.status === "active")
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      progress: computeGoalProgress(state, goal, Date.now(), state.settings.weekStart).progress,
    }))
    .filter((goal) => canUserRead(state, { ownerId: undefined }));
}