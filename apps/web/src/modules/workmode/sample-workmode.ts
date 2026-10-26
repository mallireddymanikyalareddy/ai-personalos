"use client";

import type { ID, PersonalOS } from "@personalos/core";

const DAY = 86_400_000;
const HOUR = 3_600_000;

interface SeedProject {
  name: string;
  summary: string;
  color: string;
}

const SEED_PROJECTS: SeedProject[] = [
  { name: "D365 Support", summary: "Production support, runbooks and SLA tracking", color: "var(--chart-5)" },
  { name: "MedoriQ Platform", summary: "Phase 2 development and testing", color: "var(--chart-6)" },
  { name: "Internal Tools", summary: "Automation and productivity tools", color: "var(--chart-3)" },
  { name: "Knowledge Base", summary: "Documentation and training materials", color: "var(--chart-7)" },
];

interface SeedTask {
  title: string;
  project: string;
  tag: string;
  hour: number;
  done?: boolean;
}

const SEED_TASKS: SeedTask[] = [
  { title: "Review D365 support tickets", project: "D365 Support", tag: "Support", hour: 9 },
  { title: "Standup preparation", project: "Internal Tools", tag: "Internal", hour: 10, done: true },
  { title: "Client call - ACME", project: "MedoriQ Platform", tag: "Client", hour: 11.5 },
  { title: "Update runbook documentation", project: "Knowledge Base", tag: "Documentation", hour: 14 },
  { title: "Review team performance", project: "D365 Support", tag: "Management", hour: 15.5 },
  { title: "Ship the pricing sheet", project: "MedoriQ Platform", tag: "Client", hour: 16.5 },
  { title: "Prep the sprint board", project: "Internal Tools", tag: "Internal", hour: 9.5 },
];

interface SeedMeeting {
  title: string;
  hour: number;
  minutes: number;
  location: string;
  attendees: number;
}

const SEED_MEETINGS: SeedMeeting[] = [
  { title: "Daily Standup", hour: 9, minutes: 30, location: "Microsoft Teams", attendees: 5 },
  { title: "Client Sync - ACME", hour: 11.5, minutes: 60, location: "Zoom", attendees: 7 },
  { title: "D365 Support Review", hour: 14, minutes: 45, location: "Teams", attendees: 8 },
  { title: "Sprint Planning", hour: 16, minutes: 30, location: "Google Meet", attendees: 6 },
];

interface SeedDocument {
  title: string;
  tag: string;
  ageDays: number;
}

const SEED_DOCUMENTS: SeedDocument[] = [
  { title: "D365 Support Runbook v2.0", tag: "Documentation", ageDays: 0.08 },
  { title: "Client Requirements - ACME", tag: "Client", ageDays: 0.2 },
  { title: "Sprint Planning Notes", tag: "Planning", ageDays: 1 },
  { title: "Q4 Pricing Model", tag: "Finance", ageDays: 3 },
];

export function seedWorkModeData(os: PersonalOS, now: number = Date.now()): ID[] {
  const ids: ID[] = [];
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const projectIds = new Map<string, ID>();
  for (const seed of SEED_PROJECTS) {
    const existing = Object.values(os.getState().projects).find(
      (project) => project.name === seed.name,
    );
    if (existing != null) {
      projectIds.set(seed.name, existing.id);
      continue;
    }
    const project = os.addProject(
      { name: seed.name, summary: seed.summary, color: seed.color, mode: "work" },
      now - 30 * DAY,
    );
    projectIds.set(seed.name, project.id);
  }

  for (const seed of SEED_TASKS) {
    const projectId = projectIds.get(seed.project) ?? null;
    if (Object.values(os.getState().tasks).some((task) => task.title === seed.title)) continue;
    const task = os.addTask(
      {
        title: seed.title,
        projectId,
        tags: [seed.tag.toLowerCase()],
        dueAt: today + seed.hour * HOUR,
        priority: 3,
        status: seed.done ? "done" : "open",
        mode: "work",
      },
      now - 2 * DAY,
    );
    if (seed.done) {
      os.updateTask(task.id, { status: "done", completedAt: today + seed.hour * HOUR });
    }
    ids.push(task.id);
  }

  for (const seed of SEED_MEETINGS) {
    if (Object.values(os.getState().meetings).some((meeting) => meeting.title === seed.title)) {
      continue;
    }
    const startsAt = today + seed.hour * HOUR;
    const meeting = os.addMeeting(
      {
        title: seed.title,
        startsAt,
        endsAt: startsAt + seed.minutes * 60_000,
        notes: `${seed.title} — recurring work session.`,
        tags: [seed.title.split(" ")[0]!.toLowerCase()],
      },
      now - 5 * DAY,
    );
    os.updateMeeting(meeting.id, { location: seed.location });
    ids.push(meeting.id);
  }

  for (const seed of SEED_DOCUMENTS) {
    if (Object.values(os.getState().notes).some((note) => note.title === seed.title)) continue;
    const created = os.addNote(
      {
        title: seed.title,
        body: `${seed.title} — working document for the ${seed.tag.toLowerCase()} workflow.`,
        tags: [seed.tag.toLowerCase()],
        projectId: projectIds.get("D365 Support") ?? null,
        mode: "work",
      },
      now - seed.ageDays * DAY,
    );
    ids.push(created.id);
  }

  const members = os.members();
  const memberId = members[0]?.id ?? null;
  const hasFocus = os.focusSessions().length > 0;
  if (!hasFocus) {
    for (let day = 0; day < 7; day += 1) {
      const minutes = day === 0 ? 150 : 90 + (day % 4) * 30;
      const startedAt = today - day * DAY + 9 * HOUR;
      const session = os.startFocusSession(
        { startedAt, plannedMin: minutes, taskId: memberId, mode: "countdown" },
        startedAt,
      );
      os.completeFocusSession(session.id, {}, startedAt + minutes * 60_000);
    }
  }

  return ids;
}

