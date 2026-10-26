import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Task } from "../../types/task";
import type { Note } from "../../types/note";
import type { Goal } from "../../types/goal";
import type { Meeting } from "../../types/knowledge";
import type { Transcript } from "../../types/knowledge";
import type { EntityType } from "../../types/common";
import type { AIProposal, AIResult, AiIntent } from "./types";
import { buildAIContext, contextSummary } from "./context";
import { parseIntent, parseVoiceCommand, isVoiceCommand } from "./intents";
import { decomposeTaskResult, estimateTask } from "./tasks";
import { decomposeGoalResult } from "./goals";
import { planDayResult, optimizeScheduleResult, rescheduleResult } from "./scheduling";
import { summarizeNoteResult, semanticSearchResult, answerQuestion } from "./notes";
import { weeklyReviewResult } from "./review";
import { insightsResult, recommendationsResult } from "./insights";
import { meetingIntelligenceResult, meetingsNeedingIntelligence } from "./meetings";
import { answerWhenDidI, computeLifeStats, parseLifeEvent } from "../life-memory/engine";
import { answerWhenDidIResult, matchLifeMemoryItem } from "./life";
import { canUserRead } from "./access";
import { formatMinutes } from "./format";
import { parseCapture } from "../capture-parser";

export interface AssistantExecutor {
  getState(): AppState;
}

interface ResolvedTargets {
  task: Task | null;
  note: Note | null;
  goal: Goal | null;
  meeting: Meeting | null;
  transcript: Transcript | null;
}

