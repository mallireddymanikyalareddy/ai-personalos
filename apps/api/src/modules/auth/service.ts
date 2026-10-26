import { randomUUID } from "node:crypto";

import { AppError } from "@personalos/api-contract";
import { and, eq, isNull, ne, or } from "drizzle-orm";

import type { Config } from "../../config";
import type { Db } from "../../db/index";
import { credentials, devices, members, oauthConnections, outbox, sessions, users, workspaces } from "../../db/schema";
import { writeAudit } from "../audit/service";
import { upsertDevice } from "./device";
import {
  burnPasswordVerify,
  hashPassword,
  verifyPassword,
} from "./password";
import {
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  createAuthToken,
  generateToken,
  invalidateAuthTokens,
  consumeAuthToken,
} from "./token-store";
import {
  SESSION_TTL_MS,
  generateSessionToken,
  hashToken,
} from "./tokens";

export interface AuthRequestContext {
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RegisterInput {
  handle: string;
  email?: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

export interface AuthenticatedSession {
  user: UserRow;
  session: SessionRow;
}

export interface IssuedSession {
  user: UserRow;
  sessionId: string;
  token: string;
  expiresAt: Date;
}

export interface RegisterResult extends IssuedSession {
  devEmailToken?: string;
}

export interface ResetRequestResult {
  devToken?: string;
}

export interface VerifyRequestResult {
  devToken?: string;
}

export interface OAuthIdentityInput {
  provider: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export interface OAuthCompletionResult {
  issued: IssuedSession | null;
  linked: boolean;
  isNewUser: boolean;
  onboardingCompleted: boolean;
}

export interface AuthService {
  register(input: RegisterInput, context: AuthRequestContext): Promise<RegisterResult>;
  login(input: LoginInput, context: AuthRequestContext): Promise<IssuedSession>;
  logout(session: SessionRow, context: AuthRequestContext): Promise<void>;
  resolveSession(token: string): Promise<AuthenticatedSession>;
  getUser(userId: string): Promise<UserRow | undefined>;
  requestPasswordReset(identifier: string, context: AuthRequestContext): Promise<ResetRequestResult>;
  confirmPasswordReset(token: string, password: string, context: AuthRequestContext): Promise<void>;
  changePassword(
    userId: string,
    input: { currentPassword: string; password: string },
    options: { keepSessionId?: string },
    context: AuthRequestContext,
  ): Promise<void>;
  requestEmailVerification(userId: string, context: AuthRequestContext): Promise<VerifyRequestResult>;
  confirmEmailVerification(token: string, context: AuthRequestContext): Promise<UserRow>;
  completeOAuthIdentity(
    identity: OAuthIdentityInput,
    options: { linkUserId: string | null },
    context: AuthRequestContext,
  ): Promise<OAuthCompletionResult>;
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const UNIQUE_VIOLATION = "23505";
const DUPLICATE_MESSAGE = /duplicate key value violates unique constraint "([^"]+)"/;

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Transaction;

export interface AccountBootstrapInput {
  handle: string;
  email: string | null;
  displayName: string;
  avatarUrl?: string | null;
  passwordHash?: string | null;
  emailVerified?: boolean;
  oauth?: { provider: string; subject: string };
}

function findUniqueViolation(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === UNIQUE_VIOLATION) {
      return typeof candidate.constraint === "string" ? candidate.constraint : "unknown";
    }
    if (typeof candidate.message === "string") {
      const match = DUPLICATE_MESSAGE.exec(candidate.message);
      if (match) return match[1];
    }
    current = candidate.cause;
  }
  return null;
}

export async function createAccountWithWorkspace(
  tx: Executor,
  input: AccountBootstrapInput,
  now: Date,
): Promise<{ userId: string; workspaceId: string }> {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  try {
  await tx.insert(users).values({
    id: userId,
    handle: input.handle,
    email: input.email,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? null,
    emailVerifiedAt: input.emailVerified ? now : null,
  });
  } catch (error) {
    const constraint = findUniqueViolation(error);
    if (constraint) {
      const field = constraint.includes("email") ? "email" : "handle";
      throw new AppError("CONFLICT_ALREADY_EXISTS", {
        detail: `An account with that ${field} already exists.`,
        errors: [{ field, issue: "already registered" }],
      });
    }
    throw error;
  }
  await tx.insert(workspaces).values({
    id: workspaceId,
    name: "Personal",
    kind: "personal",
    ownerId: userId,
  });
  await tx.insert(members).values({
    workspaceId,
    userId,
    role: "owner",
  });
  if (input.passwordHash) {
    await tx.insert(credentials).values({
      id: randomUUID(),
      userId,
      kind: "password",
      secretHash: input.passwordHash,
    });
  }
  if (input.oauth) {
    await tx.insert(credentials).values({
      id: randomUUID(),
      userId,
      kind: "oauth",
      credentialId: `${input.oauth.provider}:${input.oauth.subject}`,
    });
  }
  await tx.insert(outbox).values({
    eventId: randomUUID(),
    type: "user.created.v1",
    payload: { userId, workspaceId, handle: input.handle },
  });
  return { userId, workspaceId };
}

