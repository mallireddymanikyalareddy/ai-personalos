"use client";

import * as React from "react";

import type { LucideIcon } from "lucide-react";

import { BarChart3, CheckCircle2, Flame, Star } from "lucide-react";

import type { HabitStatsSummary } from "@personalos/core";

interface Tile {
  id: string;
  icon: LucideIcon;
  iconClassName: string;
  value: string;
  label: string;
  cardClassName: string;
}

export function HabitStats({ stats }: { stats: HabitStatsSummary }) {
  const tiles: Tile[] = [
    {
      id: "streak",
      icon: Flame,
      iconClassName: "bg-warning-soft text-warning",
      value: stats.currentStreak > 0 ? `${stats.currentStreak} Days` : "0 Days",
      label: "Current Streak",
      cardClassName: "bg-warning-soft",
    },
    {
      id: "success",
      icon: CheckCircle2,
      iconClassName: "bg-success-soft text-success",
      value: `${stats.successRate}%`,
      label: "Success Rate",
      cardClassName: "bg-success-soft",
    },
    {
      id: "today",
      icon: BarChart3,
      iconClassName: "bg-info-soft text-info",
      value: `${stats.doneToday} / ${stats.dueToday}`,
      label: "Today's Habits",
      cardClassName: "bg-info-soft",
    },
    {
      id: "longest",
      icon: Star,
      iconClassName: "bg-accent-soft text-accent-ink",
      value: `${stats.longestStreak} Days`,
      label: "Longest Streak",
      cardClassName: "bg-accent-soft",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="habits-stats">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.id}
            data-testid={`habits-stat-${tile.id}`}
            className={`flex items-center gap-3 rounded-2xl border border-line p-3.5 shadow-card ${tile.cardClassName}`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${tile.iconClassName}`}
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold tabular-nums leading-tight text-ink">
                {tile.value}
              </span>
              <span className="block truncate text-[11px] font-medium text-ink-2">{tile.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}