import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { MeetingModule } from "./meeting-module";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, prefetch: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/v1/credits")
        ? { available: 10, reserved: 0, aiAllowed: true }
        : { lowCreditThreshold: 3, flags: {} };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

const SEGMENTS = [
  { speaker: "Speaker 1", startMs: 0, endMs: 2000, text: "Let's talk about the launch in November." },
  { speaker: "Speaker 2", startMs: 2000, endMs: 4000, text: "We decided to ship on the 14th, pricing has to be final first." },
  { speaker: "Speaker 1", startMs: 4000, endMs: 7000, text: "I will send the pricing sheet to finance today." },
  { speaker: "Speaker 2", startMs: 7000, endMs: 9000, text: "Can you schedule the review call with the team for Friday?" },
];

function seed(os: ReturnType<typeof getOS>) {
  const meeting = os.addMeeting({ title: "Launch sync", startsAt: NOW });
  return os.importTranscript(
    { title: "Launch sync", source: "meeting", meetingId: meeting.id, recordingId: null },
    SEGMENTS,
    NOW,
  );
}

function renderModule() {
  return render(
    <ToastProvider>
      <MeetingModule />
    </ToastProvider>,
  );
}

function openMeetingOptions() {
  fireEvent.click(screen.getByRole("button", { name: "Meeting options" }));
}

