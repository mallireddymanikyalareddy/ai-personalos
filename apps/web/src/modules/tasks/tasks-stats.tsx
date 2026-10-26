"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import { ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, CircleDashed, CalendarClock, Timer } from "lucide-react";

import type { TaskStatTile } from "@personalos/core";

import { cn } from "@/lib/cn";

const TILE_ICON: Record<string, LucideIcon> = {
  total: CheckCircle2,
  completed: CheckCircle2,
  inProgress: CircleDashed,
  overdue: BarChart3,
  dueToday: CalendarClock,
  thisWeek: Timer,
};

const CARD_TONE: Record<string, string> = {
  accent: "bg-accent-soft",
  success: "bg-success-soft",
  info: "bg-info-soft",
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
};

export function TaskStats({ stats }: { stats: TaskStatTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="tasks-stats">
      {stats.map((tile) => {
        const Icon = TILE_ICON[tile.id] ?? CheckCircle2;
        const delta = tile.deltaPct;
        const rising = delta != null && delta >= 0;
        return (
          <div
            key={tile.id}
            data-testid={`tasks-stat-${tile.id}`}
            className={cn(
              "flex flex-col gap-1.5 rounded-2xl border border-line p-3 shadow-card",
              CARD_TONE[tile.tone],
            )}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="truncate">{tile.label}</span>
            </span>
            <span className="text-xl font-bold tabular-nums leading-tight text-ink">{tile.value}</span>
            <span className="flex items-center gap-1 text-[10px] font-medium">
              {delta != null ? (
                <>
                  {rising ? (
                    <ArrowUpRight className="size-3 text-success" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3 text-danger" aria-hidden="true" />
                  )}
                  <span className={rising ? "text-success" : "text-danger"}>
                    {Math.abs(delta)}%
                  </span>
                </>
              ) : (
                <span className="text-ink-3">—</span>
              )}
              <span className="truncate text-ink-3">{tile.deltaLabel}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}