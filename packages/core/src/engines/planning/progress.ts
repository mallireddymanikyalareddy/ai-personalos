import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Goal } from "../../types/goal";
import type { Milestone } from "../../types/planning";
import type { Project } from "../../types/project";
import type { Task } from "../../types/task";
import { habitStats } from "../habit/habits";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function ratioPct(done: number, total: number): number {
  return total > 0 ? clamp(Math.round((100 * done) / total)) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function milestonesForProject(state: AppState, projectId: ID): Milestone[] {
  return Object.values(state.milestones)
    .filter((milestone) => milestone.projectId === projectId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function tasksForProject(state: AppState, projectId: ID, milestoneId: ID | null = null): Task[] {
  return Object.values(state.tasks).filter(
    (task) => task.projectId === projectId && (milestoneId == null || task.milestoneId === milestoneId),
  );
}

export function milestoneProgress(state: AppState, milestone: Milestone): number {
  if (milestone.status === "completed") return 100;
  const tasks = Object.values(state.tasks).filter((task) => task.milestoneId === milestone.id);
  return ratioPct(
    tasks.filter((task) => task.status === "done").length,
    tasks.length,
  );
}

export function projectProgress(state: AppState, project: Project): number {
  const milestones = milestonesForProject(state, project.id);
  const completedMilestones = milestones.filter((milestone) => milestone.status === "completed").length;
  const tasks = Object.values(state.tasks).filter((task) => task.projectId === project.id);
  const doneTasks = tasks.filter((task) => task.status === "done").length;

  const tasksPct = ratioPct(doneTasks, tasks.length);
  if (milestones.length === 0) return tasksPct;

  const gatesPct = ratioPct(completedMilestones, milestones.length);
  return Math.round(gatesPct * 0.4 + tasksPct * 0.6);
}

export interface GoalProgressBreakdown {
  metric: number | null;
  projects: number | null;
  tasks: number | null;
  habits: number | null;
}

export interface GoalProgressResult {
  progress: number;
  breakdown: GoalProgressBreakdown;
}

export function goalMetricsProgress(goal: Goal): number | null {
  const ratios = goal.metrics
    .filter((metric) => metric.target > 0)
    .map((metric) => clamp(Math.round((100 * metric.current) / metric.target)));
  return ratios.length > 0 ? Math.round(average(ratios)) : null;
}

export function computeGoalProgress(
  state: AppState,
  goal: Goal,
  now: Timestamp = Date.now(),
  weekStart: 0 | 1 = 1,
): GoalProgressResult {
  const metric = goalMetricsProgress(goal);
  if (metric != null) {
    return { progress: metric, breakdown: { metric, projects: null, tasks: null, habits: null } };
  }

  const projects = Object.values(state.projects).filter((project) => project.goalIds.includes(goal.id));
  const projectPct = projects.length > 0 ? Math.round(average(projects.map((p) => projectProgress(state, p)))) : null;

  const direct = Object.values(state.tasks).filter((task) => task.goalIds.includes(goal.id));
  const taskPct =
    direct.length > 0
      ? ratioPct(direct.filter((task) => task.status === "done").length, direct.length)
      : null;

  const habits = Object.values(state.habits).filter((habit) => habit.goalId === goal.id && !habit.archived);
  const habitPct =
    habits.length > 0
      ? Math.round(average(habits.map((habit) => habitStats(state, habit, now, weekStart, 28).completionRate)))
      : null;

  const parts: Array<[number, number]> = [];
  if (projectPct != null) parts.push([projectPct, projects.length]);
  if (taskPct != null) parts.push([taskPct, direct.length]);
  if (habitPct != null) parts.push([habitPct, 1]);

  if (parts.length === 0) {
    return {
      progress: clamp(Math.round(goal.progress)),
      breakdown: { metric: null, projects: null, tasks: null, habits: null },
    };
  }

  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  const progress = Math.round(
    parts.reduce((sum, [pct, weight]) => sum + pct * weight, 0) / totalWeight,
  );
  return {
    progress,
    breakdown: { metric: null, projects: projectPct, tasks: taskPct, habits: habitPct },
  };
}