import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import { buildMeetingsDashboard } from "./dashboard";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  os.clearAll();
});

function seedMeeting(title: string, startsAt: number, minutes = 45) {
  const meeting = os.addMeeting({ title, startsAt, endsAt: startsAt + minutes * 60_000 });
  os.importTranscript(
    { title, source: "meeting", meetingId: meeting.id, recordingId: null },
    [
      { speaker: "Mani", startMs: 0, endMs: 60_000, text: "We reviewed the D365 support performance today." },
      { speaker: "Rahul", startMs: 60_000, endMs: 120_000, text: "The warehouse issue is fixed and we can automate the runbook." },
    ],
    startsAt,
  );
  return meeting;
}

describe("meetings dashboard rows", () => {
  it("lists meetings newest first with duration and participant counts", () => {
    const older = seedMeeting("Older sync", NOW - 10 * DAY);
    const newer = seedMeeting("Newer sync", NOW - 2 * DAY);

    const dash = buildMeetingsDashboard(os.getState(), NOW);
    expect(dash.rows.map((row) => row.title)).toEqual(["Newer sync", "Older sync"]);
    expect(dash.rows[0]!.durationMin).toBe(45);
    expect(dash.rows[0]!.participantCount).toBe(2);
    expect(dash.rows[0]!.transcriptId).not.toBeNull();
    void older;
    void newer;
  });

  it("groups meetings by month", () => {
    seedMeeting("October sync", NOW - 2 * DAY);
    seedMeeting("September sync", NOW - 20 * DAY);

    const dash = buildMeetingsDashboard(os.getState(), NOW);
    expect(dash.groups).toHaveLength(2);
    expect(dash.groups[0]!.label).toContain("October");
    expect(dash.groups[1]!.label).toContain("September");
  });

  it("filters by query and by period", () => {
    seedMeeting("Launch sync", NOW - 2 * DAY);
    seedMeeting("Finance review", NOW - 40 * DAY);

    const byQuery = buildMeetingsDashboard(os.getState(), NOW, { query: "launch" });
    expect(byQuery.rows.map((row) => row.title)).toEqual(["Launch sync"]);

    const byPeriod = buildMeetingsDashboard(os.getState(), NOW, { periodDays: 30 });
    expect(byPeriod.rows.map((row) => row.title)).toEqual(["Launch sync"]);
  });
});

describe("meetings dashboard stats", () => {
  it("counts meetings, duration, participants and action items", () => {
    const meeting = seedMeeting("Weekly sync", NOW - 2 * DAY, 60);
    os.addActionItem({ title: "Share the runbook draft", meetingId: meeting.id, transcriptId: null });

    const dash = buildMeetingsDashboard(os.getState(), NOW);
    expect(dash.stats.meetings).toBe(1);
    expect(dash.stats.totalDurationMin).toBe(60);
    expect(dash.stats.participants).toBe(2);
    expect(dash.stats.actionItems).toBe(1);
  });

  it("returns zeroed stats with no meetings", () => {
    const dash = buildMeetingsDashboard(os.getState(), NOW);
    expect(dash.stats).toEqual({ meetings: 0, totalDurationMin: 0, participants: 0, actionItems: 0 });
    expect(dash.rows).toHaveLength(0);
    expect(dash.topics).toHaveLength(0);
  });
});

describe("meetings dashboard topics and participants", () => {
  it("ranks the most discussed topics with percentages", () => {
    seedMeeting("Support sync", NOW - 2 * DAY);

    const dash = buildMeetingsDashboard(os.getState(), NOW);
    const labels = dash.topics.map((topic) => topic.label);
    expect(labels).toContain("automate");
    expect(labels).toContain("d365");
    expect(labels.length).toBeLessThanOrEqual(6);
    const total = dash.topics.reduce((sum, topic) => sum + topic.pct, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it("lists the speakers with their segment counts", () => {
    seedMeeting("Support sync", NOW - 2 * DAY);

    const dash = buildMeetingsDashboard(os.getState(), NOW);
    expect(dash.participants.map((row) => row.name)).toContain("Mani");
    const mani = dash.participants.find((row) => row.name === "Mani")!;
    expect(mani.segments).toBe(1);
    expect(mani.meetings).toBe(1);
  });
});
