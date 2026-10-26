import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import {
  computeLifeStats,
  answerWhenDidI,
  parseLifeEvent,
  computeIntervalStats,
  buildOverview,
  selectOverdueItems,
} from "./engine";
import { createLifeMemoryItem } from "../../types/life-memory";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

function addItem(os: PersonalOS, dates: number[], title = "Service car", targetIntervalDays: number | null = null) {
  let item = os.addLifeMemoryItem({ title, category: "vehicle", targetIntervalDays });
  for (const date of dates) {
    item = os.recordLifeMemoryCompletion(item.id, { completedAt: date, note: "" })!;
  }
  return item;
}

describe("Life Memory: interval computation", () => {
  it("returns no interval forecast without enough history", () => {
    const item = createLifeMemoryItem({ title: "Clean tank", firstCompletionAt: NOW });
    const stats = computeLifeStats(item, NOW);

    expect(stats.completionCount).toBe(1);
    expect(stats.intervals.sampleCount).toBe(0);
    expect(stats.intervals.observedIntervalDays).toBeNull();
    expect(stats.effectiveIntervalDays).toBeNull();
    expect(stats.expectedNextAt).toBeNull();
    expect(stats.urgency).toBe("never");
  });

  it("uses the mean interval for a small sample", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 200 * DAY, NOW - 100 * DAY]);
    const stats = computeLifeStats(item, NOW);

    expect(stats.intervals.sampleCount).toBe(1);
    expect(stats.intervals.meanIntervalDays).toBe(100);
    expect(stats.intervals.observedIntervalDays).toBe(100);
    expect(stats.expectedNextAt).toBe(NOW + 0);
    expect(stats.daysUntilExpected).toBe(0);
  });

  it("switches to the median for irregular intervals", () => {
    const os = makeOS();
    // gaps: 100, 180, 60 days — median resists the 180-day outlier
    const item = addItem(os, [NOW - 400 * DAY, NOW - 300 * DAY, NOW - 120 * DAY, NOW - 60 * DAY]);
    const intervals = computeIntervalStats(item);

    expect(intervals.sampleCount).toBe(3);
    expect(intervals.meanIntervalDays).toBe(113);
    expect(intervals.medianIntervalDays).toBe(100);
    expect(intervals.observedIntervalDays).toBe(100);
    expect(intervals.longestIntervalDays).toBe(180);
    expect(intervals.trimmedMeanIntervalDays).toBeNull();
  });

  it("uses a trimmed mean to resist outliers with more samples", () => {
    const os = makeOS();
    // gaps: 75, 75, 75, 75, 180 — dropping one short and one long leaves 75
    const item = addItem(os, [
      NOW - 500 * DAY,
      NOW - 425 * DAY,
      NOW - 350 * DAY,
      NOW - 275 * DAY,
      NOW - 200 * DAY,
      NOW - 20 * DAY,
    ]);
    const intervals = computeIntervalStats(item);

    expect(intervals.sampleCount).toBe(5);
    expect(intervals.meanIntervalDays).toBe(96);
    expect(intervals.trimmedMeanIntervalDays).toBe(75);
    expect(intervals.observedIntervalDays).toBe(75);
    expect(intervals.coefficientOfVariation).toBeGreaterThan(0.3);
  });

  it("prefers the user target interval over the observed one", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 200 * DAY, NOW - 100 * DAY], "Service car", 365);
    const stats = computeLifeStats(item, NOW);

    expect(stats.intervalSource).toBe("target");
    expect(stats.effectiveIntervalDays).toBe(365);
    expect(stats.expectedNextAt).toBe(NOW - 100 * DAY + 365 * DAY);
  });
});

describe("Life Memory: urgency and threshold", () => {
  it("flags an item past its threshold as due, then overdue", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 200 * DAY, NOW - 120 * DAY]);

    const stats = computeLifeStats(item, NOW);
    expect(stats.effectiveIntervalDays).toBe(80);
    expect(stats.daysUntilExpected).toBe(-40);
    expect(stats.urgency).toBe("overdue");

    const early = computeLifeStats(item, NOW - 70 * DAY);
    expect(early.urgency).toBe("ok");

    const near = computeLifeStats(item, NOW - 30 * DAY);
    expect(near.urgency).toBe("due");
  });

  it("reports soon when the next date is inside the threshold window", () => {
    const os = makeOS();
    // gap 110 → expected next date 10 days in the past, inside the 14-day threshold
    const item = addItem(os, [NOW - 230 * DAY, NOW - 120 * DAY]);
    const stats = computeLifeStats(item, NOW);

    expect(stats.daysUntilExpected).toBe(-10);
    expect(stats.urgency).toBe("due");
  });

  it("keeps items with plenty of time as ok", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 200 * DAY, NOW - 20 * DAY]);
    expect(computeLifeStats(item, NOW).urgency).toBe("ok");
  });

  it("builds an overview grouped by urgency", () => {
    const os = makeOS();
    const overdue = os.addLifeMemoryItem({ title: "Overdue thing" });
    os.recordLifeMemoryCompletion(overdue.id, { completedAt: NOW - 200 * DAY });
    os.recordLifeMemoryCompletion(overdue.id, { completedAt: NOW - 120 * DAY });

    os.addLifeMemoryItem({ title: "Never done" });

    const overview = buildOverview(os.getState(), NOW);
    expect(overview.total).toBe(2);
    expect(overview.overdue).toBe(1);
    expect(overview.neverRecorded).toBe(1);
  });
});

