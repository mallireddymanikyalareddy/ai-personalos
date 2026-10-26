"use client";

import * as React from "react";

import {
  CalendarClock,
  Check,
  Clock3,
  FolderKanban,
  History,
  NotebookPen,
  Repeat2,
  Sparkles,
  Target,
} from "lucide-react";

import type {
  TodayDeadlineRow,
  TodayFocusRow,
  TodayMomentRow,
  TodayNoteRow,
  TodayProjectRow,
  TodayRewardRow,
  TodayStepRow,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

import { PanelShell } from "./today-progress";
import { formatClockTime } from "./use-today-now";

const PRIORITY_LABEL = ["None", "Low", "Medium", "High", "Urgent"];

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-3">
      {children}
    </p>
  );
}

export function TodayRoutinesPanel({ rows }: { rows: TodayStepRow[] }) {
  const os = useOS();
  const { toast } = useToast();

  const toggle = (row: TodayStepRow) => {
    if (!row.taskId) return;
    if (row.done) {
      os.reopenTask(row.taskId);
      toast(`${row.title} reopened`);
    } else {
      os.completeTask(row.taskId);
      toast(`${row.title} completed`);
    }
  };

  return (
    <PanelShell
      testId="today-routines"
      title="Routine steps"
      icon={<Repeat2 className="size-4 text-accent" aria-hidden="true" />}
      meta={rows.length > 0 ? `(${rows.filter((row) => row.done).length} of ${rows.length})` : undefined}
      action={{ label: "Open routines", href: "/work" }}
    >
      {rows.length === 0 ? (
        <Empty>No routine steps due today.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2" data-testid="today-routine-row">
              {row.taskId ? (
                <Checkbox
                  checked={row.done}
                  onChange={() => toggle(row)}
                  label={`Complete ${row.title}`}
                />
              ) : (
                <span className="grid size-5 place-items-center rounded-full border border-line text-ink-3">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-[13px] font-medium", row.done ? "text-ink-3 line-through" : "text-ink")}>
                  {row.title}
                </p>
                <p className="truncate text-[11px] text-ink-3">
                  {row.routineTitle} · {row.slot}
                  {row.durationMin ? ` · ${row.durationMin} min` : ""}
                </p>
              </div>
              {row.done ? <Badge tone="success">Done</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function TodayProjectsPanel({ rows }: { rows: TodayProjectRow[] }) {
  return (
    <PanelShell
      testId="today-projects"
      title="Projects"
      icon={<FolderKanban className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "Open work", href: "/work" }}
    >
      {rows.length === 0 ? (
        <Empty>No active projects yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} data-testid="today-project-row">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink">{row.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-2">{row.progress}%</span>
              </div>
              <ProgressBar className="mt-1" value={row.progress} max={100} tone={row.progress >= 70 ? "success" : "accent"} />
              <p className="mt-1 truncate text-[11px] text-ink-3">
                {row.openTasks} open · {row.doneTasks} done
                {row.nextMilestone ? ` · next: ${row.nextMilestone}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function TodayDeadlinesPanel({ rows }: { rows: TodayDeadlineRow[] }) {
  return (
    <PanelShell
      testId="today-deadlines"
      title="Upcoming deadlines"
      icon={<CalendarClock className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "Open tasks", href: "/tasks" }}
    >
      {rows.length === 0 ? (
        <Empty>Nothing due in the next 7 days.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2" data-testid="today-deadline-row">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  row.priority >= 3 ? "bg-danger" : row.priority === 2 ? "bg-warning" : "bg-success",
                )}
                aria-label={`${PRIORITY_LABEL[row.priority] ?? "None"} priority`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{row.title}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {row.projectName ? `${row.projectName} · ` : ""}
                  {row.dueLabel}
                </span>
              </span>
              <Badge tone={row.dueLabel === "Today" ? "warning" : "outline"}>{row.dueLabel}</Badge>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function TodayNotesPanel({ rows }: { rows: TodayNoteRow[] }) {
  return (
    <PanelShell
      testId="today-notes"
      title="Recent notes"
      icon={<NotebookPen className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "Open notes", href: "/notes" }}
    >
      {rows.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} data-testid="today-note-row">
              <a href="/notes" className="block rounded-lg px-1 py-1 transition-colors hover:bg-surface-2">
                <span className="block truncate text-[13px] font-medium text-ink">{row.title}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {row.notebookName ? `${row.notebookName} · ` : ""}
                  {row.updatedLabel}
                  {row.tags.length > 0 ? ` · ${row.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}` : ""}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function TodayFocusLogPanel({ rows }: { rows: TodayFocusRow[] }) {
  return (
    <PanelShell
      testId="today-focus-log"
      title="Focus log"
      icon={<History className="size-4 text-accent" aria-hidden="true" />}
      meta={rows.length > 0 ? `(${rows.length})` : undefined}
      action={{ label: "Open focus", href: "/focus" }}
    >
      {rows.length === 0 ? (
        <Empty>No focus sessions today.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2" data-testid="today-focus-row">
              <Clock3 className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="w-14 shrink-0 text-[11px] tabular-nums text-ink-3">
                {formatClockTime(row.startedAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{row.title}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-2">{row.minutes}m</span>
              {row.done ? <Badge tone="success">Done</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function TodayMomentsPanel({ rows }: { rows: TodayMomentRow[] }) {
  return (
    <PanelShell
      testId="today-moments"
      title="Moments"
      icon={<Sparkles className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "Open memory", href: "/memory" }}
    >
      {rows.length === 0 ? (
        <Empty>No moments captured today.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} data-testid="today-moment-row">
              <a href="/memory" className="block rounded-lg px-1 py-1 transition-colors hover:bg-surface-2">
                <span className="block truncate text-[13px] font-medium text-ink">{row.title}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {row.whenLabel}
                  {row.location ? ` · ${row.location}` : ""}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function TodayRewardsPanel({ row }: { row: TodayRewardRow }) {
  return (
    <PanelShell
      testId="today-rewards"
      title="Momentum"
      icon={<Target className="size-4 text-accent" aria-hidden="true" />}
      action={{ label: "Open rewards", href: "/rewards" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">
            Level {row.level} · {row.title}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-3">
            {row.xpTotal} XP · {row.favoriteBadges} badge{row.favoriteBadges === 1 ? "" : "s"}
          </p>
        </div>
        <Badge tone="accent">{row.coins} coins</Badge>
      </div>
      <ProgressBar className="mt-3" value={row.progress} max={100} tone="success" />
      <p className="mt-1 text-[11px] text-ink-3">{row.pointsToNext} points to the next level.</p>
    </PanelShell>
  );
}
