export interface CalendarPrefs {
  showWeekends: boolean;
  defaultCalendarId: string | null;
}

const KEY = "personalos.calendar.prefs";

const DEFAULTS: CalendarPrefs = {
  showWeekends: true,
  defaultCalendarId: null,
};

export function loadCalendarPrefs(): CalendarPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<CalendarPrefs>;
    return {
      showWeekends: parsed.showWeekends ?? DEFAULTS.showWeekends,
      defaultCalendarId: parsed.defaultCalendarId ?? DEFAULTS.defaultCalendarId,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveCalendarPrefs(prefs: CalendarPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage failures
  }
}
