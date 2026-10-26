"use client";

import * as React from "react";

import { Filter, Search, Users, Video } from "lucide-react";

import type { MeetingListRow, MeetingMonthGroup } from "@personalos/core";

import { DropdownMenu } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export function MeetingListPanel({
  groups,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onFilter,
  filterLabel,
}: {
  groups: MeetingMonthGroup[];
  selectedId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onFilter: (value: "all" | "summarised" | "actions") => void;
  filterLabel: string;
}) {
  return (
    <section
      aria-label="Meetings list"
      data-testid="meeting-list-panel"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="flex items-center gap-2 border-b border-line p-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search meetings…"
            aria-label="Search meetings"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <DropdownMenu
          align="end"
          sections={[
            {
              label: "Filter meetings",
              items: [
                { label: "All meetings", selected: filterLabel === "All meetings", onSelect: () => onFilter("all") },
                { label: "With summaries", selected: filterLabel === "With summaries", onSelect: () => onFilter("summarised") },
                { label: "With action items", selected: filterLabel === "With action items", onSelect: () => onFilter("actions") },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              aria-label="Filter meetings"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Filter className="size-3.5" aria-hidden="true" />
            </button>
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-ink-3">
            No meetings match this search.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-3" data-testid="meeting-month-group">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.rows.map((row) => (
                  <MeetingListItem
                    key={row.id}
                    row={row}
                    active={row.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MeetingListItem({
  row,
  active,
  onSelect,
}: {
  row: MeetingListRow;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(row.startsAt),
  );
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(row.startsAt),
  );

  return (
    <li>
      <button
        type="button"
        data-testid="meeting-list-item"
        onClick={() => onSelect(row.id)}
        aria-pressed={active}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
          active
            ? "border-accent bg-accent-soft/60"
            : "border-transparent hover:border-line hover:bg-surface-2/70",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            active ? "bg-accent text-white" : "bg-surface-2 text-ink-3",
          )}
          aria-hidden="true"
        >
          <Video className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{row.title}</span>
          <span className="block truncate text-[11px] text-ink-3">
            {date}, {time}
            {row.durationMin > 0 ? ` · ${row.durationMin} min` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-3">
          <Users className="size-3" aria-hidden="true" />
          {row.participantCount}
        </span>
      </button>
    </li>
  );
}