export function createAuthService(deps: { db: Db; config: Config; now?: () => number }): AuthService {
  const { db, config } = deps;
  const now = deps.now ?? ((): number => Date.now());
  const isProduction = config.NODE_ENV === "production";

  function normalizeHandle(handle: string): string {
    const normalized = handle.trim().toLowerCase();
    if (!HANDLE_PATTERN.test(normalized)) {
      throw new AppError("VALIDATION_FAILED", {
        detail: "Registration failed schema validation.",
        errors: [
          {
            field: "handle",
            issue: "must be 3-32 chars: lowercase letters, digits, _ or -, starting alphanumeric",
          },
        ],
      });
    }
    return normalized;
  }

  async function issueSession(
    target: Executor,
    userId: string,
    context: AuthRequestContext,
  ): Promise<IssuedSession> {
    const token = generateSessionToken();
    const issuedAt = new Date(now());
    const expiresAt = new Date(now() + SESSION_TTL_MS);
    const device = await upsertDevice(target, userId, context.userAgent, issuedAt);
    const sessionId = randomUUID();
    await target.insert(sessions).values({
      id: sessionId,
      userId,
      tokenHash: hashToken(token),
      deviceId: device.id,
      expiresAt,
      lastSeenAt: issuedAt,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });
    const user = await target.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new AppError("INTERNAL", { detail: "User vanished after creation." });
    }
    return { user, sessionId, token, expiresAt };
  }

  async function register(
    input: RegisterInput,
    context: AuthRequestContext,
  ): Promise<RegisterResult> {
    const handle = normalizeHandle(input.handle);
    const email = input.email?.trim().toLowerCase() || null;
    const passwordHash = await hashPassword(input.password);
    const at = new Date(now());

    try {
      return await db.transaction(async (tx) => {
        const { userId } = await createAccountWithWorkspace(
          tx,
          { handle, email, displayName: input.displayName.trim(), passwordHash },
          at,
        );
        const issued = await issueSession(tx, userId, context);
        let devEmailToken: string | undefined;
        if (email) {
          const verification = await createAuthToken(tx, {
            userId,
            kind: "email_verify",
            ttlMs: EMAIL_VERIFY_TTL_MS,
            payload: { email },
            now: at,
          });
          await tx.insert(outbox).values({
            eventId: randomUUID(),
            type: "email.verification_requested.v1",
            payload: {
              userId,
              email,
              verifyUrl: `${config.APP_URL}/verify-email?token=${verification.token}`,
              expiresAt: new Date(at.getTime() + EMAIL_VERIFY_TTL_MS).toISOString(),
            },
          });
          if (!isProduction) devEmailToken = verification.token;
        }
        await writeAudit(tx, {
          actorUserId: userId,
          actorKind: "user",
          sessionId: issued.sessionId,
          action: "auth.register",
          requestId: context.requestId ?? null,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { handle, hasEmail: email !== null },
        });
        return devEmailToken !== undefined
          ? { ...issued, devEmailToken }
          : issued;
      });
    } catch (error) {
      const constraint = findUniqueViolation(error);
      if (constraint) {
        const field = constraint.includes("email") ? "email" : "handle";
        throw new AppError("CONFLICT_ALREADY_EXISTS", {
          detail: `An account with that ${field} already exists.`,
          errors: [{ field, issue: "already registered" }],
        });
      }
      throw error;
    }
  }

  async function login(
    input: LoginInput,
    context: AuthRequestContext,
  ): Promise<IssuedSession> {
    const identifier = input.identifier.trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: or(eq(users.handle, identifier), eq(users.email, identifier)),
    });

    const invalid = new AppError("AUTH_INVALID_CREDENTIALS", {
      detail: "Invalid credentials.",
    });

    if (!user) {
      await burnPasswordVerify(input.password);
      await writeAudit(db, {
        actorKind: "user",
        action: "auth.login_failed",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { identifier, reason: "unknown_user" },
      });
      throw invalid;
    }

    const credential = await db.query.credentials.findFirst({
      where: and(eq(credentials.userId, user.id), eq(credentials.kind, "password")),
    });
    const passwordOk = credential?.secretHash
      ? await verifyPassword(input.password, credential.secretHash)
      : false;

    if (!passwordOk) {
      if (!credential?.secretHash) await burnPasswordVerify(input.password);
      await writeAudit(db, {
        actorUserId: user.id,
        actorKind: "user",
        action: "auth.login_failed",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { identifier, reason: "bad_password" },
      });
      throw invalid;
    }

    return db.transaction(async (tx) => {
      const issued = await issueSession(tx, user.id, context);
      await writeAudit(tx, {
        actorUserId: user.id,
        actorKind: "user",
        sessionId: issued.sessionId,
        action: "auth.login",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { handle: user.handle },
      });
      return issued;
    });
  }

  async function logout(
    session: SessionRow,
    context: AuthRequestContext,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date(now()) })
        .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)));
      await writeAudit(tx, {
        actorUserId: session.userId,
        actorKind: "user",
        sessionId: session.id,
        action: "auth.logout",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      });
    });
  }

  async function resolveSession(token: string): Promise<AuthenticatedSession> {
    const tokenHash = hashToken(token);
    const rows = await db
      .select({ user: users, session: sessions })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new AppError("AUTH_REQUIRED", { detail: "Session not found." });
    }
    if (row.session.revokedAt !== null) {
      throw new AppError("AUTH_SESSION_REVOKED", { detail: "Session revoked." });
    }
    if (row.session.expiresAt.getTime() <= now()) {
      throw new AppError("AUTH_TOKEN_EXPIRED", { detail: "Session expired." });
    }

    if (row.session.lastSeenAt.getTime() + 60_000 < now()) {
      const at = new Date(now());
      await db
        .update(sessions)
        .set({ lastSeenAt: at })
        .where(eq(sessions.id, row.session.id));
      if (row.session.deviceId) {
        await db
          .update(devices)
          .set({ lastSeenAt: at })
          .where(eq(devices.id, row.session.deviceId));
      }
      row.session.lastSeenAt = at;
    }

    return { user: row.user, session: row.session };
  }

  async function getUser(userId: string): Promise<UserRow | undefined> {
    return db.query.users.findFirst({ where: eq(users.id, userId) });
  }

  async function requestPasswordReset(
    identifier: string,
    context: AuthRequestContext,
  ): Promise<ResetRequestResult> {
    const normalized = identifier.trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: or(eq(users.handle, normalized), eq(users.email, normalized)),
    });
    if (!user?.email) {
      return {};
    }
    const at = new Date(now());
    await invalidateAuthTokens(db, user.id, "password_reset");
    const reset = await createAuthToken(db, {
      userId: user.id,
      kind: "password_reset",
      ttlMs: PASSWORD_RESET_TTL_MS,
      payload: { email: user.email },
      now: at,
    });
    await db.insert(outbox).values({
      eventId: randomUUID(),
      type: "email.password_reset.v1",
      payload: {
        userId: user.id,
        email: user.email,
        resetUrl: `${config.APP_URL}/reset-password?token=${reset.token}`,
        expiresAt: new Date(at.getTime() + PASSWORD_RESET_TTL_MS).toISOString(),
      },
    });
    await writeAudit(db, {
      actorUserId: user.id,
      actorKind: "user",
      action: "auth.password_reset_requested",
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      metadata: { email: user.email },
    });
    return isProduction ? {} : { devToken: reset.token };
  }

  async function confirmPasswordReset(
    token: string,
    password: string,
    context: AuthRequestContext,
  ): Promise<void> {
    const consumed = await consumeAuthToken(db, "password_reset", token, new Date(now()));
    if (!consumed || !consumed.userId) {
      throw new AppError("VALIDATION_FAILED", {
        detail: "Password reset failed schema validation.",
        errors: [{ field: "token", issue: "invalid or expired" }],
      });
    }
    const userId = consumed.userId;
    const passwordHash = await hashPassword(password);
    await db.transaction(async (tx) => {
      const existing = await tx.query.credentials.findFirst({
        where: and(eq(credentials.userId, userId), eq(credentials.kind, "password")),
      });
      if (existing) {
        await tx
          .update(credentials)
          .set({ secretHash: passwordHash, lastUsedAt: null })
          .where(eq(credentials.id, existing.id));
      } else {
        await tx.insert(credentials).values({
          id: randomUUID(),
          userId,
          kind: "password",
          secretHash: passwordHash,
        });
      }
      await tx
        .update(sessions)
        .set({ revokedAt: new Date(now()) })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      await invalidateAuthTokens(tx, userId, "password_reset");
      await writeAudit(tx, {
        actorUserId: userId,
        actorKind: "user",
        action: "auth.password_reset_completed",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      });
    });
  }

  async function changePassword(
    userId: string,
    input: { currentPassword: string; password: string },
    options: { keepSessionId?: string },
    context: AuthRequestContext,
  ): Promise<void> {
    const existing = await db.query.credentials.findFirst({
      where: and(eq(credentials.userId, userId), eq(credentials.kind, "password")),
    });
    const currentOk = existing?.secretHash
      ? await verifyPassword(input.currentPassword, existing.secretHash)
      : false;
    if (!currentOk) {
      await burnPasswordVerify(input.currentPassword);
      throw new AppError("VALIDATION_FAILED", {
        detail: "Current password is incorrect.",
        errors: [{ field: "currentPassword", issue: "incorrect password" }],
      });
    }
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(credentials)
          .set({ secretHash: passwordHash, lastUsedAt: null })
          .where(eq(credentials.id, existing.id));
      } else {
        await tx.insert(credentials).values({
          id: randomUUID(),
          userId,
          kind: "password",
          secretHash: passwordHash,
        });
      }
      const revokeWhere = options.keepSessionId
        ? and(
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt),
            ne(sessions.id, options.keepSessionId),
          )
        : and(eq(sessions.userId, userId), isNull(sessions.revokedAt));
      await tx
        .update(sessions)
        .set({ revokedAt: new Date(now()) })
        .where(revokeWhere);
      await writeAudit(tx, {
        actorUserId: userId,
        actorKind: "user",
        action: "auth.password_changed",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      });
    });
  }

  async function requestEmailVerification(
    userId: string,
    context: AuthRequestContext,
  ): Promise<VerifyRequestResult> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    if (!user.email) {
      throw new AppError("VALIDATION_FAILED", {
        detail: "Verification failed schema validation.",
        errors: [{ field: "email", issue: "no email on account" }],
      });
    }
    const at = new Date(now());
    await invalidateAuthTokens(db, user.id, "email_verify");
    const verification = await createAuthToken(db, {
      userId: user.id,
      kind: "email_verify",
      ttlMs: EMAIL_VERIFY_TTL_MS,
      payload: { email: user.email },
      now: at,
    });
    await db.insert(outbox).values({
      eventId: randomUUID(),
      type: "email.verification_requested.v1",
      payload: {
        userId: user.id,
        email: user.email,
        verifyUrl: `${config.APP_URL}/verify-email?token=${verification.token}`,
        expiresAt: new Date(at.getTime() + EMAIL_VERIFY_TTL_MS).toISOString(),
      },
    });
    await writeAudit(db, {
      actorUserId: user.id,
      actorKind: "user",
      action: "auth.email_verification_requested",
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      metadata: { email: user.email },
    });
    return isProduction ? {} : { devToken: verification.token };
  }

  async function confirmEmailVerification(
    token: string,
    context: AuthRequestContext,
  ): Promise<UserRow> {
    const consumed = await consumeAuthToken(db, "email_verify", token, new Date(now()));
    if (!consumed || !consumed.userId) {
      throw new AppError("VALIDATION_FAILED", {
        detail: "Verification failed schema validation.",
        errors: [{ field: "token", issue: "invalid or expired" }],
      });
    }
    const at = new Date(now());
    const rows = await db
      .update(users)
      .set({ emailVerifiedAt: at, updatedAt: at })
      .where(eq(users.id, consumed.userId))
      .returning();
    const user = rows[0];
    if (!user) {
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    await writeAudit(db, {
      actorUserId: user.id,
      actorKind: "user",
      action: "auth.email_verified",
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });
    return user;
  }

  function sanitizeHandle(source: string): string {
    let base = source
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/^[^a-z0-9]+/, "");
    if (base.length < 3) {
      base = `user${base}`.slice(0, 8);
    }
    base = base.slice(0, 32);
    if (!HANDLE_PATTERN.test(base)) {
      base = `user_${generateToken(4).toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(4, "0").slice(0, 6)}`;
      base = base.slice(0, 32);
    }
    return base;
  }

  async function completeOAuthIdentity(
    identity: OAuthIdentityInput,
    options: { linkUserId: string | null },
    context: AuthRequestContext,
  ): Promise<OAuthCompletionResult> {
    const at = new Date(now());
    const connection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.provider, identity.provider),
        eq(oauthConnections.providerSubject, identity.subject),
      ),
    });

    if (connection) {
      await db
        .update(oauthConnections)
        .set({ lastLoginAt: at, email: identity.email })
        .where(eq(oauthConnections.id, connection.id));
      const issued = await db.transaction(async (tx) => {
        const session = await issueSession(tx, connection.userId, context);
        await writeAudit(tx, {
          actorUserId: connection.userId,
          actorKind: "user",
          sessionId: session.sessionId,
          action: "oauth.login",
          requestId: context.requestId ?? null,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          metadata: { provider: identity.provider },
        });
        return session;
      });
      return {
        issued,
        linked: false,
        isNewUser: false,
        onboardingCompleted: issued.user.onboardingCompletedAt !== null,
      };
    }

    if (options.linkUserId) {
      const target = await db.query.users.findFirst({
        where: eq(users.id, options.linkUserId),
      });
      if (!target) {
        throw new AppError("AUTH_OAUTH_FAILED", { detail: "Account to link not found." });
      }
      await db.insert(oauthConnections).values({
        id: randomUUID(),
        userId: target.id,
        provider: identity.provider,
        providerSubject: identity.subject,
        email: identity.email,
        lastLoginAt: at,
      });
      await writeAudit(db, {
        actorUserId: target.id,
        actorKind: "user",
        action: "oauth.link",
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { provider: identity.provider },
      });
      return {
        issued: null,
        linked: true,
        isNewUser: false,
        onboardingCompleted: target.onboardingCompletedAt !== null,
      };
    }

    const normalizedEmail = identity.email?.trim().toLowerCase() || null;
    if (normalizedEmail && identity.emailVerified) {
      const byEmail = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });
      if (byEmail) {
        const issued = await db.transaction(async (tx) => {
          await tx.insert(oauthConnections).values({
            id: randomUUID(),
            userId: byEmail.id,
            provider: identity.provider,
            providerSubject: identity.subject,
            email: normalizedEmail,
            lastLoginAt: at,
          });
          if (!byEmail.emailVerifiedAt) {
            await tx
              .update(users)
              .set({ emailVerifiedAt: at })
              .where(eq(users.id, byEmail.id));
          }
          const session = await issueSession(tx, byEmail.id, context);
          await writeAudit(tx, {
            actorUserId: byEmail.id,
            actorKind: "user",
            sessionId: session.sessionId,
            action: "oauth.link",
            requestId: context.requestId ?? null,
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            metadata: { provider: identity.provider, reason: "email_match" },
          });
          return session;
        });
        return {
          issued,
          linked: false,
          isNewUser: false,
          onboardingCompleted: issued.user.onboardingCompletedAt !== null,
        };
      }
    }

    const baseHandle = sanitizeHandle(
      normalizedEmail?.split("@")[0] ?? identity.subject,
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const handle =
        attempt === 0
          ? baseHandle
          : `${baseHandle.slice(0, 26)}${generateToken(3).toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(4, "0").slice(0, 5)}`;
      try {
        const issued = await db.transaction(async (tx) => {
          const { userId } = await createAccountWithWorkspace(
            tx,
            {
              handle,
              email: normalizedEmail,
              displayName: identity.name?.trim() || handle,
              avatarUrl: identity.picture,
              emailVerified: identity.emailVerified,
              oauth: { provider: identity.provider, subject: identity.subject },
            },
            at,
          );
          await tx.insert(oauthConnections).values({
            id: randomUUID(),
            userId,
            provider: identity.provider,
            providerSubject: identity.subject,
            email: normalizedEmail,
            lastLoginAt: at,
          });
          const session = await issueSession(tx, userId, context);
          await writeAudit(tx, {
            actorUserId: userId,
            actorKind: "user",
            sessionId: session.sessionId,
            action: "oauth.register",
            requestId: context.requestId ?? null,
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            metadata: { provider: identity.provider, handle },
          });
          return session;
        });
        return {
          issued,
          linked: false,
          isNewUser: true,
          onboardingCompleted: false,
        };
      } catch (error) {
        const constraint = findUniqueViolation(error);
        if (constraint?.includes("handle")) continue;
        if (constraint?.includes("email")) {
          throw new AppError("CONFLICT_ALREADY_EXISTS", {
            detail: "An account with that email already exists.",
            errors: [{ field: "email", issue: "already registered" }],
          });
        }
        throw error;
      }
    }
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Could not derive a unique handle." });
  }

  return {
    register,
    login,
    logout,
    resolveSession,
    getUser,
    requestPasswordReset,
    confirmPasswordReset,
    changePassword,
    requestEmailVerification,
    confirmEmailVerification,
    completeOAuthIdentity,
  };
}
