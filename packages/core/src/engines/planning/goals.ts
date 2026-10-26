import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Goal, GoalCategory, GoalStatus } from "../../types/goal";
import { GOAL_CATEGORY_LABELS } from "../../types/goal";
import type { Milestone } from "../../types/planning";
import { addDays, startOfDay } from "../date-utils";
import { computeGoalProgress } from "./progress";

const DAY = 86_400_000;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MAX_TIMELINE_MONTHS = 24;

function shiftMonth(time: Timestamp, delta: number): Timestamp {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + delta);
  return date.getTime();
}

function endOfMonth(time: Timestamp): Timestamp {
  const date = new Date(time);
  date.setMonth(date.getMonth() + 1, 0);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function monthKey(time: Timestamp): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

export function goalTimelineLabel(time: Timestamp): string {
  const date = new Date(time);
  return `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

export type GoalHealth =
  | "in_progress"
  | "on_track"
  | "ahead"
  | "at_risk"
  | "overdue"
  | "on_hold"
  | "completed";

export type GoalTab = "all" | "in_progress" | "completed" | "on_hold" | "overdue" | "archived";
export type GoalTimeframe = "all" | "month" | "quarter" | "year";

export function goalProgressAt(state: AppState, goal: Goal, now: Timestamp): number {
  if (goal.status === "completed") return 100;
  return computeGoalProgress(state, goal, now).progress;
}

export function goalHealth(goal: Goal, progress: number, now: Timestamp): GoalHealth {
  if (goal.status === "completed") return "completed";
  if (goal.status === "on_hold") return "on_hold";
  if (goal.status === "archived") return "on_hold";

  if (goal.targetAt != null && goal.targetAt < now) return "overdue";

  if (goal.targetAt == null) {
    return progress >= 50 ? "on_track" : "in_progress";
  }

  const span = goal.targetAt - goal.createdAt;
  if (span <= 0) return progress >= 50 ? "on_track" : "at_risk";
  const elapsed = Math.min(1, Math.max(0, (now - goal.createdAt) / span));
  const expected = elapsed * 100;
  const gap = progress - expected;

  if (gap >= 15) return "ahead";
  if (gap >= -10) return "on_track";
  return "at_risk";
}

export function goalTabMatches(goal: Goal, progress: number, tab: GoalTab, now: Timestamp): boolean {
  const health = goalHealth(goal, progress, now);
  switch (tab) {
    case "in_progress":
      return goal.status === "active" && health !== "overdue";
    case "completed":
      return goal.status === "completed";
    case "on_hold":
      return goal.status === "on_hold";
    case "overdue":
      return health === "overdue";
    case "archived":
      return goal.status === "archived";
    default:
      return goal.status !== "archived";
  }
}

export interface GoalCategoryProgress {
  category: GoalCategory;
  label: string;
  progress: number;
  count: number;
}

export interface GoalTimelinePoint {
  key: string;
  label: string;
  progress: number;
}

export interface GoalCardData {
  id: ID;
  title: string;
  description: string;
  category: GoalCategory;
  progress: number;
  health: GoalHealth;
  status: GoalStatus;
  dueAt: Timestamp | null;
  metricSummary: string | null;
  coverUrl: string | null;
}

export interface GoalStats {
  inProgress: number;
  inProgressTotal: number;
  completed: number;
  overdue: number;
  dueThisQuarter: number;
  deltas: {
    inProgress: number | null;
    completed: number | null;
    overdue: number | null;
    quarter: number | null;
  };
}

export interface GoalsDashboard {
  stats: GoalStats;
  categories: GoalCategoryProgress[];
  timeline: GoalTimelinePoint[];
  health: Record<GoalHealth, number>;
  overallProgress: number;
  insight: string;
  goals: GoalCardData[];
  totals: { all: number; in_progress: number; completed: number; on_hold: number; overdue: number; archived: number };
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function isSameQuarter(a: Timestamp, b: Timestamp): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && Math.floor(da.getMonth() / 3) === Math.floor(db.getMonth() / 3);
}

function metricSummaryFor(goal: Goal): string | null {
  const metric = goal.metrics.find((entry) => entry.target > 0);
  if (!metric) return null;
  const unit = metric.unit.trim();
  return `${metric.current} / ${metric.target}${unit.length > 0 ? ` ${unit}` : ""}`;
}

function toCardData(state: AppState, goal: Goal, now: Timestamp): GoalCardData {
  const progress = goalProgressAt(state, goal, now);
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    category: goal.category,
    progress,
    health: goalHealth(goal, progress, now),
    status: goal.status,
    dueAt: goal.targetAt,
    metricSummary: metricSummaryFor(goal),
    coverUrl: goal.coverUrl,
  };
}

function timeframeCutoff(timeframe: GoalTimeframe, now: Timestamp): Timestamp | null {
  const date = new Date(now);
  if (timeframe === "month") return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  if (timeframe === "quarter") {
    const quarterEndMonth = Math.floor(date.getMonth() / 3) * 3 + 2;
    return new Date(date.getFullYear(), quarterEndMonth + 1, 0, 23, 59, 59, 999).getTime();
  }
  if (timeframe === "year") return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
  return null;
}

export function buildGoalsDashboard(
  state: AppState,
  now: Timestamp,
  options: { tab?: GoalTab; category?: GoalCategory | "all"; timeframe?: GoalTimeframe } = {},
): GoalsDashboard {
  const tab = options.tab ?? "all";
  const category = options.category ?? "all";
  const timeframe = options.timeframe ?? "all";

  const everyGoal = Object.values(state.goals);
  const allGoals = everyGoal.filter((goal) => goal.status !== "archived");
  const withProgress = allGoals.map((goal) => ({ goal, progress: goalProgressAt(state, goal, now) }));
  const archivedWithProgress = everyGoal
    .filter((goal) => goal.status === "archived")
    .map((goal) => ({ goal, progress: goalProgressAt(state, goal, now) }));

  const health: Record<GoalHealth, number> = {
    in_progress: 0,
    on_track: 0,
    ahead: 0,
    at_risk: 0,
    overdue: 0,
    on_hold: 0,
    completed: 0,
  };
  for (const entry of withProgress) health[goalHealth(entry.goal, entry.progress, now)] += 1;

  const activeGoals = allGoals.filter((goal) => goal.status === "active");
  const completedGoals = allGoals.filter((goal) => goal.status === "completed");
  const onHoldGoals = allGoals.filter((goal) => goal.status === "on_hold");
  const overdueGoals = withProgress.filter(
    (entry) => goalHealth(entry.goal, entry.progress, now) === "overdue",
  );
  const inProgressGoals = activeGoals.filter(
    (goal) => goalHealth(goal, withProgress.find((entry) => entry.goal.id === goal.id)?.progress ?? 0, now) !== "overdue",
  );
  const dueThisQuarter = allGoals.filter(
    (goal) => goal.targetAt != null && isSameQuarter(goal.targetAt, now),
  );

  const monthAgo = now - 30 * DAY;
  const twoMonthsAgo = now - 60 * DAY;
  const inWindow = (at: Timestamp | null, from: Timestamp, to: Timestamp): boolean =>
    at != null && at > from && at <= to;

  const completedRecent = allGoals.filter((goal) => inWindow(goal.updatedAt, monthAgo, now) && goal.status === "completed").length;
  const completedPrior = allGoals.filter((goal) => inWindow(goal.updatedAt, twoMonthsAgo, monthAgo) && goal.status === "completed").length;
  const createdRecent = allGoals.filter((goal) => inWindow(goal.createdAt, monthAgo, now)).length;
  const createdPrior = allGoals.filter((goal) => inWindow(goal.createdAt, twoMonthsAgo, monthAgo)).length;
  const overdueRecent = allGoals.filter(
    (goal) => goal.targetAt != null && inWindow(goal.targetAt, monthAgo, now) && goal.status !== "completed",
  ).length;
  const overduePrior = allGoals.filter(
    (goal) => goal.targetAt != null && inWindow(goal.targetAt, twoMonthsAgo, monthAgo) && goal.status !== "completed",
  ).length;

  const prevQuarterAnchor = new Date(now);
  prevQuarterAnchor.setMonth(prevQuarterAnchor.getMonth() - 3);
  const dueThisQuarterPrev = allGoals.filter(
    (goal) => goal.targetAt != null && isSameQuarter(goal.targetAt, prevQuarterAnchor.getTime()),
  ).length;

  const stats: GoalStats = {
    inProgress: inProgressGoals.length,
    inProgressTotal: allGoals.length,
    completed: completedGoals.length,
    overdue: overdueGoals.length,
    dueThisQuarter: dueThisQuarter.length,
    deltas: {
      inProgress: pctDelta(createdRecent, createdPrior),
      completed: pctDelta(completedRecent, completedPrior),
      overdue: pctDelta(overdueRecent, overduePrior),
      quarter: pctDelta(dueThisQuarter.length, dueThisQuarterPrev),
    },
  };

  const nonArchived = allGoals;
  const overallProgress =
    nonArchived.length === 0
      ? 0
      : Math.round(
          nonArchived.reduce((total, goal) => total + goalProgressAt(state, goal, now), 0) / nonArchived.length,
        );

  const categoryMap = new Map<GoalCategory, { total: number; count: number }>();
  for (const entry of withProgress) {
    const bucket = categoryMap.get(entry.goal.category) ?? { total: 0, count: 0 };
    bucket.total += entry.progress;
    bucket.count += 1;
    categoryMap.set(entry.goal.category, bucket);
  }
  const categories: GoalCategoryProgress[] = [...categoryMap.entries()]
    .map(([key, bucket]) => ({
      category: key,
      label: GOAL_CATEGORY_LABELS[key],
      progress: Math.round(bucket.total / bucket.count),
      count: bucket.count,
    }))
    .sort((a, b) => b.progress - a.progress);

  const timeline = buildGoalTimeline(withProgress, now);

  const onTrackish = health.on_track + health.ahead;
  const needsAttention = health.at_risk + health.overdue;
  const insight =
    needsAttention === 0
      ? `${onTrackish} of your ${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"} are on track or ahead.`
      : onTrackish >= needsAttention
        ? `${onTrackish} goals are on track, ${needsAttention} need attention this week.`
        : `${needsAttention} goal${needsAttention === 1 ? "" : "s"} need attention — start with the one closest to its deadline.`;

  const cutoff = timeframeCutoff(timeframe, now);
  const filteredSource = tab === "archived" ? archivedWithProgress : withProgress;
  const filtered = filteredSource
    .filter((entry) => goalTabMatches(entry.goal, entry.progress, tab, now))
    .filter((entry) => category === "all" || entry.goal.category === category)
    .filter((entry) => cutoff == null || (entry.goal.targetAt != null && entry.goal.targetAt <= cutoff))
    .sort((a, b) => b.progress - a.progress)
    .map((entry) => toCardData(state, entry.goal, now));

  return {
    stats,
    categories,
    timeline,
    health,
    overallProgress,
    insight,
    goals: filtered,
    totals: {
      all: allGoals.length,
      in_progress: health.in_progress + health.on_track + health.ahead + health.at_risk,
      completed: completedGoals.length,
      on_hold: onHoldGoals.length,
      overdue: overdueGoals.length,
      archived: archivedWithProgress.length,
    },
  };
}

export interface GoalMilestoneRow {
  id: ID;
  title: string;
  dueAt: Timestamp | null;
  goalTitle: string | null;
  category: GoalCategory | null;
  health: "on_track" | "at_risk" | "upcoming" | "done";
}

function milestoneHealthRow(milestone: Milestone, now: Timestamp): GoalMilestoneRow["health"] {
  if (milestone.status === "completed") return "done";
  if (milestone.dueAt != null && milestone.dueAt < now) return "at_risk";
  if (milestone.dueAt != null && milestone.dueAt - now < 7 * DAY) return "on_track";
  return "upcoming";
}

export function upcomingGoalMilestones(
  state: AppState,
  now: Timestamp,
  limit = 5,
): GoalMilestoneRow[] {
  const goalByProject = new Map<ID, Goal>();
  for (const project of Object.values(state.projects)) {
    for (const goalId of project.goalIds) {
      const goal = state.goals[goalId];
      if (goal && goal.status === "active" && !goalByProject.has(project.id)) {
        goalByProject.set(project.id, goal);
      }
    }
  }

  const from = startOfDay(now);
  const open = Object.values(state.milestones).filter(
    (milestone) => milestone.status === "open" && milestone.dueAt != null && milestone.dueAt >= from,
  );

  const withGoal = open
    .map((milestone) => ({ milestone, goal: goalByProject.get(milestone.projectId) ?? null }))
    .sort((a, b) => (a.milestone.dueAt ?? 0) - (b.milestone.dueAt ?? 0));

  const scoped = withGoal.some((entry) => entry.goal != null)
    ? withGoal.filter((entry) => entry.goal != null)
    : withGoal;

  return scoped.slice(0, limit).map(({ milestone, goal }) => ({
    id: milestone.id,
    title: milestone.title,
    dueAt: milestone.dueAt,
    goalTitle: goal?.title ?? null,
    category: goal?.category ?? null,
    health: milestoneHealthRow(milestone, now),
  }));
}

export function quarterLabel(now: Timestamp): string {
  const date = new Date(now);
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

export function goalTimelineRange(now: Timestamp): { from: Timestamp; to: Timestamp } {
  const from = startOfDay(addDays(now, -180));
  const to = startOfDay(addDays(now, 365));
  return { from, to };
}

function buildGoalTimeline(
  entries: Array<{ goal: Goal; progress: number }>,
  now: Timestamp,
): GoalTimelinePoint[] {
  const horizon = goalTimelineRange(now).to;
  const dated = entries.filter((entry) => entry.goal.targetAt != null);
  const undated = entries.filter((entry) => entry.goal.targetAt == null);

  const latestDue = dated.reduce(
    (latest, entry) => Math.max(latest, entry.goal.targetAt as number),
    horizon,
  );

  const start = Math.max(
    shiftMonth(now, -1),
    shiftMonth(latestDue, -(MAX_TIMELINE_MONTHS - 1)),
  );
  const end = shiftMonth(latestDue, 0);

  const timeline: GoalTimelinePoint[] = [];
  let carried = 0;
  for (let cursor = start; cursor <= end; cursor = shiftMonth(cursor, 1)) {
    const monthEnd = endOfMonth(cursor);
    const due = dated.filter((entry) => (entry.goal.targetAt as number) <= monthEnd);
    const pool = undated.length > 0 ? [...due, ...undated] : due;
    if (pool.length > 0) {
      carried = Math.round(pool.reduce((total, entry) => total + entry.progress, 0) / pool.length);
    }
    timeline.push({ key: monthKey(cursor), label: goalTimelineLabel(cursor), progress: carried });
  }

  return timeline;
}
