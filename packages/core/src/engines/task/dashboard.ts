import type { AppState } from "../../store/state";
import type { ID, Priority, Timestamp } from "../../types/common";
import type { Project } from "../../types/project";
import type { Tag } from "../../types/taxonomy";
import type { Task, TaskStatus } from "../../types/task";
import { addDays, endOfDay, startOfDay, startOfWeek } from "../date-utils";
import { queryTasks } from "./query";
import { isOverdue, sortTasks } from "./transitions";

export type TaskView = "list" | "board" | "calendar" | "timeline" | "mine";

export type TaskStatId =
  | "total"
  | "completed"
  | "inProgress"
  | "overdue"
  | "dueToday"
  | "thisWeek";

export interface TaskStatTile {
  id: TaskStatId;
  label: string;
  value: number;
  deltaPct: number | null;
  deltaLabel: string;
  tone: "accent" | "success" | "info" | "danger" | "warning";
}

export interface TaskTableRow {
  id: ID;
  title: string;
  done: boolean;
  status: TaskStatus;
  statusLabel: string;
  priority: Priority;
  priorityLabel: string;
  dueAt: Timestamp | null;
  dueLabel: string;
  overdue: boolean;
  projectId: ID | null;
  projectName: string;
  projectColor: string;
  tags: string[];
  tagColors: Record<string, string>;
  estimateMin: number | null;
  subtasks: { done: number; total: number };
  source: string;
  assigneeId: ID | null;
}

export interface TaskBreakdownRow {
  key: string;
  label: string;
  count: number;
  color: string;
  pct: number;
}

export interface TaskStatusSegment {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface TaskInsight {
  rate: number;
  deltaPct: number | null;
  text: string;
}

export interface TaskViewCounts {
  all: number;
  inbox: number;
  today: number;
  upcoming: number;
  overdue: number;
  completed: number;
  mine: number;
}

export interface TaskDashboard {
  stats: TaskStatTile[];
  rows: TaskTableRow[];
  completionRate: number;
  total: number;
  byProject: TaskBreakdownRow[];
  byPriority: TaskBreakdownRow[];
  byStatus: TaskStatusSegment[];
  upcoming: TaskTableRow[];
  insight: TaskInsight | null;
  counts: TaskViewCounts;
  filters: { project: ID | "all"; priority: Priority | "all"; status: TaskStatus | "all" };
}

export interface TaskDashboardOptions {
  view?: TaskView;
  project?: ID | "all";
  priority?: Priority | "all";
  status?: TaskStatus | "all";
  search?: string;
  showCompleted?: boolean;
  includeArchived?: boolean;
  limit?: number;
  currentUserId?: ID | null;
}

const DAY = 86_400_000;

export const PRIORITY_LABELS: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  open: "Not Started",
  in_progress: "In Progress",
  review: "In Review",
  done: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const TASK_PRIORITY_META: Record<number, { label: string; color: string }> = {
  1: { label: "Low", color: "var(--success)" },
  2: { label: "Medium", color: "var(--warning)" },
  3: { label: "High", color: "var(--danger)" },
  4: { label: "Urgent", color: "var(--p4)" },
};

export const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  completed: { label: "Completed", color: "var(--success)" },
  inProgress: { label: "In Progress", color: "var(--info)" },
  notStarted: { label: "Not Started", color: "var(--chart-8)" },
  overdue: { label: "Overdue", color: "var(--danger)" },
};

const PROJECT_FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-7)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-6)",
  "var(--chart-8)",
];

const TAG_FALLBACK_COLORS = [
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

export function taskStatusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function taskPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority] ?? "None";
}

function inRange(at: Timestamp | null, from: Timestamp, to: Timestamp): boolean {
  return at != null && at >= from && at < to;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function projectLabel(project: Project | undefined): string {
  return project?.name ?? "No project";
}

function projectColor(project: Project | undefined, index: number): string {
  return project?.color ?? PROJECT_FALLBACK_COLORS[index % PROJECT_FALLBACK_COLORS.length]!;
}

function tagColor(state: AppState, tag: string, index: number): string {
  const record = state.tags[tag] as Tag | undefined;
  return record?.color ?? TAG_FALLBACK_COLORS[index % TAG_FALLBACK_COLORS.length]!;
}

export function formatTaskDue(dueAt: Timestamp | null, now: Timestamp): string {
  if (dueAt == null) return "No due date";
  const today = startOfDay(now);
  const due = startOfDay(dueAt);
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(dueAt),
  );
  if (due === today) return `Today, ${formatTime(dueAt)}`;
  if (due === today + DAY) return `Tomorrow, ${formatTime(dueAt)}`;
  return date;
}

export function formatTaskTime(at: Timestamp): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

function formatTime(at: Timestamp): string {
  return formatTaskTime(at);
}

function isMine(task: Task, currentUserId: ID | null | undefined): boolean {
  if (task.source === "habit") return false;
  return task.assigneeId == null || (currentUserId != null && task.assigneeId === currentUserId);
}

