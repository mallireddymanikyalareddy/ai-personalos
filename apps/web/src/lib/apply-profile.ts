import { LIFE_AREA_CATALOG, type ProfileResponse } from "@personalos/api-contract/account";

import { getOS } from "@/store/os";

export function applyAccountProfile(profile: ProfileResponse): void {
  const os = getOS();
  const state = os.getState();
  const local = state.profile;
  if (
    local.displayName !== profile.displayName ||
    local.timezone !== profile.timezone ||
    local.email !== profile.email
  ) {
    os.updateProfile({ displayName: profile.displayName, timezone: profile.timezone, email: profile.email });
  }
  syncLifeAreas(profile.lifeAreas ?? []);
  const prefs = profile.preferences;
  const planning = state.settings.planning;
  const next = {
    theme: prefs.theme,
    timeFormat: prefs.timeFormat === "12h" ? (12 as const) : (24 as const),
    weekStart: prefs.weekStart === "sunday" ? (0 as const) : (1 as const),
    defaultPlanningView: prefs.defaultPlanningView,
    planning: {
      ...planning,
      enabled: prefs.workingHours.enabled,
      dayStart: prefs.workingHours.start,
      dayEnd: prefs.workingHours.end,
      workDays: prefs.workingHours.days,
    },
  };
  const current = {
    theme: state.settings.theme,
    timeFormat: state.settings.timeFormat,
    weekStart: state.settings.weekStart,
    defaultPlanningView: state.settings.defaultPlanningView,
    planning,
  };
  if (JSON.stringify(current) !== JSON.stringify(next)) os.updateSettings(next);
}

export function syncLifeAreas(names: string[]): void {
  if (names.length === 0) return;
  const os = getOS();
  const active = os.activeLifeAreas().map((area) => area.name);
  if (active.join("|") === names.join("|")) return;
  os.syncLifeAreas(
    names.map((name) => {
      const meta = LIFE_AREA_CATALOG.find((area) => area.name === name);
      return { name, color: meta?.color ?? null, icon: meta?.icon ?? null, description: meta?.description ?? "" };
    }),
  );
}
