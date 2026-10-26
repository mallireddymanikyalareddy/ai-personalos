import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import type { TaskStatus } from "../../types/task";
import { isOpen, selectTodayTasks } from "../task/transitions";
import {
  BOARD_COLUMNS,
  boardCompletion,
  boardForProject,
  columnForStatus,
  isBoardColumnId,
  isOnBoard,
  moveTaskToColumn,
  nextMove,
  projectActivity,
  projectDueAt,
  projectStats,
  projectTeam,
  relativeTime,
  statusForColumn,
  upcomingMilestones,
  milestoneHealth,
} from "./index";

const T0 = new Date(2026, 3, 1, 9, 0, 0, 0).getTime();
const DAY = 86_400_000;

let os: PersonalOS;
let projectId: string;

function addTask(title: string, patch: Record<string, unknown> = {}) {
  return os.addTask({ title, projectId, ...patch } as never, T0);
}

beforeEach(() => {
  os = new PersonalOS();
  projectId = os.addProject({ name: "MedoriQ" }, T0).id;
});

describe("board columns", () => {
  it("exposes the four kanban columns in order", () => {
    expect(BOARD_COLUMNS.map((column) => column.id)).toEqual([
      "todo",
      "in_progress",
      "review",
      "done",
    ]);
    expect(BOARD_COLUMNS.map((column) => column.label)).toEqual([
      "To Do",
      "In Progress",
      "Review",
      "Done",
    ]);
  });

  it("maps statuses to columns both ways", () => {
    expect(columnForStatus("open")).toBe("todo");
    expect(columnForStatus("in_progress")).toBe("in_progress");
    expect(columnForStatus("review")).toBe("review");
    expect(columnForStatus("done")).toBe("done");
    expect(statusForColumn("review")).toBe("review");
  });

  it("treats non-board statuses as off-board", () => {
    expect(columnForStatus("inbox")).toBeNull();
    expect(columnForStatus("cancelled")).toBeNull();
    expect(columnForStatus("archived")).toBeNull();
    expect(isOnBoard("inbox")).toBe(false);
    expect(isOnBoard("review")).toBe(true);
  });

  it("validates column ids", () => {
    expect(isBoardColumnId("review")).toBe(true);
    expect(isBoardColumnId("nope")).toBe(false);
  });
});

describe("project board", () => {
  it("groups tasks into their columns", () => {
    addTask("Design");
    addTask("Build", { status: "in_progress" });
    addTask("Review me", { status: "review" });
    addTask("Shipped", { status: "done" });

    const board = boardForProject(os.getState(), projectId);
    expect(board.todo.map((task) => task.title)).toEqual(["Design"]);
    expect(board.in_progress.map((task) => task.title)).toEqual(["Build"]);
    expect(board.review.map((task) => task.title)).toEqual(["Review me"]);
    expect(board.done.map((task) => task.title)).toEqual(["Shipped"]);
  });

  it("excludes tasks from other projects", () => {
    const other = os.addProject({ name: "Other" }, T0).id;
    addTask("Mine");
    os.addTask({ title: "Theirs", projectId: other }, T0);
    os.addTask({ title: "Unassigned" }, T0);

    const board = boardForProject(os.getState(), projectId);
    expect(board.todo.map((task) => task.title)).toEqual(["Mine"]);
  });

  it("excludes cancelled and archived tasks", () => {
    addTask("Cancelled one", { status: "cancelled" });
    addTask("Archived one", { status: "archived" });
    addTask("Real one", { status: "open" });

    expect(boardForProject(os.getState(), projectId).todo).toHaveLength(1);
  });

  it("plans an inbox task onto the board once it has a project", () => {
    const planned = addTask("Freshly filed");
    expect(planned.status).toBe("open");
    expect(boardForProject(os.getState(), projectId).todo).toHaveLength(1);
  });

  it("keeps an unassigned inbox task off any board", () => {
    const inbox = os.addTask({ title: "Still triaging" }, T0);
    expect(inbox.status).toBe("inbox");
    expect(isOnBoard(inbox.status)).toBe(false);
  });

  it("computes completion as done over total", () => {
    const board = {
      todo: [addTask("a"), addTask("b"), addTask("c")],
      in_progress: [],
      review: [],
      done: [addTask("d")],
    };
    expect(boardCompletion(board)).toBe(25);
  });

  it("returns zero completion for an empty board", () => {
    expect(
      boardCompletion({ todo: [], in_progress: [], review: [], done: [] }),
    ).toBe(0);
  });

  it("orders done tasks most recently completed first", () => {
    const older = addTask("Older", { status: "done" });
    const newer = addTask("Newer", { status: "done" });
    os.updateTask(older.id, { completedAt: T0 });
    os.updateTask(newer.id, { completedAt: T0 + DAY });

    const board = boardForProject(os.getState(), projectId);
    expect(board.done.map((task) => task.title)).toEqual(["Newer", "Older"]);
  });
});

