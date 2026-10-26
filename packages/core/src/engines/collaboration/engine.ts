import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import type { CalendarEvent } from "../../types/event";
import type { Note } from "../../types/note";
import type { Member, MemberRole } from "../../types/identity";
import type { Comment, Mode, Share, ShareRole, AccessCheck } from "../../types/collaboration";
import { DEFAULT_MODE, SHARE_ROLE_RANK } from "../../types/collaboration";
import { startOfWeek } from "../date-utils";

const OWNER_ACCESS: AccessCheck = {
  allowed: true,
  role: "owner",
  reason: "owner",
};

const DENIED: AccessCheck = {
  allowed: false,
  role: "viewer",
  reason: "no-access",
};

export function accessCheck(
  state: AppState,
  entityType: "task" | "project" | "note" | "event",
  entityId: ID,
  memberId: ID | null,
  required: ShareRole = "viewer",
): AccessCheck {
  const member = memberId != null ? state.members[memberId] : null;
  if (memberId != null && !member) return DENIED;

  if (member && (member.role === "owner" || member.role === "admin")) {
    return OWNER_ACCESS;
  }

  const mode = entityMode(state, entityType, entityId);
  const isLocalOwner =
    memberId == null || (member != null && isLocalMember(state, member));

  if (mode === "personal") {
    if (isLocalOwner) return OWNER_ACCESS;
  } else if (isLocalOwner) {
    return OWNER_ACCESS;
  }

  const share = Object.values(state.shares).find(
    (entry) =>
      entry.entityType === entityType &&
      entry.entityId === entityId &&
      entry.memberId === memberId,
  );
  if (share) {
    return SHARE_ROLE_RANK[share.role] >= SHARE_ROLE_RANK[required]
      ? { allowed: true, role: share.role, reason: "shared" }
      : { ...DENIED, reason: "insufficient-share-role" };
  }

  if (entityType === "task") {
    const task = state.tasks[entityId];
    if (task && task.assigneeId != null && task.assigneeId === memberId) {
      return { allowed: true, role: "editor", reason: "assignee" };
    }
  }

  if (entityType === "project" && mode === "work") {
    const project = state.projects[entityId];
    if (project && isLocalMember(state, member)) {
      return { allowed: true, role: "viewer", reason: "work-mode-read" };
    }
  }

  return { ...DENIED, reason: isLocalOwner ? "owner" : "no-access" };
}

function entityMode(
  state: AppState,
  entityType: "task" | "project" | "note" | "event",
  entityId: ID,
): Mode {
  switch (entityType) {
    case "task":
      return state.tasks[entityId]?.mode ?? DEFAULT_MODE;
    case "project":
      return state.projects[entityId]?.mode ?? DEFAULT_MODE;
    case "note":
      return state.notes[entityId]?.mode ?? DEFAULT_MODE;
    case "event":
      return state.events[entityId]?.mode ?? DEFAULT_MODE;
  }
}

function isLocalMember(state: AppState, member: { userId: ID } | null): boolean {
  if (!member) return true;
  const localId = state.members["member_local"]?.userId;
  if (localId == null) return member.userId === "user_local";
  return member.userId === localId;
}

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}

