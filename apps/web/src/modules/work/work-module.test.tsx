import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { WorkModule } from "./work-module";

afterEach(cleanup);

function renderModule() {
  return render(
    <ToastProvider>
      <WorkModule />
    </ToastProvider>,
  );
}

describe("WorkModule", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
  });

  it("shows the project and routine counts under the Projects & Workspaces heading", () => {
    const os = getOS();
    os.addProject({ name: "Product launch" });
    os.addProject({ name: "Website redesign" });
    os.addRoutine({ title: "Morning routine", slot: "morning", cadence: "daily", daysOfWeek: [], steps: [] });

    renderModule();

    expect(screen.getByRole("heading", { name: "Projects & Workspaces" })).toBeDefined();
    expect(
      screen.getByText("Plan, execute and track everything in one place. Turn ideas into reality."),
    ).toBeDefined();

    const summary = within(screen.getByTestId("work-summary"));
    expect(within(summary.getByTestId("work-stat-projects")).getByText("2")).toBeDefined();
    expect(within(summary.getByTestId("work-stat-routines")).getByText("1")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Work" })).toBeNull();
  });

  it("switches between projects and routines from the summary tiles", () => {
    const os = getOS();
    os.addProject({ name: "Product launch" });
    os.addRoutine({ title: "Morning routine", slot: "morning", cadence: "daily", daysOfWeek: [], steps: [] });

    renderModule();

    fireEvent.click(screen.getByTestId("work-stat-routines"));
    expect(screen.getByText("Morning routine")).toBeDefined();

    fireEvent.click(screen.getByTestId("work-stat-projects"));
    expect(screen.getAllByText("Product launch").length).toBeGreaterThan(0);
  });

  it("renders empty state for projects", () => {
    renderModule();
    expect(screen.getByText("No projects yet")).toBeDefined();
  });

  it("creates a project via the dialog", async () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Website redesign" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /create project/i }));

    const projects = Object.values(os.getState().projects);
    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe("Website redesign");
  });

  it("shows project cards after creation", () => {
    const os = getOS();
    os.addProject({ name: "Product launch", summary: "Q4 launch" });

    renderModule();
    expect(screen.getAllByText("Product launch").length).toBeGreaterThan(0);
    expect(screen.getByTestId("project-overview")).toBeDefined();
  });

  it("opens the board and timeline for the first project without any click", () => {
    const os = getOS();
    const project = os.addProject({ name: "MedoriQ" });
    os.addTask({ title: "Design dashboard", projectId: project.id }, Date.now());

    renderModule();

    expect(screen.getByTestId("project-kanban")).toBeDefined();
    expect(screen.getByTestId("project-timeline")).toBeDefined();
    expect(screen.queryByText(/Select a project above/)).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "To Do" })).getByText("Design dashboard"),
    ).toBeDefined();
  });

  it("renders all four kanban columns for the first project", () => {
    const os = getOS();
    const project = os.addProject({ name: "Columns" });
    os.addTask({ title: "Planned", projectId: project.id }, Date.now());

    renderModule();

    for (const label of ["To Do", "In Progress", "Review", "Done"]) {
      expect(screen.getByRole("region", { name: label })).toBeDefined();
    }
  });

  it("loads sample projects into the board", () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: /load sample projects/i }));

    const projects = Object.values(os.getState().projects);
    expect(projects).toHaveLength(2);
    expect(screen.getByTestId("project-kanban")).toBeDefined();
    expect(screen.getAllByText("Design home page wireframes").length).toBeGreaterThan(0);
  });

  it("switches to routines tab", () => {
    renderModule();
    fireEvent.click(screen.getByRole("radio", { name: "Routines" }));
    expect(screen.getByText("No routines yet")).toBeDefined();
  });

  it("creates a routine via the dialog", async () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("radio", { name: "Routines" }));
    fireEvent.click(screen.getByRole("button", { name: /new routine/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Morning routine" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /create routine/i }));

    const routines = Object.values(os.getState().routines);
    expect(routines).toHaveLength(1);
    expect(routines[0]!.title).toBe("Morning routine");
  });

  it("adds a milestone to a project", async () => {
    const os = getOS();
    const project = os.addProject({ name: "App build" });

    renderModule();
    fireEvent.click(screen.getByTestId("add-milestone"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Beta release" },
    });
    const due = new Date(Date.now() + 7 * 86_400_000);
    const dueValue = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: dueValue } });
    fireEvent.click(screen.getByTestId("milestone-save"));

    const milestones = os.milestonesFor(project.id);
    expect(milestones).toHaveLength(1);
    expect(milestones[0]!.title).toBe("Beta release");
    expect(milestones[0]!.dueAt).not.toBeNull();
  });
});

