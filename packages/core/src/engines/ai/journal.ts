import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { NewTaskInput, Task } from "../../types/task";
import type { NewEventInput, CalendarEvent } from "../../types/event";
import type { NewLifeMemoryItemInput, LifeMemoryItem } from "../../types/life-memory";
import type { JournalEntry } from "../../types/journal";
import type { Habit } from "../../types/habit";
import type { Goal } from "../../types/goal";
import type { AIProposal } from "./types";
import { detectImportantMemories, detectJournalActivities, detectJournalMood, extractJournalEventCandidates, extractJournalTaskCandidates, matchJournalGoals, matchJournalHabits, journalTaskAlreadyExists } from "../journal";

export interface JournalAssistantInput {
  entry: JournalEntry;
  action:
    | "summarize"
    | "improve_writing"
    | "extract_highlights"
    | "extract_tasks"
    | "extract_goals"
    | "detect_mood"
    | "reflect"
    | "tomorrow"
    | "create_memory";
}

export interface JournalAssistantResult {
  action: JournalAssistantInput["action"];
  message: string;
  proposals: AIProposal[];
  suggestions: Array<{ label: string; detail: string }>;
  summary?: string;
  improvedBody?: string;
  highlights?: string[];
  mood?: string | null;
  questions?: string[];
  activities?: string[];
  habits?: Array<{ habitId: ID; title: string; phrase: string }>;
  goals?: Array<{ goalId: ID; title: string }>;
  memory?: boolean;
}

function proposal(
  capability: AIProposal["capability"],
  title: string,
  summary: string,
  payload: Record<string, unknown>,
  refs: AIProposal["refs"] = [],
): AIProposal {
  return {
    capability,
    title,
    summary,
    risk: "low",
    requiresConfirmation: true,
    preview: [{ label: title, detail: summary }],
    refs,
    payload,
    reasoning: summary,
  };
}

function journalRefs(entryId: ID): AIProposal["refs"] {
  return [{ entityType: "journal_entry", entityId: entryId }];
}

