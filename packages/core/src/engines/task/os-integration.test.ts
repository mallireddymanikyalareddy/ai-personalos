import { describe, expect, it } from "vitest";

import type { AppState } from "../../store/state";
import { createInitialState } from "../../store/state";
import { PersonalOS } from "../../os";
import type { Task } from "../../types/task";
import { createTask } from "../../types/task";
import { addDays, DAY_MS, startOfDay } from "../date-utils";

function makeOS(): PersonalOS {
  return new PersonalOS({ storage: null });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return createTask({ title: "Test", ...overrides });
}

describe("PersonalOS task engine integration", () => {
  describe("completeTask with recurrence", () => {
    it("creates next occurrence when completing a recurring task", () => {
      const os = makeOS();
      const mon = new Date(2025, 0, 6).getTime();
      const task = os.addTask({
        title: "Daily standup",
        dueAt: mon,
        recurrence: { freq: "daily", interval: 1 },
      });
      const result = os.completeTask(task.id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe("done");

      const all = Object.values(os.getState().tasks);
      const next = all.find((t) => t.recurrenceId === task.recurrenceId && t.status !== "done");
      expect(next).toBeDefined();
      expect(next!.dueAt).toBe(addDays(mon, 1));
      expect(next!.recurrenceOrdinal).toBe(2);
    });

    it("does not create next occurrence when count is exhausted", () => {
      const os = makeOS();
      const mon = new Date(2025, 0, 6).getTime();
      const task = os.addTask({
        title: "One-time",
        dueAt: mon,
        recurrence: { freq: "daily", interval: 1, count: 1 },
      });
      os.completeTask(task.id);
      const all = Object.values(os.getState().tasks);
      const next = all.find((t) => t.recurrenceId === task.recurrenceId && t.status !== "done");
      expect(next).toBeUndefined();
    });

    it("advances weekly recurrence to next week", () => {
      const os = makeOS();
      const mon = new Date(2025, 0, 6).getTime();
      const task = os.addTask({
        title: "Weekly review",
        dueAt: mon,
        recurrence: { freq: "weekly", interval: 1 },
      });
      os.completeTask(task.id);
      const all = Object.values(os.getState().tasks);
      const next = all.find((t) => t.recurrenceId === task.recurrenceId && t.status !== "done");
      expect(next).toBeDefined();
      expect(next!.dueAt).toBe(addDays(mon, 7));
    });
  });

  describe("reminders", () => {
    it("adds multiple reminders to a task", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test", dueAt: 1000000 });
      const r1 = os.addReminder(task.id, { offsetMin: -60 });
      const r2 = os.addReminder(task.id, { offsetMin: -15 });
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      const reminders = os.remindersForTask(task.id);
      expect(reminders).toHaveLength(2);
    });

    it("resolves all unfired reminders on task completion", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test", dueAt: 1000000 });
      os.addReminder(task.id, { offsetMin: -60 });
      os.addReminder(task.id, { offsetMin: -15 });
      os.completeTask(task.id);
      const reminders = os.remindersForTask(task.id);
      expect(reminders.every((r) => r.firedAt != null)).toBe(true);
    });

    it("removes reminder and cleans up task reference", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test", dueAt: 1000000 });
      const r = os.addReminder(task.id, { offsetMin: -60 });
      expect(r).not.toBeNull();
      os.removeReminder(r!.id);
      expect(os.remindersForTask(task.id)).toHaveLength(0);
      expect(os.getTask(task.id)!.reminderIds).toHaveLength(0);
    });

    it("fires a reminder", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test", dueAt: 1000000 });
      const r = os.addReminder(task.id, { offsetMin: -60 });
      expect(r).not.toBeNull();
      const fired = os.fireReminder(r!.id);
      expect(fired).not.toBeNull();
      expect(fired!.firedAt).not.toBeNull();
    });
  });

  describe("dependencies", () => {
    it("adds and removes dependencies", () => {
      const os = makeOS();
      const a = os.addTask({ title: "A" });
      const b = os.addTask({ title: "B" });
      os.addDependency(b.id, a.id);
      expect(os.isTaskBlocked(b.id)).toBe(true);
      os.removeDependency(b.id, a.id);
      expect(os.isTaskBlocked(b.id)).toBe(false);
    });

    it("prevents self-dependency", () => {
      const os = makeOS();
      const a = os.addTask({ title: "A" });
      const result = os.addDependency(a.id, a.id);
      expect(result).toBeNull();
    });

    it("prevents cycles", () => {
      const os = makeOS();
      const a = os.addTask({ title: "A" });
      const b = os.addTask({ title: "B" });
      os.addDependency(b.id, a.id);
      const result = os.addDependency(a.id, b.id);
      expect(result).toBeNull();
    });

    it("cleans up dependsOn on task delete", () => {
      const os = makeOS();
      const a = os.addTask({ title: "A" });
      const b = os.addTask({ title: "B", dependsOn: [a.id] });
      os.deleteTask(a.id);
      expect(os.getTask(b.id)!.dependsOn).toHaveLength(0);
    });
  });

  describe("recurrence management", () => {
    it("sets and clears recurrence", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      os.setTaskRecurrence(task.id, { freq: "daily", interval: 1 });
      expect(os.getTask(task.id)!.recurrence).not.toBeNull();
      expect(os.getTask(task.id)!.recurrenceId).not.toBeNull();
      os.clearTaskRecurrence(task.id);
      expect(os.getTask(task.id)!.recurrence).toBeNull();
    });

    it("skips to next occurrence", () => {
      const os = makeOS();
      const mon = new Date(2025, 0, 6).getTime();
      const task = os.addTask({
        title: "Daily",
        dueAt: mon,
        recurrence: { freq: "daily", interval: 1 },
      });
      const next = os.skipRecurrence(task.id);
      expect(next).not.toBeNull();
      expect(next!.dueAt).toBe(addDays(mon, 1));
      expect(os.getTask(task.id)!.status).toBe("cancelled");
    });

    it("syncs overdue recurring tasks", () => {
      const os = makeOS();
      const mon = new Date(2025, 0, 6).getTime();
      const now = addDays(mon, 3);
      os.addTask({
        title: "Daily",
        dueAt: mon,
        recurrence: { freq: "daily", interval: 1 },
      });
      const count = os.syncRecurringTasks(now);
      expect(count).toBe(1);
      const task = Object.values(os.getState().tasks)[0]!;
      expect(task.dueAt).toBe(now);
    });
  });

  describe("attachments and time blocks", () => {
    it("adds attachment to task", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      const att = os.addTaskAttachment(task.id, {
        name: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        source: "upload",
        url: null,
      });
      expect(att).not.toBeNull();
      expect(os.getState().attachments[att!.id]).toBeDefined();
    });

    it("creates time block for task", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      const block = os.blockTask(task.id, { startsAt: 1000000, durationMin: 30 });
      expect(block).not.toBeNull();
      expect(os.getState().timeBlocks[block!.id]).toBeDefined();
      expect(block!.taskId).toBe(task.id);
    });
  });

  describe("convenience setters", () => {
    it("sets category", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      os.setTaskCategory(task.id, "cat1");
      expect(os.getTask(task.id)!.categoryId).toBe("cat1");
    });

    it("sets assignee", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      os.setTaskAssignee(task.id, "user1");
      expect(os.getTask(task.id)!.assigneeId).toBe("user1");
    });

    it("sets priority", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      os.setTaskPriority(task.id, 3);
      expect(os.getTask(task.id)!.priority).toBe(3);
    });

    it("links and unlinks goals", () => {
      const os = makeOS();
      const task = os.addTask({ title: "Test" });
      const goal = os.addGoal("Get fit");
      os.linkTaskToGoal(task.id, goal.id);
      expect(os.getTask(task.id)!.goalIds).toContain(goal.id);
      os.unlinkTaskFromGoal(task.id, goal.id);
      expect(os.getTask(task.id)!.goalIds).not.toContain(goal.id);
    });
  });
});
