import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { endOfDay } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { TodayModule } from "./today-module";

const DAY = 86_400_000;
const HOUR = 3_600_000;

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

function renderToday() {
  return render(
    <ToastProvider>
      <TodayModule />
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
  os.updateProfile({ displayName: "Mani Krishnan" });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the hero, all cards and the productivity rail", () => {
    renderToday();

    for (const testId of [
      "today-hero",
      "today-schedule",
      "today-tasks",
      "today-meetings",
      "today-habits",
      "today-goals",
      "today-journal",
      "today-activity",
      "today-ai",
      "today-focus",
      "today-capture",
      "today-insights",
      "today-routines",
      "today-projects",
      "today-deadlines",
      "today-notes",
      "today-focus-log",
      "today-moments",
      "today-rewards",
    ]) {
      expect(screen.getByTestId(testId)).toBeDefined();
    }
    expect(screen.getByRole("complementary", { name: "Productivity" })).toBeDefined();
  });

  it("gives each panel a real empty state instead of hiding it", () => {
    renderToday();

    expect(screen.getByText(/Nothing scheduled today/)).toBeDefined();
    expect(screen.getByText(/Nothing in today/)).toBeDefined();
    expect(screen.getByText("No habits due today.")).toBeDefined();
    expect(screen.getByText("No active goals yet.")).toBeDefined();
    expect(screen.getByText(/haven't written today's reflection yet/)).toBeDefined();
    expect(screen.getByText("No recent activity.")).toBeDefined();
    expect(screen.getByText("No meetings scheduled today.")).toBeDefined();
    expect(screen.getByText("No routine steps due today.")).toBeDefined();
    expect(screen.getByText("No active projects yet.")).toBeDefined();
    expect(screen.getByText("Nothing due in the next 7 days.")).toBeDefined();
    expect(screen.getByText("No notes yet.")).toBeDefined();
    expect(screen.getByText("No focus sessions today.")).toBeDefined();
    expect(screen.getByText("No moments captured today.")).toBeDefined();
  });

  it("greets by first name with a quote and a plan message", () => {
    renderToday();
    const hero = screen.getByTestId("today-hero");
    expect(within(hero).getByText("Good morning,")).toBeDefined();
    expect(within(hero).getByText("Mani")).toBeDefined();
    expect(within(hero).getByText(/lead to big results|Nothing is due today/)).toBeDefined();
  });

  it("shows the four hero stat tiles", () => {
    renderToday();
    const hero = screen.getByTestId("today-hero");
    expect(within(hero).getByText("Focus Time")).toBeDefined();
    expect(within(hero).getByText("Tasks Completed")).toBeDefined();
    expect(within(hero).getByText("Habit Streak")).toBeDefined();
    expect(within(hero).getByText("Mood")).toBeDefined();
  });
});

