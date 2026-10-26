import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { buildApp } from "../../app";
import { loadConfig } from "../../config";
import { auditLog, credentials, members, outbox, sessions, users, workspaces } from "../../db/schema";
import { createTestDb, type TestDb } from "../../db/testing";
import { createAuthService } from "./service";
import { SESSION_TTL_MS } from "./tokens";

const PASSWORD = "correct horse battery staple";
const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });

let fixture: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

interface Registration {
  body: {
    user: { id: string; handle: string; displayName: string; email: string | null };
    token: string;
    expiresAt: string;
  };
  cookie: string;
}

async function register(
  handle: string,
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
): Promise<Registration> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      handle,
      displayName: overrides.displayName ?? handle,
      password: overrides.password ?? PASSWORD,
      ...(overrides.email !== undefined ? { email: overrides.email } : {}),
    },
  });
  expect(res.statusCode).toBe(201);
  return { body: res.json(), cookie: String(res.headers["set-cookie"]) };
}

beforeAll(async () => {
  fixture = await createTestDb();
  app = await buildApp({ config, logger: false, db: fixture.db });
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app.close();
  await fixture.client.close();
});

describe("POST /api/v1/auth/register", () => {
  it("creates user, personal workspace, membership, credential, audit and outbox rows", async () => {
    const { body, cookie } = await register("Alice_01", { displayName: "Alice" });

    expect(body.user.handle).toBe("alice_01");
    expect(body.user.displayName).toBe("Alice");
    expect(typeof body.token).toBe("string");
    expect(cookie).toContain("pos_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const userRows = await fixture.db.select().from(users).where(eq(users.id, body.user.id));
    expect(userRows).toHaveLength(1);

    const workspaceRows = await fixture.db.select().from(workspaces).where(eq(workspaces.ownerId, body.user.id));
    expect(workspaceRows).toHaveLength(1);
    expect(workspaceRows[0].kind).toBe("personal");

    const memberRows = await fixture.db.select().from(members).where(eq(members.userId, body.user.id));
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].role).toBe("owner");

    const credentialRows = await fixture.db.select().from(credentials).where(eq(credentials.userId, body.user.id));
    expect(credentialRows).toHaveLength(1);
    expect(credentialRows[0].secretHash).toContain("scrypt$");
    expect(credentialRows[0].secretHash).not.toContain(PASSWORD);

    const auditRows = await fixture.db.select().from(auditLog).where(eq(auditLog.action, "auth.register"));
    expect(auditRows.some((row) => row.actorUserId === body.user.id)).toBe(true);

    const outboxRows = await fixture.db.select().from(outbox).where(eq(outbox.type, "user.created.v1"));
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].eventId).toBeTruthy();
  });

  it("rejects a duplicate handle with 409", async () => {
    await register("dup_user");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { handle: "dup_user", displayName: "Dup", password: PASSWORD },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("CONFLICT_ALREADY_EXISTS");
  });

  it("rejects a weak password with 400 and a field error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { handle: "weak_user", displayName: "Weak", password: "short" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors.some((e: { field: string }) => e.field === "password")).toBe(true);
  });

  it("rejects an invalid handle with 400 and a field error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { handle: "ab", displayName: "Nope", password: PASSWORD },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors.some((e: { field: string }) => e.field === "handle")).toBe(true);
  });

  it("lowercases and stores a mixed-case email", async () => {
    const { body } = await register("email_user", { email: "MixedCase@Example.COM" });
    expect(body.user.email).toBe("mixedcase@example.com");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("accepts the identifier in any case and issues a fresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "ALICE_01", password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.handle).toBe("alice_01");
    expect(body.token).toBeTruthy();
    const auditRows = await fixture.db.select().from(auditLog).where(eq(auditLog.action, "auth.login"));
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects a wrong password without leaking which field failed", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "alice_01", password: "wrong password entirely" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe("AUTH_INVALID_CREDENTIALS");
    const failedRows = await fixture.db.select().from(auditLog).where(eq(auditLog.action, "auth.login_failed"));
    expect(failedRows.some((row) => row.metadata?.reason === "bad_password")).toBe(true);
  });

  it("returns the same error for an unknown identifier", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "no_such_user", password: PASSWORD },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_INVALID_CREDENTIALS");
    const failedRows = await fixture.db.select().from(auditLog).where(eq(auditLog.action, "auth.login_failed"));
    expect(failedRows.some((row) => row.metadata?.reason === "unknown_user")).toBe(true);
  });
});

describe("session authentication", () => {
  it("resolves the bearer token via /auth/me", async () => {
    const { body } = await register("me_user");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: bearer(body.token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.handle).toBe("me_user");
  });

  it("resolves the session cookie via /auth/me", async () => {
    const { cookie } = await register("cookie_user");
    const token = cookie.split("pos_session=")[1].split(";")[0];
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `pos_session=${decodeURIComponent(token)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.handle).toBe("cookie_user");
  });

  it("rejects a missing token with 401 AUTH_REQUIRED", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("rejects an unknown token with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: bearer("not-a-real-token"),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("logout revokes the session and clears the cookie", async () => {
    const { body, cookie } = await register("logout_user");
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: bearer(body.token),
    });
    expect(logoutRes.statusCode).toBe(204);
    expect(String(logoutRes.headers["set-cookie"])).toContain("Max-Age=0");

    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: bearer(body.token),
    });
    expect(meRes.statusCode).toBe(401);
    expect(meRes.json().code).toBe("AUTH_SESSION_REVOKED");

    const sessionRows = await fixture.db.select().from(sessions).where(eq(sessions.userId, body.user.id));
    expect(sessionRows[0].revokedAt).not.toBeNull();
    expect(cookie).toContain("HttpOnly");
  });

  it("rejects logout without a session", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/logout" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("marks an expired session with AUTH_TOKEN_EXPIRED", async () => {
    let current = Date.now();
    const service = createAuthService({ db: fixture.db, config, now: () => current });
    const issued = await service.register(
      { handle: "expire_user", password: PASSWORD, displayName: "Expire" },
      {},
    );
    current += SESSION_TTL_MS + 1000;
    await expect(service.resolveSession(issued.token)).rejects.toMatchObject({
      code: "AUTH_TOKEN_EXPIRED",
    });
  });
});

describe("POST /api/v1/auth/login rate limiting", () => {
  it("returns 429 after ten attempts for one identifier", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { identifier: "locked_user", password: "wrong password here" },
      });
      expect(res.statusCode).toBe(401);
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "locked_user", password: "wrong password here" },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe("RATE_LIMITED");
  }, 30_000);
});

describe("GET /api/v1/audit", () => {
  it("returns the actor's own audit trail with pagination cursor", async () => {
    const { body } = await register("audit_user");
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "audit_user", password: PASSWORD },
    });
    expect(loginRes.statusCode).toBe(200);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit?limit=5",
      headers: bearer(body.token),
    });
    expect(res.statusCode).toBe(200);
    const auditBody = res.json();
    const actions = auditBody.items.map((item: { action: string }) => item.action);
    expect(actions).toContain("auth.register");
    expect(actions).toContain("auth.login");
    expect(typeof auditBody.items[0].ts).toBe("string");
  });

  it("rejects a malformed cursor with 400", async () => {
    const { body } = await register("cursor_user");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit?cursor=garbage",
      headers: bearer(body.token),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_FAILED");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit" });
    expect(res.statusCode).toBe(401);
  });
});
