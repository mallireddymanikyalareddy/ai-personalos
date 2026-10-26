"use client";

import * as React from "react";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Plus,
  X,
} from "lucide-react";

import {
  BOARD_COLUMNS,
  nextMove,
  relativeTime,
  type BoardColumn,
  type BoardColumnId,
  type ProjectBoard,
  type ProjectWipLimits,
  type Task,
} from "@personalos/core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const DRAG_TASK = "application/x-project-task";

const DOT_TONE: Record<BoardColumn["tone"], string> = {
  muted: "bg-ink-3",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
};

const PRIORITY_LABEL: Record<number, { label: string; tone: string }> = {
  3: { label: "High", tone: "bg-danger-soft text-danger" },
  2: { label: "Medium", tone: "bg-warning-soft text-warning" },
  1: { label: "Low", tone: "bg-success-soft text-success" },
};

function shortDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface ProjectKanbanProps {
  board: ProjectBoard;
  assigneeNames: Record<string, string>;
  onMove: (taskId: string, column: BoardColumnId) => void;
  onOpenTask: (taskId: string) => void;
  onAddTask: (column: BoardColumnId, title: string) => void;
  wipLimits?: ProjectWipLimits;
}

export function ProjectKanban({
  board,
  assigneeNames,
  onMove,
  onOpenTask,
  onAddTask,
  wipLimits,
}: ProjectKanbanProps) {
  const [adding, setAdding] = React.useState<BoardColumnId | null>(null);
  const [draft, setDraft] = React.useState("");
  const [over, setOver] = React.useState<BoardColumnId | null>(null);

  const submit = (column: BoardColumnId) => {
    const title = draft.trim();
    if (title.length > 0) onAddTask(column, title);
    setDraft("");
    setAdding(null);
  };

  return (
    <div
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      data-testid="project-kanban"
    >
      {BOARD_COLUMNS.map((column) => {
        const tasks = board[column.id];
        const limit = wipLimits?.[column.id];
        const overLimit = limit != null && tasks.length > limit;
        return (
          <section
            key={column.id}
            aria-label={column.label}
            data-column={column.id}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes(DRAG_TASK)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOver(column.id);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const taskId = event.dataTransfer.getData(DRAG_TASK);
              if (taskId) onMove(taskId, column.id);
            }}
            className={cn(
              "flex min-h-[10rem] flex-col rounded-xl border border-line bg-bg-subtle/50 p-2 transition-shadow",
              over === column.id && "ring-2 ring-accent/60",
            )}
          >
            <header className="mb-2 flex items-center gap-2 px-1">
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", DOT_TONE[column.tone])}
              />
              <h3 className="text-xs font-semibold text-ink">{column.label}</h3>
              <span
                className={cn(
                  "ml-auto rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                  overLimit ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-3",
                )}
                title={limit != null ? `WIP limit ${limit}` : undefined}
              >
                {tasks.length}
                {limit != null ? `/${limit}` : ""}
              </span>
            </header>

            <ul className="flex-1 space-y-1.5">
              {tasks.map((task) => (
                <li key={task.id}>
                  <KanbanCard
                    task={task}
                    assignee={task.assigneeId ? assigneeNames[task.assigneeId] : undefined}
                    canMoveLeft={nextMove(task, "left") !== null}
                    canMoveRight={nextMove(task, "right") !== null}
                    onOpen={() => onOpenTask(task.id)}
                    onMoveLeft={() => {
                      const target = nextMove(task, "left");
                      if (target) onMove(task.id, target);
                    }}
                    onMoveRight={() => {
                      const target = nextMove(task, "right");
                      if (target) onMove(task.id, target);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_TASK, task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  />
                </li>
              ))}
            </ul>

            {adding === column.id ? (
              <form
                className="mt-2 flex gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(column.id);
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setDraft("");
                      setAdding(null);
                    }
                  }}
                  placeholder="Task title"
                  aria-label={`New task in ${column.label}`}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <Button size="icon-sm" variant="primary" type="submit" aria-label="Create task">
                  <Plus className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  type="button"
                  aria-label="Cancel"
                  onClick={() => {
                    setDraft("");
                    setAdding(null);
                  }}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(column.id)}
                aria-label={`Add task to ${column.label}`}
                className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong py-1.5 text-xs text-ink-3 transition-colors hover:border-accent hover:text-accent-ink"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add Task
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  assignee,
  canMoveLeft,
  canMoveRight,
  onOpen,
  onMoveLeft,
  onMoveRight,
  onDragStart,
}: {
  task: Task;
  assignee?: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onOpen: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDragStart: (event: React.DragEvent) => void;
}) {
  const priority = PRIORITY_LABEL[task.priority];
  const overdue = task.dueAt != null && task.dueAt < Date.now() && task.status !== "done";

  return (
    <article
      data-testid={`kanban-card-${task.id}`}
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-lg border border-line bg-surface p-2 shadow-card active:cursor-grabbing"
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          aria-label={`Open task ${task.title}`}
        >
          <span className="block text-sm font-medium leading-snug text-ink">{task.title}</span>
        </button>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${task.title} left`}
            disabled={!canMoveLeft}
            onClick={onMoveLeft}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${task.title} right`}
            disabled={!canMoveRight}
            onClick={onMoveRight}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {task.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-ink"
          >
            {tag}
          </span>
        ))}
        {priority ? (
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", priority.tone)}>
            {priority.label}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-3">
        {task.dueAt != null ? (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}>
            {overdue ? <CircleAlert className="size-3" aria-hidden="true" /> : null}
            <CalendarDays className="size-3" aria-hidden="true" />
            {shortDate(task.dueAt)}
          </span>
        ) : (
          <span className="text-ink-3">No due date</span>
        )}
        {assignee ? (
          <span className="ml-auto truncate" title={assignee}>
            {assignee}
          </span>
        ) : null}
      </div>

      {task.completedAt != null ? (
        <p className="mt-1 text-[10px] text-ink-3">Done {relativeTime(task.completedAt)}</p>
      ) : null}
    </article>
  );
}