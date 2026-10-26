"use client";

import type { ID, NoteBlock, PersonalOS } from "@personalos/core";
import { createBlock } from "@personalos/core";

interface SampleNote {
  title: string;
  body: string;
  folder: string;
  tags: string[];
  icon: string;
  blocks: NoteBlock[];
  pinned?: boolean;
}

const TIMELINE_TABLE: NoteBlock = {
  id: "timeline-table",
  type: "table",
  content: "",
  attrs: {
    columns: ["Phase", "Task", "Timeline", "Status"],
    rows: [
      ["Phase 1", "Foundation", "Completed", "Done"],
      ["Phase 2", "Authentication", "Oct 2026", "In Progress"],
      ["Phase 3", "Patient Dashboard", "Nov 2026", "Not Started"],
      ["Phase 4", "Other Modules", "Dec 2026", "Not Started"],
    ],
  },
};

const NEXTJS_PLAN: NoteBlock[] = [
  createBlock("heading", "1. Project Overview"),
  createBlock(
    "paragraph",
    "Build MedoriQ - a modern, scalable healthcare platform using Next.js 15, React 19, TypeScript and Tailwind CSS 4. The platform will support multiple user roles including patient, doctor, hospital, lab, pharmacy and delivery.",
  ),
  createBlock("heading", "2. Key Features (Phase 2)"),
  { ...createBlock("checkList", "Authentication system (register, login, OTP)"), attrs: { checked: true } },
  { ...createBlock("checkList", "Role-based dashboards"), attrs: { checked: true } },
  { ...createBlock("checkList", "User profile management"), attrs: { checked: false } },
  { ...createBlock("checkList", "Basic appointment booking flow"), attrs: { checked: false } },
  { ...createBlock("checkList", "Integrate with backend APIs"), attrs: { checked: false } },
  createBlock("heading", "3. Technology Stack"),
  createBlock("bulletList", "Next.js 15 (App Router)"),
  createBlock("bulletList", "React 19"),
  createBlock("bulletList", "TypeScript"),
  createBlock("bulletList", "Tailwind CSS 4"),
  createBlock("bulletList", "shadcn/ui"),
  createBlock("bulletList", "Vercel / Hostinger deployment"),
  createBlock("heading", "4. Timeline"),
  TIMELINE_TABLE,
];

