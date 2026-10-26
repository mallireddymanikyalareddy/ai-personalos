import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp, type ReadinessCheck } from "./app";
import { loadConfig } from "./config";
import { SESSION_COOKIE_NAME } from "./modules/auth/tokens";

const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ config, logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("health and readiness", () => {
  it("GET /healthz returns ok with a request id", async () => {
    const response = await app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("GET /readyz reports passing checks", async () => {
    const checks: ReadinessCheck[] = [{ name: "clock", run: () => undefined }];
    const readyApp = await buildApp({ config, logger: false, checks });
    const response = await readyApp.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ready",
      checks: [{ name: "clock", ok: true }],
    });
    await readyApp.close();
  });

  it("GET /readyz fails with 503 problem+json when a check throws", async () => {
    const checks: ReadinessCheck[] = [
      { name: "database", run: () => { throw new Error("connection refused"); } },
    ];
    const readyApp = await buildApp({ config, logger: false, checks });
    const response = await readyApp.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(503);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const problem = response.json();
    expect(problem.code).toBe("SERVICE_UNAVAILABLE");
    expect(problem.detail).toContain("database");
    expect(problem.detail).not.toContain("connection refused");
    await readyApp.close();
  });
});

describe("system info", () => {
  it("GET /api/v1/system/info returns service metadata", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/system/info" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe("personalos-api");
    expect(body.env).toBe("test");
    expect(body.version).toBe("0.1.0");
    expect(body.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.uptimeSec).toBeUndefined();
  });

  it("supports verbose mode", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/system/info?verbose=true",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().uptimeSec).toBeTypeOf("number");
  });

  it("rejects invalid query with 422 problem+json and field errors", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/system/info?verbose=maybe",
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const problem = response.json();
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.status).toBe(400);
    expect(problem.errors).toEqual([
      { field: "verbose", issue: expect.any(String) as unknown as string },
    ]);
    expect(problem.requestId).toBe(response.headers["x-request-id"]);
  });
});

describe("error handling", () => {
  it("returns RFC 9457 problem+json for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/nope" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const problem = response.json();
    expect(problem.code).toBe("NOT_FOUND");
    expect(problem.type).toBe("https://api.personalos.dev/problems/not-found");
    expect(problem.title).toBe("Not found");
    expect(problem.instance).toBe("/api/v1/nope");
    expect(problem.requestId).toBe(response.headers["x-request-id"]);
  });

  it("echoes a valid incoming request id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { "x-request-id": "req-test.123" },
    });
    expect(response.headers["x-request-id"]).toBe("req-test.123");
  });

  it("replaces malformed request ids", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { "x-request-id": "bad id with spaces!" },
    });
    expect(response.headers["x-request-id"]).not.toBe("bad id with spaces!");
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("dev mode auth", () => {
  it("logs in with default credentials and serves the profile via account routes", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "dev@personalos.local",
        password: "DevPassword123!",
      },
    });
    expect(login.statusCode).toBe(200);
    const sessionCookie = login.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    expect(sessionCookie?.value).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie?.value}` },
    });
    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.handle).toBe("dev");
    expect(body.email).toBe("dev@personalos.local");
    expect(body.onboardingCompleted).toBe(false);
  });

  it("patches the profile and completes onboarding in dev mode", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "dev@personalos.local",
        password: "DevPassword123!",
      },
    });
    const sessionCookie = login.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    const headers = { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie?.value}` };

    const patched = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      headers,
      payload: { displayName: "Dev Patched" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().displayName).toBe("Dev Patched");

    const onboarding = await app.inject({
      method: "GET",
      url: "/api/v1/users/me/onboarding",
      headers,
    });
    expect(onboarding.statusCode).toBe(200);
    expect(onboarding.json().lifeAreaCatalog.length).toBeGreaterThan(0);

    const completed = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/onboarding",
      headers,
      payload: { timezone: "UTC", locale: "en", lifeAreaNames: ["Work"] },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().onboardingCompleted).toBe(true);
  });
});

describe("metrics", () => {
  it("GET /metrics exposes prefixed prometheus metrics", async () => {
    await app.inject({ method: "GET", url: "/healthz" });
    const response = await app.inject({ method: "GET", url: "/metrics" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("personalos_http_request_duration_seconds");
    expect(response.body).toContain("personalos_process_");
  });
});
