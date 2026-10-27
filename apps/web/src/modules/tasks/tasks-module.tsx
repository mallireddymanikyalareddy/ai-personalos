"use client";

import * as React from "react";

import { LifeAreaChip, LifeAreaFilter } from "@/components/life-area/life-area";

function BoardLifeArea({ taskId }: { taskId: string }) {
  const state = useAppState();
  return <LifeAreaChip lifeAreaId={state.tasks[taskId]?.lifeAreaId} />;
}

import { CheckCircle2, Filter, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import {
  addDays,
  startOfDay,
  startOfWeek,
  type ID,
  type Priority,
  type TaskStatus,
  type TaskStatusSegment,
  type TaskView,
} from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAppState, useOS } from "@/store/use-os";

import { seedSampleTasks } from "./sample-tasks";
import { TaskStats } from "./tasks-stats";
import { TaskTable } from "./tasks-table";
import { TaskAssistant } from "./tasks-assistant";
import { PriorityDonut, ProjectBars, StatusBars, StatusLegend } from "./tasks-charts";
import { UpcomingDeadlines } from "./tasks-deadlines";
import { TaskInsightsPanel } from "./tasks-insights";
import { QuickAdd } from "./tasks-quick-add";
import { TASK_VIEW_OPTIONS } from "./tasks-meta";
import { TaskDetailSheet } from "./task-detail-sheet";
import { cn } from "@/lib/cn";

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "All Priority" },
  { value: 3, label: "High" },
  { value: 2, label: "Medium" },
  { value: 1, label: "Low" },
  { value: 4, label: "Urgent" },
];

const PROJECT_OPTIONS_PLACEHOLDER = "All Projects";

type SortKey = "due" | "priority" | "title" | "created";

type TaskPreset = {
  name: string;
  view: TaskView;
  status: TaskStatus | "all";
  priority: Priority | "all";
  project: ID | "all";
  search: string;
  showCompleted: boolean;
  includeArchived: boolean;
  sort: SortKey;
};

type BoardColumnKey = "notStarted" | "inProgress" | "review" | "done";

const PRESET_KEY = "personalos.tasks.presets";

function loadPresets(): TaskPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESET_KEY);
    return raw ? (JSON.parse(raw) as TaskPreset[]) : [];
  } catch {
    return [];
  }
}

function savePresets(next: TaskPreset[]): void {
  try {
    window.localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: presets stay in memory for this session
  }
}

const BULK_PRIORITIES: { value: Priority; label: string }[] = [
  { value: 4, label: "Urgent" },
  { value: 3, label: "High" },
  { value: 2, label: "Medium" },
  { value: 1, label: "Low" },
  { value: 0, label: "None" },
];


const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
  { value: "created", label: "Newest" },
];