describe("WorkModule: fixes and new surfaces", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
  });

  it("selects a project card without opening the details modal", () => {
    const os = getOS();
    os.addProject({ name: "Alpha" });
    const beta = os.addProject({ name: "Beta" });

    renderModule();
    fireEvent.click(screen.getAllByText("Beta")[0]!);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId(`project-card-${beta.id}`).getAttribute("data-selected")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "More options for Beta" }));
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("filters archived projects and searches by name", () => {
    const os = getOS();
    os.addProject({ name: "Active work" });
    os.addProject({ name: "Old project", status: "archived" });

    renderModule();
    expect(screen.queryAllByText("Old project")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("work-filter-archived"));
    expect(screen.getAllByText("Old project").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("work-filter-all"));
    fireEvent.change(screen.getByLabelText("Search projects"), { target: { value: "active" } });
    expect(screen.queryAllByText("Old project")).toHaveLength(0);
    expect(screen.getAllByText("Active work").length).toBeGreaterThan(0);
  });

  it("loads sample projects once from the options menu", () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Work options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load sample projects" }));
    const first = Object.keys(os.getState().projects).length;
    expect(first).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Work options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load sample projects" }));

    expect(Object.keys(os.getState().projects).length).toBe(first);
  });

  it("puts a new milestone with a due date on the timeline", async () => {
    const os = getOS();
    const project = os.addProject({ name: "Timeline project" });
    os.addTask({ title: "Work", projectId: project.id });

    renderModule();
    fireEvent.click(screen.getByTestId("add-milestone"));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Public launch" },
    });
    const due = new Date(Date.now() + 10 * 86_400_000);
    const dueValue = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: dueValue } });
    fireEvent.click(screen.getByTestId("milestone-save"));

    const milestone = os.milestonesFor(project.id)[0]!;
    expect(milestone.dueAt).not.toBeNull();
    expect(screen.getByTestId(`timeline-bar-${milestone.id}`)).toBeDefined();
  });

  it("does not materialize a routine on a day it is not due", () => {
    const os = getOS();
    const today = new Date();
    const todayIndex = (today.getDay() + 6) % 7;
    const otherDay = (todayIndex + 1) % 7;
    const routine = os.addRoutine({
      title: "Weekly review",
      cadence: "weekly",
      daysOfWeek: [otherDay],
      steps: [{ title: "Review", taskId: null, habitId: null, durationMin: 20 }],
    });

    renderModule();
    fireEvent.click(screen.getByRole("radio", { name: "Routines" }));
    expect(screen.getByText("Not scheduled today")).toBeDefined();

    fireEvent.click(screen.getByText("Weekly review"));
    expect(
      within(screen.getByRole("dialog")).getByText(/not scheduled today/i),
    ).toBeDefined();
    expect(
      Object.values(os.getState().tasks).filter((task) => task.routineId === routine.id),
    ).toHaveLength(0);
  });

  it("requires confirmation before deleting a project", () => {
    const os = getOS();
    const project = os.addProject({ name: "Danger zone" });

    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "More options for Danger zone" }));
    fireEvent.click(screen.getByTestId("project-delete"));
    expect(os.getState().projects[project.id]).toBeDefined();

    fireEvent.click(screen.getByTestId("project-delete"));
    expect(os.getState().projects[project.id]).toBeUndefined();
  });
});
describe("WorkModule: WIP, members and export", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
  });

  it("enforces a WIP limit when moving a task into a full column", () => {
    const os = getOS();
    const project = os.addProject({ name: "Flow", wipLimits: { in_progress: 1 } });
    os.addTask({ title: "Already working", projectId: project.id, status: "in_progress" });
    const queued = os.addTask({ title: "Queued", projectId: project.id, status: "open" });

    renderModule();

    expect(
      within(screen.getByRole("region", { name: "In Progress" })).getByText("1/1"),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Move Queued right" }));

    expect(os.getTask(queued.id)?.status).toBe("open");
    expect(screen.getByText(/WIP limit \(1\)/)).toBeDefined();
  });

  it("saves WIP limits from the project dialog", async () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Flow" } });
    fireEvent.change(within(dialog).getByLabelText("In Progress WIP limit"), {
      target: { value: "2" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /create project/i }));

    const project = Object.values(os.getState().projects)[0]!;
    expect(project.wipLimits.in_progress).toBe(2);
  });

  it("archives completed tasks and can undo it", () => {
    const os = getOS();
    const project = os.addProject({ name: "Cleanup" });
    const done = os.addTask({ title: "Finished", projectId: project.id, status: "done" });
    os.updateTask(done.id, { completedAt: Date.now() });

    renderModule();
    fireEvent.click(screen.getByTestId("archive-done"));

    expect(os.getTask(done.id)?.status).toBe("archived");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(os.getTask(done.id)?.status).toBe("done");
  });

  it("adds a workspace member inline and shows them on the team panel", async () => {
    const os = getOS();
    os.addProject({ name: "Staffed" });

    renderModule();
    fireEvent.click(screen.getByTestId("add-member"));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Priya" } });
    fireEvent.change(within(dialog).getByLabelText("Email (optional)"), {
      target: { value: "priya@example.com" },
    });
    fireEvent.click(screen.getByTestId("member-save"));

    const member = Object.values(os.getState().members).find(
      (entry) => entry.displayName === "Priya",
    );
    expect(member).toBeDefined();
    expect(within(screen.getByTestId("work-team")).getByText("Priya")).toBeDefined();
  });

  it("exports a project report from the details sheet", () => {
    const os = getOS();
    os.addProject({ name: "Report project" });

    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "More options for Report project" }));
    fireEvent.click(screen.getByTestId("project-export"));

    expect(screen.getByText("Project report downloaded")).toBeDefined();
  });
});