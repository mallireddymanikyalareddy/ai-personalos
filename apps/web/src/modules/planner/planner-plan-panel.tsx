"use client";

import * as React from "react";

import { ArrowUpRight, CalendarClock, MoreHorizontal, Plus, Sparkles } from "lucide-react";

import type { Timestamp } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type PlanTab = "tasks" | "goals" | "habits" | "notes";
export type PlanFilter = "all" | "work" | "personal" | "high" | "unscheduled";
export type PlanSort = "time" | "priority" | "name";

export interface PlanTaskRow {
  id: string;
  title: string;
  done: boolean;
  tags: string[];
  dueAt: Timestamp | null;
  scheduledAt?: Timestamp | null;
  priority: number;
  projectName?: string | null;
  projectColor?: string | null;
}

export interface PlanGoalRow {
  id: string;
  title: string;
  progress: number;
}

export interface PlanHabitRow {
  id: string;
  title: string;
  done: boolean;
  dueToday: boolean;
  streak: number;
}

export interface PlanNoteRow {
  id: string;
  title: string;
  updatedAt: Timestamp;
}

const FILTERS: { value: PlanFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "high", label: "High Priority" },
  { value: "unscheduled", label: "Unscheduled" },
];

const SORTS: { value: PlanSort; label: string }[] = [
  { value: "time", label: "Time" },
  { value: "priority", label: "Priority" },
  { value: "name", label: "Name" },
];

