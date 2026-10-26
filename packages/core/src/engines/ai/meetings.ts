import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { Meeting, Transcript, TranscriptSegment } from "../../types";
import { extractEntities, type ExtractedEntity } from "../knowledge/tagging";
import type { AIProposal, AIResult, AICitation } from "./types";

export interface MeetingActionItem {
  title: string;
  transcriptId: ID;
  meetingId: ID | null;
  assigneeId: ID | null;
  dueAt: Timestamp | null;
  segmentIndex: number | null;
  confidence: number;
  source: string;
}

export interface MeetingAnalysis {
  transcriptId: ID;
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  speakers: Array<{ name: string; segments: number; words: number }>;
  entities: ExtractedEntity[];
  durationMin: number | null;
}

const ACTION_PATTERNS: RegExp[] = [
  /\b(i|we|you|they)?\s*(will|'ll|shall|should|need to|has to|have to|must)\s+[^.!?]{6,}/i,
  /\baction item\s*[:\-]/i,
  /\bfollow (up|through)\b[^.!?]{4,}/i,
  /\b(todo|to-do|next step|next steps)\s*[:\-]/i,
  /\b(let'?s|can you|could you|please)\s+[^.!?]{6,}/i,
  /\btake (care of|ownership of|the lead on)\b[^.!?]{4,}/i,
  /\bsend (me|us|them|the)\b[^.!?]{4,}/i,
  /\bschedule\b[^.!?]{6,}/i,
];

const DECISION_PATTERNS: RegExp[] = [
  /\bwe (decided|agreed|concluded|settled on|chose|picked)\b[^.!?]{3,}/i,
  /\bdecision\s*[:\-]\s*[^.!?]{3,}/i,
  /\bit'?s (decided|settled|agreed)\b/i,
  /\bwe (are|'re) going (with|to)\b[^.!?]{4,}/i,
  /\bfinal(ly)? (call|decision|answer)\b[^.!?]{0,}/i,
];

const FILLER = new Set([
  "yeah",
  "okay",
  "ok",
  "right",
  "so",
  "um",
  "uh",
  "hmm",
  "sure",
  "exactly",
  "mhm",
  "alright",
  "cool",
  "great",
  "thanks",
  "thank",
]);

function cleanLine(text: string): string {
  return text.replace(/\s+/g, " ").replace(/^[\s\-•*]+/, "").trim();
}

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2 && !FILLER.has(word));
}

function extractTitleFromSentence(sentence: string): string {
  let text = cleanLine(sentence);
  text = text.replace(
    /^(so|and|but|also|then|well|now|i think|i guess|basically|you know|like)\s+/i,
    "",
  );
  text = text.replace(/^(i|we|you|they)\s+(will|'ll|shall|should|need to|has to|have to|must)\s+/i, "");
  text = text.replace(/^(let'?s|please|can you|could you)\s+/i, "");
  text = text.replace(/\.$/, "");
  const words = text.split(" ");
  const clipped = words.slice(0, 12).join(" ");
  const value = clipped.charAt(0).toUpperCase() + clipped.slice(1);
  return value;
}

function findSpeakerRef(text: string): string | null {
  const match = text.match(/\b([A-Z][a-z]{2,})\s*(?:will|to|should|'ll)\b/);
  if (match) return match[1]!;
  const mention = text.match(/@([\p{L}\p{N}_]+)/u);
  return mention ? mention[1]! : null;
}

export function analyzeTranscript(transcript: Transcript, now: Timestamp = Date.now()): MeetingAnalysis {
  const segments = transcript.segments.length > 0
    ? transcript.segments
    : transcript.fullText
        .split(/\n+/)
        .map((line, index) => ({
          speaker: line.match(/^([A-Za-z ]{2,20}):/) ?.[1]?.trim() ?? "Unknown",
          startMs: index * 1000,
          endMs: index * 1000 + 1000,
          text: line,
        }))
        .filter((segment) => cleanLine(segment.text).length > 0);

  const actionItems: MeetingActionItem[] = [];
  const decisions: string[] = [];
  const speakerMap = new Map<string, { segments: number; words: number }>();
  const allText: string[] = [];

  segments.forEach((segment: TranscriptSegment, index: number) => {
    const text = cleanLine(segment.text);
    if (!text) return;

    const entry = speakerMap.get(segment.speaker) ?? { segments: 0, words: 0 };
    entry.segments += 1;
    entry.words += meaningfulWords(text).length;
    speakerMap.set(segment.speaker, entry);
    allText.push(text);

    for (const pattern of ACTION_PATTERNS) {
      if (pattern.test(text)) {
        actionItems.push({
          title: extractTitleFromSentence(text),
          transcriptId: transcript.id,
          meetingId: transcript.meetingId,
          assigneeId: null,
          dueAt: null,
          segmentIndex: index,
          confidence: 0.75,
          source: text.slice(0, 200),
        });
        break;
      }
    }

    for (const pattern of DECISION_PATTERNS) {
      if (pattern.test(text)) {
        decisions.push(text.slice(0, 300));
        break;
      }
    }
  });

  const keyPoints = rankKeyPoints(allText, 5);
  const entities = extractEntities(allText.join(" "));

  const durations = segments.map((segment) => segment.endMs - segment.startMs);
  const durationMin =
    segments.length > 0 ? Math.round(Math.max(...durations.map((end, i) => end + segments[i]!.startMs)) / 60000) : null;

  return {
    transcriptId: transcript.id,
    title: transcript.title,
    summary: keyPoints.slice(0, 2).join(" ") || "No content to summarize.",
    keyPoints,
    decisions: [...new Set(decisions)].slice(0, 8),
    actionItems: actionItems.slice(0, 20),
    speakers: [...speakerMap.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.words - a.words),
    entities,
    durationMin: durationMin && durationMin > 0 ? durationMin : null,
    answeredAt: now,
  } as MeetingAnalysis;
}

function rankKeyPoints(lines: string[], limit: number): string[] {
  const freq = new Map<string, number>();
  for (const line of lines) {
    for (const word of new Set(meaningfulWords(line))) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...freq.values());

  const scored = lines.map((line, index) => {
    const words = meaningfulWords(line);
    let score = 0;
    for (const word of words) score += (freq.get(word) ?? 0) / max;
    const lengthFactor = words.length < 4 ? 0.3 : words.length > 50 ? 0.8 : 1;
    return { line, score: (score / Math.max(5, words.length)) * lengthFactor, index };
  });

  return scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.line);
}

export function meetingIntelligenceResult(
  state: AppState,
  transcriptId: ID,
  now: Timestamp = Date.now(),
): AIResult {
  const transcript = state.transcripts[transcriptId];
  if (!transcript) {
    return {
      kind: "answer",
      message: "That transcript could not be found.",
      capability: "meeting_intelligence",
      citations: [],
      proposals: [],
    };
  }

  const analysis = analyzeTranscript(transcript, now);
  const proposals: AIProposal[] = [];

  if (analysis.actionItems.length > 0) {
    proposals.push({
      capability: "meeting_intelligence",
      title: `Create ${analysis.actionItems.length} task${analysis.actionItems.length === 1 ? "" : "s"} from this meeting`,
      summary: "Each detected action item becomes a task linked to the transcript.",
      risk: "medium",
      requiresConfirmation: true,
      reasoning: "Action items come from commitment language (\"I will\", \"we should\", \"can you\").",
      preview: analysis.actionItems.slice(0, 10).map((item) => ({
        label: item.title,
        detail: `confidence ${Math.round(item.confidence * 100)}%`,
      })),
      refs: [{ entityType: "transcript", entityId: transcript.id }],
      payload: {
        kind: "meeting_tasks",
        transcriptId: transcript.id,
        meetingId: transcript.meetingId,
        actionItems: analysis.actionItems,
      },
    });
  }

  const meeting = transcript.meetingId ? state.meetings[transcript.meetingId] : null;
  if (meeting) {
    proposals.push({
      capability: "meeting_intelligence",
      title: `Attach summary, decisions, and key points to "${meeting.title}"`,
      summary: "Fills the meeting's AI fields so the record is useful later.",
      risk: "low",
      requiresConfirmation: true,
      reasoning: "Meetings keep a summary, decisions, and key points you can re-read.",
      preview: [
        { label: "Summary", detail: analysis.summary.slice(0, 180) },
        ...analysis.decisions.slice(0, 4).map((decision) => ({ label: "Decision", detail: decision.slice(0, 180) })),
        ...analysis.keyPoints.slice(0, 3).map((point) => ({ label: "Key point", detail: point.slice(0, 180) })),
      ],
      refs: [{ entityType: "meeting", entityId: meeting.id }],
      payload: {
        kind: "meeting_summary",
        meetingId: meeting.id,
        transcriptId: transcript.id,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        decisions: analysis.decisions,
      },
    });
  }

  proposals.push({
    capability: "meeting_intelligence",
    title: "Process the transcript",
    summary: "Extracts summary, decisions, key points, speakers, and entities onto the transcript.",
    risk: "low",
    requiresConfirmation: true,
    reasoning: "Stored intelligence makes the transcript searchable and reusable.",
    preview: [
      { label: "Key points", detail: String(analysis.keyPoints.length) },
      { label: "Decisions", detail: String(analysis.decisions.length) },
      { label: "Speakers", detail: analysis.speakers.map((s) => s.name).join(", ") || "unknown" },
    ],
    refs: [{ entityType: "transcript", entityId: transcript.id }],
    payload: {
      kind: "transcript_processing",
      transcriptId: transcript.id,
      analysis,
    },
  });

  const citations: AICitation[] = [
    {
      entityType: "transcript",
      entityId: transcript.id,
      title: transcript.title,
      quote: analysis.summary.slice(0, 200),
    },
  ];
  if (meeting) {
    citations.push({
      entityType: "meeting",
      entityId: meeting.id,
      title: meeting.title,
      quote: "linked meeting record",
    });
  }

  const parts: string[] = [`${analysis.title} — ${analysis.speakers.length} speaker${analysis.speakers.length === 1 ? "" : "s"}`];
  if (analysis.durationMin != null) parts.push(`~${analysis.durationMin} min`);
  parts.push(`${analysis.actionItems.length} action item${analysis.actionItems.length === 1 ? "" : "s"}`);
  parts.push(`${analysis.decisions.length} decision${analysis.decisions.length === 1 ? "" : "s"}`);
  parts.push(`${analysis.keyPoints.length} key point${analysis.keyPoints.length === 1 ? "" : "s"}`);

  return {
    kind: "proposal",
    message: `${parts.join(" · ")}.\n\nSummary: ${analysis.summary}`,
    capability: "meeting_intelligence",
    citations,
    proposals,
    data: analysis,
  };
}

export function findTranscriptsForMeeting(state: AppState, meetingId: ID): Transcript[] {
  return Object.values(state.transcripts).filter((transcript) => transcript.meetingId === meetingId);
}

export function meetingsNeedingIntelligence(state: AppState, now: Timestamp = Date.now()): Array<{
  transcript: Transcript;
  meeting: Meeting | null;
}> {
  return Object.values(state.transcripts)
    .filter((transcript) => transcript.status === "ready" && transcript.segments.length > 0)
    .map((transcript) => ({
      transcript,
      meeting: transcript.meetingId ? state.meetings[transcript.meetingId] ?? null : null,
    }))
    .sort((a, b) => b.transcript.updatedAt - a.transcript.updatedAt)
    .slice(0, 10);
}