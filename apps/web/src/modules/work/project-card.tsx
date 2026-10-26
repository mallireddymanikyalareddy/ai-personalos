"use client";

import * as React from "react";

import {
  Briefcase,
  CalendarDays,
  Flag,
  ListChecks,
  MoreHorizontal,
} from "lucide-react";

import type { Project, ProjectStats } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

const SWATCHES = ["var(--accent)", "var(--info)", "var(--chart-5)", "var(--warning)"];

function shortDate(at: number | null): string {
  if (at == null) return "—";
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export interface ProjectCardProps {
  project: Project;
  stats: ProjectStats;
  selected: boolean;
  onSelect: () => void;
  onDetails?: () => void;
}

export function ProjectCard({
  project,
  stats,
  selected,
  onSelect,
  onDetails,
}: ProjectCardProps) {
  const color = project.color ?? SWATCHES[0]!;
  const overdue =
    stats.dueAt != null && stats.dueAt < Date.now() && stats.progress < 100 && stats.milestoneDone < stats.milestoneTotal;

  return (
    <div
      data-testid={`project-card-${project.id}`}
      data-selected={selected}
      className={cn(
        "rounded-xl border bg-surface p-3 transition-colors",
        selected ? "border-accent ring-1 ring-accent/40" : "border-line hover:border-line-strong",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          <Briefcase className="size-3.5" />
        </span>

        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
          aria-pressed={selected}
        >
          <span className="block truncate text-sm font-semibold text-ink">{project.name}</span>
          {project.summary.length > 0 ? (
            <span className="mt-0.5 block truncate text-xs text-ink-3">{project.summary}</span>
          ) : null}
        </button>

        {onDetails ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`More options for ${project.name}`}
            onClick={onDetails}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="tabular-nums text-ink-3">{stats.progress}%</span>
          {project.status !== "active" ? <Badge tone="warning">{project.status}</Badge> : null}
        </div>
        <ProgressBar value={stats.progress} max={100} tone="accent" className="h-1.5" />
      </div>

      <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3" aria-hidden="true" />
          <dd className="tabular-nums">
            {stats.done}/{stats.total}
          </dd>
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag className="size-3" aria-hidden="true" />
          <dd className="tabular-nums">{stats.milestoneTotal}</dd>
        </span>
        <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}>
          <CalendarDays className="size-3" aria-hidden="true" />
          <dd>{shortDate(stats.dueAt)}</dd>
          {overdue ? <span className="sr-only">(overdue)</span> : null}
        </span>
      </dl>
    </div>
  );
}