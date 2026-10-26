"use client";

import type { LucideIcon } from "lucide-react";

import {
  Apple,
  BedDouble,
  BookOpen,
  Brain,
  Droplet,
  Dumbbell,
  Footprints,
  Leaf,
  Moon,
  PenLine,
  PersonStanding,
  PiggyBank,
  Sparkles,
  Timer,
} from "lucide-react";

import type { HabitCadence, HabitPriority } from "@personalos/core";

export const HABIT_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "water", label: "Water", icon: Droplet },
  { value: "dumbbell", label: "Exercise", icon: Dumbbell },
  { value: "book", label: "Read", icon: BookOpen },
  { value: "meditate", label: "Meditate", icon: Brain },
  { value: "salad", label: "Eat healthy", icon: Apple },
  { value: "screen", label: "Screen time", icon: Timer },
  { value: "walk", label: "Walk", icon: Footprints },
  { value: "sleep", label: "Sleep", icon: Moon },
  { value: "stretch", label: "Stretch", icon: PersonStanding },
  { value: "sleep-early", label: "Sleep early", icon: BedDouble },
  { value: "journal", label: "Journal", icon: PenLine },
  { value: "save", label: "Save", icon: PiggyBank },
  { value: "plants", label: "Plants", icon: Leaf },
  { value: "focus", label: "Focus", icon: Sparkles },
];

export const HABIT_COLOR_OPTIONS: { value: string; label: string; swatch: string }[] = [
  { value: "var(--chart-6)", label: "Green", swatch: "#2f855a" },
  { value: "var(--chart-5)", label: "Blue", swatch: "#3b6fd4" },
  { value: "var(--chart-7)", label: "Violet", swatch: "#7c5cd6" },
  { value: "var(--chart-3)", label: "Amber", swatch: "#d97706" },
  { value: "var(--chart-4)", label: "Rose", swatch: "#db2777" },
  { value: "var(--chart-2)", label: "Teal", swatch: "#0d9488" },
];

const ICONS = new Map(HABIT_ICON_OPTIONS.map((option) => [option.value, option.icon]));
const COLORS = new Map(HABIT_COLOR_OPTIONS.map((option) => [option.value, option.label]));

export function habitIcon(name: string | null | undefined): LucideIcon {
  return (name != null ? ICONS.get(name) : undefined) ?? Sparkles;
}

export function habitIconLabel(name: string | null | undefined): string {
  return HABIT_ICON_OPTIONS.find((option) => option.value === name)?.label ?? "Sparkles";
}

export function habitColor(value: string | null | undefined): string {
  if (typeof value === "string" && value.startsWith("#")) return value;
  if (value != null && COLORS.has(value)) return value;
  return "var(--accent)";
}

export function habitColorLabel(value: string | null | undefined): string {
  return (value != null ? COLORS.get(value) : undefined) ?? "Accent";
}

export function habitSwatch(value: string | null | undefined): string {
  return HABIT_COLOR_OPTIONS.find((option) => option.value === value)?.swatch ?? "#5751c7";
}

export interface HabitPriorityMeta {
  label: string;
  tone: "danger" | "warning" | "neutral";
}

export const HABIT_PRIORITY_META: Record<HabitPriority, HabitPriorityMeta> = {
  high: { label: "High", tone: "danger" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
};

export function habitPriority(value: HabitPriority | null | undefined): HabitPriorityMeta {
  return HABIT_PRIORITY_META[value ?? "medium"] ?? HABIT_PRIORITY_META.medium;
}

export const HABIT_CADENCE_LABEL: Record<HabitCadence, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export const HABIT_TAB_LABEL: Record<string, string> = {
  all: "All Habits",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export function habitStreakLabel(days: number): string {
  if (days <= 0) return "No streak";
  return days === 1 ? "1 day" : `${days} days`;
}