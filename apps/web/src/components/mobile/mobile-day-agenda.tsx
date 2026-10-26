"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { addDays, startOfDay, type Timestamp } from "@personalos/core";
import type { CalendarEvent, Task } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { MobileTimeline, timelineEntriesFrom } from "./mobile-timeline";
import { useHaptics } from "@/hooks/use-haptics";
import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

const DAY_MS = 86_400_000;

export interface MobileDayAgendaProps {
  anchor: Timestamp;
  onAnchorChange: (next: Timestamp) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenTask: (taskId: string) => void;
  onAddEvent: (startsAt: Timestamp) => void;
  hour12: boolean;
  swipeEnabled: boolean;
}

export function MobileDayAgenda({
  anchor,
  onAnchorChange,
  onOpenEvent,
  onOpenTask,
  onAddEvent,
  hour12,
  swipeEnabled,
}: MobileDayAgendaProps) {
  const haptics = useHaptics();
  const swiping = React.useRef<{ x: number; y: number; at: number } | null>(null);
  const [drift, setDrift] = React.useState(0);

  const today = startOfDay(Date.now());
  const isToday = startOfDay(anchor) === today;
  const label = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(anchor));

  const go = (delta: number) => {
    haptics.trigger("tap");
    onAnchorChange(startOfDay(anchor) + delta * DAY_MS);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    swiping.current = { x: event.clientX, y: event.clientY, at: Date.now() };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = swiping.current;
    if (!start) return;
    setDrift(event.clientX - start.x);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = swiping.current;
    swiping.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const duration = Math.max(1, Date.now() - start.at);
    setDrift(0);
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) > 64 && duration < 500) {
      haptics.trigger("commit");
      go(dx < 0 ? 1 : -1);
    }
  };

  const state = useAppState();
  const os = useOS();
  const now = Date.now();
  const dayStart = startOfDay(anchor);
  const entries = timelineEntriesFrom(
    Object.values(state.events),
    Object.values(state.tasks),
    dayStart,
    dayStart + DAY_MS - 1,
  );

  const openEntry = (entry: { id: string; kind: string }) => {
    if (entry.kind === "task") {
      onOpenTask(entry.id);
      return;
    }
    const event = state.events[entry.id];
    if (event) onOpenEvent(event as CalendarEvent);
  };

  return (
    <section
      className="swipe-surface rounded-2xl border border-line bg-surface"
      style={{ transform: `translateX(${drift * 0.25}px)` }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line p-3">
        <Button variant="ghost" size="sm" aria-label="Previous day" onClick={() => go(-1)}>
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{label}</p>
          <p className={cn("text-xs", isToday ? "text-accent" : "text-ink-3")}>
            {isToday ? "Today" : new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(now))}
          </p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Next day" onClick={() => go(1)}>
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </header>

      <div
        onPointerDown={swipeEnabled ? onPointerDown : undefined}
        onPointerMove={swipeEnabled ? onPointerMove : undefined}
        onPointerUp={swipeEnabled ? onPointerUp : undefined}
        className="p-3"
      >
        <MobileTimeline
          entries={entries}
          hour12={hour12}
          now={now}
          swipeEnabled={swipeEnabled}
          onOpen={(entry) => openEntry(entry as { id: string; kind: string })}
          onCompleteTask={(taskId) => {
            os.completeTask(taskId);
            haptics.trigger("success");
          }}
          onPostponeTask={(taskId) => {
            const task: Task | undefined = state.tasks[taskId];
            if (!task) return;
            os.updateTask(taskId, { dueAt: addDays(task.dueAt ?? Date.now(), 1) });
            haptics.trigger("tap");
          }}
        />
      </div>

      <div className="border-t border-line p-3">
        <Button
          variant="secondary"
          className="h-12 w-full text-base"
          onClick={() => onAddEvent(dayStart + 9 * 3_600_000)}
        >
          <Plus className="size-4" aria-hidden />
          Add to {isToday ? "today" : "this day"}
        </Button>
      </div>
    </section>
  );
}


