import type { EntityMeta, TaskSort, ThemeSetting, Timestamp } from "./common";
import { newId } from "./common";
import { createDefaultGamificationPreferences, type GamificationPreferences } from "./gamification";
import { createDefaultMobilePreferences, type MobilePreferences } from "./mobile";

export interface Profile extends EntityMeta {
  type: "profile";
  displayName: string;
  email: string | null;
  timezone: string;
}

export interface PlanningPreferences {
  enabled: boolean;
  dayStart: string;
  dayEnd: string;
  workDays: number[];
  bufferMin: number;
  defaultEstimateMin: number;
}

export function createDefaultPlanningPreferences(): PlanningPreferences {
  return {
    enabled: true,
    dayStart: "09:00",
    dayEnd: "17:00",
    workDays: [1, 2, 3, 4, 5],
    bufferMin: 15,
    defaultEstimateMin: 60,
  };
}

export interface Settings {
  theme: ThemeSetting;
  weekStart: 0 | 1;
  timeFormat: 12 | 24;
  defaultTaskSort: TaskSort;
  defaultPlanningView: "day" | "week" | "month" | "quarter";
  onboardedAt: Timestamp | null;
  planning: PlanningPreferences;
  gamification: GamificationPreferences;
  activeMode: "personal" | "work";
  mobile: MobilePreferences;
  aiProvider: string;
}

export function createProfile(now: Timestamp = Date.now()): Profile {
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    timezone = "UTC";
  }
  return {
    type: "profile",
    id: newId(),
    createdAt: now,
    updatedAt: now,
    displayName: "",
    email: null,
    timezone,
  };
}

export function createDefaultSettings(): Settings {
  return {
    theme: "system",
    weekStart: 1,
    timeFormat: 24,
    defaultTaskSort: "smart",
    defaultPlanningView: "day",
    onboardedAt: null,
    planning: createDefaultPlanningPreferences(),
    gamification: createDefaultGamificationPreferences(),
    activeMode: "personal",
    mobile: createDefaultMobilePreferences(),
    aiProvider: "local",
  };
}
