import type { PersonalOS } from "@personalos/core";

const DAY = 86_400_000;

interface SeedProject {
  name: string;
  summary: string;
  tasks: Array<{ title: string; column: "todo" | "in_progress" | "review" | "done"; priority: number; tags: string[]; dueInDays: number | null }>;
  milestones: Array<{ title: string; summary: string; dueInDays: number; done: boolean }>;
}

/**
 * Explicitly opt-in sample content so a new account can see how the board,
 * timeline and overview work before entering their own data.
 */
export const SAMPLE_PROJECTS: SeedProject[] = [
  {
    name: "Website redesign",
    summary: "Rebuild the marketing site and docs.",
    tasks: [
      { title: "Design home page wireframes", column: "done", priority: 2, tags: ["design"], dueInDays: -6 },
      { title: "Set up design tokens", column: "done", priority: 1, tags: ["design"], dueInDays: -4 },
      { title: "Build the docs site", column: "in_progress", priority: 3, tags: ["development"], dueInDays: 5 },
      { title: "Write launch copy", column: "in_progress", priority: 2, tags: ["content"], dueInDays: 8 },
      { title: "Navigation responsive pass", column: "review", priority: 2, tags: ["design"], dueInDays: 3 },
      { title: "Accessibility audit", column: "review", priority: 3, tags: ["quality"], dueInDays: 11 },
      { title: "Redirect map", column: "todo", priority: 1, tags: ["seo"], dueInDays: 14 },
      { title: "Analytics events", column: "todo", priority: 0, tags: ["development"], dueInDays: null },
      { title: "Migrate blog posts", column: "todo", priority: 1, tags: ["content"], dueInDays: 16 },
    ],
    milestones: [
      { title: "Design sign-off", summary: "Homepage and nav approved", dueInDays: -3, done: true },
      { title: "Beta launch", summary: "Internal dogfood release", dueInDays: 6, done: false },
      { title: "Public launch", summary: "Marketing site goes live", dueInDays: 26, done: false },
    ],
  },
  {
    name: "Quarterly planning",
    summary: "Set direction and goals for next quarter.",
    tasks: [
      { title: "Collect team retro notes", column: "done", priority: 2, tags: ["planning"], dueInDays: -2 },
      { title: "Draft the three bets", column: "in_progress", priority: 3, tags: ["planning"], dueInDays: 2 },
      { title: "Cost model", column: "review", priority: 2, tags: ["finance"], dueInDays: 4 },
      { title: "Headcount asks", column: "todo", priority: 3, tags: ["people"], dueInDays: 9 },
      { title: "Board deck outline", column: "todo", priority: 1, tags: ["planning"], dueInDays: 18 },
    ],
    milestones: [
      { title: "Leadership review", summary: "Present the plan", dueInDays: 7, done: false },
      { title: "Plan locked", summary: "Commit and publish", dueInDays: 21, done: false },
    ],
  },
];

export function seedSampleProjects(os: PersonalOS, now: number = Date.now()): string[] {
  const created: string[] = [];

  const existing = new Set(Object.values(os.getState().projects).map((project) => project.name));
  for (const seed of SAMPLE_PROJECTS) {
    if (existing.has(seed.name)) continue;
    const project = os.addProject({ name: seed.name, summary: seed.summary }, now);
    created.push(project.id);

    for (const milestone of seed.milestones) {
      os.addMilestone(
        {
          projectId: project.id,
          title: milestone.title,
          summary: milestone.summary,
          dueAt: now + milestone.dueInDays * DAY,
        },
        now,
      );
    }

    const milestones = os.milestonesFor(project.id);
    let taskIndex = 0;

    for (const task of seed.tasks) {
      const dueAt = task.dueInDays == null ? null : now + task.dueInDays * DAY;
      const milestone = task.column === "done" && taskIndex < milestones.length ? milestones[taskIndex] : null;
      taskIndex += 1;

      const createdTask = os.addProjectTask(
        {
          title: task.title,
          priority: task.priority as 0 | 1 | 2 | 3,
          tags: task.tags,
          dueAt,
          milestoneId: milestone?.id ?? null,
        },
        project.id,
        task.column,
        now,
      );

      if (dueAt != null && dueAt < now) {
        os.updateTask(createdTask.id, { completedAt: dueAt });
      }
    }

    const doneMilestone = milestones.find((milestone) => {
      const due = milestone.dueAt;
      return due != null && due < now;
    });
    if (doneMilestone) {
      os.updateMilestone(doneMilestone.id, {
        status: "completed",
        completedAt: doneMilestone.dueAt,
      });
    }
  }

  return created;
}