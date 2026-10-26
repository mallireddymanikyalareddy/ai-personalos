"use client";

import type { PersonalOS, TemplateCategory, TemplateItem, TemplateKind } from "@personalos/core";

const DAY = 86_400_000;
const HOUR = 3_600_000;

interface CustomSeed {
  name: string;
  description: string;
  category: TemplateCategory;
  templateKind: TemplateKind;
  items: TemplateItem[];
}

function task(title: string, priority: TemplateItem["priority"] = 2, group = ""): TemplateItem {
  return {
    kind: "task",
    title,
    detail: "",
    cadence: null,
    tags: [],
    priority,
    sections: [],
    group,
  };
}

function note(title: string, sections: string[]): TemplateItem {
  return {
    kind: "note",
    title,
    detail: "",
    cadence: null,
    tags: [],
    priority: 2,
    sections,
    group: "",
  };
}

function habit(title: string, cadence: TemplateItem["cadence"] = "daily"): TemplateItem {
  return {
    kind: "habit",
    title,
    detail: "",
    cadence,
    tags: [],
    priority: 2,
    sections: [],
    group: "",
  };
}

const CUSTOM_TEMPLATES: CustomSeed[] = [
  {
    name: "Client check-in",
    description: "Prepare, run and close a client check-in.",
    category: "work",
    templateKind: "summary",
    items: [
      note("Client check-in", ["Agenda", "What changed since last time", "Open risks", "Commitments"]),
      task("Send the agenda a day before", 3),
      task("Write the recap the same day", 2),
    ],
  },
  {
    name: "Weekly status report",
    description: "A status report people actually read.",
    category: "work",
    templateKind: "summary",
    items: [
      note("Weekly status report", ["Shipped", "In flight", "Blocked", "Next week", "Asks"]),
      task("Collect the numbers", 3),
    ],
  },
  {
    name: "Sprint notes",
    description: "Capture the sprint as it happens.",
    category: "work",
    templateKind: "log",
    items: [
      note("Sprint notes", ["Shipped", "Carried over", "Impediments", "Decisions"]),
      task("Update the board before the review", 2),
    ],
  },
  {
    name: "Expense approval",
    description: "Submit and track an expense for approval.",
    category: "work",
    templateKind: "checklist",
    items: [
      task("Attach the receipt", 3),
      task("Write the business reason", 2),
      task("Chase the approval if it stalls", 1),
    ],
  },
  {
    name: "Trip packing list",
    description: "Pack once, forget nothing.",
    category: "personal",
    templateKind: "checklist",
    items: [
      note("Packing list", ["Clothes", "Tech", "Documents", "Toiletries", "Extras"]),
      task("Pack the day before", 3),
    ],
  },
  {
    name: "Meal planning",
    description: "Plan the week of meals in one sitting.",
    category: "personal",
    templateKind: "planner",
    items: [
      task("Pick three dinners", 3),
      task("Write the shopping list", 2),
      habit("Cook at home four times a week", "weekly"),
    ],
  },
  {
    name: "Gift ideas",
    description: "Keep every gift idea in one place.",
    category: "personal",
    templateKind: "checklist",
    items: [note("Gift ideas", ["For them", "For us", "Occasions", "Budget"])],
  },
  {
    name: "Home renovation",
    description: "Plan a renovation without losing the thread.",
    category: "projects",
    templateKind: "plan",
    items: [
      note("Renovation plan", ["Budget", "Contractors", "Materials", "Timeline", "Risks"]),
      task("Confirm the quotes", 4),
      task("Book the first slot", 3),
    ],
  },
  {
    name: "Website relaunch",
    description: "Take a website from brief to launch.",
    category: "projects",
    templateKind: "tracker",
    items: [
      note("Relaunch", ["Scope", "Pages", "Owners", "Launch date", "Checklist"]),
      task("Lock the scope", 4),
      task("Set the launch date", 3),
    ],
  },
  {
    name: "Quarterly planning",
    description: "Decide the three things that matter this quarter.",
    category: "planning",
    templateKind: "planner",
    items: [
      note("Quarter plan", ["Outcomes", "What to stop", "Milestones", "Review date"]),
      task("Set the three outcomes", 4),
      task("Cancel the work that no longer matters", 3),
    ],
  },
  {
    name: "Personal OKRs",
    description: "Objectives and key results for your own life.",
    category: "planning",
    templateKind: "plan",
    items: [
      note("Personal OKRs", ["Objective", "Key results", "Why it matters", "Check-ins"]),
      task("Write one honest objective", 4),
    ],
  },
  {
    name: "Yearly review",
    description: "Look back on the year before you plan the next one.",
    category: "planning",
    templateKind: "summary",
    items: [
      note("Year in review", ["What worked", "What did not", "What I learned", "What is next"]),
      task("Collect the photos and notes", 3),
    ],
  },
];

const USAGE_HISTORY = [
  { name: "Weekly Plan", at: 2 * HOUR },
  { name: "Meeting Notes", at: 1 * DAY },
  { name: "Project Tracker", at: 2 * DAY },
  { name: "Expense Tracker", at: 3 * DAY },
];

export function seedTemplateDefaults(os: PersonalOS, now: number = Date.now()): number {
  let created = 0;

  os.seedTemplateCatalog(now);

  const existing = new Set(os.templates().map((template) => template.name));
  for (const seed of CUSTOM_TEMPLATES) {
    if (existing.has(seed.name)) continue;
    os.addTemplate(
      {
        name: seed.name,
        target: "task",
        title: seed.name,
        body: seed.description,
        description: seed.description,
        category: seed.category,
        templateKind: seed.templateKind,
        icon: "sparkles",
        builtin: false,
        source: "custom",
        tags: [seed.category, seed.templateKind],
        items: seed.items,
      },
      now,
    );
    created += 1;
  }

  for (const entry of USAGE_HISTORY) {
    const template = os.templates().find((item) => item.name === entry.name);
    if (!template || template.lastUsedAt != null) continue;
    os.updateTemplate(template.id, {
      lastUsedAt: now - entry.at,
      useCount: Math.max(1, template.useCount),
    });
  }

  return created;
}
