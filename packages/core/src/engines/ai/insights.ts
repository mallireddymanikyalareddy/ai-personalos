import type { AppState } from "../../store/state";
import type { Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import { habitStats, habitStreaks } from "../habit/habits";
import { computeGoalProgress } from "../planning/progress";
import { selectCompletionStats } from "../task/query";
import { findPlanningWindows, totalPlanningFreeMinutes } from "../planner/windows";
import type { AIInsightKind, AIInsightSeverity } from "../../types/ai";
import type { AIResult } from "./types";
import { formatMinutes, percent } from "./format";

export interface ProductivityInsight {
  id: string;
  kind: AIInsightKind;
  severity: AIInsightSeverity;
  title: string;
  body: string;
  confidence: number;
  metric: string;
  value: number;
  dedupeKey: string;
}

export interface AIRecommendation {
  id: string;
  title: string;
  detail: string;
  capability: string;
  refs: Array<{ entityType: "task" | "goal" | "habit" | "project" | "note"; entityId: string }>;
  priority: number;
}

const DAY = 86_400_000;

function isOpen(task: Task): boolean {
  return task.status === "open" || task.status === "in_progress" || task.status === "inbox";
}

function rangeDays(now: Timestamp, days: number): { from: number; to: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime() - (days - 1) * DAY;
  return { from, to: from + days * DAY };
}

export function computeInsights(state: AppState, now: Timestamp = Date.now()): ProductivityInsight[] {
  const insights: ProductivityInsight[] = [];
  const thisWeek = rangeDays(now, 7);
  const lastWeek = rangeDays(now - 7 * DAY, 7);

  const thisStats = selectCompletionStats(state, thisWeek.from, thisWeek.to, now);
  const lastStats = selectCompletionStats(state, lastWeek.from, lastWeek.to, now);

  const thisRate = thisStats.total > 0 ? (thisStats.done / thisStats.total) * 100 : 0;
  const lastRate = lastStats.total > 0 ? (lastStats.done / lastStats.total) * 100 : 0;
  const delta = thisRate - lastRate;

  insights.push({
    id: "completion-rate",
    kind: "trend",
    severity: "info",
    title: "Weekly completion rate",
    body:
      `${thisStats.done} of ${thisStats.total} tasks completed this week (${percent(thisRate)}). ` +
      (lastStats.total > 0
        ? `Last week was ${percent(lastRate)} — ${delta >= 0 ? "up" : "down"} ${percent(Math.abs(delta))}.`
        : "No previous week to compare."),
    confidence: thisStats.total >= 3 ? 0.85 : 0.5,
    metric: "completion_rate",
    value: Math.round(thisRate),
    dedupeKey: `completion-rate:${Math.floor(now / DAY)}`,
  });

  let bestDayLabel = "";
  let bestDayCount = 0;
  for (const [day, count] of Object.entries(thisStats.byDay)) {
    if (count > bestDayCount) {
      bestDayCount = count;
      bestDayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(Number(day));
    }
  }
  if (bestDayCount > 1) {
    insights.push({
      id: "best-day",
      kind: "trend",
      severity: "info",
      title: "Your strongest day",
      body: `${bestDayLabel} produced ${bestDayCount} completions this week. Deep work clusters there.`,
      confidence: 0.7,
      metric: "best_day",
      value: bestDayCount,
      dedupeKey: `best-day:${bestDayLabel}:${Math.floor(now / DAY)}`,
    });
  }

  const overdue = Object.values(state.tasks).filter(
    (task) => isOpen(task) && task.dueAt != null && task.dueAt < now,
  );
  if (overdue.length > 0) {
    const oldest = Math.min(...overdue.map((task) => task.dueAt!));
    const ageDays = Math.max(0, Math.round((now - oldest) / DAY));
    const byPriority = overdue.reduce<Record<number, number>>((acc, task) => {
      acc[task.priority] = (acc[task.priority] ?? 0) + 1;
      return acc;
    }, {});
    const urgent = byPriority[4] ?? 0;
    insights.push({
      id: "overdue-load",
      kind: "risk",
      severity: overdue.length > 5 ? "warning" : "info",
      title: `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`,
      body:
        `The oldest is ${ageDays} day${ageDays === 1 ? "" : "s"} past due` +
        (urgent > 0 ? ` and ${urgent} are urgent` : "") +
        ". Clearing the oldest first frees the most mental load.",
      confidence: 0.9,
      metric: "overdue",
      value: overdue.length,
      dedupeKey: `overdue:${overdue.length}`,
    });
  }

  const habits = Object.values(state.habits).filter((habit) => !habit.archived);
  if (habits.length > 0) {
    const ranked = habits
      .map((habit) => ({
        habit,
        stats: habitStats(state, habit, now, state.settings.weekStart, 28),
        streaks: habitStreaks(state, habit, now, state.settings.weekStart),
      }))
      .sort((a, b) => b.stats.completionRate - a.stats.completionRate);
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;

    insights.push({
      id: "habit-consistency",
      kind: "trend",
      severity: "info",
      title: "Habit consistency",
      body: `"${best.habit.title}" leads at ${percent(best.stats.completionRate)} (streak ${best.streaks.current}). ${
        worst.habit.id !== best.habit.id
          ? `"${worst.habit.title}" trails at ${percent(worst.stats.completionRate)}.`
          : "It is your only tracked habit."
      }`,
      confidence: 0.75,
      metric: "habit_consistency",
      value: best.stats.completionRate,
      dedupeKey: `habit:${best.habit.id}`,
    });

    if (worst.stats.completionRate < 40 && ranked.length > 1) {
      insights.push({
        id: `habit-risk-${worst.habit.id}`,
        kind: "risk",
        severity: "warning",
        title: `"${worst.habit.title}" is slipping`,
        body: `Only ${percent(worst.stats.completionRate)} consistency over the last 4 weeks. Lower the target, attach it to an existing routine, or pick a different time.`,
        confidence: 0.7,
        metric: "habit_risk",
        value: worst.stats.completionRate,
        dedupeKey: `habit-risk:${worst.habit.id}`,
      });
    }
  }

  const goals = Object.values(state.goals).filter((goal) => goal.status === "active");
  if (goals.length > 0) {
    const ranked = goals
      .map((goal) => ({ goal, progress: computeGoalProgress(state, goal, now, state.settings.weekStart).progress }))
      .sort((a, b) => a.progress - b.progress);
    const weakest = ranked[0]!;
    if (weakest.progress < 25) {
      insights.push({
        id: `goal-stall-${weakest.goal.id}`,
        kind: "risk",
        severity: "action",
        title: `"${weakest.goal.title}" is barely moving`,
        body: `At ${percent(weakest.progress)}, this goal needs decomposition into projects, milestones, and habits before it can progress.`,
        confidence: 0.8,
        metric: "goal_progress",
        value: weakest.progress,
        dedupeKey: `goal-stall:${weakest.goal.id}`,
      });
    }
    insights.push({
      id: "goal-velocity",
      kind: "summary",
      severity: "info",
      title: "Goal portfolio",
      body: `${goals.length} active goal${goals.length === 1 ? "" : "s"} · strongest at ${percent(
        ranked[ranked.length - 1]!.progress,
      )} · weakest at ${percent(weakest.progress)}.`,
      confidence: 0.7,
      metric: "goal_velocity",
      value: Math.round(
        goals.reduce((sum, goal) => sum + computeGoalProgress(state, goal, now, state.settings.weekStart).progress, 0) /
          goals.length,
      ),
      dedupeKey: `goal-portfolio:${Math.floor(now / (7 * DAY))}`,
    });
  }

  const prefs = state.settings.planning;
  const freeMin = totalPlanningFreeMinutes(state, prefs, thisWeek.from, thisWeek.to, 30);
  insights.push({
    id: "capacity",
    kind: "suggestion",
    severity: "info",
    title: "Planning capacity",
    body: `${formatMinutes(freeMin)} of planning windows are open this week across ${
      findPlanningWindows(state, prefs, thisWeek.from, thisWeek.to, 30).length
    } slots.`,
    confidence: 0.8,
    metric: "free_minutes",
    value: freeMin,
    dedupeKey: `capacity:${Math.floor(now / DAY)}`,
  });

  const createdThisWeek = Object.values(state.tasks).filter(
    (task) => task.createdAt >= thisWeek.from && task.createdAt < thisWeek.to,
  ).length;
  const net = createdThisWeek - thisStats.done;
  if (net > 3) {
    insights.push({
      id: "backlog-growth",
      kind: "risk",
      severity: "warning",
      title: "Backlog is growing",
      body: `You captured ${createdThisWeek} tasks and completed ${thisStats.done}. Net +${net} open items this week.`,
      confidence: 0.75,
      metric: "backlog_growth",
      value: net,
      dedupeKey: `backlog:${net > 0 ? "growing" : "shrinking"}`,
    });
  }

  return insights;
}

export function computeRecommendations(state: AppState, now: Timestamp = Date.now()): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];
  const insights = computeInsights(state, now);

  const overdue = Object.values(state.tasks)
    .filter((task) => isOpen(task) && task.dueAt != null && task.dueAt < now)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));

  if (overdue.length > 0) {
    const oldest = overdue[0]!;
    recommendations.push({
      id: "clear-overdue",
      title: `Clear ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`,
      detail: `Start with "${oldest.title}" — it is the oldest at ${Math.round(
        (now - oldest.dueAt!) / DAY,
      )} days past due.`,
      capability: "plan_day",
      refs: [{ entityType: "task", entityId: oldest.id }],
      priority: 100,
    });
  }

  const freeTomorrow = findPlanningWindows(
    state,
    state.settings.planning,
    startOfNextDay(now),
    startOfNextDay(now) + DAY,
    30,
  );
  const freeMinutes = freeTomorrow.reduce((sum, slot) => sum + slot.durationMin, 0);
  if (freeMinutes >= 60) {
    const focus = Object.values(state.tasks)
      .filter((task) => isOpen(task) && (task.priority >= 3 || task.dueAt != null))
      .sort((a, b) => b.priority - a.priority || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
      .slice(0, 3);

    if (focus.length > 0) {
      recommendations.push({
        id: "use-free-time",
        title: `Plan ${formatMinutes(freeMinutes)} into tomorrow`,
        detail: `Top candidates: ${focus.map((task) => task.title).join(", ")}.`,
        capability: "plan_day",
        refs: focus.map((task) => ({ entityType: "task" as const, entityId: task.id })),
        priority: 80,
      });
    }
  }

  const stalledGoals = Object.values(state.goals)
    .filter((goal) => goal.status === "active")
    .map((goal) => ({ goal, progress: computeGoalProgress(state, goal, now, state.settings.weekStart).progress }))
    .filter((entry) => entry.progress < 25)
    .sort((a, b) => a.progress - b.progress);

  if (stalledGoals.length > 0) {
    recommendations.push({
      id: "decompose-stalled-goal",
      title: `Decompose "${stalledGoals[0]!.goal.title}"`,
      detail: `At ${percent(stalledGoals[0]!.progress)}, it needs projects, milestones, and a habit to move.`,
      capability: "decompose_goal",
      refs: [{ entityType: "goal", entityId: stalledGoals[0]!.goal.id }],
      priority: 70,
    });
  }

  const weakHabit = Object.values(state.habits)
    .filter((habit) => !habit.archived)
    .map((habit) => ({ habit, rate: habitStats(state, habit, now, state.settings.weekStart, 28).completionRate }))
    .filter((entry) => entry.rate < 40)
    .sort((a, b) => a.rate - b.rate)[0];

  if (weakHabit) {
    recommendations.push({
      id: "fix-habit",
      title: `Rework "${weakHabit.habit.title}"`,
      detail: `At ${percent(weakHabit.rate)} consistency, shrink the goal or attach it to a routine you already keep.`,
      capability: "recommendations",
      refs: [{ entityType: "habit", entityId: weakHabit.habit.id }],
      priority: 60,
    });
  }

  const riskInsight = insights.find((insight) => insight.kind === "risk" && insight.severity === "warning");
  if (riskInsight) {
    recommendations.push({
      id: `insight-${riskInsight.id}`,
      title: riskInsight.title,
      detail: riskInsight.body,
      capability: "insights",
      refs: [],
      priority: 40,
    });
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

function startOfNextDay(now: Timestamp): Timestamp {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime() + DAY;
}

export function insightsResult(state: AppState, now: Timestamp = Date.now()): AIResult {
  const insights = computeInsights(state, now);
  const lines = insights.map((insight) => `${insight.title}: ${insight.body}`);
  return {
    kind: "answer",
    message:
      lines.length > 0
        ? lines.join("\n\n")
        : "Not enough activity yet to draw insights. Keep capturing and completing tasks.",
    capability: "insights",
    citations: [],
    proposals: [
      {
        capability: "insights",
        title: `Save ${insights.length} insight${insights.length === 1 ? "" : "s"}`,
        summary: "Stores them as AI insights you can review and dismiss.",
        risk: "low",
        requiresConfirmation: true,
        reasoning: "Insights are stored so they can be tracked over time instead of lost in chat.",
        preview: insights.slice(0, 8).map((insight) => ({ label: insight.title, detail: insight.body })),
        refs: [],
        payload: {
          kind: "insights",
          insights: insights.map((insight) => ({
            kind: insight.kind,
            severity: insight.severity,
            title: insight.title,
            body: insight.body,
            confidence: insight.confidence,
            dedupeKey: insight.dedupeKey,
          })),
        },
      },
    ],
    data: { insights },
  };
}

export function recommendationsResult(state: AppState, now: Timestamp = Date.now()): AIResult {
  const recommendations = computeRecommendations(state, now);
  if (recommendations.length === 0) {
    return {
      kind: "answer",
      message: "Nothing needs your attention right now. Your system looks healthy.",
      capability: "recommendations",
      citations: [],
      proposals: [],
    };
  }
  return {
    kind: "answer",
    message: recommendations
      .slice(0, 6)
      .map((rec, index) => `${index + 1}. ${rec.title} — ${rec.detail}`)
      .join("\n"),
    capability: "recommendations",
    citations: recommendations
      .flatMap((rec) => rec.refs)
      .slice(0, 8)
      .map((ref) => ({
        entityType: ref.entityType,
        entityId: ref.entityId,
        title: recommendations.find((r) => r.refs.some((x) => x.entityId === ref.entityId))?.title ?? "Related",
        quote: "referenced by a recommendation",
      })),
    proposals: [],
    data: { recommendations },
  };
}