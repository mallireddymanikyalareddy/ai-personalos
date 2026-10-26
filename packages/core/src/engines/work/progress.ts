import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Member, MemberRole } from "../../types/identity";
import type { Milestone } from "../../types/planning";
import type { Project } from "../../types/project";

import { boardForProject, boardCompletion, boardTotal, columnCounts, type BoardColumnId } from "./board";

export interface ProjectStats {
  total: number;
  done: number;
  open: number;
  progress: number;
  columns: Record<BoardColumnId, number>;
  milestoneTotal: number;
  milestoneDone: number;
  dueAt: Timestamp | null;
}

export function projectStats(state: AppState, projectId: ID): ProjectStats {
  const board = boardForProject(state, projectId);
  const columns = columnCounts(board);
  const milestones = milestonesFor(state, projectId);
  const total = boardTotal(board);

  return {
    total,
    done: board.done.length,
    open: total - board.done.length,
    progress: boardCompletion(board),
    columns,
    milestoneTotal: milestones.length,
    milestoneDone: milestones.filter((milestone) => milestone.status === "completed").length,
    dueAt: projectDueAt(state, projectId),
  };
}

export function milestonesFor(state: AppState, projectId: ID): Milestone[] {
  return Object.values(state.milestones)
    .filter((milestone) => milestone.projectId === projectId && milestone.status !== "archived")
    .sort((a, b) => {
      if (a.dueAt == null && b.dueAt == null) return a.order - b.order;
      if (a.dueAt == null) return 1;
      if (b.dueAt == null) return -1;
      return a.dueAt - b.dueAt;
    });
}

export type MilestoneHealth = "done" | "on_track" | "at_risk" | "upcoming";

export interface MilestoneView {
  milestone: Milestone;
  health: MilestoneHealth;
  total: number;
  done: number;
  percent: number;
}

export function milestoneHealth(
  state: AppState,
  milestone: Milestone,
  now: Timestamp = Date.now(),
): MilestoneHealth {
  if (milestone.status === "completed" || milestone.completedAt != null) return "done";

  const tasks = Object.values(state.tasks).filter(
    (task) => task.milestoneId === milestone.id && task.status !== "archived" && task.status !== "cancelled",
  );
  const done = tasks.filter((task) => task.status === "done").length;
  const started = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "review",
  ).length;
  const percent = tasks.length === 0 ? 0 : done / tasks.length;

  if (milestone.dueAt != null && milestone.dueAt < now && percent < 1) return "at_risk";
  if (percent >= 0.5 || done > 0 || started > 0) return "on_track";
  if (milestone.dueAt != null && milestone.dueAt - now < 7 * 86_400_000) return "on_track";
  return "upcoming";
}

export function milestoneView(
  state: AppState,
  milestone: Milestone,
  now: Timestamp = Date.now(),
): MilestoneView {
  const tasks = Object.values(state.tasks).filter(
    (task) => task.milestoneId === milestone.id && task.status !== "archived" && task.status !== "cancelled",
  );
  const done = tasks.filter((task) => task.status === "done").length;
  return {
    milestone,
    health: milestoneHealth(state, milestone, now),
    total: tasks.length,
    done,
    percent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };
}

export function upcomingMilestones(
  state: AppState,
  projectId: ID,
  limit = 5,
  now: Timestamp = Date.now(),
): MilestoneView[] {
  return milestonesFor(state, projectId)
    .filter((milestone) => milestone.status !== "completed" && milestone.completedAt == null)
    .slice(0, limit)
    .map((milestone) => milestoneView(state, milestone, now));
}

export function projectDueAt(state: AppState, projectId: ID): Timestamp | null {
  const milestones = milestonesFor(state, projectId).filter((milestone) => milestone.dueAt != null);
  if (milestones.length === 0) return null;
  return Math.min(...milestones.map((milestone) => milestone.dueAt as Timestamp));
}

export function activeProjects(state: AppState): Project[] {
  return Object.values(state.projects)
    .filter((project) => project.status === "active")
    .sort((a, b) => a.order - b.order);
}

