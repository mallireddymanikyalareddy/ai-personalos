import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  identifySpeakers,
  renameSpeaker,
  extractActionItems,
  extractDecisions,
  buildMeetingReport,
  proposeFromReport,
  searchTranscripts,
  appendLiveSegment,
  normalizedSegments,
  segmentStats,
} from "./engine";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

const SEGMENTS = [
  { speaker: "Speaker 1", startMs: 0, endMs: 2000, text: "Let's talk about the launch date for November." },
  { speaker: "Speaker 2", startMs: 2000, endMs: 4000, text: "We decided to ship on the 14th, but pricing has to be final first." },
  { speaker: "Speaker 1", startMs: 4000, endMs: 6000, text: "I will send the pricing sheet to finance today." },
  { speaker: "Speaker 2", startMs: 6000, endMs: 8000, text: "Can you schedule the review call with the team for Friday?" },
  { speaker: "Speaker 1", startMs: 8000, endMs: 10000, text: "Sure, and we agreed the marketing budget stays at twenty thousand." },
];

function addTranscript(os: PersonalOS, withMeeting = true) {
  const meeting = withMeeting ? os.addMeeting({ title: "Launch sync", startsAt: NOW }) : null;
  return os.importTranscript(
    {
      title: "Launch sync",
      source: withMeeting ? "meeting" : "upload",
      meetingId: meeting?.id ?? null,
      recordingId: null,
    },
    SEGMENTS,
    NOW,
  );
}

describe("Meeting Intelligence: speakers", () => {
  it("identifies speakers with segment and word counts", () => {
    const os = makeOS();
    const transcript = addTranscript(os);

    const speakers = identifySpeakers(transcript, NOW);
    expect(speakers).toHaveLength(2);
    expect(speakers[0]!.segments).toBeGreaterThan(0);
    expect(speakers[0]!.words).toBeGreaterThan(0);
    expect(speakers.every((speaker) => speaker.confidence > 0)).toBe(true);
  });

  it("renames a speaker across every segment", () => {
    const os = makeOS();
    const transcript = addTranscript(os);

    const renamed = os.renameTranscriptSpeaker(transcript.id, "Speaker 1", "Ada");
    expect(renamed!.segments.filter((segment) => segment.speaker === "Ada").length).toBeGreaterThan(1);
    expect(renamed!.segments.some((segment) => segment.speaker === "Speaker 1")).toBe(false);
    expect(renameSpeaker(transcript, "Speaker 2", "Grace").every((segment) => segment.speaker !== "Speaker 2")).toBe(true);
  });
});

describe("Meeting Intelligence: extraction", () => {
  it("extracts action items with dates and durations", () => {
    const os = makeOS();
    const transcript = addTranscript(os);

    const items = extractActionItems(transcript, NOW);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((item) => item.title.toLowerCase().includes("pricing sheet"))).toBe(true);
    expect(items.some((item) => item.dueAt != null)).toBe(true);
    expect(items.every((item) => item.confidence > 0.5)).toBe(true);
  });

  it("extracts decisions separately from action items", () => {
    const os = makeOS();
    const transcript = addTranscript(os);

    const decisions = extractDecisions(transcript);
    expect(decisions.length).toBeGreaterThanOrEqual(2);
    expect(decisions.some((decision) => /we decided/i.test(decision.text))).toBe(true);
    expect(decisions.some((decision) => /we agreed/i.test(decision.text))).toBe(true);
  });

  it("builds a full report joining speakers, decisions and action items", () => {
    const os = makeOS();
    const transcript = addTranscript(os);

    const report = buildMeetingReport(os.getState(), transcript.id, NOW)!;
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.keyPoints.length).toBeGreaterThan(0);
    expect(report.speakers).toHaveLength(2);
    expect(report.decisions.length).toBeGreaterThan(0);
    expect(report.actionItems.length).toBeGreaterThan(0);
    expect(report.segmentCount).toBe(5);
    expect(report.wordCount).toBeGreaterThan(20);
    expect(report.durationMin).toBe(1);
  });
});

