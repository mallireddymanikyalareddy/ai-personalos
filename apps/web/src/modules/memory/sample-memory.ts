import type {
  LifeMemoryCategory,
  NewLifeMemoryItemInput,
  NewMemoryMomentInput,
  PersonalOS,
  Timestamp,
} from "@personalos/core";

const DAY = 86_400_000;
const SAMPLE_TAG = "sample";

interface SampleMoment extends Omit<NewMemoryMomentInput, "happenedAt"> {
  daysAgo: number;
}

const SAMPLE_MOMENTS: SampleMoment[] = [
  {
    daysAgo: 60,
    title: "Kyoto in autumn",
    description: "Temples, quiet streets and the best matcha of the trip. The Philosopher's Path was worth the walk.",
    kind: "trip",
    category: "travel",
    place: { name: "Kyoto, Japan", latitude: 35.0116, longitude: 135.7681 },
    tags: [SAMPLE_TAG, "travel", "japan"],
    favorite: true,
  },
  {
    daysAgo: 45,
    title: "Finished Atomic Habits",
    description: "The chapter on environment design changed how I set up my desk and morning routine.",
    kind: "book",
    category: "learning",
    tags: [SAMPLE_TAG, "books", "habits"],
    favorite: true,
  },
  {
    daysAgo: 30,
    title: "Sunday lunch with family",
    description: "A long lunch, old stories and too much dessert. Exactly what a Sunday should be.",
    kind: "note",
    category: "family",
    tags: [SAMPLE_TAG, "family", "food"],
    favorite: true,
  },
  {
    daysAgo: 20,
    title: "New ramen place",
    description: "Small counter, rich broth and a queue worth joining. Going back for the spicy version.",
    kind: "meal",
    category: "food",
    place: { name: "Downtown", latitude: null, longitude: null },
    tags: [SAMPLE_TAG, "food"],
  },
  {
    daysAgo: 15,
    title: "Museum afternoon",
    description: "The photography exhibition was quieter than expected and better for it.",
    kind: "trip",
    category: "places",
    tags: [SAMPLE_TAG, "art", "weekend"],
  },
  {
    daysAgo: 12,
    title: "First 10 km run",
    description: "Slow, steady and finished. The last two kilometres were mostly mental.",
    kind: "activity",
    category: "activities",
    tags: [SAMPLE_TAG, "running", "health"],
    favorite: true,
  },
  {
    daysAgo: 7,
    title: "Promoted to senior engineer",
    description: "A milestone I have been working towards for two years. Took the team out for dinner.",
    kind: "milestone",
    category: "milestones",
    tags: [SAMPLE_TAG, "work", "milestone"],
    favorite: true,
  },
];

interface SampleTracker extends NewLifeMemoryItemInput {
  daysAgo?: number;
}

const SAMPLE_TRACKERS: SampleTracker[] = [
  {
    title: "Service the car",
    description: "Oil, filters, brakes and a general check.",
    category: "vehicle" as LifeMemoryCategory,
    targetIntervalDays: 180,
    thresholdDays: 14,
    daysAgo: 220,
    tags: [SAMPLE_TAG, "car"],
    firstCompletionNote: "Full service at the local garage.",
  },
  {
    title: "Replace the water filter",
    description: "Kitchen under-sink filter cartridge.",
    category: "appliance",
    targetIntervalDays: 90,
    thresholdDays: 10,
    daysAgo: 110,
    tags: [SAMPLE_TAG, "home"],
    firstCompletionNote: "Replaced cartridge and flushed the line.",
  },
  {
    title: "Dentist check-up",
    description: "Cleaning and a quick check.",
    category: "health",
    targetIntervalDays: 180,
    thresholdDays: 14,
    daysAgo: 165,
    tags: [SAMPLE_TAG, "health"],
  },
  {
    title: "Clean the gutters",
    description: "Clear leaves before the rainy season.",
    category: "home",
    targetIntervalDays: 180,
    thresholdDays: 21,
    daysAgo: 170,
    tags: [SAMPLE_TAG, "home"],
  },
  {
    title: "Fertilize the plants",
    description: "Balcony herbs and the two large indoor plants.",
    category: "garden",
    targetIntervalDays: 30,
    thresholdDays: 7,
    daysAgo: 28,
    tags: [SAMPLE_TAG, "garden"],
  },
  {
    title: "Review investments",
    description: "Check allocation, fees and the emergency fund.",
    category: "finance",
    targetIntervalDays: 90,
    thresholdDays: 14,
    daysAgo: 96,
    tags: [SAMPLE_TAG, "finance"],
  },
  {
    title: "Vet visit",
    description: "Annual check-up and vaccinations.",
    category: "pet",
    targetIntervalDays: 365,
    thresholdDays: 21,
    tags: [SAMPLE_TAG, "pet"],
  },
  {
    title: "Renew passport",
    description: "Check expiry and book an appointment.",
    category: "document",
    targetIntervalDays: 3650,
    thresholdDays: 30,
    daysAgo: 1200,
    tags: [SAMPLE_TAG, "admin"],
  },
];

export interface SampleMemoryResult {
  moments: number;
  trackers: number;
}

export function seedSampleMemory(os: PersonalOS, now: Timestamp = Date.now()): SampleMemoryResult {
  const state = os.getState();
  const hasMoments = Object.values(state.memoryMoments).some((moment) => moment.tags.includes(SAMPLE_TAG));
  const hasTrackers = Object.values(state.lifeMemoryItems).some((item) => item.tags.includes(SAMPLE_TAG));
  let moments = 0;
  let trackers = 0;

  if (!hasMoments) {
    for (const sample of SAMPLE_MOMENTS) {
      const { daysAgo, ...input } = sample;
      os.addMemoryMoment({ ...input, happenedAt: now - daysAgo * DAY }, now);
      moments += 1;
    }
  }

  if (!hasTrackers) {
    for (const sample of SAMPLE_TRACKERS) {
      const { daysAgo, ...input } = sample;
      const item = os.addLifeMemoryItem(
        { ...input, firstCompletionAt: daysAgo != null ? now - daysAgo * DAY : null },
        now,
      );
      // A second completion gives the interval engine enough history to learn from.
      if (daysAgo != null && input.targetIntervalDays) {
        os.recordLifeMemoryCompletion(item.id, {
          completedAt: now - (daysAgo + input.targetIntervalDays) * DAY,
          note: "Previous completion",
        }, now);
      }
      trackers += 1;
    }
  }

  return { moments, trackers };
}
