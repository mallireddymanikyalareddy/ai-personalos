"use client";

import * as React from "react";

import { CheckCircle2, Circle, Download, Pencil, Plus, Trash2 } from "lucide-react";

import { BOARD_COLUMNS, type Milestone } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

import { downloadText } from "@/modules/notebook/notebook-export";
import { useAppState, useOS } from "@/store/use-os";

export interface ProjectDetailSheetProps {
  projectId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onAddMilestone: () => void;
  onEditMilestone: (milestoneId: string) => void;
}

export function ProjectDetailSheet({
  projectId,
  onClose,
  onEdit,
  onAddMilestone,
  onEditMilestone,
}: ProjectDetailSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);

  const project = projectId ? (state.projects[projectId] ?? null) : null;

  React.useEffect(() => {
    setConfirming(false);
  }, [projectId]);

  if (!project) return null;

  const milestones = os.milestonesFor(project.id);
  const tasks = Object.values(state.tasks).filter(
    (t) => t.projectId === project.id && t.status !== "done" && t.status !== "cancelled",
  );
  const progress = os.projectProgressFor(project.id);
  const linkedGoals = project.goalIds
    .map((id) => state.goals[id])
    .filter(Boolean);

  const exportProject = () => {
    const board = os.projectBoard(project.id);
    const format = (at: number) =>
      new Date(at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    const lines = [
      `# ${project.name}`,
      "",
      project.summary || "_No description_",
      "",
      `- Status: ${project.status}`,
      `- Progress: ${progress}%`,
      `- Created: ${format(project.createdAt)}`,
      ...(linkedGoals.length > 0
        ? [`- Goals: ${linkedGoals.map((goal) => goal.title).join(", ")}`]
        : []),
      "",
      "## Tasks",
      ...BOARD_COLUMNS.flatMap((column) => [
        `### ${column.label} (${board[column.id].length})`,
        ...(board[column.id].length > 0
          ? board[column.id].map(
              (task) => `- ${task.title}${task.dueAt != null ? ` — due ${format(task.dueAt)}` : ""}`,
            )
          : ["- None"]),
        "",
      ]),
      "## Milestones",
      ...(milestones.length > 0
        ? milestones.map(
            (milestone) =>
              `- ${milestone.status === "completed" ? "[x]" : "[ ]"} ${milestone.title}${
                milestone.dueAt != null ? ` — due ${format(milestone.dueAt)}` : ""
              }`,
          )
        : ["- None"]),
      "",
      "## Team",
      ...(os.projectTeam(project.id).length > 0
        ? os
            .projectTeam(project.id)
            .map(
              (member) =>
                `- ${member.displayName} (${member.role}) — ${member.taskCount} task${
                  member.taskCount === 1 ? "" : "s"
                }`,
            )
        : ["- No members"]),
    ];
    const slug =
      project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "project";
    downloadText(`${slug}-report.md`, lines.join("\n"));
    toast("Project report downloaded", { tone: "success" });
  };

  const toggleMilestone = (milestone: Milestone) => {
    if (milestone.status === "completed") {
      os.reopenMilestone(milestone.id);
    } else {
      os.completeMilestone(milestone.id);
      toast("Milestone completed", { tone: "success" });
    }
  };

  return (
    <Modal
      open={projectId != null}
      onClose={onClose}
      title={project.name}
      description={project.summary || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={exportProject} data-testid="project-export">
            <Download className="size-3.5" aria-hidden="true" />
            Export
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="danger"
            data-testid="project-delete"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              os.deleteProject(project.id);
              toast("Project deleted", { tone: "success" });
              onClose();
            }}
          >
            <Trash2 className="size-3.5" />
            {confirming ? "Confirm delete" : "Delete"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-ink-3">Progress</span>
            <span className="font-semibold tabular-nums">{progress}%</span>
          </div>
          <ProgressBar value={progress} max={100} tone="accent" />
          <p className="mt-1 text-xs text-ink-3">
            {milestones.filter((m) => m.status === "completed").length} of {milestones.length} milestones · {tasks.length} open tasks
          </p>
        </div>

        {linkedGoals.length > 0 && (
          <div>
            <FieldLabel>Linked goals</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {linkedGoals.map((goal) => (
                <Badge key={goal.id} tone="accent">
                  {goal.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel>Milestones</FieldLabel>
            <button
              type="button"
              data-testid="detail-add-milestone"
              onClick={onAddMilestone}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
            >
              <Plus className="size-3" aria-hidden="true" />
              Add
            </button>
          </div>
          {milestones.length === 0 ? (
            <p className="mb-2 text-xs text-ink-3">
              No milestones yet. Add one with a due date to put it on the timeline.
            </p>
          ) : (
            <div className="mb-2 space-y-1">
              {milestones.map((milestone) => {
                const done = milestone.status === "completed";
                return (
                  <div key={milestone.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleMilestone(milestone)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                    >
                      {done ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-ink-3" />
                      )}
                      <span className={`min-w-0 flex-1 truncate ${done ? "text-ink-3 line-through" : "text-ink"}`}>
                        {milestone.title}
                      </span>
                      <span className="text-xs text-ink-3">{os.milestoneProgressFor(milestone.id)}%</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditMilestone(milestone.id)}
                      aria-label={`Edit ${milestone.title}`}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {tasks.length > 0 && (
          <div>
            <FieldLabel>Open tasks</FieldLabel>
            <div className="space-y-1">
              {tasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm text-ink-2">
                  <Circle className="size-3.5 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                </div>
              ))}
              {tasks.length > 8 && (
                <p className="text-xs text-ink-3">+{tasks.length - 8} more</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
