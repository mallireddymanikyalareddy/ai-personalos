"use client";

import type { ID, PersonalOS } from "@personalos/core";

const DAY = 86_400_000;
const HOUR = 3_600_000;

interface SeedCalendar {
  name: string;
  color: string;
}

const SEED_CALENDARS: SeedCalendar[] = [
  { name: "Work", color: "var(--chart-5)" },
  { name: "Personal", color: "var(--chart-4)" },
  { name: "Health & Fitness", color: "var(--chart-6)" },
  { name: "Family", color: "var(--chart-3)" },
  { name: "Goals & Planning", color: "var(--chart-7)" },
];

interface SeedEvent {
  title: string;
  calendar: string;
  day: number;
  hour: number;
  minutes: number;
  location?: string;
  color?: string;
  allDay?: boolean;
}

const SEED_EVENTS: SeedEvent[] = [
  { title: "Project Sprint", calendar: "Work", day: 0, hour: 9, minutes: 60, color: "blue" },
  { title: "Client Review", calendar: "Work", day: 2, hour: 9, minutes: 60, color: "violet" },
  { title: "D365 Release", calendar: "Work", day: 3, hour: 9, minutes: 60, color: "green" },
  { title: "Cricket Match", calendar: "Personal", day: 5, hour: 10, minutes: 120, color: "amber" },
  { title: "Family Day", calendar: "Family", day: 6, hour: 10, minutes: 120, color: "rose" },

  { title: "Morning Routine", calendar: "Health & Fitness", day: 0, hour: 7, minutes: 30, color: "green" },
  { title: "Morning Routine", calendar: "Health & Fitness", day: 3, hour: 7, minutes: 30, color: "green" },
  { title: "Team Standup", calendar: "Work", day: 0, hour: 9, minutes: 30, color: "blue" },
  { title: "D365 F&O Issue Review", calendar: "Work", day: 2, hour: 9, minutes: 30, color: "blue" },
  { title: "Daily Standup", calendar: "Work", day: 3, hour: 9, minutes: 30, color: "blue" },
  { title: "Project Review", calendar: "Work", day: 4, hour: 10, minutes: 60, color: "amber" },
  { title: "Client Call - ACME", calendar: "Work", day: 1, hour: 10, minutes: 60, color: "amber" },
  { title: "D365 Support Review", calendar: "Work", day: 0, hour: 11, minutes: 60, color: "violet" },
  { title: "D365 Release Readiness", calendar: "Work", day: 3, hour: 11, minutes: 60, color: "rose" },
  { title: "Family Time", calendar: "Family", day: 6, hour: 10, minutes: 120, color: "rose" },
  { title: "Product Discussion", calendar: "Work", day: 1, hour: 13, minutes: 60, color: "violet" },
  { title: "Team Lunch", calendar: "Work", day: 2, hour: 12, minutes: 60, color: "green" },
  { title: "Stakeholder Update", calendar: "Work", day: 4, hour: 13, minutes: 60, color: "blue" },
  { title: "Sprint Planning", calendar: "Work", day: 4, hour: 14, minutes: 60, color: "violet" },
  { title: "Cross-Functional Sync", calendar: "Work", day: 3, hour: 14, minutes: 60, color: "blue" },
  { title: "Support Automation", calendar: "Work", day: 2, hour: 15, minutes: 60, color: "violet" },
  { title: "Review & Documentation", calendar: "Work", day: 1, hour: 16, minutes: 60, color: "blue" },
  { title: "Wrap Up & Plan", calendar: "Goals & Planning", day: 3, hour: 17, minutes: 60, color: "green" },
  { title: "Gym", calendar: "Health & Fitness", day: 1, hour: 18, minutes: 60, color: "green" },
  { title: "Reading", calendar: "Personal", day: 2, hour: 19, minutes: 60, color: "rose" },
  { title: "Cricket Practice", calendar: "Health & Fitness", day: 5, hour: 16, minutes: 120, color: "green" },
  { title: "Weekly Planning", calendar: "Goals & Planning", day: 6, hour: 18, minutes: 60, color: "violet" },
];

function startOfWeek(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.getTime();
}

export function seedSampleCalendar(os: PersonalOS, now: number = Date.now()): ID[] {
  const ids: ID[] = [];
  const weekStart = startOfWeek(now);

  const calendarIds = new Map<string, ID>();
  for (const seed of SEED_CALENDARS) {
    const existing = os.calendars().find((calendar) => calendar.name === seed.name);
    if (existing != null) {
      calendarIds.set(seed.name, existing.id);
      continue;
    }
    const calendar = os.addCalendar(
      { name: seed.name, color: seed.color, provider: "local" },
      now - 60 * DAY,
    );
    calendarIds.set(seed.name, calendar.id);
  }

  const titles = new Set(Object.values(os.getState().events).map((event) => event.title));
  for (const seed of SEED_EVENTS) {
    if (titles.has(seed.title)) continue;
    const startsAt = weekStart + seed.day * DAY + seed.hour * HOUR;
    const event = os.addEvent(
      {
        title: seed.title,
        startsAt,
        endsAt: startsAt + seed.minutes * 60_000,
        allDay: seed.allDay ?? false,
        location: seed.location ?? "",
        calendarId: calendarIds.get(seed.calendar) ?? null,
        color: seed.color ?? "accent",
        source: "manual",
      },
      now - 5 * DAY,
    );
    ids.push(event.id);
  }

  const taskTitles = new Set(Object.values(os.getState().tasks).map((task) => task.title));
  const seedTasks = [
    "Send the pricing sheet",
    "Review the D365 runbook",
    "Prep the sprint board",
    "Book the review call",
    "Update the knowledge base",
  ];
  for (const [index, title] of seedTasks.entries()) {
    if (taskTitles.has(title)) continue;
    const dueAt = weekStart + (index % 5) * DAY + 16 * HOUR;
    os.addTask({ title, dueAt, tags: ["work"] }, now - 2 * DAY);
  }

  if (os.focusSessions().length === 0) {
    for (let day = 0; day < 6; day += 1) {
      const minutes = day === 0 ? 150 : 60 + (day % 3) * 45;
      const startedAt = weekStart + day * DAY + 9 * HOUR;
      const session = os.startFocusSession(
        { startedAt, plannedMin: minutes, mode: "countdown" },
        startedAt,
      );
      os.completeFocusSession(session.id, {}, startedAt + minutes * 60_000);
    }
  }

  return ids;
}
