"use client";

import * as React from "react";

import { CalendarRange } from "lucide-react";

import {
  spanPosition,
  timelineMonths,
  timelineRange,
  timelineSpans,
  todayPosition,
  type TimelineSpan,
} from "@personalos/core";
import type { PersonalOS } from "@personalos/core";

import { cn } from "@/lib/cn";

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function barTone(span: TimelineSpan): string {
  if (span.complete) return "bg-success";
  if (span.overdue) return "bg-danger";
  if (span.percent > 0) return "bg-info";
  return "bg-accent/70";
}

export interface ProjectTimelineProps {
  os: PersonalOS;
  projectId: string;
  now?: number;
}

export function ProjectTimeline({ os, projectId, now = Date.now() }: ProjectTimelineProps) {
  const state = os.getState();
  const range = timelineRange(state, projectId, now);
  const spans = timelineSpans(state, projectId, now);
  const months = timelineMonths(range);
  const today = todayPosition(range, now);

  return (
    <section
      className="rounded-xl border border-line bg-surface p-3"
      aria-label="Project timeline"
      data-testid="project-timeline"
    >
      <header className="mb-3 flex items-center gap-2">
        <CalendarRange className="size-4 text-ink-3" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Timeline</h2>
        <span className="ml-auto text-[11px] text-ink-3">
          {formatDate(range.start)} — {formatDate(range.end)}
        </span>
      </header>

      {spans.length === 0 ? (
        <p className="text-xs text-ink-3">
          No milestones to chart yet. Add a milestone with a due date and it will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[32rem]">
            <div className="relative mb-1 h-5 border-b border-line" aria-hidden="true">
              {months.map((month) => (
                <span
                  key={`${month.label}-${month.left}`}
                  className="absolute top-0 truncate text-[10px] text-ink-3"
                  style={{ left: `${month.left}%`, width: `${month.width}%` }}
                >
                  {month.label}
                </span>
              ))}
            </div>

            <ul className="relative space-y-1">
              <span
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-danger/70"
                style={{ left: `${today}%` }}
                aria-hidden="true"
              />

              {spans.map((span) => {
                const box = spanPosition(span, range);
                return (
                  <li key={span.milestone.id} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-xs text-ink-2">
                      {span.milestone.title}
                    </span>
                    <span className="relative h-6 flex-1">
                      <span
                        data-testid={`timeline-bar-${span.milestone.id}`}
                        className={cn(
                          "absolute top-1/2 h-3 -translate-y-1/2 rounded-full",
                          barTone(span),
                        )}
                        style={{ left: `${box.left}%`, width: `${box.width}%` }}
                        title={`${span.milestone.title}: ${formatDate(span.start)} – ${formatDate(
                          span.end,
                        )}${span.percent > 0 ? ` · ${span.percent}%` : ""}`}
                      />
                    </span>
                    <span className="w-20 shrink-0 text-right text-[10px] tabular-nums text-ink-3">
                      {span.milestone.dueAt != null ? formatDate(span.milestone.dueAt) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-3">
              <Legend className="bg-accent/70" label="Planned" />
              <Legend className="bg-info" label="In progress" />
              <Legend className="bg-danger" label="Overdue" />
              <Legend className="bg-success" label="Complete" />
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-full", className)} aria-hidden="true" />
      {label}
    </span>
  );
}