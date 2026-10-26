import { describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  BUILTIN_JOURNAL_TEMPLATES,
  createJournalEntry,
  journalDateKey,
  journalEntryTitle,
  journalPreview,
  moodScore,
  moodLabel,
  moodEmoji,
} from "../../types/journal";
import {
  buildJournalMonthlyReview,
  buildJournalWeeklyReview,
  formatFocusMinutes,
} from "./reviews";
import {
  activeJournalEntries,
  journalAddTag,
  journalEntryForDate,
  journalMarkComplete,
  journalPage,
  journalTrash,
} from "./entries";
import { computeJournalStreak } from "./streaks";
import { buildMoodCalendar, buildMoodInsights } from "./mood";
import { searchJournalEntries } from "./search";

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();
const DAY_MS = 86_400_000;

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

describe("journal types", () => {
  it("derives a stable local date key", () => {
    expect(journalDateKey(new Date(2026, 0, 5, 23, 30).getTime())).toBe("2026-01-05");
    expect(journalDateKey(new Date(2026, 11, 31, 0, 1).getTime())).toBe("2026-12-31");
  });

  it("saves an entry from just a few words", () => {
    const entry = createJournalEntry(
      { entryDate: NOW, body: "Today was productive. Finished the support documentation and went to cricket practice." },
      NOW,
    );
    expect(entry.body).toContain("cricket practice");
    expect(entry.wordCount).toBeGreaterThan(5);
    expect(entry.status).toBe("draft");
    expect(entry.entryDate).toBe(NOW);
  });

  it("defaults privacy to private", () => {
    const entry = createJournalEntry({ entryDate: NOW }, NOW);
    expect(entry.privacy).toBe("private");
    expect(entry.observationOnly).toBe(true);
  });

  it("maps moods to scores and labels", () => {
    expect(moodScore("happy")).toBe(5);
    expect(moodScore("stressed")).toBe(2);
    expect(moodScore(null)).toBe(3);
    expect(moodLabel("excited")).toBe("Excited");
    expect(moodEmoji("happy")).toBe("😊");
  });

  it("falls back to the date when no title exists", () => {
    const entry = createJournalEntry({ entryDate: NOW }, NOW);
    expect(journalEntryTitle(entry)).toContain("2026");
  });

  it("clamps energy and productivity to 1-10", () => {
    const entry = createJournalEntry({ entryDate: NOW, energy: 0, productivity: 15 }, NOW);
    expect(entry.energy).toBe(1);
    expect(entry.productivity).toBe(10);
  });

  it("ships built-in templates", () => {
    expect(BUILTIN_JOURNAL_TEMPLATES.map((template) => template.id)).toContain("daily_reflection");
    expect(BUILTIN_JOURNAL_TEMPLATES.map((template) => template.id)).toContain("morning_journal");
    expect(BUILTIN_JOURNAL_TEMPLATES.every((template) => template.sections.length > 0)).toBe(true);
  });
});

