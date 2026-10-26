import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  parseIntent,
  parseVoiceCommand,
  decomposeTask,
  estimateTask,
  decomposeGoal,
  summarizeNoteText,
  computeInsights,
  computeRecommendations,
  buildWeeklyReview,
  analyzeTranscript,
  applyProposal,
  riskForCapability,
  requiresConfirmation,
  buildAIContext,
  hybridSearch,
  aiProvider,
} from "./index";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

describe("AI: intent routing", () => {
  it("routes natural language to the right capability", () => {
    expect(parseIntent("plan my day").capability).toBe("plan_day");
    expect(parseIntent("reschedule my week").capability).toBe("reschedule");
    expect(parseIntent("optimize my schedule").capability).toBe("optimize_schedule");
    expect(parseIntent("break down this task").capability).toBe("decompose_task");
    expect(parseIntent("how long will this take").capability).toBe("estimate_task");
    expect(parseIntent("break down my goal").capability).toBe("decompose_goal");
    expect(parseIntent("summarize this note").capability).toBe("summarize_note");
    expect(parseIntent("weekly review").capability).toBe("weekly_review");
    expect(parseIntent("give me my insights").capability).toBe("insights");
    expect(parseIntent("what should I focus on").capability).toBe("recommendations");
    expect(parseIntent("what did I write about the launch").capability).toBe("answer_question");
    expect(parseIntent("meeting notes action items").capability).toBe("meeting_intelligence");
    expect(parseIntent("add task: buy milk tomorrow at 9am").capability).toBe("create_task");
    expect(parseIntent("note: meeting takeaways").capability).toBe("create_note");
  });

  it("parses natural-language task creation with dates", () => {
    const intent = parseIntent("Add task: call the dentist tomorrow at 3pm !", { now: NOW });
    expect(intent.capability).toBe("create_task");
    expect(intent.slots.title).toBe("call the dentist");
    expect(intent.slots.dueAt).toBeTruthy();
    expect(intent.slots.priority).toBe("3");
  });

  it("parses voice commands the same way", () => {
    const voice = parseVoiceCommand("Hey PersonalOS, plan my day", { now: NOW });
    expect(voice.capability).toBe("plan_day");
    expect(voice.reason).toContain("voice");
  });
});

describe("AI: context and proposal lifecycle", () => {
  it("counts active goals and trashed notes accurately", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Completed goal" }, NOW);
    os.completeGoal(goal.id, NOW);
    const note = os.addNote({ title: "Trashed note" }, NOW);
    os.deleteNote(note.id);

    const counts = os.aiContext(NOW).counts;
    expect(counts.activeGoals).toBe(0);
    expect(counts.notes).toBe(0);
    expect(counts.trashedNotes).toBe(1);
  });

  it("counts review tasks as open and overdue when their due date has passed", () => {
    const os = makeOS();
    os.addTask({ title: "Needs review", status: "review", dueAt: NOW - 60_000 }, NOW - 86_400_000);

    const counts = os.aiContext(NOW).counts;
    expect(counts.openTasks).toBe(1);
    expect(counts.overdueTasks).toBe(1);
  });

  it("does not apply an accepted proposal twice", () => {
    const os = makeOS();
    const result = os.aiRun("add task: Buy milk", { now: NOW });
    const proposal = os.aiSaveProposal(result.proposals[0]!, NOW);

    expect(os.aiAcceptProposal(proposal.id, NOW).ok).toBe(true);
    const second = os.aiAcceptProposal(proposal.id, NOW + 1);

    expect(second.ok).toBe(false);
    expect(second.message).toContain("already been reviewed");
    expect(Object.values(os.getState().tasks).filter((task) => task.title === "Buy milk")).toHaveLength(1);
  });

  it("clears persisted messages without deleting the conversation", () => {
    const os = makeOS();
    const conversation = os.addConversation({ title: "Planning" }, NOW);
    os.addMessage({ conversationId: conversation.id, role: "user", content: "Plan my day" }, NOW);
    os.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "Here is a plan",
      result: { kind: "answer", capability: "plan_day", citations: [], data: { items: [] } },
    }, NOW + 1);

    os.clearConversation(conversation.id, NOW + 2);

    expect(Object.values(os.getState().aiMessages).filter((message) => message.conversationId === conversation.id)).toHaveLength(0);
    expect(os.getState().aiConversations[conversation.id]).toMatchObject({
      title: "Planning",
      summary: "",
      lastMessageAt: null,
    });
  });

  it("persists structured assistant result metadata on messages", () => {
    const os = makeOS();
    const conversation = os.addConversation({}, NOW);
    const message = os.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "Week summary",
      result: {
        kind: "answer",
        capability: "weekly_review",
        citations: [],
        data: { completedCount: 2 },
      },
    }, NOW);

    expect(os.getState().aiMessages[message.id]?.result).toEqual({
      kind: "answer",
      capability: "weekly_review",
      citations: [],
      data: { completedCount: 2 },
    });
  });
});