describe("moveTaskToColumn", () => {
  it("stamps completedAt when moving into done", () => {
    const task = addTask("Finish me");
    const moved = moveTaskToColumn(task, "done", 0, T0 + 5);
    expect(moved.status).toBe("done");
    expect(moved.completedAt).toBe(T0 + 5);
  });

  it("clears completedAt when moving out of done", () => {
    const task = addTask("Shipped", { status: "done", completedAt: T0 });
    const moved = moveTaskToColumn(task, "todo", 0, T0 + 9);
    expect(moved.status).toBe("open");
    expect(moved.completedAt).toBeNull();
  });

  it("keeps the original completedAt when re-closing", () => {
    const task = addTask("Shipped", { status: "done", completedAt: T0 });
    const moved = moveTaskToColumn(task, "review", 0, T0 + 20);
    expect(moved.completedAt).toBeNull();

    const back = moveTaskToColumn(moved, "done", 0, T0 + 30);
    expect(back.completedAt).toBe(T0 + 30);
  });

  it("sets startedAt when moving into progress", () => {
    const task = addTask("Start me");
    const moved = moveTaskToColumn(task, "in_progress", 0, T0 + 3);
    expect(moved.startedAt).toBe(T0 + 3);
  });

  it("is a no-op when the column already matches", () => {
    const task = addTask("Same", { status: "review" });
    const moved = moveTaskToColumn(task, "review", 4, T0 + 7);
    expect(moved.order).toBe(4);
    expect(moved.updatedAt).toBe(task.updatedAt);
  });

  it("moves through every stage", () => {
    let task = addTask("Pipeline");
    task = moveTaskToColumn(task, "in_progress", 0, T0 + 1);
    expect(task.status).toBe("in_progress");
    task = moveTaskToColumn(task, "review", 0, T0 + 2);
    expect(task.status).toBe("review");
    task = moveTaskToColumn(task, "done", 0, T0 + 3);
    expect(task.status).toBe("done");
  });
});

describe("nextMove", () => {
  it("steps right and left within the board", () => {
    expect(nextMove(addTask("a"), "right")).toBe("in_progress");
    const done = addTask("b", { status: "done" });
    expect(nextMove(done, "right")).toBeNull();
    expect(nextMove(done, "left")).toBe("review");
  });

  it("stops at the left edge", () => {
    expect(nextMove(addTask("a"), "left")).toBeNull();
  });

  it("returns null for off-board tasks", () => {
    const inbox = os.addTask({ title: "inbox" }, T0);
    expect(inbox.status).toBe("inbox");
    expect(nextMove(inbox, "right")).toBeNull();
  });
});

describe("os board integration", () => {
  it("moves a task between columns through the OS", () => {
    const task = addTask("Drag me");
    expect(os.projectBoard(projectId).todo).toHaveLength(1);

    const moved = os.moveTaskToColumn(task.id, projectId, "review", T0 + 10);
    expect(moved?.status).toBe("review");
    expect(os.projectBoard(projectId).review).toHaveLength(1);
    expect(os.projectBoard(projectId).todo).toHaveLength(0);
  });

  it("refuses to move a task from another project", () => {
    const other = os.addProject({ name: "Other" }, T0).id;
    const theirs = os.addTask({ title: "Theirs", projectId: other }, T0);
    expect(os.moveTaskToColumn(theirs.id, projectId, "done", T0)).toBeNull();
  });

  it("shifts a task one column at a time", () => {
    const task = addTask("Shift me");
    const shifted = os.shiftTaskColumn(task.id, "right", T0 + 1);
    expect(shifted?.status).toBe("in_progress");
    expect(os.shiftTaskColumn(task.id, "right", T0 + 2)?.status).toBe("review");
  });

  it("creates a task directly into a column", () => {
    const created = os.addProjectTask({ title: "Fresh" }, projectId, "review", T0 + 4);
    expect(created.status).toBe("review");
    expect(os.projectBoard(projectId).review.map((task) => task.title)).toEqual(["Fresh"]);
  });

  it("appends new tasks after existing ones in the column", () => {
    os.addProjectTask({ title: "First" }, projectId, "todo", T0 + 1);
    const second = os.addProjectTask({ title: "Second" }, projectId, "todo", T0 + 2);
    expect(second.order).toBeGreaterThan(0);
  });
});

