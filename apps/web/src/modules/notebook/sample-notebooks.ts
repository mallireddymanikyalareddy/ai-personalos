"use client";

import type { ID, PersonalOS } from "@personalos/core";

const DAY = 86_400_000;

interface SampleNotebook {
  title: string;
  description: string;
  color: string;
  icon: string;
  order: number;
}

export const SAMPLE_NOTEBOOKS: SampleNotebook[] = [
  { title: "Personal", description: "Life admin, errands and family", color: "var(--chart-4)", icon: "personal", order: 1 },
  { title: "Work", description: "Runbooks, support and planning", color: "var(--chart-5)", icon: "work", order: 2 },
  { title: "Projects", description: "Long-running product work", color: "var(--chart-6)", icon: "projects", order: 3 },
  { title: "Meeting Notes", description: "Decisions and action items", color: "var(--chart-3)", icon: "meeting notes", order: 4 },
  { title: "Ideas", description: "Passing thoughts worth keeping", color: "var(--chart-7)", icon: "ideas", order: 5 },
  { title: "Learning", description: "Books, courses and skills", color: "var(--chart-2)", icon: "learning", order: 6 },
  { title: "Finance", description: "Planning, budget and investing", color: "var(--chart-8)", icon: "finance", order: 7 },
  { title: "Health", description: "Training, food and recovery", color: "var(--chart-1)", icon: "health", order: 8 },
  { title: "Travel", description: "Trips and itineraries", color: "var(--chart-2)", icon: "travel", order: 9 },
  { title: "Journal", description: "Daily reflections and entries", color: "var(--chart-5)", icon: "journal", order: 10 },
  { title: "Reading", description: "Books and annotations", color: "var(--chart-6)", icon: "reading", order: 11 },
  { title: "Templates", description: "Reusable starting points", color: "var(--chart-7)", icon: "templates", order: 12 },
];

interface SampleNote {
  title: string;
  notebook: string;
  body: string;
  tags: string[];
  icon: string;
  ageDays: number;
}

const SAMPLE_NOTES: SampleNote[] = [
  {
    title: "D365 Support Runbook",
    notebook: "Work",
    body: "Step by step runbook for common D365 support issues including warehouse slotting, SLA breaches and runbook automation.",
    tags: ["work", "d365"],
    icon: "📄",
    ageDays: 0,
  },
  {
    title: "Project Planning - MedoriQ",
    notebook: "Projects",
    body: "Feature list, timelines and next steps for the MedoriQ platform. Phase two covers authentication, roles and dashboards.",
    tags: ["project", "planning", "medoriq"],
    icon: "📄",
    ageDays: 1,
  },
  {
    title: "Meeting Notes - Client Call",
    notebook: "Meeting Notes",
    body: "Discussion on requirements, action items and follow ups with the client team.",
    tags: ["meeting", "client"],
    icon: "💡",
    ageDays: 2,
  },
  {
    title: "Ideas - Side Business",
    notebook: "Ideas",
    body: "List of ideas for passive income and online tools worth exploring over the next quarter.",
    tags: ["ideas", "business"],
    icon: "💡",
    ageDays: 3,
  },
  {
    title: "Learning - Next.js 15",
    notebook: "Learning",
    body: "Notes on App Router, server components and deployment for the Next.js 15 release.",
    tags: ["learning", "nextjs"],
    icon: "📘",
    ageDays: 4,
  },
  {
    title: "Finance Planning",
    notebook: "Finance",
    body: "Salary, investments, tax planning and financial goals for the year ahead.",
    tags: ["finance", "planning"],
    icon: "📊",
    ageDays: 5,
  },
  {
    title: "Travel Plan - Goa",
    notebook: "Travel",
    body: "Flight details, hotel options and itinerary for the family trip.",
    tags: ["travel", "personal"],
    icon: "🗺️",
    ageDays: 6,
  },
  {
    title: "Cricket Training Notes",
    notebook: "Health",
    body: "Batting drills, practice schedule and fitness plan for the weekend league.",
    tags: ["cricket", "health"],
    icon: "🎯",
    ageDays: 7,
  },
  {
    title: "Reading List",
    notebook: "Learning",
    body: "Books queued for this year, mixing fiction and professional development.",
    tags: ["learning", "reading"],
    icon: "📚",
    ageDays: 9,
  },
  {
    title: "Home Renovation Ideas",
    notebook: "Personal",
    body: "Quotes, materials and the sequence of work for the living room refresh.",
    tags: ["personal", "ideas"],
    icon: "🏗️",
    ageDays: 11,
  },
  {
    title: "Support Handover Checklist",
    notebook: "Work",
    body: "Handover checklist for the support rotation including open escalations and runbook updates.",
    tags: ["work", "documentation"],
    icon: "📋",
    ageDays: 13,
  },
  {
    title: "Sprint Retrospective Notes",
    notebook: "Meeting Notes",
    body: "What went well, what slowed us down and the three changes we agreed to try next sprint.",
    tags: ["meeting", "team"],
    icon: "🧪",
    ageDays: 16,
  },
  {
    title: "Morning Journal Entry",
    notebook: "Journal",
    body: "Three things that went well today, one thing to improve, and what I want to focus on tomorrow.",
    tags: ["personal", "journal"],
    icon: "📝",
    ageDays: 1,
  },
  {
    title: "Book Notes - Deep Work",
    notebook: "Reading",
    body: "Annotations and quotes from Deep Work, with the scheduling rules I want to try this month.",
    tags: ["learning", "reading"],
    icon: "📚",
    ageDays: 5,
  },
  {
    title: "Weekly Review Template",
    notebook: "Templates",
    body: "Wins, challenges, lessons learned, and the one outcome that matters for next week.",
    tags: ["work", "planning"],
    icon: "📋",
    ageDays: 8,
  },
  {
    title: "Project Kickoff Template",
    notebook: "Templates",
    body: "Goal, scope, owners, milestones, risks and the first three tasks for every new project.",
    tags: ["project", "planning"],
    icon: "🎯",
    ageDays: 12,
  },
];

export function seedSampleNotebooks(os: PersonalOS, now: number = Date.now()): ID[] {
  const notebookIds = new Map<string, ID>();
  const existing = new Map(
    os.notebooks().map((notebook) => [notebook.title.trim().toLowerCase(), notebook]),
  );

  for (const sample of SAMPLE_NOTEBOOKS) {
    const key = sample.title.trim().toLowerCase();
    const current = existing.get(key);
    if (current != null) {
      os.updateNotebook(current.id, {
        description: sample.description,
        color: sample.color,
        icon: sample.icon,
        order: sample.order,
      });
      notebookIds.set(sample.title, current.id);
      continue;
    }
    const created = os.addNotebook(
      {
        title: sample.title,
        description: sample.description,
        color: sample.color,
        icon: sample.icon,
        order: sample.order,
      },
      now - 90 * DAY,
    );
    notebookIds.set(sample.title, created.id);
  }

  const existingPageTitles = new Set(
    Object.values(os.getState().pages).map((page) => page.title.trim().toLowerCase()),
  );

  const ids: ID[] = [];
  for (const sample of SAMPLE_NOTES) {
    const notebookId = notebookIds.get(sample.notebook);
    if (notebookId == null) continue;
    if (existingPageTitles.has(sample.title.trim().toLowerCase())) continue;
    const created = os.addPage(
      {
        notebookId,
        title: sample.title,
        body: sample.body,
        tags: sample.tags,
      },
      now - sample.ageDays * DAY,
    );
    os.updatePage(created.id, { lastEditedAt: now - sample.ageDays * DAY });
    ids.push(created.id);
  }

  return ids;
}