describe("journal OS API", () => {
  it("creates one primary entry per day", () => {
    const os = makeOS();
    const first = os.addJournalEntry({ entryDate: NOW, body: "Morning entry" });
    const second = os.addJournalEntry({ entryDate: NOW + 3_600_000, body: "Evening update" });

    expect(second.id).toBe(first.id);
    expect(os.journalEntryFor(NOW)!.body).toBe("Evening update");
    expect(os.journalEntryCount()).toBe(1);
  });

  it("opens today's entry, creating it when missing", () => {
    const os = makeOS();
    const opened = os.openJournalFor(NOW);
    expect(journalEntryTitle(opened)).toContain("2026");
    const again = os.openJournalFor(NOW + 60_000);
    expect(again.id).toBe(opened.id);
  });

  it("autosaves patches and keeps content", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "first" });
    os.updateJournalEntry(entry.id, { body: "A much longer reflection about the day.", title: "Thursday" });
    const updated = os.getJournalEntry(entry.id)!;
    expect(updated.body).toContain("longer reflection");
    expect(updated.title).toBe("Thursday");
    expect(updated.wordCount).toBeGreaterThan(1);
  });

  it("soft deletes and recovers an entry", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "keep me" });
    os.deleteJournalEntry(entry.id);
    expect(os.journalEntries()).toHaveLength(0);

    const trashed = os.journalRecoverable();
    expect(trashed).toHaveLength(1);

    os.restoreJournalEntry(entry.id);
    expect(os.journalEntryFor(NOW)!.body).toBe("keep me");
  });

  it("empties the trash permanently", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "gone soon" });
    os.deleteJournalEntry(entry.id);
    expect(os.emptyJournalTrash()).toBe(1);
    expect(os.journalRecoverable()).toHaveLength(0);
    expect(os.getJournalEntry(entry.id)).toBeNull();
  });

  it("seeds built-in templates without duplicating", () => {
    const os = makeOS();
    os.seedJournalTemplates(NOW);
    const first = os.journalTemplates().length;
    os.seedJournalTemplates(NOW);
    expect(os.journalTemplates().length).toBe(first);
    expect(os.journalTemplates().some((template) => template.kind === "builtin")).toBe(true);
  });

  it("supports custom templates alongside the built-ins", () => {
    const os = makeOS();
    const template = os.addJournalTemplate({
      name: "My Weekly",
      sections: [{ id: "s1", label: "Wins", prompt: "What went well?", target: "highlights" }],
    });
    expect(template.kind).toBe("custom");
    expect(os.journalTemplates().some((entry) => entry.id === template.id)).toBe(true);
    os.deleteJournalTemplate(template.id);
    expect(os.journalTemplates().some((entry) => entry.id === template.id)).toBe(false);
  });

  it("inserts created tasks into the canonical task store", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "Need to finish D365 documentation tomorrow." });

    const task = os.createTaskFromJournal(entry.id, {
      title: "Finish D365 documentation",
      dueAt: NOW + DAY_MS,
      scheduledAt: null,
      priority: 1,
      estimateMin: null,
      projectId: null,
      goalIds: [],
      fragment: "Need to finish D365 documentation tomorrow.",
    });

    expect(task).not.toBeNull();
    expect(task!.title).toBe("Finish D365 documentation");
    expect(os.getJournalEntry(entry.id)!.taskIds).toContain(task!.id);
  });

  it("never creates a duplicate task when one exists", () => {
    const os = makeOS();
    os.addTask({ title: "Finish D365 documentation", status: "open" });
    const entry = os.addJournalEntry({ entryDate: NOW, body: "Need to finish D365 documentation tomorrow." });

    const task = os.createTaskFromJournal(entry.id, {
      title: "Finish D365 documentation",
      dueAt: null,
      scheduledAt: null,
      priority: 1,
      estimateMin: null,
      projectId: null,
      goalIds: [],
      fragment: "x",
    });

    expect(task).toBeNull();
    expect(
      Object.values(os.getState().tasks).filter((t) => t.title === "Finish D365 documentation"),
    ).toHaveLength(1);
  });

  it("links and unlinks goals, habits, events, and memories", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "Spent two hours learning Next.js." });
    const goal = os.addGoal({ title: "Learn New Technologies" });
    const habit = os.addHabit({ title: "Gym" });
    const event = os.addEvent({ title: "Cricket", startsAt: NOW + 2 * 3_600_000, endsAt: NOW + 4 * 3_600_000 });

    os.linkJournalToGoal(entry.id, goal.id);
    os.linkJournalToHabit(entry.id, habit.id);
    os.linkJournalToEvent(entry.id, event.id);

    expect(os.getJournalEntry(entry.id)!.goalIds).toContain(goal.id);
    expect(os.getJournalEntry(entry.id)!.habitIds).toContain(habit.id);
    expect(os.getJournalEntry(entry.id)!.eventIds).toContain(event.id);

    os.unlinkJournalEntity(entry.id, "goal", goal.id);
    expect(os.getJournalEntry(entry.id)!.goalIds).not.toContain(goal.id);
  });

  it("creates a life memory that references the entry", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, title: "Cricket final", body: "Scored 42 runs." });
    const memory = os.createLifeMemoryFromJournalEntry(entry.id)!;

    expect(memory).not.toBeNull();
    expect(memory.title).toBe("Cricket final");
    expect(os.getJournalEntry(entry.id)!.lifeMemoryIds).toContain(memory.id);

    const again = os.createLifeMemoryFromJournalEntry(entry.id);
    expect(again!.id).toBe(memory.id);
    expect(Object.keys(os.getState().lifeMemoryItems)).toHaveLength(1);
  });
});