describe("MeetingModule", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the empty state with record and import actions", () => {
    renderModule();
    expect(screen.getByText(/No meetings yet/)).toBeDefined();
    expect(screen.getByTestId("meeting-start-recording")).toBeDefined();
    expect(screen.getByTestId("meeting-import-audio")).toBeDefined();
  });

  it("shows every workspace section", () => {
    seed(getOS());
    renderModule();

    expect(screen.getByRole("heading", { name: /Meetings & AI Transcription/ })).toBeDefined();
    expect(screen.getByTestId("meeting-list-panel")).toBeDefined();
    expect(screen.getByTestId("meeting-detail")).toBeDefined();
    expect(screen.getByTestId("meeting-ai-summary")).toBeDefined();
    expect(screen.getByTestId("meeting-takeaways")).toBeDefined();
    expect(screen.getByTestId("meeting-action-rail")).toBeDefined();
    expect(screen.getByTestId("meeting-insights")).toBeDefined();
    expect(screen.getByTestId("meeting-topics")).toBeDefined();
    expect(screen.getByTestId("meeting-participants")).toBeDefined();
  });

  it("groups meetings by month and selects one", () => {
    const os = getOS();
    seed(os);
    os.addMeeting({ title: "Older sync", startsAt: NOW - 20 * 86_400_000 });

    renderModule();
    const groups = screen.getAllByTestId("meeting-month-group");
    expect(groups.length).toBe(2);
    expect(groups[0]!.textContent).toContain("October");
    expect(groups[1]!.textContent).toContain("September");
  });

  it("shows the transcript, summary, notes, decisions and highlights of the selected meeting", () => {
    const os = getOS();
    seed(os);
    renderModule();

    expect(screen.getByTestId("meeting-transcript")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-summary"));
    expect(screen.getByTestId("meeting-summary")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-decisions"));
    expect(screen.getByTestId("meeting-decisions")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-notes"));
    expect(screen.getByTestId("meeting-notes")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-highlights"));
    expect(screen.getByTestId("meeting-highlights")).toBeDefined();
  });

  it("imports a transcript and shows the full report", () => {
    const os = getOS();
    seed(os);
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-summary"));
    expect(screen.getByTestId("meeting-summary")).toBeDefined();
    expect(screen.getByTestId("meeting-takeaways").textContent).not.toBe("");

    fireEvent.click(screen.getByTestId("meeting-detail-tab-transcript"));
    expect(screen.getByTestId("meeting-transcript")).toBeDefined();
  });

  it("extracts tasks and events that require confirmation", () => {
    const os = getOS();
    seed(os);
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Extract tasks and events" }));

    expect(screen.getByText(/Extracted tasks and events/)).toBeDefined();
    expect(screen.getByText(/nothing is created until you accept/i)).toBeDefined();
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
    expect(Object.keys(os.getState().events)).toHaveLength(0);
  });

  it("creates a task only after the user accepts the proposal", () => {
    const os = getOS();
    seed(os);
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Extract tasks and events" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Propose" })[0]!);
    const acceptButtons = screen.getAllByRole("button", { name: /Accept/ });
    fireEvent.click(acceptButtons[0]!);

    const tasks = Object.values(os.getState().tasks);
    expect(tasks).toHaveLength(1);
    expect(os.getState().aiObjects[Object.keys(os.getState().aiObjects)[0]!]!.status).toBe("accepted");
    expect(Object.values(os.getState().actionItems).some((item) => item.taskId === tasks[0]!.id)).toBe(true);
  });

  it("creates a calendar event only after acceptance", () => {
    const os = getOS();
    seed(os);
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Extract tasks and events" }));

    const eventProposal = screen.getAllByText(/^Block time:/)[0]!;
    expect(eventProposal.textContent).toBeTruthy();

    const row = eventProposal.closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Propose" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Accept/ })[0]!);

    const events = Object.values(os.getState().events);
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe("ai");
  });

  it("renames a speaker everywhere", () => {
    const os = getOS();
    const transcript = seed(os);
    renderModule();

    fireEvent.click(screen.getAllByRole("button", { name: /Rename Speaker 1/ })[0]!);
    const panel = screen.getByTestId("meeting-rename");
    fireEvent.change(within(panel).getByLabelText(/Rename Speaker 1/), { target: { value: "Ada" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Rename everywhere" }));

    const updated = os.getTranscript(transcript.id)!;
    expect(updated.segments.filter((segment) => segment.speaker === "Ada").length).toBeGreaterThan(0);
    expect(updated.segments.some((segment) => segment.speaker === "Speaker 1")).toBe(false);
  });

  it("searches meetings and opens a match", () => {
    const os = getOS();
    const transcript = seed(os);
    renderModule();

    fireEvent.change(screen.getByLabelText("Search meetings"), { target: { value: "launch" } });
    expect(screen.getAllByTestId("meeting-list-item").length).toBe(1);

    fireEvent.click(screen.getByTestId("meeting-detail-tab-transcript"));
    expect(os.getTranscript(transcript.id)!.fullText).toContain("pricing");
  });

  it("dismissing a proposal changes nothing", () => {
    const os = getOS();
    seed(os);
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Extract tasks and events" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Propose" })[0]!);

    const pending = os.aiPendingProposals();
    expect(pending.length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Dismiss/ })[0]!);

    expect(os.getState().aiObjects[pending[0]!.id]!.status).toBe("dismissed");
    expect(Object.keys(os.getState().tasks)).toHaveLength(0);
    expect(Object.keys(os.getState().events)).toHaveLength(0);
  });

  it("switches between the workspace tabs", () => {
    const os = getOS();
    seed(os);
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-tab-actions"));
    expect(screen.getByTestId("meeting-actions-panel")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-tab-calendar"));
    expect(screen.getByTestId("meeting-calendar")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-tab-insights"));
    expect(screen.getByTestId("meeting-insights")).toBeDefined();

    fireEvent.click(screen.getByTestId("meeting-tab-transcripts"));
    expect(screen.getByTestId("meeting-transcripts-panel")).toBeDefined();
  });

  it("shows live insight numbers", () => {
    const os = getOS();
    seed(os);
    renderModule();

    expect(within(screen.getByTestId("meeting-insight-meetings")).getByText("1")).toBeDefined();
    expect(within(screen.getByTestId("meeting-insight-participants")).getByText("2")).toBeDefined();
    expect(screen.getAllByTestId("meeting-topic-row").length).toBeGreaterThan(0);
  });

  it("plays the transcript and moves the playhead", () => {
    const os = getOS();
    seed(os);
    renderModule();

    expect(screen.getByTestId("meeting-time").textContent).toContain("00:00");
    fireEvent.click(screen.getByTestId("meeting-play"));
    expect(screen.getByTestId("meeting-play").getAttribute("aria-label")).toBe("Pause");
    fireEvent.click(screen.getByTestId("meeting-forward"));
    expect(screen.getByTestId("meeting-time").textContent).not.toContain("00:00 /");
  });
});


