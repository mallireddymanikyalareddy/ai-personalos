"use client";

import type { ID, NewProjectInput, NewTaskInput, PersonalOS, Priority, Timestamp } from "@personalos/core";

export interface SampleProject {
  name: string;
  color: string;
  summary: string;
}

export const SAMPLE_PROJECTS: SampleProject[] = [
  { name: "D365 Support", color: "var(--chart-5)", summary: "Ongoing D365 runbook and config work" },
  { name: "Personal", color: "var(--chart-4)", summary: "Personal errands and appointments" },
  { name: "Projects", color: "var(--chart-6)", summary: "Cross-team project delivery" },
  { name: "Team Enablement", color: "var(--chart-7)", summary: "Training and knowledge sharing" },
  { name: "Home", color: "var(--chart-3)", summary: "Household tasks" },
];

interface SampleTask {
  title: string;
  project: string;
  priority: Priority;
  /** Days from now for the due date; negative means already completed. */
  dueDays: number;
  status: "open" | "in_progress" | "done";
  tags: string[];
}

const SAMPLE_TASKS: SampleTask[] = [
  { title: "Update D365 runbook documentation", project: "D365 Support", priority: 3, dueDays: 0, status: "in_progress", tags: ["work", "d365"] },
  { title: "Review purchase agreement workflow", project: "D365 Support", priority: 3, dueDays: 0, status: "open", tags: ["work", "finance"] },
  { title: "Fix warehouse issue with slotting", project: "D365 Support", priority: 2, dueDays: 0, status: "in_progress", tags: ["warehouse", "d365"] },
  { title: "Prepare KT session for next week", project: "Team Enablement", priority: 2, dueDays: 0, status: "open", tags: ["training", "team"] },
  { title: "Review trade agreement config", project: "D365 Support", priority: 1, dueDays: 0, status: "open", tags: ["trade", "d365"] },
  { title: "Plan weekend cricket match", project: "Personal", priority: 2, dueDays: 1, status: "open", tags: ["cricket", "personal"] },
  { title: "Book doctor appointment", project: "Personal", priority: 1, dueDays: 2, status: "open", tags: ["health", "personal"] },
  { title: "Finalize solar project proposal", project: "Projects", priority: 3, dueDays: 2, status: "open", tags: ["solar", "business"] },
  { title: "Ship release notes", project: "Projects", priority: 2, dueDays: 3, status: "open", tags: ["release"] },
  { title: "Onboard new analyst", project: "Team Enablement", priority: 2, dueDays: 4, status: "open", tags: ["training", "team"] },
  { title: "Renew car insurance", project: "Home", priority: 1, dueDays: 5, status: "open", tags: ["home", "admin"] },
  { title: "Water the plants", project: "Home", priority: 1, dueDays: 6, status: "open", tags: ["home"] },
  { title: "Close last sprint", project: "Projects", priority: 2, dueDays: -1, status: "done", tags: ["release"] },
  { title: "Archive stale runbooks", project: "D365 Support", priority: 1, dueDays: -2, status: "done", tags: ["d365"] },
];

const DAY = 86_400_000;

export function seedSampleTasks(os: PersonalOS, now: number = Date.now()): string[] {
  const ids: string[] = [];
  const projectIds = new Map<string, ID>();

  for (const sample of SAMPLE_PROJECTS) {
    const input: NewProjectInput = {
      name: sample.name,
      color: sample.color,
      summary: sample.summary,
    };
    const project = os.addProject(input, now - 60 * DAY);
    projectIds.set(sample.name, project.id);
  }

  SAMPLE_TASKS.forEach((sample, index) => {
    const createdAt: Timestamp = now - (SAMPLE_TASKS.length - index) * 6 * 3_600_000;
    const input: NewTaskInput = {
      title: sample.title,
      priority: sample.priority,
      projectId: projectIds.get(sample.project) ?? null,
      tags: sample.tags,
      status: sample.status,
      dueAt: sample.dueDays > 0 ? now + sample.dueDays * DAY : null,
    };
    const task = os.addTask(input, createdAt);
    if (sample.status === "in_progress") {
      os.updateTask(task.id, { startedAt: now - 2 * 3_600_000 });
    }
    if (sample.status === "done") {
      os.updateTask(task.id, { completedAt: now + sample.dueDays * DAY });
    }
    ids.push(task.id);
  });

  return ids;
}