describe("live data", () => {
  it("lists events, blocks and scheduled tasks chronologically", () => {
    os.addEvent({ title: "Team standup", startsAt: now + HOUR, endsAt: now + HOUR + 30 * 60_000 }, now);
    os.addTimeBlock({ title: "Deep work", startsAt: now + 3 * HOUR, endsAt: now + 4 * HOUR }, now);
    const task = os.addTask({ title: "Reply to Ana", estimateMin: 20 }, now);
    os.scheduleTask(task.id, now + 2 * HOUR);

    renderToday();
    const panel = screen.getByTestId("today-schedule");
    expect(within(panel).getAllByTestId("today-schedule-row")).toHaveLength(3);
  });

  it("paginates the schedule with centered dot navigation", () => {
    for (let index = 0; index < 7; index += 1) {
      os.addEvent(
        {
          title: `Event ${index + 1}`,
          startsAt: now + (index + 1) * HOUR,
          endsAt: now + (index + 1) * HOUR + 30 * 60_000,
        },
        now,
      );
    }

    renderToday();
    const panel = screen.getByTestId("today-schedule");
    expect(within(panel).getAllByTestId("today-schedule-row")).toHaveLength(5);

    const dots = within(panel).getAllByRole("button", { name: /Show Schedule page/ });
    expect(dots).toHaveLength(2);
    fireEvent.click(dots[1]!);

    expect(within(panel).getAllByTestId("today-schedule-row")).toHaveLength(2);
  });

  it("paginates habits with centered dot navigation", () => {
    for (let index = 0; index < 6; index += 1) {
      os.addHabit({ title: `Habit ${index + 1}`, cadence: "daily" }, now - DAY);
    }

    renderToday();
    const panel = screen.getByTestId("today-habits");
    expect(within(panel).getAllByTestId("today-habit-row")).toHaveLength(5);

    const dots = within(panel).getAllByRole("button", { name: /Show Habits page/ });
    expect(dots).toHaveLength(2);
    fireEvent.click(dots[1]!);

    expect(within(panel).getAllByTestId("today-habit-row")).toHaveLength(1);
  });

  it("counts each task bucket in the tab labels", () => {
    os.addTask({ title: "Overdue thing", dueAt: now - 2 * DAY }, now);
    os.addTask({ title: "Today thing", dueAt: now + HOUR }, now);

    renderToday();
    const panel = screen.getByTestId("today-tasks");
    expect(within(panel).getByRole("radio", { name: /Today\s+1/ })).toBeDefined();
    expect(within(panel).getByRole("radio", { name: /Overdue\s+1/ })).toBeDefined();
    expect(within(panel).getByText("Today thing")).toBeDefined();
  });

  it("switches to the overdue bucket", () => {
    os.addTask({ title: "Overdue thing", dueAt: now - 2 * DAY }, now);
    renderToday();

    const panel = screen.getByTestId("today-tasks");
    fireEvent.click(within(panel).getByRole("radio", { name: /Overdue/ }));

    expect(within(panel).getAllByText("Overdue thing").length).toBeGreaterThan(0);
  });

  it("completes a task from the checkbox", () => {
    const task = os.addTask({ title: "Ship release", dueAt: now }, now);
    renderToday();

    fireEvent.click(screen.getByRole("checkbox", { name: "Complete Ship release" }));

    expect(os.getTask(task.id)?.status).toBe("done");
    expect(within(screen.getByTestId("today-activity")).getByText("Ship release")).toBeDefined();
  });

  it("lists habits with streaks and completes them", () => {
    const habit = os.addHabit({ title: "Morning Exercise", cadence: "daily" }, now - 5 * DAY);
    os.completeHabit(habit.id, now - DAY, now);
    renderToday();

    const panel = screen.getByTestId("today-habits");
    expect(within(panel).getByText("Morning Exercise")).toBeDefined();
    expect(within(panel).getByText("1 day streak")).toBeDefined();

    fireEvent.click(within(panel).getByRole("button", { name: "Mark Complete" }));

    expect(within(panel).getByText("Done")).toBeDefined();
  });

  it("shows goal progress", () => {
    const goal = os.addGoal("Grow Wealth", now);
    os.addGoalMetric(goal.id, { label: "Savings", current: 6, target: 10, unit: "x" });

    renderToday();

    const panel = screen.getByTestId("today-goals");
    expect(within(panel).getByText("Grow Wealth")).toBeDefined();
    expect(within(panel).getByText("60%")).toBeDefined();
  });

  it("previews today's reflection", () => {
    const entry = os.openJournalFor(now, now);
    os.updateJournalEntry(entry.id, { body: "Productive day with the team", tags: ["work"] }, now);
    os.updateJournalEntry(entry.id, { mood: "happy" }, now);

    renderToday();

    const panel = screen.getByTestId("today-journal");
    expect(within(panel).getByText(/Productive day with the team/)).toBeDefined();
    expect(within(panel).getByText("#work")).toBeDefined();
  });

  it("lists recent activity newest first", () => {
    const task = os.addTask({ title: "Update runbook" }, now - 3 * HOUR);
    os.completeTask(task.id, now - 2 * HOUR);
    os.addNote({ title: "Sprint ideas" }, now - HOUR);

    renderToday();
    const panel = screen.getByTestId("today-activity");
    expect(within(panel).getByText("Task completed")).toBeDefined();
    expect(within(panel).getByText("Note added")).toBeDefined();
  });

  it("shows the configured assistant provider", () => {
    renderToday();
    expect(within(screen.getByTestId("today-ai")).getByText("LifeOS Local")).toBeDefined();
  });

  it("answers a typed question in the AI panel", () => {
    renderToday();

    fireEvent.change(screen.getByLabelText("Ask the assistant"), { target: { value: "Plan my day" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("today-ai-answer")).toBeDefined();
  });

  it("starts and completes a focus session", () => {
    renderToday();

    expect(screen.getByTestId("today-focus-countdown").textContent).toBe("50:00");

    fireEvent.click(screen.getByRole("button", { name: "Start Deep Work" }));
    expect(os.activeFocusSession()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Complete focus session" }));
    expect(os.activeFocusSession()).toBeNull();
  });

  it("captures a task from quick capture", () => {
    renderToday();

    fireEvent.change(screen.getByLabelText("Capture a thought, task, or note"), {
      target: { value: "Call the bank" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    expect(Object.values(os.getState().tasks)[0]!.title).toBe("Call the bank");
  });

  it("shows data for the selected day", () => {
    os.addEvent({ title: "Today standup", startsAt: now + HOUR, endsAt: now + HOUR + 30 * 60_000 }, now);
    os.addEvent(
      { title: "Tomorrow planning", startsAt: now + DAY + HOUR, endsAt: now + DAY + HOUR + 30 * 60_000 },
      now,
    );

    renderToday();
    const schedule = screen.getByTestId("today-schedule");
    expect(within(schedule).getByText("Today standup")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(within(schedule).getByText("Tomorrow planning")).toBeDefined();
    expect(within(schedule).queryByText("Today standup")).toBeNull();
  });

  it("shows today's meetings separately from the schedule", () => {
    const meeting = os.addMeeting({ title: "Design sync", startsAt: now + HOUR, endsAt: now + 2 * HOUR }, now);
    os.updateMeeting(meeting.id, { location: "Zoom" });

    renderToday();
    const panel = screen.getByTestId("today-meetings");
    expect(within(panel).getByText("Design sync")).toBeDefined();
    expect(within(panel).getByText("Zoom")).toBeDefined();
  });

  it("captures a task into the selected day", () => {
    renderToday();
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));

    fireEvent.change(screen.getByLabelText("Capture a thought, task, or note"), {
      target: { value: "Plan tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Task" }));

    const task = Object.values(os.getState().tasks)[0]!;
    expect(task.title).toBe("Plan tomorrow");
    expect(task.dueAt).toBe(endOfDay(now + DAY));
  });

  it("pauses and resumes a focus session", () => {
    renderToday();
    fireEvent.click(screen.getByRole("button", { name: "Start Deep Work" }));

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(os.activeFocusSession()?.status).toBe("paused");

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(os.activeFocusSession()?.status).toBe("running");
  });

  it("fills the extended panels with live data", () => {
    os.addProject({ name: "Website", summary: "Ship the new site" });
    os.addTask({ title: "Ship release", dueAt: now + 2 * DAY }, now);
    os.addNote({ title: "Sprint ideas" }, now - HOUR);
    const session = os.startFocusSession({ startedAt: now - HOUR, plannedMin: 50 }, now);
    os.completeFocusSession(session.id, {}, now);
    os.addMemoryMoment({ title: "Coffee with Ana", happenedAt: now - HOUR }, now);

    renderToday();

    expect(within(screen.getByTestId("today-projects")).getByText("Website")).toBeDefined();
    expect(within(screen.getByTestId("today-deadlines")).getByText("Ship release")).toBeDefined();
    expect(within(screen.getByTestId("today-notes")).getByText("Sprint ideas")).toBeDefined();
    expect(within(screen.getByTestId("today-focus-log")).getByText("Focus session")).toBeDefined();
    expect(within(screen.getByTestId("today-moments")).getByText("Coffee with Ana")).toBeDefined();
    expect(within(screen.getByTestId("today-rewards")).getByText(/Level/)).toBeDefined();
  });

  it("shows today's insights", () => {
    os.addTask({ title: "Late thing", dueAt: now - 3 * DAY }, now);
    renderToday();

    const panel = screen.getByTestId("today-insights");
    expect(within(panel).getAllByTestId("today-insight-row").length).toBeGreaterThan(0);
  });
});

describe("load default data", () => {
  it("fills every section with the sample day", () => {
    renderToday();

    fireEvent.click(screen.getByRole("button", { name: "Today options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(within(screen.getByTestId("today-habits")).getByText("Morning Exercise")).toBeDefined();
    expect(within(screen.getByTestId("today-goals")).getByText("Grow Wealth")).toBeDefined();
    expect(within(screen.getByTestId("today-schedule")).getAllByTestId("today-schedule-row").length).toBeGreaterThan(3);
    expect(within(screen.getByTestId("today-hero")).getByText("2h 30m")).toBeDefined();
    expect(within(screen.getByTestId("today-journal")).getByText("#cricket")).toBeDefined();
  }, 20_000);

  it("does not duplicate the sample day when loaded twice", () => {
    renderToday();

    fireEvent.click(screen.getByRole("button", { name: "Today options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));
    const tasks = Object.keys(os.getState().tasks).length;
    const habits = Object.keys(os.getState().habits).length;

    fireEvent.click(screen.getByRole("button", { name: "Today options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(Object.keys(os.getState().tasks).length).toBe(tasks);
    expect(Object.keys(os.getState().habits).length).toBe(habits);
  }, 20_000);
});

describe("reactive updates", () => {
  it("shows a task added after mount", () => {
    renderToday();
    expect(screen.queryByText("Late addition")).toBeNull();

    act(() => {
      os.addTask({ title: "Late addition", dueAt: now }, now);
    });

    expect(within(screen.getByTestId("today-tasks")).getByText("Late addition")).toBeDefined();
  });

  it("steps the date navigator", () => {
    renderToday();
    const label = screen.getByTestId("today-date-label").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(screen.getByTestId("today-date-label").textContent).not.toBe(label);
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByTestId("today-date-label").textContent).toBe(label);
  });
});