export function buildTaskDashboard(
  state: AppState,
  now: Timestamp,
  options: TaskDashboardOptions = {},
): TaskDashboard {
  const view = options.view ?? "list";
  const project = options.project ?? "all";
  const priority = options.priority ?? "all";
  const status = options.status ?? "all";
  const weekStart = startOfWeek(now, (state.settings as unknown as { weekStart?: number }).weekStart === 0 ? 0 : 1);
  const today = startOfDay(now);
  const weekEnd = addDays(weekStart, 7);
  const yesterday = addDays(today, -1);
  const lastWeekStart = addDays(weekStart, -7);

  const every = Object.values(state.tasks).filter((task) =>
    options.includeArchived ? true : task.status !== "archived",
  );
  const scoped = every.filter((task) => project === "all" || task.projectId === project);

  const completed = scoped.filter((task) => task.status === "done");
  const inProgress = scoped.filter((task) => task.status === "in_progress");
  const overdue = scoped.filter((task) => task.status !== "done" && task.status !== "cancelled" && isOverdue(task, now));
  const dueToday = scoped.filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && inRange(task.dueAt, today, addDays(today, 1)),
  );
  const thisWeek = scoped.filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && inRange(task.dueAt, today, weekEnd),
  );

  const createdThisWeek = scoped.filter((task) => inRange(task.createdAt, weekStart, weekEnd)).length;
  const createdLastWeek = scoped.filter((task) => inRange(task.createdAt, lastWeekStart, weekStart)).length;
  const completedThisWeek = scoped.filter((task) => inRange(task.completedAt, weekStart, weekEnd)).length;
  const completedLastWeek = scoped.filter((task) => inRange(task.completedAt, lastWeekStart, weekStart)).length;
  const startedThisWeek = scoped.filter((task) => inRange(task.startedAt, weekStart, weekEnd)).length;
  const startedLastWeek = scoped.filter((task) => inRange(task.startedAt, lastWeekStart, weekStart)).length;
  const overdueThisWeek = scoped.filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "cancelled" &&
      isOverdue(task, now) &&
      inRange(task.dueAt, today, weekEnd),
  ).length;
  const overdueLastWeek = scoped.filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "cancelled" &&
      isOverdue(task, now) &&
      inRange(task.dueAt, addDays(today, -7), weekStart),
  ).length;
  const dueYesterday = scoped.filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && inRange(task.dueAt, yesterday, today),
  ).length;
  const dueLastWeek = scoped.filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && inRange(task.dueAt, addDays(today, -7), weekStart),
  ).length;

  const stats: TaskStatTile[] = [
    {
      id: "total",
      label: "Total Tasks",
      value: scoped.length,
      deltaPct: pctDelta(createdThisWeek, createdLastWeek),
      deltaLabel: "vs last week",
      tone: "accent",
    },
    {
      id: "completed",
      label: "Completed",
      value: completed.length,
      deltaPct: pctDelta(completedThisWeek, completedLastWeek),
      deltaLabel: "vs last week",
      tone: "success",
    },
    {
      id: "inProgress",
      label: "In Progress",
      value: inProgress.length,
      deltaPct: pctDelta(startedThisWeek, startedLastWeek),
      deltaLabel: "vs last week",
      tone: "info",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: overdue.length,
      deltaPct: pctDelta(overdueThisWeek, overdueLastWeek),
      deltaLabel: "vs last week",
      tone: "danger",
    },
    {
      id: "dueToday",
      label: "Due Today",
      value: dueToday.length,
      deltaPct: pctDelta(dueToday.length, dueYesterday),
      deltaLabel: "vs yesterday",
      tone: "warning",
    },
    {
      id: "thisWeek",
      label: "This Week",
      value: thisWeek.length,
      deltaPct: pctDelta(thisWeek.length, dueLastWeek),
      deltaLabel: "vs last week",
      tone: "accent",
    },
  ];

  const base = queryTasks(state, {
    projectId: project === "all" ? undefined : project,
    status: status === "all" ? undefined : [status],
    priority: priority === "all" ? undefined : [priority],
    search: options.search?.trim() ? options.search.trim() : undefined,
    includeDone: options.showCompleted === true || status === "done",
    includeCancelled: false,
    includeArchived: options.includeArchived ?? false,
  });

  const mineFilter = view === "mine";
  const candidates = base
    .filter((task) => task.parentTaskId == null)
    .filter((task) => (mineFilter ? isMine(task, options.currentUserId) : true));

  const ordered = sortTasks(candidates, "due", now);
  const limited = ordered.slice(0, options.limit ?? 200);

  const rows = limited.map((task, index) => toRow(state, task, now, index));
  const breakdownSource = scoped.filter((task) => task.parentTaskId == null);

  const byProject = summarizeByProject(state, breakdownSource);
  const byPriority = summarizeByPriority(breakdownSource);
  const byStatus = summarizeByStatus(breakdownSource, now);

  const upcoming = sortTasks(
    scoped.filter((task) => task.status !== "done" && task.status !== "cancelled" && task.dueAt != null && task.dueAt >= today),
    "due",
    now,
  )
    .slice(0, 5)
    .map((task, index) => toRow(state, task, now, index));

  const total = scoped.length;
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
  const insightDelta = pctDelta(completedThisWeek, completedLastWeek);

  const counts: TaskViewCounts = {
    all: scoped.filter((task) => task.status !== "done").length,
    inbox: scoped.filter((task) => task.status === "inbox").length,
    today: todayTasks(state, now, project).length,
    upcoming: upcoming.length,
    overdue: overdue.length,
    completed: completed.length,
    mine: scoped.filter((task) => isMine(task, options.currentUserId) && task.status !== "done").length,
  };

  return {
    stats,
    rows,
    completionRate,
    total,
    byProject,
    byPriority,
    byStatus,
    upcoming,
    insight:
      total === 0
        ? null
        : {
            rate: completionRate,
            deltaPct: insightDelta,
            text:
              insightDelta != null
                ? `You're ${Math.abs(insightDelta)}% ${insightDelta >= 0 ? "more" : "less"} productive this week compared to last week!`
                : "Your task completion rate is holding steady this week.",
          },
    counts,
    filters: { project, priority, status },
  };
}

