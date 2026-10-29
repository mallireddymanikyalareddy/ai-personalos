"use client";

import * as React from "react";

import { ModelLabel } from "@/components/ai/model-label";

import type { LucideIcon } from "lucide-react";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  GitMerge,
  Plus,
  Sparkles,
  Target,
  Wand2,
  Zap,
} from "lucide-react";

import type { Calendar, CalendarEvent, Timestamp } from "@personalos/core";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

import { eventTone } from "./event-chip";

const ASSISTANT_ACTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "plan", label: "Plan my week", icon: CalendarDays },
  { id: "focus", label: "Find focus time", icon: Zap },
  { id: "reschedule", label: "Reschedule", icon: Wand2 },
  { id: "summarize", label: "Summarize week", icon: Sparkles },
  { id: "conflicts", label: "Resolve conflicts", icon: GitMerge },
  { id: "prep", label: "Meeting prep", icon: ClipboardList },
];

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function MiniMonth({
  anchor,
  today,
  eventDays,
  onShiftMonth,
  onSelectDay,
}: {
  anchor: Timestamp;
  today: Timestamp;
  eventDays: Set<string>;
  onShiftMonth: (direction: number) => void;
  onSelectDay: (day: Timestamp) => void;
}) {
  const first = startOfMonth(anchor);
  const offset = (new Date(first).getDay() + 0) % 7;
  const gridStart = first - offset * 86_400_000;
  const cells: { at: Timestamp; date: number; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const at = gridStart + index * 86_400_000;
    const date = new Date(at);
    cells.push({ at, date: date.getDate(), inMonth: date.getMonth() === new Date(first).getMonth() });
  }

  const label = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(first),
  );

  return (
    <section
      aria-label="Mini calendar"
      data-testid="calendar-mini-month"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onShiftMonth(-1)}
          aria-label="Previous month"
          className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </button>
        <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
        <button
          type="button"
          onClick={() => onShiftMonth(1)}
          aria-label="Next month"
          className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_HEADS.map((head) => (
          <span key={head} className="text-[10px] font-medium text-ink-3">
            {head}
          </span>
        ))}
        {cells.map((cell) => {
          const key = new Date(cell.at).toDateString();
          const isToday = new Date(cell.at).toDateString() === new Date(today).toDateString();
          return (
            <button
              key={cell.at}
              type="button"
              onClick={() => onSelectDay(cell.at)}
              aria-label={new Date(cell.at).toDateString()}
              className={cn(
                "mx-auto grid size-6 place-items-center rounded-full text-[11px] tabular-nums",
                isToday ? "bg-accent font-semibold text-white" : cell.inMonth ? "text-ink-2" : "text-ink-3/50",
              )}
            >
              {cell.date}
              {eventDays.has(key) ? (
                <span
                  className="absolute mt-4 size-1 rounded-full bg-accent"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function MyCalendars({
  calendars,
  hidden,
  onToggle,
  onAdd,
}: {
  calendars: Calendar[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section
      aria-label="My Calendars"
      data-testid="calendar-my-calendars"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarDays className="size-4 text-accent-ink" aria-hidden="true" />
          My Calendars
        </h2>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add calendar"
          className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent-ink hover:bg-accent hover:text-white"
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      {calendars.length === 0 ? (
        <p className="text-[12px] text-ink-3">No calendars yet.</p>
      ) : (
        <ul className="space-y-1">
          {calendars.map((calendar) => (
            <li key={calendar.id} className="flex items-center gap-2">
              <Checkbox
                checked={!hidden.has(calendar.id)}
                onChange={() => onToggle(calendar.id)}
                label={`Show ${calendar.name}`}
                size="sm"
              />
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: calendar.color ?? "var(--accent)" }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{calendar.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UpcomingPanel({
  events,
  onOpen,
  onViewAll,
}: {
  events: CalendarEvent[];
  onOpen: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <section
      aria-label="Upcoming events"
      data-testid="calendar-upcoming"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Clock className="size-4 text-accent-ink" aria-hidden="true" />
          Upcoming <span className="text-[11px] font-normal text-ink-3">(Next 7 Days)</span>
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-[11px] font-medium text-accent-ink hover:underline"
        >
          View all
        </button>
      </header>

      {events.length === 0 ? (
        <p className="text-[12px] text-ink-3">Nothing scheduled in the next seven days.</p>
      ) : (
        <ul className="space-y-1.5">
          {events.slice(0, 5).map((event) => {
            const tone = eventTone(event.color);
            const when = new Intl.DateTimeFormat(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(event.startsAt));
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onOpen(event.id)}
                  data-testid="calendar-upcoming-row"
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn("grid size-7 shrink-0 place-items-center rounded-lg", tone.chip)}
                    aria-hidden="true"
                  >
                    <CalendarDays className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">{event.title}</span>
                    <span className="block truncate text-[10px] text-ink-3">{when}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function CalendarAssistant({
  draft,
  onDraftChange,
  answer,
  onRun,
  creditsNote,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  answer: string | null;
  onRun: (id: string) => void;
  creditsNote?: string;
}) {
  return (
    <section
      aria-label="AI Calendar Assistant"
      data-testid="calendar-assistant"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent-ink" aria-hidden="true" />
          AI Calendar Assistant
        </h2>
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
          <ModelLabel />
        </span>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onRun("ask");
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-2">
          <Input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Plan my week, find focus time, or optimize my schedule…"
            aria-label="Ask the calendar assistant"
            className="h-8 border-0 bg-transparent px-0 text-[12px] focus:ring-0"
          />
          <button
            type="submit"
            aria-label="Send to the calendar assistant"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-white hover:bg-accent-strong"
          >
            <Target className="size-4" aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {ASSISTANT_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              data-testid={`calendar-assistant-${action.id}`}
              onClick={() => onRun(action.id)}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="min-w-0 truncate text-[11px] font-medium text-ink-2">{action.label}</span>
            </button>
          );
        })}
      </div>

      {answer != null ? (
        <p
          data-testid="calendar-assistant-answer"
          className="mt-2 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-3 text-[12px] leading-snug text-ink-2"
        >
          {answer}
        </p>
      ) : null}
      {creditsNote ? (
        <p className="mt-1.5 text-[10px] text-ink-3" data-testid="calendar-assistant-credits">
          {creditsNote}
        </p>
      ) : null}
    </section>
  );
}

