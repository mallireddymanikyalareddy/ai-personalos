"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import { aiProvider, startOfDay, startOfWeek, type Timestamp } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText } from "@/modules/notebook/notebook-export";
import { useFocusNow } from "@/modules/focus/use-focus-now";
import { useAppState, useOS } from "@/store/use-os";

import {
  DistributionDonut,
  MiniBars,
  ProductivityTrend,
  ScoreDonut,
  formatHours,
} from "./insights-charts";
import { seedSampleInsights } from "./sample-insights";

type Range = "today" | "week" | "month" | "quarter" | "year";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

const DAY = 86_400_000;

function windowFor(
  range: Range,
  now: number,
  weekStart: 0 | 1,
): { from: Timestamp; to: Timestamp; span: number } {
  const today = startOfDay(now);
  if (range === "today") return { from: today, to: today + DAY, span: DAY };
  if (range === "week") {
    const start = startOfWeek(today, weekStart);
    return { from: start, to: start + 7 * DAY, span: 7 * DAY };
  }
  if (range === "month") {
    const date = new Date(today);
    const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
    return { from: start, to: end, span: end - start };
  }
  if (range === "quarter") {
    const date = new Date(today);
    const quarterStart = new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime();
    const quarterEnd = new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3 + 3, 1).getTime();
    return { from: quarterStart, to: quarterEnd, span: quarterEnd - quarterStart };
  }
  const date = new Date(today);
  const yearStart = new Date(date.getFullYear(), 0, 1).getTime();
  const yearEnd = new Date(date.getFullYear() + 1, 0, 1).getTime();
  return { from: yearStart, to: yearEnd, span: yearEnd - yearStart };
}

