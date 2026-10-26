import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Habit, HabitCadence, HabitPriority } from "../../types/habit";
import { addDays, startOfDay, startOfWeek } from "../date-utils";
import { DAY_NAMES, cadenceDueOn, mondayIndex } from "../repeat/cadence";
import { habitSpec, habitStats } from "./habits";

export type HabitTab = "all" | "daily" | "weekly" | "monthly" | "custom";
export type HabitSort = "priority" | "streak" | "progress" | "name";
export type HabitFilter = "all" | "due" | "undone" | "done" | "archived";

export interface HabitWeekDay {
  dayStart: Timestamp;
  label: string;
  due: boolean;
  checked: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface HabitCardRow {
  id: ID;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  cadence: HabitCadence;
  priority: HabitPriority;
  currentStreak: number;
  bestStreak: number;
  progress: number;
  goalId: ID | null;
  dueToday: boolean;
  checkedToday: boolean;
  week: HabitWeekDay[];
}

export interface HabitStatsSummary {
  currentStreak: number;
  longestStreak: number;
  successRate: number;
  doneToday: number;
  dueToday: number;
  totalActive: number;
  totalCheckIns: number;
}

export interface HabitMonthPoint {
  key: string;
  label: string;
  day: number;
  rate: number;
  done: number;
  due: number;
}

export interface HabitCalendarDay {
  dayStart: Timestamp;
  date: number;
  inMonth: boolean;
  isToday: boolean;
  done: number;
  due: number;
  rate: number;
}

export interface HabitInsight {
  id: "streak" | "today" | "trend" | "strongest";
  tone: "success" | "accent" | "warning";
  text: string;
}

export interface HabitsDashboard {
  stats: HabitStatsSummary;
  successRate: number;
  cards: HabitCardRow[];
  totals: Record<HabitTab, number>;
  month: HabitMonthPoint[];
  calendar: HabitCalendarDay[];
  monthLabel: string;
  calendarLabel: string;
  insights: HabitInsight[];
}

export interface HabitsDashboardOptions {
  tab?: HabitTab;
  sort?: HabitSort;
  filter?: HabitFilter;
  monthAnchor?: Timestamp;
}

const PRIORITY_RANK: Record<HabitPriority, number> = { high: 0, medium: 1, low: 2 };

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function weekStartFor(state: AppState): 0 | 1 {
  const raw = (state.settings as unknown as { weekStart?: number }).weekStart;
  return raw === 0 ? 0 : 1;
}

function startOfMonth(time: Timestamp): Timestamp {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfMonth(time: Timestamp): Timestamp {
  const date = new Date(time);
  date.setMonth(date.getMonth() + 1, 0);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function shiftMonth(time: Timestamp, delta: number): Timestamp {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + delta);
  return date.getTime();
}

export function habitMonthLabel(time: Timestamp): string {
  const date = new Date(time);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function checkedDayMap(
  state: AppState,
  habitIds: Set<ID>,
  from: Timestamp,
  to: Timestamp,
): Map<ID, Set<Timestamp>> {
  const map = new Map<ID, Set<Timestamp>>();
  for (const id of habitIds) map.set(id, new Set<Timestamp>());
  for (const checkin of Object.values(state.habitCheckins)) {
    const days = map.get(checkin.habitId);
    if (!days) continue;
    const day = startOfDay(checkin.checkedAt);
    if (day >= from && day < to) days.add(day);
  }
  return map;
}

interface DayAggregate {
  dayStart: Timestamp;
  due: number;
  done: number;
  rate: number;
}

function aggregateDays(
  habits: Habit[],
  checked: Map<ID, Set<Timestamp>>,
  from: Timestamp,
  to: Timestamp,
): DayAggregate[] {
  const days: DayAggregate[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) {
    let due = 0;
    let done = 0;
    for (const habit of habits) {
      if (!cadenceDueOn(habitSpec(habit), day)) continue;
      due += 1;
      if (checked.get(habit.id)?.has(day)) done += 1;
    }
    days.push({ dayStart: day, due, done, rate: due > 0 ? Math.round((done / due) * 100) : 0 });
  }
  return days;
}

function rateFor(days: DayAggregate[]): number {
  let due = 0;
  let done = 0;
  for (const day of days) {
    due += day.due;
    done += day.done;
  }
  return due > 0 ? Math.round((done / due) * 100) : 0;
}

function habitTabMatches(cadence: HabitCadence, tab: HabitTab): boolean {
  if (tab === "all") return true;
  if (tab === "custom") return cadence === "custom";
  return cadence === tab;
}

function compareRows(a: HabitCardRow, b: HabitCardRow, sort: HabitSort): number {
  switch (sort) {
    case "streak":
      return b.currentStreak - a.currentStreak || a.title.localeCompare(b.title);
    case "progress":
      return b.progress - a.progress || a.title.localeCompare(b.title);
    case "name":
      return a.title.localeCompare(b.title);
    case "priority":
    default:
      return (
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.currentStreak - a.currentStreak ||
        a.title.localeCompare(b.title)
      );
  }
}

function dayStreakPhrase(count: number): string {
  return count === 1 ? "1-day streak" : `${count}-day streak`;
}

export function buildHabitsDashboard(
  state: AppState,
  now: Timestamp,
  options: HabitsDashboardOptions = {},
): HabitsDashboard {
  const tab = options.tab ?? "all";
  const sort = options.sort ?? "priority";
  const filter = options.filter ?? "all";
  const weekStart = weekStartFor(state);
  const today = startOfDay(now);
  const allHabits = Object.values(state.habits);
  const active = allHabits.filter((habit) => !habit.archived);
  const archived = allHabits.filter((habit) => habit.archived);

  const weekFrom = startOfWeek(now, weekStart);
  const weekTo = addDays(weekFrom, 7);
  const currentMonthStart = startOfMonth(now);
  const anchor = startOfMonth(options.monthAnchor ?? now);
  const calendarStart = startOfMonth(anchor);
  const calendarEnd = endOfMonth(anchor);

  const rangeFrom = Math.min(weekFrom, calendarStart, currentMonthStart);
  const rangeTo = Math.max(weekTo, calendarEnd + 1, endOfMonth(currentMonthStart) + 1);
  const checked = checkedDayMap(
    state,
    new Set(allHabits.map((habit) => habit.id)),
    rangeFrom,
    rangeTo,
  );

  const weekDays: Timestamp[] = [];
  for (let offset = 0; offset < 7; offset += 1) weekDays.push(addDays(weekFrom, offset));

  const toRows = (habits: Habit[]): HabitCardRow[] => habits.map((habit) => {
    const stats = habitStats(state, habit, now, weekStart, 28);
    const days = checked.get(habit.id) ?? new Set<Timestamp>();
    const spec = habitSpec(habit);
    return {
      id: habit.id,
      title: habit.title,
      description: habit.description,
      color: habit.color,
      icon: habit.icon,
      cadence: habit.cadence,
      priority: habit.priority,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      progress: stats.completionRate,
      goalId: habit.goalId,
      dueToday: cadenceDueOn(spec, today),
      checkedToday: days.has(today),
      week: weekDays.map((day) => ({
        dayStart: day,
        label: DAY_NAMES[mondayIndex(day)] ?? "",
        due: cadenceDueOn(spec, day),
        checked: days.has(day),
        isToday: day === today,
        isFuture: day > today,
      })),
    };
  });

  const activeRows = toRows(active);
  const rows = filter === "archived" ? toRows(archived) : activeRows;

  const cards = rows
    .filter((row) => habitTabMatches(row.cadence, tab))
    .filter((row) => {
      if (filter === "due") return row.dueToday;
      if (filter === "done") return row.dueToday && row.checkedToday;
      if (filter === "undone") return row.dueToday && !row.checkedToday;
      return true;
    })
    .sort((a, b) => compareRows(a, b, sort));

  const dueTodayRows = activeRows.filter((row) => row.dueToday);
  const dueToday = dueTodayRows.length;
  const doneToday = dueTodayRows.filter((row) => row.checkedToday).length;

  let metPeriods = 0;
  let duePeriods = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let totalCheckIns = 0;
  for (const habit of active) {
    const stats = habitStats(state, habit, now, weekStart, 28);
    metPeriods += stats.metPeriods;
    duePeriods += stats.duePeriods;
    totalCheckIns += stats.totalCheckIns;
    if (stats.currentStreak > currentStreak) currentStreak = stats.currentStreak;
    if (stats.bestStreak > longestStreak) longestStreak = stats.bestStreak;
  }
  const successRate = duePeriods > 0 ? Math.round((metPeriods / duePeriods) * 100) : 0;

  const monthDays = aggregateDays(
    active,
    checked,
    currentMonthStart,
    endOfMonth(currentMonthStart) + 1,
  );
  const month: HabitMonthPoint[] = monthDays
    .filter((day) => day.dayStart <= today)
    .map((day) => {
      const date = new Date(day.dayStart);
      return {
        key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        label: `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`,
        day: date.getDate(),
        rate: day.rate,
        done: day.done,
        due: day.due,
      };
    });

  const previousMonthStart = shiftMonth(currentMonthStart, -1);
  const previousRate = rateFor(
    aggregateDays(
      active,
      checked,
      Math.max(previousMonthStart, rangeFrom),
      currentMonthStart,
    ),
  );

  const gridFrom = startOfWeek(calendarStart, weekStart);
  const gridDays: HabitCalendarDay[] = [];
  for (let day = gridFrom; day <= calendarEnd; day = addDays(day, 1)) {
    const date = new Date(day);
    let due = 0;
    let done = 0;
    for (const habit of active) {
      if (!cadenceDueOn(habitSpec(habit), day)) continue;
      due += 1;
      if (checked.get(habit.id)?.has(day)) done += 1;
    }
    gridDays.push({
      dayStart: day,
      date: date.getDate(),
      inMonth: date.getMonth() === new Date(calendarStart).getMonth(),
      isToday: day === today,
      done,
      due,
      rate: due > 0 ? Math.round((done / due) * 100) : 0,
    });
  }

  const totals: Record<HabitTab, number> = {
    all: active.length,
    daily: active.filter((habit) => habit.cadence === "daily").length,
    weekly: active.filter((habit) => habit.cadence === "weekly").length,
    monthly: active.filter((habit) => habit.cadence === "monthly").length,
    custom: active.filter((habit) => habit.cadence === "custom").length,
  };

  const insights: HabitInsight[] = [];
  if (currentStreak > 0) {
    insights.push({
      id: "streak",
      tone: "success",
      text: `You're on a ${dayStreakPhrase(currentStreak)}! Keep it going.`,
    });
  }
  insights.push({
    id: "today",
    tone: dueToday > 0 && doneToday === dueToday ? "success" : "accent",
    text:
      dueToday > 0
        ? `You completed ${doneToday} of ${dueToday} habits today.`
        : "Nothing is scheduled for today - a great day to plan ahead.",
  });
  const trend = successRate - previousRate;
  if (active.length > 0 && trend !== 0) {
    insights.push({
      id: "trend",
      tone: trend > 0 ? "success" : "warning",
      text:
        trend > 0
          ? `Your consistency is up by ${trend}% this month.`
          : `Your consistency is down ${Math.abs(trend)}% versus last month.`,
    });
  } else if (active.length > 0) {
    const strongest = [...activeRows].sort((a, b) => b.progress - a.progress)[0]!;
    insights.push({
      id: "strongest",
      tone: "accent",
      text: `${strongest.title} is your strongest habit at ${strongest.progress}%.`,
    });
  }

  return {
    stats: {
      currentStreak,
      longestStreak,
      successRate,
      doneToday,
      dueToday,
      totalActive: active.length,
      totalCheckIns,
    },
    successRate,
    cards,
    totals,
    month,
    calendar: gridDays,
    monthLabel: habitMonthLabel(currentMonthStart),
    calendarLabel: habitMonthLabel(calendarStart),
    insights,
  };
}