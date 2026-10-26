"use client";

import * as React from "react";


import {
  AlarmClock,
  CalendarDays,
  Check,
  Clock3,
  ListTodo,
  Plus,
  SquareKanban,
} from "lucide-react";

import { endOfDay } from "@personalos/core";
import type {
  TodayMeetingRow,
  TodayScheduleEntry,
  TodayTaskBucket,
  TodayTaskRow,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { PagerDots, usePagedRows } from "./today-pager";
import { formatClockTime } from "./use-today-now";

const TONE_DOT: Record<TodayScheduleEntry["tone"], string> = {
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-ink-3",
};

const TONE_CARD: Record<TodayScheduleEntry["tone"], string> = {
  accent: "border-l-accent bg-surface",
  success: "border-l-success bg-success-soft/40",
  danger: "border-l-danger bg-danger-soft/40",
  warning: "border-l-warning bg-warning-soft/40",
  info: "border-l-ink-3 bg-surface-2/50",
};

const KIND_ICON = {
  event: CalendarDays,
  time_block: SquareKanban,
  task: ListTodo,
} as const;

const BUCKET_OPTIONS: { value: TodayTaskBucket; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "This Week" },
];

const PRIORITY_DOT: Record<number, string> = {
  0: "bg-transparent",
  1: "bg-success",
  2: "bg-warning",
  3: "bg-danger",
  4: "bg-danger",
};

export function TodaySchedulePanel({ entries }: { entries: TodayScheduleEntry[] }) {
  const { rows, page, setPage, totalPages } = usePagedRows(entries);

  return (
    <section
      aria-label="Today's Schedule"
      data-testid="today-schedule"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarDays className="size-4 text-accent" aria-hidden="true" />
          Today&apos;s Schedule
          <span className="text-[11px] font-normal text-ink-3">({entries.length})</span>
        </h2>
        <a href="/calendar" className="text-xs font-medium text-accent-ink hover:underline">View Calendar</a>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
          Nothing scheduled today. Your day is wide open.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((entry) => {
            const Icon = KIND_ICON[entry.kind];
            return (
              <li key={entry.id} className="flex items-center gap-2" data-testid="today-schedule-row">
                <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
                  {formatClockTime(entry.startsAt)}
                </span>
                <span
                  aria-hidden="true"
                  className={cn("h-9 w-0.5 shrink-0 rounded-full", TONE_DOT[entry.tone])}
                />
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line border-l-2 px-2.5 py-2",
                    TONE_CARD[entry.tone],
                  )}
                >
                  <Icon className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{entry.title}</p>
                    <p className="truncate text-[11px] text-ink-3">{entry.subtitle}</p>
                  </div>
                  {entry.done ? (
                    <Badge tone="success">Done</Badge>
                  ) : (
                    <AlarmClock className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <PagerDots page={page} totalPages={totalPages} onPage={setPage} label="Schedule" />
    </section>
  );
}

export function TodayMeetingsPanel({ rows }: { rows: TodayMeetingRow[] }) {
  return (
    <section
      aria-label="Today's Meetings"
      data-testid="today-meetings"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarDays className="size-4 text-accent" aria-hidden="true" />
          Meetings
          <span className="text-[11px] font-normal text-ink-3">({rows.length})</span>
        </h2>
        <a href="/meetings" className="text-xs font-medium text-accent-ink hover:underline">
          View all
        </a>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-3">
          No meetings scheduled today.
        </p>
      ) : (
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} data-testid="today-meeting-row">
            <a
              href="/meetings"
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <span className="w-14 shrink-0 text-right text-[11px] font-medium tabular-nums text-ink-2">
                {row.timeLabel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{row.title}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {row.location || "No location"}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {row.done ? <Badge tone="success">Done</Badge> : null}
                {row.hasSummary ? <Badge tone="accent">Summary</Badge> : null}
                {row.hasTranscript ? <Badge tone="outline">Transcript</Badge> : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}

export function TodayTasksPanel({
  rows,
  bucket,
  counts,
  day,
  completedToday,
  totalToday,
  onBucket,
  onOpenTask,
}: {
  rows: TodayTaskRow[];
  bucket: TodayTaskBucket;
  counts: Record<TodayTaskBucket, number>;
  day: number;
  completedToday: number;
  totalToday: number;
  onBucket: (bucket: TodayTaskBucket) => void;
  onOpenTask: (id: string) => void;
}) {
  const os = useOS();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState("");

  const toggle = (row: TodayTaskRow) => {
    if (row.done) {
      os.reopenTask(row.id);
      toast("Task reopened");
    } else {
      os.completeTask(row.id);
      toast("Task completed");
    }
  };

  const add = () => {
    const title = draft.trim();
    if (title.length === 0) return;
    os.addTask({ title, dueAt: endOfDay(day) });
    setDraft("");
    toast("Task added");
  };

  return (
    <section
      aria-label="Top Tasks"
      data-testid="today-tasks"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <ListTodo className="size-4 text-accent" aria-hidden="true" />
          Top Tasks
          <span className="text-[11px] font-normal text-ink-3">
            ({completedToday} of {totalToday} completed)
          </span>
        </h2>
        <a href="/tasks" className="text-xs font-medium text-accent-ink hover:underline">View all</a>
      </header>

      <Segmented
        className="mb-3"
        options={BUCKET_OPTIONS.map((option) => ({
          ...option,
          label: `${option.label}${counts[option.value] > 0 ? `  ${counts[option.value]}` : ""}`,
        }))}
        value={bucket}
        onChange={onBucket}
        label="Task bucket"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
          {bucket === "today" && completedToday > 0 && totalToday > 0
            ? "Everything due today is complete."
            : `Nothing in ${BUCKET_OPTIONS.find((option) => option.value === bucket)?.label.toLowerCase()}.`}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2" data-testid="today-task-row">
              <Checkbox
                checked={row.done}
                onChange={() => toggle(row)}
                label={`Complete ${row.title}`}
              />
              <button
                type="button"
                onClick={() => onOpenTask(row.id)}
                className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:underline"
              >
                {row.title}
              </button>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn("size-2 rounded-full", PRIORITY_DOT[row.priority])}
                  aria-label={`${row.priorityLabel} priority`}
                  title={`${row.priorityLabel} priority`}
                />
                <span className="text-[11px] text-ink-3">{row.priorityLabel}</span>
                {row.dueLabel ? (
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      row.overdue ? "text-danger" : "text-ink-3",
                    )}
                  >
                    {row.dueLabel}
                  </span>
                ) : null}
                {row.overdue ? <Badge tone="danger">Overdue</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Plus className="size-4 shrink-0 text-accent" aria-hidden="true" />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task"
          aria-label="Add a task"
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim()}>
          <Check className="size-3.5" />
          Add
        </Button>
      </form>
    </section>
  );
}

export function TodayEmptyHint() {
  return (
    <EmptyState
      icon={Clock3}
      title="A clear today"
      description="Nothing is due or scheduled. Capture something to get started."
    />
  );
}