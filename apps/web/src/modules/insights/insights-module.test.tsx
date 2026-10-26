import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { InsightsModule } from "./insights-module";
import InsightsPage from "@/app/(app)/insights/page";

const NOW = new Date(2026, 9, 15, 18, 0, 0, 0).getTime();
const DAY = 86_400_000;

let os: ReturnType<typeof getOS>;

function renderModule() {
  return render(
    <ToastProvider>
      <InsightsModule />
    </ToastProvider>,
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  os.seedGamificationCatalog();
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the header, tiles, charts and the right rail", () => {
    renderModule();

    expect(screen.getByRole("heading", { name: "Insights" })).toBeDefined();
    expect(screen.getByTestId("insights-tiles")).toBeDefined();
    expect(screen.getByTestId("insights-productivity")).toBeDefined();
    expect(screen.getByTestId("insights-distribution")).toBeDefined();
    expect(screen.getByTestId("insights-areas")).toBeDefined();
    expect(screen.getByTestId("insights-habits")).toBeDefined();
    expect(screen.getByTestId("insights-goals")).toBeDefined();
    expect(screen.getByTestId("insights-focus-sessions")).toBeDefined();
    expect(screen.getByTestId("insights-ai")).toBeDefined();
    expect(screen.getByTestId("insights-actions")).toBeDefined();
  });

  it("renders all five stat tiles", () => {
    renderModule();

    for (const id of ["productivity", "goals", "focus", "meetings", "habits"]) {
      expect(screen.getByTestId(`insights-tile-${id}`)).toBeDefined();
    }
  });

  it("renders every range tab", () => {
    renderModule();

    for (const range of ["today", "week", "month", "quarter", "year"]) {
      expect(screen.getByTestId(`insights-range-${range}`)).toBeDefined();
    }
  });
});

