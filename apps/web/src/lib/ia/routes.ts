import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Feather,
  FileText,
  Gift,
  Inbox,
  LayoutTemplate,
  ListChecks,
  Menu,
  Notebook,
  Palette,
  PenLine,
  Puzzle,
  Repeat,
  Settings,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";

export type NavTier = "primary" | "more" | "none";
export type MoreGroup = "Execute" | "Remember" | "Create" | "System";

export interface AreaPlaceholder {
  title: string;
  description: string;
  stage: string;
  bullets: string[];
  untilThen: string;
}

export interface AreaRoute {
  key: string;
  slug: string;
  label: string;
  tier: NavTier;
  moreGroup?: MoreGroup;
  icon: LucideIcon;
  keywords: string;
  badge?: "today" | "inbox";
  status: "live" | "placeholder";
  placeholder?: AreaPlaceholder;
  permissions: string[];
}

export const AREAS: Record<string, AreaRoute> = {
  today: {
    key: "today",
    slug: "/today",
    label: "Today",
    tier: "primary",
    icon: CalendarCheck,
    keywords: "today, day, my day, dashboard, home, plan my day",
    badge: "today",
    status: "live",
    permissions: ["view", "manage"],
  },
  calendar: {
    key: "calendar",
    slug: "/calendar",
    label: "Calendar",
    tier: "primary",
    icon: CalendarDays,
    keywords: "calendar, agenda, schedule, events, timetable, when",
    status: "live",
    permissions: ["view", "manage"],
  },
  tasks: {
    key: "tasks",
    slug: "/tasks",
    label: "Tasks",
    tier: "primary",
    icon: ListChecks,
    keywords: "tasks, to do, todo, todos, list, work items, due",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  goals: {
    key: "goals",
    slug: "/goals",
    label: "Goals",
    tier: "primary",
    icon: Target,
    keywords: "goals, outcomes, objectives, targets, horizons, life goals",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  habits: {
    key: "habits",
    slug: "/habits",
    label: "Habits",
    tier: "primary",
    icon: Repeat,
    keywords: "habits, routines, streaks, consistency, check in, daily",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  notes: {
    key: "notes",
    slug: "/notes",
    label: "Notes",
    tier: "primary",
    icon: FileText,
    keywords: "notes, ideas, knowledge, references, quick notes, capture note",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  ai: {
    key: "ai",
    slug: "/ai",
    label: "AI",
    tier: "primary",
    icon: Sparkles,
    keywords: "ai, assistant, suggestions, plans, summaries, drafts, model, chat",
    status: "live",
    permissions: ["view", "ai.generate", "ai.adopt"],
  },
  inbox: {
    key: "inbox",
    slug: "/inbox",
    label: "Inbox",
    tier: "none",
    moreGroup: "System",
    badge: "inbox",
    icon: Inbox,
    keywords: "inbox, capture, queue, triage, unprocessed, backlog",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  focus: {
    key: "focus",
    slug: "/focus",
    label: "Focus",
    tier: "more",
    moreGroup: "Execute",
    icon: Timer,
    keywords: "focus, timer, pomodoro, deep work, sessions, concentration, do not disturb, stopwatch, countdown, interval, white noise",
    status: "live",
    permissions: ["view", "manage"],
  },
  workmode: {
    key: "workmode",
    slug: "/workmode",
    label: "Work Mode",
    tier: "more",
    moreGroup: "Execute",
    icon: Briefcase,
    keywords: "work mode, collaboration, team, shifts, time off, approvals, shared tasks, projects, employees, scheduling",
    status: "live",
    permissions: ["view", "manage"],
  },  meetings: {
    key: "meetings",
    slug: "/meetings",    label: "Meetings",
    tier: "more",
    moreGroup: "Execute",
    icon: Users,
    keywords: "meetings, transcripts, recording, notes, action items, decisions, speakers, voice, capture, summary",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  memory: {
    key: "memory",
    slug: "/memory",
    label: "Life Memory",
    tier: "more",
    moreGroup: "Remember",
    icon: Brain,
    keywords: "memory, life memory, timeline, moments, archive, people, places, history, photos, when did i, servicing",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  journal: {
    key: "journal",
    slug: "/journal",
    label: "Journal",
    tier: "more",
    moreGroup: "Remember",
    icon: Feather,
    keywords: "journal, diary, daily notes, reflection, writing, mood, gratitude, highlights, gratitude, tomorrow",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  planner: {
    key: "planner",
    slug: "/planner",
    label: "Planner",
    tier: "more",
    moreGroup: "Execute",
    icon: CalendarRange,
    keywords: "planner, time blocking, week, plan, schedule, rituals, roadmap, blocks",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  insights: {
    key: "insights",
    slug: "/insights",
    label: "Insights",
    tier: "more",
    moreGroup: "Execute",
    icon: TrendingUp,
    keywords: "insights, analytics, stats, trends, review, reports, patterns, energy, productivity, today summary, weekly review",
    status: "live",
    permissions: ["view"],
  },
  work: {
    key: "work",
    slug: "/work",
    label: "Work",
    tier: "more",
    moreGroup: "Execute",
    icon: Briefcase,
    keywords: "work, projects, areas, contexts, clients, company, responsibilities",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  paper: {
    key: "paper",
    slug: "/paper",
    label: "Digital Paper",
    tier: "more",
    moreGroup: "Create",
    icon: PenLine,
    keywords: "paper, notebook, handwriting, pen, pencil, highlighter, shapes, stickers, canvas, sketch, infinite canvas, pdf, draw",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  notebook: {
    key: "notebook",
    slug: "/notebook",
    label: "Digital Notebook",
    tier: "more",
    moreGroup: "Create",
    icon: Notebook,
keywords: "notebook, pages, long form, writing, essays, compilations, blocks",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  templates: {
    key: "templates",
    slug: "/templates",
    label: "Templates",
    tier: "more",
    moreGroup: "Create",
    icon: LayoutTemplate,
    keywords: "templates, blueprints, starter, repeatable, save as template, daily planner, weekly plan, okr, budget",
    status: "live",
    permissions: ["view", "manage", "delete"],
  },
  rewards: {
    key: "rewards",
    slug: "/rewards",
    label: "Rewards",
    tier: "more",
    moreGroup: "Create",
    icon: Gift,
    keywords: "rewards, gamification, xp, levels, skills, coins, achievements, reward shop, streaks, gems, milestones, celebration",
    status: "live",
    permissions: ["view", "manage"],
  },
  integrations: {
    key: "integrations",
    slug: "/integrations",
    label: "Integrations",
    tier: "more",
    moreGroup: "System",
    icon: Puzzle,
    keywords: "integrations, connections, sync, calendar, providers, import, export",
    status: "live",
    permissions: ["integrations.connect", "view", "delete"],
  },
  settings: {
    key: "settings",
    slug: "/settings",
    label: "Settings",
    tier: "more",
    moreGroup: "System",
    icon: Settings,
    keywords: "settings, preferences, appearance, theme, data, backup, shortcuts, profile, about",
    status: "live",
    permissions: ["settings.system", "data.import", "data.export", "data.clear"],
  },
  styleguide: {
    key: "styleguide",
    slug: "/styleguide",
    label: "Design system",
    tier: "none",
    icon: Palette,
    keywords: "styleguide, design system, components, tokens, spec",
    status: "live",
    permissions: ["view"],
  },
};

export const PRIMARY_KEYS = ["today", "calendar", "tasks", "goals", "habits", "notes", "ai"] as const;
export const MORE_KEYS = [
  "inbox",
  "focus",
  "meetings",
  "workmode",
  "memory",
  "journal",
  "planner",
  "insights",
  "work",
  "paper",
  "notebook",
  "templates",
  "rewards",
  "integrations",
  "settings",
] as const;

export const MORE_GROUPS: MoreGroup[] = ["Execute", "Remember", "Create", "System"];

export const PRIMARY_AREAS: AreaRoute[] = PRIMARY_KEYS.map((key) => AREAS[key]);
export const MORE_AREAS: AreaRoute[] = MORE_KEYS.map((key) => AREAS[key]);
export const SYSTEM_AREAS: AreaRoute[] = [AREAS.styleguide];
export const ALL_AREAS: AreaRoute[] = [...PRIMARY_AREAS, ...MORE_AREAS, ...SYSTEM_AREAS];

export function moreGroups(): { group: MoreGroup; areas: AreaRoute[] }[] {
  return MORE_GROUPS.map((group) => ({
    group,
    areas: MORE_AREAS.filter((area) => area.moreGroup === group),
  })).filter((section) => section.areas.length > 0);
}

export function slugLabel(href: string): string {
  const exact = ALL_AREAS.find((area) => area.slug === href);
  if (exact) return exact.label;
  const segment = `/${href.split("/")[1] ?? ""}`;
  const bySegment = ALL_AREAS.find((area) => area.slug === segment);
  return bySegment?.label ?? "";
}

export function areaIcon(href: string): LucideIcon | undefined {
  const exact = ALL_AREAS.find((area) => area.slug === href);
  if (exact) return exact.icon;
  return AREAS.more.icon;
}

export const MORE_MENU_ICON = Menu;