import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { buildTaskDashboard, formatTaskDue, taskPriorityLabel, taskStatusLabel } from "./dashboard";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: undefined });
  os.clearAll();
});

function addTask(input: Parameters<typeof os.addTask>[0], createdAt = NOW - 20 * DAY) {
  return os.addTask(input, createdAt);
}

function complete(taskId: string, at: number) {
  os.updateTask(taskId, { status: "done", completedAt: at, startedAt: at - 30 * 60_000 });
}

describe("task dashboard stats", () => {
  it("counts totals, completed, in progress, overdue and due today", () => {
    const a = addTask({ title: "Done one", status: "open", dueAt: NOW - 5 * DAY });
    complete(a.id, NOW - DAY);
    const b = addTask({ title: "Active", status: "in_progress", dueAt: NOW + DAY });
    const c = addTask({ title: "Overdue one", status: "open", dueAt: NOW - 2 * DAY });
    addTask({ title: "Due today", status: "open", dueAt: NOW + 2 * 3_600_000 });
    addTask({ title: "This week", status: "open", dueAt: NOW + 5 * DAY });

    const dash = buildTaskDashboard(os.getState(), NOW);
    const byId = new Map(dash.stats.map((tile) => [tile.id, tile]));

    expect(byId.get("total")!.value).toBe(5);
    expect(byId.get("completed")!.value).toBe(1);
    expect(byId.get("inProgress")!.value).toBe(1);
    expect(byId.get("overdue")!.value).toBe(1);
    expect(byId.get("dueToday")!.value).toBe(1);
    expect(byId.get("thisWeek")!.value).toBe(2);
  });

  it("shows a delta when the same window last week was different", () => {
    addTask({ title: "This week 1", dueAt: NOW + 2 * DAY }, NOW - 1 * DAY);
    addTask({ title: "This week 2", dueAt: NOW + 3 * DAY }, NOW - 2 * DAY);
    addTask({ title: "Last week", dueAt: NOW - 10 * DAY }, NOW - 8 * DAY);

    const dash = buildTaskDashboard(os.getState(), NOW);
    const total = dash.stats.find((tile) => tile.id === "total")!;
    expect(total.deltaPct).toBe(100);
    expect(total.deltaLabel).toBe("vs last week");
  });

  it("returns zeroed stats when there are no tasks", () => {
    const dash = buildTaskDashboard(os.getState(), NOW);
    expect(dash.total).toBe(0);
    expect(dash.completionRate).toBe(0);
    expect(dash.insight).toBeNull();
    expect(dash.rows).toHaveLength(0);
  });
});

describe("task dashboard rows", () => {
  it("joins project, priority, status and tags", () => {
    const project = os.addProject({ name: "D365 Support" }, NOW - 30 * DAY);
    const habit = os.addHabit({ title: "Stretch" }, NOW - 30 * DAY);
    addTask({
      title: "Update D365 runbook documentation",
      status: "in_progress",
      priority: 3,
      dueAt: NOW + 30 * 60_000,
      projectId: project.id,
      tags: ["work", "d365"],
    });
    addTask({ title: "Habit task", habitId: habit.id, tags: [] });

    const dash = buildTaskDashboard(os.getState(), NOW);
    const row = dash.rows.find((entry) => entry.title.startsWith("Update D365"))!;

    expect(row.projectName).toBe("D365 Support");
    expect(row.priorityLabel).toBe("High");
    expect(row.statusLabel).toBe("In Progress");
    expect(row.dueLabel).toMatch(/^Today, /);
    expect(row.dueLabel).toContain("10:30");
    expect(row.overdue).toBe(false);
    expect(row.tags).toEqual(["work", "d365"]);
    expect(row.tagColors.work).toBeDefined();
  });

  it("filters by project, priority, status and search", () => {
    const project = os.addProject({ name: "Work" }, NOW - 30 * DAY);
    addTask({ title: "Buy milk", priority: 1, projectId: project.id });
    addTask({ title: "Ship release", priority: 4 });
    addTask({ title: "Ship docs", priority: 2 });

    const byProject = buildTaskDashboard(os.getState(), NOW, { project: project.id });
    expect(byProject.rows.map((row) => row.title)).toEqual(["Buy milk"]);

    const byPriority = buildTaskDashboard(os.getState(), NOW, { priority: 4 });
    expect(byPriority.rows.map((row) => row.title)).toEqual(["Ship release"]);

    const bySearch = buildTaskDashboard(os.getState(), NOW, { search: "ship" });
    expect(bySearch.rows.map((row) => row.title).sort()).toEqual(["Ship docs", "Ship release"]);
  });

  it("lists my tasks separately", () => {
    addTask({ title: "Mine", source: "manual" });
    addTask({ title: "Generated", source: "habit" });
    os.setTaskAssignee(Object.keys(os.getState().tasks)[1]!, "someone-else");

    const dash = buildTaskDashboard(os.getState(), NOW, { view: "mine" });
    expect(dash.rows.map((row) => row.title)).toEqual(["Mine"]);
  });

  it("marks overdue rows and labels them", () => {
    addTask({ title: "Late", status: "open", dueAt: NOW - DAY });

    const dash = buildTaskDashboard(os.getState(), NOW);
    const row = dash.rows[0]!;
    expect(row.overdue).toBe(true);
    expect(row.dueLabel).toContain("2026");
  });
});