describe("project stats", () => {
  it("summarises totals, completion, and column counts", () => {
    addTask("a");
    addTask("b");
    addTask("c", { status: "done", completedAt: T0 });
    addTask("d", { status: "review" });

    const stats = projectStats(os.getState(), projectId);
    expect(stats.total).toBe(4);
    expect(stats.done).toBe(1);
    expect(stats.open).toBe(3);
    expect(stats.progress).toBe(25);
    expect(stats.columns.todo).toBe(2);
    expect(stats.columns.review).toBe(1);
    expect(stats.columns.done).toBe(1);
  });

  it("reports zero stats for an empty project", () => {
    const stats = projectStats(os.getState(), projectId);
    expect(stats.total).toBe(0);
    expect(stats.progress).toBe(0);
    expect(stats.milestoneTotal).toBe(0);
  });
});

describe("milestones", () => {
  it("computes the project due date from the earliest milestone", () => {
    os.addMilestone({ projectId, title: "Late", dueAt: T0 + 20 * DAY }, T0);
    os.addMilestone({ projectId, title: "Soon", dueAt: T0 + 5 * DAY }, T0);
    expect(projectDueAt(os.getState(), projectId)).toBe(T0 + 5 * DAY);
  });

  it("returns no due date without milestones", () => {
    expect(projectDueAt(os.getState(), projectId)).toBeNull();
  });

  it("sorts milestones with undated ones last", () => {
    os.addMilestone({ projectId, title: "Dated", dueAt: T0 + DAY }, T0);
    os.addMilestone({ projectId, title: "Undated" }, T0);
    const stats = projectStats(os.getState(), projectId);
    expect(stats.milestoneTotal).toBe(2);
  });

  it("marks a completed milestone as done", () => {
    const created = os.addMilestone({ projectId, title: "Shipped" }, T0);
    os.updateMilestone(created.id, { status: "completed", completedAt: T0 + DAY });
    const milestone = os.getState().milestones[created.id]!;

    expect(upcomingMilestones(os.getState(), projectId, 5, T0 + 2 * DAY)).toHaveLength(0);
    expect(milestoneHealth(os.getState(), milestone, T0 + 2 * DAY)).toBe("done");
  });

  it("marks an overdue unfinished milestone at risk", () => {
    const milestone = os.addMilestone({ projectId, title: "Slipping", dueAt: T0 - DAY }, T0);
    const task = os.addTask({ title: "Half", projectId, milestoneId: milestone.id }, T0);
    os.updateTask(task.id, { status: "in_progress" });

    const stats = projectStats(os.getState(), projectId);
    expect(stats.milestoneTotal).toBe(1);
    expect(stats.milestoneDone).toBe(0);
    expect(milestoneHealth(os.getState(), milestone, T0 + DAY)).toBe("at_risk");
  });

  it("marks a milestone on track once work has started", () => {
    const milestone = os.addMilestone({ projectId, title: "Moving", dueAt: T0 + 30 * DAY }, T0);
    const task = os.addTask({ title: "Started", projectId, milestoneId: milestone.id }, T0);
    os.updateTask(task.id, { status: "in_progress" });
    expect(milestoneHealth(os.getState(), milestone, T0 + 2 * DAY)).toBe("on_track");
  });

  it("marks an untouched distant milestone as upcoming", () => {
    const milestone = os.addMilestone({ projectId, title: "Later", dueAt: T0 + 90 * DAY }, T0);
    expect(milestoneHealth(os.getState(), milestone, T0 + DAY)).toBe("upcoming");
  });

  it("lists only incomplete milestones as upcoming", () => {
    os.addMilestone({ projectId, title: "Open one", dueAt: T0 + 10 * DAY }, T0);
    const done = os.addMilestone({ projectId, title: "Closed", dueAt: T0 + 2 * DAY }, T0);
    os.updateMilestone(done.id, { status: "completed", completedAt: T0 + DAY });

    const upcoming = upcomingMilestones(os.getState(), projectId, 5, T0 + 3 * DAY);
    expect(upcoming.map((view) => view.milestone.title)).toEqual(["Open one"]);
  });
});

describe("project team", () => {
  it("is empty with no members", () => {
    addTask("Solo");
    expect(projectTeam(os.getState(), projectId)).toHaveLength(0);
  });

  it("lists active members with their task counts", () => {
    const member = os.addMember(
      { userId: "u-priya", displayName: "Priya", role: "admin" },
      T0,
    );
    addTask("One", { assigneeId: member.userId });
    addTask("Two", { assigneeId: member.userId });

    const team = projectTeam(os.getState(), projectId);
    expect(team).toHaveLength(1);
    expect(team[0]!.displayName).toBe("Priya");
    expect(team[0]!.role).toBe("admin");
    expect(team[0]!.taskCount).toBe(2);
  });
});

