import { AppError } from "@personalos/api-contract";
import {
  LIFE_AREA_CATALOG,
  onboardingInputSchema,
  profilePatchSchema,
  userPreferencesPatchSchema,
  userPreferencesSchema,
  type OnboardingInput,
  type OnboardingState,
  type ProfilePatch,
  type ProfileResponse,
  type UserPreferences,
} from "@personalos/api-contract/account";

import { getDevUserRow, patchDevUserRow } from "./dev-auth";
import { toProfileResponse, type ProfileRequestContext, type ProfileService, type UserRow } from "./profile";
import type { SessionService } from "./sessions";

export function createDevProfileService(deps: { now?: () => number } = {}): ProfileService {
  const now = deps.now ?? ((): number => Date.now());

  function mergePreferences(
    current: UserPreferences,
    patch: Record<string, unknown> | undefined,
  ): UserPreferences {
    if (!patch) return current;
    const parsedPatch = userPreferencesPatchSchema.parse(patch);
    return userPreferencesSchema.parse({ ...current, ...parsedPatch });
  }

  async function getProfile(userId: string): Promise<ProfileResponse> {
    const user = await getDevUserRow(userId);
    if (!user) {
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    return toProfileResponse(user);
  }

  async function patchProfile(
    user: UserRow,
    patch: ProfilePatch,
    _context: ProfileRequestContext,
  ): Promise<ProfileResponse> {
    const validated = profilePatchSchema.parse(patch);
    const preferences = mergePreferences(
      userPreferencesSchema.parse(user.preferences),
      validated.preferences,
    );

    const updates: {
      displayName?: string;
      timezone?: string;
      locale?: string;
      avatarUrl?: string | null;
      preferences?: UserPreferences;
    } = {};
    if (validated.displayName !== undefined && validated.displayName !== user.displayName) {
      updates.displayName = validated.displayName;
    }
    if (validated.timezone !== undefined && validated.timezone !== user.timezone) {
      updates.timezone = validated.timezone;
    }
    if (validated.locale !== undefined && validated.locale !== user.locale) {
      updates.locale = validated.locale;
    }
    if ("avatarUrl" in validated && validated.avatarUrl !== undefined) {
      if (validated.avatarUrl !== user.avatarUrl) {
        updates.avatarUrl = validated.avatarUrl;
      }
    }
    if (validated.preferences !== undefined) {
      updates.preferences = preferences;
    }

    if (Object.keys(updates).length === 0) {
      return toProfileResponse(user);
    }

    const updated = await patchDevUserRow(user.id, updates);
    if (!updated) {
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    return toProfileResponse(updated);
  }

  async function onboardingState(user: UserRow): Promise<OnboardingState> {
    return {
      completed: user.onboardingCompletedAt !== null,
      profile: toProfileResponse(user),
      lifeAreaCatalog: LIFE_AREA_CATALOG,
    };
  }

  async function completeOnboarding(
    user: UserRow,
    input: OnboardingInput,
    _context: ProfileRequestContext,
  ): Promise<ProfileResponse> {
    const validated = onboardingInputSchema.parse(input);
    const catalogNames = new Set<string>(LIFE_AREA_CATALOG.map((item) => item.name));
    const unknownAreas = validated.lifeAreaNames.filter((name) => !catalogNames.has(name));
    if (unknownAreas.length > 0) {
      throw new AppError("VALIDATION_FAILED", {
        detail: "Onboarding failed schema validation.",
        errors: unknownAreas.map((name) => ({
          field: "lifeAreaNames",
          issue: `unknown life area "${name}"`,
        })),
      });
    }

    const preferences = mergePreferences(
      userPreferencesSchema.parse(user.preferences),
      validated.preferences,
    );

    const updated = await patchDevUserRow(user.id, {
      displayName: validated.displayName?.trim() || user.displayName,
      timezone: validated.timezone,
      locale: validated.locale,
      preferences,
      onboardingCompletedAt: new Date(now()),
    });
    if (!updated) {
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    return toProfileResponse(updated);
  }

  return { getProfile, patchProfile, onboardingState, completeOnboarding };
}

export function createDevSessionService(): SessionService {
  async function revokeNotFound(): Promise<never> {
    throw new AppError("NOT_FOUND", { detail: "Not found." });
  }

  return {
    async listSessions() {
      return [];
    },
    async getSessionOwnership() {
      return undefined;
    },
    async revokeSession() {
      await revokeNotFound();
    },
    async revokeOtherSessions() {
      return { revoked: 0 };
    },
    async listDevices() {
      return [];
    },
    async getDeviceOwnership() {
      return undefined;
    },
    async revokeDevice() {
      await revokeNotFound();
    },
  };
}