"use client";

import * as React from "react";

import { CalendarClock, Clock, Sparkles, TriangleAlert } from "lucide-react";

import {
  formatTime,
  type CalendarDay,
  type CalendarEvent,
  type PlanningPreferences,
  type TimeBlock,
  type Timestamp,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import { eventTone } from "@/modules/calendar/event-chip";

import { useOS } from "@/store/use-os";

import {
  BLOCK_KIND_LABELS,
  blockKindToPlanKind,
  dayWindow,
  formatMinutes,
  parseHHMM,
  planDot,
} from "./planner-utils";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export interface TimelineViewProps {
  day: CalendarDay;
  prefs: PlanningPreferences;
  now: Timestamp;
  hour12: boolean;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenBlock: (blockId: string) => void;
}

export function TimelineView({
  day,
  prefs,
  now,
  hour12,
  onOpenEvent,
  onOpenBlock,
}: TimelineViewProps) {
  const os = useOS();

  const startMin = parseHHMM(prefs.dayStart) ?? 9 * 60;
  const rawEnd = parseHHMM(prefs.dayEnd) ?? 17 * 60;
  const endMin = rawEnd > startMin ? rawEnd : startMin + 9 * 60;
  const { from, to } = dayWindow(day.date, startMin, endMin);

  const freeMin = to > now ? os.getPlanningFreeMinutes(Math.max(from, now), to, 30) : 0;
  const conflicts = os.getPlanConflicts(from, to);
  const conflictIds = new Set(conflicts.map((conflict) => conflict.blockId));

  const items: (CalendarEvent | TimeBlock)[] = [...day.timeBlocks, ...day.events].sort(
    (a, b) => a.startsAt - b.startsAt,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard
          icon={Sparkles}
          label="Free in window"
          value={formatMinutes(freeMin)}
          accent
        />
        <SummaryCard icon={Clock} label="Time blocks" value={String(day.timeBlocks.length)} />
        <SummaryCard icon={CalendarClock} label="Events" value={String(day.events.length)} />
        <SummaryCard
          icon={TriangleAlert}
          label="Conflicts"
          value={String(conflicts.length)}
          danger={conflicts.length > 0}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-medium text-ink">{dateFormatter.format(new Date(day.date))}</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-3">
            Nothing scheduled yet. Drag a task from the planner onto a slot, or let AI plan this day.
          </p>
        ) : (
          <ul>
            {items.map((item) => {
              const isEvent = item.type === "event";
              return (
                <li key={item.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEvent) onOpenEvent(item);
                      else onOpenBlock(item.id);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="w-24 shrink-0 text-xs tabular-nums text-ink-2">
                      {formatTime(item.startsAt, hour12)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        isEvent ? eventTone(item.color).dot : planDot(blockKindToPlanKind(item.kind)),
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {item.title}
                    </span>
                    {!isEvent && item.source === "ai" && <Badge tone="accent">AI</Badge>}
                    {!isEvent && conflictIds.has(item.id) && <Badge tone="danger">Conflict</Badge>}
                    <span className="shrink-0 text-[10px] font-medium text-ink-3">
                      {isEvent ? "Event" : BLOCK_KIND_LABELS[item.kind]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent = false,
  danger = false,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface px-3.5 py-3",
        danger ? "border-danger/30" : "border-line",
      )}
    >
      <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", danger ? "text-danger" : "text-ink-3")}>
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums tracking-tight", accent ? "text-accent-ink" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}