describe("AI: task decomposition and estimation", () => {
  it("splits compound tasks", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Write the spec and review it and ship it" });
    const steps = decomposeTask(task);
    expect(steps.length).toBe(3);
    expect(steps[0]!.title).toBe("Write the spec");
  });

  it("falls back to phases for a single-action task", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Refactor the billing module" });
    const steps = decomposeTask(task);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.some((step) => step.title.includes("billing module"))).toBe(true);
  });

  it("estimates from history when similar tasks are done", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Review the billing module" });
    expect(estimateTask(os.getState(), task, NOW).basis).toBe("heuristic");

    os.addSubtask(os.addTask({ title: "Review the billing module", status: "done" }).id, "x", NOW - 60 * 60000);
    const historyTask = Object.values(os.getState().tasks).find((t) => t.title === "Review the billing module");
    expect(historyTask).toBeDefined();
  });

  it("uses an explicit estimate when present", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Anything", estimateMin: 90 });
    const estimate = estimateTask(os.getState(), task, NOW);
    expect(estimate.estimateMin).toBe(90);
    expect(estimate.basis).toBe("history");
  });
});

describe("AI: goal decomposition", () => {
  it("decomposes a goal into projects, milestones, tasks and habits", () => {
    const os = makeOS();
    const goal = os.addGoal({
      title: "Run a half marathon",
      metrics: [{ label: "Distance", current: 4, target: 21, unit: "km" }],
    });

    const decomposition = decomposeGoal(os.getState(), goal, NOW);
    const kinds = new Set(decomposition.steps.map((step) => step.kind));
    expect(kinds.has("project")).toBe(true);
    expect(kinds.has("milestone")).toBe(true);
    expect(kinds.has("task")).toBe(true);
    expect(decomposition.steps.length).toBeGreaterThan(4);
  });

  it("asks for metrics when none exist", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Get healthier" });
    const decomposition = decomposeGoal(os.getState(), goal, NOW);
    expect(decomposition.steps.some((step) => step.title.includes("concrete outcomes"))).toBe(true);
  });
});

describe("AI: scheduling", () => {
  it("produces a plan proposal requiring confirmation", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Deep work block", estimateMin: 60, status: "open" });
    const result = os.aiRun("plan my day", { now: NOW });
    expect(result.kind).toBe("proposal");
    expect(result.proposals[0]!.requiresConfirmation).toBe(true);
    expect(result.proposals[0]!.risk).toBe("high");
    expect(task.id).toBeTruthy();
  });

  it("reports when the schedule is already clean", () => {
    const os = makeOS();
    const result = os.aiRun("optimize my schedule", { now: NOW });
    expect(result.capability).toBe("optimize_schedule");
    expect(result.message.toLowerCase()).toContain("no conflicts");
  });
});

