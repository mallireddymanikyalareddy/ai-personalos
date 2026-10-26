"use client";

import * as React from "react";

import { Archive, Flag, Hash, Plus, Timer, Trash2, X } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  formatFullDate,
  selectTaskChildren,
  sortTasks,
  startOfDay,
  addDays,
  type ID,
  type Priority,
  type TaskStatus,
} from "@personalos/core";

import { useAppState, useOS } from "@/store/use-os";
import { cn } from "@/lib/cn";

const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  open: "Open",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  inbox: "neutral",
  open: "neutral",
  in_progress: "accent",
  review: "warning",
  done: "success",
  cancelled: "outline",
  archived: "outline",
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
  { value: 4, label: "Urgent" },
];

const ESTIMATE_OPTIONS = [15, 30, 45, 60, 90, 120, 240];

function toDateValue(ts: number | null): string {
  if (ts == null) return "";
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateValue(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

export interface TaskDetailSheetProps {
  taskId: ID | null;
  onClose: () => void;
}

export function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const task = taskId ? (state.tasks[taskId] ?? null) : null;

  const [titleDraft, setTitleDraft] = React.useState("");
  const [subtaskDraft, setSubtaskDraft] = React.useState("");
  const [tagDraft, setTagDraft] = React.useState("");
  const [newProjectName, setNewProjectName] = React.useState("");
  const [projectSelectKey, setProjectSelectKey] = React.useState(0);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const lastTaskIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!task) {
      lastTaskIdRef.current = null;
      return;
    }
    if (lastTaskIdRef.current === task.id) return;
    lastTaskIdRef.current = task.id;
    setTitleDraft(task.title);
    setSubtaskDraft("");
    setTagDraft("");
    setNewProjectName("");
    setConfirmDelete(false);
    setProjectSelectKey((key) => key + 1);
  }, [task]);

  if (!task) {
    return <Modal open={false} onClose={onClose}>{null}</Modal>;
  }

  const activeFocus = os.activeFocusSession();

  const projects = Object.values(state.projects).sort((a, b) => a.name.localeCompare(b.name));
  const now = Date.now();
  const children = sortTasks(selectTaskChildren(state, task.id), "smart", Date.now());

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(task.title);
      return;
    }
    if (next !== task.title) os.updateTask(task.id, { title: next });
  };

  const setDue = (ts: number | null) => {
    os.updateTask(task.id, { dueAt: ts });
    setConfirmDelete(false);
  };
  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, "");
    if (!tag || task.tags.includes(tag)) {
      setTagDraft("");
      return;
    }
    os.updateTask(task.id, { tags: [...task.tags, tag] });
    setTagDraft("");
  };

  const removeTag = (tag: string) => {
    os.updateTask(task.id, { tags: task.tags.filter((item) => item !== tag) });
  };

  const addSubtask = () => {
    const title = subtaskDraft.trim();
    if (!title) return;
    os.addSubtask(task.id, title);
    setSubtaskDraft("");
  };

  const addProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const project = os.addProject(name);
    os.updateTask(task.id, { projectId: project.id });
    setNewProjectName("");
    setProjectSelectKey((key) => key + 1);
  };

  const handleProjectChange = (value: string) => {
    if (value === "__new__") return;
    setNewProjectName("");
    os.updateTask(task.id, { projectId: value || null });
  };

  const archive = () => {
    os.archiveTask(task.id);
    toast("Task archived", {
      action: {
        label: "Undo",
        onClick: () => os.updateTask(task.id, { status: "open" }),
      },
    });
    onClose();
  };

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    os.deleteTask(task.id);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Task"
      description={`Created ${formatFullDate(task.createdAt)} · via ${task.source}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={archive}>
              <Archive className="size-4" aria-hidden="true" />
              Archive
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                os.startFocusSession({ startedAt: Date.now(), taskId: task.id, mode: "countdown", plannedMin: task.estimateMin ?? 25 });
                toast("Focus started — open Focus to run the timer", { tone: "success" });
                onClose();
              }}
              disabled={activeFocus != null}
              title={activeFocus != null ? "A focus session is already running" : undefined}
            >
              <Timer className="size-4" aria-hidden="true" />
              Start Focus
            </Button>
          </div>
          <Button variant="danger" size="sm" onClick={remove}>
            <Trash2 className="size-4" aria-hidden="true" />
            {confirmDelete ? "Click again to delete" : "Delete"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[task.status]}>{STATUS_LABELS[task.status]}</Badge>
          {task.scheduledAt != null && (
            <Badge tone="neutral">Scheduled {formatFullDate(task.scheduledAt)}</Badge>
          )}
        </div>

        <div>
          <Input
            data-autofocus
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTitle();
              }
            }}
            aria-label="Task title"
            className="h-10 text-[15px] font-medium"
          />
        </div>

        <div>
          <FieldLabel className="mb-1.5">Quick dates</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setDue(startOfDay(now))}>
              Today
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDue(startOfDay(addDays(now, 1)))}>
              Tomorrow
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDue(startOfDay(addDays(now, 7)))}>
              Next week
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDue(null)} disabled={task.dueAt == null}>
              Clear date
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="task-due" className="mb-1.5">
              Due date
            </FieldLabel>
            <Input
              id="task-due"
              type="date"
              value={toDateValue(task.dueAt)}
              onChange={(event) => setDue(fromDateValue(event.target.value))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="task-scheduled" className="mb-1.5">
              Scheduled for
            </FieldLabel>
            <Input
              id="task-scheduled"
              type="date"
              value={toDateValue(task.scheduledAt)}
              onChange={(event) =>
                os.updateTask(task.id, { scheduledAt: fromDateValue(event.target.value) })
              }
            />
          </div>
        </div>

        <div>
          <FieldLabel className="mb-1.5">Priority</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_OPTIONS.map((option) => {
              const active = task.priority === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => os.updateTask(task.id, { priority: option.value })}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2",
                  )}
                >
                  {option.value > 0 && (
                    <Flag className={cn("size-3", `text-p${option.value}`)} aria-hidden="true" />
                  )}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="task-project" className="mb-1.5">
              Project
            </FieldLabel>
            <Select
              key={projectSelectKey}
              id="task-project"
              value={newProjectName ? "__new__" : (task.projectId ?? "")}
              onChange={(event) => {
                if (event.target.value === "__new__") {
                  setNewProjectName(" ");
                  return;
                }
                handleProjectChange(event.target.value);
              }}
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              <option value="__new__">New project…</option>
            </Select>
            {newProjectName !== "" && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  autoFocus
                  value={newProjectName === " " ? "" : newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addProject();
                    }
                    if (event.key === "Escape") {
                      setNewProjectName("");
                      setProjectSelectKey((key) => key + 1);
                    }
                  }}
                  placeholder="Project name"
                  aria-label="New project name"
                  className="h-8"
                />
                <Button size="sm" variant="primary" onClick={addProject}>
                  Add
                </Button>
              </div>
            )}
          </div>
          <div>
            <FieldLabel htmlFor="task-estimate" className="mb-1.5">
              Estimate
            </FieldLabel>
            <Select
              id="task-estimate"
              value={task.estimateMin?.toString() ?? ""}
              onChange={(event) =>
                os.updateTask(task.id, {
                  estimateMin: event.target.value ? Number(event.target.value) : null,
                })
              }
            >
              <option value="">No estimate</option>
              {ESTIMATE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <FieldLabel className="mb-1.5">Tags</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-surface-2 pl-2 pr-1 text-xs font-medium text-ink-2"
              >
                <Hash className="size-3 text-ink-3" aria-hidden="true" />
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="grid size-5 place-items-center rounded text-ink-3 hover:bg-surface-3 hover:text-ink"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
            <Input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="+ tag"
              aria-label="Add tag"
              className="h-7 w-24 min-w-16 px-2 text-xs"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="task-notes" className="mb-1.5">
            Notes
          </FieldLabel>
          <Textarea
            id="task-notes"
            value={task.notes}
            onChange={(event) => os.updateTask(task.id, { notes: event.target.value })}
            placeholder="Details, links, acceptance criteria…"
            className="min-h-24"
          />
        </div>

        <div>
          <FieldLabel className="mb-1.5">Subtasks</FieldLabel>
          {children.length > 0 && (
            <ul className="mb-2 space-y-1">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2"
                >
                  <Checkbox
                    checked={child.status === "done"}
                    onChange={(checked) =>
                      checked ? os.completeTask(child.id) : os.reopenTask(child.id)
                    }
                    label={`Complete ${child.title}`}
                    size="sm"
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm text-ink",
                      child.status === "done" && "text-ink-3 line-through",
                    )}
                  >
                    {child.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => os.deleteTask(child.id)}
                    aria-label={`Delete subtask ${child.title}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-3 hover:text-danger"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addSubtask();
            }}
            className="flex items-center gap-2"
          >
            <Plus className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
            <input
              value={subtaskDraft}
              onChange={(event) => setSubtaskDraft(event.target.value)}
              placeholder="Add a subtask…"
              aria-label="Add a subtask"
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
            />
          </form>
        </div>
      </div>
    </Modal>
  );
}
