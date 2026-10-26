import { parseCapture, type CaptureParseResult } from "../capture-parser";
import type { AICapability, AiIntent } from "./types";
import { extractEntities, type ExtractedEntity } from "../knowledge/tagging";

interface IntentRule {
  capability: AICapability;
  patterns: RegExp[];
  reason: string;
  weight?: number;
}

const RULES: IntentRule[] = [
  {
    capability: "life_memory",
    patterns: [
      /when did i (last )?/i,
      /when was the last time i/i,
      /when did we (last )?/i,
      /how long (ago|since) (did|have) i/i,
      /did i (ever )?(service|clean|change|replace|check|wash|water|fertilize|test|inspect)/i,
      /have i (ever )?(serviced|cleaned|changed|replaced|checked)/i,
      /last time i/i,
      /life memory/i,
    ],
    reason: "asked about a Life Memory",
    weight: 15,
  },
  {
    capability: "log_life_event",
    patterns: [
      /^(log|record|remember|note|track)\s+(that\s+)?i\s+/i,
      /^i\s+(just\s+)?(serviced|cleaned|changed|replaced|checked|washed|watered|fertilized|tested|inspected)\b/i,
      /^(did|done|completed)\s+(the\s+)?[a-z]/i,
      /^(changed|replaced|serviced|cleaned|washed|watered|fertilized|checked|tested|inspected)\s+(my|the)\b/i,
    ],
    reason: "asked to record a Life Memory completion",
    weight: 14,
  },
  {
    capability: "weekly_review",
    patterns: [/weekly review/i, /review my week/i, /how was my week/i, /week in review/i],
    reason: "asked for a weekly review",
    weight: 10,
  },
  {
    capability: "insights",
    patterns: [
      /productivity insight/i,
      /my insights/i,
      /how am i doing/i,
      /my stats/i,
      /completion rate/i,
      /analys(e|is) my (work|productivity|tasks)/i,
    ],
    reason: "asked for productivity insights",
    weight: 10,
  },
  {
    capability: "recommendations",
    patterns: [
      /what should i (do|work on|focus)/i,
      /recommend/i,
      /suggest/i,
      /next best/i,
      /what('s| is) most important/i,
    ],
    reason: "asked for recommendations",
    weight: 10,
  },
  {
    capability: "meeting_intelligence",
    patterns: [
      /meeting (notes|summary|intelligence|recap)/i,
      /action items from/i,
      /summari[sz]e (the|my) (meeting|call)/i,
      /what came out of/i,
    ],
    reason: "asked about meeting intelligence",
    weight: 10,
  },
  {
    capability: "optimize_schedule",
    patterns: [
      /optimi[sz]e (my )?(schedule|calendar|week|day)/i,
      /rebalance/i,
      /make (more )?room/i,
      /too (busy|packed|full)/i,
    ],
    reason: "asked to optimize the schedule",
    weight: 9,
  },
  {
    capability: "reschedule",
    patterns: [
      /reschedul/i,
      /move (my|the)? ?(tasks?| meetings?| blocks?)/i,
      /conflicts?/i,
      /too many conflicts/i,
      /push (it|them) out/i,
    ],
    reason: "asked to reschedule",
    weight: 9,
  },
  {
    capability: "plan_day",
    patterns: [
      /plan (my )?(day|today|tomorrow|morning|week)/i,
      /what should i (do )?today/i,
      /help me plan/i,
      /schedule my tasks?/i,
      /time ?block/i,
    ],
    reason: "asked for a plan",
    weight: 9,
  },
  {
    capability: "decompose_goal",
    patterns: [
      /break (down|up) (my )?goal/i,
      /decompose (my )?goal/i,
      /plan (my )?goal/i,
      /milestones? for/i,
      /how do i (achieve|reach|hit)/i,
    ],
    reason: "asked to decompose a goal",
    weight: 12,
  },
  {
    capability: "decompose_task",
    patterns: [
      /\bbreak\s+(down|up)\b/i,
      /\bbreak\s+this\s+down\b/i,
      /decompose (this |the |my )?task/i,
      /split (this|the|it)/i,
      /subtasks? for/i,
      /what are the steps/i,
    ],
    reason: "asked to decompose a task",
    weight: 8,
  },
  {
    capability: "estimate_task",
    patterns: [
      /how long (will|would|should)/i,
      /estimate (this|the|my)? ?(task|time)/i,
      /time estimate/i,
      /estimate for/i,
    ],
    reason: "asked for a time estimate",
    weight: 8,
  },
  {
    capability: "answer_question",
    patterns: [
      /what did i write about/i,
      /what did i say about/i,
      /what have i (written|noted|said)/i,
      /when did i/i,
      /did i (write|note|say|mention)/i,
      /find (my )?notes? (about|on|for)/i,
    ],
    reason: "asked a question about their own knowledge",
    weight: 8,
  },
  {
    capability: "summarize_note",
    patterns: [
      /summari[sz]e (this |the |my )?note/i,
      /tldr/i,
      /summari[sz]e (this|the) /i,
      /key points (from|of)/i,
    ],
    reason: "asked to summarize a note",
    weight: 8,
  },
  {
    capability: "semantic_search",
    patterns: [
      /search (my )?notes? (for|about|on)/i,
      /find (notes?|anything|something) (about|on|i wrote)/i,
      /look up/i,
      /search for/i,
    ],
    reason: "asked to search knowledge",
    weight: 7,
  },
  {
    capability: "create_note",
    patterns: [/^note:/i, /write (a|me a) note/i, /jot (this )?down/i, /take a note/i, /record a thought/i],
    reason: "asked to create a note",
    weight: 6,
  },
  {
    capability: "create_task",
    patterns: [
      /^(add|create|new) (a )?task/i,
      /remind me to/i,
      /^todo:?/i,
      /i need to/i,
      /i have to/i,
      /i should/i,
    ],
    reason: "asked to create a task",
    weight: 6,
  },
];

export function parseIntent(
  input: string,
  options: { now?: number } = {},
): AiIntent {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const now = options.now ?? Date.now();

  let best: IntentRule | null = null;
  let bestScore = 0;

  for (const rule of RULES) {
    let score = rule.weight ?? 5;
    let matched = false;
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;
    if (trimmed.length > 0) score += Math.min(3, trimmed.split(/\s+/).length / 20);
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  const capture: CaptureParseResult = parseCapture(trimmed, { now });
  const entities: ExtractedEntity[] = extractEntities(trimmed);

  const slots: Record<string, string> = {};
  if (capture.title) slots.title = stripCommandPrefix(capture.title);
  if (capture.dueAt != null) slots.dueAt = String(capture.dueAt);
  if (capture.durationMin != null) slots.durationMin = String(capture.durationMin);
  if (capture.priority > 0) slots.priority = String(capture.priority);
  if (capture.tags.length > 0) slots.tags = capture.tags.join(",");
  if (capture.hasExplicitTime) slots.hasExplicitTime = "true";

  const targetNames = entities
    .filter((e) => e.type === "hashtag" || e.type === "mention")
    .map((e) => e.value.replace(/^[#@]/, ""));
  if (targetNames.length > 0) slots.targets = targetNames.join(",");

  const fallbackKeywords = lower
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 6)
    .join(" ");

  if (!best) {
    const isQuestion = /\?\s*$/.test(trimmed) || /^(what|which|who|when|where|why|how|do|does|did|is|are|am|can|could|should|will|would|show|list|tell)\b/i.test(trimmed);
    const asTask = capture.title.length > 0 && !isQuestion;
    return {
      capability: asTask ? "create_task" : "answer_question",
      confidence: asTask ? 0.55 : 0.3,
      slots: asTask ? slots : { query: fallbackKeywords || trimmed },
      targets: [],
      raw: trimmed,
      reason:
        capture.title.length > 0
          ? "no explicit command matched; treated as a task request"
          : "no explicit command matched; treated as a question",
    };
  }

  const needsQuery =
    best.capability === "semantic_search" ||
    best.capability === "answer_question" ||
    best.capability === "summarize_note";
  if (needsQuery && !slots.query) {
    const cleaned = stripIntentWords(trimmed);
    slots.query = cleaned || fallbackKeywords || trimmed;
  }

  if (best.capability === "create_note" && !slots.title) {
    slots.title = cleanedNoteTitle(trimmed);
  }

  const confidence = Math.min(0.98, 0.6 + (best.weight ?? 5) / 30);

  return {
    capability: best.capability,
    confidence,
    slots,
    targets: [],
    raw: trimmed,
    reason: best.reason,
  };
}

function stripCommandPrefix(text: string): string {
  return text
    .replace(/^(add|create|new)\s+(a\s+)?(task|to-?do)\s*[:\-]\s*/i, "")
    .replace(/^(todo|to-?do)\s*[:\-]\s*/i, "")
    .replace(/^(remind me to|i need to|i have to|i should)\s+/i, "")
    .replace(/^(break|decompose|split)\s+(down|up|this|the|my|that|it)\s+(task|work|item)\s*/i, "")
    .trim();
}

function stripIntentWords(text: string): string {
  let out = text;
  const remove = [
    /^(hey|hi|ok|okay|please|can you|could you|would you)\b[,\s]*/i,
    /^(what|when|where|who|how)\b\s*/i,
    /\b(summar(i|s)e|find|search|look ?up|tell me|show me|about|from|for|my|the|did|i|write|wrote|note|notes|say|said)\b/gi,
  ];
  for (const pattern of remove) out = out.replace(pattern, " ");
  return out.replace(/\s+/g, " ").trim();
}

function cleanedNoteTitle(text: string): string {
  return text
    .replace(/^note:\s*/i, "")
    .replace(/^(write|take|make|jot down)\s+(a|me a)?\s*(note|thought)?\s*/i, "")
    .replace(/^that\s+/i, "")
    .trim();
}

export function isVoiceCommand(input: string): boolean {
  return /^\s*(hey\s+(personalos|assistant|os)|ok\s+(os|personalos)|voice)/i.test(input);
}

export function parseVoiceCommand(input: string, options: { now?: number } = {}): AiIntent {
  const cleaned = input
    .replace(/^\s*(hey\s+(personalos|assistant|os)|ok\s+(os|personalos)|voice)\s*[:,]?\s*/i, "")
    .trim();
  const intent = parseIntent(cleaned, options);
  return {
    ...intent,
    reason: `voice command parsed: ${intent.reason}`,
  };
}