export function commentsFor(
  state: AppState,
  targetType: Comment["targetType"],
  targetId: ID,
): CommentThread[] {
  const comments = Object.values(state.comments)
    .filter((comment) => comment.targetType === targetType && comment.targetId === targetId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const roots: Comment[] = [];
  const repliesByParent = new Map<ID, Comment[]>();

  for (const comment of comments) {
    if (comment.parentId == null) {
      roots.push(comment);
    } else {
      const list = repliesByParent.get(comment.parentId) ?? [];
      list.push(comment);
      repliesByParent.set(comment.parentId, list);
    }
  }

  return roots.map((root) => ({
    root,
    replies: repliesByParent.get(root.id) ?? [],
  }));
}

export function commentCount(state: AppState, targetId: ID): number {
  return Object.values(state.comments).filter((comment) => comment.targetId === targetId).length;
}

export interface MemberRef {
  id: ID;
  displayName: string;
  avatarUrl: string | null;
  role: MemberRole;
}

export function selectMembers(state: AppState, teamId?: ID | null): MemberRef[] {
  return Object.values(state.members)
    .filter((member) => member.status === "active" || member.status === "invited")
    .filter((member) => teamId == null || member.teamId === teamId)
    .map((member) => ({
      id: member.id,
      displayName: member.displayName ?? state.users[member.userId]?.displayName ?? "Unknown",
      avatarUrl: member.avatarUrl,
      role: member.role,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface SharedTaskRow {
  task: Task;
  assignee: MemberRef | null;
  projectName: string | null;
  commentCount: number;
  isShared: boolean;
}

export function selectTasksFor(
  state: AppState,
  memberId: ID | null,
  options: { mode?: Mode; includeAll?: boolean } = {},
): SharedTaskRow[] {
  const mode = options.mode ?? DEFAULT_MODE;
  const members = new Map(Object.values(state.members).map((member) => [member.id, member]));

  return Object.values(state.tasks)
    .filter((task) => task.status !== "archived")
    .filter((task) => (options.includeAll ? true : task.mode === mode))
    .filter((task) => memberId == null || task.assigneeId === memberId || isVisibleTo(state, task))
    .map((task) => {
      const assignee = task.assigneeId ? (members.get(task.assigneeId) ?? null) : null;
      return {
        task,
        assignee: assignee
          ? {
              id: assignee.id,
              displayName: assignee.displayName ?? "Unknown",
              avatarUrl: assignee.avatarUrl,
              role: assignee.role,
            }
          : null,
        projectName: task.projectId ? state.projects[task.projectId]?.name ?? null : null,
        commentCount: commentCount(state, task.id),
        isShared: isVisibleTo(state, task),
      };
    })
    .sort((a, b) => b.task.updatedAt - a.task.updatedAt);
}

function isVisibleTo(state: AppState, task: Task): boolean {
  if (task.mode === "personal") return false;
  return Object.values(state.shares).some(
    (share) => share.entityType === "task" && share.entityId === task.id,
  );
}

export interface SharedProjectRow {
  project: Project;
  memberCount: number;
  taskCount: number;
  openTaskCount: number;
  commentCount: number;
}

export function selectSharedProjects(state: AppState, mode: Mode = "work"): SharedProjectRow[] {
  const shareCounts = new Map<ID, number>();
  for (const share of Object.values(state.shares)) {
    if (share.entityType !== "project") continue;
    shareCounts.set(share.entityId, (shareCounts.get(share.entityId) ?? 0) + 1);
  }

  return Object.values(state.projects)
    .filter((project) => (mode === "personal" ? project.mode === "personal" : project.mode === "work"))
    .map((project) => {
      const tasks = Object.values(state.tasks).filter((task) => task.projectId === project.id);
      return {
        project,
        memberCount: shareCounts.get(project.id) ?? 0,
        taskCount: tasks.length,
        openTaskCount: tasks.filter(
          (task) => task.status === "open" || task.status === "in_progress",
        ).length,
        commentCount: commentCount(state, project.id),
      };
    })
    .sort((a, b) => b.project.updatedAt - a.project.updatedAt);
}

export interface SharedCalendarRow {
  event: CalendarEvent;
  organizerName: string;
  attendeeCount: number;
}

export function selectSharedCalendar(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  mode: Mode = "work",
): SharedCalendarRow[] {
  return Object.values(state.events)
    .filter((event) => event.mode === mode)
    .filter((event) => event.startsAt >= from && event.startsAt < to)
    .map((event) => {
      const organizer = event.attendees.find((attendee) => attendee.isOrganizer);
      return {
        event,
        organizerName: organizer?.name ?? event.location ?? "You",
        attendeeCount: event.attendees.length,
      };
    })
    .sort((a, b) => a.event.startsAt - b.event.startsAt);
}

export function buildIcsExport(
  state: AppState,
  from: Timestamp,
  to: Timestamp,
  mode: Mode = "work",
): string {
  const rows = selectSharedCalendar(state, from, to, mode);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PersonalOS//Shared Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const row of rows) {
    const { event } = row;
    const stamp = (ts: Timestamp) => new Date(ts).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@personalos`);
    lines.push(`DTSTAMP:${stamp(event.createdAt)}`);
    lines.push(`DTSTART:${stamp(event.startsAt)}`);
    lines.push(`DTEND:${stamp(event.endsAt)}`);
    lines.push(`SUMMARY:${event.title}`);
    if (event.notes) lines.push(`DESCRIPTION:${event.notes.replace(/\n/g, "\\n")}`);
    if (event.location) lines.push(`LOCATION:${event.location}`);
    if (event.allDay) lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export interface TeamRosterRow {
  member: Member;
  displayName: string;
  handle: string;
  openTasks: number;
  shiftsThisWeek: number;
  pendingTimeOff: number;
}

export function buildTeamRoster(state: AppState, now: Timestamp = Date.now()): TeamRosterRow[] {
  const weekStart = startOfWeek(now, state.settings.weekStart);
  const weekEnd = weekStart + 7 * 86_400_000;

  return Object.values(state.members)
    .filter((member) => member.status !== "left")
    .map((member) => ({
      member,
      displayName: member.displayName ?? state.users[member.userId]?.displayName ?? "Unknown",
      handle: "",
      openTasks: Object.values(state.tasks).filter(
        (task) => task.assigneeId === member.id && task.status !== "done" && task.status !== "cancelled",
      ).length,
      shiftsThisWeek: Object.values(state.shifts).filter(
        (shift) => shift.memberId === member.id && shift.startsAt >= weekStart && shift.startsAt < weekEnd,
      ).length,
      pendingTimeOff: Object.values(state.timeOffRequests).filter(
        (request) => request.memberId === member.id && request.status === "pending",
      ).length,
    }))
    .sort((a, b) => b.openTasks - a.openTasks || a.displayName.localeCompare(b.displayName));
}

export function weekStartOf(ts: Timestamp, weekStart: 0 | 1): Timestamp {
  return startOfWeek(ts, weekStart);
}

export const ROLE_ORDER: MemberRole[] = ["owner", "admin", "member", "guest"];

export function roleAtLeast(role: MemberRole, required: MemberRole): boolean {
  return ROLE_ORDER.indexOf(role) <= ROLE_ORDER.indexOf(required);
}

export function findShare(
  state: AppState,
  entityType: Share["entityType"],
  entityId: ID,
): Share[] {
  return Object.values(state.shares).filter(
    (share) => share.entityType === entityType && share.entityId === entityId,
  );
}

export function shareableStatus(state: AppState, entityType: Share["entityType"], entityId: ID): {
  shared: boolean;
  memberCount: number;
  roles: ShareRole[];
} {
  const shares = findShare(state, entityType, entityId);
  return {
    shared: shares.length > 0,
    memberCount: shares.length,
    roles: shares.map((share) => share.role),
  };
}

export const VISIBILITY_LEGEND = [
  { mode: "personal", label: "Personal", detail: "Only you can see this" },
  { mode: "work", label: "Work", detail: "Shared with the members you choose" },
] as const;