describe("journal streaks", () => {
  it("counts a current and longest streak", () => {
    const os = makeOS();
    for (let offset = 0; offset < 3; offset += 1) {
      os.addJournalEntry({ entryDate: NOW - offset * DAY_MS, body: `day ${offset}` });
    }
    for (let offset = 10; offset < 16; offset += 1) {
      os.addJournalEntry({ entryDate: NOW - offset * DAY_MS, body: "older" });
    }

    const streak = os.journalStreak(NOW);
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(6);
    expect(streak.totalEntries).toBe(9);
    expect(streak.writtenToday).toBe(true);
    expect(os.journalStreak(NOW).longest).toBe(6);
  });

  it("does not count a streak broken more than a day ago", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW - 3 * DAY_MS, body: "past" });
    const streak = computeJournalStreak(os.getState(), NOW);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(1);
  });

  it("ignores trashed entries", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "x" });
    os.deleteJournalEntry(entry.id);
    expect(computeJournalStreak(os.getState(), NOW).current).toBe(0);
  });
});

describe("journal search", () => {
  it("finds entries by free text", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "Went to cricket practice and scored 42 runs." });
    os.addJournalEntry({ entryDate: NOW - DAY_MS, body: "Quiet day at home." });

    const results = os.searchJournal({ query: "cricket" });
    expect(results).toHaveLength(1);
    expect(results[0]!.entry.body).toContain("cricket");
  });

  it("filters by tag, person, activity, and mood", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({
      entryDate: NOW,
      body: "Family dinner",
      tags: ["family"],
      people: [{ id: "person_dad", name: "Dad" }],
      activities: ["Family time"],
      mood: "happy",
    });
    os.addJournalEntry({ entryDate: NOW - DAY_MS, body: "Solo run", tags: ["health"], mood: "tired" });

    expect(os.searchJournal({ tags: ["family"] }).map((result) => result.entry.id)).toEqual([entry.id]);
    expect(os.searchJournal({ people: ["Dad"] })).toHaveLength(1);
    expect(os.searchJournal({ activities: ["Family time"] })).toHaveLength(1);
    expect(os.searchJournal({ mood: ["tired"] })).toHaveLength(1);
  });

  it("filters by month and date range", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "October entry" });
    os.addJournalEntry({ entryDate: new Date(2026, 8, 10).getTime(), body: "September entry" });

    expect(os.searchJournal({ month: "2026-10" })).toHaveLength(1);
    expect(os.searchJournal({ from: NOW, to: NOW + DAY_MS })).toHaveLength(1);
  });

  it("answers natural language questions about the journal", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW - DAY_MS, body: "Played cricket at the club." });
    const answer = os.journalAnswer("when did I last play cricket?");
    expect(answer.toLowerCase()).toContain("cricket");
  });

  it("lists tags without duplicates", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "x", tags: ["work", "work"] });
    expect(os.journalTags().find((tag) => tag.tag === "work")!.count).toBe(1);
  });
});

describe("journal mood insights", () => {
  it("summarises a window without medical claims", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "Great day", mood: "happy" });
    os.addJournalEntry({ entryDate: NOW - DAY_MS, body: "Long day", mood: "stressed" });
    os.addJournalEntry({ entryDate: NOW - 2 * DAY_MS, body: "Fine day", mood: "neutral" });

    const insights = os.journalMoodInsights(7, NOW);
    expect(insights.sampleSize).toBe(3);
    expect(insights.distribution.happy).toBe(1);
    expect(insights.observation.toLowerCase()).toContain("observed pattern");
    expect(insights.points).toHaveLength(3);
  });

  it("builds a calendar with mood and photo indicators", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "Happy day", mood: "happy" });
    const days = os.journalMoodCalendar(9, 2026);
    const today = days.find((day) => day.dateKey === "2026-10-15")!;
    expect(today.hasEntry).toBe(true);
    expect(today.mood).toBe("happy");
    expect(days).toHaveLength(31);
  });

  it("handles an empty window", () => {
    const os = makeOS();
    const insights = os.journalMoodInsights(7, NOW);
    expect(insights.sampleSize).toBe(0);
    expect(insights.average).toBe(3);
  });
});