describe("AI: notes, search and answers", () => {
  it("summarizes notes extractively and deterministically", () => {
    const first = summarizeNoteText(
      "The launch is scheduled for November. We need to finalise pricing before then. Marketing will own the announcement. The pricing decision blocks everything else.",
      2,
    );
    const second = summarizeNoteText(
      "The launch is scheduled for November. We need to finalise pricing before then. Marketing will own the announcement. The pricing decision blocks everything else.",
      2,
    );
    expect(first.summary).toBe(second.summary);
    expect(first.keyPoints.length).toBeGreaterThan(0);
  });

  it("builds a summary through the assistant", () => {
    const os = makeOS();
    os.addNote({ title: "Launch plan", body: "Launch in November. Pricing blocks everything. Marketing owns the announcement." });
    const result = os.aiRun("summarize the launch plan note", { now: NOW });
    expect(result.capability).toBe("summarize_note");
    expect(result.data).toBeTruthy();
  });

  it("answers questions with citations from authorized notes only", () => {
    const os = makeOS();
    os.addNote({ title: "Pricing decision", body: "We chose the flat $29 monthly price for the Pro plan." });
    os.addNote({ title: "Unrelated", body: "Groceries and errands for the weekend." });

    const result = os.aiRun("what did I write about pricing", { now: NOW });
    expect(result.capability).toBe("answer_question");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]!.entityType).toBe("note");
  });

  it("returns nothing rather than guessing when nothing matches", () => {
    const os = makeOS();
    os.addNote({ title: "Groceries", body: "oat milk and coffee" });
    const result = os.aiRun("what did I write about quantum teleportation", { now: NOW });
    expect(result.capability).toBe("answer_question");
    expect(result.citations).toHaveLength(0);
    expect(result.message.toLowerCase()).toContain("could not find");
  });

  it("hybrid search finds the right note", () => {
    const os = makeOS();
    const note = os.addNote({ title: "Migration plan", body: "Move the database to Postgres 17 in stages." });
    const hits = hybridSearch(os.getState(), { query: "database postgres", limit: 5 });
    expect(hits.some((hit) => hit.id === note.id)).toBe(true);
  });
});

describe("AI: review, insights and recommendations", () => {
  it("builds a weekly review from real activity", () => {
    const os = makeOS();
    const task = os.addTask({ title: "Finished thing", status: "open" });
    os.completeTask(task.id, NOW - 86_400_000);
    os.addGoal({ title: "Get fit", metrics: [{ label: "km", current: 2, target: 10, unit: "km" }] });

    const review = buildWeeklyReview(os.getState(), NOW, 1);
    expect(review.completedCount).toBeGreaterThanOrEqual(1);
    expect(review.goalLines[0]!.title).toBe("Get fit");

    const result = os.aiRun("weekly review", { now: NOW });
    expect(result.capability).toBe("weekly_review");
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("computes deterministic insights", () => {
    const os = makeOS();
    const overdue = os.addTask({ title: "Old thing", dueAt: NOW - 4 * 86_400_000, status: "open" });
    os.addHabit({ title: "Meditate", cadence: "daily" });

    const insights = computeInsights(os.getState(), NOW);
    expect(insights.length).toBeGreaterThan(2);
    expect(insights.some((insight) => insight.metric === "overdue")).toBe(true);
    expect(overdue.id).toBeTruthy();

    const recommendations = computeRecommendations(os.getState(), NOW);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]!.priority).toBeGreaterThanOrEqual(
      recommendations[recommendations.length - 1]!.priority,
    );
  });
});

