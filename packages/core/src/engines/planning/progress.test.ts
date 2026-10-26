import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("planning progress", () => {
  it("computes milestone progress from its tasks", () => {
    const os = makeOS();
    const project = os.addProject("Ship");
    const milestone = os.addMilestone({ projectId: project.id, title: "Beta" });
    os.addTask({ title: "A", projectId: project.id, milestoneId: milestone.id, status: "done" });
    const open = os.addTask({ title: "B", projectId: project.id, milestoneId: milestone.id, status: "open" });

    expect(os.milestoneProgressFor(milestone.id)).toBe(50);
    os.completeTask(open.id);
    expect(os.milestoneProgressFor(milestone.id)).toBe(100);

    os.completeMilestone(milestone.id);
    expect(os.milestonesFor(project.id)[0]?.status).toBe("completed");
    expect(os.reopenMilestone(milestone.id)?.status).toBe("open");
  });

  it("computes project progress with gate weight when milestones exist", () => {
    const os = makeOS();
    const project = os.addProject("Ship");
    const m1 = os.addMilestone({ projectId: project.id, title: "Design" });
    const m2 = os.addMilestone({ projectId: project.id, title: "Build" });

    os.addTask({ title: "D1", projectId: project.id, milestoneId: m1.id, status: "done" });
    os.addTask({ title: "B1", projectId: project.id, milestoneId: m2.id, status: "open" });
    os.completeMilestone(m1.id);

    const progress = os.projectProgressFor(project.id);
    expect(progress).toBe(Math.round(0.4 * 50) + Math.round(0.6 * 50));
  });

  it("falls back to task completion when no milestones exist", () => {
    const os = makeOS();
    const project = os.addProject("Ship");
    os.addTask({ title: "A", projectId: project.id, status: "done" });
    os.addTask({ title: "B", projectId: project.id, status: "open" });

    expect(os.projectProgressFor(project.id)).toBe(50);
  });

  it("drives goal progress from metrics", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Read more", metrics: [{ label: "Books", target: 10, current: 5, unit: "books" }] });

    expect(os.goalProgressFor(goal.id).progress).toBe(50);
    expect(os.goalProgressFor(goal.id).breakdown.metric).toBe(50);
  });

  it("rolls up project and task progress into a goal", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Get fit" });
    const project = os.addProject("Run");
    os.updateProject(project.id, { goalIds: [goal.id] });
    os.addTask({ title: "A", projectId: project.id, goalIds: [goal.id], status: "done" });
    os.addTask({ title: "B", projectId: project.id, goalIds: [goal.id], status: "open" });

    const result = os.goalProgressFor(goal.id);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.progress).toBeLessThanOrEqual(100);
    expect(result.breakdown.projects).not.toBeNull();
  });

  it("links and unlinks projects from goals", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Grow" });
    const project = os.addProject("Biz");

    os.linkGoalToProject(project.id, goal.id);
    expect(os.getProject(project.id)?.goalIds).toContain(goal.id);

    os.unlinkGoalFromProject(project.id, goal.id);
    expect(os.getProject(project.id)?.goalIds).not.toContain(goal.id);
  });

  it("manages goal metrics", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Write" });

    os.addGoalMetric(goal.id, { label: "Words", target: 1000, current: 0, unit: "words" });
    expect(os.getGoal(goal.id)?.metrics).toHaveLength(1);

    os.updateGoalMetric(goal.id, 0, { current: 500 });
    expect(os.goalMetricProgress(goal.id)).toBe(50);

    os.removeGoalMetric(goal.id, 0);
    expect(os.getGoal(goal.id)?.metrics).toHaveLength(0);
  });

  it("completes and reopens goals, persisting progress", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Ship", metrics: [{ label: "Releases", target: 2, current: 2, unit: "releases" }] });

    os.completeGoal(goal.id);
    expect(os.getGoal(goal.id)?.status).toBe("completed");
    expect(os.getGoal(goal.id)?.progress).toBe(100);

    os.reopenGoal(goal.id);
    expect(os.getGoal(goal.id)?.status).toBe("active");
  });
});