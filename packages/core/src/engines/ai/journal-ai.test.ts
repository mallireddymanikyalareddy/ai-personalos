import { describe, expect, it } from "vitest";

import { createMemoryStorage } from "../../store/persistence";
import { PersonalOS } from "../../os";
import {
  applyJournalProposal,
  journalActivitySuggestions,
  journalEventSuggestions,
  journalGoalSuggestions,
  journalHabitSuggestions,
  runJournalAssistant,
  type JournalApplyContext,
} from "./journal";
import type { JournalEntry } from "../../types/journal";
import type { ID, Timestamp } from "../../types/common";
import type { NewTaskInput, Task } from "../../types/task";
import type { NewEventInput, CalendarEvent } from "../../types/event";
import type { NewLifeMemoryItemInput, LifeMemoryItem } from "../../types/life-memory";

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();
const DAY_MS = 86_400_000;

const DEFAULT_BODY =
  "Today was productive. I finished the support documentation and went to cricket practice. Need to call the client tomorrow at 3 PM.";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

function addEntry(
  os: PersonalOS,
  overrides: Partial<Parameters<PersonalOS["addJournalEntry"]>[0]> = {},
): JournalEntry {
  const created = os.addJournalEntry({ entryDate: NOW, body: DEFAULT_BODY, ...overrides }, NOW);
  return os.getJournalEntry(created.id)!;
}

describe("journal AI assistant", () => {
  it("summarises without changing the original text", () => {
    const os = makeOS();
    const source = addEntry(os);
    const result = runJournalAssistant({ entry: source, action: "summarize" }, os.getState(), NOW);
    expect(result.summary).toContain("productive");
    expect(os.getJournalEntry(source.id)!.body).toContain("cricket practice");
    expect(result.proposals).toHaveLength(0);
  });

  it("proposes improved writing as a confirmable change", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "i dont feel great about the day , it was alot of work" });
    const result = runJournalAssistant({ entry: source, action: "improve_writing" }, os.getState(), NOW);

    expect(result.improvedBody).toBeTruthy();
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]!.requiresConfirmation).toBe(true);
    expect(result.proposals[0]!.payload.kind).toBe("journal_update");
    expect(os.getJournalEntry(source.id)!.body).toContain("dont");
  });

  it("extracts only unfinished work as task candidates", () => {
    const os = makeOS();
    const source = addEntry(os);
    const result = runJournalAssistant({ entry: source, action: "extract_tasks" }, os.getState(), NOW);
    const titles = result.proposals.map((proposal) => proposal.title);

    expect(titles).toContain("Call the client");
    expect(titles).not.toContain("Finish the support documentation");
    expect(result.proposals.every((proposal) => proposal.requiresConfirmation)).toBe(true);
  });

  it("does not re-propose tasks that already exist", () => {
    const os = makeOS();
    os.addTask({ title: "Call the client", status: "open" });
    const source = addEntry(os);
    const result = runJournalAssistant({ entry: source, action: "extract_tasks" }, os.getState(), NOW);
    expect(result.proposals.map((proposal) => proposal.title)).not.toContain("Call the client");
  });

  it("extracts calendar candidates from call statements", () => {
    const os = makeOS();
    const suggestions = journalEventSuggestions(addEntry(os), NOW);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.title.toLowerCase()).toContain("client");
    expect(suggestions[0]!.startsAt).toBe(new Date(2026, 9, 16, 15, 0, 0, 0).getTime());
  });

  it("suggests a mood without recording it", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "I feel really stressed after today's meetings." });
    const result = runJournalAssistant({ entry: source, action: "detect_mood" }, os.getState(), NOW);
    expect(result.mood).toBe("stressed");
    expect(os.getJournalEntry(source.id)!.mood).toBeNull();
    expect(result.proposals[0]!.payload.patch).toEqual({ mood: "stressed" });
  });

  it("asks follow-up questions for a stressed entry", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "I feel stressed and overwhelmed after a long day." });
    const result = runJournalAssistant({ entry: source, action: "reflect" }, os.getState(), NOW);
    expect(result.questions!.join(" ")).toContain("stressed");
  });

  it("plans tomorrow from unfinished work", () => {
    const os = makeOS();
    const source = addEntry(os);
    const task = os.addTask({ title: "Book the venue", status: "open" });
    os.linkJournalToTask(source.id, task.id);
    const updated = os.getJournalEntry(source.id)!;

    const result = runJournalAssistant({ entry: updated, action: "tomorrow" }, os.getState(), NOW);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]!.payload.kind).toBe("journal_update");
    expect(result.message).toContain("Book the venue");
  });

  it("offers a life memory for a match day", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "Played a great cricket match today and scored 42 runs." });
    const result = runJournalAssistant({ entry: source, action: "create_memory" }, os.getState(), NOW);
    expect(result.memory).toBe(true);
    expect(result.proposals[0]!.payload.kind).toBe("journal_create_memory");
  });

  it("says nothing is worth remembering for an ordinary day", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "Nothing much happened, just a normal day at home." });
    const result = runJournalAssistant({ entry: source, action: "create_memory" }, os.getState(), NOW);
    expect(result.memory).toBe(false);
    expect(result.proposals).toHaveLength(0);
  });

  it("extracts highlights from achievement sentences", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "I finished the migration and shipped the release notes." });
    const result = runJournalAssistant({ entry: source, action: "extract_highlights" }, os.getState(), NOW);
    expect(result.highlights!.length).toBeGreaterThan(0);
    expect(result.highlights![0]).toContain("finished the migration");
  });
});

