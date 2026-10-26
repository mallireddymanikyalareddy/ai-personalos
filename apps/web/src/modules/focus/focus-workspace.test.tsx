import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { FocusWorkspace } from "./focus-workspace";

afterEach(cleanup);

let os: ReturnType<typeof getOS>;
const NOW = new Date(2026, 4, 12, 9, 0, 0, 0).getTime();
const DAY = 86_400_000;

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

function session(daysAgo: number, minutes: number) {
  const startedAt = NOW - daysAgo * DAY;
  const created = os.startFocusSession({ startedAt, plannedMin: minutes }, startedAt);
  os.store.update("focusSessions", created.id, {
    activeMs: minutes * 60_000,
    status: "completed",
    completedAt: startedAt + minutes * 60_000,
  });
}

function renderWorkspace() {
  return render(
    <ToastProvider>
      <FocusWorkspace presetId="pomodoro" onPresetIdChange={() => undefined} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  vi.useRealTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FocusWorkspace visibility", () => {
  it("shows every mockup panel with no interaction required", () => {
    renderWorkspace();

    expect(screen.getByTestId("focus-hero")).toBeDefined();
    expect(screen.getByTestId("focus-presets")).toBeDefined();
    expect(screen.getByTestId("focus-plan")).toBeDefined();
    expect(screen.getByTestId("focus-distraction")).toBeDefined();
    expect(screen.getByTestId("today-focus")).toBeDefined();
    expect(screen.getByTestId("focus-streak")).toBeDefined();
    expect(screen.getByTestId("current-focus-task")).toBeDefined();
    expect(screen.getByTestId("focus-environment")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Focus details" })).toBeDefined();
  });

  it("renders with no data at all without crashing", () => {
    renderWorkspace();
    expect(screen.getByText("Nothing scheduled yet. Add time blocks from the Planner and they will line up here.")).toBeDefined();
    expect(screen.getByText("No focus time logged today yet.")).toBeDefined();
    expect(screen.getByText("Start a session today to begin")).toBeDefined();
  });

  it("does not hide the hero behind a click", () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: /start focus/i })).toBeDefined();
  });
});

describe("focus presets", () => {
  it("offers the four mockup presets", () => {
    renderWorkspace();
    const group = screen.getByTestId("focus-presets");
    for (const label of ["Pomodoro", "Deep Work", "Quick Focus", "Custom"]) {
      expect(within(group).getByText(label)).toBeDefined();
    }
  });

  it("shows focus and break lengths for each preset", () => {
    renderWorkspace();
    const group = screen.getByTestId("focus-presets");
    expect(within(group).getByText("25 min focus · 5 min break")).toBeDefined();
    expect(within(group).getByText("50 min focus · 10 min break")).toBeDefined();
    expect(within(group).getByText("15 min focus · 5 min break")).toBeDefined();
  });

  it("reports the selected preset", () => {
    const onChange = vi.fn();
    render(
      <ToastProvider>
        <FocusWorkspace presetId="deep_work" onPresetIdChange={onChange} />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: /Deep Work/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Quick Focus/ }));
    expect(onChange).toHaveBeenCalledWith("quick_focus");
  });
});

describe("focus plan", () => {
  it("lists today's time blocks with times and durations", () => {
    os.addTimeBlock(
      {
        title: "Deep Work",
        startsAt: NOW + 2 * 3_600_000,
        endsAt: NOW + 3 * 3_600_000,
      },
      NOW,
    );

    renderWorkspace();
    const plan = screen.getByTestId("focus-plan");
    expect(within(plan).getByText("Deep Work")).toBeDefined();
    expect(within(plan).getByText("60m")).toBeDefined();
  });

  it("prefers the task title over the block title", () => {
    const task = os.addTask({ title: "Write documentation" }, NOW);
    os.addTimeBlock(
      {
        title: "Generic",
        startsAt: NOW + 3_600_000,
        endsAt: NOW + 2 * 3_600_000,
        taskId: task.id,
      },
      NOW,
    );

    renderWorkspace();
    expect(within(screen.getByTestId("focus-plan")).getByText("Write documentation")).toBeDefined();
  });
});