export function runJournalAssistant(
  input: JournalAssistantInput,
  state: AppState,
  now: Timestamp = Date.now(),
): JournalAssistantResult {
  const { entry, action } = input;
  const text = `${entry.title} ${entry.body} ${entry.highlights.join(" ")} ${entry.challenges.join(" ")}`;

  switch (action) {
    case "summarize": {
      const sentences = entry.body
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
      const summary = sentences.slice(0, 3).join(" ");
      return {
        action,
        message: summary.length > 0 ? `Summary: ${summary}` : "This entry is still short — add a few words and I can summarise it.",
        proposals: [],
        suggestions: [],
        summary: summary || undefined,
      };
    }

    case "improve_writing": {
      const improved = improveWriting(entry.body);
      return {
        action,
        message:
          improved === entry.body
            ? "The writing already reads cleanly."
            : "I tidied the grammar and flow. Nothing else changed — review it before saving.",
        proposals: [
          proposal(
            "journal_summarize",
            "Apply improved writing",
            "Replaces the entry body with the tidied version.",
            { kind: "journal_update", entryId: entry.id, patch: { body: improved } },
            journalRefs(entry.id),
          ),
        ],
        suggestions: [],
        improvedBody: improved,
      };
    }

    case "extract_highlights": {
      const highlights = extractHighlights(entry);
      if (highlights.length === 0) {
        return {
          action,
          message: "I could not find clear achievements or experiences in this entry yet.",
          proposals: [],
          suggestions: [],
        };
      }
      return {
        action,
        message: `${highlights.length} highlight${highlights.length === 1 ? "" : "s"} identified.`,
        proposals: [
          proposal(
            "journal_summarize",
            "Add highlights",
            "Adds the identified highlights to this entry.",
            { kind: "journal_update", entryId: entry.id, patch: { highlights: [...entry.highlights, ...highlights] } },
            journalRefs(entry.id),
          ),
        ],
        suggestions: highlights.map((highlight) => ({ label: highlight, detail: "Recorded highlight" })),
        highlights,
      };
    }

    case "extract_tasks": {
      const candidates = extractJournalTaskCandidates(text, {
        goals: Object.values(state.goals),
        projects: Object.values(state.projects).map((project) => ({ id: project.id, name: project.name })),
        now,
      }).filter((candidate) => !journalTaskAlreadyExists(candidate, Object.values(state.tasks).map((task) => task.title)));

      if (candidates.length === 0) {
        return {
          action,
          message: "No new tasks found — anything already on your list is left alone.",
          proposals: [],
          suggestions: [],
        };
      }
      return {
        action,
        message: `${candidates.length} task${candidates.length === 1 ? "" : "s"} identified. Each needs your confirmation.`,
        proposals: candidates.map((candidate) =>
          proposal(
            "journal_extract_tasks",
            candidate.title,
            createTaskSummary(candidate),
            {
              kind: "journal_create_task",
              entryId: entry.id,
              task: {
                title: candidate.title,
                notes: `From your journal entry on ${new Date(entry.entryDate).toLocaleDateString()}.`,
                dueAt: candidate.dueAt,
                scheduledAt: candidate.scheduledAt,
                priority: candidate.priority,
                estimateMin: candidate.estimateMin,
                projectId: candidate.projectId,
                goalIds: candidate.goalIds,
                source: "manual",
              } satisfies NewTaskInput,
            },
            journalRefs(entry.id),
          ),
        ),
        suggestions: candidates.map((candidate) => ({
          label: candidate.title,
          detail: createTaskSummary(candidate),
        })),
      };
    }

    case "extract_goals": {
      const goals = matchJournalGoals(text, Object.values(state.goals));
      if (goals.length === 0) {
        return { action, message: "No goal links identified yet.", proposals: [], suggestions: [] };
      }
      return {
        action,
        message: `${goals.length} goal contribution${goals.length === 1 ? "" : "s"} identified.`,
        proposals: goals.map((goal) =>
          proposal(
            "journal_extract_goals",
            `${goal.title}`,
            `Links this entry as goal contribution.`,
            { kind: "journal_link_goal", entryId: entry.id, goalId: goal.goalId },
            journalRefs(entry.id),
          ),
        ),
        suggestions: goals.map((goal) => ({ label: goal.title, detail: "Goal contribution" })),
        goals: goals.map((goal) => ({ goalId: goal.goalId, title: goal.title })),
      };
    }

    case "detect_mood": {
      const mood = detectJournalMood(text);
      return {
        action,
        message: mood
          ? `The writing suggests a ${mood} mood. Confirm before I record it.`
          : "I could not infer a mood from this entry — that is fine, nothing was recorded.",
        proposals: mood
          ? [
              proposal(
                "journal_detect_mood",
                `Record mood: ${mood}`,
                "Sets the mood on this entry. Nothing is saved until you confirm.",
                { kind: "journal_update", entryId: entry.id, patch: { mood } },
                journalRefs(entry.id),
              ),
            ]
          : [],
        suggestions: [],
        mood,
      };
    }

    case "reflect": {
      const questions = buildReflectionQuestions(entry);
      return {
        action,
        message: questions[0] ?? "What mattered most in today's entry?",
        proposals: [],
        suggestions: questions.map((question) => ({ label: "Reflect", detail: question })),
        questions,
      };
    }

    case "tomorrow": {
      const unfinished = findUnfinishedItems(entry, state);
      const priorities = unfinished.tasks.map((task) => task.title);
      const habits = Object.values(state.habits)
        .filter((habit) => !habit.archived)
        .slice(0, 3)
        .map((habit) => habit.title);
      return {
        action,
        message:
          unfinished.tasks.length > 0
            ? `${unfinished.tasks.length} unfinished item${unfinished.tasks.length === 1 ? "" : "s"} would carry into tomorrow: ${unfinished.tasks.map((task) => task.title).join(", ")}.`
            : "Nothing outstanding from this entry — tomorrow is a clean page.",
        proposals: [
          proposal(
            "journal_tomorrow",
            "Add tomorrow's priorities",
            "Adds the suggested priorities to this entry's tomorrow plan.",
            { kind: "journal_update", entryId: entry.id, patch: { tomorrow: { ...entry.tomorrow, priorities: [...entry.tomorrow.priorities, ...priorities] } } },
            journalRefs(entry.id),
          ),
        ],
        suggestions: [
          ...priorities.map((title) => ({ label: title, detail: "Suggested priority" })),
          ...habits.map((title) => ({ label: title, detail: "Suggested habit" })),
        ],
      };
    }

    case "create_memory": {
      const memories = detectImportantMemories(entry);
      if (memories.length === 0) {
        return {
          action,
          message: "Nothing in this entry stands out as a life memory yet.",
          proposals: [],
          suggestions: [],
          memory: false,
        };
      }
      const output: NewLifeMemoryItemInput = {
        title: entry.title.trim().length > 0 ? entry.title.trim() : memories[0]!.label,
        description: entry.body.trim().slice(0, 500),
        category: "other",
        tags: entry.tags,
        notes: `Captured from your journal entry on ${new Date(entry.entryDate).toLocaleDateString()}.`,
      };
      return {
        action,
        message: `This looks worth remembering (${memories.map((memory) => memory.label).join(", ")}). Create the memory?`,
        proposals: [
          proposal(
            "journal_summarize",
            "Create Life Memory",
            "Creates a Life Memory that references this journal entry.",
            { kind: "journal_create_memory", entryId: entry.id, memory: output },
            journalRefs(entry.id),
          ),
        ],
        suggestions: memories.map((memory) => ({ label: memory.label, detail: memory.reason })),
        memory: true,
      };
    }
  }
}