describe("AI: meeting intelligence", () => {
  it("extracts action items, decisions and speakers from a transcript", () => {
    const os = makeOS();
    const transcript = os.addTranscript({
      title: "Launch sync",
      source: "recording",
      meetingId: null,
    });
    os.updateTranscript(transcript.id, {
      status: "ready",
      fullText: "Ada: We decided to launch in November.\nAda: I will send the pricing sheet today.\nGrace: Can you schedule the review call tomorrow?",
      segments: [
        { speaker: "Ada", startMs: 0, endMs: 1000, text: "We decided to launch in November." },
        { speaker: "Ada", startMs: 1000, endMs: 2000, text: "I will send the pricing sheet today." },
        { speaker: "Grace", startMs: 2000, endMs: 3000, text: "Can you schedule the review call tomorrow?" },
      ],
    });

    const result = os.aiRun("action items from the launch sync", { now: NOW });
    expect(result.capability).toBe("meeting_intelligence");
    const analysis = result.data as ReturnType<typeof analyzeTranscript>;
    expect(analysis.actionItems.length).toBeGreaterThanOrEqual(2);
    expect(analysis.decisions.length).toBeGreaterThanOrEqual(1);
    expect(analysis.speakers.map((speaker) => speaker.name)).toContain("Ada");
    expect(result.proposals.length).toBeGreaterThan(0);
  });

  it("reports when there is nothing to analyse", () => {
    const os = makeOS();
    const result = os.aiRun("meeting intelligence", { now: NOW });
    expect(result.message.toLowerCase()).toContain("no transcripts");
  });
});

