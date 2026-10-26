"use client";

import * as React from "react";

import { ArrowDownRight, ArrowUpRight, CalendarClock, Flag, Trophy } from "lucide-react";

import type { GoalStats } from "@personalos/core";

import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/cn";

function DeltaChip({ delta, suffix }: { delta: number | null; suffix: string }) {
  if (delta == null) {
    return <span className="text-[11px] text-ink-3">no prior data</span>;
  }
  const up = delta >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3" aria-hidden="true" /> : <ArrowDownRight className="size-3" aria-hidden="true" />}
      {up ? "+" : ""}
      {delta}% <span className="font-normal text-ink-3">{suffix}</span>
    </span>
  );
}

export function GoalsStats({ stats, quarterLabel }: { stats: GoalStats; quarterLabel: string }) {
  const total = stats.inProgressTotal;
  const ratio = total <= 0 ? 0 : Math.round((stats.inProgress / total) * 100);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="goals-stats">
      <Tile data-testid="goals-stat-progress">
        <div className="flex items-center gap-3">
          <CircularProgress value={stats.inProgress} max={total} size={56} stroke={6} tone="accent" label="Goals in progress" />
          <div className="min-w-0">
            <p className="text-xl font-semibold tabular-nums text-ink">
              {stats.inProgress}
              <span className="text-sm font-normal text-ink-3"> / {total}</span>
            </p>
            <p className="text-[12px] text-ink-2">Goals in Progress</p>
            <DeltaChip delta={stats.deltas.inProgress} suffix="vs last month" />
          </div>
        </div>
        <span className="sr-only">{ratio}% of goals are in progress</span>
      </Tile>

      <Tile data-testid="goals-stat-completed">
        <div className="flex items-center gap-3">
          <IconBubble tone="success">
            <Trophy className="size-5" aria-hidden="true" />
          </IconBubble>
          <div className="min-w-0">
            <p className="text-xl font-semibold tabular-nums text-ink">{stats.completed}</p>
            <p className="text-[12px] text-ink-2">Goals Completed</p>
            <DeltaChip delta={stats.deltas.completed} suffix="vs last month" />
          </div>
        </div>
      </Tile>

      <Tile data-testid="goals-stat-overdue">
        <div className="flex items-center gap-3">
          <IconBubble tone="danger">
            <Flag className="size-5" aria-hidden="true" />
          </IconBubble>
          <div className="min-w-0">
            <p className="text-xl font-semibold tabular-nums text-ink">{stats.overdue}</p>
            <p className="text-[12px] text-ink-2">Overdue Goal</p>
            <DeltaChip delta={stats.deltas.overdue} suffix="vs last month" />
          </div>
        </div>
      </Tile>

      <Tile data-testid="goals-stat-quarter">
        <div className="flex items-center gap-3">
          <IconBubble tone="info">
            <CalendarClock className="size-5" aria-hidden="true" />
          </IconBubble>
          <div className="min-w-0">
            <p className="text-xl font-semibold tabular-nums text-ink">{stats.dueThisQuarter}</p>
            <p className="text-[12px] text-ink-2">Due This Quarter</p>
            <DeltaChip delta={stats.deltas.quarter} suffix={`· ${quarterLabel}`} />
          </div>
        </div>
      </Tile>
    </div>
  );
}

function Tile({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-card" {...rest}>
      {children}
    </div>
  );
}

const BUBBLE_TONE = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent-ink",
} as const;

function IconBubble({ tone, children }: { tone: keyof typeof BUBBLE_TONE; children: React.ReactNode }) {
  return <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", BUBBLE_TONE[tone])}>{children}</span>;
}