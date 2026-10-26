"use client";

import type { LucideIcon } from "lucide-react";

import { CheckCircle2, Cloud, LayoutGrid, ListTodo, Timer, Users } from "lucide-react";

import type { Priority, TaskStatus } from "@personalos/core";

import type { TaskView } from "@personalos/core";

export const TASK_VIEW_OPTIONS: { value: TaskView; label: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", icon: ListTodo },
  { value: "board", label: "Board", icon: LayoutGrid },
  { value: "calendar", label: "Calendar", icon: Timer },
  { value: "timeline", label: "Timeline", icon: Users },
  { value: "mine", label: "My Tasks", icon: CheckCircle2 },
];

export function taskViewIcon(view: TaskView): LucideIcon {
  return TASK_VIEW_OPTIONS.find((option) => option.value === view)?.icon ?? ListTodo;
}

export interface TaskPriorityMeta {
  label: string;
  text: string;
  soft: string;
  dot: string;
  chip: string;
}

export const TASK_PRIORITY_META: Record<number, TaskPriorityMeta> = {
  0: { label: "None", text: "text-ink-3", soft: "bg-surface-2", dot: "bg-ink-3", chip: "bg-surface-2 text-ink-3" },
  1: { label: "Low", text: "text-success", soft: "bg-success-soft", dot: "bg-success", chip: "bg-success-soft text-success" },
  2: { label: "Medium", text: "text-warning", soft: "bg-warning-soft", dot: "bg-warning", chip: "bg-warning-soft text-warning" },
  3: { label: "High", text: "text-danger", soft: "bg-danger-soft", dot: "bg-danger", chip: "bg-danger-soft text-danger" },
  4: { label: "Urgent", text: "text-danger", soft: "bg-danger-soft", dot: "bg-danger", chip: "bg-danger-soft text-danger" },
};

export function taskPriorityMeta(priority: Priority | number): TaskPriorityMeta {
  return TASK_PRIORITY_META[priority] ?? TASK_PRIORITY_META[0]!;
}

export interface TaskStatusMeta {
  label: string;
  chip: string;
  dot: string;
}

export const TASK_STATUS_META: Record<string, TaskStatusMeta> = {
  inbox: { label: "Inbox", chip: "bg-surface-2 text-ink-3", dot: "bg-ink-3" },
  open: { label: "Not Started", chip: "bg-surface-2 text-ink-2", dot: "bg-ink-3" },
  in_progress: { label: "In Progress", chip: "bg-info-soft text-info", dot: "bg-info" },
  review: { label: "In Review", chip: "bg-warning-soft text-warning", dot: "bg-warning" },
  done: { label: "Completed", chip: "bg-success-soft text-success", dot: "bg-success" },
  cancelled: { label: "Cancelled", chip: "bg-surface-2 text-ink-3", dot: "bg-ink-3" },
  archived: { label: "Archived", chip: "bg-surface-2 text-ink-3", dot: "bg-ink-3" },
};

export function taskStatusMeta(status: TaskStatus | string): TaskStatusMeta {
  return TASK_STATUS_META[status] ?? TASK_STATUS_META.open!;
}

export function taskStatusLabel(status: TaskStatus | string): string {
  return taskStatusMeta(status).label;
}

export function isOverdueStatus(status: TaskStatus | string): boolean {
  return status === "open" || status === "inbox" || status === "in_progress" || status === "review";
}

export const TASK_TAG_COLORS = [
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

export function taskTagColor(index: number): string {
  return TASK_TAG_COLORS[index % TASK_TAG_COLORS.length]!;
}

export const TASK_SOURCE_ICON: Record<string, LucideIcon> = {
  manual: CheckCircle2,
  capture: ListTodo,
  ai: Cloud,
  habit: Timer,
  import: ListTodo,
  integration: Cloud,
};

export function taskSourceIcon(source: string): LucideIcon {
  return TASK_SOURCE_ICON[source] ?? ListTodo;
}