function todayTasks(state: AppState, now: Timestamp, project: ID | "all"): Task[] {
  const end = endOfDay(now);
  return queryTasks(state, { projectId: project === "all" ? undefined : project, includeDone: false }).filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "cancelled" &&
      ((task.dueAt != null && task.dueAt <= end) || (task.scheduledAt != null && task.scheduledAt <= end)),
  );
}

function toRow(state: AppState, task: Task, now: Timestamp, index: number): TaskTableRow {
  const project = task.projectId != null ? state.projects[task.projectId] : undefined;
  const children = Object.values(state.tasks).filter((child) => child.parentTaskId === task.id);
  return {
    id: task.id,
    title: task.title,
    done: task.status === "done",
    status: task.status,
    statusLabel: taskStatusLabel(task.status),
    priority: task.priority,
    priorityLabel: taskPriorityLabel(task.priority),
    dueAt: task.dueAt,
    dueLabel: formatTaskDue(task.dueAt, now),
    overdue: task.status !== "done" && task.status !== "cancelled" && isOverdue(task, now),
    projectId: task.projectId,
    projectName: projectLabel(project),
    projectColor: projectColor(project, index),
    tags: task.tags,
    tagColors: Object.fromEntries(task.tags.map((tag, tagIndex) => [tag, tagColor(state, tag, tagIndex)])),
    estimateMin: task.estimateMin,
    subtasks: {
      done: children.filter((child) => child.status === "done").length,
      total: children.length,
    },
    source: task.source,
    assigneeId: task.assigneeId,
  };
}

function summarizeByProject(state: AppState, tasks: Task[]): TaskBreakdownRow[] {
  const map = new Map<string, { label: string; color: string; count: number }>();
  tasks.forEach((task, index) => {
    const key = task.projectId ?? "none";
    const project = task.projectId != null ? state.projects[task.projectId] : undefined;
    const existing = map.get(key) ?? {
      label: projectLabel(project),
      color: projectColor(project, index),
      count: 0,
    };
    existing.count += 1;
    map.set(key, existing);
  });
  const rows = [...map.values()].sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return rows.map((row, index) => ({
    key: row.label,
    label: row.label,
    count: row.count,
    color: row.color ?? PROJECT_FALLBACK_COLORS[index % PROJECT_FALLBACK_COLORS.length]!,
    pct: Math.round((row.count / total) * 100),
  }));
}

function summarizeByPriority(tasks: Task[]): TaskBreakdownRow[] {
  const rows = [3, 2, 1, 4].map((priority) => ({
    key: String(priority),
    label: PRIORITY_LABELS[priority] ?? "None",
    count: tasks.filter((task) => task.priority === priority).length,
    color: TASK_PRIORITY_META[priority]?.color ?? "var(--chart-8)",
    pct: 0,
  }));
  const total = tasks.filter((task) => task.priority > 0).length || 1;
  return rows
    .map((row) => ({ ...row, pct: Math.round((row.count / total) * 100) }))
    .filter((row) => row.count > 0);
}

function summarizeByStatus(tasks: Task[], now: Timestamp): TaskStatusSegment[] {
  const completed = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const notStarted = tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "cancelled" &&
      task.status !== "in_progress" &&
      !isOverdue(task, now),
  ).length;
  const overdueCount = tasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && isOverdue(task, now),
  ).length;

  return [
    { key: "completed", label: "Completed", count: completed, color: TASK_STATUS_META.completed.color },
    { key: "inProgress", label: "In Progress", count: inProgress, color: TASK_STATUS_META.inProgress.color },
    { key: "notStarted", label: "Not Started", count: notStarted, color: TASK_STATUS_META.notStarted.color },
    { key: "overdue", label: "Overdue", count: overdueCount, color: TASK_STATUS_META.overdue.color },
  ].filter((segment) => segment.count > 0);
}