import { randomUUID } from "node:crypto";

import type { Config } from "../../config";
import type { AuthService, AuthRequestContext, AuthenticatedSession, LoginInput, RegisterInput, ResetRequestResult, UserRow, VerifyRequestResult } from "./service";
import { hashPassword, verifyPassword } from "./password";
import { generateSessionToken, hashToken, SESSION_TTL_MS } from "./tokens";
import { AppError } from "@personalos/api-contract";

interface DevUser {
  id: string;
  handle: string;
  email: string | null;
  displayName: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  timezone: string;
  locale: string;
  avatarUrl: string | null;
  preferences: Record<string, unknown>;
  onboardingCompletedAt: Date | null;
}

interface DevSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

const users = new Map<string, DevUser>();
const sessions = new Map<string, DevSession>();

const DEFAULT_EMAIL = "dev@personalos.local";
const DEFAULT_PASSWORD = "DevPassword123!";

async function seed(): Promise<void> {
  if (users.size > 0) return;
  const id = randomUUID();
  users.set(id, {
    id,
    handle: "dev",
    email: DEFAULT_EMAIL,
    displayName: "Dev User",
    passwordHash: await hashPassword(DEFAULT_PASSWORD),
    emailVerifiedAt: new Date(),
    timezone: "UTC",
    locale: "en",
    avatarUrl: null,
    preferences: {},
    onboardingCompletedAt: null,
  });
}

function toUserRow(user: DevUser): UserRow {
  return {
    id: user.id,
    handle: user.handle,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    locale: user.locale,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt,
    onboardingCompletedAt: user.onboardingCompletedAt,
    preferences: user.preferences,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as UserRow;
}

export interface DevUserPatch {
  displayName?: string;
  timezone?: string;
  locale?: string;
  avatarUrl?: string | null;
  preferences?: Record<string, unknown>;
  onboardingCompletedAt?: Date | null;
}

export async function getDevUserRow(userId: string): Promise<UserRow | undefined> {
  await seed();
  const user = users.get(userId);
  return user ? toUserRow(user) : undefined;
}

export async function patchDevUserRow(
  userId: string,
  patch: DevUserPatch,
): Promise<UserRow | undefined> {
  await seed();
  const user = users.get(userId);
  if (!user) return undefined;
  if (patch.displayName !== undefined) user.displayName = patch.displayName;
  if (patch.timezone !== undefined) user.timezone = patch.timezone;
  if (patch.locale !== undefined) user.locale = patch.locale;
  if (patch.avatarUrl !== undefined) user.avatarUrl = patch.avatarUrl;
  if (patch.preferences !== undefined) user.preferences = patch.preferences;
  if (patch.onboardingCompletedAt !== undefined) user.onboardingCompletedAt = patch.onboardingCompletedAt;
  return toUserRow(user);
}

export function createDevAuthService(_config: Config): AuthService {
  void seed();

  return {
    async register(input: RegisterInput, _context: AuthRequestContext) {
      await seed();
      const handle = input.handle.trim().toLowerCase();
      const existing = [...users.values()].find(
        (u) => u.handle === handle || u.email === input.email?.trim().toLowerCase(),
      );
      if (existing) {
        throw new AppError("CONFLICT_ALREADY_EXISTS", { detail: "An account with that handle or email already exists." });
      }
      const id = randomUUID();
      const user: DevUser = {
        id,
        handle,
        email: input.email?.trim().toLowerCase() ?? null,
        displayName: input.displayName.trim(),
        passwordHash: await hashPassword(input.password),
        emailVerifiedAt: null,
        timezone: "UTC",
        locale: "en",
        avatarUrl: null,
        preferences: {},
        onboardingCompletedAt: null,
      };
      users.set(id, user);
      const token = generateSessionToken();
      const session: DevSession = {
        id: randomUUID(),
        userId: id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      };
      sessions.set(session.id, session);
      return { user: toUserRow(user), sessionId: session.id, token, expiresAt: session.expiresAt };
    },

    async login(input: LoginInput, _context: AuthRequestContext) {
      await seed();
      const identifier = input.identifier.trim().toLowerCase();
      const user = [...users.values()].find(
        (u) => u.handle === identifier || u.email === identifier,
      );
      if (!user) {
        throw new AppError("AUTH_INVALID_CREDENTIALS", { detail: "Invalid credentials." });
      }
      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        throw new AppError("AUTH_INVALID_CREDENTIALS", { detail: "Invalid credentials." });
      }
      const token = generateSessionToken();
      const session: DevSession = {
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      };
      sessions.set(session.id, session);
      return { user: toUserRow(user), sessionId: session.id, token, expiresAt: session.expiresAt };
    },

    async resolveSession(token: string): Promise<AuthenticatedSession> {
      await seed();
      const tokenHash = hashToken(token);
      const session = [...sessions.values()].find((s) => s.tokenHash === tokenHash);
      if (!session || session.expiresAt < new Date()) {
        throw new AppError("AUTH_REQUIRED", { detail: "Session expired or invalid." });
      }
      const user = users.get(session.userId);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", { detail: "User not found." });
      }
      return {
        user: toUserRow(user),
        session: {
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          deviceId: null,
          createdAt: new Date(),
          expiresAt: session.expiresAt,
          lastSeenAt: new Date(),
          revokedAt: null,
          ip: null,
          userAgent: null,
        } as unknown as AuthenticatedSession["session"],
      };
    },

    async getUser(userId: string) {
      const user = users.get(userId);
      return user ? toUserRow(user) : undefined;
    },

    async logout() {},
    async requestPasswordReset(): Promise<ResetRequestResult> {
      return {};
    },
    async confirmPasswordReset() {},
    async changePassword() {},
    async requestEmailVerification(): Promise<VerifyRequestResult> {
      return {};
    },
    async confirmEmailVerification() {
      throw new AppError("NOT_IMPLEMENTED", { detail: "Email verification not available in dev mode." });
    },
    async completeOAuthIdentity() {
      throw new AppError("NOT_IMPLEMENTED", { detail: "OAuth not available in dev mode." });
    },
  };
}
