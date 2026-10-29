"use client";

import * as React from "react";

import {
  CalendarDays,
  Download,
  ListChecks,
  MoreHorizontal,
  Radio,
  Video,
} from "lucide-react";

import type { ActionItem, ID, Timestamp } from "@personalos/core";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buildAIContext, estimateAIAction, streamAIChat, type AIEstimate } from "@/lib/ai-stream";
import { useCredits } from "@/lib/use-credits";
import { useAppState, useOS } from "@/store/use-os";
import { AUDIO_KEY_PREFIX, loadAudio } from "@/lib/audio-store";
import { downloadText } from "@/modules/notebook/notebook-export";
import { safeFileName } from "@personalos/core";

import { AIObjectCard } from "@/components/entities/ai-object-card";
import { CreditConfirmDialog } from "@/components/ai/credit-confirm";
import { MeetingDetail, type MeetingDetailTab } from "./meeting-detail";
import { MeetingDialog, type MeetingDialogValue } from "./meeting-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MeetingInsights } from "./meeting-insights";
import { MeetingListPanel } from "./meeting-list-panel";
import { MeetingAIAssistant, MeetingRail } from "./meeting-rail";
import { ImportRecorder, LiveRecorder } from "./meeting-recorders";

type WorkspaceTab = "all" | "transcripts" | "summaries" | "actions" | "calendar" | "insights";
type MeetingFilter = "all" | "summarised" | "actions";

const WORKSPACE_TABS: { value: WorkspaceTab; label: string }[] = [
  { value: "all", label: "All Meetings" },
  { value: "transcripts", label: "Transcripts" },
  { value: "summaries", label: "Summaries" },
  { value: "actions", label: "Action Items" },
  { value: "calendar", label: "Calendar" },
  { value: "insights", label: "Insights" },
];

const FILTERS: { value: MeetingFilter; label: string }[] = [
  { value: "all", label: "All meetings" },
  { value: "summarised", label: "With summaries" },
  { value: "actions", label: "With action items" },
];

const PERIOD_DAYS: Record<string, number | null> = {
  "Last 7 Days": 7,
  "Last 30 Days": 30,
  "Last 90 Days": 90,
  "All Time": null,
};

