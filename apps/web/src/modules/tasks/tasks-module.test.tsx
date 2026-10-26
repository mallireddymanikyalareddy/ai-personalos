import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { TasksModule } from "./tasks-module";

const DAY = 86_400_000;

let os: ReturnType<typeof getOS>;
let now: number;

function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia,
  });
}

function renderTasks() {
  return render(
    <ToastProvider>
      <TasksModule />
    </ToastProvider>,
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  now = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function addTask(input: Parameters<typeof os.addTask>[0], createdAt = now - 20 * DAY) {
  return os.addTask(input, createdAt);
}

describe("every section renders", () => {
  it("shows all dashboard sections with no tasks", () => {
    renderTasks();

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeDefined();
    expect(screen.getByTestId("tasks-add")).toBeDefined();
    expect(screen.getByTestId("tasks-stats")).toBeDefined();
    expect(screen.getByTestId("tasks-filters")).toBeDefined();
    expect(screen.getByTestId("tasks-by-project")).toBeDefined();
    expect(screen.getByTestId("tasks-priority-breakdown")).toBeDefined();
    expect(screen.getByTestId("tasks-status-breakdown")).toBeDefined();
    expect(screen.getByTestId("tasks-assistant")).toBeDefined();
    expect(screen.getByTestId("tasks-quick-add")).toBeDefined();
    expect(screen.getByTestId("tasks-deadlines")).toBeDefined();
    expect(screen.getByTestId("tasks-insights")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Task tools" })).toBeDefined();
    expect(screen.getByText("No tasks yet")).toBeDefined();
  });

  it("renders all six stat tiles", () => {
    renderTasks();
    for (const id of ["total", "completed", "inProgress", "overdue", "dueToday", "thisWeek"]) {
      expect(screen.getByTestId(`tasks-stat-${id}`)).toBeDefined();
    }
  });

  it("loads sample tasks and populates every panel", () => {
    renderTasks();

    fireEvent.click(screen.getByRole("button", { name: /Load sample tasks/i }));

    expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(10);
    expect(Object.keys(os.getState().projects).length).toBeGreaterThan(3);
    expect(screen.getAllByTestId("task-row").length).toBeGreaterThan(10);
    expect(screen.getByTestId("tasks-project-bars")).toBeDefined();
    expect(screen.getByTestId("tasks-priority-donut")).toBeDefined();
    expect(screen.getByTestId("tasks-status-bars")).toBeDefined();
    expect(screen.getByTestId("tasks-completion-donut")).toBeDefined();
    expect(screen.getAllByTestId("tasks-deadline-row").length).toBeGreaterThan(0);
  });
});

describe("stat tiles", () => {
  it("reports totals, completed, overdue and due today", () => {
    const done = addTask({ title: "Done", status: "open", dueAt: now - 3 * DAY });
    os.updateTask(done.id, { status: "done", completedAt: now - DAY });
    addTask({ title: "Active", status: "in_progress", dueAt: now + DAY });
    addTask({ title: "Late", status: "open", dueAt: now - 2 * DAY });
    addTask({ title: "Today", status: "open", dueAt: now + 2 * 3_600_000 });
    addTask({ title: "Week", status: "open", dueAt: now + 4 * DAY });

    renderTasks();

    const tile = (id: string) => within(screen.getByTestId(`tasks-stat-${id}`));
    expect(tile("total").getByText("5")).toBeDefined();
    expect(tile("completed").getByText("1")).toBeDefined();
    expect(tile("inProgress").getByText("1")).toBeDefined();
    expect(tile("overdue").getByText("1")).toBeDefined();
    expect(tile("dueToday").getByText("1")).toBeDefined();
    expect(tile("thisWeek").getByText("2")).toBeDefined();
  });

  it("shows a delta arrow when there is a comparison value", () => {
    addTask({ title: "This week 1", dueAt: now + 2 * DAY }, now - DAY);
    addTask({ title: "This week 2", dueAt: now + 3 * DAY }, now - 2 * DAY);
    addTask({ title: "Last week", dueAt: now - 8 * DAY }, now - 9 * DAY);

    renderTasks();
    expect(screen.getByTestId("tasks-stat-total").textContent).toContain("100%");
  });
});

describe("task table", () => {
  it("shows project, priority, due date, status and tags", () => {
    const project = os.addProject({ name: "D365 Support" }, now - 30 * DAY);
    addTask({
      title: "Update D365 runbook documentation",
      status: "in_progress",
      priority: 3,
      dueAt: now + 30 * 60_000,
      projectId: project.id,
      tags: ["work", "d365"],
    });

    renderTasks();

    const row = screen.getByTestId("task-row");
    expect(within(row).getByText("Update D365 runbook documentation")).toBeDefined();
    expect(within(row).getByText("D365 Support")).toBeDefined();
    expect(within(row).getByText("High")).toBeDefined();
    expect(within(row).getByText("In Progress")).toBeDefined();
    expect(within(row).getByText("#work")).toBeDefined();
    expect(within(row).getByText("#d365")).toBeDefined();
  });

  it("completes and reopens a task from the row menu", () => {
    const task = addTask({ title: "Ship it", status: "open" });

    renderTasks();

    const row = screen.getByTestId("task-row");
    fireEvent.click(within(row).getByRole("button", { name: /Ship it options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Mark complete/ }));

    expect(os.getTask(task.id)?.status).toBe("done");
    expect(screen.queryAllByTestId("task-row")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show completed" }));

    fireEvent.click(within(screen.getByTestId("task-row")).getByRole("button", { name: /Ship it options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Reopen task/ }));
    expect(os.getTask(task.id)?.status).toBe("open");
  });

  it("selects rows and the whole table", () => {
    addTask({ title: "One", status: "open" });
    addTask({ title: "Two", status: "open" });

    renderTasks();

    const rows = screen.getAllByTestId("task-row");
    fireEvent.click(within(rows[0]!).getByRole("checkbox", { name: /Select One/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Select all tasks/ }));

    expect(screen.getByTestId("tasks-stat-total").textContent).toContain("2");
  });
});

describe("filters and search", () => {
  it("filters by project", () => {
    const project = os.addProject({ name: "Support" }, now - 30 * DAY);
    addTask({ title: "In project", projectId: project.id });
    addTask({ title: "Elsewhere" });

    renderTasks();

    fireEvent.click(screen.getByRole("button", { name: "Filter by project" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Support" }));

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText("In project")).toBeDefined();
  });

  it("filters by priority", () => {
    addTask({ title: "High one", priority: 3 });
    addTask({ title: "Low one", priority: 1 });

    renderTasks();

    fireEvent.click(screen.getByRole("button", { name: "Filter by priority" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "High" }));

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText("High one")).toBeDefined();
  });

  it("searches by title", () => {
    addTask({ title: "Buy milk" });
    addTask({ title: "Ship release" });

    renderTasks();

    fireEvent.change(screen.getByLabelText("Search tasks"), { target: { value: "ship" } });

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText("Ship release")).toBeDefined();
  });

  it("resets every filter", () => {
    const project = os.addProject({ name: "Support" }, now - 30 * DAY);
    addTask({ title: "In project", projectId: project.id, priority: 3 });
    addTask({ title: "Elsewhere" });

    renderTasks();

    fireEvent.click(screen.getByRole("button", { name: "Filter by project" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Support" }));
    expect(screen.getAllByTestId("task-row")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getAllByTestId("task-row")).toHaveLength(2);
  });
});

describe("views", () => {
  it("switches to the board view", () => {
    const done = addTask({ title: "Done one", status: "open" });
    os.updateTask(done.id, { status: "done", completedAt: now });
    addTask({ title: "Active one", status: "in_progress" });
    addTask({ title: "Todo one", status: "open" });

    renderTasks();

    fireEvent.click(screen.getByTestId("tasks-view-board"));
    const board = screen.getByTestId("tasks-board");
    expect(within(board).getByText("Not Started")).toBeDefined();
    expect(within(board).getByText("In Progress")).toBeDefined();
    expect(within(board).getByText("Completed")).toBeDefined();
  });

  it("switches to the calendar view", () => {
    addTask({ title: "Dated", status: "open", dueAt: now + 2 * DAY });

    renderTasks();

    fireEvent.click(screen.getByTestId("tasks-view-calendar"));
    expect(within(screen.getByTestId("tasks-calendar")).getByText("Dated")).toBeDefined();
  });

  it("switches to the timeline view grouped by day", () => {
    addTask({ title: "Dated", status: "open", dueAt: now + 2 * DAY });

    renderTasks();

    fireEvent.click(screen.getByTestId("tasks-view-timeline"));
    expect(within(screen.getByTestId("tasks-timeline")).getByText("Dated")).toBeDefined();
  });

  it("switches to my tasks", () => {
    addTask({ title: "Mine", source: "manual" });
    addTask({ title: "Generated", source: "habit" });

    renderTasks();

    fireEvent.click(screen.getByTestId("tasks-view-mine"));
    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText("Mine")).toBeDefined();
  });
});

describe("quick add and assistant", () => {
  it("adds a task from quick add", () => {
    renderTasks();

    fireEvent.change(screen.getByLabelText("Quick add task"), { target: { value: "Water plants" } });
    fireEvent.click(screen.getByTestId("tasks-quick-add-task"));

    const tasks = Object.values(os.getState().tasks);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toBe("Water plants");
  });

  it("creates a project from quick add", () => {
    renderTasks();

    fireEvent.change(screen.getByLabelText("Quick add task"), { target: { value: "Marketing" } });
    fireEvent.click(screen.getByTestId("tasks-quick-add-project"));

    const projects = Object.values(os.getState().projects);
    expect(projects.map((project) => project.name)).toContain("Marketing");
  });

  it("creates a task and reminder from quick add", () => {
    renderTasks();

    fireEvent.change(screen.getByLabelText("Quick add task"), { target: { value: "Call the bank" } });
    fireEvent.click(screen.getByTestId("tasks-quick-add-reminder"));

    expect(Object.values(os.getState().tasks)).toHaveLength(1);
    expect(Object.values(os.getState().reminders).length).toBeGreaterThan(0);
  });

  it("does not create an untitled reminder when the input is empty", () => {
    renderTasks();

    fireEvent.click(screen.getByTestId("tasks-quick-add-reminder"));

    expect(Object.values(os.getState().tasks)).toHaveLength(0);
    expect(Object.values(os.getState().reminders)).toHaveLength(0);
  });

  it("answers a prioritization question", () => {
    addTask({ title: "Urgent one", priority: 4, status: "open", dueAt: now + DAY });

    renderTasks();

    const input = screen.getByLabelText("Ask the task assistant");
    fireEvent.change(input, { target: { value: "prioritize my tasks" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    const answer = screen.getByTestId("tasks-assistant-answer").textContent ?? "";
    expect(answer).toContain("Urgent one");
  });

  it("creates a task from the assistant create-from-text action", () => {
    renderTasks();

    fireEvent.change(screen.getByLabelText("Task text to create"), {
      target: { value: "Review the proposal" },
    });
    fireEvent.click(screen.getByTestId("tasks-assistant-create"));

    expect(Object.values(os.getState().tasks).map((task) => task.title)).toContain("Review the proposal");
  });
});

describe("insights", () => {
  it("shows a completion rate and a productivity line", () => {
    const done = addTask({ title: "Done", status: "open" }, now - DAY);
    os.updateTask(done.id, { status: "done", completedAt: now - 2 * DAY });
    const lastWeek = addTask({ title: "Earlier", status: "open" }, now - 2 * DAY);
    os.updateTask(lastWeek.id, { status: "done", completedAt: now - 8 * DAY });
    addTask({ title: "Open", status: "open" }, now - 2 * DAY);

    renderTasks();

    const insights = within(screen.getByTestId("tasks-insights"));
    expect(insights.getByText("67%")).toBeDefined();
    expect(insights.getByText(/productive this week/)).toBeDefined();
  });

  it("offers a period selector", () => {
    renderTasks();

    const select = screen.getByLabelText("Insight period") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "This Week" } });
    expect(select.value).toBe("This Week");
  });
});
describe("task page fixes", () => {
  it("duplicates a task from the row menu", () => {
    addTask({ title: "Plan offsite", priority: 2, tags: ["work"] });

    renderTasks();

    fireEvent.click(screen.getByRole("button", { name: /Plan offsite options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate task" }));

    const titles = Object.values(os.getState().tasks).map((task) => task.title).sort();
    expect(titles).toEqual(["Plan offsite", "Plan offsite (copy)"]);
  });

  it("snoozes an overdue task to tomorrow", () => {
    const task = addTask({ title: "Renew passport", status: "open", dueAt: now - DAY });

    renderTasks();

    fireEvent.click(screen.getByRole("button", { name: /Renew passport options/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Snooze 1 day" }));

    expect(os.getTask(task.id)?.dueAt).toBeGreaterThan(now);
  });

  it("my tasks includes unassigned and self-assigned tasks only", () => {
    const me = os.getState().profile.id;
    addTask({ title: "Assigned to me", assigneeId: me });
    addTask({ title: "Nobody yet" });
    addTask({ title: "Someone else owns this", assigneeId: "another-user" });

    renderTasks();
    fireEvent.click(screen.getByTestId("tasks-view-mine"));

    expect(screen.getAllByTestId("task-row")).toHaveLength(2);
    expect(screen.queryByText("Someone else owns this")).toBeNull();
  });

  it("moves the active row with j and selects it with x", () => {
    addTask({ title: "Keyboard one", status: "open" });

    renderTasks();

    fireEvent.keyDown(window, { key: "j" });
    const row = screen.getByTestId("task-row");
    expect(row.getAttribute("data-active")).toBe("true");

    fireEvent.keyDown(window, { key: "x" });
    expect((screen.getByRole("checkbox", { name: /Select Keyboard one/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("moves a card to another board column by drag and drop", () => {
    const task = addTask({ title: "Drag me", status: "open" });

    renderTasks();
    fireEvent.click(screen.getByTestId("tasks-view-board"));

    const card = screen.getByText("Drag me").closest("[draggable]") as HTMLElement;
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (key: string, value: string) => {
        store[key] = value;
      },
      getData: (key: string) => store[key] ?? "",
      effectAllowed: "",
      dropEffect: "",
    };
    const column = screen.getByRole("region", { name: "In Progress" });

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(column, { dataTransfer });
    fireEvent.drop(column, { dataTransfer });

    expect(os.getTask(task.id)?.status).toBe("in_progress");
  });

  it("requires a second click before bulk delete", () => {
    addTask({ title: "Doomed" });

    renderTasks();

    fireEvent.click(within(screen.getByTestId("task-row")).getByRole("checkbox", { name: /Select Doomed/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(Object.keys(os.getState().tasks)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Click again to delete" }));
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
  });

  it("saves the current filters as a named view", () => {
    window.localStorage.removeItem("personalos.tasks.presets");
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Urgent only");

    renderTasks();
    fireEvent.click(screen.getByRole("button", { name: "Saved views" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save current view…" }));

    const saved = JSON.parse(window.localStorage.getItem("personalos.tasks.presets") ?? "[]") as { name: string }[];
    expect(saved.map((preset) => preset.name)).toEqual(["Urgent only"]);

    prompt.mockRestore();
    window.localStorage.removeItem("personalos.tasks.presets");
  });
});