describe("Meeting Intelligence: the workflow", () => {
  it("runs RECORD → TRANSCRIBE → SUMMARIZE → EXTRACT → CONFIRM → CREATE", () => {
    const os = makeOS();

    const { meeting, transcript } = os.startLiveTranscription({ title: "Standup", meetingId: null }, NOW);
    expect(os.getTranscript(transcript.id)!.status).toBe("processing");

    let session = {
      transcriptId: transcript.id,
      recordingId: null,
      meetingId: meeting.id,
      startedAt: NOW,
      segments: [] as typeof SEGMENTS,
    };
    for (const segment of SEGMENTS) {
      session = appendLiveSegment({ ...session }, segment, NOW) as typeof session;
    }
    const stats = segmentStats(session as never);
    expect(stats.speakers).toBe(2);

    for (const segment of session.segments) {
      os.appendTranscriptSegment(transcript.id, { speaker: segment.speaker, text: segment.text, at: NOW + segment.endMs });
    }
    const finished = os.finishLiveTranscription(transcript.id)!;
    expect(finished.status).toBe("ready");
    expect(finished.segments).toHaveLength(5);
    expect(finished.fullText).toContain("pricing sheet");

    const report = os.storeMeetingReport(transcript.id)!;
    expect(report.summary.length).toBeGreaterThan(0);
    expect(os.getTranscript(transcript.id)!.aiSummary).toBe(report.summary);
    expect(os.getTranscript(transcript.id)!.aiDecisions.length).toBeGreaterThan(0);

    const proposals = os.meetingProposals(transcript.id)!;
    expect(proposals.tasks.length).toBeGreaterThan(0);
    expect(proposals.meeting).not.toBeNull();

    for (const proposal of proposals.tasks) {
      expect(proposal.requiresConfirmation).toBe(true);
      expect(proposal.risk).toBe("low");
      const stored = os.aiSaveProposal(proposal, NOW);
      expect(os.getState().tasks[stored.id]).toBeUndefined();
    }

    const first = os.aiSaveProposal(proposals.tasks[0]!, NOW);
    const applied = os.aiAcceptProposal(first.id, NOW);
    expect(applied.ok).toBe(true);
    expect(applied.taskIds.length).toBe(1);
    expect(os.getState().aiObjects[first.id]!.status).toBe("accepted");

    const createdTask = os.getTask(applied.taskIds[0]!);
    expect(createdTask).not.toBeNull();
    expect(Object.values(os.getState().actionItems).some((item) => item.taskId === createdTask!.id)).toBe(true);
  });

  it("proposes a calendar event only inside a genuinely free slot", () => {
    const os = makeOS();
    const transcript = addTranscript(os);
    const proposals = os.meetingProposals(transcript.id)!;

    for (const event of proposals.events) {
      expect(event.requiresConfirmation).toBe(true);
      expect(event.risk).toBe("medium");
      const start = event.payload.startsAt as number;
      const end = event.payload.endsAt as number;
      expect(end).toBeGreaterThan(start);

      const overlapping = Object.values(os.getState().events).some(
        (other) => other.startsAt < end && other.endsAt > start,
      );
      expect(overlapping).toBe(false);

      const stored = os.aiSaveProposal(event, NOW);
      const applied = os.aiAcceptProposal(stored.id, NOW);
      expect(applied.ok).toBe(true);
      expect(applied.eventIds).toHaveLength(1);
    }
  });

  it("never creates anything before confirmation", () => {
    const os = makeOS();
    const transcript = addTranscript(os);
    const proposals = os.meetingProposals(transcript.id)!;

    const before = {
      tasks: Object.keys(os.getState().tasks).length,
      events: Object.keys(os.getState().events).length,
      actionItems: Object.keys(os.getState().actionItems).length,
    };

    for (const proposal of [...proposals.tasks, ...proposals.events]) os.aiSaveProposal(proposal);

    expect(Object.keys(os.getState().tasks)).toHaveLength(before.tasks);
    expect(Object.keys(os.getState().events)).toHaveLength(before.events);
    expect(Object.keys(os.getState().actionItems)).toHaveLength(before.actionItems);

    for (const object of os.aiPendingProposals()) os.aiDismissProposal(object.id);

    expect(os.aiPendingProposals()).toHaveLength(0);
    expect(Object.keys(os.getState().tasks)).toHaveLength(before.tasks);
    expect(Object.keys(os.getState().events)).toHaveLength(before.events);
  });

  it("connects the meeting record to the canonical task and calendar engines", () => {
    const os = makeOS();
    const transcript = addTranscript(os);
    const proposals = os.meetingProposals(transcript.id)!;

    const taskProposal = proposals.tasks[0]!;
    const eventProposal = proposals.events[0];

    const storedTask = os.aiSaveProposal(taskProposal, NOW);
    const appliedTask = os.aiAcceptProposal(storedTask.id, NOW);
    const taskId = appliedTask.taskIds[0]!;

    expect(os.getTask(taskId)?.status).toBe("inbox");
    if (taskProposal.payload.dueAt != null) {
      expect(os.getTask(taskId)?.dueAt).toBe(taskProposal.payload.dueAt);
    }

    if (eventProposal) {
      const storedEvent = os.aiSaveProposal(eventProposal, NOW);
      const appliedEvent = os.aiAcceptProposal(storedEvent.id, NOW);
      const eventId = appliedEvent.eventIds[0]!;
      const event = os.getState().events[eventId]!;
      expect(event.title).toBe(eventProposal.payload.title);
      expect(event.source).toBe("ai");

      const dayView = os.getDayView(new Date(event.startsAt).getTime(), NOW);
      expect(dayView.events.some((entry) => entry.id === eventId)).toBe(true);
    }
  });
});

