import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { GoalsModule } from "./goals-module";

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

function renderGoals() {
  return render(
    <ToastProvider>
      <GoalsModule />
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

function addGoal(
  input: Parameters<typeof os.addGoal>[0],
  createdAt = now - 50 * DAY,
) {
  return os.addGoal(input, createdAt);
}

describe("every section renders", () => {
  it("shows all dashboard sections with no goals", () => {
    renderGoals();

    expect(screen.getByRole("heading", { name: "Goals" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Add Goal/ })).toBeDefined();
    expect(screen.getByTestId("goals-stats")).toBeDefined();
    expect(screen.getByTestId("goals-filters")).toBeDefined();
    expect(screen.getByTestId("goals-by-category")).toBeDefined();
    expect(screen.getByTestId("goals-timeline")).toBeDefined();
    expect(screen.getByTestId("goals-assistant")).toBeDefined();
    expect(screen.getByTestId("goals-quick-add")).toBeDefined();
    expect(screen.getByTestId("goals-milestones")).toBeDefined();
    expect(screen.getByTestId("goals-insights")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Goal tools" })).toBeDefined();
    expect(screen.getByText("No goals yet")).toBeDefined();
  });

  it("loads sample goals into the dashboard", () => {
    renderGoals();

    fireEvent.click(screen.getByRole("button", { name: /Load sample goals/i }));

    expect(Object.keys(os.getState().goals)).toHaveLength(4);
    expect(screen.getByText("Run a half marathon")).toBeDefined();
    expect(screen.getByText("Save for an emergency fund")).toBeDefined();
    expect(screen.getByText("Read 12 books this year")).toBeDefined();
    expect(screen.getByText("Get promoted to senior engineer")).toBeDefined();
    expect(screen.queryByText("No goals yet")).toBeNull();
  });

  it("renders empty states inside the panels", () => {
    renderGoals();
    expect(screen.getByText("No upcoming milestones. Link a project to a goal and add milestones.")).toBeDefined();
    expect(screen.getByText("No goals yet.")).toBeDefined();
    expect(screen.getByTestId("goals-health-donut")).toBeDefined();
    expect(screen.getByTestId("goals-insight-text").textContent?.length).toBeGreaterThan(0);
  });

  it("renders a timeline chart", () => {
    renderGoals();
    expect(screen.getByTestId("goals-progress-line")).toBeDefined();
    expect(screen.getByTestId("goals-timeline-range").textContent).toMatch(/\w+ \d{2}/);
  });
});

describe("stat tiles", () => {
  it("counts in-progress, completed, overdue and due-this-quarter", () => {
    addGoal({ title: "Active one", category: "health", targetAt: now + 40 * DAY });
    addGoal({ title: "Active two", category: "health", targetAt: now + 40 * DAY });
    addGoal({ title: "Overdue one", category: "career", targetAt: now - 2 * DAY });
    const done = addGoal({ title: "Finished", category: "learning" });
    os.completeGoal(done.id, now);

    renderGoals();
    expect(within(screen.getByTestId("goals-stat-progress")).getByText("2")).toBeDefined();
    expect(within(screen.getByTestId("goals-stat-progress")).getByText("/ 4")).toBeDefined();
    expect(within(screen.getByTestId("goals-stat-completed")).getByText("1")).toBeDefined();
    expect(within(screen.getByTestId("goals-stat-overdue")).getByText("1")).toBeDefined();
    expect(within(screen.getByTestId("goals-stat-quarter")).getByText("3")).toBeDefined();
  });

  it("shows a delta chip when prior data exists", () => {
    addGoal({ title: "Recent" }, now - 10 * DAY);
    addGoal({ title: "Older" }, now - 45 * DAY);
    renderGoals();
    expect(within(screen.getByTestId("goals-stat-progress")).getAllByText(/vs last month/).length).toBeGreaterThan(0);
  });
});

describe("goal cards", () => {
  it("shows the category badge, progress, metric target and health", () => {
    const goal = addGoal(
      { title: "Grow Wealth", category: "financial", targetAt: new Date(2031, 11, 31).getTime() },
      now - 50 * DAY,
    );
    os.addGoalMetric(goal.id, { label: "Savings", current: 5, target: 10, unit: "Cr" });

    renderGoals();
    const card = screen.getByTestId(`goal-card-${goal.id}`);
    expect(within(card).getByText("Financial")).toBeDefined();
    expect(within(card).getByText("Grow Wealth")).toBeDefined();
    expect(within(card).getByText("50%")).toBeDefined();
    expect(within(card).getByText(/Target: 5 \/ 10 Cr by/)).toBeDefined();
    expect(within(card).getByRole("button", { name: "Actions for Grow Wealth" })).toBeDefined();
  });

  it("shows a category placeholder when there is no cover", () => {
    const goal = addGoal({ title: "No cover", category: "sports" });
    renderGoals();
    const card = screen.getByTestId(`goal-card-${goal.id}`);
    expect(card.querySelector("img")).toBeNull();
  });

  it("filters by tab", () => {
    addGoal({ title: "Active thing", category: "career" });
    const held = addGoal({ title: "Held thing", category: "career" });
    os.updateGoal(held.id, { status: "on_hold" });

    renderGoals();
    expect(screen.getByText("Active thing")).toBeDefined();

    fireEvent.click(screen.getByRole("radio", { name: "On Hold" }));
    expect(screen.getByText("Held thing")).toBeDefined();
    expect(screen.queryByText("Active thing")).toBeNull();
  });

  it("shows an empty-filter message when nothing matches", () => {
    addGoal({ title: "Active only", category: "career" });
    renderGoals();
    fireEvent.click(screen.getByRole("radio", { name: "Completed" }));
    expect(screen.getByTestId("goals-empty-filter")).toBeDefined();
  });

  it("filters by category", () => {
    addGoal({ title: "Health goal", category: "health" });
    addGoal({ title: "Career goal", category: "career" });

    renderGoals();
    fireEvent.click(screen.getByRole("button", { name: /Category filter/ }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Health" }));

    expect(screen.getByText("Health goal")).toBeDefined();
    expect(screen.queryByText("Career goal")).toBeNull();
  });
});

describe("card menu actions", () => {
  function openMenu(title: string) {
    fireEvent.click(screen.getByRole("button", { name: `Actions for ${title}` }));
    return screen.getByRole("menu");
  }

  it("completes and reopens a goal", () => {
    const goal = addGoal({ title: "Finish me", category: "learning" });
    renderGoals();

    fireEvent.click(within(openMenu("Finish me")).getByRole("menuitem", { name: /Mark complete/ }));
    expect(os.getGoal(goal.id)?.status).toBe("completed");

    fireEvent.click(within(openMenu("Finish me")).getByRole("menuitem", { name: /Reopen goal/ }));
    expect(os.getGoal(goal.id)?.status).toBe("active");
  });

  it("puts a goal on hold and resumes it", () => {
    const goal = addGoal({ title: "Pause me" });
    renderGoals();

    fireEvent.click(within(openMenu("Pause me")).getByRole("menuitem", { name: /Put on hold/ }));
    expect(os.getGoal(goal.id)?.status).toBe("on_hold");

    fireEvent.click(within(openMenu("Pause me")).getByRole("menuitem", { name: /Resume goal/ }));
    expect(os.getGoal(goal.id)?.status).toBe("active");
  });

  it("deletes a goal", () => {
    const goal = addGoal({ title: "Delete me" });
    renderGoals();

    fireEvent.click(within(openMenu("Delete me")).getByRole("menuitem", { name: /Delete goal/ }));
    expect(os.getGoal(goal.id)).toBeNull();
  });

  it("opens the edit dialog from the menu", () => {
    addGoal({ title: "Edit me", category: "career" });
    renderGoals();

    fireEvent.click(within(openMenu("Edit me")).getByRole("menuitem", { name: /Edit goal/ }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("Title") as HTMLInputElement).value).toBe("Edit me");
    expect((within(dialog).getByLabelText("Category") as HTMLSelectElement).value).toBe("career");
  });
});

describe("create goal dialog", () => {
  it("creates a goal with a category", () => {
    renderGoals();
    fireEvent.click(screen.getByRole("button", { name: /Add Goal/ }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Learn Spanish" } });
    fireEvent.change(within(dialog).getByLabelText("Category"), { target: { value: "learning" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create goal" }));

    const goals = Object.values(os.getState().goals);
    expect(goals).toHaveLength(1);
    expect(goals[0]!.title).toBe("Learn Spanish");
    expect(goals[0]!.category).toBe("learning");
    expect(screen.getByText("Learn Spanish")).toBeDefined();
  });

  it("keeps create disabled until there is a title", () => {
    renderGoals();
    fireEvent.click(screen.getByRole("button", { name: /Add Goal/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Create goal" })).toHaveProperty("disabled", true);
  });
});

describe("quick add", () => {
  it("creates a goal in the chosen category", () => {
    renderGoals();
    const panel = screen.getByTestId("goals-quick-add");
    fireEvent.change(within(panel).getByLabelText("What's your new goal"), {
      target: { value: "Run 5k" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: /Health/ }));

    const goals = Object.values(os.getState().goals);
    expect(goals).toHaveLength(1);
    expect(goals[0]!.title).toBe("Run 5k");
    expect(goals[0]!.category).toBe("health");
  });

  it("refuses an empty quick add", () => {
    renderGoals();
    const panel = screen.getByTestId("goals-quick-add");
    fireEvent.click(within(panel).getByRole("button", { name: /Career/ }));
    expect(Object.keys(os.getState().goals)).toHaveLength(0);
  });
});

describe("AI goal assistant", () => {
  it("answers a typed question", () => {
    renderGoals();
    fireEvent.change(screen.getByLabelText("Ask the goal assistant"), {
      target: { value: "Create a plan for my goals" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByTestId("goals-assistant-answer")).toBeDefined();
  });

  it("runs the shortcut actions", () => {
    renderGoals();
    fireEvent.click(screen.getByRole("button", { name: "Suggest next steps" }));
    expect(screen.getByTestId("goals-assistant-answer")).toBeDefined();
  });
});

describe("upcoming milestones", () => {
  it("lists milestones from projects linked to goals", () => {
    const goal = addGoal({ title: "Be fit", category: "health" });
    const project = os.addProject({ name: "Training" }, now);
    os.linkGoalToProject(project.id, goal.id);
    os.addMilestone({ projectId: project.id, title: "Run 5k", dueAt: now + 5 * DAY }, now);

    renderGoals();
    const panel = screen.getByTestId("goals-milestones");
    expect(within(panel).getByText("Run 5k")).toBeDefined();
    expect(within(panel).getAllByTestId("goals-milestone-row")).toHaveLength(1);
  });
});

describe("goal insights", () => {
  it("summarises progress and health", () => {
    const created = now - 100 * DAY;
    const onTrack = addGoal({ title: "On track", targetAt: now + 100 * DAY }, created);
    os.addGoalMetric(onTrack.id, { label: "X", current: 50, target: 100, unit: "x" });
    const risky = addGoal({ title: "At risk", targetAt: now + 100 * DAY }, created);
    os.addGoalMetric(risky.id, { label: "X", current: 5, target: 100, unit: "x" });

    renderGoals();
    const panel = screen.getByTestId("goals-insights");
    expect(within(panel).getByText("On Track")).toBeDefined();
    expect(within(panel).getByText("At Risk")).toBeDefined();
    expect(screen.getByTestId("goals-insight-text").textContent).toBeTruthy();
  });
});

describe("goals by category", () => {
  it("shows a bar per populated category", () => {
    const created = now - 50 * DAY;
    const a = addGoal({ title: "A", category: "financial" }, created);
    const b = addGoal({ title: "B", category: "financial" }, created);
    os.addGoalMetric(a.id, { label: "S", current: 60, target: 100, unit: "%" });
    os.addGoalMetric(b.id, { label: "S", current: 80, target: 100, unit: "%" });
    addGoal({ title: "C", category: "sports" }, created);

    renderGoals();
    const chart = screen.getByTestId("goals-category-bars");
    expect(chart.querySelector(".recharts-responsive-container")).not.toBeNull();
  });
});

describe("reactivity", () => {
  it("updates the stats and grid when a goal is added after mount", () => {
    renderGoals();
    expect(screen.queryByText("Added later")).toBeNull();

    act(() => {
      os.addGoal({ title: "Added later", category: "career" }, now);
    });

    expect(screen.getByText("Added later")).toBeDefined();
    expect(within(screen.getByTestId("goals-stat-progress")).getByText("1")).toBeDefined();
  });
});
describe("goal page fixes", () => {
  it("updates a metric current value from the detail sheet", () => {
    const goal = addGoal({
      title: "Run a half marathon",
      metrics: [{ label: "Kilometres", current: 0, target: 21, unit: "km" }],
    });

    renderGoals();

    fireEvent.click(screen.getByRole("button", { name: "Open goal Run a half marathon" }));
    const input = screen.getByLabelText("Kilometres current") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "10" } });

    expect(os.getState().goals[goal.id]?.metrics[0]?.current).toBe(10);
    expect(screen.getAllByText("48%").length).toBeGreaterThan(0);
  });

  it("links a task to a goal from the detail sheet", () => {
    const goal = addGoal({ title: "Ship the app" });
    const task = os.addTask({ title: "Write release notes" });

    renderGoals();

    fireEvent.click(screen.getByRole("button", { name: "Open goal Ship the app" }));
    fireEvent.click(screen.getByRole("button", { name: /^Tasks \(/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Write release notes" }));

    expect(os.getState().tasks[task.id]?.goalIds).toContain(goal.id);
  });

  it("links a project and a habit to a goal", () => {
    const goal = addGoal({ title: "Get healthy" });
    const project = os.addProject({ name: "Fitness plan" });
    const habit = os.addHabit({ title: "Morning walk" });

    renderGoals();

    fireEvent.click(screen.getByRole("button", { name: "Open goal Get healthy" }));

    fireEvent.click(screen.getByRole("button", { name: /^Projects \(/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fitness plan" }));
    expect(os.getState().projects[project.id]?.goalIds).toContain(goal.id);

    fireEvent.click(screen.getByRole("button", { name: /^Habits \(/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Morning walk" }));
    expect(os.getState().habits[habit.id]?.goalId).toBe(goal.id);
  });

  it("archives a goal and lists it under the archived tab", () => {
    const goal = addGoal({ title: "Learn piano" });

    renderGoals();

    fireEvent.click(screen.getByRole("button", { name: "Actions for Learn piano" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive goal" }));
    expect(os.getState().goals[goal.id]?.status).toBe("archived");
    expect(screen.queryByText("Learn piano")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Archived" }));
    expect(screen.getByText("Learn piano")).toBeDefined();
  });

  it("restores an archived goal", () => {
    const goal = addGoal({ title: "Old goal" });
    os.updateGoal(goal.id, { status: "archived" });

    renderGoals();
    fireEvent.click(screen.getByRole("radio", { name: "Archived" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Old goal" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore goal" }));

    expect(os.getState().goals[goal.id]?.status).toBe("active");
  });

  it("labels an at-risk goal as At Risk", () => {
    addGoal({ title: "At risk goal", targetAt: now + 100 * DAY }, now - 200 * DAY);

    renderGoals();

    const card = screen.getByTestId("goals-grid");
    expect(within(card).getByText("At Risk")).toBeDefined();
  });
});