export function allProjects(state: AppState): Project[] {
  return Object.values(state.projects).sort((a, b) => a.order - b.order);
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export interface TeamMemberView {
  member: Member;
  displayName: string;
  role: MemberRole;
  taskCount: number;
}

export function projectTeam(state: AppState, projectId: ID): TeamMemberView[] {
  const assigneeIds = new Set(
    Object.values(state.tasks)
      .filter((task) => task.projectId === projectId && task.assigneeId != null)
      .map((task) => task.assigneeId as ID),
  );

  const members = Object.values(state.members).filter(
    (member) => member.status === "active" || assigneeIds.has(member.userId),
  );

  return members
    .map((member) => ({
      member,
      displayName: member.displayName ?? member.userId,
      role: member.role,
      taskCount: Object.values(state.tasks).filter(
        (task) => task.projectId === projectId && task.assigneeId === member.userId,
      ).length,
    }))
    .sort((a, b) => b.taskCount - a.taskCount || a.displayName.localeCompare(b.displayName));
}

/* ------------------------------------------------------------------ */
/* Derived activity                                                    */
/* ------------------------------------------------------------------ */

export type WorkActivityKind =
  | "task_completed"
  | "task_started"
  | "task_created"
  | "task_review"
  | "milestone_completed"
  | "milestone_created"
  | "project_created";

export interface WorkActivityEntry {
  id: string;
  kind: WorkActivityKind;
  at: Timestamp;
  projectId: ID;
  actorId: ID | null;
  title: string;
  detail: string;
}

const ACTIVITY_WINDOW = 60 * 86_400_000;

export function projectActivity(
  state: AppState,
  projectId: ID,
  limit = 8,
  now: Timestamp = Date.now(),
): WorkActivityEntry[] {
  const cutoff = now - ACTIVITY_WINDOW;
  const entries: WorkActivityEntry[] = [];

  for (const task of Object.values(state.tasks)) {
    if (task.projectId !== projectId) continue;

    if (task.completedAt != null && task.completedAt >= cutoff) {
      entries.push({
        id: `${task.id}-done`,
        kind: "task_completed",
        at: task.completedAt,
        projectId,
        actorId: task.assigneeId,
        title: task.title,
        detail: "moved to Done",
      });
    }

    if (task.status === "review" && task.updatedAt >= cutoff) {
      entries.push({
        id: `${task.id}-review`,
        kind: "task_review",
        at: task.updatedAt,
        projectId,
        actorId: task.assigneeId,
        title: task.title,
        detail: "moved to Review",
      });
    }

    if (task.startedAt != null && task.startedAt >= cutoff) {
      entries.push({
        id: `${task.id}-started`,
        kind: "task_started",
        at: task.startedAt,
        projectId,
        actorId: task.assigneeId,
        title: task.title,
        detail: "moved to In Progress",
      });
    }

    if (task.createdAt >= cutoff) {
      entries.push({
        id: `${task.id}-created`,
        kind: "task_created",
        at: task.createdAt,
        projectId,
        actorId: task.assigneeId,
        title: task.title,
        detail: "created a new task",
      });
    }
  }

  for (const milestone of Object.values(state.milestones)) {
    if (milestone.projectId !== projectId) continue;

    if (milestone.completedAt != null && milestone.completedAt >= cutoff) {
      entries.push({
        id: `${milestone.id}-done`,
        kind: "milestone_completed",
        at: milestone.completedAt,
        projectId,
        actorId: null,
        title: milestone.title,
        detail: "completed a milestone",
      });
    }

    if (milestone.createdAt >= cutoff) {
      entries.push({
        id: `${milestone.id}-created`,
        kind: "milestone_created",
        at: milestone.createdAt,
        projectId,
        actorId: null,
        title: milestone.title,
        detail: "added a milestone",
      });
    }
  }

  const project = state.projects[projectId];
  if (project && project.createdAt >= cutoff) {
    entries.push({
      id: `${project.id}-created`,
      kind: "project_created",
      at: project.createdAt,
      projectId,
      actorId: null,
      title: project.name,
      detail: "created the project",
    });
  }

  return entries.sort((a, b) => b.at - a.at).slice(0, limit);
}

export function relativeTime(at: Timestamp, now: Timestamp = Date.now()): string {
  const diff = now - at;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(at).toLocaleDateString();
}