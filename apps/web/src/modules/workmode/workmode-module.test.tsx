import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { WorkModeModule } from "./workmode-module";

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

function renderWorkMode() {
  return render(
    <ToastProvider>
      <WorkModeModule />
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
  it("shows the header, stats, tabs, panels and the tool rail", () => {
    renderWorkMode();

    expect(screen.getByRole("heading", { name: "Work Mode" })).toBeDefined();
    expect(screen.getByTestId("workmode-stats")).toBeDefined();
    expect(screen.getByTestId("workmode-tasks")).toBeDefined();
    expect(screen.getByTestId("workmode-meetings")).toBeDefined();
    expect(screen.getByTestId("workmode-projects")).toBeDefined();
    expect(screen.getByTestId("workmode-documents")).toBeDefined();
    expect(screen.getByTestId("workmode-activity")).toBeDefined();
    expect(screen.getByTestId("workmode-assistant")).toBeDefined();
    expect(screen.getByTestId("workmode-focus-timer")).toBeDefined();
    expect(screen.getByTestId("workmode-insights")).toBeDefined();
    expect(screen.getByTestId("workmode-quick-actions")).toBeDefined();
  });

  it("renders all five stat tiles and seven tabs", () => {
    renderWorkMode();

    for (const id of ["tasks", "projects", "meetings", "focus", "goal"]) {
      expect(screen.getByTestId(`workmode-stat-${id}`)).toBeDefined();
    }
    for (const tab of ["overview", "tasks", "projects", "meetings", "documents", "team", "analytics"]) {
      expect(screen.getByTestId(`workmode-tab-${tab}`)).toBeDefined();
    }
  });
});

