import { z } from "zod";

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function isValidLocale(locale: string): boolean {
  try {
    Intl.getCanonicalLocales(locale);
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, "must be a valid IANA timezone");

export const localeSchema = z
  .string()
  .min(2)
  .max(35)
  .refine(isValidLocale, "must be a valid BCP 47 locale");

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM in 24h time");

export const avatarUrlSchema = z
  .string()
  .max(256_000)
  .refine(
    (value) =>
      /^https:\/\/\S+$/.test(value) ||
      /^data:image\/(png|jpe?g|webp|avif|gif);base64,[A-Za-z0-9+/]+=*$/.test(value),
    "must be an https URL or a base64 data image",
  );

export const workingHoursSchema = z.object({
  enabled: z.boolean().default(true),
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .default([1, 2, 3, 4, 5]),
  start: timeOfDaySchema.default("09:00"),
  end: timeOfDaySchema.default("17:00"),
});

export const sleepScheduleSchema = z.object({
  bedtime: timeOfDaySchema.default("23:00"),
  wakeTime: timeOfDaySchema.default("07:00"),
});

export const notificationsPreferencesSchema = z.object({
  emailDigest: z.enum(["off", "daily", "weekly"]).default("daily"),
  dailyBriefing: z.boolean().default(true),
  taskReminders: z.boolean().default(true),
  aiInsights: z.boolean().default(true),
  quietHours: z
    .object({
      enabled: z.boolean().default(true),
      start: timeOfDaySchema.default("22:00"),
      end: timeOfDaySchema.default("07:00"),
    })
    .prefault({}),
});

export const aiPreferencesSchema = z.object({
  tone: z.enum(["concise", "balanced", "detailed"]).default("balanced"),
  proactivity: z.enum(["suggest", "plan", "automate"]).default("suggest"),
  model: z.string().min(1).max(64).default("default"),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).default("system"),
  weekStart: z.enum(["monday", "sunday"]).default("monday"),
  timeFormat: z.enum(["12h", "24h"]).default("24h"),
  defaultPlanningView: z.enum(["day", "week", "month", "quarter"]).default("week"),
  planningPreference: z.enum(["morning", "evening", "weekly_review"]).default("morning"),
  workingHours: workingHoursSchema.prefault({}),
  sleepSchedule: sleepScheduleSchema.prefault({}),
  ai: aiPreferencesSchema.prefault({}),
  notifications: notificationsPreferencesSchema.prefault({}),
  primaryLifeAreaIds: z.array(z.uuid()).max(12).default([]),
});

export const userPreferencesPatchSchema = userPreferencesSchema.partial();

export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;

export const LIFE_AREA_CATALOG = [
  {
    name: "Work",
    color: "#4f46e5",
    icon: "briefcase",
    description: "Career, projects, and professional growth",
  },
  {
    name: "Health",
    color: "#e11d48",
    icon: "heart-pulse",
    description: "Fitness, sleep, and wellbeing",
  },
  {
    name: "Relationships",
    color: "#d97706",
    icon: "users",
    description: "Family, friends, and community",
  },
  {
    name: "Money",
    color: "#059669",
    icon: "wallet",
    description: "Budgeting, saving, and investing",
  },
  {
    name: "Learning",
    color: "#7c3aed",
    icon: "book-open",
    description: "Skills, courses, and curiosity",
  },
  {
    name: "Personal",
    color: "#0891b2",
    icon: "sparkles",
    description: "Hobbies, home, and everything else",
  },
] as const;

export type LifeAreaName = (typeof LIFE_AREA_CATALOG)[number]["name"];

export const onboardingInputSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  timezone: timezoneSchema,
  locale: localeSchema,
  lifeAreaNames: z.array(z.string().min(1).max(64)).max(12).default([]),
  preferences: userPreferencesPatchSchema.default({}),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

export const registerSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(32)
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{2,31}$/),
  email: z.email().optional(),
  password: z.string().min(10).max(200),
  displayName: z.string().min(1).max(64),
});

export const loginSchema = z.object({
  identifier: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().min(1).max(64),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(10).max(200),
});

export const verifyEmailConfirmSchema = z.object({
  token: z.string().min(16).max(256),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  password: z.string().min(10).max(200),
});

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const profilePatchSchema = z
  .object({
    displayName: z.string().min(1).max(64).optional(),
    timezone: timezoneSchema.optional(),
    locale: localeSchema.optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    preferences: userPreferencesPatchSchema.optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).length > 0 &&
      Object.values(value).some((entry) => entry !== undefined),
    "at least one field is required",
  );

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export interface ProfileResponse {
  id: string;
  handle: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  timezone: string;
  locale: string;
  avatarUrl: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  preferences: UserPreferences;
  onboardingSkipped?: boolean;
  lifeAreas?: string[];
}

export interface SessionInfo {
  id: string;
  ip: string | null;
  userAgent: string | null;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  lastSeenAt: string;
  revokedAt: string | null;
  activeSessions: number;
}

export interface OnboardingState {
  completed: boolean;
  profile: ProfileResponse | null;
  lifeAreaCatalog: ReadonlyArray<{
    name: string;
    color: string;
    icon: string;
    description: string;
  }>;
}