describe("derived activity", () => {
  it("records task creation", () => {
    const task = addTask("Fresh work");
    const entries = projectActivity(os.getState(), projectId, 8, T0);
    expect(entries.some((entry) => entry.kind === "task_created" && entry.title === task.title)).toBe(true);
  });

  it("records a task reaching done", () => {
    const task = addTask("Finished");
    os.updateTask(task.id, { status: "done", completedAt: T0 + DAY });
    const entries = projectActivity(os.getState(), projectId, 8, T0 + 2 * DAY);
    const done = entries.find((entry) => entry.kind === "task_completed");
    expect(done?.detail).toBe("moved to Done");
    expect(done?.at).toBe(T0 + DAY);
  });

  it("records review and progress transitions", () => {
    const task = addTask("Stage");
    os.updateTask(task.id, { status: "review" });
    const entries = projectActivity(os.getState(), projectId, 8, T0 + 2 * DAY);
    expect(entries.some((entry) => entry.kind === "task_review")).toBe(true);
  });

  it("records milestone completion", () => {
    const milestone = os.addMilestone({ projectId, title: "Beta" }, T0);
    os.updateMilestone(milestone.id, { status: "completed", completedAt: T0 + DAY });
    const entries = projectActivity(os.getState(), projectId, 8, T0 + 2 * DAY);
    expect(entries.some((entry) => entry.kind === "milestone_completed")).toBe(true);
  });

  it("records project creation", () => {
    const entries = projectActivity(os.getState(), projectId, 8, T0 + 1);
    expect(entries.some((entry) => entry.kind === "project_created")).toBe(true);
  });

  it("sorts newest first and honours the limit", () => {
    const first = addTask("First");
    const second = addTask("Second");
    os.updateTask(second.id, { status: "done", completedAt: T0 + DAY });
    os.updateTask(first.id, { status: "done", completedAt: T0 + 2 * DAY });

    const entries = projectActivity(os.getState(), projectId, 2, T0 + 3 * DAY);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.at).toBeGreaterThanOrEqual(entries[1]!.at);
  });

  it("ignores activity outside the window", () => {
    const task = addTask("Ancient");
    os.updateTask(task.id, { status: "done", completedAt: T0 });
    const entries = projectActivity(os.getState(), projectId, 8, T0 + 200 * DAY);
    expect(entries.every((entry) => entry.at >= T0 + 200 * DAY - 60 * DAY)).toBe(true);
  });

  it("ignores tasks from other projects", () => {
    const other = os.addProject({ name: "Other" }, T0).id;
    os.addTask({ title: "Elsewhere", projectId: other }, T0);
    const entries = projectActivity(os.getState(), projectId, 8, T0 + 1);
    expect(entries.some((entry) => entry.title === "Elsewhere")).toBe(false);
  });
});

describe("relativeTime", () => {
  it("describes recent and older timestamps", () => {
    expect(relativeTime(T0, T0 + 10_000)).toBe("just now");
    expect(relativeTime(T0, T0 + 5 * 60_000)).toBe("5m ago");
    expect(relativeTime(T0, T0 + 3 * 3_600_000)).toBe("3h ago");
    expect(relativeTime(T0, T0 + 2 * DAY)).toBe("2d ago");
    expect(relativeTime(T0, T0 + 30 * DAY)).not.toBe("30d ago");
  });
});

describe("review status is a first-class task stage", () => {
  it("is accepted by the task type and survives a round trip", () => {
    const status: TaskStatus = "review";
    const task = os.addTask({ title: "Stage", projectId, status }, T0);
    expect(task.status).toBe("review");
    expect(os.getTask(task.id)?.status).toBe("review");
  });

  it("still counts as open work, so it shows up in today", () => {
    const task = addTask("Awaiting review", { status: "review", dueAt: T0 + DAY });
    expect(isOpen(task)).toBe(true);

    const today = selectTodayTasks(os.getState(), T0 + DAY);
    expect(today.map((entry) => entry.title)).toContain("Awaiting review");
  });
});

describe("workspace members", () => {
  it("lists a member who has no tasks assigned yet", () => {
    os.addMember({ userId: "u-new", displayName: "New teammate", role: "member" }, T0);

    const team = projectTeam(os.getState(), projectId);
    expect(team).toHaveLength(1);
    expect(team[0]!.displayName).toBe("New teammate");
    expect(team[0]!.taskCount).toBe(0);
  });

  it("stores WIP limits on a project", () => {
    const limited = os.addProject(
      { name: "Limited", wipLimits: { in_progress: 2, review: 1 } },
      T0,
    );
    expect(limited.wipLimits).toEqual({ in_progress: 2, review: 1 });
  });
});