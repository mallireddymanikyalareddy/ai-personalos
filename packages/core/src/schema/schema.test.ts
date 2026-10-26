import { describe, expect, it } from "vitest";
import { PersonalOS } from "../os";
import { parseRawState } from "../store/persistence";
import { createInitialState } from "../store/state";
import { buildCompletionHistory, buildTaskIndexes, UNSCOPED_KEY } from "./indexes";
import { findDanglingRefs, planCascade, REF_RULES } from "./relations";
import { createAttachment } from "../types/attachment";
import { createFocusSession } from "../types/engagement";
import { createHabitCheckIn } from "../types/habit";
import { createMilestone } from "../types/planning";
import { createProject } from "../types/project";
import { createReminder } from "../types/reminder";
import { createTask, type Task } from "../types/task";
import { createEvent } from "../types/event";
import type { AppState } from "../store/state";

function ruleExists(
  from: string,
  field: string,
  to: string,
  onDelete?: string,
): boolean {
  return REF_RULES.some(
    (rule) =>
      rule.from === from &&
      rule.field === field &&
      rule.to === to &&
      (onDelete === undefined || rule.onDelete === onDelete),
  );
}

describe("task multi-belonging", () => {
  it("expresses every membership on one record without duplication", () => {
    const task = createTask({
      title: "Ship launch",
      projectId: "p1",
      goalIds: ["g1", "g2"],
      milestoneId: "m1",
      habitId: "h1",
      routineId: "r1",
      calendarId: "cal1",
      lifeAreaId: "la1",
      categoryId: "cat1",
      assigneeId: "mem1",
      workspaceId: "ws1",
      tags: ["Deep-Work", "health"],
    });

    const tasks: Record<string, Task> = { [task.id]: task };
    const index = buildTaskIndexes(tasks);

    expect(index.byProject.get("p1")).toEqual([task]);
    expect(index.byGoal.get("g1")).toEqual([task]);
    expect(index.byGoal.get("g2")).toEqual([task]);
    expect(index.byMilestone.get("m1")).toEqual([task]);
    expect(index.byHabit.get("h1")).toEqual([task]);
    expect(index.byRoutine.get("r1")).toEqual([task]);
    expect(index.byCalendar.get("cal1")).toEqual([task]);
    expect(index.byLifeArea.get("la1")).toEqual([task]);
    expect(index.byCategory.get("cat1")).toEqual([task]);
    expect(index.byAssignee.get("mem1")).toEqual([task]);
    expect(index.byWorkspace.get("ws1")).toEqual([task]);
    expect(index.byTag.get("deep-work")).toEqual([task]);
    expect(index.byTag.get("health")).toEqual([task]);

    expect(Object.keys(tasks)).toHaveLength(1);
  });

  it("indexes legacy tasks missing stage-3 fields without crashing", () => {
    const legacy = {
      id: "legacy-1",
      title: "old shape",
      status: "open",
      tags: ["keep"],
      goalIds: ["g1"],
    } as unknown as Task;

    const index = buildTaskIndexes({ "legacy-1": legacy });

    expect(index.byStatus.get("open")).toHaveLength(1);
    expect(index.byGoal.get("g1")).toHaveLength(1);
    expect(index.byMilestone.size).toBe(0);
    expect(index.byWorkspace.get(UNSCOPED_KEY)).toEqual([legacy]);
    expect(index.byDueDay.size).toBe(0);
  });
});