function scoreMatch(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.85;
  const qWords = new Set(q.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const tWords = new Set(t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  if (qWords.size === 0 || tWords.size === 0) return 0;
  let shared = 0;
  for (const word of qWords) if (tWords.has(word)) shared += 1;
  return (shared / Math.min(qWords.size, tWords.size)) * 0.7;
}

function resolveTargets(state: AppState, intent: AiIntent): ResolvedTargets {
  const query =
    (intent.slots.query as string | undefined) ??
    (intent.slots.title as string | undefined) ??
    (intent.slots.targets as string | undefined) ??
    intent.raw;

  const pick = <T extends { id: ID; title: string; ownerId?: string | null }>(
    collection: Record<string, T>,
  ): T | null => {
    let best: T | null = null;
    let bestScore = 0;
    for (const item of Object.values(collection)) {
      if (!canUserRead(state, item)) continue;
      const score = scoreMatch(query, item.title);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return bestScore >= 0.4 ? best : null;
  };

  return {
    task: pick(state.tasks),
    note: pick(state.notes),
    goal: pick(state.goals),
    meeting: pick(state.meetings),
    transcript: pick(state.transcripts),
  };
}

function entityTypeOf(type: string): EntityType {
  return type as EntityType;
}

export function runAssistant(
  executor: AssistantExecutor,
  request: { input: string; now?: Timestamp; voice?: boolean },
): AIResult {
  const now = request.now ?? Date.now();
  const state = executor.getState();
  const context = buildAIContext(state, now);

  const { input } = request;
  if (!input.trim()) {
    return {
      kind: "error",
      message: "Tell me what you need — for example \"plan my day\" or \"what did I write about the launch?\".",
      capability: "answer_question",
      citations: [],
      proposals: [],
      access: context.access,
      contextCounts: context.counts,
    };
  }

  const intent = request.voice || isVoiceCommand(input) ? parseVoiceCommand(input, { now }) : parseIntent(input, { now });
  const targets = resolveTargets(state, intent);

  let result: AIResult;

  switch (intent.capability) {
    case "create_task": {
      const parsed = parseCapture(input, { now });
      const title =
        stripCommandPrefix(parsed.title || intent.slots.title || input.trim());
      const proposals: AIProposal[] = [
        {
          capability: "create_task",
          title: `Create task "${title}"`,
          summary: parsed.dueAt != null ? `Due ${new Date(parsed.dueAt).toLocaleDateString()}` : "Goes to your inbox once you accept",
          risk: "low",
          requiresConfirmation: true,
          reasoning: parsed.dueAt != null ? "A date was parsed from your request." : "No date was found, so it lands in the inbox.",
          preview: [
            { label: title, detail: [parsed.durationMin != null ? `${parsed.durationMin} min` : null, parsed.priority > 0 ? `priority ${parsed.priority}` : null].filter(Boolean).join(" · ") || undefined },
            ...parsed.tags.map((tag) => ({ label: `#${tag}` })),
          ],
          refs: [],
          payload: {
            kind: "create_task",
            input: {
              title,
              status: parsed.dueAt == null ? "inbox" : "open",
              goalIds: [],
              ...(parsed.dueAt != null ? { dueAt: parsed.dueAt } : {}),
              ...(parsed.durationMin != null ? { durationMin: parsed.durationMin } : {}),
              ...(parsed.priority > 0 ? { priority: parsed.priority } : {}),
              ...(parsed.tags.length > 0 ? { tags: parsed.tags } : {}),
            },
          },
        },
      ];
      result = {
        kind: "proposal",
        message: `I will create "${title}". Confirm and it lands in ${parsed.dueAt == null ? "your inbox" : "your day"}.`,
        capability: "create_task",
        citations: [],
        proposals,
        access: context.access,
        contextCounts: context.counts,
      };
      break;
    }

    case "create_note": {
      const title = (intent.slots.title as string | undefined)?.trim() || "New note";
      const proposals: AIProposal[] = [
        {
          capability: "create_note",
          title: `Create note "${title}"`,
          summary: "Notes are searchable immediately.",
          risk: "low",
          requiresConfirmation: true,
          reasoning: "Captured from your request.",
          preview: [{ label: title, detail: "new note" }],
          refs: [],
          payload: {
            kind: "create_note",
            input: { title, body: "", status: "active" },
          },
        },
      ];
      result = {
        kind: "proposal",
        message: `I will create a note called "${title}".`,
        capability: "create_note",
        citations: [],
        proposals,
        access: context.access,
        contextCounts: context.counts,
      };
      break;
    }

    case "decompose_task": {
      if (!targets.task) {
        result = missingTarget("which task", context);
        break;
      }
      result = decomposeTaskResult(state, targets.task, now);
      break;
    }

    case "estimate_task": {
      if (!targets.task) {
        result = missingTarget("which task", context);
        break;
      }
      const estimate = estimateTask(state, targets.task, now);
      result = {
        kind: "answer",
        message: `"${targets.task.title}" should take about ${formatMinutes(estimate.estimateMin)} — ${estimate.note}.`,
        capability: "estimate_task",
        citations: [
          { entityType: entityTypeOf("task"), entityId: targets.task.id, title: targets.task.title, quote: estimate.note },
        ],
        proposals: [],
        data: estimate,
        access: context.access,
        contextCounts: context.counts,
      };
      break;
    }

    case "decompose_goal": {
      if (!targets.goal) {
        result = missingTarget("which goal", context);
        break;
      }
      result = decomposeGoalResult(state, targets.goal, now);
      break;
    }

    case "plan_day": {
      const windows = context.windows;
      const wantsWeek = /week/i.test(input) || /next 7/i.test(input);
      result = planDayResult(state, wantsWeek ? windows.week.from : windows.today.from, wantsWeek ? windows.week.to : windows.today.to, now);
      break;
    }

    case "optimize_schedule": {
      const windows = context.windows;
      const wantsWeek = /week/i.test(input);
      result = optimizeScheduleResult(state, wantsWeek ? windows.week.from : windows.today.from, wantsWeek ? windows.week.to : windows.today.to, now);
      break;
    }

    case "reschedule": {
      const windows = context.windows;
      const wantsWeek = /week/i.test(input);
      result = rescheduleResult(state, wantsWeek ? windows.week.from : windows.today.from, wantsWeek ? windows.week.to : windows.today.to, now);
      break;
    }

    case "summarize_note": {
      if (!targets.note) {
        result = missingTarget("which note", context);
        break;
      }
      result = summarizeNoteResult(state, targets.note);
      break;
    }

    case "semantic_search": {
      const query = (intent.slots.query as string | undefined) ?? input;
      result = semanticSearchResult(state, query);
      break;
    }

    case "answer_question": {
      const query = (intent.slots.query as string | undefined) ?? input;
      result = /\b(tasks?|to-?dos?)\b/i.test(input)
        ? openTasksAnswer(state, context)
        : answerQuestion(state, query, now);
      break;
    }

    case "weekly_review": {
      result = weeklyReviewResult(state, now);
      break;
    }

    case "insights": {
      result = insightsResult(state, now);
      break;
    }

    case "recommendations": {
      result = recommendationsResult(state, now);
      break;
    }

    case "meeting_intelligence": {
      const pending = meetingsNeedingIntelligence(state, now);
      const target = pending.find((entry) => entry.transcript.id === targets.transcript?.id) ?? pending[0];
      if (!target) {
        result = {
          kind: "answer",
          message: "There are no transcripts ready to analyse yet.",
          capability: "meeting_intelligence",
          citations: [],
          proposals: [],
          access: context.access,
          contextCounts: context.counts,
        };
        break;
      }
      result = meetingIntelligenceResult(state, target.transcript.id, now);
      break;
    }

    case "life_memory": {
      result = answerWhenDidIResult(state, input, now);
      break;
    }

    case "log_life_event": {
      const parsed = parseLifeEvent(input, now);
      const existing = matchLifeMemoryItem(state, parsed.title);
      if (existing) {
        result = {
          kind: "proposal",
          message: `I will record a completion for "${existing.title}" and recalculate its interval.`,
          capability: "log_life_event",
          citations: [
            {
              entityType: entityTypeOf("life_memory_item"),
              entityId: existing.id,
              title: existing.title,
              quote: `recorded ${computeLifeStats(existing, now).completionCount} times`,
            },
          ],
          proposals: [
            {
              capability: "log_life_event",
              title: `Record completion for "${existing.title}"`,
              summary: parsed.dateText ? `Backdated to ${parsed.dateText}.` : "Backdated to today.",
              risk: "low",
              requiresConfirmation: true,
              reasoning:
                "The completion is added to history, which recalculates the average interval and the expected next date.",
              preview: [
                { label: existing.title, detail: parsed.dateText ?? "today" },
                ...(parsed.note ? [{ label: "Note", detail: parsed.note.slice(0, 160) }] : []),
              ],
              refs: [{ entityType: entityTypeOf("life_memory_item"), entityId: existing.id }],
              payload: {
                kind: "life_memory_completion",
                itemId: existing.id,
                completedAt: parsed.completedAt ?? now,
                note: parsed.note,
              },
            },
          ],
          data: { itemId: existing.id, completedAt: parsed.completedAt ?? now },
          access: context.access,
          contextCounts: context.counts,
        };
        break;
      }

      result = {
        kind: "proposal",
        message: `"${parsed.title}" is not tracked yet. I will create it and record the first completion.`,
        capability: "log_life_event",
        citations: [],
        proposals: [
          {
            capability: "log_life_event",
            title: `Track "${parsed.title}" and record today's completion`,
            summary: "A new Life Memory with one completion in its history.",
            risk: "low",
            requiresConfirmation: true,
            reasoning: "New memories start with an interval forecast once a second completion is recorded.",
            preview: [
              { label: parsed.title, detail: parsed.dateText ?? "today" },
              { label: "Category", detail: "Other (changeable later)" },
            ],
            refs: [],
            payload: {
              kind: "life_memory_create",
              title: parsed.title,
              completedAt: parsed.completedAt ?? now,
              note: parsed.note,
            },
          },
        ],
        access: context.access,
        contextCounts: context.counts,
      };
      break;
    }

    default: {
      result = {
        kind: "answer",
        message: `I understood "${intent.capability}" but cannot run it yet. (${contextSummary(context)})`,
        capability: intent.capability,
        citations: [],
        proposals: [],
        access: context.access,
        contextCounts: context.counts,
      };
    }
  }

  if (context.deniedCount > 0) {
    result = {
      ...result,
      message: `${result.message}\n\n(${context.deniedCount} item${context.deniedCount === 1 ? " was" : "s were"} skipped because you do not have access.)`,
    };
  }

  return result;
}

function stripCommandPrefix(text: string): string {
  return text
    .replace(/^(add|create|new)\s+(a\s+)?(task|to-?do)\s*[:\-]\s*/i, "")
    .replace(/^(todo|to-?do)\s*[:\-]\s*/i, "")
    .replace(/^(remind me to|i need to|i have to|i should)\s+/i, "")
    .trim();
}

function missingTarget(what: string, context: ReturnType<typeof buildAIContext>): AIResult {
  return {
    kind: "answer",
    message: `Tell me ${what} to work with, or mention it by name. (${contextSummary(context)})`,
    capability: "answer_question",
    citations: [],
    proposals: [],
    access: context.access,
    contextCounts: context.counts,
  };
}
function openTasksAnswer(state: AppState, context: { access: AIResult["access"]; counts: AIResult["contextCounts"] }): AIResult {
  const open = Object.values(state.tasks)
    .filter((task) => !["done", "cancelled", "archived"].includes(task.status))
    .sort((a, b) => b.priority - a.priority || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  const lines = open.slice(0, 10).map((task) => {
    const due = task.dueAt != null ? ` (due ${new Date(task.dueAt).toLocaleDateString()})` : "";
    return `- ${task.title}${due}`;
  });
  const message =
    open.length === 0
      ? "You have no open tasks right now."
      : `You have ${open.length} open task${open.length === 1 ? "" : "s"}:\n${lines.join("\n")}${open.length > 10 ? `\n…and ${open.length - 10} more.` : ""}`;
  return {
    kind: "answer",
    message,
    capability: "answer_question",
    citations: [],
    proposals: [],
    access: context.access,
    contextCounts: context.counts,
  };
}
