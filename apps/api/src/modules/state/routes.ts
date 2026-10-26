import { AppError } from "@personalos/api-contract";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import type { Db } from "../../db/index";
import { documents, workspaces } from "../../db/schema";

const COLLECTION = "app_state";

const putSchema = z.object({
  baseVersion: z.number().int().min(0).optional(),
  envelope: z.object({ version: z.number(), savedAt: z.number(), state: z.record(z.string(), z.unknown()) }),
});

function userIdOf(request: FastifyRequest): string {
  if (!request.auth) throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
  return request.auth.user.id;
}

export const stateRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const where = (userId: string) => and(eq(documents.collection, COLLECTION), eq(documents.id, userId));

  app.get("/api/v1/state", { preHandler: (request) => app.authenticate(request) }, async (request) => {
    const userId = userIdOf(request);
    const rows = await db.select().from(documents).where(where(userId)).limit(1);
    const row = rows[0];
    if (!row) return { envelope: null, version: 0 };
    return { envelope: row.document, version: row.version, updatedAt: row.updatedAt.toISOString() };
  });

  app.put(
    "/api/v1/state",
    { preHandler: (request) => app.authenticate(request), bodyLimit: 25 * 1024 * 1024 },
    async (request, reply) => {
      const userId = userIdOf(request);
      const parsed = putSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_FAILED", { detail: "State payload failed schema validation." });
      }
      const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.ownerId, userId) });
      const current = await db.select({ version: documents.version }).from(documents).where(where(userId)).limit(1);
      const currentVersion = current[0]?.version ?? 0;
      if (parsed.data.baseVersion !== undefined && parsed.data.baseVersion < currentVersion) {
        reply.code(409);
        return { code: "CONFLICT_VERSION", version: currentVersion };
      }
      const now = new Date();
      const rows = await db
        .insert(documents)
        .values({
          collection: COLLECTION,
          id: userId,
          ownerId: userId,
          workspaceId: workspace?.id ?? userId,
          document: parsed.data.envelope,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [documents.collection, documents.id],
          set: { document: parsed.data.envelope, updatedAt: now, version: sql`${documents.version} + 1` },
        })
        .returning({ version: documents.version });
      return { version: rows[0].version, updatedAt: now.toISOString() };
    },
  );
};
