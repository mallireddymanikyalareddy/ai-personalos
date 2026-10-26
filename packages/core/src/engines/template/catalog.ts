import type { TemplateCategory, TemplateItem, TemplateKind } from "../../types/planning";

export interface BuiltinTemplateSeed {
  key: string;
  name: string;
  description: string;
  category: TemplateCategory;
  templateKind: TemplateKind;
  icon: string;
  popularity: number;
  featured: boolean;
  popular: boolean;
  items: TemplateItem[];
}

function task(
  title: string,
  options: Partial<Omit<TemplateItem, "kind" | "title">> = {},
): TemplateItem {
  return { kind: "task", title, detail: "", cadence: null, tags: [], priority: 2, sections: [], group: "", ...options };
}

function habit(
  title: string,
  options: Partial<Omit<TemplateItem, "kind" | "title">> = {},
): TemplateItem {
  return {
    kind: "habit",
    title,
    detail: "",
    cadence: "daily",
    tags: [],
    priority: 2,
    sections: [],
    group: "",
    ...options,
  };
}

function goal(
  title: string,
  options: Partial<Omit<TemplateItem, "kind" | "title">> = {},
): TemplateItem {
  return { kind: "goal", title, detail: "", cadence: null, tags: [], priority: 2, sections: [], group: "", ...options };
}

function project(
  title: string,
  options: Partial<Omit<TemplateItem, "kind" | "title">> = {},
): TemplateItem {
  return { kind: "project", title, detail: "", cadence: null, tags: [], priority: 2, sections: [], group: "", ...options };
}

function note(title: string, sections: string[], options: Partial<Omit<TemplateItem, "kind" | "title">> = {}): TemplateItem {
  return { kind: "note", title, detail: "", cadence: null, tags: [], priority: 2, sections, group: "", ...options };
}

function routine(
  title: string,
  options: Partial<Omit<TemplateItem, "kind" | "title">> = {},
): TemplateItem {
  return { kind: "routine", title, detail: "", cadence: "daily", tags: [], priority: 2, sections: [], group: "", ...options };
}

