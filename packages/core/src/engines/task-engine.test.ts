import { describe, expect, it } from "vitest";
import {
  groupTasksByDay,
  isOverdue,
  plannedStatus,
  selectInboxTasks,
  selectTodayTasks,
  selectUpcomingTasks,
  sortTasks,
} from "./task-engine";
import { createInitialState, type AppState } from "../store/state";
import { createTask, type NewTaskInput, type Task } from "../types/task";

const now = new Date(2026, 9, 8, 14, 0, 0, 0).getTime();
const today = new Date(2026, 9, 8, 0, 0, 0, 0).getTime();
const yesterday = new Date(2026, 9, 7, 0, 0, 0, 0).getTime();
const nextMonday = new Date(2026, 9, 12, 0, 0, 0, 0).getTime();

function makeState(inputs: NewTaskInput[]): { state: AppState; tasks: Task[] } {
  const state = createInitialState(now);
  const tasks = inputs.map((input) => createTask(input, now));
  for (const task of tasks) state.tasks[task.id] = task;
  return { state, tasks };
}

describe("plannedStatus", () => {
  it("keeps unplanned inbox tasks in the inbox", () => {
    expect(plannedStatus({ status: "inbox", dueAt: null, scheduledAt: null, projectId: null })).toBe(
      "inbox",
    );
  });

  it("promotes inbox tasks once they have a plan", () => {
    expect(plannedStatus({ status: "inbox", dueAt: today, scheduledAt: null, projectId: null })).toBe(
      "open",
    );
    expect(plannedStatus({ status: "inbox", dueAt: null, scheduledAt: null, projectId: "p1" })).toBe(
      "open",
    );
    expect(
      plannedStatus({ status: "inbox", dueAt: null, scheduledAt: now, projectId: null }),
    ).toBe("open");
  });

  it("never demotes other statuses", () => {
    expect(plannedStatus({ status: "done", dueAt: null, scheduledAt: null, projectId: null })).toBe(
      "done",
    );
    expect(plannedStatus({ status: "open", dueAt: null, scheduledAt: null, projectId: null })).toBe(
      "open",
    );
  });
});

describe("isOverdue", () => {
  it("treats dates before today as overdue", () => {
    const [task] = makeState([{ title: "Late", status: "open", dueAt: yesterday }]).tasks;
    expect(isOverdue(task, now)).toBe(true);
  });

  it("does not treat today as overdue", () => {
    const [task] = makeState([{ title: "Due", status: "open", dueAt: today }]).tasks;
    expect(isOverdue(task, now)).toBe(false);
  });

  it("never marks completed tasks overdue", () => {
    const [task] = makeState([{ title: "Done", status: "done", dueAt: yesterday }]).tasks;
    expect(isOverdue(task, now)).toBe(false);
  });
});

describe("selectors", () => {
  it("selects inbox tasks top-level only", () => {
    const { state } = makeState([
      { title: "Raw idea" },
      { title: "Planned", status: "open", dueAt: today },
      { title: "Child", status: "inbox", parentTaskId: "parent-1" },
    ]);
    const inbox = selectInboxTasks(state);
    expect(inbox.map((task) => task.title)).toEqual(["Raw idea"]);
  });

  it("selects today tasks including overdue, due and scheduled", () => {
    const { state } = makeState([
      { title: "Overdue", status: "open", dueAt: yesterday },
      { title: "Due today", status: "open", dueAt: today },
      { title: "Scheduled today", status: "open", scheduledAt: now },
      { title: "Future", status: "open", dueAt: nextMonday },
      { title: "Someday" },
      { title: "Completed", status: "done", dueAt: today },
    ]);
    const titles = selectTodayTasks(state, now).map((task) => task.title);
    expect(titles).toEqual(["Overdue", "Due today", "Scheduled today"]);
  });

  it("selects upcoming tasks sorted by date", () => {
    const { state } = makeState([
      { title: "Later", status: "open", dueAt: new Date(2026, 9, 20).getTime() },
      { title: "Soon", status: "open", dueAt: nextMonday },
      { title: "Today", status: "open", dueAt: today },
    ]);
    const titles = selectUpcomingTasks(state, now).map((task) => task.title);
    expect(titles).toEqual(["Soon", "Later"]);
  });
});

describe("sortTasks", () => {
  it("puts overdue work first in smart mode", () => {
    const { tasks } = makeState([
      { title: "Undated urgent", status: "open", priority: 4 },
      { title: "Overdue low", status: "open", dueAt: yesterday, priority: 1 },
      { title: "Today medium", status: "open", dueAt: today, priority: 2 },
    ]);
    const sorted = sortTasks(tasks, "smart", now).map((task) => task.title);
    expect(sorted).toEqual(["Overdue low", "Today medium", "Undated urgent"]);
  });

  it("sorts by priority in priority mode", () => {
    const { tasks } = makeState([
      { title: "Low", status: "open", priority: 1 },
      { title: "Urgent", status: "open", priority: 4 },
      { title: "None", status: "open" },
    ]);
    const sorted = sortTasks(tasks, "priority", now).map((task) => task.title);
    expect(sorted).toEqual(["Urgent", "Low", "None"]);
  });

  it("places undated tasks last in due mode", () => {
    const { tasks } = makeState([
      { title: "No date", status: "open" },
      { title: "Dated", status: "open", dueAt: nextMonday },
    ]);
    const sorted = sortTasks(tasks, "due", now).map((task) => task.title);
    expect(sorted).toEqual(["Dated", "No date"]);
  });
});

describe("groupTasksByDay", () => {
  it("buckets tasks by their earliest date", () => {
    const { tasks } = makeState([
      { title: "A", status: "open", dueAt: nextMonday },
      { title: "B", status: "open", dueAt: new Date(2026, 9, 20).getTime() },
      { title: "C", status: "open", scheduledAt: nextMonday },
    ]);
    const groups = groupTasksByDay(tasks);
    expect(groups).toHaveLength(2);
    expect(groups[0].day).toBe(nextMonday);
    expect(groups[0].tasks.map((task) => task.title).sort()).toEqual(["A", "C"]);
    expect(groups[1].day).toBe(new Date(2026, 9, 20).getTime());
  });
});
