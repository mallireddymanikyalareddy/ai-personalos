import type { UserPreferencesPatch } from "@personalos/api-contract/account";
import type { ThemeSetting } from "@personalos/core";

import { accountApi } from "@/lib/api";
import { getOS } from "@/store/os";

export interface LocalSettingsPatch {
  theme?: ThemeSetting;
  timeFormat?: 12 | 24;
  weekStart?: 0 | 1;
}

export function setSettings(patch: LocalSettingsPatch): void {
  getOS().updateSettings(patch);

  const preferences: UserPreferencesPatch = {};
  if (patch.theme !== undefined) preferences.theme = patch.theme;
  if (patch.timeFormat !== undefined) preferences.timeFormat = patch.timeFormat === 12 ? "12h" : "24h";
  if (patch.weekStart !== undefined) preferences.weekStart = patch.weekStart === 0 ? "sunday" : "monday";
  if (Object.keys(preferences).length > 0) {
    void accountApi.patchProfile({ preferences }).catch(() => undefined);
  }
}
