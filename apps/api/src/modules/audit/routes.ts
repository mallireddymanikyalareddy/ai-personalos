import { AppError } from "@personalos/api-contract";
import type { FastifyPluginAsync } from "fastify";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "../../db/index";
import { auditLog, members } from "../../db/schema";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(128).optional(),
});

function encodeCursor(row: { ts: Date; id: number }): string {
  return `${row.ts.getTime()}_${row.id}`;
}

function decodeCursor(cursor: string): { ts: Date; id: number } | null {
  const match = /^(\d+)_(\d+)$/.exec(cursor);
  if (!match) return null;
  return { ts: new Date(Number(match[1])), id: Number(match[2]) };
}

export const auditRoutes: FastifyPluginAsync<{ db: Db }> = async (app, options) => {
  const { db } = options;

  app.get(
    "/api/v1/audit",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const auth = request.auth;
      if (!auth) {
        throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
      }
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_FAILED", {
          detail: "Query failed schema validation.",
          errors: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            issue: issue.message,
          })),
        });
      }
      const { limit, cursor } = parsed.data;
      const scope: SQL | undefined = or(
        eq(auditLog.actorUserId, auth.user.id),
        inArray(
          auditLog.workspaceId,
          db.select({ id: members.workspaceId }).from(members).where(eq(members.userId, auth.user.id)),
        ),
      );
      let where: SQL | undefined = scope;
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (!decoded) {
          throw new AppError("VALIDATION_FAILED", {
            detail: "Query failed schema validation.",
            errors: [{ field: "cursor", issue: "malformed cursor" }],
          });
        }
        where = and(
          scope,
          sql`(${auditLog.ts}, ${auditLog.id}) < (${decoded.ts}, ${decoded.id})`,
        );
      }
      const rows = await db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.ts), desc(auditLog.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items.at(-1);
      return {
        items: items.map((row) => ({
          id: String(row.id),
          action: row.action,
          actorKind: row.actorKind,
          resourceCollection: row.resourceCollection,
          resourceId: row.resourceId,
          ip: row.ip,
          ts: row.ts.toISOString(),
          metadata: row.metadata,
        })),
        nextCursor: hasMore && last ? encodeCursor(last) : null,
      };
    },
  );
};