describe("Life Memory: recording completions", () => {
  it("appends history newest-last and keeps lastCompletedAt correct", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 100 * DAY, NOW - 40 * DAY]);

    expect(item.history.map((entry) => entry.completedAt)).toEqual([NOW - 100 * DAY, NOW - 40 * DAY]);
    expect(item.lastCompletedAt).toBe(NOW - 40 * DAY);

    const backdated = os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 70 * DAY })!;
    expect(backdated.history.map((entry) => entry.completedAt)).toEqual([
      NOW - 100 * DAY,
      NOW - 70 * DAY,
      NOW - 40 * DAY,
    ]);
    expect(backdated.lastCompletedAt).toBe(NOW - 40 * DAY);
  });

  it("records notes and photos against a completion", () => {
    const os = makeOS();
    const item = os.addLifeMemoryItem({ title: "Replace filter" });
    const photo = os.addAttachment({
      ownerType: "life_memory_item",
      ownerId: item.id,
      name: "filter.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
    });

    const updated = os.recordLifeMemoryCompletion(item.id, {
      completedAt: NOW,
      note: "Replaced with a MERV 11",
      attachmentIds: [photo.id],
    })!;

    expect(updated.history[0]!.note).toBe("Replaced with a MERV 11");
    expect(updated.history[0]!.attachmentIds).toEqual([photo.id]);
    expect(computeLifeStats(updated, NOW).attachments).toBe(1);
  });

  it("soft-deletes to trash before permanent removal", () => {
    const os = makeOS();
    const item = os.addLifeMemoryItem({ title: "Clean gutters" });

    os.deleteLifeMemoryItem(item.id);
    expect(os.getLifeMemoryItem(item.id)?.status).toBe("trashed");

    os.deleteLifeMemoryItem(item.id);
    expect(os.getLifeMemoryItem(item.id)).toBeNull();
  });

  it("selects items that are due within a window", () => {
    const os = makeOS();
    const soon = os.addLifeMemoryItem({ title: "Water plants" });
    os.recordLifeMemoryCompletion(soon.id, { completedAt: NOW - 100 * DAY });
    os.recordLifeMemoryCompletion(soon.id, { completedAt: NOW - 60 * DAY });

    const due = os.lifeMemoryDue(NOW, 30);
    expect(due.map((entry) => entry.item.id)).toContain(soon.id);
    expect(os.lifeMemoryOverdue(NOW).length).toBeGreaterThan(0);
  });
});

describe("Life Memory: \"When did I last…?\"", () => {
  it("answers instantly with the date, the gap, and the forecast", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 300 * DAY, NOW - 90 * DAY]);

    const answer = answerWhenDidI(os.getState(), "When did I last service my car?", NOW);
    expect(answer.matched).toBe(true);
    expect(answer.item?.id).toBe(item.id);
    expect(answer.answer).toContain("90 days ago");
    expect(answer.answer).toContain("average interval");
    expect(answer.stats?.daysSinceCompletion).toBe(90);
  });

  it("answers even when the item was never completed", () => {
    const os = makeOS();
    os.addLifeMemoryItem({ title: "Clean water tank" });

    const answer = answerWhenDidI(os.getState(), "when did I last clean the water tank", NOW);
    expect(answer.matched).toBe(true);
    expect(answer.answer).toContain("never recorded");
  });

  it("says so plainly when nothing matches", () => {
    const os = makeOS();
    os.addLifeMemoryItem({ title: "Service car" });

    const answer = answerWhenDidI(os.getState(), "when did I last paint the fence", NOW);
    expect(answer.matched).toBe(false);
    expect(answer.answer).toContain("could not find");
  });

  it("handles several question phrasings", () => {
    const os = makeOS();
    addItem(os, [NOW - 90 * DAY]);

    for (const question of [
      "when did I last service my car",
      "when was the last time I serviced the car",
      "how long ago did I service the car",
      "did I ever service my car",
    ]) {
      expect(answerWhenDidI(os.getState(), question, NOW).matched).toBe(true);
    }
  });

  it("ranks alternatives when several items match", () => {
    const os = makeOS();
    os.addLifeMemoryItem({ title: "Service car", firstCompletionAt: NOW - 10 * DAY });
    os.addLifeMemoryItem({ title: "Service bike", firstCompletionAt: NOW - 20 * DAY });

    const answer = answerWhenDidI(os.getState(), "when did I last service the car?", NOW);
    expect(answer.item?.title).toBe("Service car");
    expect(answer.alternatives.some((alt) => alt.title === "Service bike")).toBe(true);
  });
});