const SAMPLE_NOTES: SampleNote[] = [
  {
    title: "Next.js Project Plan",
    body: "Outline the key features, tech stack and timeline for the MedoriQ platform. Focus on Phase 2 authentication and dashboards.",
    folder: "Projects",
    tags: ["work", "nextjs", "project"],
    icon: "🚀",
    pinned: true,
    blocks: NEXTJS_PLAN,
  },
  {
    title: "Meeting Notes - D365 Support",
    body: "Discussed runbook automation, SLA tracking and warehouse issue resolution with the support team.",
    folder: "Work",
    tags: ["meeting", "d365"],
    icon: "🗓️",
    blocks: [
      createBlock("heading", "Attendees"),
      createBlock("bulletList", "Support lead"),
      createBlock("bulletList", "Warehouse SME"),
      createBlock("heading", "Decisions"),
      { ...createBlock("checkList", "Automate the runbook steps"), attrs: { checked: true } },
      createBlock("checkList", "Track SLA breaches weekly"),
      createBlock("paragraph", "Follow up next Tuesday with the automation draft."),
    ],
  },
  {
    title: "Family Weekend Plan",
    body: "Plan for the upcoming family trip to Goa. Book flights, hotel and prepare itinerary.",
    folder: "Personal",
    tags: ["family", "travel"],
    icon: "✈️",
    blocks: [
      createBlock("heading", "Trip plan"),
      { ...createBlock("checkList", "Book flights"), attrs: { checked: true } },
      createBlock("checkList", "Reserve hotel near the beach"),
      createBlock("checkList", "Plan day trips"),
      createBlock("paragraph", "Keep one day completely free for the beach."),
    ],
  },
  {
    title: "Investment Ideas",
    body: "Research midcap and smallcap stocks. Review portfolio allocation and SIP strategy for the next quarter.",
    folder: "Finance",
    tags: ["finance", "investment"],
    icon: "💰",
    blocks: [
      createBlock("heading", "Watchlist"),
      createBlock("bulletList", "Midcap index fund"),
      createBlock("bulletList", "Smallcap basket (max 20%)"),
      createBlock("paragraph", "Rebalance once the equity share crosses 70%."),
    ],
  },
  {
    title: "Healthy Eating Guide",
    body: "Meal plan, recipes and nutrition tips for a healthy lifestyle.",
    folder: "Health",
    tags: ["health", "food"],
    icon: "🥗",
    blocks: [
      createBlock("heading", "Weekly plan"),
      createBlock("bulletList", "Monday - grilled chicken and greens"),
      createBlock("bulletList", "Tuesday - lentil soup and salad"),
      createBlock("bulletList", "Wednesday - paneer wraps"),
    ],
  },
  {
    title: "Book Summary - Atomic Habits",
    body: "Key takeaways from Atomic Habits by James Clear.",
    folder: "Learning",
    tags: ["learning"],
    icon: "📚",
    blocks: [
      createBlock("heading", "Key ideas"),
      createBlock("bulletList", "Make it obvious, attractive, easy and satisfying"),
      createBlock("bulletList", "Focus on systems rather than goals"),
      createBlock("blockquote", "You do not rise to the level of your goals. You fall to the level of your systems."),
    ],
  },
  {
    title: "Cricket Practice Plan",
    body: "Training schedule, drills and match preparation for the weekend game.",
    folder: "Personal",
    tags: ["cricket", "sports"],
    icon: "🏏",
    blocks: [
      createBlock("heading", "Drills"),
      { ...createBlock("checkList", "Batting - 50 balls"), attrs: { checked: true } },
      createBlock("checkList", "Bowling - 4 overs"),
      createBlock("checkList", "Fielding - catching practice"),
    ],
  },
  {
    title: "House Project Ideas",
    body: "Home improvement ideas, solar panel options and budget planning for the renovation.",
    folder: "Projects",
    tags: ["home", "projects"],
    icon: "🏠",
    blocks: [
      createBlock("heading", "Ideas"),
      createBlock("bulletList", "Solar panels on the terrace"),
      createBlock("bulletList", "Repaint the living room"),
      createBlock("bulletList", "Build a reading corner"),
      createBlock("paragraph", "Get three quotes before committing to a budget."),
    ],
  },
  {
    title: "Reading List 2026",
    body: "Books to read this year across fiction and professional development.",
    folder: "Learning",
    tags: ["learning", "reading"],
    icon: "🧠",
    blocks: [
      createBlock("heading", "Queue"),
      createBlock("orderedList", "Thinking in Systems"),
      createBlock("orderedList", "The Pragmatic Programmer"),
      createBlock("orderedList", "Deep Work"),
    ],
  },
  {
    title: "Quarterly Goals Scratchpad",
    body: "Draft the goals for the quarter and the habits that support them.",
    folder: "Ideas",
    tags: ["ideas", "goals"],
    icon: "🎯",
    blocks: [
      createBlock("heading", "Focus"),
      { ...createBlock("checkList", "Ship the notes workspace"), attrs: { checked: true } },
      createBlock("checkList", "Run a half marathon"),
      createBlock("checkList", "Publish two articles"),
    ],
  },
  {
    title: "Onboarding Checklist",
    body: "Steps to get a new engineer productive in the first two weeks.",
    folder: "Work",
    tags: ["work", "training"],
    icon: "🛠️",
    blocks: [
      createBlock("heading", "Week one"),
      { ...createBlock("checkList", "Set up the dev environment"), attrs: { checked: true } },
      createBlock("checkList", "Read the architecture docs"),
      createBlock("heading", "Week two"),
      createBlock("checkList", "Ship a small bug fix"),
    ],
  },
  {
    title: "Books Worth Revisiting",
    body: "Older notes kept for reference.",
    folder: "Learning",
    tags: ["learning"],
    icon: "📄",
    blocks: [createBlock("paragraph", "Archived reference material.")],
  },
];

const ARCHIVE_TITLES = new Set(["Books Worth Revisiting"]);

export function seedSampleNotes(os: PersonalOS): ID[] {
  const existing = Object.values(os.getState().folders);
  const folderIds = new Map<string, ID>();
  for (const folder of existing) folderIds.set(folder.name, folder.id);

  const wanted = [...new Set(SAMPLE_NOTES.map((note) => note.folder))];
  for (const name of wanted) {
    if (!folderIds.has(name)) {
      const folder = os.addFolder({ name });
      folderIds.set(name, folder.id);
    }
  }

  const ids: ID[] = [];
  for (const sample of SAMPLE_NOTES) {
    const note = os.addNote({
      title: sample.title,
      body: sample.body,
      blocks: sample.blocks,
      tags: sample.tags,
      icon: sample.icon,
      pinned: sample.pinned ?? false,
      folderId: folderIds.get(sample.folder) ?? null,
      source: "manual",
    });
    if (ARCHIVE_TITLES.has(sample.title)) os.archiveNote(note.id);
    ids.push(note.id);
  }

  return ids;
}