export function TasksModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [view, setView] = React.useState<TaskView>("list");
  const [status, setStatus] = React.useState<TaskStatus | "all">("all");
  const [priority, setPriority] = React.useState<Priority | "all">("all");
  const [project, setProject] = React.useState<ID | "all">("all");
  const [search, setSearch] = React.useState("");
  const [quickText, setQuickText] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [detailId, setDetailId] = React.useState<ID | null>(null);
  const [period, setPeriod] = React.useState("This Month");
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [lifeAreaFilter, setLifeAreaFilter] = React.useState<ID | "all">("all");
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [sort, setSort] = React.useState<SortKey>("due");
  const [presets, setPresets] = React.useState<TaskPreset[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);

  React.useEffect(() => {
    setPresets(loadPresets());
  }, []);

  React.useEffect(() => {
    setConfirmBulkDelete(false);
  }, [selected]);

  const now = Date.now();
  const dashboard = os.taskDashboard(
    {
      view,
      status,
      priority,
      project,
      search,
      showCompleted,
      includeArchived,
      currentUserId: state.profile.id,
    } as Parameters<typeof os.taskDashboard>[0],
    now,
  );
  const projects = Object.values(os.getState().projects);

  const rows = React.useMemo(() => {
    const copy = [...dashboard.rows];
    switch (sort) {
      case "priority":
        copy.sort((a, b) => b.priority - a.priority || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
        break;
      case "title":
        copy.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "created":
        copy.sort(
          (a, b) => (state.tasks[b.id]?.createdAt ?? 0) - (state.tasks[a.id]?.createdAt ?? 0),
        );
        break;
      default:
        copy.sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
    }
    return lifeAreaFilter === "all" ? copy : copy.filter((row) => state.tasks[row.id]?.lifeAreaId === lifeAreaFilter);
  }, [dashboard.rows, sort, state.tasks, lifeAreaFilter]);

  const periodRange = React.useMemo(() => {
    const today = startOfDay(now);
    if (period === "This Week") {
      const start = startOfWeek(today, state.settings.weekStart === 0 ? 0 : 1);
      return { from: start, to: addDays(start, 7) };
    }
    const first = new Date(today);
    first.setDate(1);
    if (period === "Last Month") first.setMonth(first.getMonth() - 1);
    const from = first.getTime();
    const next = new Date(first);
    next.setMonth(next.getMonth() + 1);
    return { from, to: next.getTime() };
  }, [period, now, state.settings.weekStart]);

  const periodTasks = React.useMemo(
    () =>
      Object.values(state.tasks).filter(
        (task) => task.createdAt >= periodRange.from && task.createdAt < periodRange.to,
      ),
    [state.tasks, periodRange],
  );

  const periodDone = periodTasks.filter((task) => task.status === "done").length;
  const periodRate = periodTasks.length > 0 ? Math.round((periodDone / periodTasks.length) * 100) : 0;
  const periodSegments: TaskStatusSegment[] = [
    { key: "completed", label: "Completed", count: periodDone, color: "var(--success)" },
    {
      key: "inProgress",
      label: "In Progress",
      count: periodTasks.filter((task) => task.status === "in_progress").length,
      color: "var(--info)",
    },
    {
      key: "notStarted",
      label: "Not Started",
      count: periodTasks.filter((task) => task.status === "open" || task.status === "inbox").length,
      color: "var(--chart-8)",
    },
    {
      key: "overdue",
      label: "Overdue",
      count: periodTasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "cancelled" &&
          task.dueAt != null &&
          task.dueAt < now,
      ).length,
      color: "var(--danger)",
    },
  ];

  const openDetail = (id: ID) => setDetailId(id);

  const toggleRow = (id: ID) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)),
    );
  };

  const complete = (id: ID) => {
    os.completeTask(id);
    toast("Task completed");
  };

  const reopen = (id: ID) => {
    os.reopenTask(id);
    toast("Task reopened");
  };

  const remove = (id: ID) => {
    os.deleteTask(id);
    toast("Task deleted");
  };

  const clearSelection = () => {
    setSelected(new Set());
    setConfirmBulkDelete(false);
  };

  const plural = (count: number) => `${count} task${count === 1 ? "" : "s"}`;

  const forEachSelected = (fn: (id: ID) => void): number => {
    let count = 0;
    for (const id of selected) {
      if (!state.tasks[id]) continue;
      fn(id);
      count += 1;
    }
    return count;
  };

  const snoozeTask = (id: ID) => {
    const task = state.tasks[id];
    if (!task) return;
    os.updateTask(id, { dueAt: addDays(Math.max(task.dueAt ?? now, now), 1) });
  };

  const duplicateTask = (id: ID) => {
    const task = state.tasks[id];
    if (!task) return;
    os.addTask({
      title: `${task.title} (copy)`,
      notes: task.notes,
      priority: task.priority,
      dueAt: task.dueAt,
      scheduledAt: task.scheduledAt,
      estimateMin: task.estimateMin,
      projectId: task.projectId,
      tags: [...task.tags],
      status: "open",
    });
    toast("Task duplicated");
  };

  const moveToColumn = (id: ID, column: BoardColumnKey) => {
    const task = state.tasks[id];
    if (!task) return;
    if (column === "done") {
      if (task.status !== "done") os.completeTask(id);
      toast("Task completed");
      return;
    }
    if (task.status === "done") os.reopenTask(id);
    const status: TaskStatus = column === "notStarted" ? "open" : column === "inProgress" ? "in_progress" : "review";
    os.updateTask(id, { status });
  };

  const bulkComplete = () => {
    const count = forEachSelected((id) => {
      if (state.tasks[id]?.status !== "done") os.completeTask(id);
    });
    clearSelection();
    toast(`Completed ${plural(count)}`);
  };

  const bulkSetPriority = (priority: Priority) => {
    const count = forEachSelected((id) => os.updateTask(id, { priority }));
    toast(`Updated priority on ${plural(count)}`);
  };

  const bulkSetProject = (projectId: ID | null) => {
    const count = forEachSelected((id) => os.updateTask(id, { projectId }));
    toast(`Moved ${plural(count)}`);
  };

  const bulkSnooze = () => {
    const count = forEachSelected(snoozeTask);
    toast(`Snoozed ${plural(count)} to tomorrow`);
  };

  const bulkArchive = () => {
    const previous = new Map<ID, TaskStatus>();
    forEachSelected((id) => {
      previous.set(id, state.tasks[id]!.status);
      os.archiveTask(id);
    });
    clearSelection();
    toast(`Archived ${plural(previous.size)}`, {
      action: {
        label: "Undo",
        onClick: () => {
          for (const [id, status] of previous) os.updateTask(id, { status });
          toast("Archive undone");
        },
      },
    });
  };

  const bulkDelete = () => {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    const count = forEachSelected((id) => os.deleteTask(id));
    clearSelection();
    toast(`Deleted ${plural(count)}`);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Name this view");
    if (name == null || name.trim().length === 0) return;
    const preset: TaskPreset = {
      name: name.trim(),
      view,
      status,
      priority,
      project,
      search,
      showCompleted,
      includeArchived,
      sort,
    };
    const next = [...presets.filter((entry) => entry.name !== preset.name), preset];
    setPresets(next);
    savePresets(next);
    toast(`Saved view "${preset.name}"`);
  };

  const applyPreset = (preset: TaskPreset) => {
    setView(preset.view);
    setStatus(preset.status);
    setPriority(preset.priority);
    setProject(preset.project);
    setSearch(preset.search);
    setShowCompleted(preset.showCompleted);
    setIncludeArchived(preset.includeArchived);
    setSort(preset.sort);
  };

  const deletePreset = (name: string) => {
    const next = presets.filter((entry) => entry.name !== name);
    setPresets(next);
    savePresets(next);
    toast(`Deleted view "${name}"`);
  };

  const quickAdd = (kind: "task" | "project" | "reminder") => {
    if (kind === "task") {
      if (quickText.trim().length === 0) {
        toast("Type something to add first");
        return;
      }
      os.addTask({ title: quickText.trim() });
      setQuickText("");
      toast("Task added");
      return;
    }
    if (kind === "project") {
      const name = quickText.trim();
      if (name.length === 0) {
        toast("Type a project name first");
        return;
      }
      os.addProject({ name });
      setQuickText("");
      toast("Project added");
      return;
    }
    if (kind === "reminder") {
      const text = quickText.trim();
      if (text.length === 0) {
        toast("Type a reminder first");
        return;
      }
      const task = os.addTask({ title: text });
      os.addReminder(task.id, { at: now + 3_600_000 });
      setQuickText("");
      toast("Reminder added for 1 hour from now");
    }
  };

  const activeTaskId = activeIndex >= 0 && activeIndex < rows.length ? rows[activeIndex]!.id : null;

  React.useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(rows.length - 1);
  }, [rows.length, activeIndex]);

  const onKey = (event: KeyboardEvent) => {
    if (view !== "list" && view !== "mine") return;
    if (detailId != null) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    const key = event.key.toLowerCase();
    if (key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(rows.length - 1, index + 1));
    } else if (key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (key === "x" && activeTaskId) {
      toggleRow(activeTaskId);
    } else if (key === "e" && activeTaskId) {
      const row = rows.find((entry) => entry.id === activeTaskId);
      if (row?.done) reopen(activeTaskId);
      else complete(activeTaskId);
    } else if (key === "enter" && activeTaskId) {
      openDetail(activeTaskId);
    } else if (key === "/") {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('input[aria-label="Search tasks"]')?.focus();
    }
  };

  const keyHandlerRef = React.useRef(onKey);

  React.useEffect(() => {
    keyHandlerRef.current = onKey;
  });

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const ask = (value: string) => {
    setQuestion(value);
    const text = value.trim().toLowerCase();
    if (text.length === 0) {
      setAnswer(null);
      return;
    }
    const done = dashboard.stats.find((tile) => tile.id === "completed")?.value ?? 0;
    const dueToday = dashboard.stats.find((tile) => tile.id === "dueToday")?.value ?? 0;
    const overdue = dashboard.stats.find((tile) => tile.id === "overdue")?.value ?? 0;
    const inProgress = dashboard.stats.find((tile) => tile.id === "inProgress")?.value ?? 0;

    if (text.includes("priorit")) {
      const next = dashboard.upcoming[0];
      setAnswer(
        next
          ? `Start with “${next.title}” — it is your next deadline (${next.dueLabel}). You have ${overdue} overdue and ${inProgress} in progress.`
          : "You have no open deadlines — clear day to plan ahead.",
      );
      return;
    }
    if (text.includes("overdue") || text.includes("urgent")) {
      setAnswer(
        overdue === 0
          ? "Nothing is overdue right now. Well done."
          : `${overdue} task${overdue === 1 ? " is" : "s are"} overdue. Tackle the oldest one first to stop the pile-up.`,
      );
      return;
    }
    if (text.includes("today")) {
      setAnswer(`You have ${dueToday} task${dueToday === 1 ? "" : "s"} due today and ${done} completed so far.`);
      return;
    }
    setAnswer(
      `You are tracking ${dashboard.total} tasks with a ${dashboard.completionRate}% completion rate. ${done} completed, ${inProgress} in progress, ${overdue} overdue.`,
    );
  };

  const prioritizeNow = () => {
    const ordered = [...dashboard.rows].sort(
      (a, b) => b.priority - a.priority || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity),
    );
    const next = ordered.find((row) => !row.done);
    setAnswer(
      next
        ? `Highest priority open task: “${next.title}” (${next.priorityLabel}, ${next.dueLabel}).`
        : "All done — nothing left to prioritize.",
    );
  };

  const breakDown = () => {
    const next = dashboard.upcoming[0];
    setAnswer(
      next
        ? `Break “${next.title}” into: 1) gather context, 2) draft the first version, 3) review and ship.`
        : "Add a task with a due date first, then ask me to break it down.",
    );
  };

  const suggestNext = () => {
    const next = dashboard.rows.filter((row) => !row.done)[0];
    setAnswer(
      next
        ? `Next step: “${next.title}” — ${next.priorityLabel} priority, due ${next.dueLabel}.`
        : "You have no open tasks. Add one or review what you finished.",
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-4">
        <PageHeader
          icon={CheckCircle2}
          title="Tasks"
          subtitle="Capture, organize and complete your tasks. Turn plans into progress."
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  os.addTask({ title: "New task" });
                  toast("Task added — open it to edit");
                }}
                data-testid="tasks-add"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Task
              </Button>
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Tasks",
                    items: [
                      {
                        label: "Load sample tasks",
                        onSelect: () => {
                          const ids = seedSampleTasks(os);
                          toast(`Added ${ids.length} sample tasks — edit or delete them any time`);
                        },
                      },
                      { label: "Go to analytics", onSelect: () => window.location.assign("/insights") },
                      { label: "Open planner", onSelect: () => window.location.assign("/planner") },
                    ],
                  },
                ]}
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Task page options">
                    <span aria-hidden="true">&#8942;</span>
                  </Button>
                }
              />
            </>
          }
        />

        <TaskStats stats={dashboard.stats} />

        <div className="flex flex-wrap items-center justify-between gap-2" data-testid="tasks-filters">
          <div className="flex flex-wrap items-center gap-1.5">
            {TASK_VIEW_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`tasks-view-${option.value}`}
                  onClick={() => setView(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Saved views",
                  items:
                    presets.length === 0
                      ? [{ label: "No saved views yet", disabled: true }]
                      : presets.map((preset) => ({
                          label: preset.name,
                          onSelect: () => applyPreset(preset),
                        })),
                },
                {
                  label: "Manage",
                  items: [
                    { label: "Save current view…", onSelect: saveCurrentView },
                    ...presets.map((preset) => ({
                      label: `Delete "${preset.name}"`,
                      danger: true,
                      onSelect: () => deletePreset(preset.name),
                    })),
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  aria-label="Saved views"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                >
                  Views
                </button>
              }
            />
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Project",
                  items: [
                    { label: PROJECT_OPTIONS_PLACEHOLDER, selected: project === "all", onSelect: () => setProject("all") },
                    ...projects.map((entry) => ({
                      label: entry.name,
                      selected: project === entry.id,
                      onSelect: () => setProject(entry.id),
                    })),
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label="Filter by project"
                >
                  {project === "all"
                    ? PROJECT_OPTIONS_PLACEHOLDER
                    : (projects.find((entry) => entry.id === project)?.name ?? PROJECT_OPTIONS_PLACEHOLDER)}
                </button>
              }
            />
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Priority",
                  items: PRIORITY_OPTIONS.map((option) => ({
                    label: option.label,
                    selected: priority === option.value,
                    onSelect: () => setPriority(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label="Filter by priority"
                >
                  {PRIORITY_OPTIONS.find((option) => option.value === priority)?.label}
                </button>
              }
            />
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Status",
                  items: STATUS_OPTIONS.map((option) => ({
                    label: option.label,
                    selected: status === option.value,
                    onSelect: () => setStatus(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label="Filter by status"
                >
                  {STATUS_OPTIONS.find((option) => option.value === status)?.label}
                </button>
              }
            />
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="w-40 pl-8"
              />
            </div>
            <DropdownMenu
              align="start"
              sections={[
                {
                  label: "Sort by",
                  items: SORT_OPTIONS.map((option) => ({
                    label: option.label,
                    selected: sort === option.value,
                    onSelect: () => setSort(option.value),
                  })),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  aria-label="Sort tasks"
                >
                  {SORT_OPTIONS.find((option) => option.value === sort)?.label}
                </button>
              }
            />
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Display",
                  items: [
                    {
                      label: "Show completed",
                      selected: showCompleted,
                      onSelect: () => setShowCompleted((value) => !value),
                    },
                    {
                      label: "Include archived",
                      selected: includeArchived,
                      onSelect: () => setIncludeArchived((value) => !value),
                    },
                  ],
                },
              ]}
              trigger={
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label="Display options"
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                </button>
              }
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPriority("all");
                setStatus("all");
                setProject("all");
                setShowCompleted(false);
                setIncludeArchived(false);
              }}
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Reset filters"
            >
              <Filter className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {selected.size > 0 && (view === "list" || view === "mine" || view === "board") ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
            <span className="text-xs font-medium text-accent-ink">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Set priority",
                    items: BULK_PRIORITIES.map((option) => ({
                      label: option.label,
                      onSelect: () => bulkSetPriority(option.value),
                    })),
                  },
                ]}
                trigger={
                  <Button variant="secondary" size="sm">
                    Priority
                  </Button>
                }
              />
              <DropdownMenu
                align="end"
                sections={[
                  {
                    label: "Move to project",
                    items: [
                      { label: "No project", onSelect: () => bulkSetProject(null) },
                      ...projects.map((entry) => ({
                        label: entry.name,
                        onSelect: () => bulkSetProject(entry.id),
                      })),
                    ],
                  },
                ]}
                trigger={
                  <Button variant="secondary" size="sm">
                    Project
                  </Button>
                }
              />
              <Button variant="ghost" size="sm" onClick={bulkSnooze}>
                Snooze
              </Button>
              <Button variant="secondary" size="sm" onClick={bulkComplete}>
                Complete
              </Button>
              <Button variant="ghost" size="sm" onClick={bulkArchive}>
                Archive
              </Button>
              <Button variant="danger" size="sm" onClick={bulkDelete}>
                {confirmBulkDelete ? "Click again to delete" : "Delete"}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="size-3.5" aria-hidden="true" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {dashboard.total > 0 ? <LifeAreaFilter value={lifeAreaFilter} onChange={setLifeAreaFilter} /> : null}

        {dashboard.total === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No tasks yet"
            description="Capture a task, or load the sample set to explore the dashboard."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    os.addTask({ title: "First task" });
                    toast("Task added");
                  }}
                >
                  Add a task
                </Button>
                <Button variant="secondary" onClick={() => seedSampleTasks(os)}>
                  Load sample tasks
                </Button>
              </div>
            }
          />
        ) : view === "list" || view === "mine" ? (
          <TaskTable
            rows={rows}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onOpen={openDetail}
            onComplete={complete}
            onReopen={reopen}
            onEdit={openDetail}
            onDelete={remove}
            onDuplicate={duplicateTask}
            onSnooze={snoozeTask}
            activeId={activeTaskId}
          />
        ) : view === "board" ? (
          <TaskBoard
            rows={rows}
            selected={selected}
            onToggleRow={toggleRow}
            onOpen={openDetail}
            onComplete={complete}
            onReopen={reopen}
            onMove={moveToColumn}
          />
        ) : view === "calendar" ? (
          <TaskCalendar rows={rows} now={now} onOpen={openDetail} />
        ) : (
          <TaskTimeline rows={rows} now={now} onOpen={openDetail} />
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <section
            aria-label="Tasks by Project"
            data-testid="tasks-by-project"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Tasks by Project</h2>
              <a href="/work" className="text-xs font-medium text-accent-ink hover:underline">
                View all
              </a>
            </header>
            <ProjectBars rows={dashboard.byProject} />
          </section>

          <section
            aria-label="Priority Breakdown"
            data-testid="tasks-priority-breakdown"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Priority Breakdown</h2>
            </header>
            <PriorityDonut rows={dashboard.byPriority} total={dashboard.total} />
          </section>

          <section
            aria-label="Status Breakdown"
            data-testid="tasks-status-breakdown"
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Status Breakdown</h2>
            </header>
            <StatusBars segments={dashboard.byStatus} />
            <StatusLegend segments={dashboard.byStatus} />
          </section>
        </div>
      </div>

      <aside className="space-y-4" aria-label="Task tools">
        <TaskAssistant
          stats={dashboard.stats}
          question={question}
          answer={answer}
          onAsk={ask}
          onCreateFromText={(text) => {
            os.addTask({ title: text });
            toast("Task created from text");
            setAnswer(`Created “${text}”.`);
          }}
          onBreakDown={breakDown}
          onPrioritize={prioritizeNow}
          onSuggest={suggestNext}
          onOpenAssistant={() => window.location.assign("/ai")}
        />
        <QuickAdd text={quickText} onChange={setQuickText} onAdd={quickAdd} />
        <UpcomingDeadlines rows={dashboard.upcoming} onOpen={openDetail} />
        <TaskInsightsPanel
          rate={periodRate}
          segments={periodSegments}
          insight={dashboard.insight}
          period={period}
          onPeriodChange={setPeriod}
        />
      </aside>

      <TaskDetailSheet taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function TaskBoard({
  rows,
  selected,
  onToggleRow,
  onOpen,
  onComplete,
  onReopen,
  onMove,
}: {
  rows: import("@personalos/core").TaskTableRow[];
  selected: Set<string>;
  onToggleRow: (id: ID) => void;
  onOpen: (id: ID) => void;
  onComplete: (id: ID) => void;
  onReopen: (id: ID) => void;
  onMove: (id: ID, column: BoardColumnKey) => void;
}) {
  type Row = import("@personalos/core").TaskTableRow;
  const [dragOver, setDragOver] = React.useState<BoardColumnKey | null>(null);

  const columns: { key: BoardColumnKey; label: string; match: (row: Row) => boolean }[] = [
    { key: "notStarted", label: "Not Started", match: (row) => row.status === "open" || row.status === "inbox" },
    { key: "inProgress", label: "In Progress", match: (row) => row.status === "in_progress" },
    { key: "review", label: "In Review", match: (row) => row.status === "review" },
    { key: "done", label: "Completed", match: (row) => row.done },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4" data-testid="tasks-board">
      {columns.map((column) => {
        const items = rows.filter(column.match);
        return (
          <section
            key={column.key}
            aria-label={column.label}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOver(column.key);
            }}
            onDragLeave={() => setDragOver((current) => (current === column.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(null);
              const id = event.dataTransfer.getData("text/lifeos-task");
              if (id) onMove(id, column.key);
            }}
            className={cn(
              "rounded-2xl border border-line bg-surface-2/60 p-3 transition-colors",
              dragOver === column.key && "border-accent bg-accent-soft/50",
            )}
          >
            <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-3">
              {column.label}
              <span className="tabular-nums">{items.length}</span>
            </h3>
            <ul className="space-y-2">
              {items.map((row) => (
                <li key={row.id}>
                  <div
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/lifeos-task", row.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-xl border border-line bg-surface p-3 shadow-card active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onChange={() => onToggleRow(row.id)}
                        label={`Select ${row.title}`}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={() => onOpen(row.id)}
                        className="text-left text-[13px] font-medium text-ink hover:text-accent-ink hover:underline"
                      >
                        {row.title}
                      </button>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
                      {row.dueLabel}
                      <BoardLifeArea taskId={row.id} />
                    </p>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => (row.done ? onReopen(row.id) : onComplete(row.id))}
                        className="text-[11px] font-medium text-accent-ink hover:underline"
                      >
                        {row.done ? "Reopen" : "Complete"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TaskCalendar({
  rows,
  now,
  onOpen,
}: {
  rows: import("@personalos/core").TaskTableRow[];
  now: number;
  onOpen: (id: ID) => void;
}) {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1, 0);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card" data-testid="tasks-calendar">
      <div className="grid grid-cols-7 gap-px bg-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label} className="bg-surface-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-line">
        {days.map((day) => {
          const dayStart = day.getTime();
          const items = rows.filter((row) => row.dueAt != null && new Date(row.dueAt).toDateString() === day.toDateString());
          const inMonth = day.getMonth() === start.getMonth();
          const isToday = day.toDateString() === new Date(now).toDateString();
          return (
            <div key={dayStart} className={cn("min-h-24 bg-surface p-1.5", !inMonth && "bg-surface-2/40")}>
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[11px] tabular-nums",
                  isToday ? "bg-accent font-semibold text-white" : "text-ink-3",
                )}
              >
                {day.getDate()}
              </span>
              <ul className="mt-1 space-y-1">
                {items.slice(0, 3).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(row.id)}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-[10px]",
                        row.done ? "bg-success-soft text-success line-through" : "bg-surface-2 text-ink-2",
                      )}
                    >
                      {row.title}
                    </button>
                  </li>
                ))}
                {items.length > 3 ? (
                  <li className="px-1 text-[10px] text-ink-3">+{items.length - 3} more</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskTimeline({
  rows,
  now,
  onOpen,
}: {
  rows: import("@personalos/core").TaskTableRow[];
  now: number;
  onOpen: (id: ID) => void;
}) {
  const groups = new Map<string, import("@personalos/core").TaskTableRow[]>();
  for (const row of rows) {
    const key = row.dueAt != null ? new Date(row.dueAt).toDateString() : "No date";
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === "No date") return 1;
    if (b[0] === "No date") return -1;
    return new Date(a[0]).getTime() - new Date(b[0]).getTime();
  });

  return (
    <ol className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-card" data-testid="tasks-timeline">
      {ordered.map(([day, items]) => (
        <li key={day}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
            {day === new Date(now).toDateString() ? "Today" : day}
          </h3>
          <ul className="space-y-1.5">
            {items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className={cn("min-w-0 flex-1 truncate text-[13px]", row.done ? "text-ink-3 line-through" : "text-ink")}>
                    {row.title}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{row.dueLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}