describe("Life Memory: parsing completions from text", () => {
  it("parses yesterday, today, and relative dates", () => {
    const yesterday = parseLifeEvent("I serviced my car yesterday", NOW);
    expect(yesterday.title).toBe("Car");
    expect(yesterday.completedAt).toBe(NOW - DAY);
    expect(yesterday.dateText).toBe("yesterday");

    const today = parseLifeEvent("replaced the ac filter today", NOW);
    expect(today.completedAt).toBe(NOW);

    const weeks = parseLifeEvent("cleaned the water tank 3 weeks ago", NOW);
    expect(weeks.completedAt).toBe(NOW - 21 * DAY);
  });

  it("parses ISO and named dates", () => {
    const iso = parseLifeEvent("changed battery 2026-03-04", NOW);
    expect(iso.dateText).toBe("2026-03-04");
    expect(new Date(iso.completedAt!).getFullYear()).toBe(2026);

    const named = parseLifeEvent("fertilized plants Mar 4", NOW);
    expect(named.dateText).toContain("Mar");
    expect(named.completedAt).not.toBeNull();
  });

  it("routes a logged event to the matching item through the assistant", () => {
    const os = makeOS();
    os.addLifeMemoryItem({ title: "Car service", category: "vehicle" });

    const result = os.aiRun("I serviced my car yesterday", { now: NOW });
    expect(result.capability).toBe("log_life_event");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]!.payload.kind).toBe("life_memory_completion");
    expect(result.proposals[0]!.requiresConfirmation).toBe(true);

    const stored = os.aiSaveProposal(result.proposals[0]!, NOW);
    const applied = os.aiAcceptProposal(stored.id, NOW);
    expect(applied.ok).toBe(true);
    expect(os.lifeMemoryItems()[0]!.history).toHaveLength(1);
    expect(os.lifeMemoryStats(os.lifeMemoryItems()[0]!.id, NOW)!.lastCompletedAt).toBe(NOW - DAY);
  });

  it("offers to create a new memory when nothing matches", () => {
    const os = makeOS();
    const result = os.aiRun("I cleaned the water tank today", { now: NOW });
    expect(result.capability).toBe("log_life_event");
    expect(result.proposals[0]!.payload.kind).toBe("life_memory_create");
  });
});

describe("Life Memory: assistant integration", () => {
  it("answers \"when did I\" questions through the assistant", () => {
    const os = makeOS();
    const item = os.addLifeMemoryItem({ title: "Car service", category: "vehicle" });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 45 * DAY, note: "Oil and filters" });

    const result = os.aiRun("when did I last get my car serviced?", { now: NOW });
    expect(result.capability).toBe("life_memory");
    expect(result.message).toContain("45 days ago");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]!.title).toContain("Oil and filters");
  });

  it("does not answer from an item belonging to someone else", () => {
    const os = makeOS();
    const item = os.addLifeMemoryItem({ title: "Car service" });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 45 * DAY });

    const state = os.getState();
    const foreign = { ...state.lifeMemoryItems[item.id]!, ownerId: "user_stranger" };
    state.lifeMemoryItems[item.id] = foreign;

    const result = os.aiRun("when did I last service my car", { now: NOW });
    expect(result.message).toContain("could not find");
  });
});
describe("Life Memory: archived items", () => {
  it("excludes archived items from the overview and due lists", () => {
    const os = makeOS();
    const item = addItem(os, [NOW - 200 * DAY, NOW - 100 * DAY]);
    os.archiveLifeMemoryItem(item.id);

    expect(buildOverview(os.getState(), NOW).total).toBe(0);
    expect(selectOverdueItems(os.getState(), NOW)).toHaveLength(0);
  });
});