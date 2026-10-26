"use client";

import * as React from "react";

import {
  CalendarDays,
  Check,
  Feather,
  Inbox,
  Repeat,
  Target,
  Timer,
} from "lucide-react";

import { widgetsFor, type MobileWidgetId } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/use-haptics";
import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

export interface MobileWidgetsProps {
  onNavigate: (href: string) => void;
  onCapture: () => void;
  onStartFocus: () => void;
  onOpenTask: (taskId: string) => void;
}

const WIDGET_ICON: Record<MobileWidgetId, React.ComponentType<{ className?: string }>> = {
  today_tasks: CalendarDays,
  next_event: CalendarDays,
  habits_due: Repeat,
  journal_prompt: Feather,
  focus_session: Timer,
  streak: Feather,
  inbox: Inbox,
  goals_progress: Target,
  mood_today: Feather,
  quick_capture: Check,
};

export function MobileWidgets({ onNavigate, onCapture, onStartFocus, onOpenTask }: MobileWidgetsProps) {
  const os = useOS();
  useAppState();
  const haptics = useHaptics();
  const now = Date.now();

  const preferences = os.mobilePreferences();
  const widgets = widgetsFor(preferences, 6);
  const journalToday = os.journalEntryFor(now);

  const tint = (id: MobileWidgetId) =>
    id === "journal_prompt" || id === "streak" || id === "mood_today"
      ? "text-accent"
      : id === "habits_due"
        ? "text-success"
        : id === "inbox"
          ? "text-warning"
          : "text-ink-2";

  return (
    <div className="grid grid-cols-2 gap-3">
      {widgets.map((widget) => {
        const Icon = WIDGET_ICON[widget.id];
        return (
          <section
            key={widget.id}
            className={cn(
              "relative flex min-h-[104px] flex-col justify-between rounded-2xl border border-line bg-surface p-3.5 text-left",
              widget.id === "quick_capture" && "bg-accent-soft",
            )}
          >
            <header className="flex items-center gap-2">
              <Icon className={cn("size-4", tint(widget.id))} aria-hidden />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{widget.label}</h2>
            </header>

            <div className="mt-2 flex-1">
              <WidgetBody id={widget.id} onNavigate={onNavigate} onOpenTask={onOpenTask} />
            </div>

            <div className="mt-2">
              <WidgetAction
                id={widget.id}
                journalToday={journalToday != null}
                onNavigate={onNavigate}
                onCapture={() => {
                  haptics.trigger("commit");
                  onCapture();
                }}
                onStartFocus={() => {
                  haptics.trigger("tap");
                  onStartFocus();
                }}
              />
            </div>

            <span className="sr-only">{widget.description}</span>
          </section>
        );
      })}
    </div>
  );
}

