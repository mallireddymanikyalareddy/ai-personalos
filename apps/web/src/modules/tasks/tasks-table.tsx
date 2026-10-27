"use client";

import * as React from "react";

import { Flag, MoreHorizontal } from "lucide-react";

import type { TaskTableRow } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";
import { LifeAreaChip } from "@/components/life-area/life-area";
import { useAppState } from "@/store/use-os";

import { taskPriorityMeta, taskStatusMeta, taskTagColor } from "./tasks-meta";

function TaskLifeArea({ taskId }: { taskId: string }) {
  const state = useAppState();
  return <LifeAreaChip lifeAreaId={state.tasks[taskId]?.lifeAreaId} className="ml-1.5 align-middle" />;
}

export interface TaskTableProps {
  rows: TaskTableRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onSnooze?: (id: string) => void;
  activeId?: string | null;
}

function TagPills({ row }: { row: TaskTableRow }) {
  if (row.tags.length === 0) return <span className="text-ink-3">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {row.tags.map((tag, index) => (
        <span
          key={tag}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: "var(--surface-2)", color: taskTagColor(index) }}
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}

export function TaskTable({
  rows,
  selected,
  onToggleRow,
  onToggleAll,
  onOpen,
  onComplete,
  onReopen,
  onEdit,
  onDelete,
  onDuplicate,
  onSnooze,
  activeId,
}: TaskTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card" data-testid="tasks-table">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
          <tr>
            <th scope="col" className="w-10 px-3 py-2.5">
              <Checkbox checked={allSelected} onChange={onToggleAll} label="Select all tasks" size="sm" />
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">Task</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Project</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Due Date</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Status</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Tags</th>
            <th scope="col" className="w-10 px-3 py-2.5" aria-label="Row actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const priority = taskPriorityMeta(row.priority);
            const status = taskStatusMeta(row.status);
            const isSelected = selected.has(row.id);
            const isActive = activeId === row.id;
            return (
              <tr
                key={row.id}
                data-testid="task-row"
                data-task-id={row.id}
                data-active={isActive || undefined}
                className={cn("hover:bg-surface-2/40", isActive && "bg-accent-soft/50")}
              >
                <td className="px-3 py-2.5 align-top">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggleRow(row.id)}
                    label={`Select ${row.title}`}
                    size="sm"
                  />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <button
                    type="button"
                    onClick={() => onOpen(row.id)}
                    className={cn(
                      "max-w-[16rem] truncate text-left font-medium hover:text-accent-ink hover:underline",
                      row.done ? "text-ink-3 line-through" : "text-ink",
                    )}
                    aria-label={`Open ${row.title}`}
                  >
                    {row.title}
                  </button>
                  <TaskLifeArea taskId={row.id} />
                  {row.subtasks.total > 0 ? (
                    <p className="text-[11px] text-ink-3">
                      {row.subtasks.done}/{row.subtasks.total} subtasks
                    </p>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2.5 align-top lg:table-cell">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.projectColor }} />
                    <span className="truncate text-[12px]">{row.projectName}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", priority.chip)}>
                    <Flag className="size-3" aria-hidden="true" />
                    {priority.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className={cn("text-[12px] tabular-nums", row.overdue ? "font-medium text-danger" : "text-ink-2")}>
                    {row.dueLabel}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 align-top md:table-cell">
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", status.chip)}>
                    <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden="true" />
                    {status.label}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 align-top xl:table-cell">
                  <TagPills row={row} />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <DropdownMenu
                    align="end"
                    sections={[
                      {
                        label: row.title,
                        items: [
                          { label: "Open details", onSelect: () => onOpen(row.id) },
                          {
                            label: row.done ? "Reopen task" : "Mark complete",
                            onSelect: () => (row.done ? onReopen(row.id) : onComplete(row.id)),
                          },
                          ...(onSnooze && !row.done
                            ? [{ label: "Snooze 1 day", onSelect: () => onSnooze(row.id) }]
                            : []),
                          ...(onDuplicate
                            ? [{ label: "Duplicate task", onSelect: () => onDuplicate(row.id) }]
                            : []),
                          { label: "Edit task", onSelect: () => onEdit(row.id) },
                          { label: "Delete task", danger: true, onSelect: () => onDelete(row.id) },
                        ],
                      },
                    ]}
                    trigger={
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
                        aria-label={`${row.title} options`}
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </button>
                    }
                  />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-sm text-ink-3">
                No tasks match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function TaskBadges({ row }: { row: TaskTableRow }) {
  const priority = taskPriorityMeta(row.priority);
  const status = taskStatusMeta(row.status);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className={priority.chip}>{priority.label}</Badge>
      <Badge className={status.chip}>{status.label}</Badge>
    </div>
  );
}