describe("Meeting Intelligence: notes and search", () => {
  it("keeps searchable transcripts queryable by content", () => {
    const os = makeOS();
    addTranscript(os);
    os.addNote({ title: "Unrelated note", body: "Nothing about launches here." });

    const results = os.searchTranscripts("pricing", {});
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.transcript.fullText).toContain("pricing");
  });

  it("filters transcript search by meeting", () => {
    const os = makeOS();
    const transcript = addTranscript(os);
    os.searchTranscripts("pricing", {});
    expect(os.searchTranscripts("pricing", { meetingId: transcript.meetingId! }).length).toBeGreaterThan(0);
    expect(os.searchTranscripts("pricing", { meetingId: "missing" })).toHaveLength(0);
  });

  it("stores meeting notes on the meeting record", () => {
    const os = makeOS();
    const meeting = os.addMeeting({ title: "Design review", startsAt: NOW, notes: "" });
    os.updateMeeting(meeting.id, { notes: "Three options were presented." });
    expect(os.getMeeting(meeting.id)?.notes).toBe("Three options were presented.");
  });

  it("imports a recording with an attached transcript", () => {
    const os = makeOS();
    const recording = os.addRecording({ title: "Imported call", startedAt: NOW });
    const transcript = os.importTranscript(
      { title: "Imported call", source: "recording", meetingId: null, recordingId: recording.id },
      [{ speaker: "Speaker 1", startMs: 0, endMs: 1000, text: "We launched the beta." }],
      NOW,
    );

    expect(transcript.status).toBe("ready");
    expect(os.getRecording(recording.id)!.status).toBe("ready");
    expect(os.transcriptsNeedingAudio()).toHaveLength(0);
    expect(normalizedSegments(transcript)).toHaveLength(1);
  });

  it("lists recordings that still have no transcript", () => {
    const os = makeOS();
    os.importRecording({ title: "Needs work", startedAt: NOW });
    expect(os.transcriptsNeedingAudio()).toHaveLength(1);
  });

  it("hard-deletes only from trash", () => {
    const os = makeOS();
    const recording = os.addRecording({ title: "Temporary", startedAt: NOW });

    os.deleteRecording(recording.id);
    expect(os.getRecording(recording.id)?.status).toBe("trashed");
    expect(os.recordings()).toHaveLength(0);

    os.deleteRecording(recording.id);
    expect(os.getRecording(recording.id)).toBeNull();
  });
});
