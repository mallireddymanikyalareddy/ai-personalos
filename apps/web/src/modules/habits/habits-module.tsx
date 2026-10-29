"use client";

import * as React from "react";

import { CalendarClock, Filter, Plus, Sparkles, Trophy } from "lucide-react";

import type { Habit, HabitFilter, HabitSort, HabitTab } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useAIGateway } from "@/lib/use-ai-gateway";
import { useAppState, useOS } from "@/store/use-os";

import { HabitRow } from "./habit-row";
import { HabitStats } from "./habit-stats";
import { HabitAssistant } from "./habits-assistant";
import { HabitCalendar } from "./habits-calendar";
import { SuccessLine } from "./habits-charts";
import { HabitInsights, MotivationCard, MOTIVATION_QUOTES } from "./habits-insights";
import { HABIT_SUGGESTIONS, seedSampleHabits } from "./sample-habits";
import { HabitDetailSheet } from "./habit-detail-sheet";
import { HabitDialog, type HabitDialogValue } from "./habit-dialog";

const TABS: { value: HabitTab; label: string }[] = [
  { value: "all", label: "All Habits" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const SORTS: { value: HabitSort; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "streak", label: "Streak" },
  { value: "progress", label: "Progress" },
  { value: "name", label: "Name" },
];

const FILTERS: { value: HabitFilter; label: string }[] = [
  { value: "all", label: "All habits" },
  { value: "due", label: "Due today" },
  { value: "undone", label: "Not done today" },
  { value: "done", label: "Done today" },
  { value: "archived", label: "Archived" },
];

export function HabitsModule() {
  const os = useOS();
  useAppState();
  const { toast } = useToast();
  const ai = useAIGateway();

  const [tab, setTab] = React.useState<HabitTab>("all");
  const [sort, setSort] = React.useState<HabitSort>("priority");
  const [filter, setFilter] = React.useState<HabitFilter>("all");
  const [monthAnchor, setMonthAnchor] = React.useState<number | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null);
  const [question, setQuestion] = React.useState("");
  const answer = ai.answer;
  const setAnswer = ai.setAnswer;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Habit | null>(null);

  const now = Date.now();
  const dashboard = os.habitsDashboard({ tab, sort, filter, monthAnchor: monthAnchor ?? undefined }, now);
  const totalHabits = Object.keys(os.getState().habits).length;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (habitId: string) => {
    const habit = os.getState().habits[habitId];
    if (!habit) return;
    setEditing(habit);
    setDialogOpen(true);
  };

  const toggleDay = (habitId: string, dayStart: number) => {
    if (os.habitCheckedOn(habitId, dayStart)) {
      os.undoHabit(habitId, dayStart);
    } else {
      os.completeHabit(habitId, dayStart);
    }
  };

  const handleSave = (input: HabitDialogValue) => {
    if (editing) {
      os.updateHabit(editing.id, input);
      toast("Habit updated");
    } else {
      os.addHabit(input);
      toast("Habit created");
    }
    setEditing(null);
  };

  const ask = (value: string) => {
    setQuestion(value);
    const text = value.trim().toLowerCase();
    if (text.length === 0) {
      setAnswer(null);
      return;
    }
    if (ai.gatewayEnabled) {
      const meta = text.includes("suggest")
        ? { action: "habit_suggest", label: "Suggest new habits" }
        : text.includes("stack") || text.includes("plan") || text.includes("routine")
          ? { action: "habit_stack_suggest", label: "Suggest habit stacking" }
          : text.includes("recover") || text.includes("streak") || text.includes("motivat")
            ? { action: "habit_recovery_plan", label: "Recover a habit streak" }
            : text.includes("progress") || text.includes("pattern") || text.includes("analy")
              ? { action: "habit_pattern_insight", label: "Habit pattern insight" }
              : { action: "quick_question", label: "Quick AI question" };
      void ai.request({
        action: meta.action,
        prompt: value,
        context: os.aiContextSummary(),
        label: meta.label,
      });
      return;
    }
    if (text.includes("suggest")) {
      setAnswer("Here are a few evidence-based habits you could add next.");
      return;
    }
    if (text.includes("progress") || text.includes("analy")) {
      setAnswer(
        `You are at ${dashboard.successRate}% overall success across ${dashboard.stats.totalActive} habits, with a best streak of ${dashboard.stats.longestStreak} days.`,
      );
      return;
    }
    if (text.includes("today")) {
      setAnswer(
        dashboard.stats.dueToday > 0
          ? `You have completed ${dashboard.stats.doneToday} of ${dashboard.stats.dueToday} habits due today.`
          : "Nothing is scheduled for today.",
      );
      return;
    }
    setAnswer(
      `You are tracking ${dashboard.stats.totalActive} habits with ${dashboard.stats.totalCheckIns} check-ins recorded. Your current streak is ${dashboard.stats.currentStreak} days.`,
    );
  };

  const motivate = () => {
    const quote =
      dashboard.stats.currentStreak > 0
        ? MOTIVATION_QUOTES[dashboard.stats.currentStreak % MOTIVATION_QUOTES.length]!
        : MOTIVATION_QUOTES[0]!;
    setQuestion("Give me motivation");
    setAnswer(`${quote} You are on a ${dashboard.stats.currentStreak} day streak — keep it going.`);
  };

  const addSuggestion = (title: string) => {
    const suggestion = HABIT_SUGGESTIONS.find((entry) => entry.title === title);
    if (!suggestion) return;
    os.addHabit({
      title: suggestion.title,
      description: suggestion.description,
      icon: suggestion.icon,
      color: suggestion.color,
      cadence: suggestion.cadence,
      priority: suggestion.priority,
    });
    toast(`${suggestion.title} added`);
    setAnswer(`${suggestion.title} was added to your habits.`);
  };

  const suggestionTitles = HABIT_SUGGESTIONS.map((entry) => entry.title);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <PageHeader
          icon={Trophy}
          title="Habits"
          subtitle="Build better habits, track your progress, and create a positive change in your life."
          actions={
            <>
              <Button variant="primary" onClick={openNew} data-testid="habits-add">
                <Plus className="size-4" aria-hidden="true" />
                Add Habit
              </Button>
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Habits",
                    items: [
                      {
                        label: "Load sample habits",
                        onSelect: () => {
                          const ids = seedSampleHabits(os);
                          toast(`Added ${ids.length} sample habits — edit or delete them any time`);
                        },
                      },
                      { label: "Analyze progress", onSelect: () => window.location.assign("/insights") },
                      { label: "Open calendar", onSelect: () => window.location.assign("/calendar") },
                    ],
                  },
                ]}
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Habit page options">
                    <span aria-hidden="true">&#8942;</span>
                  </Button>
                }
              />
            </>
          }
        />

        <HabitStats stats={dashboard.stats} />

        <div className="flex flex-wrap items-center justify-between gap-2" data-testid="habits-filters">
          <Segmented options={TABS} value={tab} onChange={setTab} label="Habit cadence filter" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-3">Sort by:</span>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Sort",
                  items: SORTS.map((option) => ({
                    label: option.label,
                    selected: sort === option.value,
                    onSelect: () => setSort(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label="Sort habits"
                >
                  {SORTS.find((option) => option.value === sort)?.label}
                </button>
              }
            />
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Filter",
                  items: FILTERS.map((option) => ({
                    label: option.label,
                    selected: filter === option.value,
                    onSelect: () => setFilter(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label="Filter habits"
                >
                  <Filter className="size-4" aria-hidden="true" />
                </button>
              }
            />
          </div>
        </div>

        {totalHabits === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No habits yet"
            description="Build consistency with small, repeatable actions."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" onClick={openNew}>
                  Create a habit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const ids = seedSampleHabits(os);
                    toast(`Added ${ids.length} sample habits — edit or delete them any time`);
                  }}
                >
                  Load sample habits
                </Button>
              </div>
            }
          />
        ) : dashboard.cards.length === 0 ? (
          <p
            className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-3"
            data-testid="habits-empty-filter"
          >
            No habits match these filters.
          </p>
        ) : (
          <ul className="space-y-2.5" data-testid="habits-list">
            {dashboard.cards.map((row) => (
              <HabitRow
                key={row.id}
                row={row}
                archived={os.getState().habits[row.id]?.archived ?? false}
                onToggleDay={toggleDay}
                onOpen={(id) => setDetailId(id)}
                onEdit={openEdit}
                onArchive={(id) => {
                  os.updateHabit(id, { archived: true });
                  toast("Habit archived", {
                    action: {
                      label: "Undo",
                      onClick: () => os.updateHabit(id, { archived: false }),
                    },
                  });
                }}
                onRestore={(id) => {
                  os.updateHabit(id, { archived: false });
                  toast("Habit restored");
                }}
                onDelete={(id) => {
                  os.deleteHabit(id);
                  toast("Habit deleted");
                }}
              />
            ))}
          </ul>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <HabitInsights rate={dashboard.successRate} insights={dashboard.insights} />

          <section
            aria-label="This Month Overview"
            data-testid="habits-month-overview"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <CalendarClock className="size-4 text-accent-ink" aria-hidden="true" />
                This Month Overview
              </h2>
              <a href="/insights" className="text-xs font-medium text-accent-ink hover:underline">
                View Report
              </a>
            </header>
            <p className="mb-2 text-[11px] font-medium text-ink-3" data-testid="habits-month-label">
              {dashboard.monthLabel} · {dashboard.month.length} days tracked
            </p>
            <SuccessLine points={dashboard.month} />
          </section>
        </div>
      </div>

      <aside className="space-y-4" aria-label="Habit tools">
        <HabitAssistant
          stats={dashboard.stats}
          question={question}
          answer={answer}
          onAsk={ask}
          onCreate={openNew}
          onMotivate={motivate}
          suggestionTitles={suggestionTitles}
          onAddSuggestion={addSuggestion}
          onOpenAssistant={() => window.location.assign("/ai")}
          creditsNote={ai.creditsNote}
        />
        <CreditConfirmDialog
          open={ai.pending != null}
          label={ai.pending?.label ?? "AI action"}
          estimate={ai.pending?.estimate ?? null}
          busy={ai.busy}
          onClose={ai.dismiss}
          onConfirm={() => void ai.confirm()}
        />
        <HabitCalendar
          days={dashboard.calendar}
          label={dashboard.calendarLabel}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onShiftMonth={(delta) => {
            const anchor = monthAnchor ?? now;
            const next = new Date(anchor);
            next.setDate(1);
            next.setMonth(next.getMonth() + delta);
            setMonthAnchor(next.getTime());
          }}
        />
        <MotivationCard currentStreak={dashboard.stats.currentStreak} quote={MOTIVATION_QUOTES[0]!} />
      </aside>

      <HabitDialog
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
                cadence: editing.cadence,
                daysOfWeek: editing.daysOfWeek,
                daysOfMonth: editing.daysOfMonth,
                targetPerPeriod: editing.targetPerPeriod,
                priority: editing.priority,
                color: editing.color,
                icon: editing.icon,
              }
            : undefined
        }
      />
      <HabitDetailSheet
        habitId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          const id = detailId;
          setDetailId(null);
          if (id) openEdit(id);
        }}
      />
    </div>
  );
}