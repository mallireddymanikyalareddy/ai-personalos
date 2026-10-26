import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import type { Db } from "../../db/index";
import { authTokens } from "../../db/schema";
import { hashToken } from "./tokens";

export type AuthTokenKind = "password_reset" | "email_verify" | "oauth_state";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export interface CreateAuthTokenInput {
  userId: string | null;
  kind: AuthTokenKind;
  ttlMs: number;
  payload?: Record<string, unknown>;
  now?: Date;
}

export async function createAuthToken(
  target: Pick<Db, "insert">,
  input: CreateAuthTokenInput,
): Promise<{ id: string; token: string }> {
  const token = generateToken();
  const now = input.now ?? new Date();
  const rows = await target
    .insert(authTokens)
    .values({
      id: randomUUID(),
      userId: input.userId,
      kind: input.kind,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + input.ttlMs),
      payload: input.payload ?? null,
      createdAt: now,
    })
    .returning({ id: authTokens.id });
  return { id: rows[0].id, token };
}

export async function invalidateAuthTokens(
  target: Pick<Db, "update">,
  userId: string,
  kind: AuthTokenKind,
): Promise<void> {
  await target
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.kind, kind),
        isNull(authTokens.usedAt),
      ),
    );
}

export async function consumeAuthToken(
  db: Db,
  kind: AuthTokenKind,
  token: string,
  now?: Date,
): Promise<{ id: string; userId: string | null; payload: Record<string, unknown> | null } | undefined> {
  const at = now ?? new Date();
  const rows = await db
    .update(authTokens)
    .set({ usedAt: at })
    .where(
      and(
        eq(authTokens.kind, kind),
        eq(authTokens.tokenHash, hashToken(token)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, at),
      ),
    )
    .returning({
      id: authTokens.id,
      userId: authTokens.userId,
      payload: authTokens.payload,
    });
  return rows[0];
}
