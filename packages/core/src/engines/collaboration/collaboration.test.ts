import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import { extractMentions } from "../../types/collaboration";
import { buildTeamRoster, commentsFor, selectMembers, selectSharedCalendar } from "./engine";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();
const DAY = 86_400_000;

function seedTeam(os: PersonalOS) {
  const me = os.addMember({ userId: "user_local", role: "member", displayName: "Ada" });
  const other = os.addMember({ userId: "user_ada", role: "member", displayName: "Grace" });
  return { me, other };
}

describe("Collaboration: mode isolation", () => {
  it("defaults to personal mode", () => {
    const os = makeOS();
    expect(os.activeMode()).toBe("personal");
  });

  it("keeps personal tasks out of the work view", () => {
    const os = makeOS();
    const personal = os.addTask({ title: "Personal errand" });
    os.addTask({ title: "Work item", mode: "work" });

    expect(os.sharedTasks("personal").map((row) => row.task.id)).toContain(personal.id);
    expect(os.sharedTasks("work").some((row) => row.task.id === personal.id)).toBe(false);
    expect(os.sharedTasks("work").length).toBeGreaterThan(0);
  });

  it("never exposes personal projects as shared", () => {
    const os = makeOS();
    os.addProject({ name: "Personal project" });
    expect(os.sharedProjects("work")).toHaveLength(0);
  });

  it("switching to work mode does not delete or reveal personal data", () => {
    const os = makeOS();
    const personal = os.addTask({ title: "Private note", mode: "personal" });
    os.setActiveMode("work");
    expect(os.activeMode()).toBe("work");
    expect(os.sharedTasks("personal").some((row) => row.task.id === personal.id)).toBe(true);
    os.setActiveMode("personal");
    expect(os.getTask(personal.id)).not.toBeNull();
  });
});

describe("Collaboration: assignment", () => {
  it("assigning promotes the task to work mode and notifies", () => {
    const os = makeOS();
    const { other } = seedTeam(os);
    const task = os.addTask({ title: "Review the spec", mode: "personal" });

    const assigned = os.assignTask(task.id, other.id, NOW)!;
    expect(assigned.mode).toBe("work");
    expect(assigned.assigneeId).toBe(other.id);

    const notifications = Object.values(os.getState().notifications);
    expect(notifications.some((n) => n.kind === "assignment" && n.entityId === task.id)).toBe(true);
  });

  it("refuses to assign to an unknown member", () => {
    const os = makeOS();
    seedTeam(os);
    const task = os.addTask({ title: "Something" });
    expect(os.assignTask(task.id, "member-missing")).toBeNull();
  });

  it("assignees get edit access without an explicit share", () => {
    const os = makeOS();
    const { other } = seedTeam(os);
    const task = os.addTask({ title: "Shared work", mode: "work" });

    const check = os.checkAccess("task", task.id, other.id, "editor");
    expect(check.allowed).toBe(false);
    os.assignTask(task.id, other.id, NOW);
    expect(os.checkAccess("task", task.id, other.id, "editor").allowed).toBe(true);
  });

  it("owners keep access over shared work", () => {
    const os = makeOS();
    seedTeam(os);
    const task = os.addTask({ title: "Shared work", mode: "work" });
    expect(os.checkAccess("task", task.id, null, "editor").allowed).toBe(true);
  });

  it("shares grant only the granted role", () => {
    const os = makeOS();
    const { other } = seedTeam(os);
    const task = os.addTask({ title: "Shared work", mode: "work" });

    os.addShare({ entityType: "task", entityId: task.id, memberId: other.id, role: "viewer" });
    expect(os.checkAccess("task", task.id, other.id, "viewer").allowed).toBe(true);
    expect(os.checkAccess("task", task.id, other.id, "editor").allowed).toBe(false);

    os.updateShareRole(os.sharesFor("task", task.id)[0]!.id, "editor");
    expect(os.checkAccess("task", task.id, other.id, "editor").allowed).toBe(true);
  });
});

