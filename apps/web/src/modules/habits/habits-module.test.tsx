import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { HabitsModule } from "./habits-module";

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

function renderHabits() {
  return render(
    <ToastProvider>
      <HabitsModule />
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

function addHabit(input: Parameters<typeof os.addHabit>[0], createdAt = now - 40 * DAY) {
  return os.addHabit(input, createdAt);
}

describe("every section renders", () => {
  it("shows all dashboard sections with no habits", () => {
    renderHabits();

    expect(screen.getByRole("heading", { name: "Habits" })).toBeDefined();
    expect(screen.getByTestId("habits-add")).toBeDefined();
    expect(screen.getByTestId("habits-stats")).toBeDefined();
    expect(screen.getByTestId("habits-filters")).toBeDefined();
    expect(screen.getByTestId("habits-insights")).toBeDefined();
    expect(screen.getByTestId("habits-donut")).toBeDefined();
    expect(screen.getByTestId("habits-month-overview")).toBeDefined();
    expect(screen.getByTestId("habits-month-line")).toBeDefined();
    expect(screen.getByTestId("habits-calendar")).toBeDefined();
    expect(screen.getByTestId("habits-assistant")).toBeDefined();
    expect(screen.getByTestId("habits-motivation")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Habit tools" })).toBeDefined();
    expect(screen.getByText("No habits yet")).toBeDefined();
  });

  it("renders all four stat tiles", () => {
    renderHabits();
    for (const id of ["streak", "success", "today", "longest"]) {
      expect(screen.getByTestId(`habits-stat-${id}`)).toBeDefined();
    }
    expect(screen.getByText("Current Streak")).toBeDefined();
    expect(screen.getByText("Success Rate")).toBeDefined();
    expect(screen.getByText("Today's Habits")).toBeDefined();
    expect(screen.getByText("Longest Streak")).toBeDefined();
  });

  it("loads sample habits and populates every panel", () => {
    renderHabits();

    fireEvent.click(screen.getByRole("button", { name: /Load sample habits/i }));

    expect(Object.keys(os.getState().habits).length).toBeGreaterThan(4);
    expect(screen.getByText("Drink Water")).toBeDefined();
    expect(screen.getAllByTestId("habit-row").length).toBeGreaterThan(4);
    expect(screen.getByText(/You're on a \d+-day streak/i)).toBeDefined();
    expect(screen.getByTestId("habits-month-label").textContent).toContain("October 2026");
  });
});

describe("stat tiles", () => {
  it("reports streaks, success rate and today's progress", () => {
    const a = addHabit({ title: "Water", cadence: "daily" });
    const b = addHabit({ title: "Read", cadence: "daily" });
    os.completeHabit(a.id, now - 4 * DAY, now);
    os.completeHabit(a.id, now - 3 * DAY, now);
    os.completeHabit(a.id, now - 2 * DAY, now);
    os.completeHabit(a.id, now - DAY, now);
    os.completeHabit(a.id, now, now);
    os.completeHabit(b.id, now - DAY, now);

    renderHabits();

    const streak = within(screen.getByTestId("habits-stat-streak"));
    expect(streak.getByText("5 Days")).toBeDefined();

    const today = within(screen.getByTestId("habits-stat-today"));
    expect(today.getByText("1 / 2")).toBeDefined();

    const longest = within(screen.getByTestId("habits-stat-longest"));
    expect(longest.getByText("5 Days")).toBeDefined();
  });
});

describe("habit rows", () => {
  it("shows title, description, streak and week strip", () => {
    const habit = addHabit({
      title: "Drink Water",
      description: "8 glasses a day",
      icon: "water",
      color: "var(--chart-5)",
      priority: "high",
    });
    os.completeHabit(habit.id, now, now);

    renderHabits();

    const row = screen.getByTestId("habit-row");
    expect(within(row).getByText("Drink Water")).toBeDefined();
    expect(within(row).getByText("8 glasses a day")).toBeDefined();
    expect(within(row).getByText("High")).toBeDefined();
    const group = within(row).getByRole("group", { name: /Drink Water check-ins, this week/ });
    expect(within(group).getAllByRole("button")).toHaveLength(7);
  });

  it("toggles a check-in from the week strip", () => {
    const habit = addHabit({ title: "Water", cadence: "daily" });

    renderHabits();

    const row = screen.getByTestId("habit-row");
    const group = within(row).getByRole("group", { name: /check-ins, this week/ });
    const buttons = within(group).getAllByRole("button");
    const thursday = buttons.find((button) => /Thu/.test(button.getAttribute("aria-label") ?? ""));

    fireEvent.click(thursday!);
    expect(os.habitCheckedOn(habit.id, new Date(now).setHours(0, 0, 0, 0))).toBe(true);

    fireEvent.click(thursday!);
    expect(os.habitCheckedOn(habit.id, new Date(now).setHours(0, 0, 0, 0))).toBe(false);
  });
});

describe("filters and sorting", () => {
  it("filters by cadence tab", () => {
    addHabit({ title: "Daily one", cadence: "daily" });
    addHabit({ title: "Weekly one", cadence: "weekly", daysOfWeek: [0] });

    renderHabits();

    expect(screen.getAllByTestId("habit-row")).toHaveLength(2);

    fireEvent.click(screen.getByRole("radio", { name: "Daily" }));
    expect(screen.getAllByTestId("habit-row")).toHaveLength(1);
    expect(screen.getByText("Daily one")).toBeDefined();

    fireEvent.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(screen.getAllByTestId("habit-row")).toHaveLength(1);
    expect(screen.getByText("Weekly one")).toBeDefined();
  });

  it("sorts by priority so the high priority habit comes first", () => {
    addHabit({ title: "Low priority", priority: "low" });
    addHabit({ title: "High priority", priority: "high" });

    renderHabits();

    const rows = screen.getAllByTestId("habit-row");
    expect(within(rows[0]!).getByText("High priority")).toBeDefined();
  });

  it("reports when no habit matches the filters", () => {
    addHabit({ title: "Monthly one", cadence: "monthly", daysOfMonth: [1] });

    renderHabits();

    fireEvent.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(screen.getByTestId("habits-empty-filter")).toBeDefined();
  });
});

describe("insights and calendar", () => {
  it("lists a streak insight and a today insight", () => {
    const habit = addHabit({ title: "Water", cadence: "daily" });
    os.completeHabit(habit.id, now, now);
    os.completeHabit(habit.id, now - DAY, now);

    renderHabits();

    const insights = within(screen.getByTestId("habits-insights"));
    expect(insights.getByText(/You're on a 2-day streak/i)).toBeDefined();
    expect(insights.getByText(/You completed 1 of 1 habits today/i)).toBeDefined();
  });

  it("navigates the calendar between months", () => {
    addHabit({ title: "Water", cadence: "daily" });

    renderHabits();

    const label = screen.getByTestId("habits-calendar-label");
    expect(label.textContent).toBe("October 2026");

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByTestId("habits-calendar-label").textContent).toBe("September 2026");

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByTestId("habits-calendar-label").textContent).toBe("October 2026");
  });

  it("summarises a selected calendar day", () => {
    const habit = addHabit({ title: "Water", cadence: "daily" });
    os.completeHabit(habit.id, now - DAY, now);

    renderHabits();

    const cell = screen
      .getAllByRole("gridcell")
      .find((node) => /^7 /.test(node.getAttribute("aria-label") ?? ""));
    fireEvent.click(cell!);
    expect(screen.getByTestId("habits-calendar-summary").textContent).toContain("1 habits done");
  });
});

describe("habit assistant", () => {
  it("answers a progress question with real numbers", () => {
    const habit = addHabit({ title: "Water", cadence: "daily" });
    os.completeHabit(habit.id, now, now);

    renderHabits();

    const input = screen.getByLabelText("Ask the habit assistant");
    fireEvent.change(input, { target: { value: "analyze my progress" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("habits-assistant-answer").textContent).toContain("overall success");
    expect(screen.getByTestId("habits-assistant-progress").getAttribute("href")).toBe("/insights");
  });

  it("answers a today question with the due count", () => {
    addHabit({ title: "Water", cadence: "daily" });
    renderHabits();

    const input = screen.getByLabelText("Ask the habit assistant");
    fireEvent.change(input, { target: { value: "what about today" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("habits-assistant-answer").textContent).toContain("0 of 1");
  });

  it("offers suggestions that add a habit", () => {
    renderHabits();

    fireEvent.click(screen.getByTestId("habits-assistant-suggest"));
    expect(screen.getByTestId("habits-assistant-suggestions")).toBeDefined();

    const add = screen.getByText("Add “Morning walk”");
    fireEvent.click(add);

    expect(os.getState().habits[Object.keys(os.getState().habits)[0]!]?.title ?? "").toBeDefined();
    expect(Object.keys(os.getState().habits)).toHaveLength(1);
  });

  it("opens the habit dialog from the create a habit plan action", () => {
    renderHabits();

    fireEvent.click(screen.getByTestId("habits-assistant-plan"));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByLabelText("Title")).toBeDefined();
  });
});

describe("habit dialog", () => {
  it("creates a habit with description, priority, color and icon", () => {
    renderHabits();

    fireEvent.click(screen.getByTestId("habits-add"));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Cold shower" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "30 seconds, every morning" },
    });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Water", pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: "Green", pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: /Create habit/i }));

    const habit = Object.values(os.getState().habits)[0]!;
    expect(habit.title).toBe("Cold shower");
    expect(habit.description).toBe("30 seconds, every morning");
    expect(habit.priority).toBe("high");
    expect(habit.icon).toBe("water");
    expect(habit.color).toBe("var(--chart-6)");
    expect(screen.getByText("Cold shower")).toBeDefined();
  });
});
describe("habit page fixes", () => {
  it("archives a habit and shows it under the archived filter", () => {
    const habit = addHabit({ title: "Read 10 pages", cadence: "daily" });

    renderHabits();

    fireEvent.click(screen.getByRole("button", { name: "Read 10 pages options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive habit" }));

    expect(os.getState().habits[habit.id]?.archived).toBe(true);
    expect(screen.queryByText("Read 10 pages")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Filter habits" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archived" }));

    expect(screen.getByText("Read 10 pages")).toBeDefined();
  });

  it("restores an archived habit from the row menu", () => {
    const habit = addHabit({ title: "Meditate", cadence: "daily" });
    os.updateHabit(habit.id, { archived: true });

    renderHabits();
    fireEvent.click(screen.getByRole("button", { name: "Filter habits" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archived" }));

    fireEvent.click(screen.getByRole("button", { name: "Meditate options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore habit" }));

    expect(os.getState().habits[habit.id]?.archived).toBe(false);
  });

  it("backfills a missed check-in from the detail sheet", () => {
    const habit = addHabit({ title: "Stretch", cadence: "daily" });
    const yesterday = new Date(now);
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);

    renderHabits();
    fireEvent.click(screen.getByRole("button", { name: "Open Stretch" }));

    fireEvent.click(
      screen.getByRole("button", { name: `${yesterday.toLocaleDateString()} not checked in` }),
    );

    expect(os.habitCheckedOn(habit.id, yesterday.getTime())).toBe(true);
  });

  it("links a habit to a goal from the detail sheet", () => {
    const habit = addHabit({ title: "Walk", cadence: "daily" });
    const goal = os.addGoal({ title: "Get fit" });

    renderHabits();
    fireEvent.click(screen.getByRole("button", { name: "Open Walk" }));
    fireEvent.click(screen.getByRole("button", { name: "Link a goal" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Get fit" }));

    expect(os.getState().habits[habit.id]?.goalId).toBe(goal.id);
  });

  it("requires a second click before deleting from the detail sheet", () => {
    const habit = addHabit({ title: "Journal", cadence: "daily" });

    renderHabits();
    fireEvent.click(screen.getByRole("button", { name: "Open Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete habit" }));
    expect(os.getState().habits[habit.id]).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Click again to delete" }));
    expect(os.getState().habits[habit.id]).toBeUndefined();
  });

  it("does not answer while typing until Ask is pressed", () => {
    addHabit({ title: "Water", cadence: "daily" });

    renderHabits();
    fireEvent.change(screen.getByLabelText("Ask the habit assistant"), {
      target: { value: "progress" },
    });
    expect(screen.queryByTestId("habits-assistant-answer")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByTestId("habits-assistant-answer").textContent).toContain("overall success");
  });
});