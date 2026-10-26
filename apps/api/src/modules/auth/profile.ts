import { randomUUID } from "node:crypto";

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
import { eq } from "drizzle-orm";

import type { Config } from "../../config";
import type { Db } from "../../db/index";
import { createDocumentRepository } from "../../db/documents";
import { outbox, users, workspaces } from "../../db/schema";
import { writeAudit } from "../audit/service";

export type UserRow = typeof users.$inferSelect;

export interface ProfileRequestContext {
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ProfileService {
  getProfile(userId: string): Promise<ProfileResponse>;
  patchProfile(
    user: UserRow,
    patch: ProfilePatch,
    context: ProfileRequestContext,
  ): Promise<ProfileResponse>;
  onboardingState(user: UserRow): Promise<OnboardingState>;
  completeOnboarding(
    user: UserRow,
    input: OnboardingInput,
    context: ProfileRequestContext,
  ): Promise<ProfileResponse>;
}

export function toProfileResponse(user: UserRow): ProfileResponse {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    timezone: user.timezone,
    locale: user.locale,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: user.onboardingCompletedAt !== null,
    preferences: userPreferencesSchema.parse(user.preferences),
  };
}

function mergePreferences(
  current: UserPreferences,
  patch: Record<string, unknown> | undefined,
): UserPreferences {
  if (!patch) return current;
  const parsedPatch = userPreferencesPatchSchema.parse(patch);
  return userPreferencesSchema.parse({ ...current, ...parsedPatch });
}

export function createProfileService(deps: { db: Db; config: Config; now?: () => number }): ProfileService {
  const { db } = deps;
  const now = deps.now ?? ((): number => Date.now());

  async function getProfile(userId: string): Promise<ProfileResponse> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    return toProfileResponse(user);
  }

  async function patchProfile(
    user: UserRow,
    patch: ProfilePatch,
    context: ProfileRequestContext,
  ): Promise<ProfileResponse> {
    const validated = profilePatchSchema.parse(patch);
    const at = new Date(now());
    const preferences = mergePreferences(
      userPreferencesSchema.parse(user.preferences),
      validated.preferences,
    );

    const updates: Partial<typeof users.$inferInsert> = { updatedAt: at };
    const changed: string[] = [];
    if (validated.displayName !== undefined && validated.displayName !== user.displayName) {
      updates.displayName = validated.displayName;
      changed.push("displayName");
    }
    if (validated.timezone !== undefined && validated.timezone !== user.timezone) {
      updates.timezone = validated.timezone;
      changed.push("timezone");
    }
    if (validated.locale !== undefined && validated.locale !== user.locale) {
      updates.locale = validated.locale;
      changed.push("locale");
    }
    if ("avatarUrl" in validated && validated.avatarUrl !== undefined) {
      const nextAvatar = validated.avatarUrl;
      if (nextAvatar !== user.avatarUrl) {
        updates.avatarUrl = nextAvatar;
        changed.push("avatarUrl");
      }
    }
    if (validated.preferences !== undefined) {
      updates.preferences = preferences;
      changed.push("preferences");
    }

    if (Object.keys(updates).length === 1) {
      return toProfileResponse(user);
    }

    const rows = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();
    const updated = rows[0];

    await writeAudit(db, {
      actorUserId: user.id,
      actorKind: "user",
      action: "user.profile_updated",
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      metadata: { fields: changed },
    });
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
    context: ProfileRequestContext,
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

    const at = new Date(now());
    const preferences = mergePreferences(
      userPreferencesSchema.parse(user.preferences),
      validated.preferences,
    );

    return db.transaction(async (tx) => {
      const txRepo = createDocumentRepository(tx as unknown as Db);
      const workspace = await tx.query.workspaces.findFirst({
        where: eq(workspaces.ownerId, user.id),
      });
      let workspaceId = workspace?.id;
      if (!workspaceId) {
        const created = await tx
          .insert(workspaces)
          .values({
            id: randomUUID(),
            name: "Personal",
            kind: "personal",
            ownerId: user.id,
          })
          .returning({ id: workspaces.id });
        workspaceId = created[0].id;
      }

      const existing = await txRepo.listByWorkspace(workspaceId, {
        collections: ["lifeAreas"],
        limit: 200,
      });
      const byName = new Map(
        existing.items.map((record) => [String(record.document.name), record]),
      );

      const primaryLifeAreaIds: string[] = [];
      let order = existing.items.length;
      for (const name of validated.lifeAreaNames) {
        const found = byName.get(name);
        if (found) {
          primaryLifeAreaIds.push(found.id);
          continue;
        }
        const catalogItem = LIFE_AREA_CATALOG.find((item) => item.name === name);
        try {
          const record = await txRepo.create({
            collection: "lifeAreas",
            id: randomUUID(),
            ownerId: user.id,
            workspaceId,
            scope: "private",
            document: {
              name,
              description: catalogItem?.description ?? null,
              color: catalogItem?.color ?? null,
              icon: catalogItem?.icon ?? null,
              order,
              status: "active",
            },
          });
          primaryLifeAreaIds.push(record.id);
          order += 1;
        } catch (error) {
          if (error instanceof AppError && error.code === "CONFLICT_ALREADY_EXISTS") {
            continue;
          }
          throw error;
        }
      }

      const finalPreferences = userPreferencesSchema.parse({
        ...preferences,
        primaryLifeAreaIds,
      });

      const displayName = validated.displayName?.trim() || user.displayName;
      const rows = await tx
        .update(users)
        .set({
          displayName,
          timezone: validated.timezone,
          locale: validated.locale,
          preferences: finalPreferences,
          onboardingCompletedAt: at,
          updatedAt: at,
        })
        .where(eq(users.id, user.id))
        .returning();
      const updated = rows[0];

      await writeAudit(tx, {
        actorUserId: user.id,
        actorKind: "user",
        action: "user.onboarded",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: {
          timezone: validated.timezone,
          locale: validated.locale,
          lifeAreas: validated.lifeAreaNames,
        },
      });
      await tx.insert(outbox).values({
        eventId: randomUUID(),
        type: "user.onboarded.v1",
        payload: {
          userId: user.id,
          timezone: validated.timezone,
          locale: validated.locale,
          lifeAreas: validated.lifeAreaNames,
        },
      });

      return toProfileResponse(updated);
    });
  }

  return { getProfile, patchProfile, onboardingState, completeOnboarding };
}
