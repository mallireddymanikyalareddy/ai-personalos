"use client";

import * as React from "react";


import {
  BookOpen,
  Check,
  Flame,
  Heart,
  NotebookPen,
  Plane,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import type {
  TodayActivityEntry,
  TodayGoalRow,
  TodayHabitRow,
  TodayJournalPreview,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { PagerDots, usePagedRows } from "./today-pager";

export function PanelShell({
  title,
  icon,
  meta,
  action,
  testId,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  meta?: string;
  action?: { label: string; href: string };
  testId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className={cn(
        "flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {icon}
          {title}
          {meta ? <span className="text-[11px] font-normal text-ink-3">{meta}</span> : null}
        </h2>
        {action ? (
          <a href={action.href} className="text-xs font-medium text-accent-ink hover:underline">
            {action.label}
          </a>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function TodayHabitsPanel({ rows }: { rows: TodayHabitRow[] }) {
  const os = useOS();
  const { toast } = useToast();
  const { rows: visibleRows, page, setPage, totalPages } = usePagedRows(rows);

  const toggle = (row: TodayHabitRow) => {
    if (row.done) {
      os.undoHabit(row.id);
      toast(`${row.title} reset`);
    } else {
      os.completeHabit(row.id);
      toast(`${row.title} completed`);
    }
  };

  const done = rows.filter((row) => row.done).length;

  return (
    <PanelShell
      testId="today-habits"
      title="Habits"
      icon={<Flame className="size-4 text-accent" aria-hidden="true" />}
      meta={rows.length > 0 ? `(${done} of ${rows.length} completed)` : undefined}
      action={{ label: "View all", href: "/habits" }}
    >
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-3">
          No habits due today.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <li key={row.id} className="flex items-center gap-2" data-testid="today-habit-row">
              <Checkbox
                checked={row.done}
                onChange={() => toggle(row)}
                label={`Complete ${row.title}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-[13px] font-medium",
                    row.done ? "text-ink-3 line-through" : "text-ink",
                  )}
                >
                  {row.title}
                </p>
                {row.streakLabel ? (
                  <p className="text-[11px] text-ink-3">{row.streakLabel}</p>
                ) : null}
              </div>
              {row.done ? (
                <Badge tone="success">
                  <Check className="size-3" aria-hidden="true" />
                  Done
                </Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => toggle(row)}>
                  Mark Complete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <PagerDots page={page} totalPages={totalPages} onPage={setPage} label="Habits" />
    </PanelShell>
  );
}

export function TodayGoalsPanel({ rows }: { rows: TodayGoalRow[] }) {
  return (
    <PanelShell
      testId="today-goals"
      title="Goals"
      icon={<Target className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "View all", href: "/goals" }}
    >
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-3">
          No active goals yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((goal, index) => (
            <li key={goal.id} data-testid="today-goal-row">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <GoalIcon index={index} />
                  <span className="truncate text-[13px] font-medium text-ink">{goal.title}</span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-2">
                  {goal.progress}%
                </span>
              </div>
              <ProgressBar
                className="mt-1"
                value={goal.progress}
                max={100}
                tone={goal.progress >= 70 ? "success" : "accent"}
              />
              {goal.description ? (
                <p className="mt-1 truncate text-[11px] text-ink-3">{goal.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

const GOAL_ICONS = [TrendingUp, Heart, BookOpen, Plane, Sparkles];

function GoalIcon({ index }: { index: number }) {
  const Icon = GOAL_ICONS[index % GOAL_ICONS.length]!;
  return <Icon className="size-3.5 shrink-0 text-accent" aria-hidden="true" />;
}

export function TodayJournalPanel({
  preview,
  onWrite,
}: {
  preview: TodayJournalPreview;
  onWrite: () => void;
}) {
  return (
    <PanelShell
      testId="today-journal"
      title="Journal"
      icon={<NotebookPen className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "Write", href: "/journal" }}
    >
      {preview.written ? (
        <div>
          <p className="text-[13px] font-medium text-ink">Today&apos;s reflection</p>
          <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed text-ink-2">
            {preview.preview}
          </p>
          {preview.attachmentUrls.length > 0 ? (
            <div className="mt-2 flex gap-1.5">
              {preview.attachmentUrls.slice(0, 4).map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-12 w-16 rounded-md object-cover"
                />
              ))}
              {preview.attachmentUrls.length > 4 ? (
                <span className="grid h-12 w-16 place-items-center rounded-md bg-surface-2 text-[11px] text-ink-3">
                  +{preview.attachmentUrls.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}
          {preview.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preview.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-ink-3">{preview.streakLabel}</p>
        </div>
      ) : (
        <div>
          <p className="text-[13px] text-ink-2">You haven&apos;t written today&apos;s reflection yet.</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={onWrite}>
            Write today&apos;s reflection
          </Button>
        </div>
      )}
    </PanelShell>
  );
}

const ACTIVITY_TONE: Record<TodayActivityEntry["tone"], string> = {
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function TodayActivityPanel({ rows }: { rows: TodayActivityEntry[] }) {
  return (
    <PanelShell
      testId="today-activity"
      title="Recent Activity"
      icon={<Sparkles className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "View all", href: "/insights" }}
    >
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-3">
          No recent activity.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id} data-testid="today-activity-row">
              <button
                type="button"
                onClick={() => {
                  if (row.href) window.location.assign(row.href);
                }}
                className="flex w-full items-start gap-2 rounded-lg border border-line p-2 text-left transition-colors hover:border-line-strong"
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md",
                    ACTIVITY_TONE[row.tone],
                  )}
                  aria-hidden="true"
                >
                  <ActivityIcon kind={row.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-ink">
                    {row.title}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">{row.detail}</span>
                </span>
                <span className="shrink-0 text-[10px] text-ink-3">
                  {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
                    new Date(row.when),
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function ActivityIcon({ kind }: { kind: TodayActivityEntry["kind"] }) {
  const Icon =
    kind === "task_completed"
      ? Check
      : kind === "note_added"
        ? NotebookPen
        : kind === "habit_completed"
          ? Flame
          : kind === "meeting_summarized"
            ? Sparkles
            : kind === "memory_added"
              ? Heart
              : kind === "journal_written"
                ? BookOpen
                : Target;
  return <Icon className="size-3" />;
}