describe("distraction panel", () => {
  it("explains that site blocking needs an extension", () => {
    renderWorkspace();
    expect(screen.getByText(/needs a browser extension or an OS-level tool/)).toBeDefined();
  });

  it("describes what actually works", () => {
    renderWorkspace();
    const panel = screen.getByTestId("focus-distraction");
    expect(within(panel).getByText(/Log a distraction in one tap/)).toBeDefined();
    expect(within(panel).getByText(/Focus Mode quiets ambient noise/)).toBeDefined();
  });

  it("counts sessions started today", () => {
    session(0, 25);
    renderWorkspace();
    expect(screen.getByText("1 session started today.")).toBeDefined();
  });

  it("does not claim to block sites", () => {
    const { container } = renderWorkspace();
    expect(container.textContent).not.toMatch(/blocked sites|blocking is on/i);
  });
});

describe("today focus breakdown", () => {
  it("prompts when nothing is logged", () => {
    renderWorkspace();
    expect(screen.getByText("No focus time logged today yet.")).toBeDefined();
  });

  it("shows a slice breakdown once sessions exist", () => {
    session(0, 50);
    renderWorkspace();
    const card = screen.getByTestId("today-focus");
    expect(within(card).getByText("Deep Work")).toBeDefined();
  });
});

describe("focus streak", () => {
  it("shows zero with no sessions", () => {
    renderWorkspace();
    expect(within(screen.getByTestId("focus-streak")).getByText("0")).toBeDefined();
  });

  it("counts consecutive days", () => {
    session(0, 25);
    session(1, 25);
    renderWorkspace();
    expect(within(screen.getByTestId("focus-streak")).getByText("2")).toBeDefined();
  });

  it("confirms today is logged", () => {
    session(0, 25);
    renderWorkspace();
    expect(screen.getByText("Today is logged")).toBeDefined();
  });
});

describe("focus tasks", () => {
  it("prompts when there is no task today", () => {
    renderWorkspace();
    expect(screen.getByText("No tasks scheduled or focused today.")).toBeDefined();
  });

  it("lists tasks due today and shows the current one", () => {
    os.addTask({ title: "D365 documentation", priority: 3, dueAt: NOW + 3_600_000 }, NOW);
    renderWorkspace();

    expect(within(screen.getByTestId("current-focus-task")).getByText("D365 documentation")).toBeDefined();
    expect(screen.getByLabelText("Completed: D365 documentation")).toBeDefined();
  });

  it("flags a high priority current task", () => {
    os.addTask({ title: "Urgent thing", priority: 3, dueAt: NOW + 3_600_000 }, NOW);
    renderWorkspace();
    expect(screen.getByText("High priority")).toBeDefined();
  });

  it("prefers an unfinished task as current", () => {
    os.addTask({ title: "Done thing", status: "done", dueAt: NOW + 3_600_000 }, NOW);
    os.addTask({ title: "Open thing", dueAt: NOW + 3_600_000 }, NOW);
    renderWorkspace();
    expect(within(screen.getByTestId("current-focus-task")).getByText("Open thing")).toBeDefined();
  });
});

describe("focus environment", () => {
  it("offers nature, library, office and cafe", () => {
    renderWorkspace();
    const card = screen.getByTestId("focus-environment");
    for (const label of ["Nature", "Library", "Office", "Café"]) {
      expect(within(card).getByText(label)).toBeDefined();
    }
  });

  it("starts on nature", () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: /Nature/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("changes the hero gradient when the environment changes", () => {
    renderWorkspace();
    const hero = screen.getByTestId("focus-hero");
    const before = hero.getAttribute("style");

    fireEvent.click(screen.getByRole("button", { name: /Café/ }));

    const after = screen.getByTestId("focus-hero").getAttribute("style");
    expect(after).not.toBe(before);
    expect(after).toContain("linear-gradient");
  });

  it("marks the newly picked environment as pressed", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Office/ }));
    expect(screen.getByRole("button", { name: /Office/ }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("focus stats", () => {
  it("prompts when there is no focus time", () => {
    renderWorkspace();
    expect(screen.getByText("No focus time recorded in this window yet.")).toBeDefined();
  });

  it("shows a total once sessions exist", () => {
    session(0, 50);
    renderWorkspace();
    expect(screen.getByText(/total/)).toBeDefined();
  });

  it("switches the stats window", () => {
    renderWorkspace();
    expect(screen.getByRole("radio", { name: "7 days" })).toBeDefined();
    fireEvent.click(screen.getByRole("radio", { name: "30 days" }));
    expect(screen.getByRole("radio", { name: "30 days" })).toBeDefined();
  });
});