function WidgetBody({
  id,
  onNavigate,
  onOpenTask,
}: {
  id: MobileWidgetId;
  onNavigate: (href: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const os = useOS();
  const state = useAppState();

  switch (id) {
    case "today_tasks": {
      const tasks = Object.values(state.tasks)
        .filter((task) => task.status === "open" || task.status === "in_progress")
        .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
        .slice(0, 3);
      if (tasks.length === 0) return <p className="text-sm text-ink-3">Nothing due today.</p>;
      return (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpenTask(task.id)}
                className="w-full truncate text-left text-sm text-ink"
              >
                {task.title}
              </button>
            </li>
          ))}
        </ul>
      );
    }

    case "next_event": {
      const now = Date.now();
      const next = Object.values(state.events)
        .filter((event) => event.startsAt >= now)
        .sort((a, b) => a.startsAt - b.startsAt)[0];
      if (!next) return <p className="text-sm text-ink-3">Nothing on the calendar.</p>;
      const minutes = Math.max(0, Math.round((next.startsAt - now) / 60_000));
      return (
        <div>
          <p className="truncate text-sm font-medium text-ink">{next.title}</p>
          <p className="text-xs text-ink-3">
            {minutes < 60 ? `in ${minutes} min` : `in ${Math.round(minutes / 60)} h`}
          </p>
        </div>
      );
    }

    case "habits_due": {
      const todayKey = new Date().toISOString().slice(0, 10);
      const checked = new Set(
        Object.values(state.habitCheckins)
          .filter((checkin) => new Date(checkin.checkedAt).toISOString().slice(0, 10) === todayKey)
          .map((checkin) => checkin.habitId),
      );
      const due = Object.values(state.habits).filter((habit) => !habit.archived && !checked.has(habit.id));
      if (due.length === 0) return <p className="text-sm text-success">All habits done.</p>;
      return (
        <ul className="space-y-1">
          {due.slice(0, 3).map((habit) => (
            <li key={habit.id}>
              <button
                type="button"
                onClick={() => onNavigate("/habits")}
                className="w-full truncate text-left text-sm text-ink"
              >
                {habit.title}
              </button>
            </li>
          ))}
        </ul>
      );
    }

    case "journal_prompt":
    case "mood_today": {
      const entry = os.journalEntryFor(Date.now());
      if (!entry) return <p className="text-sm text-ink-3">Not written yet.</p>;
      return (
        <p className="line-clamp-2 text-sm text-ink-2">
          {entry.body || entry.title || "Reflected today."}
        </p>
      );
    }

    case "streak": {
      const streak = os.journalStreak(Date.now());
      return (
        <p className="text-2xl font-semibold tabular-nums">
          {streak.current}
          <span className="ml-1 text-xs font-normal text-ink-3">days</span>
        </p>
      );
    }

    case "inbox": {
      const count = Object.values(state.tasks).filter((task) => task.status === "inbox").length;
      return (
        <p className="text-2xl font-semibold tabular-nums">
          {count}
          <span className="ml-1 text-xs font-normal text-ink-3">to file</span>
        </p>
      );
    }

    case "goals_progress": {
      const goals = Object.values(state.goals).filter((goal) => goal.status === "active").slice(0, 2);
      if (goals.length === 0) return <p className="text-sm text-ink-3">No active goals.</p>;
      return (
        <ul className="space-y-1.5">
          {goals.map((goal) => (
            <li key={goal.id}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{goal.title}</span>
                <span className="tabular-nums text-ink-3">{goal.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${goal.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    default:
      return <p className="text-sm text-ink-3">Ready.</p>;
  }
}

function WidgetAction({
  id,
  journalToday,
  onNavigate,
  onCapture,
  onStartFocus,
}: {
  id: MobileWidgetId;
  journalToday: boolean;
  onNavigate: (href: string) => void;
  onCapture: () => void;
  onStartFocus: () => void;
}) {
  switch (id) {
    case "quick_capture":
      return (
        <Button variant="primary" size="sm" className="w-full" onClick={onCapture}>
          Capture
        </Button>
      );
    case "journal_prompt":
    case "mood_today":
      return (
        <Button
          variant={journalToday ? "ghost" : "secondary"}
          size="sm"
          className="w-full"
          onClick={() => onNavigate("/journal")}
        >
          {journalToday ? "Open entry" : "Write today"}
        </Button>
      );
    case "focus_session":
      return (
        <Button variant="secondary" size="sm" className="w-full" onClick={onStartFocus}>
          Start focus
        </Button>
      );
    case "today_tasks":
      return (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("/tasks")}>
          All tasks
        </Button>
      );
    case "next_event":
      return (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("/calendar")}>
          Open calendar
        </Button>
      );
    case "habits_due":
      return (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("/habits")}>
          Check in
        </Button>
      );
    case "streak":
      return (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("/journal")}>
          Journal
        </Button>
      );
    case "inbox":
      return (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("/inbox")}>
          File them
        </Button>
      );
    default:
      return (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("/goals")}>
          Goals
        </Button>
      );
  }
}
