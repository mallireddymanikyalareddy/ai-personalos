import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { planTemplatePayload, startOfDay } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { PlannerModule } from "./planner-module";

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

function renderPlanner() {
  return render(
    <ToastProvider>
      <PlannerModule />
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

describe("every section renders", () => {
  it("shows the header, timeline, plan panel, rail and bottom cards", () => {
    renderPlanner();

    expect(screen.getByRole("heading", { name: "Planner" })).toBeDefined();
    expect(screen.getByTestId("planner-header")).toBeDefined();
    expect(screen.getByTestId("planner-day-title")).toBeDefined();
    expect(screen.getByTestId("planner-plan-panel")).toBeDefined();
    expect(screen.getByTestId("planner-assistant")).toBeDefined();
    expect(screen.getByTestId("planner-focus")).toBeDefined();
    expect(screen.getByTestId("planner-priorities")).toBeDefined();
    expect(screen.getByTestId("planner-weekly")).toBeDefined();
    expect(screen.getByTestId("planner-goals")).toBeDefined();
    expect(screen.getByTestId("planner-habits")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Planning tools" })).toBeDefined();
  });

  it("opens in the saved default view", () => {
    os.updateSettings({ defaultPlanningView: "week" });
    renderPlanner();

    expect(screen.getByTestId("planner-view-week").getAttribute("aria-pressed")).toBe("true");
  });

  it("switches between day, week, month and timeline views", () => {
    renderPlanner();

    fireEvent.click(screen.getByTestId("planner-view-month"));
    expect(screen.getByTestId("planner-month")).toBeDefined();
    expect(screen.getAllByTestId("planner-month-day").length).toBeGreaterThanOrEqual(28);

    fireEvent.click(screen.getByTestId("planner-view-week"));
    expect(screen.queryByTestId("planner-month")).toBeNull();

    fireEvent.click(screen.getByTestId("planner-view-timeline"));
    expect(screen.queryByTestId("planner-month")).toBeNull();

    fireEvent.click(screen.getByTestId("planner-view-day"));
    expect(screen.getByTestId("planner-day-title")).toBeDefined();
  });
});

describe("plan panel", () => {
  it("lists tasks due on the selected day and toggles them", () => {
    const task = os.addTask({ title: "Update runbook", status: "open", dueAt: now + 2 * 3_600_000 });

    renderPlanner();

    const row = screen.getAllByTestId("planner-task-row")[0]!;
    expect(within(row).getByText("Update runbook")).toBeDefined();

    fireEvent.click(within(row).getByRole("checkbox", { name: /Complete Update runbook/ }));
    expect(os.getTask(task.id)?.status).toBe("done");
  });

  it("filters by work and high priority", () => {
    os.addTask({ title: "Work task", status: "open", tags: ["work"], dueAt: now + 3_600_000 });
    os.addTask({ title: "Personal task", status: "open", tags: ["personal"], dueAt: now + 2 * 3_600_000 });
    os.addTask({ title: "Urgent task", status: "open", priority: 3, dueAt: now + 3 * 3_600_000 });

    renderPlanner();

    fireEvent.click(screen.getByTestId("planner-filter-work"));
    const workList = within(screen.getByTestId("planner-task-list"));
    expect(workList.getAllByTestId("planner-task-row")).toHaveLength(1);
    expect(workList.getByText("Work task")).toBeDefined();

    fireEvent.click(screen.getByTestId("planner-filter-high"));
    const highList = within(screen.getByTestId("planner-task-list"));
    expect(highList.getAllByTestId("planner-task-row")).toHaveLength(1);
    expect(highList.getByText("Urgent task")).toBeDefined();

    fireEvent.click(screen.getByTestId("planner-filter-all"));
    expect(within(screen.getByTestId("planner-task-list")).getAllByTestId("planner-task-row")).toHaveLength(3);
  });

  it("adds a task to the plan", () => {
    renderPlanner();

    fireEvent.change(screen.getByLabelText("Add a task to the plan"), { target: { value: "Write spec" } });
    fireEvent.submit(screen.getByLabelText("Add a task to the plan").closest("form")!);

    expect(Object.values(os.getState().tasks).map((task) => task.title)).toContain("Write spec");
    expect(within(screen.getByTestId("planner-task-list")).getByText("Write spec")).toBeDefined();
  });

  it("switches to goals, habits and notes tabs", () => {
    const goal = os.addGoal({ title: "Ship phase two" }, now - 30 * DAY);
    os.addGoalMetric(goal.id, { label: "Done", current: 30, target: 100, unit: "%" });
    os.addHabit({ title: "Read", cadence: "daily" }, now - 20 * DAY);
    os.addNote({ title: "Kickoff notes" });

    renderPlanner();

    fireEvent.click(screen.getByTestId("planner-tab-goals"));
    expect(within(screen.getByTestId("planner-goal-list")).getByText("Ship phase two")).toBeDefined();

    fireEvent.click(screen.getByTestId("planner-tab-habits"));
    expect(within(screen.getByTestId("planner-habit-list")).getByText("Read")).toBeDefined();

    fireEvent.click(screen.getByTestId("planner-tab-notes"));
    expect(within(screen.getByTestId("planner-note-list")).getByText("Kickoff notes")).toBeDefined();
  });

  it("shows the counts on each tab", () => {
    os.addTask({ title: "A", status: "open", dueAt: now + 3_600_000 });
    os.addTask({ title: "B", status: "open" });

    renderPlanner();
    expect(screen.getByTestId("planner-tab-tasks").textContent).toContain("2");
  });
});

describe("AI planning", () => {
  it("opens a generated plan proposal and can dismiss it", () => {
    renderPlanner();

    fireEvent.click(screen.getByTestId("planner-create-plan"));
    expect(screen.getByText("Suggested plan")).toBeDefined();
    expect(screen.getByText(/Nothing to plan in this window/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Suggested plan")).toBeNull();
  });

  it("generates a plan with real slots and applies it", () => {
    os.addTask({ title: "Draft the proposal", status: "open", estimateMin: 60, dueAt: now + DAY });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-generate-plan"));

    expect(screen.getByText("Suggested plan")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /apply plan|apply/i }));

    const blocks = Object.values(os.getState().timeBlocks);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((block) => block.title.includes("Draft the proposal"))).toBe(true);
  });

  it("adds a real focus block from the assistant", () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: "Assistant options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Show options" }));

    fireEvent.click(screen.getByTestId("planner-tool-focus"));
    expect(Object.values(os.getState().timeBlocks).map((block) => block.title)).toContain("Focus time");
  });

  it("plans the whole week from Generate Plan", () => {
    os.addTask({ title: "Weekly deep work", status: "open", estimateMin: 120, dueAt: now + 2 * DAY });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-generate"));
    expect(screen.getByText("Suggested plan")).toBeDefined();
  });
});

