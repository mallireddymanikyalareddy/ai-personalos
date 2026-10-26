"use client";

import type { ID, PersonalOS } from "@personalos/core";

const DAY = 86_400_000;

interface SampleFolder {
  name: string;
  color: string;
  icon: string;
}

export const SAMPLE_FOLDERS: SampleFolder[] = [
  { name: "Personal", color: "var(--chart-4)", icon: "personal" },
  { name: "Work", color: "var(--chart-5)", icon: "work" },
  { name: "Projects", color: "var(--chart-6)", icon: "projects" },
  { name: "Meeting Notes", color: "var(--chart-3)", icon: "meeting notes" },
  { name: "Ideas", color: "var(--chart-7)", icon: "ideas" },
  { name: "Learning", color: "var(--chart-2)", icon: "learning" },
  { name: "Finance", color: "var(--chart-8)", icon: "finance" },
  { name: "Health", color: "var(--chart-1)", icon: "health" },
  { name: "Travel", color: "var(--chart-2)", icon: "travel" },
];

interface SamplePage {
  name: string;
  folder: string;
  tags: string[];
  kind: "handwritten" | "typed" | "template" | "scan" | "pdf" | "image";
  text: string;
  favorite?: boolean;
  shared?: boolean;
  ageDays: number;
}

const SAMPLE_PAGES: SamplePage[] = [
  {
    name: "Project Planning Notes",
    folder: "Projects",
    tags: ["project", "work"],
    kind: "typed",
    ageDays: 0,
    favorite: true,
    text: "High level plan, milestones and next steps for the MedoriQ launch. Phase one covers authentication, roles and the core dashboard.",
  },
  {
    name: "Meeting Notes - D365 Support",
    folder: "Meeting Notes",
    tags: ["meeting", "work"],
    kind: "typed",
    ageDays: 0.1,
    text: "Discussion on SLA tracking and automation. We agreed to automate the runbook steps and review the warehouse issue next week.",
  },
  {
    name: "Annual Finance Plan 2026",
    folder: "Finance",
    tags: ["finance", "personal"],
    kind: "typed",
    ageDays: 1,
    text: "Investment plan, tax planning and goals. Rebalance the portfolio once the equity share crosses 70%.",
  },
  {
    name: "Ideas Inbox",
    folder: "Ideas",
    tags: ["ideas", "personal"],
    kind: "handwritten",
    ageDays: 2,
    text: "Quick ideas and thoughts to explore later.",
  },
  {
    name: "Travel Plan - Goa",
    folder: "Travel",
    tags: ["travel", "personal"],
    kind: "scan",
    ageDays: 3,
    text: "Flight, hotel, itinerary and checklist for the family trip to Goa.",
  },
  {
    name: "Healthy Living Guide",
    folder: "Health",
    tags: ["health", "personal"],
    kind: "scan",
    ageDays: 4,
    text: "Meal plan, workout plan and nutrition notes for a healthy lifestyle.",
  },
  {
    name: "Learning Notes",
    folder: "Learning",
    tags: ["learning", "personal"],
    kind: "typed",
    ageDays: 5,
    text: "Technology, investing and skill development. Read one book a month and keep notes.",
  },
  {
    name: "Home Improvement",
    folder: "Personal",
    tags: ["personal", "ideas"],
    kind: "image",
    ageDays: 6,
    text: "Ideas, budget and renovation plan for the house.",
  },
  {
    name: "Book Summary - Atomic Habits",
    folder: "Learning",
    tags: ["learning", "personal"],
    kind: "pdf",
    ageDays: 7,
    text: "Key takeaways and implementation ideas from Atomic Habits by James Clear.",
  },
  {
    name: "Work SOPs",
    folder: "Work",
    tags: ["work", "documentation"],
    kind: "template",
    ageDays: 7,
    text: "Standard operating procedures and runbooks for the support team.",
  },
  {
    name: "Cricket Practice Plan",
    folder: "Personal",
    tags: ["personal", "health"],
    kind: "typed",
    ageDays: 7,
    text: "Training schedule, drills and match preparation for the weekend league.",
  },
  {
    name: "Family Notes",
    folder: "Personal",
    tags: ["personal", "family"],
    kind: "typed",
    ageDays: 7,
    text: "Important notes, plans and memories for the family.",
  },
];

export function seedSamplePaper(os: PersonalOS, now: number = Date.now()): ID[] {
  const folderIds = new Map<string, ID>();
  const existingFolders = new Map(os.paperFolders().map((folder) => [folder.name, folder.id]));
  for (const folder of SAMPLE_FOLDERS) {
    const existingId = existingFolders.get(folder.name);
    if (existingId) {
      folderIds.set(folder.name, existingId);
      continue;
    }
    const created = os.addPaperFolder(
      { name: folder.name, color: folder.color, icon: folder.icon },
      now - 60 * DAY,
    );
    folderIds.set(folder.name, created.id);
  }

  let notebook = os.paperNotebooks().find((entry) => entry.title === "All documents") ?? null;
  const createdNotebook = notebook == null;
  if (notebook == null) {
    notebook = os.addPaperNotebook({ title: "All documents" }, now - 60 * DAY);
  }
  if (createdNotebook) {
    const firstPage = os.paperPages(notebook.id)[0];
    if (firstPage) os.deletePaperPage(firstPage.id);
  }

  const existingPages = new Set(
    Object.values(os.getState().paperPages).map((page) => page.name),
  );
  const ids: ID[] = [];
  for (const sample of SAMPLE_PAGES) {
    if (existingPages.has(sample.name)) continue;
    const created = os.addPaperPage(
      {
        notebookId: notebook.id,
        name: sample.name,
        kind: sample.kind,
        folderId: folderIds.get(sample.folder) ?? null,
        tags: sample.tags,
        favorite: sample.favorite ?? false,
        shared: sample.shared ?? false,
        textContent: sample.text,
      },
      now - sample.ageDays * DAY,
    );
    os.updatePaperPage(created.id, { updatedAt: now - sample.ageDays * DAY });
    ids.push(created.id);
  }

  return ids;
}