describe("task dashboard breakdowns", () => {
  it("summarises tasks by project with percentages", () => {
    const project = os.addProject({ name: "Support" }, NOW - 30 * DAY);
    addTask({ title: "A", projectId: project.id });
    addTask({ title: "B", projectId: project.id });
    addTask({ title: "C" });

    const dash = buildTaskDashboard(os.getState(), NOW);
    const support = dash.byProject.find((row) => row.label === "Support")!;
    expect(support.count).toBe(2);
    expect(support.pct).toBe(67);
    expect(dash.byProject.some((row) => row.label === "No project")).toBe(true);
  });

  it("summarises priorities with colours", () => {
    addTask({ title: "High", priority: 3 });
    addTask({ title: "Med", priority: 2 });
    addTask({ title: "Low", priority: 1 });

    const dash = buildTaskDashboard(os.getState(), NOW);
    expect(dash.byPriority.map((row) => row.label)).toEqual(["High", "Medium", "Low"]);
    expect(dash.byPriority[0]!.color).toBe("var(--danger)");
  });

  it("summarises status segments", () => {
    const done = addTask({ title: "Done", status: "open" });
    complete(done.id, NOW - DAY);
    addTask({ title: "Active", status: "in_progress" });
    addTask({ title: "Todo", status: "open" });
    addTask({ title: "Late", status: "open", dueAt: NOW - DAY });

    const dash = buildTaskDashboard(os.getState(), NOW);
    const byKey = new Map(dash.byStatus.map((segment) => [segment.key, segment.count]));
    expect(byKey.get("completed")).toBe(1);
    expect(byKey.get("inProgress")).toBe(1);
    expect(byKey.get("notStarted")).toBe(1);
    expect(byKey.get("overdue")).toBe(1);
  });

  it("computes a completion rate and insight", () => {
    const done = addTask({ title: "Done", status: "open" });
    complete(done.id, NOW - 2 * DAY);
    addTask({ title: "Open", status: "open" });

    const dash = buildTaskDashboard(os.getState(), NOW);
    expect(dash.completionRate).toBe(50);
    expect(dash.insight).not.toBeNull();
    expect(dash.insight!.rate).toBe(50);
  });
});

describe("task dashboard deadlines", () => {
  it("returns upcoming open tasks in due order", () => {
    addTask({ title: "Far", status: "open", dueAt: NOW + 6 * DAY });
    addTask({ title: "Soon", status: "open", dueAt: NOW + 2 * DAY });
    const done = addTask({ title: "Done one", status: "open", dueAt: NOW + DAY });
    complete(done.id, NOW);

    const dash = buildTaskDashboard(os.getState(), NOW);
    expect(dash.upcoming.map((row) => row.title)).toEqual(["Soon", "Far"]);
  });

  it("reports view counts", () => {
    addTask({ title: "Todo", status: "open" });
    addTask({ title: "Inbox", status: "inbox" });
    const done = addTask({ title: "Done", status: "open" });
    complete(done.id, NOW);

    const dash = buildTaskDashboard(os.getState(), NOW);
    expect(dash.counts.all).toBe(2);
    expect(dash.counts.inbox).toBe(1);
    expect(dash.counts.completed).toBe(1);
    expect(dash.counts.mine).toBe(2);
  });
});

describe("task labels and dates", () => {
  it("labels priority and status", () => {
    expect(taskPriorityLabel(3)).toBe("High");
    expect(taskPriorityLabel(0)).toBe("None");
    expect(taskStatusLabel("in_progress")).toBe("In Progress");
    expect(taskStatusLabel("open")).toBe("Not Started");
    expect(taskStatusLabel("done")).toBe("Completed");
  });

  it("formats today, tomorrow and absolute dates", () => {
    expect(formatTaskDue(NOW, NOW)).toMatch(/^Today, /);
    expect(formatTaskDue(NOW + DAY, NOW)).toMatch(/^Tomorrow, /);
    expect(formatTaskDue(NOW + 9 * DAY, NOW)).toContain("2026");
    expect(formatTaskDue(null, NOW)).toBe("No due date");
  });
});