describe("load default data", () => {
  it("seeds projects, tasks, meetings and documents from the overflow menu", () => {
    renderWorkMode();

    fireEvent.click(screen.getByRole("button", { name: "Work Mode options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(Object.keys(os.getState().projects).length).toBeGreaterThan(3);
    expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(5);
    expect(Object.keys(os.getState().meetings).length).toBeGreaterThan(3);
    expect(Object.keys(os.getState().notes).length).toBeGreaterThan(2);
    expect(screen.getByText("Review D365 support tickets")).toBeDefined();
    expect(screen.getByText("Daily Standup")).toBeDefined();
  });

  it("seeds the default set from the quick actions panel", () => {
    renderWorkMode();

    fireEvent.click(screen.getByRole("button", { name: "Load default data" }));

    expect(Object.keys(os.getState().projects).length).toBeGreaterThan(3);
  });

  it("does not duplicate the default data when loaded twice", () => {
    renderWorkMode();

    fireEvent.click(screen.getByRole("button", { name: "Load default data" }));
    const first = Object.keys(os.getState().projects).length;
    fireEvent.click(screen.getByRole("button", { name: "Load default data" }));

    expect(Object.keys(os.getState().projects).length).toBe(first);
  });
});

describe("today's work tasks", () => {
  it("lists a task and completes it", () => {
    const task = os.addTask({ title: "Ship the release", dueAt: now + 2 * HOUR, tags: ["work"], mode: "work" });

    renderWorkMode();

    expect(screen.getByText("Ship the release")).toBeDefined();
    fireEvent.click(screen.getByRole("checkbox", { name: /Complete Ship the release/ }));
    expect(os.getTask(task.id)?.status).toBe("done");
  });

  it("adds a work task from the inline form", () => {
    renderWorkMode();

    fireEvent.change(screen.getByLabelText("Add a work task"), { target: { value: "Write the brief" } });
    fireEvent.keyDown(screen.getByLabelText("Add a work task"), { key: "Enter" });

    expect(Object.values(os.getState().tasks).map((task) => task.title)).toContain("Write the brief");
  });
});

describe("today's meetings", () => {
  it("shows a meeting with its time, location and attendee count", () => {
    const startsAt = now + 3 * HOUR;
    const meeting = os.addMeeting({ title: "Client Sync", startsAt, endsAt: startsAt + HOUR });
    os.updateMeeting(meeting.id, { location: "Zoom" });

    renderWorkMode();

    expect(screen.getByText("Client Sync")).toBeDefined();
    expect(screen.getByText(/Zoom/)).toBeDefined();
  });
});

describe("work mode assistant", () => {
  it("creates a task list from the assistant", () => {
    os.addTask({ title: "Open item", dueAt: now + HOUR, tags: ["work"], mode: "work" });

    renderWorkMode();

    fireEvent.click(screen.getByTestId("workmode-assistant-tasks"));
    expect(screen.getByTestId("workmode-assistant-answer").textContent).toContain("Open item");
  });

  it("answers a question from the work data", () => {
    os.addTask({ title: "Findable item", dueAt: now + HOUR, tags: ["work"], mode: "work" });

    renderWorkMode();

    fireEvent.change(screen.getByLabelText("Ask the work mode assistant"), {
      target: { value: "findable" },
    });
    fireEvent.click(screen.getByTestId("workmode-assistant-find"));

    expect(screen.getByTestId("workmode-assistant-answer").textContent).toContain("Findable item");
  });
});

describe("focus timer", () => {
  it("starts and stops a real focus session", () => {
    renderWorkMode();

    expect(screen.getByTestId("workmode-timer").textContent).toBe("25:00");

    fireEvent.click(screen.getByTestId("workmode-timer-toggle"));
    expect(screen.getByTestId("workmode-timer-toggle").textContent).toContain("Stop");
    expect(os.focusSessions()).toHaveLength(1);

    fireEvent.click(screen.getByTestId("workmode-timer-toggle"));
    expect(screen.getByTestId("workmode-timer-toggle").textContent).toContain("Start");
  });
});

describe("quick actions", () => {
  it("creates a document and a note", () => {
    renderWorkMode();

    fireEvent.click(screen.getByTestId("workmode-quick-document"));
    expect(Object.values(os.getState().notes).some((note) => note.title === "New work document")).toBe(true);

    fireEvent.click(screen.getByTestId("workmode-quick-note"));
    expect(Object.values(os.getState().notes).some((note) => note.title === "Quick note")).toBe(true);
  });

  it("schedules a meeting", () => {
    renderWorkMode();

    fireEvent.click(screen.getByTestId("workmode-quick-meeting"));
    expect(Object.values(os.getState().meetings).some((meeting) => meeting.title === "New work meeting")).toBe(
      true,
    );
  });
});

describe("workspace tabs", () => {
  it("switches to the projects, documents and analytics tabs", () => {
    renderWorkMode();

    fireEvent.click(screen.getByTestId("workmode-tab-projects"));
    expect(screen.getByTestId("workmode-projects")).toBeDefined();

    fireEvent.click(screen.getByTestId("workmode-tab-documents"));
    expect(screen.getByTestId("workmode-documents")).toBeDefined();

    fireEvent.click(screen.getByTestId("workmode-tab-analytics"));
    expect(screen.getByTestId("workmode-analytics")).toBeDefined();

    fireEvent.click(screen.getByTestId("workmode-tab-team"));
    expect(screen.getByTestId("workmode-team")).toBeDefined();
  });
});


describe("work mode fixes", () => {
  it("shows every meeting in the meetings tab, not just today", () => {
    const startsAt = now + 14 * 86_400_000;
    os.addMeeting({ title: "Next sprint review", startsAt, endsAt: startsAt + 3_600_000 });

    renderWorkMode();
    fireEvent.click(screen.getByTestId("workmode-tab-meetings"));

    expect(screen.getByText("Next sprint review")).toBeDefined();
  });

  it("shows tasks beyond today in the all tasks tab", () => {
    os.addTask({ title: "Future work item", dueAt: now + 10 * 86_400_000, tags: ["work"], mode: "work" });

    renderWorkMode();
    fireEvent.click(screen.getByTestId("workmode-tab-tasks"));

    expect(screen.getByText("Future work item")).toBeDefined();
  });

  it("applies the focus timer preset duration", () => {
    renderWorkMode();
    expect(screen.getByTestId("workmode-timer").textContent).toBe("25:00");

    fireEvent.change(screen.getByLabelText("Focus timer preset"), { target: { value: "Deep work" } });
    expect(screen.getByTestId("workmode-timer").textContent).toBe("50:00");

    fireEvent.change(screen.getByLabelText("Focus timer preset"), { target: { value: "Quick focus" } });
    expect(screen.getByTestId("workmode-timer").textContent).toBe("15:00");
  });

  it("creates a project from the options menu", () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("New launch");
    renderWorkMode();

    fireEvent.click(screen.getByRole("button", { name: "Work Mode options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New project" }));

    expect(Object.values(os.getState().projects).some((project) => project.name === "New launch")).toBe(true);
    prompt.mockRestore();
  });

  it("adds a teammate from the options menu", () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Grace Hopper");
    renderWorkMode();

    fireEvent.click(screen.getByRole("button", { name: "Work Mode options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add teammate" }));

    expect(os.members().some((member) => member.displayName === "Grace Hopper")).toBe(true);
    prompt.mockRestore();
  });

  it("links the join button to the meetings workspace", () => {
    const startsAt = now + 3 * HOUR;
    os.addMeeting({ title: "Client Sync", startsAt, endsAt: startsAt + HOUR });
    renderWorkMode();

    expect(screen.getByRole("link", { name: "Join" }).getAttribute("href")).toBe("/meetings");
  });
});
describe("work mode timer and panels", () => {
  it("adopts a focus session that is already running", () => {
    const startedAt = now - 5 * 60_000;
    os.startFocusSession({ startedAt, plannedMin: 25, mode: "countdown" }, startedAt);

    renderWorkMode();
    expect(screen.getByTestId("workmode-timer-toggle").textContent).toContain("Stop");
    expect(screen.getByTestId("workmode-timer-pause")).toBeDefined();
  });

  it("pauses and resumes the work mode timer", () => {
    renderWorkMode();
    fireEvent.click(screen.getByTestId("workmode-timer-toggle"));
    const session = os.activeFocusSession()!;

    fireEvent.click(screen.getByTestId("workmode-timer-pause"));
    expect(os.getFocusSession(session.id)?.status).toBe("paused");

    fireEvent.click(screen.getByTestId("workmode-timer-pause"));
    expect(os.getFocusSession(session.id)?.status).toBe("running");
  });

  it("shows an accurate empty state in the all-meetings tab", () => {
    renderWorkMode();
    fireEvent.click(screen.getByTestId("workmode-tab-meetings"));
    expect(screen.getByText("No meetings yet.")).toBeDefined();
  });

  it("shows the project on a work task", () => {
    const project = os.addProject({ name: "Apollo", mode: "work" });
    os.addTask({ title: "Wire the API", projectId: project.id, dueAt: now + HOUR, mode: "work" });

    renderWorkMode();
    expect(screen.getAllByText("Apollo").length).toBeGreaterThan(0);
  });

  it("tags work-created items with work mode", () => {
    renderWorkMode();

    fireEvent.change(screen.getByLabelText("Add a work task"), { target: { value: "Tagged task" } });
    fireEvent.keyDown(screen.getByLabelText("Add a work task"), { key: "Enter" });
    expect(Object.values(os.getState().tasks).find((task) => task.title === "Tagged task")?.mode).toBe("work");

    fireEvent.click(screen.getByTestId("workmode-quick-document"));
    expect(Object.values(os.getState().notes).find((note) => note.title === "New work document")?.mode).toBe("work");
  });

  it("labels the assistant action as prioritisation", () => {
    renderWorkMode();
    expect(screen.getByTestId("workmode-assistant-tasks").textContent).toContain("Prioritise tasks");
  });
});