describe("load default data", () => {
  it("seeds tasks, focus sessions, goals and habits", () => {
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Insights options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(10);
    expect(Object.keys(os.getState().goals).length).toBeGreaterThan(2);
    expect(Object.keys(os.getState().habits).length).toBeGreaterThan(2);
    expect(os.focusSessions(true).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("insights-area-card").length).toBeGreaterThan(0);
  }, 20_000);

  it("does not duplicate the default data when loaded twice", () => {
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Insights options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));
    const first = Object.keys(os.getState().tasks).length;

    fireEvent.click(screen.getByRole("button", { name: "Insights options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(Object.keys(os.getState().tasks).length).toBe(first);
  }, 20_000);
});

describe("the numbers come from real data", () => {
  it("reports a completion rate from completed tasks", () => {
    for (let index = 1; index <= 4; index += 1) {
      const task = os.addTask({ title: `Done ${index}`, status: "open", priority: 3 });
      const at = new Date(NOW - index * DAY);
      at.setHours(9, 0, 0, 0);
      os.updateTask(task.id, {
        status: "done",
        completedAt: at.getTime(),
        startedAt: at.getTime() - 20 * 60_000,
        createdAt: NOW - (index + 1) * DAY,
      });
    }

    renderModule();

    const tile = within(screen.getByTestId("insights-tile-productivity"));
    expect(tile.getByText(/%$/)).toBeDefined();
  });

  it("shows an honest empty state for AI insights without history", () => {
    renderModule();
    expect(screen.getByText(/Not enough history yet/i)).toBeDefined();
  });

  it("lists recommended actions that reflect open work", () => {
    os.addTask({ title: "Urgent work", status: "open", priority: 4, dueAt: NOW + DAY });

    renderModule();

    const actions = within(screen.getByTestId("insights-actions"));
    expect(actions.getAllByTestId("insights-action-row").length).toBeGreaterThan(0);
    expect(actions.getByText(/high-priority task/i)).toBeDefined();
  });
});

describe("ranges", () => {
  it("switches the window and the range label", () => {
    renderModule();

    const before = screen.getByTestId("insights-range-label").textContent;
    fireEvent.click(screen.getByTestId("insights-range-month"));
    expect(screen.getByTestId("insights-range-label").textContent).not.toBe(before);
    expect(screen.getByTestId("insights-range-month").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("route", () => {
  it("renders the page inside the Insights route", () => {
    render(
      <ToastProvider>
        <InsightsPage />
      </ToastProvider>,
    );

    expect(screen.getByRole("heading", { name: "Insights" })).toBeDefined();
    expect(screen.getByTestId("insights-tiles")).toBeDefined();
  });
});

describe("insights fixes and new surfaces", () => {
  it("counts meetings from the meetings collection, not calendar events", () => {
    os.addMeeting({
      title: "Weekly sync",
      startsAt: NOW - DAY,
      endsAt: NOW - DAY + 60 * 60_000,
      attendees: [{ id: "a1", name: "A", email: "a@b.c" }],
    });
    os.addMeeting({
      title: "Next sprint planning",
      startsAt: NOW + 10 * DAY,
      endsAt: NOW + 10 * DAY + 60 * 60_000,
    });

    renderModule();

    const tile = within(screen.getByTestId("insights-tile-meetings"));
    expect(tile.getByText("1")).toBeDefined();
    expect(tile.getByText("1h scheduled")).toBeDefined();
  });

  it("respects the week-start setting in the range window", () => {
    os.updateSettings({ weekStart: 0 });

    renderModule();

    expect(screen.getByTestId("insights-range-label").textContent).toContain("11 Oct");
  });

  it("shows a single date for the today range", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("insights-range-today"));

    expect(screen.getByTestId("insights-range-label").textContent).not.toContain(" - ");
  });

  it("scopes the focus session count to the selected range", () => {
    const recent = os.startFocusSession({ startedAt: NOW - 3 * DAY, plannedMin: 30 });
    os.completeFocusSession(recent.id, {}, NOW - 3 * DAY + 30 * 60_000);
    const old = os.startFocusSession({ startedAt: NOW - 40 * DAY, plannedMin: 30 });
    os.completeFocusSession(old.id, {}, NOW - 40 * DAY + 30 * 60_000);

    renderModule();

    const card = within(screen.getByTestId("insights-focus-sessions"));
    expect(card.getByTestId("insights-focus-count").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("insights-range-year"));
    expect(card.getByTestId("insights-focus-count").textContent).toBe("2");
  });

  it("shows the active AI model", () => {
    os.updateSettings({ aiProvider: "anthropic" });

    renderModule();

    expect(within(screen.getByTestId("insights-ai")).getByText("Anthropic Claude")).toBeDefined();
  });

  it("links each recommended action to its own page", () => {
    os.addHabit({ title: "Stretch", cadence: "daily" }, NOW - 10 * DAY);

    renderModule();

    const actions = within(screen.getByTestId("insights-actions"));
    expect(actions.getByText(/Keep up the health routine/i).closest("a")?.getAttribute("href")).toBe(
      "/habits",
    );
    expect(actions.getByText(/Open the planner/i).closest("a")?.getAttribute("href")).toBe(
      "/planner",
    );
  });

  it("schedules focus blocks tomorrow from the recommended action", () => {
    renderModule();

    const actions = within(screen.getByTestId("insights-actions"));
    fireEvent.click(actions.getByText(/Schedule 2 focus blocks tomorrow/i));

    const blocks = Object.values(os.getState().timeBlocks).filter(
      (block) => block.title === "Focus block",
    );
    expect(blocks).toHaveLength(2);
  });

  it("expands to every life area", () => {
    const seeds: Array<[string, string]> = [
      ["work", "Client deck"],
      ["personal", "Home tidy"],
      ["learning", "Read a book"],
      ["health", "Gym session"],
      ["finance", "Budget review"],
      ["misc", "Random thing"],
    ];
    for (const [tag, title] of seeds) {
      os.addTask({ title, tags: [tag], status: "open", dueAt: NOW - DAY });
    }

    renderModule();

    expect(screen.getAllByTestId("insights-area-card")).toHaveLength(5);
    fireEvent.click(screen.getByTestId("insights-areas-toggle"));
    expect(screen.getAllByTestId("insights-area-card")).toHaveLength(6);
  });

  it("offers an export report action", () => {
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Insights options" }));
    expect(screen.getByRole("menuitem", { name: "Export report" })).toBeDefined();
  });
});