describe("AI: confirmation rules and proposals", () => {
  it("marks calendar writes as high risk and requires confirmation", () => {
    const os = makeOS();
    os.addTask({ title: "Deep work", estimateMin: 60, status: "open" });
    const result = os.aiRun("plan my day", { now: NOW });
    expect(result.proposals[0]!.risk).toBe("high");
    expect(result.proposals[0]!.requiresConfirmation).toBe(true);
    expect(riskForCapability("plan_day")).toBe("high");
    expect(requiresConfirmation("plan_day")).toBe(true);
  });

  it("stores a proposal, applies it on accept, and dismisses it", () => {
    const os = makeOS();
    const parent = os.addTask({ title: "Ship the thing", status: "open" });
    const result = os.aiRun("break down the ship the thing task", { now: NOW });

    const proposal = result.proposals[0]!;
    const stored = os.aiSaveProposal(proposal, NOW);
    expect(os.aiPendingProposals()).toHaveLength(1);
    expect(Object.keys(os.getState().tasks)).toHaveLength(1);

    const applied = os.aiAcceptProposal(stored.id, NOW);
    expect(applied.ok).toBe(true);
    expect(applied.created.length).toBeGreaterThan(1);
    expect(os.getState().aiObjects[stored.id]!.status).toBe("accepted");
    expect(Object.values(os.getState().tasks).some((task) => task.parentTaskId === parent.id)).toBe(true);
  });

  it("dismissed proposals never change data", () => {
    const os = makeOS();
    os.addTask({ title: "Parent task", status: "open" });
    const result = os.aiRun("break down the parent task", { now: NOW });
    const stored = os.aiSaveProposal(result.proposals[0]!, NOW);

    os.aiDismissProposal(stored.id);
    expect(os.getState().aiObjects[stored.id]!.status).toBe("dismissed");
    expect(Object.keys(os.getState().tasks)).toHaveLength(1);
  });

  it("refuses unknown payloads instead of writing", () => {
    const os = makeOS();
    const result = applyProposal(os as unknown as Parameters<typeof applyProposal>[0], {
      capability: "insights",
      title: "nothing",
      summary: "nothing",
      risk: "low",
      requiresConfirmation: false,
      preview: [],
      refs: [],
      reasoning: "",
      payload: { kind: "not_a_real_kind" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("AI: context and authorization", () => {
  it("reports what the assistant can see", () => {
    const os = makeOS();
    os.addTask({ title: "A" });
    os.addNote({ title: "B" });
    const context = buildAIContext(os.getState(), NOW);
    expect(context.counts.openTasks).toBeGreaterThan(0);
    expect(context.counts.notes).toBeGreaterThan(0);
    expect(context.access.tasks).toBe(true);
    expect(context.access.notes).toBe(true);
    expect(context.authorizedIds.length).toBeGreaterThan(1);
    expect(context.deniedCount).toBe(0);
  });

  it("excludes entities the user cannot read from the authorized bundle", () => {
    const os = makeOS();
    os.addTask({ title: "Mine" });
    const state = os.getState();
    const foreign = { ...state.tasks[Object.keys(state.tasks)[0]!]!, ownerId: "user_someone_else" };
    state.tasks[foreign.id] = foreign;

    const context = buildAIContext(state, NOW);
    expect(context.authorizedIds).not.toContain(foreign.id);
    expect(context.deniedCount).toBe(1);
    expect(context.counts.openTasks).toBe(0);
  });

  it("never answers from a note the user cannot read", () => {
    const os = makeOS();
    os.addNote({ title: "Private to someone else", body: "Secret salary numbers go here." });
    const state = os.getState();
    const foreign = { ...state.notes[Object.keys(state.notes)[0]!]!, ownerId: "user_someone_else" };
    state.notes[foreign.id] = foreign;

    const result = os.aiRun("what did I write about salary", { now: NOW });
    expect(result.citations).toHaveLength(0);
  });
});

describe("AI: conversation management", () => {
  it("renames a conversation and trims overlong titles", () => {
    const os = makeOS();
    const conversation = os.addConversation({ title: "Old" }, NOW);
    const renamed = os.renameConversation(conversation.id, "  Planning sprint  ", NOW + 1);
    expect(renamed?.title).toBe("Planning sprint");

    const long = os.renameConversation(conversation.id, "x".repeat(200), NOW + 2);
    expect(long?.title).toHaveLength(80);

    const blank = os.renameConversation(conversation.id, "   ", NOW + 3);
    expect(blank?.title).toBe("New conversation");
  });

  it("deletes a conversation and its messages", () => {
    const os = makeOS();
    const keep = os.addConversation({ title: "Keep" }, NOW);
    const drop = os.addConversation({ title: "Drop" }, NOW);
    os.addMessage({ conversationId: drop.id, role: "user", content: "hi" }, NOW);
    os.addMessage({ conversationId: keep.id, role: "user", content: "stay" }, NOW + 1);

    os.deleteConversation(drop.id);

    expect(os.getState().aiConversations[drop.id]).toBeUndefined();
    expect(Object.values(os.getState().aiMessages).filter((m) => m.conversationId === drop.id)).toHaveLength(0);
    expect(Object.values(os.getState().aiMessages).filter((m) => m.conversationId === keep.id)).toHaveLength(1);
  });
});
describe("AI: feedback, pinning and providers", () => {
  it("stores message feedback and summarises the signal", () => {
    const os = makeOS();
    const conversation = os.addConversation({}, NOW);
    const first = os.addMessage({ conversationId: conversation.id, role: "assistant", content: "A" }, NOW);
    const second = os.addMessage({ conversationId: conversation.id, role: "assistant", content: "B" }, NOW + 1);
    os.addMessage({ conversationId: conversation.id, role: "assistant", content: "C" }, NOW + 2);

    os.setMessageFeedback(first.id, "up");
    os.setMessageFeedback(second.id, "down");

    expect(os.aiFeedbackSummary()).toEqual({ up: 1, down: 1, total: 2 });
    expect(os.getState().aiMessages[first.id]?.feedback).toBe("up");
    expect(os.getState().aiMessages[second.id]?.feedback).toBe("down");

    os.setMessageFeedback(second.id, null);
    expect(os.aiFeedbackSummary()).toEqual({ up: 1, down: 0, total: 1 });
  });

  it("pins and unpins conversations", () => {
    const os = makeOS();
    const conversation = os.addConversation({ title: "Older" }, NOW);
    os.pinConversation(conversation.id, true, NOW + 120_000);
    expect(os.getState().aiConversations[conversation.id]?.pinnedAt).toBe(NOW + 120_000);

    os.pinConversation(conversation.id, false);
    expect(os.getState().aiConversations[conversation.id]?.pinnedAt).toBeNull();
  });

  it("exposes the local provider and flags unavailable ones", () => {
    expect(aiProvider("local").available).toBe(true);
    expect(aiProvider(null).id).toBe("local");
    const openai = aiProvider("openai");
    expect(openai.available).toBe(false);
    expect(openai.reason).toContain("Settings");
  });
});