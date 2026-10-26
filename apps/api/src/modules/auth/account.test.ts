import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { buildApp } from "../../app";
import { loadConfig } from "../../config";
import { auditLog, documents, outbox } from "../../db/schema";
import { createTestDb, type TestDb } from "../../db/testing";

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
    devEmailToken?: string;
  };
}

async function register(
  handle: string,
  overrides: Partial<{ email: string; password: string }> = {},
): Promise<Registration> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      handle,
      displayName: handle,
      password: overrides.password ?? PASSWORD,
      ...(overrides.email !== undefined ? { email: overrides.email } : {}),
    },
  });
  expect(res.statusCode).toBe(201);
  return { body: res.json() };
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

describe("GET /api/v1/users/me", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/users/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("returns the profile with defaulted preferences", async () => {
    const { body } = await register("profile_user");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(res.statusCode).toBe(200);
    const profile = res.json();
    expect(profile.handle).toBe("profile_user");
    expect(profile.timezone).toBe("UTC");
    expect(profile.emailVerified).toBe(false);
    expect(profile.onboardingCompleted).toBe(false);
    expect(profile.preferences.theme).toBe("system");
    expect(profile.preferences.workingHours.start).toBe("09:00");
    expect(profile.preferences.sleepSchedule.bedtime).toBe("23:00");
    expect(profile.preferences.ai.tone).toBe("balanced");
    expect(profile.preferences.notifications.quietHours.end).toBe("07:00");
  });
});

describe("PATCH /api/v1/users/me", () => {
  it("updates profile fields and merges preferences with audit", async () => {
    const { body } = await register("patch_user");
    const first = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
      payload: {
        displayName: "Patch Person",
        timezone: "Asia/Kolkata",
        locale: "en-IN",
        preferences: { theme: "dark", weekStart: "sunday" },
      },
    });
    expect(first.statusCode).toBe(200);
    const updated = first.json();
    expect(updated.displayName).toBe("Patch Person");
    expect(updated.timezone).toBe("Asia/Kolkata");
    expect(updated.locale).toBe("en-IN");
    expect(updated.preferences.theme).toBe("dark");
    expect(updated.preferences.weekStart).toBe("sunday");
    expect(updated.preferences.timeFormat).toBe("24h");

    const audits = await fixture.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.profile_updated"));
    expect(
      audits.some((row) => {
        const fields = row.metadata?.fields;
        return (
          row.actorUserId === body.user.id &&
          Array.isArray(fields) &&
          fields.includes("displayName")
        );
      }),
    ).toBe(true);
  });

  it("rejects an invalid timezone with a field error", async () => {
    const { body } = await register("tz_user");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
      payload: { timezone: "Mars/Olympus" },
    });
    expect(res.statusCode).toBe(400);
    const problem = res.json();
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(
      (problem.errors as Array<{ field: string }>).some(
        (entry) => entry.field === "timezone",
      ),
    ).toBe(true);
  });

  it("rejects an empty patch", async () => {
    const { body } = await register("empty_patch_user");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_FAILED");
  });
});

describe("onboarding", () => {
  it("exposes the catalog before completion", async () => {
    const { body } = await register("onboard_state_user");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/me/onboarding",
      headers: bearer(body.token),
    });
    expect(res.statusCode).toBe(200);
    const state = res.json();
    expect(state.completed).toBe(false);
    expect(state.profile.handle).toBe("onboard_state_user");
    expect(state.lifeAreaCatalog).toHaveLength(6);
    expect(state.lifeAreaCatalog[0]).toMatchObject({ name: "Work", color: "#4f46e5" });
  });

  it("completes onboarding, creates life areas and marks completion", async () => {
    const { body } = await register("onboard_user");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/onboarding",
      headers: bearer(body.token),
      payload: {
        displayName: "Onboarded User",
        timezone: "Europe/Berlin",
        locale: "de-DE",
        lifeAreaNames: ["Work", "Health", "Learning"],
        preferences: { planningPreference: "evening", theme: "dark" },
      },
    });
    expect(res.statusCode).toBe(200);
    const profile = res.json();
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.timezone).toBe("Europe/Berlin");
    expect(profile.locale).toBe("de-DE");
    expect(profile.displayName).toBe("Onboarded User");
    expect(profile.preferences.planningPreference).toBe("evening");
    expect(profile.preferences.primaryLifeAreaIds).toHaveLength(3);

    const areaRows = await fixture.db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, body.user.id));
    expect(areaRows).toHaveLength(3);
    expect(areaRows.every((row) => row.collection === "lifeAreas")).toBe(true);
    expect(
      areaRows.every((row) =>
        ["Work", "Health", "Learning"].includes(String(row.document.name)),
      ),
    ).toBe(true);
    expect(areaRows.every((row) => row.document.status === "active")).toBe(true);
    expect(areaRows.every((row) => typeof row.document.color === "string")).toBe(true);
    const areaIds = new Set(areaRows.map((row) => row.id));
    expect(
      profile.preferences.primaryLifeAreaIds.every((id: string) => areaIds.has(id)),
    ).toBe(true);

    const audits = await fixture.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.onboarded"));
    expect(audits.some((row) => row.actorUserId === body.user.id)).toBe(true);

    const events = await fixture.db
      .select()
      .from(outbox)
      .where(eq(outbox.type, "user.onboarded.v1"));
    expect(
      events.some(
        (row) =>
          row.payload &&
          (row.payload as { userId?: string }).userId === body.user.id,
      ),
    ).toBe(true);

    const state = await app.inject({
      method: "GET",
      url: "/api/v1/users/me/onboarding",
      headers: bearer(body.token),
    });
    expect(state.json().completed).toBe(true);
  });

  it("rejects unknown life areas", async () => {
    const { body } = await register("onboard_bad_area");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/onboarding",
      headers: bearer(body.token),
      payload: {
        timezone: "UTC",
        locale: "en-US",
        lifeAreaNames: ["Spaceship"],
      },
    });
    expect(res.statusCode).toBe(400);
    const problem = res.json();
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(
      (problem.errors as Array<{ issue: string }>).some((entry) =>
        entry.issue.includes("Spaceship"),
      ),
    ).toBe(true);
  });

  it("is idempotent for already created life areas", async () => {
    const { body } = await register("onboard_idem_user");
    const payload = {
      timezone: "UTC",
      locale: "en-US",
      lifeAreaNames: ["Work", "Money"],
    };
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/onboarding",
      headers: bearer(body.token),
      payload,
    });
    expect(first.statusCode).toBe(200);
    const again = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/onboarding",
      headers: bearer(body.token),
      payload,
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().preferences.primaryLifeAreaIds).toEqual(
      first.json().preferences.primaryLifeAreaIds,
    );
    const areaRows = await fixture.db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, body.user.id));
    expect(areaRows).toHaveLength(2);
  });
});