describe("referential integrity", () => {
  it("declares the required relationship chains", () => {
    expect(ruleExists("projects", "goalIds", "goals")).toBe(true);
    expect(ruleExists("milestones", "projectId", "projects", "cascade")).toBe(true);
    expect(ruleExists("tasks", "milestoneId", "milestones")).toBe(true);
    expect(ruleExists("tasks", "parentTaskId", "tasks", "cascade")).toBe(true);
    expect(ruleExists("timeBlocks", "taskId", "tasks")).toBe(true);
    expect(ruleExists("reminders", "taskId", "tasks", "cascade")).toBe(true);
    expect(ruleExists("transcripts", "meetingId", "meetings")).toBe(true);
    expect(ruleExists("actionItems", "transcriptId", "transcripts")).toBe(true);
    expect(ruleExists("actionItems", "taskId", "tasks")).toBe(true);
    expect(ruleExists("pages", "notebookId", "notebooks", "cascade")).toBe(true);
    expect(ruleExists("aiMessages", "conversationId", "aiConversations", "cascade")).toBe(true);
    expect(ruleExists("shifts", "memberId", "members", "cascade")).toBe(true);
  });

  it("detects dangling hard refs and polymorphic owner refs", () => {
    const state: AppState = createInitialState();
    const project = createProject({ name: "Real" });
    const broken = createTask({
      title: "orphan refs",
      projectId: "missing-project",
      goalIds: ["missing-goal"],
    });
    const healthy = createTask({ title: "fine", projectId: project.id });
    const orphanAttachment = createAttachment({
      ownerType: "task",
      ownerId: "ghost-task",
      name: "file.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
    });
    state.projects[project.id] = project;
    state.tasks[broken.id] = broken;
    state.tasks[healthy.id] = healthy;
    state.attachments[orphanAttachment.id] = orphanAttachment;

    const dangling = findDanglingRefs(state);

    expect(dangling).toHaveLength(3);
    expect(dangling).toContainEqual({
      collection: "tasks",
      id: broken.id,
      field: "projectId",
      target: "projects",
      targetId: "missing-project",
    });
    expect(dangling).toContainEqual({
      collection: "tasks",
      id: broken.id,
      field: "goalIds",
      target: "goals",
      targetId: "missing-goal",
    });
    expect(dangling).toContainEqual({
      collection: "attachments",
      id: orphanAttachment.id,
      field: "ownerId",
      target: "tasks",
      targetId: "ghost-task",
    });

    state.tasks[broken.id] = { ...broken, projectId: null, goalIds: [] };
    state.attachments[orphanAttachment.id] = {
      ...orphanAttachment,
      ownerId: healthy.id,
    };
    expect(findDanglingRefs(state)).toHaveLength(0);
  });

  it("plans cascade and nullify for a project delete", () => {
    const state: AppState = createInitialState();
    const project = createProject({ name: "P" });
    const milestone = createMilestone({ projectId: project.id, title: "M" });
    const inProject = createTask({
      title: "a",
      projectId: project.id,
      milestoneId: milestone.id,
    });
    const linkedOnly = createTask({ title: "b", milestoneId: milestone.id });
    const attachment = createAttachment({
      ownerType: "task",
      ownerId: inProject.id,
      name: "f.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
    });
    state.projects[project.id] = project;
    state.milestones[milestone.id] = milestone;
    state.tasks[inProject.id] = inProject;
    state.tasks[linkedOnly.id] = linkedOnly;
    state.attachments[attachment.id] = attachment;

    const plan = planCascade(state, "projects", project.id);

    expect(plan.remove).toContainEqual({ collection: "projects", id: project.id });
    expect(plan.remove).toContainEqual({ collection: "milestones", id: milestone.id });
    expect(plan.nullify).toContainEqual({
      collection: "tasks",
      id: inProject.id,
      field: "projectId",
    });
    expect(plan.nullify).toContainEqual({
      collection: "tasks",
      id: inProject.id,
      field: "milestoneId",
    });
    expect(plan.nullify).toContainEqual({
      collection: "tasks",
      id: linkedOnly.id,
      field: "milestoneId",
    });
    expect(plan.remove).not.toContainEqual({
      collection: "attachments",
      id: attachment.id,
    });
  });

  it("cascades attachments when a task is deleted", () => {
    const state: AppState = createInitialState();
    const task = createTask({ title: "a" });
    const attachment = createAttachment({
      ownerType: "task",
      ownerId: task.id,
      name: "f.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
    });
    state.tasks[task.id] = task;
    state.attachments[attachment.id] = attachment;

    const plan = planCascade(state, "tasks", task.id);
    expect(plan.remove).toContainEqual({
      collection: "attachments",
      id: attachment.id,
    });
  });
});

describe("completion history", () => {
  it("unions task, habit and focus completions in time order", () => {
    const state: AppState = createInitialState();
    state.tasks["t1"] = {
      ...createTask({ title: "done" }),
      status: "done",
      completedAt: 300,
    };
    state.habitCheckins["hc1"] = createHabitCheckIn("h1", 100);
    state.focusSessions["fs1"] = {
      ...createFocusSession({ startedAt: 50 }),
      status: "completed",
      endsAt: 200,
    };
    state.focusSessions["fs2"] = createFocusSession({ startedAt: 50 });

    const history = buildCompletionHistory(state);

    expect(history.map((record) => record.at)).toEqual([100, 200, 300]);
    expect(history.map((record) => record.kind)).toEqual([
      "habit_checkin",
      "focus_session",
      "task",
    ]);
    expect(history).toHaveLength(3);
  });
});

