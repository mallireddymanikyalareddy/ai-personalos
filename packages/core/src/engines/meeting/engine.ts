import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type {
  Meeting,
  Recording,
  Transcript,
  TranscriptEntity,
  TranscriptSegment,
} from "../../types/knowledge";
import { parseCapture } from "../capture-parser";
import { findFreeSlotsForDay } from "../calendar/freebusy";
import { search as knowledgeSearch, type SearchResult } from "../knowledge/search";
import { canUserRead } from "../ai/access";
import type { AIProposal } from "../ai/types";
import { summarizeNoteText } from "../ai/notes";

const DECISION_PATTERNS: RegExp[] = [
  /\bwe (decided|agreed|concluded|settled on|chose|picked|opted for|went with)\b[^.!?]{3,}/i,
  /\bdecision\s*[:\-]\s*[^.!?]{3,}/i,
  /\bit'?s (decided|settled|agreed|final)\b/i,
  /\bwe (are|'re) going (with|to)\b[^.!?]{4,}/i,
  /\bfinal(ly)? (call|decision|answer|choice)\b[^.!?]{0,}/i,
  /\bthe plan is\b[^.!?]{4,}/i,
];

const ACTION_PATTERNS: RegExp[] = [
  /\b(i|we|you|they)?\s*(will|'ll|shall|should|need to|has to|have to|must)\s+[^.!?]{6,}/i,
  /\baction item\s*[:\-]/i,
  /\bfollow (up|through)\b[^.!?]{4,}/i,
  /\b(todo|to-?do|next step|next steps)\s*[:\-]/i,
  /\b(let'?s|can you|could you|please)\s+[^.!?]{6,}/i,
  /\btake (care of|ownership of|the lead on)\b[^.!?]{4,}/i,
  /\bsend (me|us|them|the)\b[^.!?]{4,}/i,
  /\bschedule\b[^.!?]{6,}/i,
  /\b(book|reserve|arrange)\b[^.!?]{5,}/i,
  /\bship\b[^.!?]{5,}/i,
];

const FILLER = new Set(["yeah", "okay", "ok", "right", "so", "um", "uh", "hmm", "mhm", "alright", "cool", "great"]);

function clean(text: string): string {
  return text.replace(/\s+/g, " ").replace(/^[\s\-•*]+/, "").trim();
}

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2 && !FILLER.has(word));
}

export interface MeetingSpeakerProfile {
  id: string;
  label: string;
  segments: number;
  words: number;
  durationMs: number;
  firstSpokeAt: Timestamp;
  confidence: number;
  isRenamed: boolean;
}

export interface MeetingActionItemDraft {
  id: string;
  title: string;
  sourceText: string;
  segmentIndex: number | null;
  speaker: string;
  dueAt: Timestamp | null;
  durationMin: number | null;
  assigneeId: ID | null;
  confidence: number;
}

export interface MeetingDecisionDraft {
  id: string;
  text: string;
  segmentIndex: number | null;
  speaker: string;
  confidence: number;
}

export interface MeetingReport {
  meetingId: ID | null;
  transcriptId: ID;
  title: string;
  durationMin: number | null;
  wordCount: number;
  segmentCount: number;
  summary: string;
  keyPoints: string[];
  decisions: MeetingDecisionDraft[];
  actionItems: MeetingActionItemDraft[];
  speakers: MeetingSpeakerProfile[];
  entities: TranscriptEntity[];
  generatedAt: Timestamp;
}

function titleFrom(text: string): string {
  let value = clean(text)
    .replace(/^(so|and|but|also|then|well|now|i think|i guess|basically|you know|like)\s+/i, "")
    .replace(/^(i|we|you|they)\s+(will|'ll|shall|should|need to|has to|have to|must)\s+/i, "")
    .replace(/^(let'?s|please|can you|could you)\s+/i, "")
    .replace(/\.$/, "");
  const words = value.split(" ");
  const clipped = words.slice(0, 12).join(" ");
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function normalizedSegments(transcript: Transcript): TranscriptSegment[] {
  if (transcript.segments.length > 0) return transcript.segments;
  return transcript.fullText
    .split(/\n+/)
    .map((line, index) => {
      const speaker = line.match(/^([A-Za-z][A-Za-z .]{1,24}):/)?.[1]?.trim() ?? "Speaker 1";
      const text = line.replace(/^[A-Za-z][A-Za-z .]{1,24}:\s*/, "");
      return { speaker, startMs: index * 1000, endMs: index * 1000 + 1000, text, confidence: undefined };
    })
    .filter((segment) => clean(segment.text).length > 0);
}

export function identifySpeakers(transcript: Transcript, now: Timestamp = Date.now()): MeetingSpeakerProfile[] {
  const segments = normalizedSegments(transcript);
  const groups = new Map<string, { segments: number; words: number; durationMs: number; firstSpokeAt: Timestamp }>();

  for (const segment of segments) {
    const label = clean(segment.speaker) || "Speaker 1";
    const entry = groups.get(label) ?? { segments: 0, words: 0, durationMs: 0, firstSpokeAt: segment.startMs };
    entry.segments += 1;
    entry.words += meaningfulWords(segment.text).length;
    entry.durationMs += Math.max(0, segment.endMs - segment.startMs);
    if (segment.startMs < entry.firstSpokeAt) entry.firstSpokeAt = segment.startMs;
    groups.set(label, entry);
  }

  const total = [...groups.values()].reduce((sum, entry) => sum + entry.words, 0);
  const unknownCount = [...groups.keys()].filter((key) => /^speaker\s*\d+$/i.test(key)).length;
  const renamed = [...groups.keys()].some((key) => !/^speaker\s*\d+$/i.test(key));

  return [...groups.entries()]
    .map(([label, entry], index) => ({
      id: `speaker_${index + 1}`,
      label: /^speaker\s*\d+$/i.test(label) ? label : label,
      segments: entry.segments,
      words: entry.words,
      durationMs: entry.durationMs,
      firstSpokeAt: entry.firstSpokeAt,
      confidence:
        groups.size <= 1
          ? 0.5
          : Math.round(Math.min(0.95, 0.4 + (entry.words / Math.max(1, total)) * 1.6) * 100) / 100,
      isRenamed: !/^speaker\s*\d+$/i.test(label),
    }))
    .sort((a, b) => b.words - a.words)
    .map((profile, index) => ({
      ...profile,
      id: `speaker_${index + 1}`,
      label: /^speaker\s*\d+$/i.test(profile.label) ? profile.label : profile.label,
    }))
    .map((profile) => ({
      ...profile,
      confidence:
        renamed && profile.isRenamed
          ? 0.9
          : unknownCount > 1 && profile.segments > 2
            ? Math.min(0.75, profile.confidence + 0.15)
            : profile.confidence,
    }));

  void now;
}

export function renameSpeaker(transcript: Transcript, speakerLabel: string, name: string): TranscriptSegment[] {
  const target = speakerLabel.trim().toLowerCase();
  return normalizedSegments(transcript).map((segment) =>
    segment.speaker.trim().toLowerCase() === target ? { ...segment, speaker: name.trim() } : segment,
  );
}

export function extractActionItems(
  transcript: Transcript,
  now: Timestamp = Date.now(),
): MeetingActionItemDraft[] {
  const segments = normalizedSegments(transcript);
  const items: MeetingActionItemDraft[] = [];

  segments.forEach((segment, index) => {
    const text = clean(segment.text);
    if (!text || !matchesAny(text, ACTION_PATTERNS)) return;

    const parsed = parseCapture(text, { now });
    const assigneeMatch = text.match(/\b([A-Z][a-z]{2,})\s*(?:will|to|should|'ll)\b/);
    const mention = text.match(/@([\p{L}\p{N}_]+)/u);

    items.push({
      id: `action_${transcript.id}_${index}`,
      title: titleFrom(text),
      sourceText: text.slice(0, 240),
      segmentIndex: index,
      speaker: clean(segment.speaker),
      dueAt: parsed.dueAt,
      durationMin: parsed.durationMin,
      assigneeId: (assigneeMatch?.[1] ?? mention?.[1] ?? null) as ID | null,
      confidence: /\b(will|'ll|need to|must)\b/i.test(text) ? 0.85 : 0.7,
    });
  });

  return items;
}

export function extractDecisions(transcript: Transcript): MeetingDecisionDraft[] {
  const segments = normalizedSegments(transcript);
  const decisions: MeetingDecisionDraft[] = [];

  segments.forEach((segment, index) => {
    const text = clean(segment.text);
    if (!text || !matchesAny(text, DECISION_PATTERNS)) return;
    decisions.push({
      id: `decision_${transcript.id}_${index}`,
      text: text.slice(0, 300),
      segmentIndex: index,
      speaker: clean(segment.speaker),
      confidence: /\bwe (decided|agreed)\b/i.test(text) ? 0.9 : 0.75,
    });
  });

  return decisions;
}

export function buildMeetingReport(
  state: AppState,
  transcriptId: ID,
  now: Timestamp = Date.now(),
): MeetingReport | null {
  const transcript = state.transcripts[transcriptId];
  if (!transcript || !canUserRead(state, transcript)) return null;

  const segments = normalizedSegments(transcript);
  const fullText = segments.map((segment) => segment.text).join(" ");
  const { summary, keyPoints } = summarizeNoteText(fullText, 4);
  const spanMs =
    segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMs)) - Math.min(...segments.map((segment) => segment.startMs)) : 0;
  const durationMin = spanMs > 0 ? Math.max(1, Math.round(spanMs / 60000)) : null;

  return {
    meetingId: transcript.meetingId,
    transcriptId,
    title: transcript.title,
    durationMin: durationMin && durationMin > 0 ? durationMin : null,
    wordCount: meaningfulWords(fullText).length,
    segmentCount: segments.length,
    summary: summary || "No content to summarize yet.",
    keyPoints,
    decisions: extractDecisions(transcript),
    actionItems: extractActionItems(transcript, now),
    speakers: identifySpeakers(transcript, now),
    entities: transcript.aiEntities ?? [],
    generatedAt: now,
  };
}

export function storeMeetingReport(state: AppState, report: MeetingReport, now: Timestamp): void {
  const transcript = state.transcripts[report.transcriptId];
  if (!transcript) return;
  transcript.aiSummary = report.summary;
  transcript.aiKeyPoints = report.keyPoints;
  transcript.aiActionItems = report.actionItems.map((item) => item.title);
  transcript.aiDecisions = report.decisions.map((decision) => decision.text);
  transcript.updatedAt = now;
}

export interface TranscriptFilters {
  meetingId?: ID | null;
  speaker?: string;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
  limit?: number;
}

export function searchTranscripts(
  state: AppState,
  query: string,
  filters: TranscriptFilters = {},
  now: Timestamp = Date.now(),
): Array<{ hit: SearchResult; transcript: Transcript; meeting: Meeting | null; matchedCount: number }> {
  const hits = knowledgeSearch(state, { query, types: ["transcript"], limit: filters.limit ?? 40 });
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);

  const results: Array<{ hit: SearchResult; transcript: Transcript; meeting: Meeting | null; matchedCount: number }> = [];

  for (const hit of hits) {
    const transcript = state.transcripts[hit.id];
    if (!transcript || !canUserRead(state, transcript)) continue;
    if (filters.meetingId && transcript.meetingId !== filters.meetingId) continue;
    if (filters.dateFrom && transcript.updatedAt < filters.dateFrom) continue;
    if (filters.dateTo && transcript.updatedAt > filters.dateTo) continue;
    if (filters.speaker) {
      const segments = normalizedSegments(transcript);
      if (!segments.some((segment) => segment.speaker.toLowerCase().includes(filters.speaker!.toLowerCase()))) continue;
    }

    const matchedCount = terms.filter((term) => transcript.fullText.toLowerCase().includes(term)).length;
    if (terms.length > 0 && matchedCount === 0) continue;

    results.push({
      hit,
      transcript,
      meeting: transcript.meetingId ? state.meetings[transcript.meetingId] ?? null : null,
      matchedCount,
    });
  }

  results.sort((a, b) => b.matchedCount - a.matchedCount || b.transcript.updatedAt - a.transcript.updatedAt);
  void now;
  return results;
}

export interface MeetingProposalSet {
  tasks: AIProposal[];
  events: AIProposal[];
  meeting: AIProposal | null;
}

export function proposeFromReport(
  state: AppState,
  report: MeetingReport,
  now: Timestamp = Date.now(),
): MeetingProposalSet {
  const tasks: AIProposal[] = [];
  const events: AIProposal[] = [];
  const meeting = report.meetingId ? state.meetings[report.meetingId] ?? null : null;

  for (const item of report.actionItems.slice(0, 12)) {
    tasks.push({
      capability: "meeting_intelligence",
      title: `Create task: ${item.title}`,
      summary:
        [item.dueAt ? `Due ${new Date(item.dueAt).toLocaleDateString()}` : "Lands in your inbox", `said by ${item.speaker}`]
          .join(" · "),
      risk: "low",
      requiresConfirmation: true,
      reasoning: "Extracted from a commitment in the transcript — you confirm before it becomes a task.",
      preview: [
        { label: item.title, detail: item.durationMin != null ? `~${item.durationMin} min` : undefined },
        { label: "Source", detail: item.sourceText.slice(0, 120) },
      ],
      refs: [{ entityType: "transcript", entityId: report.transcriptId }],
      payload: {
        kind: "meeting_task",
        transcriptId: report.transcriptId,
        meetingId: report.meetingId,
        title: item.title,
        dueAt: item.dueAt,
        estimateMin: item.durationMin,
        segmentIndex: item.segmentIndex,
        sourceText: item.sourceText,
      },
    });
  }

  const schedulable = report.actionItems.filter((item) => item.dueAt != null).slice(0, 8);
  const reservedRanges: Array<{ startsAt: Timestamp; endsAt: Timestamp }> = [];
  for (const item of schedulable) {
    const dayStart = new Date(item.dueAt!);
    dayStart.setHours(0, 0, 0, 0);
    const slots = findFreeSlotsForDay(state, dayStart.getTime(), 8, 20, item.durationMin ?? 30);
    const slot = slots.find(
      (candidate) => !reservedRanges.some((range) => candidate.startsAt < range.endsAt && candidate.endsAt > range.startsAt),
    );

    if (!slot) continue;

    reservedRanges.push({ startsAt: slot.startsAt, endsAt: slot.endsAt });

    events.push({
      capability: "meeting_intelligence",
      title: `Block time: ${item.title}`,
      summary: `${slot.durationMin} min on ${new Date(slot.startsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      risk: "medium",
      requiresConfirmation: true,
      reasoning:
        "A calendar event reserves time on your schedule, so it is proposed with a free slot rather than placed automatically.",
      preview: [
        { label: item.title, detail: slot.durationMin ? `${slot.durationMin} min` : undefined },
        { label: "Because", detail: `the transcript mentions a date` },
      ],
      refs: [{ entityType: "transcript", entityId: report.transcriptId }],
      payload: {
        kind: "meeting_event",
        transcriptId: report.transcriptId,
        title: item.title,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        taskId: null,
      },
    });
  }

  const meetingProposal: AIProposal | null = meeting
    ? {
        capability: "meeting_intelligence",
        title: `Save summary to "${meeting.title}"`,
        summary: `${report.keyPoints.length} key points · ${report.decisions.length} decisions · ${report.actionItems.length} action items`,
        risk: "low",
        requiresConfirmation: true,
        reasoning: "The meeting record keeps a summary you can re-read without opening the transcript.",
        preview: [
          { label: "Summary", detail: report.summary.slice(0, 160) },
          ...report.keyPoints.slice(0, 4).map((point) => ({ label: "Key point", detail: point.slice(0, 160) })),
        ],
        refs: [{ entityType: "meeting", entityId: meeting.id }, { entityType: "transcript", entityId: report.transcriptId }],
        payload: {
          kind: "meeting_summary",
          meetingId: meeting.id,
          transcriptId: report.transcriptId,
          summary: report.summary,
          keyPoints: report.keyPoints,
          decisions: report.decisions.map((decision) => decision.text),
          speakers: report.speakers.map((speaker) => speaker.label),
        },
      }
    : null;

  return { tasks, events, meeting: meetingProposal };
}

export interface LiveTranscriptionSession {
  transcriptId: ID;
  recordingId: ID | null;
  meetingId: ID | null;
  startedAt: Timestamp;
  segments: TranscriptSegment[];
}

export function startLiveTranscription(
  title: string,
  meetingId: ID | null,
  now: Timestamp = Date.now(),
): LiveTranscriptionSession {
  return {
    transcriptId: "",
    recordingId: null,
    meetingId,
    startedAt: now,
    segments: [],
  };
}

export function appendLiveSegment(
  session: LiveTranscriptionSession,
  segment: { speaker: string; text: string; at?: Timestamp },
  now: Timestamp = Date.now(),
): LiveTranscriptionSession {
  const last = session.segments[session.segments.length - 1];
  const at = segment.at ?? now;
  const next: TranscriptSegment =
    last && last.speaker === segment.speaker
      ? { ...last, text: `${last.text} ${segment.text}`.trim(), endMs: at }
      : { speaker: segment.speaker, startMs: at, endMs: at, text: clean(segment.text) };

  const segments = last && last.speaker === segment.speaker ? [...session.segments.slice(0, -1), next] : [...session.segments, next];
  return { ...session, segments };
}

export function segmentStats(session: LiveTranscriptionSession): { segments: number; words: number; speakers: number } {
  const words = session.segments.reduce((sum, segment) => sum + meaningfulWords(segment.text).length, 0);
  return {
    segments: session.segments.length,
    words,
    speakers: new Set(session.segments.map((segment) => segment.speaker)).size,
  };
}

export function meetingSearchSuggestions(state: AppState, limit = 6): Meeting[] {
  return Object.values(state.meetings)
    .filter((meeting) => canUserRead(state, meeting))
    .sort((a, b) => b.startsAt - a.startsAt)
    .slice(0, limit);
}

export function recordingsNeedingTranscript(state: AppState): Recording[] {
  return Object.values(state.recordings)
    .filter((recording) => recording.status === "ready" && canUserRead(state, recording))
    .filter((recording) => !Object.values(state.transcripts).some((t) => t.recordingId === recording.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
