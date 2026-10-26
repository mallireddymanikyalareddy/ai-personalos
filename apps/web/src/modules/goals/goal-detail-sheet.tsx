"use client";

import * as React from "react";

import { CheckCircle2, Circle, Link2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { FieldLabel, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { goalHealth } from "@personalos/core";

import { useAppState, useOS } from "@/store/use-os";

import { GOAL_HEALTH_META } from "./goals-meta";
export interface GoalDetailSheetProps {
  goalId: string | null;
  onClose: () => void;
  onEdit: () => void;
}

export function GoalDetailSheet({ goalId, onClose, onEdit }: GoalDetailSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const goal = goalId ? (state.goals[goalId] ?? null) : null;
  const [metricLabel, setMetricLabel] = React.useState("");
  const [metricTarget, setMetricTarget] = React.useState(100);
  const [metricUnit, setMetricUnit] = React.useState("");

  React.useEffect(() => {
    setMetricLabel("");
    setMetricTarget(100);
    setMetricUnit("");
  }, [goalId]);

  if (!goal) return null;

  const progress = os.goalProgressFor(goal.id);
  const health = GOAL_HEALTH_META[goalHealth(goal, progress.progress, Date.now())];

  const linkedProjects = Object.values(state.projects).filter((project) =>
    project.goalIds.includes(goal.id),
  );
  const linkedTasks = Object.values(state.tasks).filter((task) => task.goalIds.includes(goal.id));
  const openTasks = linkedTasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );
  const linkedHabits = Object.values(state.habits).filter(
    (habit) => habit.goalId === goal.id && !habit.archived,
  );

  const allProjects = Object.values(state.projects).sort((a, b) => a.name.localeCompare(b.name));
  const allTasks = Object.values(state.tasks)
    .filter((task) => task.status !== "done" && task.status !== "cancelled" && task.parentTaskId == null)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
    .slice(0, 25);
  const allHabits = Object.values(state.habits)
    .filter((habit) => !habit.archived)
    .sort((a, b) => a.title.localeCompare(b.title));

  const toggleProject = (projectId: string) => {
    const project = state.projects[projectId];
    if (!project) return;
    const goalIds = project.goalIds.includes(goal.id)
      ? project.goalIds.filter((id) => id !== goal.id)
      : [...project.goalIds, goal.id];
    os.updateProject(projectId, { goalIds });
  };

  const toggleTask = (taskId: string) => {
    const task = state.tasks[taskId];
    if (!task) return;
    const goalIds = task.goalIds.includes(goal.id)
      ? task.goalIds.filter((id) => id !== goal.id)
      : [...task.goalIds, goal.id];
    os.updateTask(taskId, { goalIds });
  };

  const toggleHabit = (habitId: string) => {
    const habit = state.habits[habitId];
    if (!habit) return;
    os.updateHabit(habitId, { goalId: habit.goalId === goal.id ? null : goal.id });
  };

  const addMetric = () => {
    if (!metricLabel.trim()) return;
    os.addGoalMetric(goal.id, {
      label: metricLabel.trim(),
      current: 0,
      target: metricTarget,
      unit: metricUnit.trim(),
    });
    setMetricLabel("");
    setMetricTarget(100);
    setMetricUnit("");
  };

  const removeMetric = (index: number) => {
    os.removeGoalMetric(goal.id, index);
  };

  const toggleComplete = () => {
    if (goal.status === "completed") {
      os.reopenGoal(goal.id);
    } else {
      os.completeGoal(goal.id);
      toast("Goal completed", { tone: "success" });
    }
  };

  return (
    <Modal
      open={goalId != null}
      onClose={onClose}
      title={goal.title}
      description={goal.description || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant={goal.status === "completed" ? "secondary" : "primary"}
            onClick={toggleComplete}
          >
            {goal.status === "completed" ? "Reopen" : "Mark complete"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-ink-3">
              Progress
              <Badge tone={health.tone}>{health.label}</Badge>
            </span>
            <span className="font-semibold tabular-nums">{progress.progress}%</span>
          </div>
          <ProgressBar
            value={progress.progress}
            max={100}
            tone={goal.status === "completed" ? "success" : "accent"}
          />
          {progress.breakdown.metric != null && (
            <p className="mt-1 text-xs text-ink-3">Driven by metrics</p>
          )}
          {progress.breakdown.projects != null && (
            <p className="mt-1 text-xs text-ink-3">
              Projects {progress.breakdown.projects}% · Tasks {progress.breakdown.tasks ?? "—"}% · Habits{" "}
              {progress.breakdown.habits ?? "—"}%
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel className="mb-0">Metrics</FieldLabel>
            <span className="text-[11px] text-ink-3">Update the current value as you make progress</span>
          </div>
          {goal.metrics.length > 0 && (
            <div className="mb-2 space-y-2">
              {goal.metrics.map((metric, i) => {
                const pct =
                  metric.target > 0
                    ? Math.min(100, Math.round((metric.current / metric.target) * 100))
                    : 0;
                return (
                  <div key={`${metric.label}-${i}`} className="rounded-lg border border-line p-2">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{metric.label}</span>
                      <span className="w-10 text-right text-[12px] font-medium tabular-nums text-ink">
                        {pct}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeMetric(i)}
                        aria-label={`Remove ${metric.label}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
                      <Input
                        type="number"
                        value={metric.current}
                        onChange={(event) =>
                          os.updateGoalMetric(goal.id, i, { current: Number(event.target.value) })
                        }
                        className="h-8 w-20"
                        aria-label={`${metric.label} current`}
                      />
                      <span>/</span>
                      <Input
                        type="number"
                        value={metric.target}
                        onChange={(event) =>
                          os.updateGoalMetric(goal.id, i, { target: Number(event.target.value) })
                        }
                        className="h-8 w-20"
                        aria-label={`${metric.label} target`}
                      />
                      <Input
                        value={metric.unit}
                        onChange={(event) => os.updateGoalMetric(goal.id, i, { unit: event.target.value })}
                        placeholder="Unit"
                        className="h-8 w-20"
                        aria-label={`${metric.label} unit`}
                      />
                    </div>
                    <ProgressBar value={pct} max={100} tone={pct >= 100 ? "success" : "accent"} className="mt-2" />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={metricLabel}
              onChange={(event) => setMetricLabel(event.target.value)}
              placeholder="New metric"
              className="flex-1"
              aria-label="New metric label"
            />
            <Input
              type="number"
              value={metricTarget}
              onChange={(event) => setMetricTarget(Number(event.target.value))}
              className="w-20"
              aria-label="New metric target"
            />
            <Input
              value={metricUnit}
              onChange={(event) => setMetricUnit(event.target.value)}
              placeholder="Unit"
              className="w-16"
              aria-label="New metric unit"
            />
            <Button variant="secondary" size="sm" onClick={addMetric} disabled={!metricLabel.trim()}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <FieldLabel className="mb-0">Link work</FieldLabel>
            <Link2 className="size-3.5 text-ink-3" aria-hidden="true" />
          </div>
          <p className="mb-2 text-[11px] text-ink-3">
            Linked projects, tasks and habits feed this goal&apos;s progress.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Projects",
                  items:
                    allProjects.length === 0
                      ? [{ label: "No projects yet", disabled: true }]
                      : allProjects.map((project) => ({
                          label: project.name,
                          selected: project.goalIds.includes(goal.id),
                          onSelect: () => toggleProject(project.id),
                        })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                >
                  Projects ({linkedProjects.length})
                </button>
              }
            />
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Open tasks",
                  items:
                    allTasks.length === 0
                      ? [{ label: "No open tasks", disabled: true }]
                      : allTasks.map((task) => ({
                          label: task.title,
                          selected: task.goalIds.includes(goal.id),
                          onSelect: () => toggleTask(task.id),
                        })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                >
                  Tasks ({linkedTasks.length})
                </button>
              }
            />
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Habits",
                  items:
                    allHabits.length === 0
                      ? [{ label: "No habits yet", disabled: true }]
                      : allHabits.map((habit) => ({
                          label: habit.title,
                          selected: habit.goalId === goal.id,
                          onSelect: () => toggleHabit(habit.id),
                        })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                >
                  Habits ({linkedHabits.length})
                </button>
              }
            />
          </div>
        </div>

        {linkedProjects.length > 0 && (
          <div>
            <FieldLabel>Linked projects</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {linkedProjects.map((project) => (
                <Badge key={project.id} tone="neutral">
                  {project.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {openTasks.length > 0 && (
          <div>
            <FieldLabel>Open tasks</FieldLabel>
            <div className="space-y-1">
              {openTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm text-ink-2">
                  {task.status === "done" ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : (
                    <Circle className="size-3.5 text-ink-3" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {linkedHabits.length > 0 && (
          <div>
            <FieldLabel>Habits</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {linkedHabits.map((habit) => (
                <Badge key={habit.id} tone="accent">
                  {habit.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