describe("journal reviews", () => {
  it("builds a weekly review labelled as AI generated", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "Shipped the docs.", highlights: ["Completed support documentation"], mood: "happy", productivity: 8, activities: ["Work"] });
    const review = os.journalWeeklyReview(NOW);

    expect(review.entryCount).toBeGreaterThan(0);
    expect(review.aiGenerated).toBe(true);
    expect(review.topAchievement).toBe("Completed support documentation");
    expect(review.reflections.join(" ")).toContain("Observed pattern");
  });

  it("builds a monthly review with trends", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "Learned Next.js", mood: "happy", tags: ["learning"] });
    const review = os.journalMonthlyReview(NOW);
    expect(review.entryCount).toBeGreaterThan(0);
    expect(review.frequentTopics).toContain("learning");
    expect(review.aiGenerated).toBe(true);
  });

  it("says nothing happened on an empty week", () => {
    const os = makeOS();
    const review = buildJournalWeeklyReview(os.getState(), NOW);
    expect(review.entryCount).toBe(0);
    expect(review.overallMood).toBe("unknown");
    expect(review.reflections[0]).toContain("No entries");
  });

  it("formats focus time", () => {
    expect(formatFocusMinutes(0)).toBe("0m");
    expect(formatFocusMinutes(90)).toBe("1h 30m");
  });
});

describe("journal local engine helpers", () => {
  it("keeps tags normalised and unique", () => {
    const entry = createJournalEntry({ entryDate: NOW }, NOW);
    const tagged = journalAddTag(journalAddTag(entry, "#Work"), "WORK");
    expect(tagged.tags).toEqual(["work"]);
  });

  it("pages entries and filters status", () => {
    const entries = [
      createJournalEntry({ entryDate: NOW, body: "a" }, NOW),
      createJournalEntry({ entryDate: NOW - DAY_MS, body: "b" }, NOW),
    ].sort((a, b) => b.entryDate - a.entryDate);
    expect(journalPage(entries, { limit: 1 })).toHaveLength(1);
  });

  it("previews long entries with an ellipsis", () => {
    const entry = createJournalEntry({ entryDate: NOW, body: "x".repeat(500) }, NOW);
    expect(journalPreview(entry, 20).endsWith("…")).toBe(true);
  });

  it("marks an entry complete", () => {
    const entry = journalMarkComplete(createJournalEntry({ entryDate: NOW }, NOW));
    expect(entry.status).toBe("complete");
  });

  it("moves an entry to the trash", () => {
    const entry = journalTrash(createJournalEntry({ entryDate: NOW }, NOW), NOW);
    expect(entry.status).toBe("trashed");
    expect(entry.trashedAt).toBe(NOW);
    expect(journalEntryForDate({ journalEntries: {} } as never, NOW)).toBeNull();
  });

  it("ignores trashed entries in the active list", () => {
    const os = makeOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "x" });
    os.deleteJournalEntry(entry.id);
    expect(activeJournalEntries(os.getState())).toHaveLength(0);
  });

  it("counts mood points for a calendar month", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: new Date(2026, 9, 3).getTime(), body: "x", mood: "calm" });
    const days = buildMoodCalendar(activeJournalEntries(os.getState()), 9, 2026);
    expect(days.find((day) => day.dateKey === "2026-10-03")!.mood).toBe("calm");
  });

  it("finds no entries for an out-of-range search", () => {
    const os = makeOS();
    os.addJournalEntry({ entryDate: NOW, body: "hello" });
    expect(searchJournalEntries(os.getState(), { query: "zzzz" })).toHaveLength(0);
  });

  it("builds insights from a supplied entry list", () => {
    const insights = buildMoodInsights(
      [createJournalEntry({ entryDate: NOW, body: "x", mood: "happy" }, NOW)],
      30,
      NOW,
    );
    expect(insights.positiveDays).toBe(1);
  });

  it("returns an empty weekly review shape with no data", () => {
    const os = makeOS();
    const review = buildJournalWeeklyReview(os.getState(), NOW);
    expect(review.habitConsistency).toBeNull();
    expect(review.bestDay).toBeNull();
  });

  it("returns a monthly review with no data", () => {
    const os = makeOS();
    const review = buildJournalMonthlyReview(os.getState(), NOW);
    expect(review.entryCount).toBe(0);
    expect(review.majorAchievements).toEqual([]);
  });
});
