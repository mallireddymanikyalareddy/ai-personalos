import { timingSafeEqual } from "node:crypto";

import { AppError } from "@personalos/api-contract";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import type { Db } from "../../db/index";
import { documents, users } from "../../db/schema";

const PREF = "digest_pref";
const STATE = "app_state";

const putSchema = z.object({ enabled: z.boolean() });
const sentSchema = z.object({ week: z.string().min(1).max(16) });
const userParams = z.object({ userId: z.string().uuid() });

interface DigestPref {
  enabled: boolean;
  lastSentWeek: string | null;
}

function requireInternal(request: FastifyRequest): void {
  const expected = process.env.INTERNAL_TOKEN ?? "";
  const given = String(request.headers["x-internal-token"] ?? "");
  const ok = expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) throw new AppError("NOT_FOUND", { detail: "Not found." });
}

export const digestRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const docWhere = (collection: string, id: string) => and(eq(documents.collection, collection), eq(documents.id, id));

  async function getPref(userId: string): Promise<DigestPref> {
    const rows = await db.select().from(documents).where(docWhere(PREF, userId)).limit(1);
    const doc = rows[0]?.document as Partial<DigestPref> | undefined;
    return { enabled: doc?.enabled === true, lastSentWeek: doc?.lastSentWeek ?? null };
  }

  async function savePref(userId: string, pref: DigestPref): Promise<void> {
    const now = new Date();
    await db
      .insert(documents)
      .values({ collection: PREF, id: userId, ownerId: userId, workspaceId: userId, document: { ...pref }, updatedAt: now })
      .onConflictDoUpdate({ target: [documents.collection, documents.id], set: { document: { ...pref }, updatedAt: now } });
  }

  async function digestUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;
    const stateRows = await db.select().from(documents).where(docWhere(STATE, userId)).limit(1);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      pref: await getPref(userId),
      envelope: stateRows[0]?.document ?? null,
    };
  }

  app.get("/api/v1/digest", { preHandler: (request) => app.authenticate(request) }, async (request) => {
    const auth = request.auth!;
    return { ...(await getPref(auth.user.id)), email: auth.user.email ?? null };
  });

  app.put("/api/v1/digest", { preHandler: (request) => app.authenticate(request) }, async (request) => {
    const auth = request.auth!;
    const parsed = putSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", { detail: "Expected { enabled: boolean }." });
    if (parsed.data.enabled && !auth.user.email) {
      throw new AppError("VALIDATION_FAILED", { detail: "Add an email address to your account first." });
    }
    const pref = { ...(await getPref(auth.user.id)), enabled: parsed.data.enabled };
    await savePref(auth.user.id, pref);
    return { ...pref, email: auth.user.email ?? null };
  });

  app.get("/internal/v1/digest/subscribers", async (request) => {
    requireInternal(request);
    const rows = await db.select().from(documents).where(eq(documents.collection, PREF));
    const ids = rows.filter((row) => (row.document as Partial<DigestPref>).enabled === true).map((row) => row.id);
    if (ids.length === 0) return { items: [] };
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
    const items = [];
    for (const { id } of found) {
      const item = await digestUser(id);
      if (item?.email) items.push(item);
    }
    return { items };
  });

  app.get("/internal/v1/digest/users/:userId", async (request) => {
    requireInternal(request);
    const { userId } = userParams.parse(request.params);
    const item = await digestUser(userId);
    if (!item) throw new AppError("NOT_FOUND", { detail: "User not found." });
    return item;
  });

  app.post("/internal/v1/digest/users/:userId/sent", async (request) => {
    requireInternal(request);
    const { userId } = userParams.parse(request.params);
    const { week } = sentSchema.parse(request.body);
    await savePref(userId, { ...(await getPref(userId)), lastSentWeek: week });
    return { ok: true };
  });
};