function previousWindow(range: Range, from: Timestamp): { from: Timestamp; to: Timestamp } {
  const date = new Date(from);
  if (range === "month") {
    return { from: new Date(date.getFullYear(), date.getMonth() - 1, 1).getTime(), to: from };
  }
  if (range === "quarter") {
    return { from: new Date(date.getFullYear(), date.getMonth() - 3, 1).getTime(), to: from };
  }
  if (range === "year") {
    return { from: new Date(date.getFullYear() - 1, 0, 1).getTime(), to: from };
  }
  return { from: from - (range === "today" ? DAY : 7 * DAY), to: from };
}
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildFocusSeries(
  byDay: Array<{ day: Timestamp; label: string; minutes: number }>,
  from: Timestamp,
  to: Timestamp,
  now: Timestamp,
): Array<{ day: Timestamp; label: string; minutes: number }> {
  const minutesByDay = new Map(byDay.map((entry) => [startOfDay(entry.day), entry.minutes]));
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const end = Math.min(to, startOfDay(now) + DAY);
  const days: Array<{ day: Timestamp; label: string; minutes: number }> = [];
  for (let day = startOfDay(from); day < end; day += DAY) {
    days.push({ day, label: weekday.format(day), minutes: minutesByDay.get(day) ?? 0 });
  }
  if (days.length <= 31) return days;

  if (days.length <= 92) {
    const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    const weeks: Array<{ day: Timestamp; label: string; minutes: number }> = [];
    for (let index = 0; index < days.length; index += 7) {
      const chunk = days.slice(index, index + 7);
      weeks.push({
        day: chunk[0]!.day,
        label: shortDate.format(chunk[0]!.day),
        minutes: chunk.reduce((sum, entry) => sum + entry.minutes, 0),
      });
    }
    return weeks;
  }

  const month = new Intl.DateTimeFormat(undefined, { month: "short" });
  const buckets = new Map<string, { day: Timestamp; label: string; minutes: number }>();
  for (const entry of days) {
    const date = new Date(entry.day);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = buckets.get(key) ?? {
      day: entry.day,
      label: month.format(entry.day),
      minutes: 0,
    };
    bucket.minutes += entry.minutes;
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

export function InsightsModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [range, setRange] = React.useState<Range>("week");
  const [showAllAreas, setShowAllAreas] = React.useState(false);
  const [showAllInsights, setShowAllInsights] = React.useState(false);

  const now = useFocusNow(60_000);
  const weekStart = state.settings.weekStart;
  const { from, to, span } = windowFor(range, now, weekStart);
  const { from: prevFrom, to: prevTo } = previousWindow(range, from);
  const days = Math.max(1, Math.round(span / DAY));
  const providerLabel = aiProvider(state.settings.aiProvider).label;

  const overview = os.analyticsOverviewRange(from, to, now);
  const prevOverview = os.analyticsOverviewRange(prevFrom, prevTo, prevTo);
  const goals = os.analyticsGoals(now);
  const prevGoals = os.analyticsGoals(prevTo);
  const habitRows = os.analyticsHabits(now, days);
  const prevHabitRows = os.analyticsHabits(prevTo, days);
  const meetings = os.analyticsMeetings(from, to, now);
  const prevMeetings = os.analyticsMeetings(prevFrom, prevTo, prevTo);
  const insights = overview.insights;

  const trend = os.dailyProductivity(from, Math.min(to, startOfDay(now) + DAY));
  const areas = os.areaSummaries(from, to);
  const focusAreas = os.focusByArea(from, to);
  const distributionMinutes = focusAreas.reduce((sum, area) => sum + area.minutes, 0);
  const focusSeries = buildFocusSeries(overview.focus.byDay, from, to, now);

  const productivity = overview.tasks.completionRate;
  const prevProductivity = prevOverview.tasks.completionRate;
  const goalProgress = average(goals.map((goal) => goal.progress));
  const prevGoalProgress = average(prevGoals.map((goal) => goal.progress));
  const focusMinutes = overview.focus.totalFocusMin;
  const prevFocusMinutes = prevOverview.focus.totalFocusMin;
  const meetingCount = meetings.count;
  const prevMeetingCount = prevMeetings.count;
  const habitScore = average(habitRows.map((row) => row.completionRate));
  const prevHabitScore = average(prevHabitRows.map((row) => row.completionRate));
  const habitTone =
    habitScore >= 70
      ? "bg-success-soft text-success"
      : habitScore >= 40
        ? "bg-warning-soft text-warning"
        : "bg-danger-soft text-danger";

  const tiles = [
    {
      id: "productivity",
      label: "Productivity",
      value: `${productivity}%`,
      hint: `${overview.tasks.completed} completed of ${overview.tasks.created} created`,
      deltaPct: delta(productivity, prevProductivity),
      icon: CheckCircle2,
      tone: "bg-success-soft text-success",
    },
    {
      id: "goals",
      label: "Goals Progress",
      value: `${goalProgress}%`,
      hint: `${goals.length} active goal${goals.length === 1 ? "" : "s"}`,
      deltaPct: delta(goalProgress, prevGoalProgress),
      icon: Target,
      tone: "bg-accent-soft text-accent-ink",
    },
    {
      id: "focus",
      label: "Focus Time",
      value: formatHours(focusMinutes),
      hint: `${overview.focus.sessionCount} session${overview.focus.sessionCount === 1 ? "" : "s"}`,
      deltaPct: delta(focusMinutes, prevFocusMinutes),
      icon: Zap,
      tone: "bg-info-soft text-info",
    },
    {
      id: "meetings",
      label: "Meetings",
      value: String(meetingCount),
      hint: `${formatHours(meetings.minutes)} scheduled`,
      deltaPct: delta(meetingCount, prevMeetingCount),
      icon: CalendarDays,
      tone: "bg-warning-soft text-warning",
    },
    {
      id: "habits",
      label: "Habit Adherence",
      value: `${habitScore}%`,
      hint: `${habitRows.length} habit${habitRows.length === 1 ? "" : "s"} tracked`,
      deltaPct: delta(habitScore, prevHabitScore),
      icon: Activity,
      tone: habitTone,
    },
  ];

  const openTasks = Object.values(state.tasks).filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && task.status !== "archived",
  );
  const highPriority = openTasks.filter((task) => task.priority >= 4);
  const tomorrow = startOfDay(now) + DAY;
  const focusNeeded = Math.max(0, 2 - overview.focus.sessionCount);

  const scheduleFocusTomorrow = () => {
    const count = Math.max(1, focusNeeded);
    let added = 0;
    for (let index = 0; index < count; index += 1) {
      const slot = os
        .findPlanningWindows(tomorrow, tomorrow + DAY, 30)
        .find((entry) => entry.startsAt > now);
      if (!slot) break;
      os.addTimeBlock({
        title: "Focus block",
        startsAt: slot.startsAt,
        endsAt: slot.startsAt + Math.min(50, slot.durationMin) * 60_000,
        kind: "focus",
        source: "manual",
      });
      added += 1;
    }
    if (added === 0) {
      toast("No free focus time tomorrow", { tone: "danger" });
      return;
    }
    toast(`Added ${added} focus block${added === 1 ? "" : "s"} tomorrow`, {
      tone: "success",
    });
  };

  const actions: {
    id: string;
    label: string;
    icon: LucideIcon;
    href?: string;
    onClick?: () => void;
  }[] = [
    {
      id: "close-tasks",
      label:
        highPriority.length > 0
          ? `Close ${highPriority.length} high-priority task${highPriority.length === 1 ? "" : "s"}`
          : "All high-priority work is clear",
      icon: CheckCircle2,
      href: "/tasks",
    },
    focusNeeded > 0
      ? {
          id: "focus-blocks",
          label: `Schedule ${focusNeeded} focus block${focusNeeded === 1 ? "" : "s"} tomorrow`,
          icon: Zap,
          onClick: scheduleFocusTomorrow,
        }
      : {
          id: "focus-review",
          label: "Review your focus history",
          icon: Zap,
          href: "/focus",
        },
    {
      id: "habit-routine",
      label: `Keep up the health routine (${habitScore}%)`,
      icon: Activity,
      href: "/habits",
    },
    overview.tasks.overdueNow > 0
      ? {
          id: "overdue",
          label: `Clear ${overview.tasks.overdueNow} overdue task${overview.tasks.overdueNow === 1 ? "" : "s"}`,
          icon: CalendarDays,
          href: "/tasks",
        }
      : {
          id: "plan-goals",
          label: "Plan next period's top 3 goals",
          icon: Target,
          href: "/goals",
        },
    {
      id: "plan-week",
      label: "Open the planner to shape next week",
      icon: CalendarDays,
      href: "/planner",
    },
  ];

  const loadDefaults = () => {
    const ids = seedSampleInsights(os, now);
    toast(
      ids.length > 0
        ? `Added ${ids.length} sample items - edit or delete them any time`
        : "Sample data is already loaded",
    );
  };

  const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const fullDayFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const rangeLabel =
    from + DAY === to
      ? fullDayFormatter.format(new Date(from))
      : `${dayFormatter.format(new Date(from))} - ${fullDayFormatter.format(new Date(to - 1))}`;

  const exportReport = () => {
    const lines = [
      `# Insights — ${rangeLabel}`,
      "",
      "## Metrics",
      `- Productivity: ${productivity}%`,
      `- Goals progress: ${goalProgress}%`,
      `- Focus time: ${formatHours(focusMinutes)} across ${overview.focus.sessionCount} sessions`,
      `- Meetings: ${meetingCount} (${formatHours(meetings.minutes)})`,
      `- Habit adherence: ${habitScore}%`,
      "",
      "## Life areas",
      ...(areas.length > 0
        ? areas.map((area) => `- ${area.label}: ${area.percent}% (${area.done}/${area.total})`)
        : ["- No activity in this window"]),
      "",
      "## Goals",
      ...(goals.length > 0
        ? goals.map((goal) => `- ${goal.title}: ${goal.progress}%`)
        : ["- No active goals"]),
      "",
      "## Habits",
      ...(habitRows.length > 0
        ? habitRows.map((row) => `- ${row.title}: ${row.completionRate}%`)
        : ["- No habits tracked"]),
      "",
      "## AI insights",
      ...(insights.length > 0
        ? insights.map((insight) => `- **${insight.headline}** — ${insight.detail}`)
        : ["- Not enough history yet"]),
    ];
    downloadText(`insights-${range}-${new Date(from).toISOString().slice(0, 10)}.md`, lines.join("\n"));
    toast("Insights report downloaded", { tone: "success" });
  };
  return (
    <div className="space-y-4">
      <PageHeader
        testId="insights-header"
        icon={BarChart3}
        title="Insights"
        subtitle="Your personal productivity, progress and life insights in one place."
        actions={
          <>
            {RANGES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                data-testid={`insights-range-${entry.value}`}
                aria-pressed={range === entry.value}
                onClick={() => setRange(entry.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                  range === entry.value
                    ? "bg-accent text-white"
                    : "border border-line bg-surface text-ink-2 hover:bg-surface-2",
                )}
              >
                {entry.label}
              </button>
            ))}
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Insights",
                  items: [
                    { label: "Load default data", onSelect: loadDefaults },
                    { label: "Export report", onSelect: exportReport },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Insights options">
                  <span aria-hidden="true">&#8942;</span>
                </Button>
              }
            />
          </>
        }
      />

      <p className="text-[11px] text-ink-3" data-testid="insights-range-label">
        {rangeLabel}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="insights-tiles">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const up = (tile.deltaPct ?? 0) >= 0;
          return (
            <div
              key={tile.id}
              data-testid={`insights-tile-${tile.id}`}
              className="rounded-2xl border border-line bg-surface p-3.5 shadow-card"
            >
              <div className="flex items-center gap-2.5">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tile.tone}`} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-bold tabular-nums leading-tight text-ink">
                    {tile.value}
                  </span>
                  <span className="block truncate text-[11px] text-ink-2">{tile.label}</span>
                  <span className="block truncate text-[10px] text-ink-3">{tile.hint}</span>
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium">
                {tile.deltaPct == null ? (
                  <span className="text-ink-3">— vs last period</span>
                ) : (
                  <span className={up ? "text-success" : "text-danger"}>
                    {up ? "↑" : "↓"} {Math.abs(tile.deltaPct)}%{" "}
                    <span className="text-ink-3">vs last period</span>
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section
              aria-label="Productivity Trend"
              data-testid="insights-productivity"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-2 flex items-center gap-1.5">
                <BarChart3 className="size-4 text-accent-ink" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Productivity Trend</h2>
              </header>
              <ProductivityTrend days={trend} />
            </section>

            <section
              aria-label="Time Distribution"
              data-testid="insights-distribution"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-2 flex items-center gap-1.5">
                <Activity className="size-4 text-accent-ink" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">
                  Time Distribution ({formatHours(distributionMinutes)})
                </h2>
              </header>
              <DistributionDonut
                slices={focusAreas}
                totalLabel="Total Time"
                centerValue={formatHours(distributionMinutes)}
              />
            </section>
          </div>

          <section
            aria-label="Life Areas Overview"
            data-testid="insights-areas"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Layers className="size-4 text-accent-ink" aria-hidden="true" />
                Life Areas Overview
              </h2>
              {areas.length > 5 ? (
                <button
                  type="button"
                  data-testid="insights-areas-toggle"
                  onClick={() => setShowAllAreas((value) => !value)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
                >
                  {showAllAreas ? "Show less" : `Show all ${areas.length}`}
                  {showAllAreas ? (
                    <ChevronUp className="size-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-3" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </header>
            {areas.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-ink-3">
                No activity in this window yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {(showAllAreas ? areas : areas.slice(0, 5)).map((area) => (
                  <div
                    key={area.area}
                    data-testid="insights-area-card"
                    className="rounded-xl border border-line p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-ink">{area.label}</span>
                      {area.deltaPct != null ? (
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-medium",
                            area.deltaPct >= 0 ? "text-success" : "text-danger",
                          )}
                        >
                          {area.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(area.deltaPct)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums text-ink">{area.percent}%</p>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${area.percent}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-label="Habits Summary"
              data-testid="insights-habits"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <CheckCircle2 className="size-4 text-accent-ink" aria-hidden="true" />
                  Habits Summary
                </h2>
                <a href="/habits" className="text-[11px] font-medium text-accent-ink hover:underline">
                  View All
                </a>
              </header>
              <ScoreDonut
                percent={habitScore}
                caption="Habit Score"
                legend={[
                  { label: "Habits Completed", value: String(habitRows.filter((row) => row.completionRate >= 80).length), tone: "bg-success" },
                  { label: "Partially Completed", value: String(habitRows.filter((row) => row.completionRate > 0 && row.completionRate < 80).length), tone: "bg-warning" },
                  { label: "Missed", value: String(habitRows.filter((row) => row.completionRate === 0).length), tone: "bg-danger" },
                ]}
              />
            </section>

            <section
              aria-label="Goals Progress"
              data-testid="insights-goals"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Target className="size-4 text-accent-ink" aria-hidden="true" />
                  Goals Progress
                </h2>
                <a href="/goals" className="text-[11px] font-medium text-accent-ink hover:underline">
                  View All
                </a>
              </header>
              {goals.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-ink-3">No goals yet.</p>
              ) : (
                <div className="flex gap-3">
                  <div className="shrink-0">
                    <p className="text-2xl font-bold tabular-nums text-ink">{goalProgress}%</p>
                    <p className="text-[10px] text-ink-3">Overall Progress</p>
                    <span className="mt-2 block h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full bg-success"
                        style={{ width: `${goalProgress}%` }}
                      />
                    </span>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-2">
                    {goals.slice(0, 4).map((goal) => (
                      <li key={goal.id}>
                        <p className="truncate text-[11px] text-ink-2">{goal.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <span
                              className="block h-full rounded-full bg-chart-6"
                              style={{ width: `${goal.progress}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-ink-3">
                            {goal.progress}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section
              aria-label="Focus Sessions"
              data-testid="insights-focus-sessions"
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Zap className="size-4 text-accent-ink" aria-hidden="true" />
                  Focus Sessions
                </h2>
                <a href="/focus" className="text-[11px] font-medium text-accent-ink hover:underline">
                  View All
                </a>
              </header>
              <div className="flex gap-4">
                <div>
                  <p className="text-lg font-bold tabular-nums text-ink" data-testid="insights-focus-count">
                    {overview.focus.sessionCount}
                  </p>
                  <p className="text-[10px] text-ink-3">Sessions</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-ink">{formatHours(focusMinutes)}</p>
                  <p className="text-[10px] text-ink-3">Total Focus</p>
                </div>
              </div>
              <div className="mt-3">
                <MiniBars
                  values={focusSeries.map((day) => day.minutes)}
                  labels={focusSeries.map((day) => day.label.slice(0, 3))}
                />
              </div>
            </section>
          </div>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Insights tools">
          <section
            aria-label="AI Insights"
            data-testid="insights-ai"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
                AI Insights
              </h2>
              <span
                className="max-w-24 truncate rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3"
                title={`Active AI model: ${providerLabel}`}
              >
                {providerLabel}
              </span>
            </header>

            {insights.length === 0 ? (
              <p className="rounded-xl bg-surface-2/70 p-3 text-[12px] leading-snug text-ink-3">
                Not enough history yet — complete a few tasks and this panel fills with patterns your
                own data supports.
              </p>
            ) : (
              <ul className="space-y-2">
                {(showAllInsights ? insights : insights.slice(0, 4)).map((insight) => (
                  <li
                    key={insight.id}
                    data-testid="insights-ai-row"
                    className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-2.5"
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg",
                        insight.tone === "positive"
                          ? "bg-success-soft text-success"
                          : insight.tone === "warning"
                            ? "bg-warning-soft text-warning"
                            : "bg-accent-soft text-accent-ink",
                      )}
                      aria-hidden="true"
                    >
                      {insight.tone === "positive" ? (
                        <TrendingUp className="size-3.5" />
                      ) : insight.tone === "warning" ? (
                        <Lightbulb className="size-3.5" />
                      ) : (
                        <Target className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold text-ink">{insight.headline}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">
                        {insight.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {insights.length > 4 ? (
              <button
                type="button"
                data-testid="insights-ai-toggle"
                onClick={() => setShowAllInsights((value) => !value)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
              >
                {showAllInsights ? "Show less" : `Show all ${insights.length} insights`}
                {showAllInsights ? (
                  <ChevronUp className="size-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </section>

          <section
            aria-label="Recommended Actions"
            data-testid="insights-actions"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <CheckCircle2 className="size-4 text-accent-ink" aria-hidden="true" />
                Recommended Actions
              </h2>
              <button
                type="button"
                onClick={loadDefaults}
                className="text-[11px] font-medium text-accent-ink hover:underline"
              >
                Load default data
              </button>
            </header>
            <ul className="space-y-0.5">
              {actions.map((action) => {
                const Icon = action.icon;
                const row = (
                  <>
                    <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{action.label}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                  </>
                );
                return (
                  <li key={action.id}>
                    {action.onClick ? (
                      <button
                        type="button"
                        data-testid="insights-action-row"
                        onClick={action.onClick}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                      >
                        {row}
                      </button>
                    ) : (
                      <a
                        href={action.href ?? "/tasks"}
                        data-testid="insights-action-row"
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
                      >
                        {row}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