export const BUILTIN_TEMPLATES: BuiltinTemplateSeed[] = [
  {
    key: "life_planner",
    name: "Life Planner",
    description: "A complete template to plan your goals, tasks, habits and priorities.",
    category: "planning",
    templateKind: "planner",
    icon: "sparkles",
    popularity: 18400,
    featured: true,
    popular: false,
    items: [
      goal("Plan the year", { detail: "The one outcome that makes the year worth it.", group: "life" }),
      task("Write the three outcomes that matter", { group: "life" }),
      task("Block the first hour of every workday", { priority: 3, group: "life" }),
      habit("Morning review", { detail: "Ten minutes before the day starts." }),
      habit("Evening shutdown", { detail: "Close the loops so tomorrow is lighter." }),
      routine("Weekly reset", { detail: "Look back, then plan the week ahead." }),
      note("Life plan", ["What matters this year", "What I am saying no to", "Habits that keep me steady"]),
    ],
  },
  {
    key: "daily_planner",
    name: "Daily Planner",
    description: "Plan your day, set priorities and stay focused.",
    category: "planning",
    templateKind: "planner",
    icon: "calendar",
    popularity: 9200,
    featured: false,
    popular: true,
    items: [
      task("Choose the three outcomes for today", { priority: 4 }),
      task("Protect one focus block", { priority: 3 }),
      task("Review the inbox and clear it", { priority: 1 }),
      habit("Plan tomorrow before you stop", { cadence: "daily" }),
    ],
  },
  {
    key: "weekly_plan",
    name: "Weekly Plan",
    description: "Organize your week and track key goals.",
    category: "planning",
    templateKind: "planner",
    icon: "calendar-days",
    popularity: 11800,
    featured: false,
    popular: true,
    items: [
      task("Set the three outcomes for the week", { priority: 4 }),
      task("Review last week and carry the leftovers forward", { priority: 2 }),
      task("Book the review meeting", { priority: 2 }),
      routine("Weekly review", { cadence: "weekly" }),
    ],
  },
  {
    key: "meeting_notes",
    name: "Meeting Notes",
    description: "Capture decisions, action items and follow-ups.",
    category: "work",
    templateKind: "summary",
    icon: "users",
    popularity: 14600,
    featured: false,
    popular: true,
    items: [
      note("Meeting notes", ["Attendees", "Agenda", "Decisions", "Action items", "Next steps"]),
      task("Send the meeting recap", { priority: 2 }),
    ],
  },
  {
    key: "project_tracker",
    name: "Project Tracker",
    description: "Plan tasks, track progress and manage deadlines.",
    category: "projects",
    templateKind: "tracker",
    icon: "layers",
    popularity: 12400,
    featured: true,
    popular: true,
    items: [
      project("New project", { detail: "What is being delivered and for whom.", group: "project" }),
      task("Define the scope", { priority: 4, group: "project" }),
      task("Set the milestones", { priority: 3, group: "project" }),
      task("Schedule the weekly status review", { priority: 2, group: "project" }),
      note("Project brief", ["Goal", "Scope", "Owners", "Deadlines", "Risks"]),
    ],
  },
  {
    key: "habit_tracker",
    name: "Habit Tracker",
    description: "Build and track your daily habits.",
    category: "health",
    templateKind: "tracker",
    icon: "flame",
    popularity: 10800,
    featured: false,
    popular: true,
    items: [
      habit("Move for 30 minutes"),
      habit("Read 20 pages"),
      habit("Drink water through the day"),
      habit("No screens after 10pm", { cadence: "daily" }),
    ],
  },
  {
    key: "goal_planner",
    name: "Goal Planner",
    description: "Define, plan and track your life goals.",
    category: "planning",
    templateKind: "tracker",
    icon: "target",
    popularity: 8600,
    featured: false,
    popular: true,
    items: [
      goal("New goal", { detail: "The outcome, not the activity." }),
      task("Break the goal into three milestones", { priority: 3, group: "goal" }),
      task("Set the first review date", { priority: 2, group: "goal" }),
      task("Name the first smallest step", { priority: 3, group: "goal" }),
    ],
  },
  {
    key: "work_summary",
    name: "Work Summary",
    description: "Daily/weekly work summary and key updates.",
    category: "work",
    templateKind: "summary",
    icon: "laptop",
    popularity: 12400,
    featured: false,
    popular: false,
    items: [
      note("Work summary", ["Highlights", "Lowlights", "Blockers", "Next week"]),
      task("Send the weekly summary", { priority: 2 }),
    ],
  },
  {
    key: "sprint_plan",
    name: "Sprint Plan",
    description: "Plan sprints, track tasks and deliverables.",
    category: "projects",
    templateKind: "plan",
    icon: "rocket",
    popularity: 8900,
    featured: false,
    popular: false,
    items: [
      project("Sprint", { detail: "Two-week cycle with a clear finish line.", group: "sprint" }),
      task("Run sprint planning", { priority: 4, group: "sprint" }),
      task("Map stories to the sprint goal", { priority: 3, group: "sprint" }),
      task("Book the sprint review and retro", { priority: 2, group: "sprint" }),
    ],
  },
  {
    key: "okr_template",
    name: "OKR Template",
    description: "Set and track Objectives and Key Results.",
    category: "planning",
    templateKind: "plan",
    icon: "crosshair",
    popularity: 7600,
    featured: false,
    popular: false,
    items: [
      goal("Quarterly objective", { detail: "One sentence, qualitative, inspiring." }),
      task("Write three measurable key results", { priority: 4, group: "okr" }),
      task("Map the initiatives that move each key result", { priority: 3, group: "okr" }),
      task("Set the fortnightly check-in", { priority: 2, group: "okr" }),
    ],
  },
  {
    key: "knowledge_base",
    name: "Knowledge Base",
    description: "Structured notes, SOPs and reference material.",
    category: "work",
    templateKind: "planner",
    icon: "book-open",
    popularity: 6800,
    featured: false,
    popular: false,
    items: [
      note("Knowledge base", ["Index", "How to use this", "Playbooks", "People to ask"]),
      task("Link the ten notes that matter most", { priority: 2 }),
    ],
  },
  {
    key: "expense_tracker",
    name: "Expense Tracker",
    description: "Track your income, expenses and savings.",
    category: "finance",
    templateKind: "tracker",
    icon: "receipt",
    popularity: 9700,
    featured: false,
    popular: false,
    items: [
      habit("Log every expense the same day"),
      task("Reconcile the card", { priority: 3 }),
      task("Review the spending categories", { priority: 2 }),
      note("Expense log", ["Week of", "Income", "Fixed costs", "Variable costs", "Saved"]),
    ],
  },
  {
    key: "budget_planner",
    name: "Budget Planner",
    description: "Plan monthly budget and financial goals.",
    category: "finance",
    templateKind: "budget",
    icon: "wallet",
    popularity: 8300,
    featured: false,
    popular: false,
    items: [
      task("Set the limit for each category", { priority: 4 }),
      task("Compare the plan with last month", { priority: 2 }),
      task("Choose what to cut or fund", { priority: 3 }),
      note("Budget", ["Income", "Needs", "Wants", "Savings", "Buffer"]),
    ],
  },
  {
    key: "meal_plan",
    name: "Meal Plan",
    description: "Plan your meals and nutrition for the week.",
    category: "health",
    templateKind: "planner",
    icon: "utensils",
    popularity: 5900,
    featured: false,
    popular: false,
    items: [
      task("Plan three dinners", { priority: 3 }),
      task("Write the grocery list", { priority: 2 }),
      task("Cook one big batch on Sunday", { priority: 2 }),
      habit("Cook at home four times a week", { cadence: "weekly" }),
    ],
  },
  {
    key: "workout_plan",
    name: "Workout Plan",
    description: "Plan workouts, track progress and fitness goals.",
    category: "health",
    templateKind: "plan",
    icon: "dumbbell",
    popularity: 6100,
    featured: false,
    popular: false,
    items: [
      task("Three strength sessions", { priority: 3, tags: ["fitness"] }),
      task("Two cardio sessions", { priority: 2, tags: ["fitness"] }),
      task("One mobility and stretch session", { priority: 1, tags: ["fitness"] }),
      habit("Move for 30 minutes", { cadence: "weekly" }),
    ],
  },
  {
    key: "reading_tracker",
    name: "Reading Tracker",
    description: "Track books, reading time and learnings.",
    category: "learning",
    templateKind: "tracker",
    icon: "book",
    popularity: 4800,
    featured: false,
    popular: false,
    items: [
      habit("Read 20 pages"),
      task("Pick the next book", { priority: 2 }),
      task("Write a three-line summary", { priority: 2 }),
      note("Reading log", ["Book", "Why I picked it", "Three lines", "What I will try"]),
    ],
  },
  {
    key: "travel_planner",
    name: "Travel Planner",
    description: "Plan trips, itinerary, budget and checklist.",
    category: "personal",
    templateKind: "planner",
    icon: "plane",
    popularity: 5600,
    featured: false,
    popular: false,
    items: [
      task("Book the tickets", { priority: 4 }),
      task("Write the itinerary", { priority: 3 }),
      task("Pack the bag", { priority: 2 }),
      note("Trip plan", ["Flights", "Stays", "Activities", "Budget", "Packing list"]),
    ],
  },
  {
    key: "study_plan",
    name: "Study Plan",
    description: "Train study schedule, topics and revision.",
    category: "learning",
    templateKind: "plan",
    icon: "graduation-cap",
    popularity: 4300,
    featured: false,
    popular: false,
    items: [
      goal("Study goal", { detail: "What you can do at the end of the course." }),
      task("Set the syllabus and split it into topics", { priority: 4, group: "study" }),
      task("Schedule four study blocks", { priority: 3, group: "study" }),
      task("Run one past paper", { priority: 2, group: "study" }),
    ],
  },
  {
    key: "journal_template",
    name: "Journal Template",
    description: "Reflect, write and track your thoughts.",
    category: "personal",
    templateKind: "log",
    icon: "feather",
    popularity: 7000,
    featured: false,
    popular: false,
    items: [
      note("Journal", ["What went well", "What to improve", "One thing to remember"]),
      habit("Evening journal", { detail: "Three lines, no editing." }),
    ],
  },
];

export function builtinTemplateByKey(key: string): BuiltinTemplateSeed | null {
  return BUILTIN_TEMPLATES.find((template) => template.key === key) ?? null;
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  work: "Work",
  personal: "Personal",
  planning: "Planning",
  finance: "Finance",
  health: "Health",
  learning: "Learning",
  productivity: "Productivity",
  projects: "Projects",
};

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  planner: "Planner",
  tracker: "Tracker",
  summary: "Summary",
  brief: "Brief",
  log: "Log",
  plan: "Plan",
  budget: "Budget",
  checklist: "Checklist",
};