describe("focus and weekly cards", () => {
  it("summarises focus time from planned blocks", () => {
    os.addTimeBlock({
      title: "Deep work",
      startsAt: now + 3_600_000,
      endsAt: now + 4 * 3_600_000,
      kind: "focus",
      source: "manual",
    });

    renderPlanner();

    const focus = within(screen.getByTestId("planner-focus"));
    expect(focus.getByText("Deep Work")).toBeDefined();
    expect(focus.getAllByText("3h").length).toBeGreaterThan(0);
    expect(focus.getByTestId("planner-focus-slice-deep")).toBeDefined();
  });

  it("shows the week with per-day counts and selects a day", () => {
    renderPlanner();

    const days = screen.getAllByTestId("planner-week-day");
    expect(days).toHaveLength(7);

    fireEvent.click(days[6]!);
    expect(days[6]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("lists goal progress and habit tiles", () => {
    const goal = os.addGoal({ title: "Get fit" }, now - 30 * DAY);
    os.addGoalMetric(goal.id, { label: "Miles", current: 50, target: 100, unit: "mi" });
    os.addHabit({ title: "Exercise", cadence: "daily" }, now - 10 * DAY);

    renderPlanner();

    expect(within(screen.getByTestId("planner-goals")).getByText("Get fit")).toBeDefined();
    expect(within(screen.getByTestId("planner-habits")).getByText("Exercise")).toBeDefined();
  });

  it("shows today's priorities from planning candidates", () => {
    os.addTask({ title: "Urgent thing", status: "open", priority: 4, dueAt: now - DAY });

    renderPlanner();

    const priorities = within(screen.getByTestId("planner-priorities"));
    expect(priorities.getByText("Urgent thing")).toBeDefined();
  });
});

function expandAssistantTools(): void {
  fireEvent.click(screen.getByRole("button", { name: "Assistant options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Show options" }));
}

describe("planner regressions", () => {
  it("steps months without drifting the day of month", () => {
    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-view-month"));
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(screen.getByTestId("planner-day-title").textContent).toContain("Nov 2026");
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    expect(screen.getByTestId("planner-day-title").textContent).toContain("Oct 2026");
  });

  it("labels the plan panel for the selected day", () => {
    renderPlanner();
    expect(screen.getByTestId("planner-plan-panel").textContent).toContain("Plan for Today");

    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    const panel = screen.getByTestId("planner-plan-panel").textContent ?? "";
    expect(panel).toContain("Plan for");
    expect(panel).not.toContain("Plan for Today");
  });

  it("filters to tasks with no date or schedule", () => {
    os.addTask({ title: "Backlog item", status: "open" });
    os.addTask({ title: "Dated item", status: "open", dueAt: now + 3_600_000 });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-filter-unscheduled"));

    const list = within(screen.getByTestId("planner-task-list"));
    expect(list.getByText("Backlog item")).toBeDefined();
    expect(list.queryByText("Dated item")).toBeNull();
  });

  it("changes focus totals with the selected period", () => {
    const monday = new Date(2026, 9, 5, 10, 0, 0, 0).getTime();
    os.addTimeBlock({
      title: "Monday deep work",
      startsAt: monday,
      endsAt: monday + 2 * 3_600_000,
      kind: "focus",
      source: "manual",
    });
    os.addTimeBlock({
      title: "Thursday deep work",
      startsAt: now + 3_600_000,
      endsAt: now + 4 * 3_600_000,
      kind: "focus",
      source: "manual",
    });

    renderPlanner();
    expect(within(screen.getByTestId("planner-focus")).getAllByText("5h").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Focus period" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Today" }));
    expect(within(screen.getByTestId("planner-focus")).getAllByText("3h").length).toBeGreaterThan(0);
  });

  it("toggles a habit from the habit tracker", () => {
    const habit = os.addHabit({ title: "Stretch", cadence: "daily" }, now - 5 * DAY);

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-habit-tile"));
    expect(os.habitCheckedOn(habit.id, startOfDay(now))).toBe(true);

    fireEvent.click(screen.getByTestId("planner-habit-tile"));
    expect(os.habitCheckedOn(habit.id, startOfDay(now))).toBe(false);
  });

  it("shows the active AI model in the assistant", () => {
    os.updateSettings({ aiProvider: "openai" });
    renderPlanner();
    expect(within(screen.getByTestId("planner-assistant")).getByText("OpenAI GPT")).toBeDefined();
  });

  it("explains that planning is off instead of pretending the day is empty", () => {
    os.updatePlanningPreferences({ enabled: false });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-create-plan"));
    expect(screen.getByText(/AI planning is off\. Turn it on/)).toBeDefined();
  });

  it("never creates a focus block in the past", () => {
    renderPlanner();
    expandAssistantTools();
    fireEvent.click(screen.getByTestId("planner-tool-focus"));

    const blocks = Object.values(os.getState().timeBlocks);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.startsAt).toBeGreaterThan(now);
  });

  it("time-blocks several ready tasks into future slots", () => {
    os.addTask({ title: "First", status: "open", priority: 4, dueAt: now + 3_600_000, estimateMin: 30 });
    os.addTask({ title: "Second", status: "open", priority: 3, dueAt: now + 3_600_000, estimateMin: 30 });

    renderPlanner();
    expandAssistantTools();
    fireEvent.click(screen.getByTestId("planner-tool-block"));

    const blocks = Object.values(os.getState().timeBlocks);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((block) => block.startsAt > now)).toBe(true);
  });

  it("undoes an applied plan", () => {
    os.addTask({ title: "Draft the proposal", status: "open", estimateMin: 60, dueAt: now + DAY });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-generate-plan"));
    fireEvent.click(screen.getByRole("button", { name: /apply plan|apply/i }));
    expect(Object.values(os.getState().timeBlocks).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(Object.values(os.getState().timeBlocks)).toHaveLength(0);
  });

  it("undoes a deleted time block", () => {
    os.addTimeBlock({
      title: "Deep work",
      startsAt: now + 3_600_000,
      endsAt: now + 2 * 3_600_000,
      kind: "focus",
      source: "manual",
    });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-view-timeline"));
    fireEvent.click(screen.getByRole("button", { name: /Deep work/ }));
    fireEvent.click(screen.getByRole("button", { name: /Delete block/ }));
    expect(Object.values(os.getState().timeBlocks)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(Object.values(os.getState().timeBlocks)).toHaveLength(1);
  });

  it("opens a day from the week header", () => {
    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-view-week"));
    fireEvent.click(screen.getAllByRole("button", { name: /^Open / })[0]!);
    expect(screen.getByTestId("planner-view-day").getAttribute("aria-pressed")).toBe("true");
  });
});
describe("planner new surfaces", () => {
  it("resizes a time block by dragging its bottom edge", () => {
    const block = os.addTimeBlock({
      title: "Deep work",
      startsAt: now + 3_600_000,
      endsAt: now + 2 * 3_600_000,
      kind: "focus",
      source: "manual",
    });

    renderPlanner();
    const chip = screen.getByRole("button", { name: "Deep work" });
    const handle = within(chip).getByTestId("planner-resize-end");

    fireEvent.mouseDown(handle, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 111.5 });
    fireEvent.mouseUp(window);

    expect(os.getState().timeBlocks[block.id]?.endsAt).toBe(now + 2 * 3_600_000 + 15 * 60_000);
  });

  it("refuses to resize a block into another item", () => {
    const block = os.addTimeBlock({
      title: "Deep work",
      startsAt: now + 3_600_000,
      endsAt: now + 2 * 3_600_000,
      kind: "focus",
      source: "manual",
    });
    os.addTimeBlock({
      title: "Next up",
      startsAt: now + 2 * 3_600_000,
      endsAt: now + 3 * 3_600_000,
      kind: "focus",
      source: "manual",
    });

    renderPlanner();
    const chip = screen.getByRole("button", { name: "Deep work" });
    const handle = within(chip).getByTestId("planner-resize-end");

    fireEvent.mouseDown(handle, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 130 });
    fireEvent.mouseUp(window);

    expect(os.getState().timeBlocks[block.id]?.endsAt).toBe(now + 2 * 3_600_000);
  });

  it("schedules a task from the plan panel picker", () => {
    const task = os.addTask({ title: "Write spec", status: "open", dueAt: now + 3_600_000 });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-schedule-task"));
    expect(screen.getByText("Schedule task")).toBeDefined();

    fireEvent.click(screen.getAllByTestId("schedule-suggestion")[0]!);
    fireEvent.click(screen.getByTestId("schedule-task-submit"));

    const blocks = Object.values(os.getState().timeBlocks);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.taskId).toBe(task.id);
    expect(os.getTask(task.id)?.scheduledAt).toBe(blocks[0]!.startsAt);
  });

  it("opens the schedule picker for an unscheduled task in a proposal", () => {
    os.updatePlanningPreferences({ dayStart: "09:00", dayEnd: "10:00" });
    os.addTask({ title: "Monster task", status: "open", estimateMin: 120 });

    renderPlanner();
    fireEvent.click(screen.getByTestId("planner-create-plan"));
    fireEvent.click(screen.getByTestId("proposal-schedule-task"));

    expect(screen.queryByText("Suggested plan")).toBeNull();
    expect(screen.getByText("Schedule task")).toBeDefined();
  });

  it("saves and replays a plan template", () => {
    const block = os.addTimeBlock({
      title: "Deep work",
      startsAt: now + 3_600_000,
      endsAt: now + 2 * 3_600_000,
      kind: "focus",
      source: "manual",
    });

    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "Planner options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Plan templates/ }));

    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "My day" } });
    fireEvent.change(screen.getByLabelText("Template range"), { target: { value: "day" } });
    fireEvent.click(screen.getByTestId("save-plan-template"));

    const template = os.templates().find((entry) => entry.name === "My day");
    expect(template).toBeDefined();
    expect(planTemplatePayload(template!)?.blocks).toHaveLength(1);

    os.deleteTimeBlock(block.id);
    fireEvent.click(screen.getByTestId("apply-plan-template-day"));

    expect(Object.values(os.getState().timeBlocks)).toHaveLength(1);
    expect(os.templateById(template!.id)?.useCount).toBe(1);
  });

  it("does not save an empty plan template", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "Planner options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Plan templates/ }));
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Empty" } });
    fireEvent.click(screen.getByTestId("save-plan-template"));

    expect(os.templates().find((entry) => entry.name === "Empty")).toBeUndefined();
  });
});