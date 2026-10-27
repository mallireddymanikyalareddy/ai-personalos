"use client";

import * as React from "react";

import { LifeAreaChip } from "@/components/life-area/life-area";

import {
  CalendarPlus,
  Flag,
  Hash,
  ListChecks,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import {
  dueTone,
  formatDayLabel,
  formatTime,
  selectSubtaskProgress,
  sortTasks,
  startOfDay,
  type Task,
} from "@personalos/core";

import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

const PRIORITY_TONES: Record<number, string> = {
  1: "text-p1",
  2: "text-p2",
  3: "text-p3",
  4: "text-p4",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

function dueLabel(task: Task, now: number, hour12: boolean): { text: string; className: string } {
  const due = task.dueAt;
  if (due == null) return { text: "", className: "" };
  const tone = dueTone(due, now);
  const dayLabel = formatDayLabel(due, now);
  const hasTime = due !== startOfDay(due);
  const text = hasTime ? `${dayLabel} ${formatTime(due, hour12)}` : dayLabel;
  const className =
    tone === "overdue" || tone === "past"
      ? "text-danger"
      : tone === "today"
        ? "font-medium text-accent-ink"
        : tone === "tomorrow"
          ? "text-ink-2"
          : "text-ink-3";
  return { text, className };
}

export interface TaskRowProps {
  task: Task;
  onOpen: (taskId: string) => void;
  showQuickSchedule?: boolean;
  showProject?: boolean;
}

export function TaskRow({ task, onOpen, showQuickSchedule = false, showProject = true }: TaskRowProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const now = Date.now();
  const hour12 = state.settings.timeFormat === 12;
  const done = task.status === "done";
  const project = task.projectId ? (state.projects[task.projectId] ?? null) : null;
  const progress = selectSubtaskProgress(state, task.id);
  const due = task.dueAt != null ? dueLabel(task, now, hour12) : null;

  const handleToggle = (checked: boolean) => {
    const before = { status: task.status, completedAt: task.completedAt, startedAt: task.startedAt };
    if (checked) {
      os.completeTask(task.id);
      toast("Task completed", {
        action: {
          label: "Undo",
          onClick: () => {
            os.updateTask(task.id, {
              status: before.status,
              completedAt: before.completedAt,
              startedAt: before.startedAt,
            });
          },
        },
      });
    } else {
      os.reopenTask(task.id);
      toast("Task reopened", {
        action: {
          label: "Undo",
          onClick: () => {
            os.updateTask(task.id, {
              status: before.status === "done" ? "open" : before.status,
              completedAt: before.completedAt,
              startedAt: before.startedAt,
            });
          },
        },
      });
    }
  };

  const scheduleToday = () => {
    os.updateTask(task.id, { dueAt: startOfDay(now) });
    toast("Scheduled for today", { tone: "success" });
  };

  return (
    <li className="group">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150",
          "hover:bg-surface-2",
        )}
      >
        <Checkbox
          checked={done}
          onChange={handleToggle}
          label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className="mt-0.5"
        />

        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Open task ${task.title}`}
        >
          <span
            className={cn(
              "block truncate text-sm leading-5 text-ink",
              done && "text-ink-3 line-through",
            )}
          >
            {task.title}
          </span>

          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-4 text-ink-3">
            {task.status === "in_progress" && (
              <span className="font-medium text-accent-ink">In progress</span>
            )}
            {due && <span className={cn("inline-flex items-center gap-1", due.className)}>{due.text}</span>}
            {showProject && project && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: project.color ?? "var(--ink-3)" }}
                  aria-hidden="true"
                />
                {project.name}
              </span>
            )}
            <LifeAreaChip lifeAreaId={task.lifeAreaId} />
            {task.priority > 0 && (
              <span className={cn("inline-flex items-center gap-1", PRIORITY_TONES[task.priority])}>
                <Flag className="size-3" aria-hidden="true" />
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {task.estimateMin != null && <span>{task.estimateMin} min</span>}
            {progress.total > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3" aria-hidden="true" />
                {progress.done}/{progress.total}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5">
                <Hash className="size-3" aria-hidden="true" />
                {tag}
              </span>
            ))}
          </span>
        </button>

        {showQuickSchedule && !task.dueAt && !task.scheduledAt && !done && (
          <button
            type="button"
            onClick={scheduleToday}
            aria-label={`Schedule "${task.title}" for today`}
            title="Schedule for today"
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-all hover:bg-surface-3 hover:text-accent-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

export function TaskList({
  tasks,
  onOpen,
  showQuickSchedule,
  showProject,
  sortMode,
}: {
  tasks: Task[];
  onOpen: (taskId: string) => void;
  showQuickSchedule?: boolean;
  showProject?: boolean;
  sortMode?: Parameters<typeof sortTasks>[1];
}) {
  const now = Date.now();
  const sorted = sortMode ? sortTasks(tasks, sortMode, now) : tasks;
  return (
    <ul className="space-y-1">
      {sorted.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onOpen={onOpen}
          showQuickSchedule={showQuickSchedule}
          showProject={showProject}
        />
      ))}
    </ul>
  );
}