function createTaskSummary(candidate: {
  title: string;
  dueAt: Timestamp | null;
  priority: number;
  estimateMin: number | null;
}): string {
  const parts: string[] = [];
  if (candidate.dueAt != null) parts.push(`due ${new Date(candidate.dueAt).toLocaleDateString()}`);
  if (candidate.priority >= 3) parts.push(`priority ${candidate.priority}`);
  if (candidate.estimateMin != null) parts.push(`estimate ${candidate.estimateMin}m`);
  return parts.length > 0 ? parts.join(" · ") : "No due date or estimate suggested";
}

function extractHighlights(entry: JournalEntry): string[] {
  const candidates: string[] = [];
  const sentences = entry.body.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (/\b(finished|completed|shipped|published|launched|passed|promoted|achieved|won|scored|fixed|resolved|solved)\b/i.test(sentence)) {
      candidates.push(sentence.length > 120 ? `${sentence.slice(0, 119)}…` : sentence);
    }
  }
  return candidates.filter((candidate) => !entry.highlights.includes(candidate)).slice(0, 4);
}

function improveWriting(body: string): string {
  const sentences = body
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const improved = sentences
    .map((sentence) => {
      let text = sentence
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\bi\b/g, "I")
        .replace(/\bdont\b/gi, "don't")
        .replace(/\bcant\b/gi, "can't")
        .replace(/\bwont\b/gi, "won't")
        .replace(/\b(alot|a lot of)\b/gi, "a lot of")
        .replace(/\b(teh|hte|adn)\b/gi, (match) => (match.toLowerCase() === "teh" ? "the" : match.toLowerCase() === "hte" ? "the" : "and"))
        .replace(/\s{2,}/g, " ")
        .trim();
      if (text.length > 0 && !/[.!?]$/.test(text)) text = `${text}.`;
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(" ");

  return improved;
}

function buildReflectionQuestions(entry: JournalEntry): string[] {
  const text = `${entry.body} ${entry.challenges.join(" ")}`;
  const mood = entry.mood ?? detectJournalMood(text);
  const questions: string[] = [];
  if (mood === "stressed" || entry.challenges.length > 0) {
    questions.push("You mentioned feeling stressed today. Would you like to reflect on what caused it?");
  }
  if (mood === "happy" || mood === "excited") {
    questions.push("What made today feel good, and could you repeat it?");
  }
  if (entry.challenges.length > 0) {
    questions.push("What would make that challenge easier next time?");
  }
  if (entry.gratitude.length > 0) {
    questions.push("Who else deserves a moment of thanks from today?");
  }
  questions.push("What mattered most in today's entry?");
  return questions.slice(0, 3);
}

function findUnfinishedItems(
  entry: JournalEntry,
  state: AppState,
): { tasks: Task[]; events: CalendarEvent[] } {
  const tasks = entry.taskIds
    .map((taskId) => state.tasks[taskId])
    .filter((task): task is Task => task != null && task.status !== "done" && task.status !== "cancelled");
  const events = entry.eventIds
    .map((eventId) => state.events[eventId])
    .filter((event): event is CalendarEvent => event != null);
  return { tasks, events };
}

export interface JournalApplyContext {
  addTask(input: NewTaskInput, now?: Timestamp): Task;
  updateEntry(entryId: ID, patch: Partial<JournalEntry>): JournalEntry | null;
  addEvent(input: NewEventInput, now?: Timestamp): CalendarEvent;
  addLifeMemoryItem(input: NewLifeMemoryItemInput, now?: Timestamp): LifeMemoryItem;
  linkJournalToTask(entryId: ID, taskId: ID): void;
  linkJournalToEvent(entryId: ID, eventId: ID): void;
  linkJournalToGoal(entryId: ID, goalId: ID): void;
  linkJournalToLifeMemory(entryId: ID, memoryId: ID): void;
}

export function applyJournalProposal(
  context: JournalApplyContext,
  proposal: AIProposal,
  now: Timestamp = Date.now(),
): { ok: boolean; message: string; created: Array<{ type: string; id: ID; title: string }> } {
  const payload = proposal.payload;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const entryId = String(payload.entryId ?? "");
  const created: Array<{ type: string; id: ID; title: string }> = [];

  if (!entryId) return { ok: false, message: "This proposal is missing its journal entry.", created };

  switch (kind) {
    case "journal_update": {
      const patch = (payload.patch ?? {}) as Partial<JournalEntry>;
      context.updateEntry(entryId, patch);
      return { ok: true, message: "Entry updated.", created };
    }
    case "journal_create_task": {
      const taskInput = (payload.task ?? {}) as NewTaskInput;
      const task = context.addTask(taskInput, now);
      context.linkJournalToTask(entryId, task.id);
      created.push({ type: "task", id: task.id, title: task.title });
      return { ok: true, message: `Task created: ${task.title}`, created };
    }
    case "journal_create_event": {
      const eventInput = (payload.event ?? {}) as NewEventInput;
      const event = context.addEvent(eventInput, now);
      context.linkJournalToEvent(entryId, event.id);
      created.push({ type: "event", id: event.id, title: event.title });
      return { ok: true, message: `Event created: ${event.title}`, created };
    }
    case "journal_create_memory": {
      const memoryInput = (payload.memory ?? {}) as NewLifeMemoryItemInput;
      const memory = context.addLifeMemoryItem(memoryInput, now);
      context.linkJournalToLifeMemory(entryId, memory.id);
      created.push({ type: "life_memory", id: memory.id, title: memory.title });
      return { ok: true, message: `Life memory created: ${memory.title}`, created };
    }
    case "journal_link_goal": {
      const goalId = String(payload.goalId);
      context.linkJournalToGoal(entryId, goalId);
      return { ok: true, message: "Goal linked to this entry.", created };
    }
    default:
      return { ok: false, message: "This proposal is not supported.", created };
  }
}

export function journalHabitSuggestions(
  entry: JournalEntry,
  habits: Habit[],
): Array<{ habitId: ID; title: string; phrase: string; confidence: number }> {
  const text = `${entry.body} ${entry.highlights.join(" ")}`;
  return matchJournalHabits(text, habits).map((match) => ({
    habitId: match.habitId,
    title: match.title,
    phrase: match.phrase,
    confidence: match.confidence,
  }));
}

export function journalGoalSuggestions(entry: JournalEntry, goals: Goal[]): Array<{ goalId: ID; title: string; confidence: number }> {
  const text = `${entry.body} ${entry.highlights.join(" ")}`;
  return matchJournalGoals(text, goals).map((match) => ({
    goalId: match.goalId,
    title: match.title,
    confidence: match.confidence,
  }));
}

export function journalEventSuggestions(entry: JournalEntry, now: Timestamp = Date.now()) {
  return extractJournalEventCandidates(`${entry.body} ${entry.tomorrow.priorities.join(" ")}`, { now });
}

export function journalActivitySuggestions(entry: JournalEntry): string[] {
  return detectJournalActivities(`${entry.body} ${entry.highlights.join(" ")}`);
}

export function journalTaskSuggestions(entry: JournalEntry, state: AppState, now: Timestamp = Date.now()) {
  return extractJournalTaskCandidates(`${entry.body} ${entry.tomorrow.priorities.join(" ")}`, {
    goals: Object.values(state.goals),
    projects: Object.values(state.projects).map((project) => ({ id: project.id, name: project.name })),
    now,
  });
}
