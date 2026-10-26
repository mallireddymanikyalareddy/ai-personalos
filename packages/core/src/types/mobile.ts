import type { ID, Timestamp } from "./common";

export type Handedness = "right" | "left";

export type SwipeableEntityType = "task" | "note" | "event" | "journal_entry" | "habit";

export type SwipeActionId =
  | "complete"
  | "delete"
  | "archive"
  | "schedule"
  | "postpone"
  | "pin"
  | "open"
  | "capture";

export interface SwipeAction {
  id: SwipeActionId;
  label: string;
  icon: string;
  destructive: boolean;
  confirmRequired: boolean;
}

export const SWIPE_ACTION_IDS: readonly SwipeActionId[] = [
  "complete",
  "delete",
  "archive",
  "schedule",
  "postpone",
  "pin",
  "open",
  "capture",
];

export const SWIPE_ACTIONS: Record<SwipeActionId, SwipeAction> = {
  complete: { id: "complete", label: "Complete", icon: "check", destructive: false, confirmRequired: false },
  delete: { id: "delete", label: "Delete", icon: "trash", destructive: true, confirmRequired: true },
  archive: { id: "archive", label: "Archive", icon: "archive", destructive: false, confirmRequired: false },
  schedule: { id: "schedule", label: "Schedule", icon: "calendar", destructive: false, confirmRequired: false },
  postpone: { id: "postpone", label: "Postpone", icon: "clock", destructive: false, confirmRequired: false },
  pin: { id: "pin", label: "Pin", icon: "pin", destructive: false, confirmRequired: false },
  open: { id: "open", label: "Open", icon: "arrow-right", destructive: false, confirmRequired: false },
  capture: { id: "capture", label: "Capture", icon: "plus", destructive: false, confirmRequired: false },
};

export type SwipeDirection = "left" | "right";

export interface SwipeConfig {
  enabled: boolean;
  thresholdPx: number;
  velocityThreshold: number;
  fullSwipeRatio: number;
}

export const DEFAULT_SWIPE_CONFIG: SwipeConfig = {
  enabled: true,
  thresholdPx: 72,
  velocityThreshold: 0.45,
  fullSwipeRatio: 0.55,
};

export type QuickActionId =
  | "capture_task"
  | "capture_note"
  | "capture_voice"
  | "capture_event"
  | "capture_journal"
  | "start_focus"
  | "log_habit"
  | "open_today"
  | "open_calendar"
  | "open_journal"
  | "open_search";

export interface QuickAction {
  id: QuickActionId;
  label: string;
  icon: string;
  area: string;
}

export const QUICK_ACTIONS: Record<QuickActionId, QuickAction> = {
  capture_task: { id: "capture_task", label: "Task", icon: "list-todo", area: "/capture" },
  capture_note: { id: "capture_note", label: "Note", icon: "sticky-note", area: "/capture" },
  capture_voice: { id: "capture_voice", label: "Voice", icon: "mic", area: "/capture" },
  capture_event: { id: "capture_event", label: "Event", icon: "calendar", area: "/capture" },
  capture_journal: { id: "capture_journal", label: "Journal", icon: "feather", area: "/journal" },
  start_focus: { id: "start_focus", label: "Focus", icon: "timer", area: "/focus" },
  log_habit: { id: "log_habit", label: "Habit", icon: "repeat", area: "/habits" },
  open_today: { id: "open_today", label: "Today", icon: "sun", area: "/" },
  open_calendar: { id: "open_calendar", label: "Calendar", icon: "calendar-days", area: "/calendar" },
  open_journal: { id: "open_journal", label: "Journal", icon: "feather", area: "/journal" },
  open_search: { id: "open_search", label: "Search", icon: "search", area: "/search" },
};

export const DEFAULT_QUICK_ACTIONS: readonly QuickActionId[] = [
  "capture_task",
  "capture_voice",
  "capture_note",
  "log_habit",
  "open_journal",
];

export type MobileWidgetId =
  | "today_tasks"
  | "next_event"
  | "habits_due"
  | "journal_prompt"
  | "focus_session"
  | "streak"
  | "inbox"
  | "goals_progress"
  | "mood_today"
  | "quick_capture";

export interface MobileWidget {
  id: MobileWidgetId;
  label: string;
  description: string;
  defaultOrder: number;
}