export function MeetingModule() {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<WorkspaceTab>("all");
  const [detailTab, setDetailTab] = React.useState<MeetingDetailTab>("transcript");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<MeetingFilter>("all");
  const [period, setPeriod] = React.useState("Last 30 Days");
  const [selectedId, setSelectedId] = React.useState<ID | null>(null);
  const [recorder, setRecorder] = React.useState<"record" | "import" | null>(null);
  const [proposals, setProposals] = React.useState<ReturnType<typeof os.meetingProposals>>(null);
  const [proposedTitles, setProposedTitles] = React.useState<Set<string>>(new Set());
  const [editor, setEditor] = React.useState<{ mode: "create" } | { mode: "edit"; id: ID } | null>(null);
  const [deleteId, setDeleteId] = React.useState<ID | null>(null);
  const [transcriptDeleteId, setTranscriptDeleteId] = React.useState<ID | null>(null);
  const [showTrashedTranscripts, setShowTrashedTranscripts] = React.useState(false);
  const { balance, reload: reloadCredits } = useCredits(true);
  const gatewayEnabled = (state.settings.aiProvider ?? "local") === "openai";
  const [aiDraft, setAiDraft] = React.useState("");
  const [aiAnswer, setAiAnswer] = React.useState<string | null>(null);
  const [pendingAI, setPendingAI] = React.useState<{
    action: string;
    prompt: string;
    label: string;
    estimate: AIEstimate;
  } | null>(null);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [lastCharge, setLastCharge] = React.useState<{ charged: number; available: number } | null>(null);

  const now = Date.now();
  const dashboard = os.meetingsDashboard(
    { query, periodDays: PERIOD_DAYS[period] ?? null },
    now,
  );
  const dashboardRows = dashboard.rows;
  const dashboardGroups = dashboard.groups;

  const filteredRows = React.useMemo(() => {
    if (filter === "summarised") return dashboardRows.filter((row) => row.hasSummary);
    if (filter === "actions") return dashboardRows.filter((row) => row.actionItemCount > 0);
    return dashboardRows;
  }, [dashboardRows, filter]);

  const groups = React.useMemo(() => {
    if (filter === "all") return dashboardGroups;
    const map = new Map<string, (typeof dashboardGroups)[number]>();
    for (const group of dashboardGroups) {
      const rows = group.rows.filter((row) => filteredRows.some((entry) => entry.id === row.id));
      if (rows.length > 0) map.set(group.key, { ...group, rows });
    }
    return [...map.values()];
  }, [dashboardGroups, filteredRows, filter]);

  React.useEffect(() => {
    if (selectedId != null && dashboardRows.some((row) => row.id === selectedId)) return;
    setSelectedId(dashboardRows[0]?.id ?? null);
  }, [dashboardRows, selectedId]);

  const selected = dashboardRows.find((row) => row.id === selectedId) ?? null;
  const meeting = selectedId != null ? os.getMeeting(selectedId) : null;
  const transcript = selected?.transcriptId != null ? os.getTranscript(selected.transcriptId) : null;
  const report = selected?.transcriptId != null ? os.meetingReport(selected.transcriptId, now) : null;
  const transcriptText = transcript?.segments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\n") ?? "";
  const meetingAIContext = `${buildAIContext(os.getState(), "")}\n\nMEETING: ${meeting?.title ?? selected?.title ?? ""}\n${transcriptText}`.slice(0, 190000);
  const recording = React.useMemo(
    () =>
      Object.values(state.recordings).find(
        (entry) => entry.meetingId === selectedId && entry.status !== "trashed",
      ) ?? null,
    [state.recordings, selectedId],
  );
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setAudioUrl(null);
    const url = recording?.url;
    if (!url) return;
    if (url.startsWith(AUDIO_KEY_PREFIX)) {
      const recordingId = recording!.id;
      void loadAudio(recordingId).then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      });
    } else {
      setAudioUrl(url);
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recording]);

  const actionItems = React.useMemo(
    () =>
      Object.values(state.actionItems)
        .filter((item) => item.status !== "dismissed")
        .filter((item) =>
          selectedId != null ? item.meetingId === selectedId || item.transcriptId === transcript?.id : false,
        )
        .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [state.actionItems, selectedId, transcript?.id],
  );

  const pendingObjects = os
    .aiPendingProposals()
    .filter((object) =>
      object.refs.some((ref) => ref.entityId === selected?.transcriptId || ref.entityId === selectedId),
    );
  const pendingTitles = new Set(pendingObjects.map((object) => object.title));
  const candidateProposals = proposals
    ? [...proposals.tasks, ...proposals.events].filter(
        (proposal) => !pendingTitles.has(proposal.title) && !proposedTitles.has(proposal.title),
      )
    : [];

  const toggleActionItem = (item: ActionItem) => {
    const next = item.status === "done" ? "open" : "done";
    os.updateActionItem(item.id, { status: next });
    toast(next === "done" ? "Action item completed" : "Action item reopened");
  };

  const convertActionItem = (item: ActionItem) => {
    if (item.taskId != null) {
      toast("This action item is already a task");
      return;
    }
    const task = os.addTask({ title: item.title, dueAt: item.dueAt, assigneeId: item.assigneeId });
    os.updateActionItem(item.id, { taskId: task.id, status: "converted" });
    toast("Task created from the action item");
  };

  const summarise = () => {
    if (selected?.transcriptId == null) {
      toast("This meeting has no transcript yet", { tone: "danger" });
      return;
    }
    os.storeMeetingReport(selected.transcriptId, now);
    setDetailTab("summary");
    toast("Transcript summarised");
  };

  const extract = () => {
    if (selected?.transcriptId == null) {
      toast("This meeting has no transcript yet", { tone: "danger" });
      return;
    }
    setProposedTitles(new Set());
    setProposals(os.meetingProposals(selected.transcriptId, now));
  };

  const meetingAIMeta = (id: string) => {
    if (id === "analyze") {
      return {
        action: "meeting_analysis",
        prompt:
          "Analyze this meeting: key decisions, risks, open questions and action items. Be concise and specific.",
        label: "Analyze meeting",
      };
    }
    if (id === "summary") {
      return {
        action: "meeting_summary",
        prompt: "Summarize this meeting in a short paragraph and 3–5 key takeaways.",
        label: "Summarize meeting",
      };
    }
    if (id === "actions") {
      return {
        action: "meeting_action_items",
        prompt: "Extract the decisions and action items from this meeting. Include owners if mentioned.",
        label: "Extract action items",
      };
    }
    if (id === "prep") {
      return {
        action: "meeting_prep_brief",
        prompt:
          "Prepare a brief for this meeting: agenda, key questions, and what to bring based on the notes.",
        label: "Prepare meeting brief",
      };
    }
    if (id === "followup") {
      return {
        action: "meeting_followup_email",
        prompt: "Draft a concise follow-up email with decisions, owners and next steps.",
        label: "Draft follow-up email",
      };
    }
    return {
      action: "meeting_transcript_qa",
      prompt: aiDraft.trim(),
      label: "Ask about this meeting",
    };
  };

  const requestMeetingAI = async (action: string, prompt: string, label: string) => {
    setLastCharge(null);
    setAiAnswer("Pricing…");
    try {
      const estimate = await estimateAIAction(action, prompt.length + meetingAIContext.length);
      if (!estimate.allowed) {
        const message = estimate.reasons.includes("PAYMENT_GRACE_EXPIRED")
          ? "AI is paused because this subscription is past due."
          : estimate.reasons.includes("INSUFFICIENT_CREDITS")
            ? `You need ${Math.max(0, estimate.minCredits - estimate.available)} more credits for this.`
            : estimate.reasons.includes("INPUT_TOO_LARGE")
              ? `This transcript is too large. The limit is ${estimate.maxInputTokens.toLocaleString()} tokens.`
              : "This action is temporarily unavailable.";
        setAiAnswer(message);
        toast(message, { tone: "danger" });
        return;
      }
      setPendingAI({ action, prompt, label, estimate });
      setAiAnswer(null);
    } catch (err) {
      setAiAnswer(null);
      toast((err as Error).message, { tone: "danger" });
    }
  };

  const confirmMeetingAI = async () => {
    if (!pendingAI) return;
    const { action, prompt } = pendingAI;
    setPendingAI(null);
    setAiBusy(true);
    setAiAnswer("Thinking…");
    try {
      await streamAIChat(
        { action, prompt, context: meetingAIContext, history: [] },
        setAiAnswer,
        (info) => {
          setLastCharge({ charged: info.charged, available: info.available });
          reloadCredits();
          toast(
            `${info.charged} credit${info.charged === 1 ? "" : "s"} used · ${info.available} remaining`,
            { tone: "success" },
          );
        },
      );
    } catch (err) {
      setAiAnswer(null);
      toast((err as Error).message, { tone: "danger" });
    } finally {
      setAiBusy(false);
    }
  };

  const runMeetingAI = (id: string) => {
    if (selected?.transcriptId == null) {
      toast("This meeting has no transcript yet", { tone: "danger" });
      return;
    }
    if (!gatewayEnabled) {
      if (id === "summary") {
        os.storeMeetingReport(selected.transcriptId, now);
        setDetailTab("summary");
        setAiAnswer("Local summary updated in the Summary tab.");
        return;
      }
      if (id === "actions") {
        setProposedTitles(new Set());
        setProposals(os.meetingProposals(selected.transcriptId, now));
        setAiAnswer("Local action items are ready in the rail.");
        return;
      }
      if (id === "analyze") {
        setAiAnswer(report?.summary ?? "Run Summarize first to build a local meeting analysis.");
        return;
      }
      if (id === "prep") {
        setAiAnswer(
          `Prep for “${meeting?.title ?? "this meeting"}”: review the agenda, list 3 questions, and bring the latest notes.`,
        );
        return;
      }
      if (id === "followup") {
        setAiAnswer(
          `Hi all — thanks for the discussion. Decisions: ${report?.decisions?.map((d) => d.text).join("; ") || "see notes"}. Next steps are in the action items.`,
        );
        return;
      }
      const query = aiDraft.trim();
      if (!query) {
        setAiAnswer("Ask a question about this meeting.");
        return;
      }
      const matches = transcript?.segments.filter((segment) =>
        `${segment.speaker} ${segment.text}`.toLowerCase().includes(query.toLowerCase()),
      ) ?? [];
      setAiAnswer(
        matches.length > 0
          ? matches.slice(0, 3).map((segment) => `${segment.speaker}: ${segment.text}`).join("\n")
          : `Nothing in this transcript matches “${query}”.`,
      );
      return;
    }
    const meta = meetingAIMeta(id);
    if (!meta.prompt) {
      setAiAnswer("Ask a question about this meeting.");
      return;
    }
    void requestMeetingAI(meta.action, meta.prompt, meta.label);
  };

  const saveMeeting = (value: MeetingDialogValue) => {
    const attendees = value.attendees.map((attendee) => ({
      id: crypto.randomUUID(),
      name: attendee.name,
      email: attendee.email,
    }));
    const recurrenceRule =
      value.recurrence === "none" ? null : { freq: value.recurrence, interval: 1 };

    if (editor?.mode === "edit") {
      os.updateMeeting(editor.id, {
        title: value.title,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        location: value.location,
        notes: value.notes,
        status: value.status,
        attendees,
        projectId: value.projectId,
        tags: value.tags,
      });
      if (value.reminderAt != null) os.addMeetingReminder(editor.id, value.reminderAt, now);
      toast("Meeting updated");
      return;
    }

    const created =
      recurrenceRule != null
        ? os.addMeetingSeries(
            {
              title: value.title,
              startsAt: value.startsAt,
              endsAt: value.endsAt,
              notes: value.notes,
              attendees,
              projectId: value.projectId,
              tags: value.tags,
              recurrence: recurrenceRule,
            },
            value.occurrences,
            now,
          )
        : [
            os.addMeeting({
              title: value.title,
              startsAt: value.startsAt,
              endsAt: value.endsAt,
              notes: value.notes,
              attendees,
              projectId: value.projectId,
              tags: value.tags,
            }),
          ];

    const leadMs = value.reminderAt != null ? Math.max(0, value.startsAt - value.reminderAt) : null;
    for (const meeting of created) {
      os.updateMeeting(meeting.id, { location: value.location, status: value.status });
      if (leadMs != null) os.addMeetingReminder(meeting.id, meeting.startsAt - leadMs, now);
    }

    setSelectedId(created[0]!.id);
    setTab("all");
    toast(
      created.length > 1
        ? `${created.length} meetings scheduled`
        : "Meeting scheduled",
    );
  };

  const saveNotes = (notes: string) => {
    if (selectedId == null) return;
    os.updateMeeting(selectedId, { notes });
    toast("Notes saved");
  };

  const updateTranscriptSegments = (
    segments: { speaker: string; text: string; startMs: number; endMs: number }[],
  ) => {
    if (transcript == null) return;
    os.updateTranscript(transcript.id, {
      segments,
      fullText: segments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\\n"),
      updatedAt: now,
    });
  };

  const addActionItem = (title: string, dueAt: number | null) => {
    if (selectedId == null) return;
    os.addActionItem({
      title,
      meetingId: selectedId,
      transcriptId: transcript?.id ?? null,
      dueAt,
    });
    toast("Action item added");
  };

  const deleteActionItem = (item: ActionItem) => {
    os.updateActionItem(item.id, { status: "dismissed" });
    toast("Action item removed");
  };

  const bulkCreateTasks = () => {
    let created = 0;
    for (const item of actionItems) {
      if (item.taskId != null) continue;
      const task = os.addTask({ title: item.title, dueAt: item.dueAt, assigneeId: item.assigneeId });
      os.updateActionItem(item.id, { taskId: task.id, status: "converted" });
      created += 1;
    }
    toast(created > 0 ? `${created} task${created === 1 ? "" : "s"} created` : "Every action item is already a task");
  };

  const exportMarkdown = () => {
    if (!meeting) return;
    const lines: string[] = [`# ${meeting.title}`, ""];
    lines.push(
      `**Date:** ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(meeting.startsAt))}`,
    );
    if (meeting.location) lines.push(`**Location:** ${meeting.location}`);
    if (meeting.notes) lines.push("", "## Notes", "", meeting.notes);
    if (report?.summary) lines.push("", "## Summary", "", report.summary);
    if (report?.keyPoints.length) lines.push("", "## Key takeaways", "", ...report.keyPoints.map((point) => `- ${point}`));
    if (report?.decisions.length) {
      lines.push("", "## Decisions", "", ...report.decisions.map((decision) => `- ${decision.text} (${decision.speaker})`));
    }
    if (actionItems.length) {
      lines.push(
        "",
        "## Action items",
        "",
        ...actionItems.map((item) => `- [${item.status === "done" ? "x" : " "}] ${item.title}`),
      );
    }
    if (transcript?.segments.length) {
      lines.push(
        "",
        "## Transcript",
        "",
        ...transcript.segments.map(
          (segment) => `**${segment.speaker}** (${Math.floor(segment.startMs / 60000)}:${String(Math.floor((segment.startMs % 60000) / 1000)).padStart(2, "0")}): ${segment.text}`,
        ),
      );
    }
    downloadText(`${safeFileName(meeting.title || "meeting")}.md`, lines.join("\\n"));
    toast("Meeting exported as Markdown");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        testId="meeting-header"
        icon={Video}
        title="Meetings & AI Transcription"
        subtitle="Record, transcribe, summarize and turn meetings into actionable tasks."
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => setRecorder("record")}
              data-testid="meeting-start-recording"
            >
              <Radio className="size-4 text-danger" aria-hidden="true" />
              Start Recording
            </Button>
            <Button variant="secondary" onClick={() => setRecorder("import")} data-testid="meeting-import-audio">
              <Download className="size-4" aria-hidden="true" />
              Import Audio
            </Button>
            <Button
              variant="secondary"
              onClick={() => setEditor({ mode: "create" })}
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              Schedule Meeting
            </Button>
            <DropdownMenu
              align="end"
              sections={[
                {
                  label: "Meetings",
                  items: [
                    { label: "Summarise transcript", onSelect: summarise },
                    { label: "Export meeting as Markdown", onSelect: exportMarkdown },
                    { label: "Record a meeting", onSelect: () => setRecorder("record") },
                    { label: "Import a transcript", onSelect: () => setRecorder("import") },
                  ],
                },
              ]}
              trigger={
                <Button variant="secondary" size="icon" aria-label="Meeting page options">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              }
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Meeting sections">
        {WORKSPACE_TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            data-testid={`meeting-tab-${entry.value}`}
            aria-selected={tab === entry.value}
            onClick={() => setTab(entry.value)}
            className={
              tab === entry.value
                ? "rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-colors"
                : "rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
            }
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "all" ? (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <MeetingListPanel
            groups={groups}
            selectedId={selectedId}
            query={query}
            onQueryChange={setQuery}
            onSelect={(id) => {
              setSelectedId(id);
              setDetailTab("transcript");
            }}
            onFilter={setFilter}
            filterLabel={FILTERS.find((entry) => entry.value === filter)?.label ?? "All meetings"}
          />

          <div className="min-w-0 space-y-4">
            <MeetingDetail
              meeting={meeting}
              transcript={transcript}
              report={report}
              actionItems={actionItems}
              tab={detailTab}
              onTabChange={setDetailTab}
              onToggleActionItem={toggleActionItem}
              onConvertActionItem={convertActionItem}
              onExtract={extract}
              onEdit={() => {
                const target = os.getMeeting(selectedId!);
                if (target) setEditor({ mode: "edit", id: target.id });
              }}
              onDelete={() => setDeleteId(selectedId)}
              onSaveNotes={saveNotes}
              audioUrl={audioUrl}
              onUpdateSegments={updateTranscriptSegments}
              onAddActionItem={addActionItem}
              onDeleteActionItem={deleteActionItem}
              onExport={exportMarkdown}
              onDeleteTranscript={() => setTranscriptDeleteId(transcript?.id ?? null)}
              onBulkCreateTasks={bulkCreateTasks}

              onRenameSpeaker={(from, to) => {
                if (transcript == null) return;
                os.renameTranscriptSpeaker(transcript.id, from, to);
                toast(`${from} is now ${to}`);
              }}
            />

            {proposals && candidateProposals.length > 0 ? (
              <section
                className="rounded-2xl border border-line bg-surface p-4 shadow-card"
                data-testid="meeting-extracted"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Extracted tasks and events ({candidateProposals.length}) - nothing is created until you accept
                </h3>
                <ul className="mt-3 space-y-2">
                  {candidateProposals.map((proposal, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{proposal.title}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">{proposal.summary}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
                          {proposal.risk}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            os.aiSaveProposal(proposal, now);
                            setProposedTitles((current) => new Set(current).add(proposal.title));
                          }}
                        >
                          Propose
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {pendingObjects.length > 0 ? (
              <section className="rounded-2xl border border-line bg-surface p-4 shadow-card" data-testid="meeting-pending">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Waiting for confirmation
                </h3>
                <div className="space-y-2">
                  {pendingObjects.map((object) => (
                    <AIObjectCard
                      key={object.id}
                      object={object}
                      onAccept={() => {
                        const applied = os.aiAcceptProposal(object.id, now);
                        toast(applied.message, { tone: applied.ok ? "success" : "danger" });
                      }}
                      onDismiss={() => {
                        os.aiDismissProposal(object.id);
                        toast("Proposal dismissed");
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <MeetingInsights
              stats={dashboard.stats}
              topics={dashboard.topics}
              participants={dashboard.participants}
              period={period}
              onPeriodChange={setPeriod}
            />
          </div>

          <MeetingAIAssistant
            draft={aiDraft}
            onDraftChange={setAiDraft}
            answer={aiAnswer}
            onRun={runMeetingAI}
            creditsNote={
              gatewayEnabled
                ? lastCharge
                  ? `${lastCharge.charged} credits used · ${lastCharge.available} remaining`
                  : balance
                    ? `GPT 6 Luna · ${balance.available} credits available`
                    : "GPT 6 Luna · charges apply"
                : "Local — no credits"
            }
          />
          <MeetingRail
            report={report}
            actionItems={actionItems}
            onToggleActionItem={toggleActionItem}
            onConvertActionItem={convertActionItem}
          />
        </div>
      ) : null}

      {tab === "transcripts" ? (
        <section
          aria-label="Transcripts"
          data-testid="meeting-transcripts-panel"
          className="rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <h2 className="mb-3 text-sm font-semibold text-ink">Transcripts ({dashboard.transcripts.length})</h2>
          {dashboard.transcripts.length === 0 ? (
            <p className="text-[13px] text-ink-3">No transcripts yet. Record or import one to get started.</p>
          ) : (
            <ul className="space-y-1.5">
              {dashboard.transcripts.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const row = dashboard.rows.find((item) => item.transcriptId === entry.id);
                      if (row) {
                        setSelectedId(row.id);
                        setTab("all");
                        setDetailTab("transcript");
                        return;
                      }
                      const meeting = os.addMeeting({
                        title: entry.title,
                        startsAt: entry.createdAt,
                        endsAt: entry.createdAt + 3_600_000,
                      });
                      os.updateMeeting(meeting.id, { status: "completed" });
                      os.updateTranscript(entry.id, { meetingId: meeting.id });
                      setSelectedId(meeting.id);
                      setTab("all");
                      setDetailTab("transcript");
                      toast("Linked this transcript to a new meeting");
                    }}
                    className="w-full rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="block truncate text-[13px] font-medium text-ink">{entry.title}</span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {entry.segments.length} segments · {entry.aiSummary || entry.fullText.slice(0, 90)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setShowTrashedTranscripts((value) => !value)}
              className="text-[11px] font-medium text-ink-3 hover:text-ink"
            >
              {showTrashedTranscripts ? "Hide deleted transcripts" : "Show deleted transcripts"}
            </button>
            {showTrashedTranscripts ? (
              <ul className="mt-2 space-y-1.5" data-testid="meeting-transcript-trash">
                {Object.values(state.transcripts)
                  .filter((entry) => entry.status === "trashed")
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{entry.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          os.restoreTranscript(entry.id);
                          toast("Transcript restored");
                        }}
                        className="text-[11px] font-medium text-accent-ink hover:underline"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          os.deleteTranscript(entry.id);
                          toast("Transcript deleted permanently");
                        }}
                        className="text-[11px] font-medium text-danger hover:underline"
                      >
                        Delete permanently
                      </button>
                    </li>
                  ))}
                {Object.values(state.transcripts).filter((entry) => entry.status === "trashed").length === 0 ? (
                  <li className="text-[12px] text-ink-3">Trash is empty.</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "summaries" ? (
        <section
          aria-label="Summaries"
          data-testid="meeting-summaries-panel"
          className="rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <h2 className="mb-3 text-sm font-semibold text-ink">Summaries</h2>
          {dashboard.rows.filter((row) => row.hasSummary).length === 0 ? (
            <p className="text-[13px] text-ink-3">No summaries yet. Summarise a transcript to create one.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.rows
                .filter((row) => row.hasSummary)
                .map((row) => (
                  <li key={row.id} className="rounded-xl border border-line p-3">
                    <p className="text-[13px] font-semibold text-ink">{row.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{row.summary}</p>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "actions" ? (
        <section
          aria-label="Action Items"
          data-testid="meeting-actions-panel"
          className="rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Action Items ({dashboard.actionItems.length})
          </h2>
          {dashboard.actionItems.length === 0 ? (
            <p className="text-[13px] text-ink-3">No action items yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {dashboard.actionItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                  <ListChecks className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{item.title}</span>
                  {item.taskId != null ? (
                    <span className="text-[11px] text-success">Task</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => convertActionItem(item)}
                      className="text-[11px] font-medium text-accent-ink hover:underline"
                    >
                      Create task
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "calendar" ? (
        <MeetingCalendar
              meetings={Object.values(state.meetings)
                .filter((entry) => entry.status !== "archived")
                .map((entry) => ({ id: entry.id, title: entry.title, startsAt: entry.startsAt }))}
              onSelect={(id) => {
                setSelectedId(id);
                setTab("all");
              }}
            />
      ) : null}

      {tab === "insights" ? (
        <MeetingInsights
          stats={dashboard.stats}
          topics={dashboard.topics}
          participants={dashboard.participants}
          period={period}
          onPeriodChange={setPeriod}
        />
      ) : null}

      {dashboard.rows.length === 0 && tab !== "insights" ? (
        <EmptyState
          icon={Video}
          title="No meetings yet"
          description="Record one live or import a transcript and it becomes searchable, summarised and ready to turn into tasks."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={() => setRecorder("record")}>
                Start recording
              </Button>
              <Button variant="secondary" onClick={() => setRecorder("import")}>
                Import audio
              </Button>
            </div>
          }
        />
      ) : null}

      <Modal
        open={recorder != null}
        onClose={() => setRecorder(null)}
        title={recorder === "record" ? "Record a meeting" : "Import a transcript"}
        size="lg"
      >
        {recorder === "record" ? (
          <LiveRecorder
            onDone={(meetingId) => {
              setRecorder(null);
              if (meetingId) {
                setSelectedId(meetingId);
                setTab("all");
              }
            }}
          />
        ) : null}
        {recorder === "import" ? (
          <ImportRecorder
            onDone={(meetingId) => {
              setRecorder(null);
              if (meetingId) {
                setSelectedId(meetingId);
                setTab("all");
              }
            }}
          />
        ) : null}
      </Modal>

      <MeetingDialog
        open={editor != null}
        onClose={() => setEditor(null)}
        onSave={saveMeeting}
        initial={editor?.mode === "edit" ? os.getMeeting(editor.id) : null}
        projects={Object.values(state.projects).map((project) => ({ id: project.id, name: project.name }))}
      />

      <ConfirmDialog
        open={transcriptDeleteId != null}
        onClose={() => setTranscriptDeleteId(null)}
        onConfirm={() => {
          if (transcriptDeleteId != null) os.deleteTranscript(transcriptDeleteId);
          setTranscriptDeleteId(null);
          toast("Transcript moved to trash");
        }}
        title="Delete this transcript?"
        description="The transcript is moved to trash. You can restore it from the Transcripts tab."
        confirmLabel="Delete transcript"
      />

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId != null) os.deleteMeeting(deleteId);
          setDeleteId(null);
          toast("Meeting deleted");
        }}
        title="Delete this meeting?"
        description="The meeting is removed. Its transcript and action items stay available."
        confirmLabel="Delete meeting"
      />

      <CreditConfirmDialog
        open={pendingAI != null}
        label={pendingAI?.label ?? "AI action"}
        estimate={pendingAI?.estimate ?? null}
        busy={aiBusy}
        onClose={() => setPendingAI(null)}
        onConfirm={() => void confirmMeetingAI()}
      />
    </div>
  );
}

function MeetingCalendar({
  meetings,
  onSelect,
}: {
  meetings: { id: ID; title: string; startsAt: Timestamp }[];
  onSelect: (id: ID) => void;
}) {
  const now = Date.now();
  const [anchor, setAnchor] = React.useState(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  });

  const first = new Date(anchor);
  const gridStart = new Date(first);
  gridStart.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index),
  );

  const shift = (delta: number) => {
    setAnchor((current) => {
      const date = new Date(current);
      date.setMonth(date.getMonth() + delta);
      return date.getTime();
    });
  };

  return (
    <section
      aria-label="Meeting Calendar"
      data-testid="meeting-calendar"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(first)}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-2 hover:bg-surface-2"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setDate(1);
              date.setHours(0, 0, 0, 0);
              setAnchor(date.getTime());
            }}
            className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-2 hover:bg-surface-2"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-2 hover:bg-surface-2"
          >
            Next
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label} className="bg-surface-2 px-2 py-1.5 text-[10px] font-semibold uppercase text-ink-3">
            {label}
          </span>
        ))}
        {days.map((day) => {
          const items = meetings.filter(
            (meeting) => new Date(meeting.startsAt).toDateString() === day.toDateString(),
          );
          const inMonth = day.getMonth() === first.getMonth();
          const isToday = day.toDateString() === new Date(now).toDateString();
          return (
            <div key={day.toISOString()} className="min-h-20 bg-surface p-1.5">
              <span
                className={
                  isToday
                    ? "grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white"
                    : `grid size-5 place-items-center rounded-full text-[11px] ${inMonth ? "text-ink" : "text-ink-3/60"}`
                }
              >
                {day.getDate()}
              </span>
              {items.slice(0, 2).map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => onSelect(meeting.id)}
                  className="mt-1 block w-full truncate rounded bg-accent-soft px-1 py-0.5 text-left text-[10px] text-accent-ink"
                >
                  {meeting.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
