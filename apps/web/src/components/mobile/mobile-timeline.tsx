"use client";

import * as React from "react";

import { CalendarDays, Clock, MapPin } from "lucide-react";

import type { CalendarEvent } from "@personalos/core";
import type { Task } from "@personalos/core";

import { EmptyState } from "@/components/ui/empty-state";
import { SwipeableRow } from "@/components/mobile/swipeable-row";
import { formatTime } from "@personalos/core";
import { useHaptics } from "@/hooks/use-haptics";

export interface TimelineEntry {
  id: string;
  startsAt: number;
  endsAt: number | null;
  title: string;
  location: string | null;
  kind: "event" | "task";
}

export interface MobileTimelineProps {
  entries: TimelineEntry[];
  hour12: boolean;
  onOpen: (entry: TimelineEntry) => void;
  onCompleteTask?: (taskId: string) => void;
  onPostponeTask?: (taskId: string) => void;
  swipeEnabled: boolean;
  now: number;
}

function bucketOf(at: number): { label: string; order: number } {
  const hour = new Date(at).getHours();
  if (hour < 12) return { label: "Morning", order: 0 };
  if (hour < 17) return { label: "Afternoon", order: 1 };
  return { label: "Evening", order: 2 };
}

export function MobileTimeline({
  entries,
  hour12,
  onOpen,
  onCompleteTask,
  onPostponeTask,
  swipeEnabled,
  now,
}: MobileTimelineProps) {
  const haptics = useHaptics();
  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => a.startsAt - b.startsAt),
    [entries],
  );

  const groups = React.useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const entry of sorted) {
      const label = bucketOf(entry.startsAt).label;
      const list = map.get(label) ?? [];
      list.push(entry);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [sorted]);

  const overdue = sorted.filter((entry) => entry.startsAt < now && entry.kind === "task");

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled"
        description="Your day is clear. Add something with quick capture."
      />
    );
  }

  return (
    <div className="space-y-5">
      {overdue.length > 0 ? (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-danger">
            <Clock className="size-3" aria-hidden />
            Earlier today
          </h2>
          <div className="space-y-2">
            {overdue.map((entry) => (
              <TimelineCard
                key={entry.id}
                entry={entry}
                hour12={hour12}
                onOpen={onOpen}
                onCompleteTask={onCompleteTask}
                onPostponeTask={onPostponeTask}
                swipeEnabled={swipeEnabled}
                haptics={haptics}
                overdue
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.map(([label, items]) => (
        <section key={label}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</h2>
          <ol className="space-y-2">
            {items.map((entry) => (
              <li key={entry.id}>
                <TimelineCard
                  entry={entry}
                  hour12={hour12}
                  onOpen={onOpen}
                  onCompleteTask={onCompleteTask}
                  onPostponeTask={onPostponeTask}
                  swipeEnabled={swipeEnabled}
                  haptics={haptics}
                  overdue={false}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineCard({
  entry,
  hour12,
  onOpen,
  onCompleteTask,
  onPostponeTask,
  swipeEnabled,
  haptics,
  overdue,
}: {
  entry: TimelineEntry;
  hour12: boolean;
  onOpen: (entry: TimelineEntry) => void;
  onCompleteTask?: (taskId: string) => void;
  onPostponeTask?: (taskId: string) => void;
  swipeEnabled: boolean;
  haptics: { trigger: (kind: "tap") => void };
  overdue: boolean;
}) {
  const body = (
    <div className="flex items-center gap-3 p-3">
      <div className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink-2">
        {formatTime(entry.startsAt, hour12)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
          {entry.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {entry.location}
            </span>
          ) : null}
          {entry.kind === "task" ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              To do
            </span>
          ) : null}
          {overdue ? <span className="text-danger">Overdue</span> : null}
        </div>
      </div>
    </div>
  );

  if (!swipeEnabled || !onCompleteTask || entry.kind !== "task") {
    return (
      <button
        type="button"
        onClick={() => {
          haptics.trigger("tap");
          onOpen(entry);
        }}
        className="w-full rounded-xl border border-line bg-surface text-left active:bg-surface-2"
      >
        {body}
      </button>
    );
  }

  return (
    <SwipeableRow
      entity="task"
      leftAction="postpone"
      rightAction="complete"
      enabled
      thresholdPx={72}
      onAction={(action) => {
        if (action === "complete") onCompleteTask(entry.id);
        if (action === "postpone") onPostponeTask?.(entry.id);
      }}
      onOpen={() => onOpen(entry)}
    >
      {body}
    </SwipeableRow>
  );
}

export function timelineEntriesFrom(
  events: CalendarEvent[],
  tasks: Task[],
  from: number,
  to: number,
): TimelineEntry[] {
  const eventEntries: TimelineEntry[] = events
    .filter((event) => event.startsAt >= from && event.startsAt <= to)
    .map((event) => ({
      id: event.id,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      title: event.title,
      location: event.location || null,
      kind: "event" as const,
    }));

  const taskEntries: TimelineEntry[] = tasks
    .filter((task) => task.dueAt != null && task.dueAt >= from && task.dueAt <= to && task.status !== "done" && task.status !== "cancelled")
    .map((task) => ({
      id: task.id,
      startsAt: task.dueAt!,
      endsAt: null,
      title: task.title,
      location: null,
      kind: "task" as const,
    }));

  return [...eventEntries, ...taskEntries];
}
