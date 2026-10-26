"use client";

import * as React from "react";

import { MapPin, Sparkles, Clock } from "lucide-react";

import type { AgendaItem, FreeSlot, Timestamp } from "@personalos/core";

import { cn } from "@/lib/cn";

import { eventTone } from "./event-chip";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function slotLabel(slot: FreeSlot): string {
  const iso = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${iso.format(new Date(slot.startsAt))} · ${timeFormatter.format(new Date(slot.startsAt))} – ${timeFormatter.format(new Date(slot.endsAt))}`;
}

function dayLabel(day: Timestamp, now: Timestamp): string {
  const start = new Date(day).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  if (start === today) return "Today";
  const tomorrow = new Date(today).setDate(new Date(today).getDate() + 1);
  if (start === tomorrow) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
    new Date(day),
  );
}

export interface AgendaViewProps {
  items: AgendaItem[];
  now: Timestamp;
  freeSlots: FreeSlot[];
  onOpenEvent: (event: AgendaItem["event"]) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (event: AgendaItem["event"]) => void;
  conflictIds?: Set<string>;
}

export function AgendaView({
  items,
  now,
  freeSlots,
  onOpenEvent,
  selectable = false,
  selected,
  onToggleSelect,
  conflictIds,
}: AgendaViewProps) {
  const groups = React.useMemo(() => {
    const map = new Map<Timestamp, AgendaItem[]>();
    for (const item of items) {
      const key = item.day;
      const existing = map.get(key);
      if (existing) existing.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [items]);

  const shownSlots = freeSlots.slice(0, 3);

  return (
    <div className="space-y-5">
      {shownSlots.length > 0 && (
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            Upcoming free time
          </div>
          <ul className="space-y-1">
            {shownSlots.map((slot) => (
              <li key={`${slot.startsAt}-${slot.endsAt}`} className="flex items-center gap-2 text-sm">
                <Clock className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="tabular-nums text-ink">{slotLabel(slot)}</span>
                <span className="text-xs text-ink-3">
                  {slot.durationMin >= 60
                    ? `${Math.floor(slot.durationMin / 60)}h ${slot.durationMin % 60 ? `${slot.durationMin % 60}m` : ""}`
                    : `${slot.durationMin}m`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-ink-3">
          Nothing scheduled in this window. Add an event — or capture one with a time — and it
          will land here.
        </p>
      ) : (
        groups.map(([day, dayItems]) => (
          <section key={day}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
              {dayLabel(day, now)} · {dayItems.length}
            </h2>
            <ul className="overflow-hidden rounded-xl border border-line bg-surface">
              {dayItems.map(({ event }) => {
                const tone = eventTone(event.color);
                return (
                  <li key={event.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => (selectable ? onToggleSelect?.(event) : onOpenEvent(event))}
                      aria-pressed={selectable ? selected?.has(event.id) : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2",
                        selectable && selected?.has(event.id) && "bg-accent-soft/60",
                        conflictIds?.has(event.id) && "border-l-2 border-l-danger",
                      )}
                    >
                      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
                      <span className="w-28 shrink-0 text-xs tabular-nums text-ink-2">
                        {event.allDay ? "All day" : timeFormatter.format(new Date(event.startsAt))}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {event.title}
                      </span>
                      {event.location && (
                        <span className="flex min-w-0 items-center gap-1 text-xs text-ink-3">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{event.location}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}