describe("password reset flow", () => {
  it("resets a password, revokes sessions and invalidates the old token", async () => {
    const { body } = await register("reset_user", { email: "reset@example.com" });

    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: { identifier: "no_such_user_anywhere" },
    });
    expect(unknown.statusCode).toBe(202);
    expect(unknown.json().devToken).toBeUndefined();

    const requested = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: { identifier: "reset_user" },
    });
    expect(requested.statusCode).toBe(202);
    const resetToken = requested.json().devToken as string;
    expect(resetToken).toBeTruthy();

    const badToken = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: { token: `x${resetToken.slice(1)}`, password: "a different passphrase" },
    });
    expect(badToken.statusCode).toBe(400);

    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: { token: resetToken, password: "a different passphrase" },
    });
    expect(confirmed.statusCode).toBe(204);

    const oldSession = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(oldSession.statusCode).toBe(401);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "reset_user", password: PASSWORD },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "reset_user", password: "a different passphrase" },
    });
    expect(newLogin.statusCode).toBe(200);

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: { token: resetToken, password: "yet another passphrase" },
    });
    expect(replay.statusCode).toBe(400);
  });
});

describe("email verification flow", () => {
  it("verifies via the registration token", async () => {
    const { body } = await register("verify_user", { email: "verify@example.com" });
    expect(body.devEmailToken).toBeTruthy();

    const before = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(before.json().emailVerified).toBe(false);

    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email/confirm",
      payload: { token: body.devEmailToken },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().emailVerified).toBe(true);

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email/confirm",
      payload: { token: body.devEmailToken },
    });
    expect(replay.statusCode).toBe(400);
  });

  it("re-requests verification from an authenticated session", async () => {
    const { body } = await register("verify_again_user", {
      email: "verify-again@example.com",
    });
    const requested = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email/request",
      headers: bearer(body.token),
    });
    expect(requested.statusCode).toBe(202);
    const token = requested.json().devToken as string;
    expect(token).toBeTruthy();

    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email/confirm",
      payload: { token },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().emailVerified).toBe(true);
  });

  it("rejects a verification request when the account has no email", async () => {
    const { body } = await register("no_email_user");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email/request",
      headers: bearer(body.token),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_FAILED");
  });
});

