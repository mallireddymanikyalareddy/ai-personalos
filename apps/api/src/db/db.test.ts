import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppError } from "@personalos/api-contract";

import { buildApp } from "../app";
import { loadConfig } from "../config";
import { createDocumentRepository } from "./documents";
import { auditLog, documents, outbox } from "./schema";
import { createTestDb, type TestDb } from "./testing";

const WORKSPACE = randomUUID();
const OWNER = randomUUID();

let fixture: TestDb;
let repo: ReturnType<typeof createDocumentRepository>;

beforeAll(async () => {
  fixture = await createTestDb();
  repo = createDocumentRepository(fixture.db);
}, 60_000);

afterAll(async () => {
  await fixture.client.close();
});

describe("migrations", () => {
  it("creates every control and entity table", async () => {
    const result = await fixture.db.execute(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `);
    const names = result.rows.map(
      (row) => (row as { table_name: string }).table_name,
    );
    for (const expected of [
      "audit_log",
      "credentials",
      "devices",
      "documents",
      "members",
      "outbox",
      "sessions",
      "users",
      "workspaces",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("is idempotent on re-run", async () => {
    const { migrateDb } = await import("./index");
    await migrateDb(fixture.db);
  });
});

describe("document repository", () => {
  const collection = "tasks";
  const id = randomUUID();

  it("creates and reads back a document", async () => {
    const created = await repo.create({
      collection,
      id,
      ownerId: OWNER,
      workspaceId: WORKSPACE,
      scope: "workspace",
      document: { id, type: "task", title: "Ship stage 4" },
    });
    expect(created.version).toBe(1);
    expect(created.deletedAt).toBeNull();
    expect(created.document.title).toBe("Ship stage 4");

    const fetched = await repo.get(collection, id);
    expect(fetched).toEqual(created);
  });

  it("rejects duplicate creation with CONFLICT_ALREADY_EXISTS", async () => {
    await expect(
      repo.create({
        collection,
        id,
        ownerId: OWNER,
        workspaceId: WORKSPACE,
        document: { id },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT_ALREADY_EXISTS", status: 409 });
  });

  it("updates with a matching version and bumps to version 2", async () => {
    const updated = await repo.update(collection, id, 1, {
      document: { id, type: "task", title: "Shipped" },
    });
    expect(updated.version).toBe(2);
    expect(updated.document.title).toBe("Shipped");
    expect(updated.scope).toBe("workspace");
  });

  it("rejects a stale write with CONFLICT_VERSION", async () => {
    await expect(
      repo.update(collection, id, 1, { document: { id, stale: true } }),
    ).rejects.toBeInstanceOf(AppError);
    try {
      await repo.update(collection, id, 1, { document: { id, stale: true } });
    } catch (error) {
      expect((error as AppError).code).toBe("CONFLICT_VERSION");
      expect((error as AppError).status).toBe(409);
    }
  });

  it("returns NOT_FOUND for unknown documents", async () => {
    try {
      await repo.update(collection, randomUUID(), 1, { document: {} });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("soft-deletes, hides from later updates, and keeps the tombstone readable", async () => {
    const deleted = await repo.softDelete(collection, id, 2);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.version).toBe(3);

    expect(await repo.get(collection, id)).toBeDefined();
    try {
      await repo.update(collection, id, 3, { document: { id, zombie: true } });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("lists workspace documents newest-first with cursor pagination", async () => {
    const listWorkspace = randomUUID();
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    const ids = Array.from({ length: 5 }, () => randomUUID());
    for (const [index, docId] of ids.entries()) {
      await fixture.db.insert(documents).values({
        collection: "notes",
        id: docId,
        ownerId: OWNER,
        workspaceId: listWorkspace,
        scope: "workspace",
        version: 1,
        updatedAt: new Date(base + index * 1000),
        document: { id: docId, type: "note", index },
      });
    }

    const first = await repo.listByWorkspace(listWorkspace, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    expect(first.items[0].document.index).toBe(4);
    expect(first.items[1].document.index).toBe(3);

    const second = await repo.listByWorkspace(listWorkspace, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((item) => item.document.index)).toEqual([2, 1]);

    const third = await repo.listByWorkspace(listWorkspace, {
      limit: 2,
      cursor: second.nextCursor ?? undefined,
    });
    expect(third.items.map((item) => item.document.index)).toEqual([0]);
    expect(third.nextCursor).toBeNull();

    const filtered = await repo.listByWorkspace(listWorkspace, {
      collections: ["projects"],
    });
    expect(filtered.items).toHaveLength(0);

    await expect(
      repo.listByWorkspace(listWorkspace, { cursor: "garbage" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("control tables", () => {
  it("records audit rows and queries them by actor", async () => {
    const actor = randomUUID();
    await fixture.db.insert(auditLog).values({
      actorUserId: actor,
      actorKind: "user",
      action: "auth.login",
      requestId: "req_audit_1",
      metadata: { method: "password" },
    });
    const rows = await fixture.db
      .select()
      .from(auditLog)
      .where(sql`${auditLog.actorUserId} = ${actor}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("auth.login");
    expect(rows[0].metadata).toEqual({ method: "password" });
  });

  it("enforces outbox event id uniqueness", async () => {
    const eventId = randomUUID();
    await fixture.db.insert(outbox).values({
      eventId,
      type: "task.completed.v1",
      payload: { taskId: randomUUID() },
    });
    await expect(
      fixture.db.insert(outbox).values({
        eventId,
        type: "task.completed.v1",
        payload: {},
      }),
    ).rejects.toThrow();
    const rows = await fixture.db
      .select()
      .from(outbox)
      .where(sql`${outbox.eventId} = ${eventId}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
  });
});

describe("readiness with a database", () => {
  it("reports the database check as ready", async () => {
    const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });
    const app = await buildApp({
      config,
      logger: false,
      checks: [
        {
          name: "database",
          run: async () => {
            await fixture.db.execute(sql`select 1`);
          },
        },
      ],
    });
    const response = await app.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ready",
      checks: [{ name: "database", ok: true }],
    });
    await app.close();
  });
});