describe("journal AI suggestions", () => {
  it("matches habits from the entry text", () => {
    const os = makeOS();
    const gym = os.addHabit({ title: "Gym" });
    const source = addEntry(os, { body: "Went to the gym today" });
    const suggestions = journalHabitSuggestions(source, Object.values(os.getState().habits));
    expect(suggestions[0]!.habitId).toBe(gym.id);
    expect(suggestions[0]!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("matches goals by topic words", () => {
    const os = makeOS();
    const goal = os.addGoal({ title: "Learn New Technologies" });
    const source = addEntry(os, { body: "Spent two hours learning Next.js" });
    const suggestions = journalGoalSuggestions(source, Object.values(os.getState().goals));
    expect(suggestions[0]!.goalId).toBe(goal.id);
  });

  it("suggests activities from the entry text", () => {
    const os = makeOS();
    expect(journalActivitySuggestions(addEntry(os, { body: "went to cricket practice" }))).toContain("Cricket");
    expect(journalActivitySuggestions(addEntry(os, { body: "spent time with family" }))).toContain("Family time");
  });
});

describe("journal AI proposal application", () => {
  function context(os: PersonalOS) {
    const apply: JournalApplyContext = {
      addTask: (input: NewTaskInput, now?: Timestamp): Task => os.addTask(input, now ?? NOW),
      updateEntry: (entryId: ID, patch): JournalEntry | null => os.updateJournalEntry(entryId, patch, NOW),
      addEvent: (input: NewEventInput, now?: Timestamp): CalendarEvent => os.addEvent(input, now ?? NOW),
      addLifeMemoryItem: (input: NewLifeMemoryItemInput, now?: Timestamp): LifeMemoryItem =>
        os.addLifeMemoryItem(input, now ?? NOW),
      linkJournalToTask: (entryId: ID, taskId: ID) => {
        os.linkJournalToTask(entryId, taskId);
      },
      linkJournalToEvent: (entryId: ID, eventId: ID) => {
        os.linkJournalToEvent(entryId, eventId);
      },
      linkJournalToGoal: (entryId: ID, goalId: ID) => {
        os.linkJournalToGoal(entryId, goalId);
      },
      linkJournalToLifeMemory: (entryId: ID, memoryId: ID) => {
        os.linkJournalToLifeMemory(entryId, memoryId);
      },
    };
    return apply;
  }

  it("applies a task proposal and links it back to the entry", () => {
    const os = makeOS();
    const source = addEntry(os);
    const result = runJournalAssistant({ entry: source, action: "extract_tasks" }, os.getState(), NOW);
    const applied = applyJournalProposal(context(os), result.proposals[0]!, NOW);

    expect(applied.ok).toBe(true);
    expect(os.getJournalEntry(source.id)!.taskIds).toHaveLength(1);
    expect(Object.values(os.getState().tasks)).toHaveLength(1);
  });

  it("applies a mood proposal only on confirmation", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "I feel happy today" });
    const result = runJournalAssistant({ entry: source, action: "detect_mood" }, os.getState(), NOW);

    expect(os.getJournalEntry(source.id)!.mood).toBeNull();
    applyJournalProposal(context(os), result.proposals[0]!, NOW);
    expect(os.getJournalEntry(source.id)!.mood).toBe("happy");
  });

  it("applies a memory proposal and links it", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "Played a cricket match and scored 42 runs." });
    const result = runJournalAssistant({ entry: source, action: "create_memory" }, os.getState(), NOW);
    const applied = applyJournalProposal(context(os), result.proposals[0]!, NOW);

    expect(applied.ok).toBe(true);
    const entryAfter = os.getJournalEntry(source.id)!;
    expect(entryAfter.lifeMemoryIds).toHaveLength(1);
    expect(os.getState().lifeMemoryItems[entryAfter.lifeMemoryIds[0]!]!.description).toContain("cricket");
  });

  it("applies an improved-writing proposal", () => {
    const os = makeOS();
    const source = addEntry(os, { body: "i dont feel great , it was alot" });
    const result = runJournalAssistant({ entry: source, action: "improve_writing" }, os.getState(), NOW);
    applyJournalProposal(context(os), result.proposals[0]!, NOW);

    const after = os.getJournalEntry(source.id)!;
    expect(after.body).toContain("don't");
    expect(after.body).not.toContain("dont");
  });

  it("leaves the journal untouched when the user declines", () => {
    const os = makeOS();
    const source = addEntry(os);
    runJournalAssistant({ entry: source, action: "extract_tasks" }, os.getState(), NOW);
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
    expect(os.getJournalEntry(source.id)!.taskIds).toHaveLength(0);
  });

  it("suggests a due date one day ahead for tomorrow phrasing", () => {
    const os = makeOS();
    const source = addEntry(os);
    const result = runJournalAssistant({ entry: source, action: "extract_tasks" }, os.getState(), NOW);
    const taskProposal = result.proposals.find((proposal) => proposal.title === "Call the client")!;
    const proposed = (taskProposal.payload.task as { dueAt: number }).dueAt;

    expect(proposed).toBeGreaterThan(NOW);
    expect(new Date(proposed).getDate()).toBe(new Date(NOW + DAY_MS).getDate());
  });

  it("rejects an unsupported proposal", () => {
    const os = makeOS();
    const applied = applyJournalProposal(context(os), {
      capability: "journal_summarize",
      title: "Nothing",
      summary: "",
      risk: "low",
      requiresConfirmation: true,
      preview: [],
      refs: [],
      payload: { kind: "unknown", entryId: "x" },
      reasoning: "",
    });
    expect(applied.ok).toBe(false);
  });
});
