"use client";

import * as React from "react";

import type { ProjectStatus, ProjectWipLimits } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

import { useAppState } from "@/store/use-os";

const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const COLORS = [
  { value: "var(--accent)", label: "Accent" },
  { value: "var(--info)", label: "Blue" },
  { value: "var(--chart-5)", label: "Purple" },
  { value: "var(--warning)", label: "Amber" },
  { value: "var(--success)", label: "Green" },
];

const WIP_COLUMNS: Array<{ key: keyof ProjectWipLimits; label: string }> = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export interface ProjectFormInput {
  name: string;
  summary: string;
  status: ProjectStatus;
  color: string | null;
  goalIds: string[];
  wipLimits: ProjectWipLimits;
}

export interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: ProjectFormInput) => void;
  initial?: ProjectFormInput;
}

export function ProjectDialog({ open, onClose, onSave, initial }: ProjectDialogProps) {
  const state = useAppState();
  const [name, setName] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("active");
  const [color, setColor] = React.useState<string | null>(null);
  const [goalIds, setGoalIds] = React.useState<string[]>([]);
  const [wipLimits, setWipLimits] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setSummary(initial?.summary ?? "");
    setStatus(initial?.status ?? "active");
    setColor(initial?.color ?? null);
    setGoalIds(initial?.goalIds ?? []);
    const limits: Record<string, string> = {};
    for (const column of WIP_COLUMNS) {
      const value = initial?.wipLimits?.[column.key];
      if (value != null) limits[column.key] = String(value);
    }
    setWipLimits(limits);
  }, [open, initial]);

  const goals = Object.values(state.goals).filter((goal) => goal.status === "active");
  const canSave = name.trim().length > 0;

  const toggleGoal = (id: string) => {
    setGoalIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit project" : "New project"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const limits: ProjectWipLimits = {};
              for (const column of WIP_COLUMNS) {
                const value = Number(wipLimits[column.key]);
                if (Number.isFinite(value) && value > 0) limits[column.key] = Math.round(value);
              }
              onSave({
                name: name.trim(),
                summary: summary.trim(),
                status,
                color,
                goalIds,
                wipLimits: limits,
              });
              onClose();
            }}
            disabled={!canSave}
          >
            {initial ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="project-name">Name</FieldLabel>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Website redesign, Product launch…"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="project-desc">Description</FieldLabel>
          <Textarea
            id="project-desc"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What is this project about?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="project-status">Status</FieldLabel>
            <select
              id="project-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {STATUSES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Colour</FieldLabel>
            <div className="flex items-center gap-1.5" role="group" aria-label="Project colour">
              <button
                type="button"
                aria-label="No colour"
                aria-pressed={color == null}
                onClick={() => setColor(null)}
                className={cn(
                  "grid size-7 place-items-center rounded-lg border text-[10px]",
                  color == null ? "border-accent text-accent-ink" : "border-line text-ink-3",
                )}
              >
                –
              </button>
              {COLORS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  aria-label={entry.label}
                  aria-pressed={color === entry.value}
                  onClick={() => setColor(entry.value)}
                  className={cn(
                    "size-7 rounded-lg border-2 transition-transform",
                    color === entry.value ? "scale-110 border-ink" : "border-transparent",
                  )}
                  style={{ backgroundColor: entry.value }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>WIP limits</FieldLabel>
          <p className="mb-2 text-[11px] text-ink-3">
            Optional caps per board column. Leave blank for no limit.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WIP_COLUMNS.map((column) => (
              <label key={column.key} className="block">
                <span className="mb-1 block text-[11px] text-ink-3">{column.label}</span>
                <Input
                  type="number"
                  min={1}
                  value={wipLimits[column.key] ?? ""}
                  onChange={(event) =>
                    setWipLimits((current) => ({ ...current, [column.key]: event.target.value }))
                  }
                  placeholder="None"
                  aria-label={`${column.label} WIP limit`}
                  className="h-8"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Linked goals</FieldLabel>
          {goals.length === 0 ? (
            <p className="text-xs text-ink-3">
              No active goals yet. Create one on the Goals page to link this project.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {goals.map((goal) => {
                const active = goalIds.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleGoal(goal.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-line text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    {goal.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