describe("sessions management", () => {
  it("lists sessions, marks the current one and revokes others", async () => {
    const { body } = await register("session_a");
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "session_a", password: PASSWORD },
    });
    expect(second.statusCode).toBe(200);
    const secondToken = second.json().token as string;

    const currentRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: bearer(secondToken),
    });
    const currentSessionId = currentRes.json().session.id as string;

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/auth/sessions",
      headers: bearer(secondToken),
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().items as Array<{
      id: string;
      current: boolean;
      deviceName: string;
      platform: string;
      createdAt: string;
    }>;
    expect(items).toHaveLength(2);
    expect(items.filter((item) => item.current)).toHaveLength(1);
    expect(items.find((item) => item.current)?.id).toBe(currentSessionId);
    expect(items[0].deviceName).toBeTruthy();
    expect(items[0].platform).toBeTruthy();

    const foreign = await register("session_b");
    const foreignList = await app.inject({
      method: "GET",
      url: "/api/v1/auth/sessions",
      headers: bearer(foreign.body.token),
    });
    const foreignSessionId = (foreignList.json().items as Array<{ id: string }>)[0].id;
    const denied = await app.inject({
      method: "DELETE",
      url: `/api/v1/auth/sessions/${foreignSessionId}`,
      headers: bearer(secondToken),
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe("POLICY_DENIED");

    const other = (items.find((item) => !item.current) as { id: string }).id;
    const revoked = await app.inject({
      method: "DELETE",
      url: `/api/v1/auth/sessions/${other}`,
      headers: bearer(secondToken),
    });
    expect(revoked.statusCode).toBe(204);

    const dead = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(dead.statusCode).toBe(401);

    const stillAlive = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(secondToken),
    });
    expect(stillAlive.statusCode).toBe(200);
  });

  it("revokes every other session in bulk", async () => {
    const { body } = await register("session_bulk");
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "session_bulk", password: PASSWORD },
    });
    const secondToken = second.json().token as string;
    const third = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "session_bulk", password: PASSWORD },
    });
    const thirdToken = third.json().token as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sessions/revoke-others",
      headers: bearer(secondToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().revoked).toBe(2);

    for (const token of [body.token, thirdToken]) {
      const dead = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: bearer(token),
      });
      expect(dead.statusCode).toBe(401);
    }
    const alive = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(secondToken),
    });
    expect(alive.statusCode).toBe(200);
  });
});

describe("devices management", () => {
  it("lists devices with active session counts and revokes them", async () => {
    const { body } = await register("device_user");
    const mobile = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      },
      payload: { identifier: "device_user", password: PASSWORD },
    });
    expect(mobile.statusCode).toBe(200);
    const mobileToken = mobile.json().token as string;

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/auth/devices",
      headers: bearer(body.token),
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().items as Array<{
      id: string;
      name: string;
      platform: string;
      activeSessions: number;
      revokedAt: string | null;
    }>;
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.name && item.platform)).toBe(true);
    expect(items.reduce((sum, item) => sum + item.activeSessions, 0)).toBe(2);
    expect(items.some((item) => item.platform === "iOS")).toBe(true);

    const foreign = await register("device_x");
    const denied = await app.inject({
      method: "DELETE",
      url: `/api/v1/auth/devices/${items[0].id}`,
      headers: bearer(foreign.body.token),
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe("POLICY_DENIED");

    const target = items.find((item) => item.platform !== "iOS") ?? items[0];
    const revoked = await app.inject({
      method: "DELETE",
      url: `/api/v1/auth/devices/${target.id}`,
      headers: bearer(body.token),
    });
    expect(revoked.statusCode).toBe(204);

    const after = await app.inject({
      method: "GET",
      url: "/api/v1/auth/devices",
      headers: bearer(mobileToken),
    });
    const afterItems = after.json().items as Array<{
      id: string;
      revokedAt: string | null;
      activeSessions: number;
    }>;
    const revokedItem = afterItems.find((item) => item.id === target.id);
    expect(revokedItem?.revokedAt).toBeTruthy();
    expect(revokedItem?.activeSessions).toBe(0);

    const dead = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(dead.statusCode).toBe(401);

    const again = await app.inject({
      method: "DELETE",
      url: `/api/v1/auth/devices/${target.id}`,
      headers: bearer(mobileToken),
    });
    expect(again.statusCode).toBe(404);
  });
});

describe("POST /api/v1/auth/password", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/password" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("requires the current password and a strong new password", async () => {
    const { body } = await register("pwchange_guard");

    const wrongCurrent = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password",
      headers: bearer(body.token),
      payload: { currentPassword: "not the real one", password: "a brand new passphrase" },
    });
    expect(wrongCurrent.statusCode).toBe(400);
    expect(wrongCurrent.json().errors?.[0]?.field).toBe("currentPassword");

    const weak = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password",
      headers: bearer(body.token),
      payload: { currentPassword: PASSWORD, password: "short" },
    });
    expect(weak.statusCode).toBe(400);

    const stillWorks = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(stillWorks.statusCode).toBe(200);
  });

  it("changes the password, revokes other sessions, and writes an audit", async () => {
    const { body } = await register("pwchange_user");
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "pwchange_user", password: PASSWORD },
    });
    const secondToken = second.json().token as string;

    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password",
      headers: bearer(body.token),
      payload: { currentPassword: PASSWORD, password: "an entirely new secret" },
    });
    expect(changed.statusCode).toBe(204);

    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "pwchange_user", password: PASSWORD },
    });
    expect(oldPassword.statusCode).toBe(401);

    const newPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: "pwchange_user", password: "an entirely new secret" },
    });
    expect(newPassword.statusCode).toBe(200);

    const currentAlive = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(body.token),
    });
    expect(currentAlive.statusCode).toBe(200);

    const otherDead = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: bearer(secondToken),
    });
    expect(otherDead.statusCode).toBe(401);

    const audits = await fixture.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "auth.password_changed"));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorUserId).toBe(body.user.id);
  });
});
