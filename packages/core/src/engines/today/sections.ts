import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Priority } from "../../types/common";
import { addDays, isSameDay, startOfDay } from "../date-utils";
import { selectFocusSessions } from "../focus/stats";
import { buildGamificationProfile } from "../gamification/engine";
import { activeRoutines, resolveRoutineItems, routineDueOn } from "../routine/routines";
import { projectStats } from "../work/progress";

const DAY = 86_400_000;

function clockLabel(at: Timestamp): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

function relativeLabel(at: Timestamp, now: Timestamp): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export interface TodayMeetingRow {
  id: ID;
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp | null;
  timeLabel: string;
  location: string;
  hasSummary: boolean;
  hasTranscript: boolean;
  done: boolean;
}

export function buildTodayMeetings(state: AppState, now: Timestamp): TodayMeetingRow[] {
  const from = startOfDay(now);
  const to = from + DAY;
  const transcriptMeetings = new Set(
    Object.values(state.transcripts)
      .filter((transcript) => transcript.status !== "trashed")
      .map((transcript) => transcript.meetingId),
  );

  return Object.values(state.meetings)
    .filter((meeting) => meeting.startsAt >= from && meeting.startsAt < to)
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      timeLabel: clockLabel(meeting.startsAt),
      location: meeting.location,
      hasSummary: meeting.aiSummary != null,
      hasTranscript: transcriptMeetings.has(meeting.id),
      done: meeting.status === "completed",
    }));
}

export interface TodayStepRow {
  id: ID;
  routineId: ID;
  routineTitle: string;
  title: string;
  done: boolean;
  slot: string;
  taskId: ID | null;
  durationMin: number | null;
}

export function buildTodaySteps(state: AppState, now: Timestamp): TodayStepRow[] {
  const dayStart = startOfDay(now);
  const rows: TodayStepRow[] = [];

  for (const routine of activeRoutines(state)) {
    if (!routineDueOn(state, routine, dayStart)) continue;

    for (const item of resolveRoutineItems(state, routine, dayStart)) {
      const task = item.taskId != null ? state.tasks[item.taskId] : null;
      rows.push({
        id: `${routine.id}-${item.title}`,
        routineId: routine.id,
        routineTitle: routine.title,
        title: item.title,
        done: task?.status === "done",
        slot: routine.slot,
        taskId: item.taskId,
        durationMin: item.durationMin,
      });
    }
  }

  return rows.sort(
    (a, b) => Number(a.done) - Number(b.done) || a.routineTitle.localeCompare(b.routineTitle),
  );
}

export interface TodayProjectRow {
  id: ID;
  name: string;
  summary: string;
  progress: number;
  openTasks: number;
  doneTasks: number;
  nextMilestone: string | null;
  milestoneDueAt: Timestamp | null;
}

export function buildTodayProjects(state: AppState, now: Timestamp, limit = 4): TodayProjectRow[] {
  return Object.values(state.projects)
    .filter((project) => project.status === "active")
    .map((project) => {
      const stats = projectStats(state, project.id);
      const milestones = Object.values(state.milestones)
        .filter((milestone) => milestone.projectId === project.id && milestone.status === "open")
        .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
      const next = milestones[0] ?? null;
      return {
        id: project.id,
        name: project.name,
        summary: project.summary,
        progress: stats.progress,
        openTasks: stats.open,
        doneTasks: stats.done,
        nextMilestone: next?.title ?? null,
        milestoneDueAt: next?.dueAt ?? null,
      };
    })
    .sort((a, b) => b.openTasks - a.openTasks || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export interface TodayDeadlineRow {
  id: ID;
  title: string;
  dueAt: Timestamp;
  dueLabel: string;
  priority: Priority;
  projectName: string | null;
}

export function buildTodayDeadlines(state: AppState, now: Timestamp, limit = 6): TodayDeadlineRow[] {
  const from = startOfDay(now);
  const to = addDays(from, 7);
  const projects = new Map(Object.values(state.projects).map((project) => [project.id, project.name]));

  return Object.values(state.tasks)
    .filter(
      (task) =>
        task.status !== "done" &&
        task.status !== "cancelled" &&
        task.status !== "archived" &&
        task.dueAt != null &&
        task.dueAt >= from &&
        task.dueAt <= to,
    )
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0) || b.priority - a.priority)
    .slice(0, limit)
    .map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt!,
      dueLabel: isSameDay(task.dueAt!, now) ? "Today" : `In ${Math.max(1, Math.round((task.dueAt! - from) / DAY))}d`,
      priority: task.priority,
      projectName: task.projectId != null ? (projects.get(task.projectId) ?? null) : null,
    }));
}

export interface TodayNoteRow {
  id: ID;
  title: string;
  updatedAt: Timestamp;
  updatedLabel: string;
  tags: string[];
  notebookName: string | null;
}

export function buildTodayNotes(state: AppState, now: Timestamp, limit = 5): TodayNoteRow[] {
  const notebooks = new Map(
    Object.values(state.notebooks).map((notebook) => [notebook.id, notebook.title]),
  );

  return Object.values(state.notes)
    .filter((note) => note.status !== "trashed")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((note) => ({
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      updatedLabel: relativeLabel(note.updatedAt, now),
      tags: note.tags,
      notebookName: note.notebookId != null ? (notebooks.get(note.notebookId) ?? null) : null,
    }));
}

export interface TodayFocusRow {
  id: ID;
  startedAt: Timestamp;
  minutes: number;
  title: string;
  note: string;
  done: boolean;
}

export function buildTodayFocusLog(state: AppState, now: Timestamp): TodayFocusRow[] {
  const from = startOfDay(now);
  return selectFocusSessions(state, from, now, now)
    .map((row) => ({
      id: row.session.id,
      startedAt: row.session.startedAt,
      minutes: row.durationMin,
      title: row.taskTitle ?? "Focus session",
      note: row.session.note ?? "",
      done: row.session.status === "completed",
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export interface TodayMomentRow {
  id: ID;
  title: string;
  happenedAt: Timestamp;
  whenLabel: string;
  location: string;
}

export function buildTodayMoments(state: AppState, now: Timestamp, limit = 4): TodayMomentRow[] {
  const from = startOfDay(now);
  return Object.values(state.memoryMoments)
    .filter((moment) => moment.status !== "trashed" && moment.happenedAt >= from)
    .sort((a, b) => b.happenedAt - a.happenedAt)
    .slice(0, limit)
    .map((moment) => ({
      id: moment.id,
      title: moment.title,
      happenedAt: moment.happenedAt,
      whenLabel: clockLabel(moment.happenedAt),
      location: moment.place?.name ?? "",
    }));
}

export interface TodayRewardRow {
  level: number;
  title: string;
  xpTotal: number;
  coins: number;
  pointsToNext: number;
  progress: number;
  favoriteBadges: number;
}

export function buildTodayReward(state: AppState): TodayRewardRow {
  const profile = buildGamificationProfile(state);
  const unlocked = Object.values(state.achievements).filter(
    (achievement) => achievement.status === "unlocked",
  ).length;
  return {
    level: profile.level,
    title: profile.title,
    xpTotal: profile.xpTotal,
    coins: profile.coins,
    pointsToNext: profile.nextLevelAt,
    progress: profile.progressToNextLevel,
    favoriteBadges: unlocked,
  };
}
