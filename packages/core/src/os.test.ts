import { describe, expect, it } from "vitest";
import { PersonalOS } from "./os";
import { createMemoryStorage } from "./store/persistence";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("PersonalOS.capture", () => {
  it("creates an open task when a date is captured", () => {
    const os = makeOS();
    const result = os.capture("Pay rent tomorrow");
    expect(result.kind).toBe("task");
    expect(result.task?.status).toBe("open");
    expect(result.task?.source).toBe("capture");
    expect(result.task?.dueAt).not.toBeNull();
  });

  it("creates an inbox task when nothing is planned", () => {
    const os = makeOS();
    const result = os.capture("Brainstorm gift ideas");
    expect(result.kind).toBe("task");
    expect(result.task?.status).toBe("inbox");
    expect(result.task?.dueAt).toBeNull();
  });

  it("creates a note for note captures", () => {
    const os = makeOS();
    const result = os.capture("note: pick up the dry cleaning");
    expect(result.kind).toBe("note");
    expect(result.note?.title).toBe("pick up the dry cleaning");
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
  });

  it("routes a capture into an existing project via tag", () => {
    const os = makeOS();
    const project = os.addProject("Work");
    const result = os.capture("Draft the plan #work");
    expect(result.task?.projectId).toBe(project.id);
    expect(result.task?.tags).toEqual([]);
  });

  it("keeps unknown hashtags as tags", () => {
    const os = makeOS();
    const result = os.capture("Buy oat milk #groceries");
    expect(result.task?.projectId).toBeNull();
    expect(result.task?.tags).toEqual(["groceries"]);
  });

  it("ignores blank captures", () => {
    const os = makeOS();
    const result = os.capture("   ");
    expect(result.kind).toBe("empty");
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
  });
});

describe("PersonalOS tasks", () => {
  it("promotes inbox tasks when they gain a plan", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Unplanned" });
    expect(task.status).toBe("inbox");
    const updated = os.updateTask(task.id, { dueAt: Date.now() + 86_400_000 });
    expect(updated?.status).toBe("open");
  });

  it("completes a task and its subtasks", () => {
    const os = makeOS();
    const parent = os.addTask({ title: "Parent", status: "open" });
    const child = os.addSubtask(parent.id, "Child");
    expect(child).not.toBeNull();

    os.completeTask(parent.id);
    expect(os.getTask(parent.id)?.status).toBe("done");
    expect(os.getTask(child!.id)?.status).toBe("done");
  });

  it("reopens a completed task", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Something", status: "open" });
    os.completeTask(task.id);
    const reopened = os.reopenTask(task.id);
    expect(reopened?.status).toBe("open");
    expect(reopened?.completedAt).toBeNull();
  });

  it("deletes a task with its subtasks", () => {
    const os = makeOS();
    const parent = os.addTask({ title: "Parent", status: "open" });
    const child = os.addSubtask(parent.id, "Child");
    os.deleteTask(parent.id);
    expect(os.getTask(parent.id)).toBeNull();
    expect(os.getTask(child!.id)).toBeNull();
  });

  it("removes project references when a project is deleted", () => {
    const os = makeOS();
    const project = os.addProject("Temp");
    const task = os.addTask({ title: "Linked", projectId: project.id });
    os.deleteProject(project.id);
    expect(os.getTask(task.id)?.projectId).toBeNull();
  });

  it("deduplicates projects by name", () => {
    const os = makeOS();
    const first = os.addProject("Health");
    const second = os.addProject("health");
    expect(second.id).toBe(first.id);
    expect(Object.keys(os.getState().projects)).toHaveLength(1);
  });
});

describe("PersonalOS data", () => {
  it("exports and imports a backup", () => {
    const os = makeOS();
    os.capture("Exported task tomorrow");
    const json = os.exportData();

    const restored = makeOS();
    const result = restored.importData(json);
    expect(result.ok).toBe(true);
    expect(Object.keys(restored.getState().tasks)).toHaveLength(1);
  });

  it("rejects invalid backups", () => {
    const os = makeOS();
    const result = os.importData("not a backup");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("clears all data", () => {
    const os = makeOS();
    os.capture("Temporary");
    os.clearAll();
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
    expect(os.getState().hydrated).toBe(true);
  });
});