export const MOBILE_WIDGETS: Record<MobileWidgetId, MobileWidget> = {
  today_tasks: { id: "today_tasks", label: "Today", description: "What is due today", defaultOrder: 1 },
  next_event: { id: "next_event", label: "Next up", description: "The next thing on your calendar", defaultOrder: 2 },
  habits_due: { id: "habits_due", label: "Habits due", description: "Habits you have not checked yet", defaultOrder: 3 },
  journal_prompt: { id: "journal_prompt", label: "Journal", description: "Today's reflection", defaultOrder: 4 },
  focus_session: { id: "focus_session", label: "Focus", description: "Start or resume a focus block", defaultOrder: 5 },
  streak: { id: "streak", label: "Streak", description: "Your journal streak", defaultOrder: 6 },
  inbox: { id: "inbox", label: "Inbox", description: "Captures waiting to be filed", defaultOrder: 7 },
  goals_progress: { id: "goals_progress", label: "Goals", description: "Progress on active goals", defaultOrder: 8 },
  mood_today: { id: "mood_today", label: "Mood", description: "How you recorded feeling", defaultOrder: 9 },
  quick_capture: { id: "quick_capture", label: "Capture", description: "One-tap capture", defaultOrder: 10 },
};

export const DEFAULT_WIDGET_ORDER: readonly MobileWidgetId[] = [
  "today_tasks",
  "next_event",
  "habits_due",
  "journal_prompt",
  "streak",
];

export type NotificationChannel = "in_app" | "push";

