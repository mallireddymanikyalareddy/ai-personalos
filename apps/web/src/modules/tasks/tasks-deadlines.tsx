"use client";

import * as React from "react";

import { CalendarClock } from "lucide-react";

import type { TaskTableRow } from "@personalos/core";

import { cn } from "@/lib/cn";

import { taskStatusMeta } from "./tasks-meta";

export function UpcomingDeadlines({
  rows,
  onOpen,
}: {
  rows: TaskTableRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <section
      aria-label="Upcoming Deadlines"
      data-testid="tasks-deadlines"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarClock className="size-4 text-accent-ink" aria-hidden="true" />
          Upcoming Deadlines
        </h2>
        <a href="/planner" className="text-xs font-medium text-accent-ink hover:underline">
          View all
        </a>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-[12px] text-ink-3">
          Nothing due soon. Add a due date to a task to see it here.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const status = taskStatusMeta(row.status);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  data-testid="tasks-deadline-row"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", status.dot)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{row.title}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums",
                      row.overdue ? "font-medium text-danger" : "text-ink-3",
                    )}
                  >
                    {row.dueLabel}
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