describe("Collaboration: comments and mentions", () => {
  it("creates a comment and resolves mentions", () => {
    const os = makeOS();
    const { other } = seedTeam(os);
    const task = os.addTask({ title: "Shared work", mode: "work" });

    const members = selectMembers(os.getState());
    const mentions = extractMentions(
      "Can you take this @Grace?",
      members.map((m) => ({ id: m.id, displayName: m.displayName })),
    );
    expect(mentions).toContain(other.id);

    const comment = os.addComment(
      { targetType: "task", targetId: task.id, body: "Can you take this @Grace?", mentions },
      NOW,
    );
    expect(comment.mentions).toEqual([other.id]);
    expect(os.commentsFor("task", task.id)).toHaveLength(1);

    const notifications = Object.values(os.getState().notifications);
    expect(notifications.some((n) => n.kind === "mention")).toBe(true);
  });

  it("threads replies under the root comment", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Shared work", mode: "work" });
    const root = os.addComment({ targetType: "task", targetId: task.id, body: "Root" }, NOW);
    os.addComment({ targetType: "task", targetId: task.id, body: "Reply", parentId: root.id }, NOW + 1);

    const threads = commentsFor(os.getState(), "task", task.id);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.replies).toHaveLength(1);
  });

  it("deleting a comment also deletes its replies", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Shared work", mode: "work" });
    const root = os.addComment({ targetType: "task", targetId: task.id, body: "Root" }, NOW);
    os.addComment({ targetType: "task", targetId: task.id, body: "Reply", parentId: root.id }, NOW + 1);

    os.deleteComment(root.id);
    expect(Object.keys(os.getState().comments)).toHaveLength(0);
  });

  it("tracks edited comments", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Shared work", mode: "work" });
    const comment = os.addComment({ targetType: "task", targetId: task.id, body: "Original" }, NOW);

    const edited = os.updateComment(comment.id, "Updated", NOW + 100)!;
    expect(edited.body).toBe("Updated");
    expect(edited.edited).toBe(true);
  });
});

describe("Collaboration: shared calendars", () => {
  it("separates personal events from work events", () => {
    const os = makeOS();
    const personal = os.addEvent({
      title: "Dentist",
      startsAt: NOW + DAY,
      endsAt: NOW + DAY + 3_600_000,
    });
    os.addEvent({
      title: "Standup",
      startsAt: NOW + 2 * DAY,
      endsAt: NOW + 2 * DAY + 3_600_000,
      mode: "work",
    });

    expect(os.sharedCalendar(NOW, NOW + 14 * DAY, "personal").some((row) => row.event.id === personal.id)).toBe(true);
    expect(os.sharedCalendar(NOW, NOW + 14 * DAY, "work").every((row) => row.event.mode === "work")).toBe(true);
  });

  it("exports an ICS feed of shared events only", () => {
    const os = makeOS();
    os.addEvent({ title: "Dentist", startsAt: NOW + DAY, endsAt: NOW + DAY + 3_600_000 });
    os.addEvent({ title: "Standup", startsAt: NOW + 2 * DAY, endsAt: NOW + 2 * DAY + 3_600_000, mode: "work" });

    const ics = os.exportIcs(NOW, NOW + 14 * DAY, "work");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Standup");
    expect(ics).not.toContain("SUMMARY:Dentist");
  });
});

describe("Collaboration: team roster", () => {
  it("lists members with their open work", () => {
    const os = makeOS();
    const { me, other } = seedTeam(os);
    const t1 = os.addTask({ title: "A", mode: "work" });
    const t2 = os.addTask({ title: "B", mode: "work" });
    os.assignTask(t1.id, me.id, NOW);
    os.assignTask(t2.id, other.id, NOW);

    const roster = os.teamRoster();
    expect(roster).toHaveLength(2);
    expect(roster.find((row) => row.member.id === me.id)!.openTasks).toBe(1);
    expect(roster.find((row) => row.member.id === other.id)!.openTasks).toBe(1);
  });

  it("lists only active and invited members", () => {
    const os = makeOS();
    const me = os.addMember({ userId: "user_local", role: "member", displayName: "Ada" });
    const left = os.addMember({ userId: "user_gone", role: "member", displayName: "Bo" });
    os.updateMember(left.id, { status: "left" });
    os.updateMember(me.id, { status: "active" });

    expect(os.members()).toHaveLength(1);
  });
});

describe("Collaboration: access control", () => {
  it("denies access to unknown members", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Shared", mode: "work" });
    expect(os.checkAccess("task", task.id, "member-ghost").allowed).toBe(false);
  });
});