"use client";

import * as React from "react";

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Gauge,
  ListChecks,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Users,
} from "lucide-react";

import type { ActionItem, Meeting, MeetingReport, Transcript, TranscriptSegment } from "@personalos/core";

import { Badge } from "@/components/ui/badge";
import { DropdownMenu } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";

export type MeetingDetailTab = "transcript" | "summary" | "notes" | "actions" | "decisions" | "highlights";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const SPEAKER_COLORS = [
  "var(--chart-5)",
  "var(--chart-7)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-6)",
  "var(--chart-3)",
];

function speakerColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return SPEAKER_COLORS[hash % SPEAKER_COLORS.length]!;
}

export function MeetingDetail({
  meeting,
  transcript,
  report,
  actionItems,
  tab,
  onTabChange,
  onToggleActionItem,
  onRenameSpeaker,
  onExtract,
  onConvertActionItem,
  onEdit,
  onDelete,
  onSaveNotes,
  audioUrl,
  onUpdateSegments,
  onAddActionItem,
  onDeleteActionItem,
  onExport,
  onDeleteTranscript,
  onBulkCreateTasks,
}: {
  meeting: Meeting | null;
  transcript: Transcript | null;
  report: MeetingReport | null;
  actionItems: ActionItem[];
  tab: MeetingDetailTab;
  onTabChange: (tab: MeetingDetailTab) => void;
  onToggleActionItem: (item: ActionItem) => void;
  onRenameSpeaker: (from: string, to: string) => void;
  onExtract: () => void;
  onConvertActionItem: (item: ActionItem) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveNotes: (notes: string) => void;
  audioUrl?: string | null;
  onUpdateSegments: (segments: TranscriptSegment[]) => void;
  onAddActionItem: (title: string, dueAt: number | null) => void;
  onDeleteActionItem: (item: ActionItem) => void;
  onExport?: () => void;
  onDeleteTranscript?: () => void;
  onBulkCreateTasks?: () => void;
}) {
  const [playing, setPlaying] = React.useState(false);
  const [playhead, setPlayhead] = React.useState(0);
  const [rate, setRate] = React.useState(1);
  const [notesDraft, setNotesDraft] = React.useState(meeting?.notes ?? "");
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [audioDuration, setAudioDuration] = React.useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [segmentQuery, setSegmentQuery] = React.useState("");
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [segmentDraft, setSegmentDraft] = React.useState("");
  const [newLine, setNewLine] = React.useState("");
  const [actionTitle, setActionTitle] = React.useState("");
  const [actionDue, setActionDue] = React.useState("");
  const [mergeFrom, setMergeFrom] = React.useState("");
  const [mergeTo, setMergeTo] = React.useState("");

  const fallbackDuration = React.useMemo(() => {
    if (transcript == null) return 0;
    const last = transcript.segments[transcript.segments.length - 1];
    return Math.max(last?.endMs ?? 0, (meeting?.endsAt ?? 0) - (meeting?.startsAt ?? 0));
  }, [transcript, meeting]);
  const durationMs = audioUrl ? audioDuration || fallbackDuration : fallbackDuration;

  const seekTo = React.useCallback(
    (next: number) => {
      const clamped = Math.max(0, durationMs > 0 ? Math.min(next, durationMs) : next);
      setPlayhead(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped / 1000;
      }
    },
    [durationMs],
  );

  React.useEffect(() => {
    if (!playing) {
      audioRef.current?.pause();
      return;
    }
    if (audioUrl && audioRef.current) {
      void audioRef.current.play().catch(() => setPlaying(false));
      return;
    }
    const id = window.setInterval(() => {
      setPlayhead((current) => {
        const next = current + 1000 * rate;
        if (durationMs > 0 && next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, rate, durationMs, audioUrl]);

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  React.useEffect(() => {
    setPlayhead(0);
    setPlaying(false);
  }, [meeting?.id]);

  if (meeting == null) {
    return (
      <section
        aria-label="Meeting detail"
        data-testid="meeting-detail-empty"
        className="flex min-h-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface p-10 text-center shadow-card"
      >
        <MessageSquare className="size-6 text-ink-3" aria-hidden="true" />
        <p className="text-sm font-medium text-ink">Select a meeting to open it</p>
        <p className="text-[12px] text-ink-3">Record, import or pick a meeting from the list.</p>
      </section>
    );
  }

  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(meeting.startsAt),
  );
  const start = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(meeting.startsAt),
  );
  const end =
    meeting.endsAt != null
      ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
          new Date(meeting.endsAt),
        )
      : null;
  const durationMin = meeting.endsAt != null ? Math.round((meeting.endsAt - meeting.startsAt) / 60_000) : 0;
  const speakers = report?.speakers ?? [];
  const activeSegment: TranscriptSegment | undefined = transcript?.segments.find(
    (segment) => playhead >= segment.startMs && playhead < segment.endMs,
  );

  const tabs: { value: MeetingDetailTab; label: string; count?: number }[] = [
    { value: "transcript", label: "Transcript", count: transcript?.segments.length },
    { value: "summary", label: "Summary" },
    { value: "notes", label: "Notes" },
    { value: "actions", label: "Action Items", count: actionItems.length },
    { value: "decisions", label: "Decisions", count: report?.decisions.length },
    { value: "highlights", label: "Highlights" },
  ];

  return (
    <section
      aria-label="Meeting detail"
      data-testid="meeting-detail"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-card"
    >
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-ink">
            {meeting.title}
          </h2>
          <DropdownMenu
            align="end"
            sections={[
              {
                label: meeting.title,
                items: [
                  { label: "Edit meeting", onSelect: onEdit },
                  ...(onExport ? [{ label: "Export meeting as Markdown", onSelect: onExport }] : []),
                  { label: "Extract tasks and events", onSelect: onExtract },
                  { label: "Action items", onSelect: onTabChange.bind(null, "actions") },
                  { label: "Decisions", onSelect: onTabChange.bind(null, "decisions") },
                  { label: "Delete meeting", danger: true, onSelect: onDelete },
                  ...(onDeleteTranscript && transcript != null
                    ? [{ label: "Delete transcript", danger: true, onSelect: onDeleteTranscript }]
                    : []),
                ],
              },
            ]}
            trigger={
              <button
                type="button"
                aria-label="Meeting options"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {date}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {start}
            {end ? ` – ${end}` : ""}
            {durationMin > 0 ? ` (${durationMin} min)` : ""}
          </span>
          {meeting.location ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {meeting.location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            {meeting.attendees.length || speakers.length || meeting.attendeeIds.length} participants
          </span>
        </div>
        {meeting.attendees.length > 0 || meeting.tags.length > 0 || meeting.projectId != null ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {meeting.projectId != null ? <Badge tone="outline">Project linked</Badge> : null}
            {meeting.attendees.map((attendee) => (
              <Badge key={attendee.id} tone="neutral">
                {attendee.name}
                {attendee.email ? ` · ${attendee.email}` : ""}
              </Badge>
            ))}
            {meeting.tags.map((tag) => (
              <Badge key={tag} tone="accent">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/50 px-4 py-2.5">
        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration * 1000)}
            onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime * 1000)}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        ) : null}
        <button
          type="button"
          data-testid="meeting-play"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors hover:bg-accent-strong"
        >
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </button>
        <span className="shrink-0 text-[11px] tabular-nums text-ink-2" data-testid="meeting-time">
          {formatClock(playhead)} / {formatClock(durationMs)}
        </span>
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Seek</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            step={500}
            value={Math.min(playhead, Math.max(1, durationMs))}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Seek"
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
        </label>
        <DropdownMenu
          align="end"
          sections={[
            {
              label: "Speed",
              items: [0.5, 1, 1.5, 2].map((value) => ({
                label: `${value}x`,
                selected: rate === value,
                onSelect: () => setRate(value),
              })),
            },
          ]}
          trigger={
            <button
              type="button"
              aria-label="Playback speed"
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
            >
              {rate}x
            </button>
          }
        />
        <button
          type="button"
          data-testid="meeting-rewind"
          onClick={() => seekTo(playhead - 15_000)}
          aria-label="Back 15 seconds"
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="meeting-forward"
          onClick={() => seekTo(playhead + 15_000)}
          aria-label="Forward 15 seconds"
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
        </button>
        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-ink-3 sm:inline-flex">
          <Gauge className="size-3.5" aria-hidden="true" />
          {transcript?.confidence != null ? `${Math.round(transcript.confidence * 100)}%` : "—"}
        </span>
        {audioUrl ? (
          <a
            href={audioUrl}
            download={`${meeting.title.replace(/[^\w-]+/g, "-") || "meeting"}.webm`}
            className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
          >
            Audio
          </a>
        ) : null}
        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-ink-3 sm:inline-flex">
          <Maximize2 className="size-3.5" aria-hidden="true" />
          {formatClock(durationMs)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-1.5" role="tablist" aria-label="Meeting sections">
        {tabs.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            data-testid={`meeting-detail-tab-${entry.value}`}
            aria-selected={tab === entry.value}
            onClick={() => onTabChange(entry.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors",
              tab === entry.value ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {entry.label}
            {entry.count != null ? ` (${entry.count})` : ""}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "transcript" ? (
          transcript == null ? (
            <p className="py-8 text-center text-[13px] text-ink-3">No transcript yet for this meeting.</p>
          ) : (
            <div className="space-y-3" data-testid="meeting-transcript">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={segmentQuery}
                  onChange={(event) => setSegmentQuery(event.target.value)}
                  placeholder="Search transcript…"
                  aria-label="Search transcript"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink-3">
                  {transcript.segments.length} segment{transcript.segments.length === 1 ? "" : "s"}
                </span>
              </div>
              {new Set(transcript.segments.map((segment) => segment.speaker)).size > 1 ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                  <select
                    value={mergeFrom}
                    onChange={(event) => setMergeFrom(event.target.value)}
                    aria-label="Merge from speaker"
                    className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11px] text-ink outline-none focus:border-accent"
                  >
                    <option value="">Merge speaker…</option>
                    {[...new Set(transcript.segments.map((segment) => segment.speaker))].map((speaker) => (
                      <option key={speaker} value={speaker}>
                        {speaker}
                      </option>
                    ))}
                  </select>
                  <span>into</span>
                  <select
                    value={mergeTo}
                    onChange={(event) => setMergeTo(event.target.value)}
                    aria-label="Merge into speaker"
                    className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11px] text-ink outline-none focus:border-accent"
                  >
                    <option value="">Speaker…</option>
                    {[...new Set(transcript.segments.map((segment) => segment.speaker))].map((speaker) => (
                      <option key={speaker} value={speaker}>
                        {speaker}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (mergeFrom.length === 0 || mergeTo.length === 0 || mergeFrom === mergeTo) return;
                      onRenameSpeaker(mergeFrom, mergeTo);
                      setMergeFrom("");
                      setMergeTo("");
                    }}
                    disabled={mergeFrom.length === 0 || mergeTo.length === 0 || mergeFrom === mergeTo}
                    className="rounded-md border border-line px-2 py-1 font-medium text-ink-2 disabled:opacity-40"
                  >
                    Merge
                  </button>
                </div>
              ) : null}
              <ul className="space-y-3">
                {transcript.segments
                  .map((segment, index) => ({ segment, index }))
                  .filter(({ segment }) => {
                    const query = segmentQuery.trim().toLowerCase();
                    if (query.length === 0) return true;
                    return `${segment.speaker} ${segment.text}`.toLowerCase().includes(query);
                  })
                  .map(({ segment, index }) => {
                    const active = activeSegment?.startMs === segment.startMs;
                    const editing = editingIndex === index;
                    return (
                      <li key={`${segment.startMs}-${index}`} className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => seekTo(segment.startMs)}
                          aria-label={`Play from ${formatClock(segment.startMs)}`}
                          className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: speakerColor(segment.speaker) }}
                        >
                          {initials(segment.speaker)}
                        </button>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-ink">{segment.speaker}</span>
                            <span className="text-[11px] tabular-nums text-ink-3">
                              {formatClock(segment.startMs)}
                            </span>
                            {active ? <Badge tone="accent">Playing</Badge> : null}
                          </span>
                          {editing ? (
                            <span className="mt-1 flex items-center gap-1.5">
                              <input
                                value={segmentDraft}
                                onChange={(event) => setSegmentDraft(event.target.value)}
                                aria-label="Edit transcript line"
                                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const text = segmentDraft.trim();
                                  if (text.length > 0) {
                                    onUpdateSegments(
                                      transcript.segments.map((entry, position) =>
                                        position === index ? { ...entry, text } : entry,
                                      ),
                                    );
                                  }
                                  setEditingIndex(null);
                                }}
                                className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingIndex(null)}
                                className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-2"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "mt-0.5 block text-[13px] leading-relaxed",
                                active ? "text-ink" : "text-ink-2",
                              )}
                            >
                              {segment.text}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(index);
                              setSegmentDraft(segment.text);
                            }}
                            aria-label={`Edit line ${index + 1}`}
                            className="text-[11px] font-medium text-ink-3 hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSegments(transcript.segments.filter((_, position) => position !== index))
                            }
                            aria-label={`Delete line ${index + 1}`}
                            className="text-[11px] font-medium text-ink-3 hover:text-danger"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenaming(segment.speaker);
                              setRenameValue(segment.speaker);
                            }}
                            aria-label={`Rename ${segment.speaker}`}
                            className="text-[11px] font-medium text-accent-ink hover:underline"
                          >
                            Rename
                          </button>
                        </span>
                      </li>
                    );
                  })}
              </ul>

              <div className="flex items-center gap-2 border-t border-line pt-3">
                <input
                  value={newLine}
                  onChange={(event) => setNewLine(event.target.value)}
                  placeholder="Add a missing line to the transcript…"
                  aria-label="Add transcript line"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = newLine.trim();
                    if (text.length === 0) return;
                    const startMs = transcript.segments.at(-1)?.endMs ?? 0;
                    onUpdateSegments([
                      ...transcript.segments,
                      { speaker: "Speaker 1", text, startMs, endMs: startMs + 3000 },
                    ]);
                    setNewLine("");
                  }}
                  disabled={newLine.trim().length === 0}
                  className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                >
                  Add line
                </button>
              </div>
            </div>
          )
        ) : null}

        {tab === "summary" ? (
          report == null || report.summary.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-3">
              Summarise the transcript to see the AI summary here.
            </p>
          ) : (
            <div data-testid="meeting-summary">
              <p className="text-[13px] leading-relaxed text-ink-2">{report.summary}</p>
              {report.keyPoints.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {report.keyPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[13px] text-ink-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        ) : null}

        {tab === "notes" ? (
          <div data-testid="meeting-notes" className="space-y-2">
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              placeholder="Add agenda, notes or follow-ups for this meeting…"
              aria-label="Meeting notes"
              className="min-h-40 w-full resize-y rounded-xl border border-line bg-surface p-3 text-[13px] leading-relaxed text-ink-2 outline-none focus:border-accent"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onSaveNotes(notesDraft)}
                disabled={notesDraft === meeting.notes}
                className="rounded-lg bg-accent px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
              >
                Save notes
              </button>
            </div>
          </div>
        ) : null}

        {tab === "actions" ? (
          <div className="space-y-3">
            {onBulkCreateTasks && actionItems.some((item) => item.taskId == null) ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onBulkCreateTasks}
                  className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2"
                >
                  Create tasks for all
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/50 p-2">
              <input
                value={actionTitle}
                onChange={(event) => setActionTitle(event.target.value)}
                placeholder="Add an action item…"
                aria-label="New action item"
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
              />
              <input
                type="date"
                value={actionDue}
                onChange={(event) => setActionDue(event.target.value)}
                aria-label="Action item due date"
                className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => {
                  const title = actionTitle.trim();
                  if (title.length === 0) return;
                  const due = actionDue ? new Date(`${actionDue}T17:00`).getTime() : null;
                  onAddActionItem(title, Number.isFinite(due) ? due : null);
                  setActionTitle("");
                  setActionDue("");
                }}
                disabled={actionTitle.trim().length === 0}
                className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>

            {actionItems.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">
                No action items for this meeting. Add one above or summarise the transcript to extract them.
              </p>
            ) : (
              <ul className="space-y-1.5" data-testid="meeting-action-items">
                {actionItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onToggleActionItem(item)}
                      aria-label={`Toggle ${item.title}`}
                      aria-pressed={item.status === "done"}
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border",
                        item.status === "done" ? "border-success bg-success text-white" : "border-line-strong",
                      )}
                    >
                      {item.status === "done" ? <CheckCircle2 className="size-3" aria-hidden="true" /> : null}
                    </button>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        item.status === "done" ? "text-ink-3 line-through" : "text-ink-2",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.dueAt != null ? (
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                        {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
                          new Date(item.dueAt),
                        )}
                      </span>
                    ) : null}
                    {item.taskId != null ? (
                      <Badge tone="success">Task</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onConvertActionItem(item)}
                        className="shrink-0 text-[11px] font-medium text-accent-ink hover:underline"
                      >
                        Create task
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteActionItem(item)}
                      aria-label={`Remove ${item.title}`}
                      className="shrink-0 text-[11px] font-medium text-ink-3 hover:text-danger"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        
{tab === "decisions" ? (
          report == null || report.decisions.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-3">No decisions detected yet.</p>
          ) : (
            <ul className="space-y-2" data-testid="meeting-decisions">
              {report.decisions.map((decision) => (
                <li key={decision.id} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[13px] text-ink-2">{decision.text}</span>
                  <span className="shrink-0 text-[11px] text-ink-3">{decision.speaker}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "highlights" ? (
          report == null || report.keyPoints.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-3">No highlights yet.</p>
          ) : (
            <ul className="space-y-2" data-testid="meeting-highlights">
              {report.keyPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <ListChecks className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[13px] text-ink-2">{point}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {renaming != null ? (
        <div
          className="border-t border-line bg-surface-2/70 p-3"
          role="dialog"
          aria-label="Rename speaker"
          data-testid="meeting-rename"
        >
          <label className="text-[11px] font-medium text-ink-2" htmlFor="meeting-rename-input">
            Rename {renaming}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="meeting-rename-input"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="h-8 w-48 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                onRenameSpeaker(renaming, renameValue.trim() || renaming);
                setRenaming(null);
              }}
              className="rounded-lg bg-accent px-2.5 py-1 text-[12px] font-medium text-white"
            >
              Rename everywhere
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
