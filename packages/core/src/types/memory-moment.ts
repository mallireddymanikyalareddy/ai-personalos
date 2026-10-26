import type { ID, Timestamp } from "./common";
import type { CanonicalEntity, CanonicalInput } from "./base";
import { createCanonicalBase } from "./base";
import { newId } from "./common";

export type MemoryCategory =
  | "travel"
  | "food"
  | "family"
  | "friends"
  | "work"
  | "health"
  | "learning"
  | "finance"
  | "activities"
  | "places"
  | "people"
  | "milestones"
  | "other";

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  "travel",
  "food",
  "family",
  "friends",
  "work",
  "health",
  "learning",
  "finance",
  "activities",
  "places",
  "people",
  "milestones",
  "other",
];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  travel: "Travel",
  food: "Food & Drinks",
  family: "Family",
  friends: "Friends",
  work: "Work & Career",
  health: "Health & Fitness",
  learning: "Learning & Reading",
  finance: "Finance & Investments",
  activities: "Activities",
  places: "Places",
  people: "People",
  milestones: "Milestones",
  other: "Other",
};

export const MEMORY_CATEGORY_ICONS: Record<MemoryCategory, string> = {
  travel: "plane",
  food: "utensils",
  family: "users",
  friends: "heart",
  work: "briefcase",
  health: "heart-pulse",
  learning: "book-open",
  finance: "wallet",
  activities: "activity",
  places: "map-pin",
  people: "user",
  milestones: "flag",
  other: "sparkles",
};

export type MemoryMomentKind = "trip" | "meal" | "book" | "activity" | "milestone" | "note";

export const MEMORY_MOMENT_KINDS: readonly MemoryMomentKind[] = [
  "trip",
  "meal",
  "book",
  "activity",
  "milestone",
  "note",
];

export type MemoryMomentStatus = "active" | "archived" | "trashed";

export interface MemoryPlace {
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface NewMemoryMomentInput extends CanonicalInput {
  title: string;
  description?: string;
  kind?: MemoryMomentKind;
  category?: MemoryCategory;
  happenedAt: Timestamp;
  place?: MemoryPlace | null;
  tags?: string[];
  attachmentIds?: ID[];
  favorite?: boolean;
  people?: string[];
  bookAuthor?: string;
  relatedEntityIds?: ID[];
}

export interface MemoryMoment extends CanonicalEntity {
  type: "memory_moment";
  title: string;
  description: string;
  kind: MemoryMomentKind;
  category: MemoryCategory;
  happenedAt: Timestamp;
  place: MemoryPlace | null;
  tags: string[];
  attachmentIds: ID[];
  favorite: boolean;
  people: string[];
  bookAuthor: string;
  relatedEntityIds: ID[];
  status: MemoryMomentStatus;
  trashedAt: Timestamp | null;
  searchVector: string;
  embedding: number[] | null;
}

export const MEMORY_MOMENT_ENTITY_TYPE = "memory_moment";

function normalizePlace(place: MemoryPlace | null | undefined): MemoryPlace | null {
  if (!place) return null;
  const name = place.name.trim();
  if (name.length === 0) return null;
  const lat = Number.isFinite(place.latitude) ? Number(place.latitude) : null;
  const lng = Number.isFinite(place.longitude) ? Number(place.longitude) : null;
  const inRange =
    lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  return {
    name,
    latitude: inRange ? lat : null,
    longitude: inRange ? lng : null,
  };
}

export function createMemoryMoment(
  input: NewMemoryMomentInput,
  now: Timestamp = Date.now(),
): MemoryMoment {
  const place = normalizePlace(input.place);
  const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  const people = [...new Set((input.people ?? []).map((name) => name.trim()).filter(Boolean))];
  const title = input.title.trim();
  const description = input.description ?? "";

  return {
    ...createCanonicalBase(input, now),
    type: "memory_moment",
    title,
    description,
    kind: input.kind ?? inferMomentKind(input.category ?? "other"),
    category: input.category ?? "other",
    happenedAt: input.happenedAt,
    place,
    tags,
    attachmentIds: [...new Set(input.attachmentIds ?? [])],
    favorite: input.favorite ?? false,
    people,
    bookAuthor: input.bookAuthor?.trim() ?? "",
    relatedEntityIds: [...new Set(input.relatedEntityIds ?? [])],
    status: "active",
    trashedAt: null,
    searchVector: [title, description, place?.name ?? "", bookAuthorOrEmpty(input), ...tags, ...people]
      .join(" ")
      .toLowerCase(),
    embedding: null,
  };
}

function bookAuthorOrEmpty(input: NewMemoryMomentInput): string {
  return input.bookAuthor?.trim() ?? "";
}

export function inferMomentKind(category: MemoryCategory): MemoryMomentKind {
  switch (category) {
    case "travel":
      return "trip";
    case "food":
      return "meal";
    case "learning":
      return "book";
    case "activities":
      return "activity";
    case "milestones":
      return "milestone";
    default:
      return "note";
  }
}

export function moveMemoryMomentToTrash(
  moment: MemoryMoment,
  now: Timestamp = Date.now(),
): MemoryMoment {
  return { ...moment, status: "trashed", trashedAt: now, updatedAt: now };
}

export function restoreMemoryMoment(
  moment: MemoryMoment,
  now: Timestamp = Date.now(),
): MemoryMoment {
  return { ...moment, status: "active", trashedAt: null, updatedAt: now };
}

export function archiveMemoryMoment(
  moment: MemoryMoment,
  now: Timestamp = Date.now(),
): MemoryMoment {
  return { ...moment, status: "archived", updatedAt: now };
}

export function newMemoryMomentId(): ID {
  return newId();
}