"use client";

import * as React from "react";

import { CheckCircle2, ListChecks, MoreHorizontal, Plus, Target, TriangleAlert } from "lucide-react";

import type { Goal, GoalCategory, GoalTab, GoalTimeframe } from "@personalos/core";
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABELS, quarterLabel } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";

import { GoalCard } from "./goal-card";
import { GoalDetailSheet } from "./goal-detail-sheet";
import { GoalDialog, type GoalDialogInput } from "./goal-dialog";
import { GoalAssistant, GoalQuickAdd } from "./goals-assistant";
import { CategoryBars, ProgressLine } from "./goals-charts";
import { GoalInsightsPanel, UpcomingMilestones } from "./goals-rail";
import { GoalsStats } from "./goals-stats";
import { seedSampleGoals } from "./sample-goals";

const TAB_OPTIONS: { value: GoalTab; label: string }[] = [
  { value: "all", label: "All Goals" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "overdue", label: "Overdue" },
  { value: "archived", label: "Archived" },
];

const TIMEFRAME_OPTIONS: { value: GoalTimeframe; label: string }[] = [
  { value: "all", label: "All Timeframes" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

export function GoalsModule() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<GoalTab>("all");
  const [category, setCategory] = React.useState<GoalCategory | "all">("all");
  const [timeframe, setTimeframe] = React.useState<GoalTimeframe>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const now = Date.now();
  const dashboard = os.goalsDashboard({ tab, category, timeframe }, now);
  const milestones = os.upcomingGoalMilestones(5, now);
  const totalGoals = Object.keys(os.getState().goals).length;

  const timelinePoints = dashboard.timeline;
  const timelineRange =
    timelinePoints.length === 0
      ? "No timeline data"
      : timelinePoints[0]!.label === timelinePoints[timelinePoints.length - 1]!.label
        ? timelinePoints[0]!.label
        : `${timelinePoints[0]!.label} – ${timelinePoints[timelinePoints.length - 1]!.label}`;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setDialogOpen(true);
  };

  const handleSave = (input: GoalDialogInput) => {
    if (editing) {
      os.updateGoal(editing.id, input);
    } else {
      os.addGoal(input);
    }
    setEditing(null);
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-4">
        <PageHeader
          icon={Target}
          title="Goals"
          subtitle="Turn your dreams into a clear plan. Set goals, track progress, and achieve more."
          actions={
            <>
              <Button variant="primary" onClick={openNew}>
                <Plus className="size-4" />
                Add Goal
              </Button>
              <DropdownMenu
                align="end"
                sections={[
                  {
                    items: [
                      { label: "New goal", icon: <Plus className="size-3.5" />, onSelect: openNew },
                      {
                        label: "Reset filters",
                        icon: <ListChecks className="size-3.5" />,
                        onSelect: () => {
                          setTab("all");
                          setCategory("all");
                          setTimeframe("all");
                        },
                      },
                      {
                        label: "View insights",
                        icon: <Target className="size-3.5" />,
                        onSelect: () => {
                          window.location.assign("/insights");
                        },
                      },
                    ],
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    aria-label="Goals options"
                    className="rounded-lg border border-line p-2 text-ink-2 transition-colors hover:bg-surface-2"
                  >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </button>
                }
              />
            </>
          }
        />

        <GoalsStats stats={dashboard.stats} quarterLabel={quarterLabel(now)} />

        <div className="flex flex-wrap items-center justify-between gap-2" data-testid="goals-filters">
          <Segmented options={TAB_OPTIONS} value={tab} onChange={setTab} label="Goal tabs" />
          <div className="flex items-center gap-2">
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Category",
                  items: [
                    {
                      label: "All Categories",
                      selected: category === "all",
                      onSelect: () => setCategory("all"),
                    },
                    ...GOAL_CATEGORIES.map((value) => ({
                      label: GOAL_CATEGORY_LABELS[value],
                      selected: category === value,
                      onSelect: () => setCategory(value),
                    })),
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label={`Category filter: ${category === "all" ? "All Categories" : GOAL_CATEGORY_LABELS[category]}`}
                >
                  {category === "all" ? "All Categories" : GOAL_CATEGORY_LABELS[category]}
                </button>
              }
            />
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Timeframe",
                  items: TIMEFRAME_OPTIONS.map((option) => ({
                    label: option.label,
                    selected: timeframe === option.value,
                    onSelect: () => setTimeframe(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label="Timeframe filter"
                >
                  {TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.label}
                </button>
              }
            />
          </div>
        </div>

        {totalGoals === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Define an outcome and track progress from the work you already do."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" size="md" onClick={openNew}>
                  Create a goal
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    const ids = seedSampleGoals(os);
                    toast(`Added ${ids.length} sample goals — edit or delete them any time`);
                  }}
                >
                  Load sample goals
                </Button>
              </div>
            }
          />
        ) : dashboard.goals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-3" data-testid="goals-empty-filter">
            No goals match these filters.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="goals-grid">
            {dashboard.goals.map((card) => (
              <GoalCard
                key={card.id}
                card={card}
                onOpen={() => setDetailId(card.id)}
                onEdit={() => {
                  const goal = os.getState().goals[card.id];
                  if (goal) openEdit(goal);
                }}
                onToggleComplete={() => {
                  if (card.status === "completed") {
                    os.reopenGoal(card.id);
                    toast("Goal reopened");
                  } else {
                    os.completeGoal(card.id);
                    toast("Goal completed");
                  }
                }}
                onToggleHold={() => {
                  os.updateGoal(card.id, { status: card.status === "on_hold" ? "active" : "on_hold" });
                  toast(card.status === "on_hold" ? "Goal resumed" : "Goal on hold");
                }}
                onToggleArchive={() => {
                  if (card.status === "archived") {
                    os.updateGoal(card.id, { status: "active" });
                    toast("Goal restored");
                  } else {
                    os.updateGoal(card.id, { status: "archived" });
                    toast("Goal archived", {
                      action: {
                        label: "Undo",
                        onClick: () => os.updateGoal(card.id, { status: "active" }),
                      },
                    });
                  }
                }}
                onDelete={() => {
                  os.deleteGoal(card.id);
                  toast("Goal deleted");
                }}
              />
            ))}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <section
            aria-label="Goals by Category"
            data-testid="goals-by-category"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Goals by Category</h2>
              {category !== "all" ? (
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  className="text-xs font-medium text-accent-ink hover:underline"
                >
                  Clear filter
                </button>
              ) : null}
            </header>
            <CategoryBars rows={dashboard.categories} />
          </section>

          <section
            aria-label="Progress Timeline"
            data-testid="goals-timeline"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Progress Timeline</h2>
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Range",
                    items: TIMEFRAME_OPTIONS.map((option) => ({
                      label: option.label,
                      selected: timeframe === option.value,
                      onSelect: () => setTimeframe(option.value),
                    })),
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                    aria-label="Timeline range"
                  >
                    {TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.label}
                  </button>
                }
              />
            </header>
            <p className="mb-2 text-[11px] font-medium text-ink-3" data-testid="goals-timeline-range">
              {timelineRange}
            </p>
            <ProgressLine points={dashboard.timeline} />
            <div className="mt-3 grid grid-cols-4 gap-2">
              <TimelineStat icon={CheckCircle2} tone="success" value={dashboard.stats.completed} label="Completed" />
              <TimelineStat icon={ListChecks} tone="info" value={dashboard.stats.inProgress} label="In Progress" />
              <TimelineStat icon={TriangleAlert} tone="danger" value={dashboard.stats.overdue} label="Overdue" />
              <TimelineStat icon={Target} tone="accent" value={dashboard.stats.dueThisQuarter} label="Due This Quarter" />
            </div>
          </section>
        </div>
      </div>

      <aside className="space-y-4" aria-label="Goal tools">
        <GoalAssistant />
        <GoalQuickAdd />
        <UpcomingMilestones rows={milestones} />
        <GoalInsightsPanel
          health={dashboard.health}
          overallProgress={dashboard.overallProgress}
          insight={dashboard.insight}
        />
      </aside>

      <GoalDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initial={
          editing
            ? {
                title: editing.title,
                description: editing.description,
                horizon: editing.horizon,
                targetAt: editing.targetAt,
                metrics: editing.metrics,
                category: editing.category,
                coverUrl: editing.coverUrl,
                lifeAreaId: editing.lifeAreaId,
              }
            : undefined
        }
      />
      <GoalDetailSheet
        goalId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (detailId) {
            const goal = os.getState().goals[detailId];
            if (goal) openEdit(goal);
          }
        }}
      />
    </div>
  );
}

const TIMELINE_TONE = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent-ink",
} as const;

function TimelineStat({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TIMELINE_TONE;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line p-2">
      <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${TIMELINE_TONE[tone]}`} aria-hidden="true">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tabular-nums text-ink">{value}</span>
        <span className="block truncate text-[10px] text-ink-3">{label}</span>
      </span>
    </div>
  );
}