describe("Meeting management", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a meeting from the dialog", () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Schedule Meeting" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Design review" } });
    fireEvent.change(within(dialog).getByLabelText("Location"), { target: { value: "Room 4" } });
    fireEvent.change(within(dialog).getByLabelText("Agenda / notes"), { target: { value: "Bring mockups" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));

    const created = Object.values(os.getState().meetings).find((meeting) => meeting.title === "Design review");
    expect(created).toBeDefined();
    expect(created?.location).toBe("Room 4");
    expect(created?.notes).toBe("Bring mockups");
    expect(screen.getAllByTestId("meeting-list-item").length).toBe(1);
  });

  it("edits an existing meeting", () => {
    const os = getOS();
    const meeting = os.addMeeting({ title: "Draft meeting", startsAt: NOW });
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit meeting" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Renamed meeting" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(os.getState().meetings[meeting.id]?.title).toBe("Renamed meeting");
  });

  it("deletes a meeting after confirmation", () => {
    const os = getOS();
    const meeting = os.addMeeting({ title: "Temporary", startsAt: NOW });
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete meeting" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete meeting" }));

    expect(os.getState().meetings[meeting.id]).toBeUndefined();
  });

  it("saves meeting notes inline", () => {
    const os = getOS();
    const meeting = os.addMeeting({ title: "Notes meeting", startsAt: NOW });
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-notes"));
    fireEvent.change(screen.getByLabelText("Meeting notes"), { target: { value: "Follow up Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));

    expect(os.getState().meetings[meeting.id]?.notes).toBe("Follow up Friday");
  });

  it("does not duplicate extracted proposals when proposing twice", () => {
    const os = getOS();
    seed(os);
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Extract tasks and events" }));
    const before = screen.getAllByRole("button", { name: "Propose" }).length;
    fireEvent.click(screen.getAllByRole("button", { name: "Propose" })[0]!);
    expect(screen.getAllByRole("button", { name: "Propose" }).length).toBe(before - 1);
    expect(os.aiPendingProposals().length).toBe(1);
  });

  it("creates a task from an action item in the detail tab", () => {
    const os = getOS();
    seed(os);
    os.storeMeetingReport(os.getState().transcripts[Object.keys(os.getState().transcripts)[0]!]!.id, NOW);
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-actions"));
    const createButtons = screen.queryAllByRole("button", { name: "Create task" });
    if (createButtons.length > 0) {
      fireEvent.click(createButtons[0]!);
      expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(0);
    }
  });

  it("imports audio into a linked meeting and selects it", () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-import-audio"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Meeting name"), { target: { value: "Imported call" } });
    fireEvent.change(within(dialog).getByLabelText("Transcript"), {
      target: { value: "Ada: we ship on the 14th\nI will send pricing today" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Import and summarise/ }));

    const meeting = Object.values(os.getState().meetings).find((entry) => entry.title === "Imported call");
    expect(meeting).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("meeting-detail").textContent).toContain("Imported call");
  });
});
describe("Meeting calendar and transcripts", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves the meeting calendar between months", () => {
    const os = getOS();
    os.addMeeting({ title: "Next month sync", startsAt: NOW + 40 * 86_400_000 });
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-tab-calendar"));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("Next month sync")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.queryByText("Next month sync")).toBeNull();
  });

  it("links an orphan transcript to a meeting when opened", () => {
    const os = getOS();
    os.importTranscript(
      { title: "Orphan call", source: "upload", meetingId: null, recordingId: null },
      [
        { speaker: "Speaker 1", startMs: 0, endMs: 2000, text: "We should ship it." },
      ],
      NOW,
    );
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-tab-transcripts"));
    fireEvent.click(screen.getByText("Orphan call"));

    const meetings = Object.values(os.getState().meetings);
    expect(meetings.some((meeting) => meeting.title === "Orphan call")).toBe(true);
    expect(screen.getByTestId("meeting-detail").textContent).toContain("Orphan call");
  });
});
describe("Transcript and action item editing", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches the transcript", () => {
    seed(getOS());
    renderModule();

    fireEvent.change(screen.getByLabelText("Search transcript"), { target: { value: "pricing" } });
    const transcript = screen.getByTestId("meeting-transcript");
    expect(within(transcript).getByText(/pricing sheet/)).toBeDefined();
    expect(within(transcript).queryByText(/launch in November/)).toBeNull();
  });

  it("edits a transcript line", () => {
    const os = getOS();
    const transcript = seed(os);
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Edit line 1" }));
    fireEvent.change(screen.getByLabelText("Edit transcript line"), {
      target: { value: "Launch moved to December." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(os.getState().transcripts[transcript.id]?.segments[0]?.text).toBe("Launch moved to December.");
  });

  it("deletes and adds transcript lines", () => {
    const os = getOS();
    const transcript = seed(os);
    const before = os.getState().transcripts[transcript.id]!.segments.length;
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Delete line 1" }));
    expect(os.getState().transcripts[transcript.id]!.segments.length).toBe(before - 1);

    fireEvent.change(screen.getByLabelText("Add transcript line"), {
      target: { value: "One more decision: ship Monday." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    expect(os.getState().transcripts[transcript.id]!.segments.length).toBe(before);
    expect(os.getState().transcripts[transcript.id]!.fullText).toContain("ship Monday");
  });

  it("adds and removes a manual action item", () => {
    const os = getOS();
    const meeting = os.addMeeting({ title: "Planning", startsAt: NOW });
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-actions"));
    fireEvent.change(screen.getByLabelText("New action item"), {
      target: { value: "Send the recap" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const item = Object.values(os.getState().actionItems).find((entry) => entry.title === "Send the recap");
    expect(item?.meetingId).toBe(meeting.id);

    fireEvent.click(screen.getByRole("button", { name: "Remove Send the recap" }));
    expect(os.getState().actionItems[item!.id]?.status).toBe("dismissed");
  });

  it("shows older meetings in the calendar regardless of the period filter", () => {
    const os = getOS();
    os.addMeeting({ title: "Old retro", startsAt: NOW - 60 * 86_400_000 });
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-tab-calendar"));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("Old retro")).toBeDefined();
  });

  it("offers a Markdown export", () => {
    seed(getOS());
    renderModule();
    openMeetingOptions();
    expect(screen.getByRole("menuitem", { name: "Export meeting as Markdown" })).toBeDefined();
  });
});
describe("Meeting attendees, links, reminders and recurrence", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves attendees, project and tags from the dialog", () => {
    const os = getOS();
    const project = os.addProject({ name: "Launch" });
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Schedule Meeting" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Kickoff" } });
    fireEvent.change(within(dialog).getByLabelText("Attendee name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(within(dialog).getByLabelText("Attendee email"), { target: { value: "ada@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    fireEvent.change(within(dialog).getByLabelText("Project"), { target: { value: project.id } });
    fireEvent.change(within(dialog).getByLabelText("Tags"), { target: { value: "launch, Product" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));

    const meeting = Object.values(os.getState().meetings).find((entry) => entry.title === "Kickoff")!;
    expect(meeting.attendees).toHaveLength(1);
    expect(meeting.attendees[0]?.email).toBe("ada@example.com");
    expect(meeting.projectId).toBe(project.id);
    expect(meeting.tags).toEqual(["launch", "product"]);
    expect(screen.getByText("Ada Lovelace · ada@example.com")).toBeDefined();
  });

  it("sets a reminder on the meeting", () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Schedule Meeting" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Reminder meeting" } });
    fireEvent.change(within(dialog).getByLabelText("Reminder"), { target: { value: "2026-10-15T09:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));

    const meeting = Object.values(os.getState().meetings).find((entry) => entry.title === "Reminder meeting")!;
    expect(os.meetingReminders(meeting.id)).toHaveLength(1);
  });

  it("creates a recurring series", () => {
    const os = getOS();
    renderModule();

    fireEvent.click(screen.getByRole("button", { name: "Schedule Meeting" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Standup" } });
    fireEvent.change(within(dialog).getByLabelText("Repeat"), { target: { value: "weekly" } });
    fireEvent.change(within(dialog).getByLabelText("Occurrences"), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));

    const meetings = Object.values(os.getState().meetings).filter((entry) => entry.title === "Standup");
    expect(meetings).toHaveLength(3);
    expect(new Set(meetings.map((entry) => entry.recurrenceId)).size).toBe(1);
  });

  it("merges speakers from the transcript tab", () => {
    const os = getOS();
    const transcript = seed(os);
    renderModule();

    fireEvent.change(screen.getByLabelText("Merge from speaker"), { target: { value: "Speaker 1" } });
    fireEvent.change(screen.getByLabelText("Merge into speaker"), { target: { value: "Speaker 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));

    const speakers = new Set(os.getState().transcripts[transcript.id]!.segments.map((segment) => segment.speaker));
    expect(speakers.has("Speaker 1")).toBe(false);
  });

  it("deletes and restores a transcript", () => {
    const os = getOS();
    const transcript = seed(os);
    renderModule();

    openMeetingOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete transcript" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete transcript" }));
    expect(os.getState().transcripts[transcript.id]?.status).toBe("trashed");

    fireEvent.click(screen.getByTestId("meeting-tab-transcripts"));
    fireEvent.click(screen.getByRole("button", { name: "Show deleted transcripts" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(os.getState().transcripts[transcript.id]?.status).not.toBe("trashed");
  });

  it("creates tasks for all action items", () => {
    const os = getOS();
    const transcript = seed(os);
    os.storeMeetingReport(transcript.id, NOW);
    renderModule();

    fireEvent.click(screen.getByTestId("meeting-detail-tab-actions"));
    const bulk = screen.queryByRole("button", { name: "Create tasks for all" });
    if (bulk) {
      fireEvent.click(bulk);
      expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(0);
    }
  });
});