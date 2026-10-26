import { and, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";

import { AppError } from "@personalos/api-contract";

import type { Db } from "./index";
import { documents } from "./schema";

export interface DocumentRecord {
  collection: string;
  id: string;
  ownerId: string;
  workspaceId: string;
  scope: string;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
  document: Record<string, unknown>;
}

export interface CreateDocumentInput {
  collection: string;
  id: string;
  ownerId: string;
  workspaceId: string;
  scope?: string;
  document: Record<string, unknown>;
}

export interface UpdateDocumentInput {
  document: Record<string, unknown>;
  scope?: string;
}

export interface ListDocumentsOptions {
  collections?: string[];
  updatedSince?: Date;
  includeDeleted?: boolean;
  limit?: number;
  cursor?: string;
}

export interface ListDocumentsResult {
  items: DocumentRecord[];
  nextCursor: string | null;
}

function encodeCursor(record: { updatedAt: Date; id: string }): string {
  return `${record.updatedAt.getTime()}_${record.id}`;
}

function decodeCursor(cursor: string): { updatedAt: Date; id: string } | null {
  const separator = cursor.indexOf("_");
  if (separator <= 0) return null;
  const ms = Number(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (!Number.isFinite(ms) || id.length === 0) return null;
  return { updatedAt: new Date(ms), id };
}

export function createDocumentRepository(db: Db) {
  async function get(
    collection: string,
    id: string,
  ): Promise<DocumentRecord | undefined> {
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.collection, collection), eq(documents.id, id)))
      .limit(1);
    return rows[0];
  }

  async function create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const rows = await db
      .insert(documents)
      .values({
        collection: input.collection,
        id: input.id,
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        scope: input.scope ?? "private",
        version: 1,
        updatedAt: new Date(),
        document: input.document,
      })
      .onConflictDoNothing()
      .returning();
    if (rows.length === 0) {
      throw new AppError("CONFLICT_ALREADY_EXISTS", {
        detail: `${input.collection}/${input.id} already exists.`,
      });
    }
    return rows[0];
  }

  async function throwWriteMismatch(
    collection: string,
    id: string,
    expectedVersion: number,
  ): Promise<never> {
    const existing = await get(collection, id);
    if (!existing) {
      throw new AppError("NOT_FOUND", { detail: `${collection}/${id} not found.` });
    }
    if (existing.deletedAt !== null) {
      throw new AppError("NOT_FOUND", {
        detail: `${collection}/${id} is deleted.`,
      });
    }
    throw new AppError("CONFLICT_VERSION", {
      detail: `${collection}/${id} is at version ${existing.version}, expected ${expectedVersion}.`,
    });
  }

  async function update(
    collection: string,
    id: string,
    expectedVersion: number,
    patch: UpdateDocumentInput,
  ): Promise<DocumentRecord> {
    const rows = await db
      .update(documents)
      .set({
        document: patch.document,
        ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.collection, collection),
          eq(documents.id, id),
          eq(documents.version, expectedVersion),
          isNull(documents.deletedAt),
        ),
      )
      .returning();
    if (rows.length > 0) return rows[0];
    return throwWriteMismatch(collection, id, expectedVersion);
  }

  async function softDelete(
    collection: string,
    id: string,
    expectedVersion: number,
  ): Promise<DocumentRecord> {
    const rows = await db
      .update(documents)
      .set({
        deletedAt: new Date(),
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.collection, collection),
          eq(documents.id, id),
          eq(documents.version, expectedVersion),
          isNull(documents.deletedAt),
        ),
      )
      .returning();
    if (rows.length > 0) return rows[0];
    return throwWriteMismatch(collection, id, expectedVersion);
  }

  async function listByWorkspace(
    workspaceId: string,
    options: ListDocumentsOptions = {},
  ): Promise<ListDocumentsResult> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
    const conditions = [eq(documents.workspaceId, workspaceId)];

    if (options.collections && options.collections.length > 0) {
      conditions.push(inArray(documents.collection, options.collections));
    }
    if (options.updatedSince) {
      conditions.push(gt(documents.updatedAt, options.updatedSince));
    }
    if (!options.includeDeleted) {
      conditions.push(isNull(documents.deletedAt));
    }
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (!decoded) {
        throw new AppError("VALIDATION_FAILED", {
          detail: "Malformed cursor.",
          errors: [{ field: "cursor", issue: "must be an opaque list cursor" }],
        });
      }
      const cursorCondition = or(
        lt(documents.updatedAt, decoded.updatedAt),
        and(eq(documents.updatedAt, decoded.updatedAt), lt(documents.id, decoded.id)),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }

    const rows = await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt), desc(documents.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  return { get, create, update, softDelete, listByWorkspace };
}

export type DocumentRepository = ReturnType<typeof createDocumentRepository>;