export interface NotificationPreferences {
  enabled: boolean;
  channel: NotificationChannel;
  morningJournal: boolean;
  eveningReflection: boolean;
  weeklyReview: boolean;
  journalStreak: boolean;
  habitReminders: boolean;
  focusEnd: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  channel: "in_app",
  morningJournal: true,
  eveningReflection: true,
  weeklyReview: true,
  journalStreak: true,
  habitReminders: false,
  focusEnd: false,
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

export interface MobilePreferences {
  oneHanded: boolean;
  handedness: Handedness;
  hapticsEnabled: boolean;
  hapticIntensity: "light" | "medium" | "strong";
  swipe: SwipeConfig;
  swipeRightTask: SwipeActionId;
  swipeLeftTask: SwipeActionId;
  swipeRightJournal: SwipeActionId;
  swipeLeftJournal: SwipeActionId;
  swipeEnabledNotes: boolean;
  quickActions: QuickActionId[];
  widgets: MobileWidgetId[];
  widgetOrder: MobileWidgetId[];
  notifications: NotificationPreferences;
  offlineFirst: boolean;
  pullToCapture: boolean;
  largerTouchTargets: boolean;
}

export function createDefaultMobilePreferences(): MobilePreferences {
  return {
    oneHanded: false,
    handedness: "right",
    hapticsEnabled: true,
    hapticIntensity: "medium",
    swipe: { ...DEFAULT_SWIPE_CONFIG },
    swipeRightTask: "complete",
    swipeLeftTask: "postpone",
    swipeRightJournal: "open",
    swipeLeftJournal: "archive",
    swipeEnabledNotes: true,
    quickActions: [...DEFAULT_QUICK_ACTIONS],
    widgets: [...DEFAULT_WIDGET_ORDER],
    widgetOrder: [...DEFAULT_WIDGET_ORDER],
    notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    offlineFirst: true,
    pullToCapture: true,
    largerTouchTargets: false,
  };
}

export const MIN_TOUCH_TARGET_PX = 44;

export const THUMB_ZONE_BOTTOM_PX = 96;

export function hapticPattern(intensity: "light" | "medium" | "strong"): number[] {
  switch (intensity) {
    case "light":
      return [8];
    case "strong":
      return [18, 30, 18];
    default:
      return [12];
  }
}

export function hapticLabel(intensity: "light" | "medium" | "strong"): string {
  switch (intensity) {
    case "light":
      return "Light tap";
    case "strong":
      return "Strong double tap";
    default:
      return "Standard tap";
  }
}

export function quickActionsForRole(preferences: MobilePreferences, limit = 5): QuickAction[] {
  return preferences.quickActions.slice(0, limit).map((id) => QUICK_ACTIONS[id]!);
}

export function widgetsFor(preferences: MobilePreferences, limit = 5): MobileWidget[] {
  return preferences.widgets
    .slice(0, limit)
    .map((id) => MOBILE_WIDGETS[id]!)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
}

export function swipeHandedness(preferences: MobilePreferences): "left" | "right" {
  return preferences.handedness;
}

export function mobileSettingsSummary(preferences: MobilePreferences): string {
  const parts: string[] = [];
  parts.push(preferences.oneHanded ? "One-handed mode on" : "Two-handed layout");
  parts.push(preferences.hapticsEnabled ? `Haptics ${hapticLabel(preferences.hapticIntensity).toLowerCase()}` : "Haptics off");
  parts.push(preferences.swipe.enabled ? "Swipes on" : "Swipes off");
  return parts.join(" · ");
}

export interface SwipeRecord {
  dx: number;
  dy: number;
  durationMs: number;
}

export type SwipeDecision = "none" | "pending-left" | "pending-right" | "commit-left" | "commit-right" | "cancel";

export function decideSwipe(
  record: SwipeRecord,
  config: SwipeConfig = DEFAULT_SWIPE_CONFIG,
): SwipeDecision {
  if (!config.enabled) return "none";
  const distance = Math.abs(record.dx);
  const vertical = Math.abs(record.dy);
  if (record.durationMs <= 0) return "none";
  const velocity = distance / record.durationMs;
  if (vertical > distance) return "none";
  const flickDistance = config.thresholdPx * 0.4;
  if (velocity >= config.velocityThreshold && distance >= flickDistance) {
    return record.dx < 0 ? "commit-left" : "commit-right";
  }
  if (distance >= config.thresholdPx) {
    return record.dx < 0 ? "commit-left" : "commit-right";
  }
  if (distance > 8) {
    return record.dx < 0 ? "pending-left" : "pending-right";
  }
  return "none";
}

export function swipeActionFor(
  preferences: MobilePreferences,
  entityType: SwipeableEntityType,
  direction: SwipeDirection,
): SwipeAction {
  const pair =
    entityType === "task"
      ? { right: preferences.swipeRightTask, left: preferences.swipeLeftTask }
      : entityType === "journal_entry"
        ? { right: preferences.swipeRightJournal, left: preferences.swipeLeftJournal }
        : { right: "archive" as SwipeActionId, left: "delete" as SwipeActionId };
  return SWIPE_ACTIONS[direction === "right" ? pair.right : pair.left]!;
}

export function swipeActionList(entityType: SwipeableEntityType): SwipeAction[] {
  switch (entityType) {
    case "task":
      return [SWIPE_ACTIONS.complete, SWIPE_ACTIONS.postpone, SWIPE_ACTIONS.schedule, SWIPE_ACTIONS.pin, SWIPE_ACTIONS.archive, SWIPE_ACTIONS.delete];
    case "journal_entry":
      return [SWIPE_ACTIONS.open, SWIPE_ACTIONS.pin, SWIPE_ACTIONS.archive, SWIPE_ACTIONS.capture];
    default:
      return [SWIPE_ACTIONS.archive, SWIPE_ACTIONS.pin, SWIPE_ACTIONS.delete, SWIPE_ACTIONS.open];
  }
}

export function normalizeMobilePreferences(patch: Partial<MobilePreferences>): MobilePreferences {
  const base = createDefaultMobilePreferences();
  return {
    ...base,
    ...patch,
    swipe: { ...base.swipe, ...(patch.swipe ?? {}) },
    quickActions: patch.quickActions?.length ? patch.quickActions : base.quickActions,
    widgets: patch.widgets?.length ? patch.widgets : base.widgets,
    widgetOrder: patch.widgetOrder?.length ? patch.widgetOrder : patch.widgets ?? base.widgetOrder,
    notifications: { ...base.notifications, ...(patch.notifications ?? {}) },
  };
}

export interface ScheduledReminder {
  id: ID;
  kind: "morning_journal" | "evening_reflection" | "weekly_review" | "journal_streak" | "habit" | "focus_end" | "reminder";
  title: string;
  body: string;
  dueAt: Timestamp;
}

export function quietHourBoundaries(preferences: NotificationPreferences, now: Timestamp): { from: number; to: number; inQuietHours: boolean } {
  const base = new Date(now);
  const from = new Date(base);
  from.setHours(Math.floor(preferences.quietHoursStart), 0, 0, 0);
  const to = new Date(base);
  to.setHours(Math.floor(preferences.quietHoursEnd), 0, 0, 0);
  if (preferences.quietHoursStart === preferences.quietHoursEnd) {
    return { from: from.getTime(), to: to.getTime(), inQuietHours: false };
  }
  const wraps = preferences.quietHoursStart > preferences.quietHoursEnd;
  const inQuietHours = wraps
    ? now >= from.getTime() || now < to.getTime()
    : now >= from.getTime() && now < to.getTime();
  return { from: from.getTime(), to: to.getTime(), inQuietHours };
}

export function notificationAllowed(
  kind: ScheduledReminder["kind"],
  preferences: NotificationPreferences,
  now: Timestamp = Date.now(),
): boolean {
  if (!preferences.enabled) return false;
  const { inQuietHours } = quietHourBoundaries(preferences, now);
  if (inQuietHours) return false;
  switch (kind) {
    case "morning_journal":
      return preferences.morningJournal;
    case "evening_reflection":
      return preferences.eveningReflection;
    case "weekly_review":
      return preferences.weeklyReview;
    case "journal_streak":
      return preferences.journalStreak;
    case "habit":
      return preferences.habitReminders;
    case "focus_end":
      return preferences.focusEnd;
    case "reminder":
      return preferences.enabled;
  }
}