function formatClock(at: Timestamp | null): string {
  if (at == null) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

export function PlanPanel({
  dayLabel = "Today",
  tasks,
  goals,
  habits,
  notes,
  tab,
  filter,
  sort,
  onTabChange,
  onFilterChange,
  onSortChange,
  onToggleTask,
  onToggleHabit,
  onAddTask,
  onGenerate,
  onOpenTask,
  onScheduleTask,
}: {
  dayLabel?: string;
  tasks: PlanTaskRow[];
  goals: PlanGoalRow[];
  habits: PlanHabitRow[];
  notes: PlanNoteRow[];
  tab: PlanTab;
  filter: PlanFilter;
  sort: PlanSort;
  onTabChange: (tab: PlanTab) => void;
  onFilterChange: (filter: PlanFilter) => void;
  onSortChange: (sort: PlanSort) => void;
  onToggleTask: (id: string) => void;
  onToggleHabit: (id: string) => void;
  onAddTask: (title: string) => void;
  onGenerate: () => void;
  onOpenTask: (id: string) => void;
  onScheduleTask: (id: string) => void;
}) {
  const [draft, setDraft] = React.useState("");

  const visible = React.useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (filter === "work") return task.tags.some((tag) => tag.toLowerCase() === "work");
      if (filter === "personal") return task.tags.some((tag) => tag.toLowerCase() === "personal");
      if (filter === "high") return task.priority >= 3;
      if (filter === "unscheduled") return task.dueAt == null && task.scheduledAt == null;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (sort === "priority") return b.priority - a.priority;
      if (sort === "name") return a.title.localeCompare(b.title);
      return (a.scheduledAt ?? a.dueAt ?? Infinity) - (b.scheduledAt ?? b.dueAt ?? Infinity);
    });
  }, [tasks, filter, sort]);

  const tabs: { value: PlanTab; label: string; count: number }[] = [
    { value: "tasks", label: "Tasks", count: tasks.length },
    { value: "goals", label: "Goals", count: goals.length },
    { value: "habits", label: "Habits", count: habits.length },
    { value: "notes", label: "Notes", count: notes.length },
  ];

  return (
    <section
      aria-label="Plan for Today"
      data-testid="planner-plan-panel"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">
          Plan for {dayLabel}
          {tasks.length > 0 ? (
            <span className="ml-2 text-[11px] font-normal text-ink-3">
              {tasks.filter((task) => task.done).length}/{tasks.length} done
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="planner-generate"
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-ink transition-colors hover:bg-accent hover:text-white"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Generate with AI
          </button>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: "Plan",
                items: [
                  { label: "Generate with AI", onSelect: onGenerate },
                  { label: "Sort by time", onSelect: () => onSortChange("time") },
                  { label: "Sort by priority", onSelect: () => onSortChange("priority") },
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                aria-label="Plan options"
                className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Plan categories">
        {tabs.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            data-testid={`planner-tab-${entry.value}`}
            aria-selected={tab === entry.value}
            onClick={() => onTabChange(entry.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors",
              tab === entry.value ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {entry.label} ({entry.count})
          </button>
        ))}
      </div>

      {tab === "tasks" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  data-testid={`planner-filter-${entry.value}`}
                  aria-pressed={filter === entry.value}
                  onClick={() => onFilterChange(entry.value)}
                  className={cn(
                    "rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    filter === entry.value
                      ? "border-accent bg-accent text-white"
                      : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Sort",
                  items: SORTS.map((entry) => ({
                    label: entry.label,
                    selected: sort === entry.value,
                    onSelect: () => onSortChange(entry.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
                  aria-label="Sort plan"
                >
                  Sort
                </button>
              }
            />
          </div>

          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" data-testid="planner-task-list">
            {visible.length === 0 ? (
              <li className="px-2 py-6 text-center text-[12px] text-ink-3">
                No tasks match this filter.
              </li>
            ) : (
              visible.map((task) => (
                <li
                  key={task.id}
                  data-testid="planner-task-row"
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2/70"
                >
                  <Checkbox
                    checked={task.done}
                    onChange={() => onToggleTask(task.id)}
                    label={`Complete ${task.title}`}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate text-left text-[13px]",
                      task.done ? "text-ink-3 line-through" : "text-ink hover:underline",
                    )}
                  >
                    {task.title}
                  </button>
                  {task.projectName ? (
                    <span
                      className="hidden shrink-0 items-center gap-1 text-[10px] text-ink-3 sm:inline-flex"
                      title={task.projectName}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: task.projectColor ?? "var(--ink-3)" }}
                        aria-hidden="true"
                      />
                      <span className="max-w-16 truncate">{task.projectName}</span>
                    </span>
                  ) : task.tags.slice(0, 1).map((tag) => (
                    <span key={tag} className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
                      {tag}
                    </span>
                  ))}
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
                    {formatClock(task.scheduledAt ?? task.dueAt ?? null)}
                  </span>
                  <button
                    type="button"
                    data-testid="planner-schedule-task"
                    onClick={() => onScheduleTask(task.id)}
                    aria-label={`Schedule ${task.title}`}
                    title="Schedule this task"
                    className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-surface-3 hover:text-accent-ink focus:opacity-100 group-hover:opacity-100"
                  >
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))
            )}
          </ul>

          <form
            className="border-t border-line p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim().length === 0) return;
              onAddTask(draft.trim());
              setDraft("");
            }}
          >
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-line px-2">
              <Plus className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Add a task…"
                aria-label="Add a task to the plan"
                className="h-8 border-0 bg-transparent px-0 text-[13px] focus:ring-0"
              />
              {draft.trim().length > 0 ? (
                <button
                  type="submit"
                  aria-label="Add task"
                  className="grid size-6 place-items-center rounded-md text-accent-ink hover:bg-accent-soft"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </form>
        </>
      ) : null}

      {tab === "goals" ? (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" data-testid="planner-goal-list">
          {goals.length === 0 ? (
            <li className="py-6 text-center text-[12px] text-ink-3">No active goals yet.</li>
          ) : (
            goals.map((goal) => (
              <li key={goal.id} className="rounded-lg border border-line p-2.5">
                <a
                  href="/goals"
                  className="block truncate text-[13px] font-medium text-ink hover:text-accent-ink hover:underline"
                >
                  {goal.title}
                </a>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${goal.progress}%` }} />
                  </span>
                  <span className="text-[11px] tabular-nums text-ink-3">{goal.progress}%</span>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === "habits" ? (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" data-testid="planner-habit-list">
          {habits.length === 0 ? (
            <li className="py-6 text-center text-[12px] text-ink-3">No habits tracked yet.</li>
          ) : (
            habits.map((habit) => (
              <li key={habit.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                <Checkbox
                  checked={habit.done}
                  onChange={() => onToggleHabit(habit.id)}
                  label={`Toggle ${habit.title}`}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{habit.title}</span>
                {habit.streak > 0 ? <Badge tone="warning">{habit.streak}d</Badge> : null}
                {habit.done ? <Badge tone="success">Done</Badge> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === "notes" ? (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" data-testid="planner-note-list">
          {notes.length === 0 ? (
            <li className="py-6 text-center text-[12px] text-ink-3">No notes yet.</li>
          ) : (
            notes.map((note) => (
              <li key={note.id}>
                <a
                  href="/notes"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 truncate">{note.title || "Untitled note"}</span>
                  <ArrowUpRight className="size-3 text-ink-3" aria-hidden="true" />
                </a>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
