import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonalOS, Project } from "@personalos/core";

import { getOS } from "@/store/os";

import { ProjectCard } from "./project-card";
import { ProjectKanban } from "./project-kanban";
import { ProjectOverview } from "./project-overview";
import { ProjectTimeline } from "./project-timeline";
import { seedSampleProjects } from "./sample-projects";
import { WorkActivity, WorkTeam } from "./work-side-panels";

afterEach(cleanup);

let os: PersonalOS;
let project: Project;

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  project = os.addProject({ name: "MedoriQ", summary: "AI healthcare platform" });
});

function addTask(title: string, patch: Record<string, unknown> = {}) {
  return os.addTask({ title, projectId: project.id, ...patch } as never);
}

function emptyProps() {
  return {
    board: os.projectBoard(project.id),
    assigneeNames: {} as Record<string, string>,
    onMove: vi.fn(),
    onOpenTask: vi.fn(),
    onAddTask: vi.fn(),
  };
}

describe("ProjectCard", () => {
  it("shows the name, summary and progress", () => {
    addTask("a", { status: "open" });
    addTask("b", { status: "done", completedAt: Date.now() });

    render(
      <ProjectCard
        project={project}
        stats={os.projectStats(project.id)}
        selected={false}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("MedoriQ")).toBeDefined();
    expect(screen.getByText("AI healthcare platform")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("shows done-over-total and milestone counts", () => {
    addTask("a", { status: "open" });
    addTask("b", { status: "done", completedAt: Date.now() });
    os.addMilestone({ projectId: project.id, title: "Beta" });

    render(
      <ProjectCard
        project={project}
        stats={os.projectStats(project.id)}
        selected={false}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("1/2")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
  });

  it("marks the selected project", () => {
    render(
      <ProjectCard
        project={project}
        stats={os.projectStats(project.id)}
        selected
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByTestId(`project-card-${project.id}`).getAttribute("data-selected")).toBe("true");
  });

  it("selects when its name button is pressed", () => {
    const onSelect = vi.fn();
    render(
      <ProjectCard
        project={project}
        stats={os.projectStats(project.id)}
        selected={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /MedoriQ/ }));
    expect(onSelect).toHaveBeenCalled();
  });

  it("shows a dash when the project has no deadline", () => {
    render(
      <ProjectCard
        project={project}
        stats={os.projectStats(project.id)}
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText("—")).toBeDefined();
  });
});

describe("ProjectKanban", () => {
  it("renders all four columns with counts", () => {
    addTask("Design", { status: "open" });
    addTask("Build", { status: "in_progress" });
    addTask("QA", { status: "review" });
    addTask("Ship", { status: "done", completedAt: Date.now() });

    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);

    for (const label of ["To Do", "In Progress", "Review", "Done"]) {
      expect(screen.getByRole("region", { name: label })).toBeDefined();
    }
    expect(within(screen.getByRole("region", { name: "To Do" })).getByText("Design")).toBeDefined();
    expect(within(screen.getByRole("region", { name: "Review" })).getByText("QA")).toBeDefined();
  });

  it("puts each task in its matching column", () => {
    addTask("Design", { status: "open" });
    addTask("QA", { status: "review" });

    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);

    expect(screen.getByTestId(`kanban-card-${os.getState().tasks[Object.keys(os.getState().tasks)[0]!]!.id}`)).toBeDefined();
    const review = screen.getByRole("region", { name: "Review" });
    expect(within(review).getByText("QA")).toBeDefined();
  });

  it("moves a task one column right", () => {
    const task = addTask("Design", { status: "open" });
    const props = emptyProps();
    render(<ProjectKanban {...props} board={os.projectBoard(project.id)} />);

    fireEvent.click(screen.getByRole("button", { name: `Move ${task.title} right` }));
    expect(props.onMove).toHaveBeenCalledWith(task.id, "in_progress");
  });

  it("moves a task one column left", () => {
    const task = addTask("QA", { status: "review" });
    const props = emptyProps();
    render(<ProjectKanban {...props} board={os.projectBoard(project.id)} />);

    fireEvent.click(screen.getByRole("button", { name: `Move ${task.title} left` }));
    expect(props.onMove).toHaveBeenCalledWith(task.id, "in_progress");
  });

  it("disables the left move in the first column", () => {
    addTask("Design", { status: "open" });
    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);
    expect((screen.getByRole("button", { name: "Move Design left" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the right move in the last column", () => {
    addTask("Shipped", { status: "done" });
    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);
    expect((screen.getByRole("button", { name: "Move Shipped right" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows priority and tags on a card", () => {
    addTask("Design", { status: "open", priority: 3, tags: ["design"] });
    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);
    expect(screen.getByText("High")).toBeDefined();
    expect(screen.getByText("design")).toBeDefined();
  });

  it("shows an explicit no-due-date hint", () => {
    addTask("Design", { status: "open" });
    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);
    expect(screen.getByText("No due date")).toBeDefined();
  });

  it("shows the assignee name when one is mapped", () => {
    addTask("Design", { status: "open", assigneeId: "u-priya" });
    render(
      <ProjectKanban
        {...emptyProps()}
        board={os.projectBoard(project.id)}
        assigneeNames={{ "u-priya": "Priya" }}
      />,
    );
    expect(screen.getByText("Priya")).toBeDefined();
  });

  it("opens a task from its title", () => {
    const task = addTask("Design", { status: "open" });
    const props = emptyProps();
    render(<ProjectKanban {...props} board={os.projectBoard(project.id)} />);

    fireEvent.click(screen.getByRole("button", { name: "Open task Design" }));
    expect(props.onOpenTask).toHaveBeenCalledWith(task.id);
  });

  it("creates a task from the column add control", () => {
    const props = emptyProps();
    render(<ProjectKanban {...props} board={os.projectBoard(project.id)} />);

    fireEvent.click(screen.getByRole("button", { name: "Add task to Review" }));
    fireEvent.change(screen.getByLabelText("New task in Review"), {
      target: { value: "Check the flow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(props.onAddTask).toHaveBeenCalledWith("review", "Check the flow");
  });

  it("cancels a new task without calling back", () => {
    const props = emptyProps();
    render(<ProjectKanban {...props} board={os.projectBoard(project.id)} />);

    fireEvent.click(screen.getByRole("button", { name: "Add task to To Do" }));
    fireEvent.change(screen.getByLabelText("New task in To Do"), { target: { value: "Nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onAddTask).not.toHaveBeenCalled();
  });

  it("shows an empty column with only its add control", () => {
    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} />);
    expect(screen.getByRole("region", { name: "To Do" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add task to To Do" })).toBeDefined();
  });
});

describe("ProjectOverview", () => {
  it("shows overall progress and the column breakdown", () => {
    addTask("a", { status: "open" });
    addTask("b", { status: "done", completedAt: Date.now() });

    render(
      <ProjectOverview
        stats={os.projectStats(project.id)}
        milestones={[]}
        teamCount={2}
      />,
    );

    expect(screen.getByText("50%")).toBeDefined();
    expect(screen.getByText("progress")).toBeDefined();
    for (const label of ["To Do", "In Progress", "Review", "Done"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it("shows totals as tiles", () => {
    addTask("a", { status: "open" });
    os.addMilestone({ projectId: project.id, title: "Beta" });

    render(
      <ProjectOverview stats={os.projectStats(project.id)} milestones={[]} teamCount={3} />,
    );

    expect(screen.getByText("Tasks")).toBeDefined();
    expect(screen.getByText("Milestones")).toBeDefined();
    expect(screen.getByText("Members")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("explains an empty milestone list", () => {
    render(<ProjectOverview stats={os.projectStats(project.id)} milestones={[]} teamCount={0} />);
    expect(screen.getByText(/No open milestones/)).toBeDefined();
  });

  it("lists upcoming milestones with their health", () => {
    const milestone = os.addMilestone(
      { projectId: project.id, title: "Complete authentication", dueAt: Date.now() + 3 * 86_400_000 },
      Date.now(),
    );
    addTask("Start on it", { status: "in_progress", milestoneId: milestone.id });

    render(
      <ProjectOverview
        stats={os.projectStats(project.id)}
        milestones={os.projectUpcomingMilestones(project.id, 5, Date.now())}
        teamCount={0}
      />,
    );

    expect(screen.getByText("Complete authentication")).toBeDefined();
    expect(screen.getByText("On Track")).toBeDefined();
    expect(screen.getByText("0/1 tasks")).toBeDefined();
  });

  it("flags an overdue milestone as at risk", () => {
    const milestone = os.addMilestone(
      { projectId: project.id, title: "Slipping", dueAt: Date.now() - 2 * 86_400_000 },
      Date.now(),
    );
    addTask("Half done", { status: "in_progress", milestoneId: milestone.id });

    render(
      <ProjectOverview
        stats={os.projectStats(project.id)}
        milestones={os.projectUpcomingMilestones(project.id, 5, Date.now())}
        teamCount={0}
      />,
    );

    expect(screen.getByText("At Risk")).toBeDefined();
  });

  it("shows the earliest deadline only when one exists", () => {
    const { unmount } = render(
      <ProjectOverview stats={os.projectStats(project.id)} milestones={[]} teamCount={0} />,
    );
    expect(screen.queryByText(/Earliest deadline/)).toBeNull();
    unmount();

    os.addMilestone({
      projectId: project.id,
      title: "Beta",
      dueAt: Date.now() + 10 * 86_400_000,
    });
    render(
      <ProjectOverview stats={os.projectStats(project.id)} milestones={[]} teamCount={0} />,
    );
    expect(screen.getByText(/Earliest deadline/)).toBeDefined();
  });
});

describe("WorkTeam", () => {
  it("explains itself with no members", () => {
    render(<WorkTeam team={[]} />);
    expect(screen.getByText(/No members yet/)).toBeDefined();
  });

  it("lists members with role and task count", () => {
    const member = os.addMember({ userId: "u-priya", displayName: "Priya", role: "admin" });
    addTask("One", { assigneeId: member.userId });
    addTask("Two", { assigneeId: member.userId });

    render(<WorkTeam team={os.projectTeam(project.id)} />);

    expect(screen.getByText("Priya")).toBeDefined();
    expect(screen.getByText(/2 tasks/)).toBeDefined();
    expect(screen.getByText("admin")).toBeDefined();
  });

  it("does not claim anyone is online", () => {
    const member = os.addMember({ userId: "u-priya", displayName: "Priya", role: "member" });
    addTask("One", { assigneeId: member.userId });
    const { container } = render(<WorkTeam team={os.projectTeam(project.id)} />);
    expect(container.textContent?.toLowerCase()).not.toContain("online");
  });
});

describe("WorkActivity", () => {
  it("explains itself with no activity", () => {
    render(<WorkActivity entries={[]} />);
    expect(screen.getByText(/Nothing recorded in the last 60 days/)).toBeDefined();
  });

  it("derives activity from real task movement", () => {
    const task = addTask("Ship it", { status: "open" });
    os.updateTask(task.id, { status: "done", completedAt: Date.now() });

    render(<WorkActivity entries={os.projectActivity(project.id, 6, Date.now())} />);

    expect(screen.getAllByText("Ship it").length).toBeGreaterThan(0);
    expect(screen.getByText(/moved to Done/)).toBeDefined();
  });

  it("shows relative timestamps", () => {
    addTask("Recent", { status: "open" });
    render(<WorkActivity entries={os.projectActivity(project.id, 6, Date.now())} />);
    expect(screen.getAllByText("just now").length).toBeGreaterThan(0);
  });
});

describe("ProjectTimeline", () => {
  it("explains itself when the project has no milestones", () => {
    render(<ProjectTimeline os={os} projectId={project.id} />);
    expect(screen.getByText(/No milestones to chart yet/)).toBeDefined();
  });

  it("renders a bar per milestone", () => {
    const a = os.addMilestone({ projectId: project.id, title: "Beta", dueAt: Date.now() + 10 * 86_400_000 });
    const b = os.addMilestone({ projectId: project.id, title: "Launch", dueAt: Date.now() + 30 * 86_400_000 });

    render(<ProjectTimeline os={os} projectId={project.id} />);

    expect(screen.getByTestId(`timeline-bar-${a.id}`)).toBeDefined();
    expect(screen.getByTestId(`timeline-bar-${b.id}`)).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Launch")).toBeDefined();
  });

  it("shows month headers and a legend", () => {
    os.addMilestone({ projectId: project.id, title: "Beta", dueAt: Date.now() + 20 * 86_400_000 });
    render(<ProjectTimeline os={os} projectId={project.id} />);

    expect(screen.getByText("Planned")).toBeDefined();
    expect(screen.getByText("In progress")).toBeDefined();
    expect(screen.getByText("Overdue")).toBeDefined();
    expect(screen.getByText("Complete")).toBeDefined();
  });

  it("positions a bar inside the chart width", () => {
    const m = os.addMilestone({ projectId: project.id, title: "Beta", dueAt: Date.now() + 5 * 86_400_000 });
    render(<ProjectTimeline os={os} projectId={project.id} />);

    const bar = screen.getByTestId(`timeline-bar-${m.id}`) as HTMLElement;
    const left = Number.parseFloat(bar.style.left);
    const width = Number.parseFloat(bar.style.width);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(width).toBeGreaterThan(0);
    expect(left + width).toBeLessThanOrEqual(100.001);
  });

  it("colours an overdue milestone as a danger bar", () => {
    const m = os.addMilestone({ projectId: project.id, title: "Slipped", dueAt: Date.now() - 5 * 86_400_000 });
    render(<ProjectTimeline os={os} projectId={project.id} />);

    const bar = screen.getByTestId(`timeline-bar-${m.id}`);
    expect(bar.className).toContain("bg-danger");
  });

  it("colours a completed milestone as success", () => {
    const m = os.addMilestone({ projectId: project.id, title: "Done", dueAt: Date.now() - 2 * 86_400_000 });
    os.updateMilestone(m.id, { status: "completed", completedAt: Date.now() - 3 * 86_400_000 });
    render(<ProjectTimeline os={os} projectId={project.id} />);

    const bar = screen.getByTestId(`timeline-bar-${m.id}`);
    expect(bar.className).toContain("bg-success");
  });

  it("colours a milestone with completed tasks as in progress", () => {
    const m = os.addMilestone({ projectId: project.id, title: "Moving", dueAt: Date.now() + 10 * 86_400_000 });
    const t = os.addTask({ title: "half", projectId: project.id, milestoneId: m.id }, Date.now());
    os.updateTask(t.id, { status: "done" });
    render(<ProjectTimeline os={os} projectId={project.id} />);

    const bar = screen.getByTestId(`timeline-bar-${m.id}`);
    expect(bar.className).toContain("bg-info");
  });
});

describe("seedSampleProjects", () => {
  it("creates two projects with tasks across all four columns", () => {
    const ids = seedSampleProjects(os);
    expect(ids).toHaveLength(2);

    const board = os.projectBoard(ids[0]!);
    expect(board.todo.length).toBeGreaterThan(0);
    expect(board.in_progress.length).toBeGreaterThan(0);
    expect(board.review.length).toBeGreaterThan(0);
    expect(board.done.length).toBeGreaterThan(0);
  });

  it("creates milestones with due dates so the timeline has content", () => {
    const ids = seedSampleProjects(os);
    const milestones = os.milestonesFor(ids[0]!);
    expect(milestones.length).toBeGreaterThan(0);
    expect(milestones.some((milestone) => milestone.dueAt != null)).toBe(true);
  });

  it("marks past-due milestones complete", () => {
    const ids = seedSampleProjects(os);
    const milestones = os.milestonesFor(ids[0]!);
    expect(milestones.some((milestone) => milestone.status === "completed")).toBe(true);
  });

  it("stamps completedAt on past-due done tasks", () => {
    const ids = seedSampleProjects(os);
    const done = os.projectBoard(ids[0]!).done;
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((task) => task.completedAt != null)).toBe(true);
  });

  it("gives the sample projects non-zero progress", () => {
    const ids = seedSampleProjects(os);
    expect(os.projectStats(ids[0]!).progress).toBeGreaterThan(0);
  });

  it("fills the timeline with bars", () => {
    const ids = seedSampleProjects(os);
    render(<ProjectTimeline os={os} projectId={ids[0]!} />);
    expect(screen.getAllByTestId(/^timeline-bar-/).length).toBeGreaterThan(0);
  });
});

describe("work board integration through the OS", () => {
  it("persists a move between columns", () => {
    const task = addTask("Design", { status: "open" });
    os.moveTaskToColumn(task.id, project.id, "review");

    expect(os.getTask(task.id)?.status).toBe("review");
    expect(os.projectBoard(project.id).review).toHaveLength(1);
  });

  it("adds a task straight into a column", () => {
    os.addProjectTask({ title: "Fresh" }, project.id, "in_progress");
    expect(os.projectBoard(project.id).in_progress.map((task) => task.title)).toEqual(["Fresh"]);
  });

  it("accepts review as a task status from the task type", () => {
    const created = addTask("Review me", { status: "review" });
    expect(created.status).toBe("review");
  });
});
describe("ProjectKanban drag and drop", () => {
  it("moves a task when it is dropped on another column", () => {
    const task = addTask("Drag me", { status: "open" });
    const onMove = vi.fn();
    const data = new Map<string, string>();
    const dataTransfer = {
      types: ["application/x-project-task"],
      dropEffect: "move",
      effectAllowed: "move",
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key) ?? "",
    } as unknown as DataTransfer;

    render(<ProjectKanban {...emptyProps()} board={os.projectBoard(project.id)} onMove={onMove} />);

    fireEvent.dragStart(screen.getByTestId(`kanban-card-${task.id}`), { dataTransfer });
    const target = screen.getByRole("region", { name: "In Progress" });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(onMove).toHaveBeenCalledWith(task.id, "in_progress");
  });
});