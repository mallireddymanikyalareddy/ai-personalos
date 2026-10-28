import type { NewJournalEntryInput, PersonalOS, Timestamp } from "@personalos/core";

const DAY = 86_400_000;

type SampleJournal = Omit<NewJournalEntryInput, "entryDate"> & { daysAgo: number };

const SAMPLE_TAG = "sample";

const SAMPLE_ENTRIES: SampleJournal[] = [
  {
    daysAgo: 1,
    title: "A calmer start to the week",
    body: "Woke up before the alarm and took a slow morning. Planned the day around three priorities instead of a long list.\n\nDeep work went well in the morning. I protected the first two hours and left notifications off. The afternoon had a few interruptions, but I still finished the important pieces.\n\nTomorrow I want to keep the same start and leave more buffer between meetings.",
    mood: "calm",
    energy: 8,
    productivity: 8,
    tags: [SAMPLE_TAG, "work", "reflection"],
    highlights: ["Two hours of uninterrupted deep work", "Finished the proposal draft"],
    challenges: ["Afternoon context switching"],
    gratitude: ["A quiet morning", "Coffee on the balcony"],
    lessons: "Protecting the first two hours changes the whole day.",
    improvements: "Add 15-minute buffers between meetings.",
    tomorrow: { priorities: ["Send the proposal", "Review the budget"], intentions: "Keep the morning slow and focused." },
  },
  {
    daysAgo: 3,
    title: "Long walk and a good conversation",
    body: "Took a long walk after lunch and called an old friend. We talked about work, family and the kind of life we want to build over the next few years.\n\nIt reminded me that progress is not only about output. Some days the most useful thing is a good conversation and a clear head.",
    mood: "happy",
    energy: 7,
    productivity: 5,
    tags: [SAMPLE_TAG, "friends", "health"],
    highlights: ["Caught up with an old friend", "Walked 8 km"],
    gratitude: ["Good friends", "Sunshine"],
    tomorrow: { priorities: ["Finish the weekly review"] },
  },
  {
    daysAgo: 5,
    title: "A difficult but useful day",
    body: "A project decision did not go the way I expected. I spent too long frustrated before stepping back and writing down what I could control.\n\nThe useful part was the conversation afterwards. We found a smaller next step that unblocks the team without committing to the full plan.",
    mood: "stressed",
    energy: 5,
    productivity: 6,
    tags: [SAMPLE_TAG, "work", "challenges"],
    challenges: ["A decision I disagreed with", "Lost focus for an hour"],
    lessons: "Write down what I can control before reacting.",
    improvements: "Ask for the decision context earlier.",
    tomorrow: { priorities: ["Share the smaller plan", "Block focus time"] },
  },
  {
    daysAgo: 8,
    title: "Weekend reset",
    body: "Cleaned the flat, cooked a proper meal and did nothing productive for a few hours. It felt strange at first, then restorative.\n\nI want to keep one slow block each weekend. Rest is part of the system, not a reward for finishing everything.",
    mood: "happy",
    energy: 9,
    productivity: 3,
    tags: [SAMPLE_TAG, "home", "rest"],
    highlights: ["Cooked a new recipe", "Finished the book on my bedside table"],
    gratitude: ["A free weekend", "A clean home"],
    tomorrow: { priorities: ["Plan the week", "Book the dentist"] },
  },
  {
    daysAgo: 12,
    title: "Learning in public",
    body: "Shared a short write-up about the workflow I have been building. The response was better than expected, and a few people asked thoughtful questions.\n\nWriting it down forced me to notice the parts I had been doing by habit. I should explain my work more often.",
    mood: "excited",
    energy: 7,
    productivity: 7,
    tags: [SAMPLE_TAG, "learning", "writing"],
    highlights: ["Published the write-up", "Three useful questions from readers"],
    lessons: "Explaining the work is part of the work.",
    tomorrow: { priorities: ["Draft a follow-up note"] },
  },
  {
    daysAgo: 16,
    title: "Tired but steady",
    body: "Low energy today. I kept the day small: one important task, a short walk and an early night.\n\nNot every day needs to be a breakthrough. Showing up gently still counts.",
    mood: "tired",
    energy: 4,
    productivity: 5,
    tags: [SAMPLE_TAG, "health", "reflection"],
    gratitude: ["An early night", "A patient team"],
  },
];

function startOfDay(at: Timestamp): Timestamp {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function seedSampleJournal(os: PersonalOS, now: Timestamp = Date.now()): string[] {
  const created: string[] = [];
  for (const sample of SAMPLE_ENTRIES) {
    const entryDate = startOfDay(now - sample.daysAgo * DAY);
    if (os.journalEntryFor(entryDate)) continue;
    const input = { ...sample };
    delete (input as { daysAgo?: number }).daysAgo;
    const entry = os.addJournalEntry({ ...input, entryDate }, now);
    created.push(entry.id);
  }
  return created;
}

export function hasSampleJournal(os: PersonalOS): boolean {
  return os.journalEntries().some((entry) => entry.tags.includes(SAMPLE_TAG));
}
