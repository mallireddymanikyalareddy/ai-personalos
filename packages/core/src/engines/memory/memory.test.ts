import { beforeEach, describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";
import {
  MEMORY_SUGGESTED_QUESTIONS,
  answerMemoryQuestion,
  categoryCounts,
  distinctPlaceCount,
  filterMoments,
  glanceStats,
  memoryRelative,
  placesVisited,
  quickFilterCounts,
  recurringMoments,
  stripQuestion,
} from "./index";

const DAY = 86_400_000;
const NOW = new Date(2026, 4, 12, 10, 0, 0, 0).getTime();

let os: PersonalOS;

beforeEach(() => {
  os = new PersonalOS();
});

function moment(
  title: string,
  daysAgo: number,
  extra: Partial<Parameters<typeof os.addMemoryMoment>[0]> = {},
) {
  return os.addMemoryMoment({
    title,
    happenedAt: NOW - daysAgo * DAY,
    ...extra,
  });
}

describe("memory moment creation", () => {
  it("stores the episodic fields", () => {
    const created = moment("Andaman Trip", 4, {
      description: "Radhanagar Beach",
      category: "travel",
      place: { name: "Havelock Island", latitude: 11.68, longitude: 92.28 },
      tags: ["beach", "family"],
      people: ["Priya"],
    });

    expect(created.title).toBe("Andaman Trip");
    expect(created.happenedAt).toBe(NOW - 4 * DAY);
    expect(created.place?.latitude).toBeCloseTo(11.68, 2);
    expect(created.people).toEqual(["Priya"]);
    expect(created.status).toBe("active");
  });

  it("infers the kind from the category", () => {
    expect(moment("Trip", 1, { category: "travel" }).kind).toBe("trip");
    expect(moment("Biryani", 1, { category: "food" }).kind).toBe("meal");
    expect(moment("A book", 1, { category: "learning" }).kind).toBe("book");
    expect(moment("Ran", 1, { category: "activities" }).kind).toBe("activity");
    expect(moment("Got promoted", 1, { category: "milestones" }).kind).toBe("milestone");
  });

  it("rejects out-of-range coordinates", () => {
    const created = moment("Bad coords", 1, {
      place: { name: "Nowhere", latitude: 999, longitude: 999 },
    });
    expect(created.place?.latitude).toBeNull();
    expect(created.place?.name).toBe("Nowhere");
  });

  it("drops an empty place name", () => {
    expect(moment("No place", 1, { place: { name: "  ", latitude: 1, longitude: 1 } }).place).toBeNull();
  });

  it("dedupes tags and people", () => {
    const created = moment("Deduped", 1, { tags: ["a", "a", "b"], people: ["Sam", "Sam"] });
    expect(created.tags).toEqual(["a", "b"]);
    expect(created.people).toEqual(["Sam"]);
  });

  it("builds a searchable vector from title, place and people", () => {
    const created = moment("Cricket practice", 1, {
      people: ["Rahul"],
      place: { name: "Hydrabad", latitude: null, longitude: null },
    });
    expect(created.searchVector).toContain("cricket");
    expect(created.searchVector).toContain("rahul");
    expect(created.searchVector).toContain("hydrabad");
  });
});

describe("filtering", () => {
  it("filters by category", () => {
    moment("Trip", 1, { category: "travel" });
    moment("Dinner", 2, { category: "food" });

    const filtered = filterMoments(os.getState(), { category: "travel" });
    expect(filtered.map((entry) => entry.title)).toEqual(["Trip"]);
  });

  it("filters by search query across title, place and people", () => {
    moment("Andaman Trip", 1, { place: { name: "Havelock", latitude: null, longitude: null } });
    moment("Gym Workout", 1, { people: ["Priya"] });

    expect(filterMoments(os.getState(), { query: "andaman" })).toHaveLength(1);
    expect(filterMoments(os.getState(), { query: "havelock" })).toHaveLength(1);
    expect(filterMoments(os.getState(), { query: "priya" })).toHaveLength(1);
  });

  it("filters favourites and photo memories", () => {
    moment("Kept", 1, { favorite: true });
    moment("With photo", 1, { attachmentIds: ["a1"] });

    expect(filterMoments(os.getState(), { quick: "favorites" }).map((e) => e.title)).toEqual(["Kept"]);
    expect(filterMoments(os.getState(), { quick: "with_photos" }).map((e) => e.title)).toEqual(["With photo"]);
  });

  it("filters recent and year windows", () => {
    moment("Fresh", 2);
    moment("Old", 200);

    expect(filterMoments(os.getState(), { quick: "recent", now: NOW }).map((e) => e.title)).toEqual(["Fresh"]);
    expect(filterMoments(os.getState(), { quick: "this_year", now: NOW }).map((e) => e.title)).toEqual(["Fresh"]);
  });

  it("sorts newest first", () => {
    moment("Older", 5);
    moment("Newer", 1);
    expect(filterMoments(os.getState(), {}).map((e) => e.title)).toEqual(["Newer", "Older"]);
  });

  it("excludes trashed moments", () => {
    const gone = moment("Gone", 1);
    os.deleteMemoryMoment(gone.id);
    expect(filterMoments(os.getState(), {})).toHaveLength(0);
  });
});

describe("counts", () => {
  it("counts every category including empty ones", () => {
    moment("Trip", 1, { category: "travel" });
    moment("Dinner", 1, { category: "food" });

    const counts = categoryCounts(os.getState());
    expect(counts).toHaveLength(13);
    expect(counts.find((entry) => entry.category === "travel")?.count).toBe(1);
    expect(counts.find((entry) => entry.category === "finance")?.count).toBe(0);
  });

  it("counts each quick filter", () => {
    moment("A", 1, { favorite: true, attachmentIds: ["x"] });
    moment("B", 900);

    const counts = quickFilterCounts(os.getState(), NOW);
    expect(counts.all).toBe(2);
    expect(counts.favorites).toBe(1);
    expect(counts.with_photos).toBe(1);
    expect(counts.recent).toBe(1);
    expect(counts.last_year).toBe(0);
  });
});

describe("glance stats", () => {
  it("summarises trips, people, foods and books in the year", () => {
    moment("Trip one", 10, { category: "travel", people: ["Priya"] });
    moment("Trip two", 20, { category: "travel", people: ["Rahul"] });
    moment("Dinner", 5, { category: "food", title: "Biryani" });
    moment("Book", 8, { category: "learning" });

    const glance = glanceStats(os.getState(), NOW);
    expect(glance.trips).toBe(2);
    expect(glance.newPeople).toBe(2);
    expect(glance.newFoods).toBe(1);
    expect(glance.booksRead).toBe(1);
    expect(glance.total).toBe(4);
  });

  it("counts distinct food names, not duplicates", () => {
    moment("Biryani", 5, { category: "food" });
    moment("Biryani", 6, { category: "food" });
    expect(glanceStats(os.getState(), NOW).newFoods).toBe(1);
  });

  it("ignores moments from another year", () => {
    moment("Old trip", 400, { category: "travel" });
    expect(glanceStats(os.getState(), NOW).trips).toBe(0);
  });
});

describe("places", () => {
  it("aggregates repeat visits and keeps the latest coordinates", () => {
    moment("First visit", 40, { place: { name: "Paris", latitude: 48.85, longitude: 2.35 } });
    moment("Second visit", 5, { place: { name: "paris", latitude: 48.86, longitude: 2.36 } });

    const places = placesVisited(os.getState());
    expect(places).toHaveLength(1);
    expect(places[0]!.count).toBe(2);
    expect(places[0]!.latitude).toBeCloseTo(48.86, 2);
  });

  it("skips moments without a place", () => {
    moment("No place", 1);
    expect(placesVisited(os.getState())).toHaveLength(0);
  });

  it("counts distinct places", () => {
    moment("A", 1, { place: { name: "Goa", latitude: null, longitude: null } });
    moment("B", 2, { place: { name: "Goa", latitude: null, longitude: null } });
    moment("C", 3, { place: { name: "Paris", latitude: null, longitude: null } });
    expect(distinctPlaceCount(os.getState())).toBe(2);
  });
});

describe("recurring tracker", () => {
  it("groups repeated activities and reports the latest", () => {
    moment("Gym Workout", 3, { category: "health" });
    moment("Gym Workout", 10, { category: "health" });
    moment("Cricket Practice", 5, { category: "activities" });

    const recurring = recurringMoments(os.getState());
    expect(recurring.map((entry) => entry.label)).toContain("Gym Workout");
    expect(recurring.find((entry) => entry.label === "Gym Workout")?.count).toBe(2);
  });

  it("ignores one-off memories", () => {
    moment("One off", 1, { category: "health" });
    expect(recurringMoments(os.getState())).toHaveLength(0);
  });

  it("sorts by most recent", () => {
    moment("Gym Workout", 20, { category: "health" });
    moment("Gym Workout", 21, { category: "health" });
    moment("Read Book", 2, { category: "learning" });
    moment("Read Book", 9, { category: "learning" });

    expect(recurringMoments(os.getState())[0]!.label).toBe("Read Book");
  });
});

describe("questions", () => {
  it("strips the question phrasing", () => {
    expect(stripQuestion("When did I last go on a vacation?")).toBe("go on a vacation");
    expect(stripQuestion("What have I read?")).toBe("read");
  });

  it("answers when something last happened", () => {
    moment("Cricket practice", 5, { category: "activities", tags: ["cricket"] });
    const answer = answerMemoryQuestion(os.getState(), "When did I last play cricket?", NOW);
    expect(answer.matched).toBe(true);
    expect(answer.answer).toContain("Cricket practice");
  });

  it("matches on tags as well as title", () => {
    moment("Evening session", 2, { tags: ["cricket"] });
    const answer = answerMemoryQuestion(os.getState(), "When did I last play cricket?", NOW);
    expect(answer.matched).toBe(true);
  });

  it("counts places for a how-many question", () => {
    moment("A", 1, { place: { name: "Goa", latitude: null, longitude: null } });
    moment("B", 2, { place: { name: "Paris", latitude: null, longitude: null } });

    const answer = answerMemoryQuestion(os.getState(), "How many countries have I visited?", NOW);
    expect(answer.matched).toBe(true);
    expect(answer.answer).toContain("2 places");
  });

  it("says so when nothing matches", () => {
    moment("Something else", 1);
    const answer = answerMemoryQuestion(os.getState(), "When did I last fly a plane?", NOW);
    expect(answer.matched).toBe(false);
    expect(answer.answer).toContain("could not find");
  });

  it("answers when did I last read a book with the latest book and author", () => {
    moment("Old Book", 100, { category: "learning", bookAuthor: "Old Author" });
    moment("Atomic Habits", 20, { category: "learning", bookAuthor: "James Clear" });
    const answer = answerMemoryQuestion(os.getState(), "When did I last read a book?", NOW);
    expect(answer.matched).toBe(true);
    expect(answer.answer).toContain("Atomic Habits");
    expect(answer.answer).toContain("James Clear");
    expect(answer.answer).toContain("20 days ago");
  });

  it("lists every book for a non-recency book question", () => {
    moment("Atomic Habits", 20, { category: "learning" });
    moment("Deep Work", 60, { category: "learning" });
    const answer = answerMemoryQuestion(os.getState(), "show my books", NOW);
    expect(answer.answer).toContain("You have read 2 books");
  });

  it("reports when no book has been recorded", () => {
    moment("Something else", 1);
    const answer = answerMemoryQuestion(os.getState(), "When did I last read a book?", NOW);
    expect(answer.answer).toContain("not recorded any books");
  });

  it("prompts on an empty question", () => {
    const answer = answerMemoryQuestion(os.getState(), "   ", NOW);
    expect(answer.matched).toBe(false);
    expect(answer.answer).toContain("Ask something like");
  });

  it("picks the most recent of several matches", () => {
    moment("Cricket", 30, { tags: ["cricket"] });
    moment("Cricket", 2, { tags: ["cricket"] });
    const answer = answerMemoryQuestion(os.getState(), "when did I last play cricket", NOW);
    expect(answer.answer).toContain("2 days ago");
  });

  it("offers suggested questions covering the mockup examples", () => {
    expect(MEMORY_SUGGESTED_QUESTIONS.length).toBeGreaterThanOrEqual(5);
    const joined = MEMORY_SUGGESTED_QUESTIONS.join(" ").toLowerCase();
    expect(joined).toContain("vacation");
    expect(joined).toContain("cricket");
    expect(joined).toContain("countries");
    expect(joined).toContain("book");
  });
});

describe("relative time", () => {
  it("describes recent and older moments", () => {
    expect(memoryRelative(NOW - 3 * 60_000, NOW)).toBe("today");
    expect(memoryRelative(NOW - DAY, NOW)).toBe("yesterday");
    expect(memoryRelative(NOW - 3 * DAY, NOW)).toBe("3 days ago");
    expect(memoryRelative(NOW - 45 * DAY, NOW)).toBe("1 month ago");
    expect(memoryRelative(NOW - 200 * DAY, NOW)).toBe("6 months ago");
    expect(memoryRelative(NOW - 400 * DAY, NOW)).toBe("1 year ago");
  });
});

describe("os integration", () => {
  it("favourites and unfavourites", () => {
    const created = moment("Favourite me", 1);
    expect(os.toggleMemoryMomentFavorite(created.id)?.favorite).toBe(true);
    expect(os.toggleMemoryMomentFavorite(created.id)?.favorite).toBe(false);
  });

  it("trashes then restores", () => {
    const created = moment("Trash me", 1);
    os.deleteMemoryMoment(created.id);
    expect(os.getMemoryMoment(created.id)?.status).toBe("trashed");
    os.restoreMemoryMoment(created.id);
    expect(os.getMemoryMoment(created.id)?.status).toBe("active");
  });

  it("exposes questions through the OS", () => {
    moment("Cricket practice", 3, { tags: ["cricket"] });
    expect(os.memoryAsk("When did I last play cricket?", NOW).matched).toBe(true);
  });

  it("exposes recurring and places through the OS", () => {
    moment("Gym Workout", 3, { category: "health", place: { name: "Gym", latitude: null, longitude: null } });
    moment("Gym Workout", 9, { category: "health" });

    expect(os.memoryRecurring()).toHaveLength(1);
    expect(os.memoryPlaces()).toHaveLength(1);
  });

  it("exposes glance and counts through the OS", () => {
    moment("Trip", 5, { category: "travel" });
    expect(os.memoryGlance(NOW).trips).toBe(1);
    expect(os.memoryCategoryCounts().find((e) => e.category === "travel")?.count).toBe(1);
    expect(os.memoryQuickFilterCounts().all).toBe(1);
  });
});

describe("memory trash", () => {
  it("shows trashed moments only behind the trash filter", () => {
    const kept = moment("Kept", 1);
    const gone = moment("Gone", 2);
    os.deleteMemoryMoment(gone.id);

    expect(filterMoments(os.getState(), {}).map((entry) => entry.title)).toEqual(["Kept"]);
    expect(filterMoments(os.getState(), { quick: "trash" }).map((entry) => entry.title)).toEqual([
      "Gone",
    ]);
    expect(quickFilterCounts(os.getState(), NOW).trash).toBe(1);
    expect(kept.status).toBe("active");
  });
});