describe("migration-free expansion", () => {
  it("fills collections missing from old payloads with empty maps", () => {
    const raw = JSON.stringify({
      version: 1,
      savedAt: 1000,
      state: {
        tasks: {
          t1: {
            type: "task",
            id: "t1",
            createdAt: 1,
            updatedAt: 1,
            title: "pre-stage-3 task",
            notes: "",
            status: "open",
            priority: 0,
            dueAt: null,
            scheduledAt: null,
            startedAt: null,
            completedAt: null,
            estimateMin: null,
            projectId: null,
            goalIds: [],
            parentTaskId: null,
            habitId: null,
            tags: [],
            reminderIds: [],
            recurrence: null,
            recurrenceId: null,
            recurrenceOrdinal: 1,
            dependsOn: [],
            source: "manual",
            order: 1,
          },
        },
      },
    });

    const parsed = parseRawState(raw);

    expect(parsed).not.toBeNull();
    expect(parsed!.tasks["t1"].title).toBe("pre-stage-3 task");
    expect(Object.keys(parsed!.members)).toHaveLength(0);
    expect(Object.keys(parsed!.aiInsights)).toHaveLength(0);
    expect(Object.keys(parsed!.milestones)).toHaveLength(0);
    expect(Object.keys(parsed!.calendars)).toHaveLength(0);
    expect(parsed!.tasks["t1"].milestoneId).toBeUndefined();
  });
});

describe("schema migrations", () => {
  it("backfills calendar event fields on version 2 payloads", () => {
    const event = createEvent({ title: "Legacy event", startsAt: 1000, endsAt: 2000 });
    const { attendees, categoryId, color, recurrence, recurrenceId, recurrenceOrdinal, reminderIds, ...legacy } = event;
    expect({ attendees, categoryId, color, recurrence, recurrenceId, recurrenceOrdinal, reminderIds }).toBeTruthy();

    const raw = JSON.stringify({
      version: 2,
      savedAt: 1000,
      state: { events: { [legacy.id]: legacy } },
    });

    const parsed = parseRawState(raw);

    expect(parsed).not.toBeNull();
    const migrated = parsed!.events[legacy.id];
    expect(migrated.attendees).toEqual([]);
    expect(migrated.categoryId).toBeNull();
    expect(migrated.color).toBeNull();
    expect(migrated.recurrence).toBeNull();
    expect(migrated.recurrenceId).toBeNull();
    expect(migrated.recurrenceOrdinal).toBe(1);
    expect(migrated.reminderIds).toEqual([]);
  });

  it("backfills planning preferences and block sources on version 3 payloads", () => {
    const raw = JSON.stringify({
      version: 3,
      savedAt: 1000,
      state: {
        timeBlocks: {
          tb1: {
            type: "time_block",
            id: "tb1",
            createdAt: 1,
            updatedAt: 1,
            title: "Focus",
            startsAt: 1000,
            endsAt: 2000,
            kind: "focus",
            taskId: null,
            eventId: null,
            completedAt: null,
          },
        },
        settings: {
          theme: "dark",
          weekStart: 1,
          timeFormat: 24,
          defaultTaskSort: "smart",
          onboardedAt: null,
          planning: { enabled: false, dayStart: "08:00", dayEnd: "16:00" },
        },
      },
    });

    const parsed = parseRawState(raw);

    expect(parsed).not.toBeNull();
    expect(parsed!.timeBlocks["tb1"].source).toBe("manual");
    expect(parsed!.settings.planning.enabled).toBe(false);
    expect(parsed!.settings.planning.dayStart).toBe("08:00");
    expect(parsed!.settings.planning.bufferMin).toBe(15);
  });
});

describe("canonical delete cascades in PersonalOS", () => {
  it("removes project milestones and nullifies task refs on project delete", () => {
    const os = new PersonalOS({ storage: null });
    const project = os.addProject("Launch");
    const milestone = createMilestone({ projectId: project.id, title: "Beta" });
    os.store.insert("milestones", milestone);
    const inProject = os.addTask({ title: "a", projectId: project.id, milestoneId: milestone.id });
    const elsewhere = os.addTask({ title: "b", milestoneId: milestone.id });

    os.deleteProject(project.id);

    expect(os.getState().milestones[milestone.id]).toBeUndefined();
    expect(os.getTask(inProject.id)!.projectId).toBeNull();
    expect(os.getTask(inProject.id)!.milestoneId).toBeNull();
    expect(os.getTask(elsewhere.id)!.milestoneId).toBeNull();
  });

  it("clears habit goal links on goal delete and reminders on habit delete", () => {
    const os = new PersonalOS({ storage: null });
    const goal = os.addGoal("Get fit");
    const habit = os.addHabit({ title: "Run", goalId: goal.id });
    os.store.insert("reminders", createReminder({ fireAt: 1000, habitId: habit.id }));

    os.deleteGoal(goal.id);
    expect(os.getState().habits[habit.id].goalId).toBeNull();

    os.deleteHabit(habit.id);
    expect(Object.keys(os.getState().reminders)).toHaveLength(0);
    expect(os.getState().habits[habit.id]).toBeUndefined();
  });
});
