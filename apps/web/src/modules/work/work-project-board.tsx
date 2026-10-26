"use client";

import * as React from "react";

import { Archive, FolderKanban } from "lucide-react";

import { columnForStatus, type BoardColumnId, type PersonalOS, type Project } from "@personalos/core";

import { Button } from "@/components/ui/button";

import { ProjectKanban } from "./project-kanban";

export interface WorkProjectBoardProps {
  os: PersonalOS;
  project: Project;
  onOpenTask: (taskId: string) => void;
  onToast: (
    message: string,
    options?: {
      tone?: "success" | "danger";
      action?: { label: string; onClick: () => void };
    },
  ) => void;
}

function columnLabel(column: BoardColumnId): string {
  return column === "in_progress"
    ? "In Progress"
    : column === "review"
      ? "Review"
      : column === "done"
        ? "Done"
        : "To Do";
}

export function WorkProjectBoard({
  os,
  project,
  onOpenTask,
  onToast,
}: WorkProjectBoardProps) {
  const board = os.projectBoard(project.id);
  const wipLimits = project.wipLimits ?? {};

  const assigneeNames = React.useMemo(() => {
    const names: Record<string, string> = {};
    for (const member of os.projectTeam(project.id)) {
      names[member.member.userId] = member.displayName;
    }
    return names;
  }, [os, project.id]);

  const handleMove = (taskId: string, column: BoardColumnId) => {
    const task = os.getTask(taskId);
    if (!task) return;
    if (columnForStatus(task.status) !== column) {
      const limit = wipLimits[column];
      if (limit != null && board[column].length >= limit) {
        onToast(`${columnLabel(column)} is at its WIP limit (${limit})`, { tone: "danger" });
        return;
      }
    }
    const moved = os.moveTaskToColumn(taskId, project.id, column);
    if (moved) {
      const label = column === "done" ? "Done" : column === "review" ? "Review" : column === "in_progress" ? "In Progress" : "To Do";
      onToast(`“${moved.title}” moved to ${label}`);
    }
  };

  const handleAddTask = (column: BoardColumnId, title: string) => {
    const limit = wipLimits[column];
    if (limit != null && board[column].length >= limit) {
      onToast(`${columnLabel(column)} is at its WIP limit (${limit})`, { tone: "danger" });
      return;
    }
    const created = os.addProjectTask({ title }, project.id, column);
    onToast(`Added “${created.title}”`, { tone: "success" });
  };

  const archiveDone = () => {
    const done = board.done;
    if (done.length === 0) return;
    const ids = done.map((task) => task.id);
    for (const id of ids) os.archiveTask(id);
    onToast(`Archived ${ids.length} completed task${ids.length === 1 ? "" : "s"}`, {
      tone: "success",
      action: {
        label: "Undo",
        onClick: () => {
          for (const id of ids) os.updateTask(id, { status: "done" });
          onToast("Restored completed tasks", { tone: "success" });
        },
      },
    });
  };

  return (
    <section className="space-y-2" aria-label={`${project.name} board`}>
      <header className="flex flex-wrap items-center gap-2">
        <FolderKanban className="size-4 text-ink-3" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">{project.name}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="archive-done"
          onClick={archiveDone}
          disabled={board.done.length === 0}
          className="ml-auto"
        >
          <Archive className="size-3.5" aria-hidden="true" />
          Archive {board.done.length} done
        </Button>
      </header>
      <ProjectKanban
        board={board}
        assigneeNames={assigneeNames}
        onMove={handleMove}
        onOpenTask={onOpenTask}
        onAddTask={handleAddTask}
        wipLimits={wipLimits}
      />
    </section>
  );
}