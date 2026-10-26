"use client";

import type { LucideIcon } from "lucide-react";

import {
  BookOpen,
  Briefcase,
  Coins,
  Dumbbell,
  Heart,
  Target,
  Users,
} from "lucide-react";

import type { GoalCategory, GoalHealth } from "@personalos/core";

export const GOAL_CATEGORY_ICON: Record<GoalCategory, LucideIcon> = {
  financial: Coins,
  health: Heart,
  learning: BookOpen,
  personal: Users,
  sports: Dumbbell,
  career: Briefcase,
  other: Target,
};

export const GOAL_CATEGORY_COLOR: Record<GoalCategory, string> = {
  financial: "var(--chart-6)",
  health: "var(--chart-4)",
  learning: "var(--chart-7)",
  personal: "var(--chart-3)",
  sports: "var(--chart-5)",
  career: "var(--chart-2)",
  other: "var(--chart-8)",
};

export const GOAL_CATEGORY_SOFT: Record<GoalCategory, string> = {
  financial: "var(--success-soft)",
  health: "var(--danger-soft)",
  learning: "var(--accent-soft)",
  personal: "var(--warning-soft)",
  sports: "var(--info-soft)",
  career: "var(--info-soft)",
  other: "var(--surface-2)",
};

export interface GoalHealthMeta {
  label: string;
  tone: "neutral" | "accent" | "success" | "danger" | "warning";
  color: string;
}

export const GOAL_HEALTH_META: Record<GoalHealth, GoalHealthMeta> = {
  in_progress: { label: "In Progress", tone: "neutral", color: "var(--info)" },
  on_track: { label: "On Track", tone: "success", color: "var(--success)" },
  ahead: { label: "Ahead", tone: "success", color: "var(--chart-2)" },
  at_risk: { label: "At Risk", tone: "danger", color: "var(--danger)" },
  overdue: { label: "Overdue", tone: "danger", color: "var(--danger-soft)" },
  on_hold: { label: "On Hold", tone: "neutral", color: "var(--chart-8)" },
  completed: { label: "Completed", tone: "accent", color: "var(--accent)" },
};

export function formatGoalDate(at: number | null): string {
  if (at == null) return "No target date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(at));
}

export function formatGoalCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}