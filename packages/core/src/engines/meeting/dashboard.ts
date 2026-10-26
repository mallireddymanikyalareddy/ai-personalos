import type { AppState } from "../../store/state";
import type { ID, Timestamp } from "../../types/common";
import type { ActionItem, Meeting, Transcript } from "../../types/knowledge";
import { startOfDay } from "../date-utils";
import { buildMeetingReport } from "./engine";

const DAY = 86_400_000;

export interface MeetingListRow {
  id: ID;
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp | null;
  durationMin: number;
  location: string;
  participantCount: number;
  status: string;
  transcriptId: ID | null;
  hasSummary: boolean;
  actionItemCount: number;
  summary: string;
}

export interface MeetingMonthGroup {
  key: string;
  label: string;
  rows: MeetingListRow[];
}

export interface MeetingTopicRow {
  label: string;
  count: number;
  pct: number;
}

export interface MeetingParticipantRow {
  id: string;
  name: string;
  meetings: number;
  segments: number;
}

export interface MeetingsStats {
  meetings: number;
  totalDurationMin: number;
  participants: number;
  actionItems: number;
}

export interface MeetingsDashboard {
  rows: MeetingListRow[];
  groups: MeetingMonthGroup[];
  stats: MeetingsStats;
  topics: MeetingTopicRow[];
  participants: MeetingParticipantRow[];
  actionItems: ActionItem[];
  transcripts: Transcript[];
}

export interface MeetingsDashboardOptions {
  query?: string;
  periodDays?: number | null;
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "been", "being", "could", "every", "from", "have",
  "into", "just", "more", "most", "much", "need", "only", "other", "over", "same",
  "should", "some", "such", "than", "that", "their", "them", "then", "there", "these",
  "they", "this", "those", "through", "under", "very", "want", "were", "what", "when",
  "where", "which", "while", "will", "with", "would", "your", "yours", "let's", "going",
  "really", "think", "know", "like", "just", "okay", "right", "yeah", "well",
]);

function monthKey(at: Timestamp): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(at: Timestamp): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(at));
}

function durationMinutes(meeting: Meeting): number {
  if (meeting.endsAt == null) return 0;
  return Math.max(0, Math.round((meeting.endsAt - meeting.startsAt) / 60_000));
}

function transcriptFor(state: AppState, meetingId: ID): Transcript | null {
  const matches = Object.values(state.transcripts).filter(
    (transcript) => transcript.meetingId === meetingId && transcript.status !== "trashed",
  );
  return matches.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

function actionItemsFor(state: AppState, meetingId: ID): ActionItem[] {
  return Object.values(state.actionItems)
    .filter((item) => item.meetingId === meetingId && item.status !== "dismissed")
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function meetingTopics(state: AppState, meetingIds: Set<ID>): MeetingTopicRow[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const transcript of Object.values(state.transcripts)) {
    if (transcript.status === "trashed") continue;
    if (transcript.meetingId != null && !meetingIds.has(transcript.meetingId)) continue;
    const words = transcript.fullText
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .map((word) => word.replace(/^'+|'+$/g, ""))
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
      total += 1;
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
}

export function meetingParticipants(
  state: AppState,
  meetingIds: Set<ID>,
): MeetingParticipantRow[] {
  const map = new Map<string, { meetings: Set<ID>; segments: number }>();

  for (const transcript of Object.values(state.transcripts)) {
    if (transcript.status === "trashed") continue;
    if (transcript.meetingId != null && !meetingIds.has(transcript.meetingId)) continue;
    for (const segment of transcript.segments) {
      const entry = map.get(segment.speaker) ?? { meetings: new Set<ID>(), segments: 0 };
      entry.segments += 1;
      if (transcript.meetingId != null) entry.meetings.add(transcript.meetingId);
      map.set(segment.speaker, entry);
    }
  }

  return [...map.entries()]
    .map(([name, entry]) => ({
      id: name,
      name,
      meetings: entry.meetings.size,
      segments: entry.segments,
    }))
    .sort((a, b) => b.segments - a.segments || a.name.localeCompare(b.name));
}

export function buildMeetingsDashboard(
  state: AppState,
  now: Timestamp,
  options: MeetingsDashboardOptions = {},
): MeetingsDashboard {
  const query = options.query?.trim().toLowerCase() ?? "";
  const periodDays = options.periodDays ?? null;
  const from = periodDays != null ? startOfDay(now) - (periodDays - 1) * DAY : null;

  const meetings = Object.values(state.meetings)
    .filter((meeting) => meeting.status !== "archived")
    .filter((meeting) => (from == null ? true : meeting.startsAt >= from))
    .sort((a, b) => b.startsAt - a.startsAt);

  const rows: MeetingListRow[] = meetings.map((meeting) => {
    const transcript = transcriptFor(state, meeting.id);
    const items = actionItemsFor(state, meeting.id);
    return {
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      durationMin: durationMinutes(meeting),
      location: meeting.location,
      participantCount: Math.max(meeting.attendeeIds.length, transcript ? new Set(transcript.segments.map((s) => s.speaker)).size : 0),
      status: meeting.status,
      transcriptId: transcript?.id ?? null,
      hasSummary: Boolean(transcript?.aiSummary),
      actionItemCount: items.length,
      summary: transcript?.aiSummary ?? meeting.notes ?? "",
    };
  });

  const filtered =
    query.length === 0
      ? rows
      : rows.filter((row) =>
          `${row.title} ${row.summary}`.toLowerCase().includes(query),
        );

  const groupMap = new Map<string, MeetingListRow[]>();
  for (const row of filtered) {
    const key = monthKey(row.startsAt);
    const list = groupMap.get(key) ?? [];
    list.push(row);
    groupMap.set(key, list);
  }
  const groups: MeetingMonthGroup[] = [...groupMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({
      key,
      label: monthLabel(list[0]!.startsAt),
      rows: list,
    }));

  const meetingIds = new Set(filtered.map((row) => row.id));
  const actionItems = Object.values(state.actionItems)
    .filter((item) => item.status !== "dismissed")
    .filter((item) => (item.meetingId != null ? meetingIds.has(item.meetingId) : true))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  const participants = meetingParticipants(state, meetingIds);
  const totalDurationMin = filtered.reduce((sum, row) => sum + row.durationMin, 0);

  const stats: MeetingsStats = {
    meetings: filtered.length,
    totalDurationMin,
    participants: participants.length,
    actionItems: actionItems.length,
  };

  return {
    rows: filtered,
    groups,
    stats,
    topics: meetingTopics(state, meetingIds),
    participants,
    actionItems,
    transcripts: Object.values(state.transcripts).filter((transcript) => transcript.status !== "trashed"),
  };
}

export function meetingReportFor(state: AppState, transcriptId: ID, now: Timestamp) {
  return buildMeetingReport(state, transcriptId, now);
}
