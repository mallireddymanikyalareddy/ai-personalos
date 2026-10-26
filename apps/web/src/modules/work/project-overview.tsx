"use client";

import * as React from "react";

import { CalendarDays, Flag, ListChecks, Plus, Users } from "lucide-react";

import {
  BOARD_COLUMNS,
  type MilestoneHealth,
  type MilestoneView,
  type ProjectStats,
} from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const DOT_TONE = {
  todo: "bg-ink-3",
  in_progress: "bg-info",
  review: "bg-warning",
  done: "bg-success",
} as const;

const HEALTH: Record<MilestoneHealth, { label: string; tone: "success" | "warning" | "outline" | "danger" }> = {
  done: { label: "Complete", tone: "success" },
  on_track: { label: "On Track", tone: "success" },
  at_risk: { label: "At Risk", tone: "danger" },
  upcoming: { label: "Upcoming", tone: "warning" },
};

function dayMonth(at: number): { day: string; month: string } {
  const date = new Date(at);
  return {
    day: `${date.getDate()}`,
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
  };
}

export interface ProjectOverviewProps {
  stats: ProjectStats;
  milestones: MilestoneView[];
  teamCount: number;
  projectId?: string;
  onAddMilestone?: () => void;
  onEditMilestone?: (milestoneId: string) => void;
}

export function ProjectOverview({
  stats,
  milestones,
  teamCount,
  onAddMilestone,
  onEditMilestone,
}: ProjectOverviewProps) {
  const circumference = 2 * Math.PI * 15.5;
  const filled = (stats.progress / 100) * circumference;

  return (
    <div className="space-y-3" data-testid="project-overview">
      <section className="rounded-xl border border-line bg-surface p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">Project overview</h2>

        <div className="flex items-center gap-3">
          <div
            className="relative grid size-24 shrink-0 place-items-center"
            role="img"
            aria-label={`Overall progress ${stats.progress} percent`}
          >
            <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-surface-3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="stroke-success"
                strokeDasharray={`${filled} ${circumference}`}
              />
            </svg>
            <span className="absolute text-center">
              <span className="block text-base font-semibold tabular-nums text-ink">
                {stats.progress}%
              </span>
              <span className="block text-[10px] text-ink-3">progress</span>
            </span>
          </div>

          <ul className="min-w-0 flex-1 space-y-1">
            {BOARD_COLUMNS.map((column) => (
              <li key={column.id} className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", DOT_TONE[column.id])}
                />
                <span className="min-w-0 flex-1 truncate text-ink-2">{column.label}</span>
                <span className="tabular-nums text-ink-3">{stats.columns[column.id]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Tile icon={ListChecks} label="Tasks" value={stats.total} />
          <Tile icon={Flag} label="Milestones" value={stats.milestoneTotal} />
          <Tile icon={Users} label="Members" value={teamCount} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3" data-testid="project-milestones">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Upcoming milestones</h2>
          {onAddMilestone ? (
            <button
              type="button"
              data-testid="add-milestone"
              onClick={onAddMilestone}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
            >
              <Plus className="size-3" aria-hidden="true" />
              Add
            </button>
          ) : null}
        </div>

        {milestones.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-ink-3">
              No open milestones. Add one to track delivery dates for this project.
            </p>
            {onAddMilestone ? (
              <button
                type="button"
                onClick={onAddMilestone}
                className="text-[11px] font-medium text-accent-ink hover:underline"
              >
                Add the first milestone
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2">
            {milestones.map((view) => {
              const due = view.milestone.dueAt;
              const stamp = due != null ? dayMonth(due) : null;
              const overdue = due != null && due < Date.now() && view.health === "at_risk";
              return (
                <li key={view.milestone.id} data-testid="project-milestone-row">
                  <button
                    type="button"
                    onClick={() => onEditMilestone?.(view.milestone.id)}
                    title={onEditMilestone ? "Edit milestone" : undefined}
                    className="flex w-full gap-2 text-left"
                  >
                  {stamp ? (
                    <span className="w-9 shrink-0 text-center">
                      <span className="block text-[9px] text-ink-3">{stamp.month}</span>
                      <span
                        className={cn(
                          "block text-sm font-semibold tabular-nums",
                          overdue ? "text-danger" : "text-ink",
                        )}
                      >
                        {stamp.day}
                      </span>
                    </span>
                  ) : (
                    <span className="w-9 shrink-0 text-center text-[9px] text-ink-3">—</span>
                  )}

                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        view.health === "done"
                          ? "var(--success)"
                          : view.health === "at_risk"
                            ? "var(--danger)"
                            : view.health === "on_track"
                              ? "var(--info)"
                              : "var(--warning)",
                    }}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{view.milestone.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <Badge tone={HEALTH[view.health].tone}>{HEALTH[view.health].label}</Badge>
                      {view.total > 0 ? (
                        <span className="text-[11px] tabular-nums text-ink-3">
                          {view.done}/{view.total} tasks
                        </span>
                      ) : null}
                    </span>
                  </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {stats.dueAt != null ? (
        <p className="flex items-center gap-1.5 px-1 text-xs text-ink-3">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Earliest deadline{" "}
          {new Date(stats.dueAt).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      ) : null}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-2 text-center">
      <Icon className="mx-auto size-3.5 text-ink-3" aria-hidden="true" />
      <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[10px] text-ink-3">{label}</p>
    </div>
  );
}