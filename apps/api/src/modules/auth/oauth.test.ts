import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app";
import { loadConfig } from "../../config";
import { auditLog, oauthConnections, users } from "../../db/schema";
import { createTestDb, type TestDb } from "../../db/testing";
import type { FetchLike } from "./oauth";

const APP_URL = "http://localhost:3000";
const PASSWORD = "correct horse battery staple";
const config = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  APP_URL,
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  APPLE_CLIENT_ID: "apple-client-id",
  APPLE_CLIENT_SECRET: "apple-secret",
});

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

let fetchHandler: FetchHandler = async (url) => {
  throw new Error(`unexpected outbound fetch: ${url}`);
};

const oauthFetch = ((input: string | URL | Request, init?: RequestInit) =>
  fetchHandler(String(input), init)) as FetchLike;

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function googleFetch(claims: Record<string, unknown>): FetchHandler {
  return async (url) => {
    if (url.includes("oauth2.googleapis.com/token")) {
      return json({ access_token: "google-access-token", token_type: "Bearer" });
    }
    if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return json(claims);
    }
    throw new Error(`unexpected outbound fetch: ${url}`);
  };
}

const { publicKey: applePublicKey, privateKey: applePrivateKey } =
  generateKeyPairSync("rsa", { modulusLength: 2048 });
const { privateKey: evilPrivateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const appleJwk = {
  ...(applePublicKey.export({ format: "jwk" }) as Record<string, unknown>),
  kid: "apple-key-1",
  alg: "RS256",
  use: "sig",
};

function appleIdToken(claims: Record<string, unknown>, key: KeyObject): string {
  const header = { alg: "RS256", kid: "apple-key-1" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    key,
  ).toString("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const appleClaims = {
  iss: "https://appleid.apple.com",
  aud: "apple-client-id",
  sub: "apple-sub-1",
  email: "steve@example.com",
  email_verified: true,
  exp: Math.floor(Date.now() / 1000) + 600,
};

interface Started {
  state: string;
  location: string;
}

async function start(
  provider: string,
  options: { query?: string; headers?: Record<string, string> } = {},
): Promise<Started> {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/auth/oauth/${provider}/start${options.query ?? ""}`,
    headers: options.headers,
  });
  expect(res.statusCode).toBe(302);
  const location = String(res.headers.location);
  const state = new URL(location).searchParams.get("state") ?? "";
  expect(state).not.toBe("");
  const setCookie = res.headers["set-cookie"];
  const cookieText = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
  expect(cookieText).toContain("pos_oauth=");
  expect(cookieText).toContain("HttpOnly");
  expect(cookieText).toContain("SameSite=Lax");
  return { state, location };
}

async function callback(
  provider: string,
  params: Record<string, string>,
  cookie?: string,
) {
  const search = new URLSearchParams(params).toString();
  return app.inject({
    method: "GET",
    url: `/api/v1/auth/oauth/${provider}/callback?${search}`,
    headers: cookie ? { cookie } : {},
  });
}

function sessionCookieFrom(res: Awaited<ReturnType<typeof app.inject>>): string {
  const cookie = res.cookies.find((entry) => entry.name === "pos_session");
  expect(cookie).toBeTruthy();
  return `pos_session=${cookie?.value}`;
}

let fixture: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  fixture = await createTestDb();
  app = await buildApp({ config, logger: false, db: fixture.db, oauthFetch });
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app.close();
  await fixture.client.close();
});

describe("GET /api/v1/auth/oauth/providers", () => {
  it("reports enabled state per provider", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/oauth/providers",
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ id: string; enabled: boolean }>;
    expect(items).toHaveLength(3);
    expect(items.find((item) => item.id === "google")?.enabled).toBe(true);
    expect(items.find((item) => item.id === "apple")?.enabled).toBe(true);
    expect(items.find((item) => item.id === "microsoft")?.enabled).toBe(false);
  });
});

describe("oauth start", () => {
  it("returns 404 for unknown providers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/oauth/github/start",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("returns 404 for disabled providers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/oauth/microsoft/start",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });

  it("redirects to the provider with PKCE and an http-only state cookie", async () => {
    const { location } = await start("google");
    const url = new URL(location);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toContain(
      "/api/v1/auth/oauth/google/callback",
    );
    expect(url.searchParams.get("scope")).toContain("email");
    expect(location).not.toContain("google-secret");
  });
});

describe("oauth callback failures", () => {
  it("redirects to the app login page when the state cookie is missing", async () => {
    const res = await callback("google", { code: "abc", state: "some-state" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/login?error=oauth_failed`);
  });

  it("redirects when the state cookie does not match the query state", async () => {
    const res = await callback(
      "google",
      { code: "abc", state: "query-state" },
      "pos_oauth=other-state",
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/login?error=oauth_failed`);
  });

  it("redirects when the state was never issued", async () => {
    const res = await callback(
      "google",
      { code: "abc", state: "forged-state" },
      "pos_oauth=forged-state",
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/login?error=oauth_failed`);
  });

  it("redirects when the authorization code is missing", async () => {
    const { state } = await start("google");
    const res = await callback("google", { state }, `pos_oauth=${state}`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/login?error=oauth_failed`);
  });

  it("rejects a reused state", async () => {
    const { state } = await start("google");
    fetchHandler = googleFetch({
      sub: "g-reuse",
      email: "reuse@example.com",
      email_verified: true,
    });
    const first = await callback(
      "google",
      { code: "code-1", state },
      `pos_oauth=${state}`,
    );
    expect(first.statusCode).toBe(302);
    expect(first.headers.location).toBe(`${APP_URL}/onboarding?auth=1`);

    const second = await callback(
      "google",
      { code: "code-2", state },
      `pos_oauth=${state}`,
    );
    expect(second.statusCode).toBe(302);
    expect(second.headers.location).toBe(`${APP_URL}/login?error=oauth_failed`);
  });
});

describe("google sign-in", () => {
  it("creates a new account from provider identity", async () => {
    fetchHandler = googleFetch({
      sub: "g-grace",
      email: "grace.hopper@example.com",
      email_verified: true,
      name: "Grace Hopper",
      picture: "https://example.com/grace.png",
    });
    const { state } = await start("google", { query: "?redirect=/tasks" });
    const res = await callback(
      "google",
      { code: "code-grace", state },
      `pos_oauth=${state}`,
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/onboarding?auth=1`);

    const cookie = sessionCookieFrom(res);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().handle).toBe("gracehopper");
    expect(me.json().email).toBe("grace.hopper@example.com");
    expect(me.json().emailVerified).toBe(true);
    expect(me.json().avatarUrl).toBe("https://example.com/grace.png");

    const connection = await fixture.db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.providerSubject, "g-grace"),
    });
    expect(connection).toBeTruthy();
    expect(connection?.provider).toBe("google");

    const audits = await fixture.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "oauth.register"));
    expect(
      audits.some((row) => row.metadata?.provider === "google"),
    ).toBe(true);
  });

  it("links a verified provider email to the existing account", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        handle: "oauth_match_user",
        displayName: "Match",
        email: "ada@example.com",
        password: PASSWORD,
      },
    });
    expect(registerRes.statusCode).toBe(201);
    const registered = registerRes.json();
    const userCountBefore = await fixture.db
      .select()
      .from(users)
      .where(eq(users.email, "ada@example.com"));

    fetchHandler = googleFetch({
      sub: "g-ada",
      email: "ada@example.com",
      email_verified: true,
    });
    const { state } = await start("google");
    const res = await callback(
      "google",
      { code: "code-ada", state },
      `pos_oauth=${state}`,
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/onboarding?auth=1`);

    const cookie = sessionCookieFrom(res);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(registered.user.id);

    const userCountAfter = await fixture.db
      .select()
      .from(users)
      .where(eq(users.email, "ada@example.com"));
    expect(userCountAfter).toHaveLength(userCountBefore.length);

    const connection = await fixture.db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.providerSubject, "g-ada"),
    });
    expect(connection?.userId).toBe(registered.user.id);
  });

  it("links the provider to the signed-in user without creating an account", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        handle: "oauth_linker",
        displayName: "Linker",
        password: PASSWORD,
      },
    });
    expect(registerRes.statusCode).toBe(201);
    const registered = registerRes.json();
    const headers = { authorization: `Bearer ${registered.token}` };

    fetchHandler = googleFetch({
      sub: "g-linker",
      email: "linker-elsewhere@example.com",
      email_verified: true,
    });
    const { state } = await start("google", {
      query: "?redirect=/settings",
      headers,
    });
    const res = await callback(
      "google",
      { code: "code-linker", state },
      `pos_oauth=${state}`,
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/settings?linked=1`);
    expect(
      res.cookies.some((entry) => entry.name === "pos_session"),
    ).toBe(false);

    const connection = await fixture.db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.providerSubject, "g-linker"),
    });
    expect(connection?.userId).toBe(registered.user.id);

    const created = await fixture.db
      .select()
      .from(users)
      .where(eq(users.email, "linker-elsewhere@example.com"));
    expect(created).toHaveLength(0);
  });
});

describe("apple sign-in", () => {
  it("verifies the id_token against the provider JWKS", async () => {
    fetchHandler = async (url) => {
      if (url.includes("appleid.apple.com/auth/token")) {
        return json({ id_token: appleIdToken(appleClaims, applePrivateKey) });
      }
      if (url.includes("appleid.apple.com/auth/jwks")) {
        return json({ keys: [appleJwk] });
      }
      throw new Error(`unexpected outbound fetch: ${url}`);
    };

    const { state, location } = await start("apple");
    expect(new URL(location).searchParams.get("response_mode")).toBe("query");
    expect(new URL(location).searchParams.get("nonce")).toBeTruthy();

    const res = await callback(
      "apple",
      { code: "apple-code", state },
      `pos_oauth=${state}`,
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/onboarding?auth=1`);

    const cookie = sessionCookieFrom(res);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("steve@example.com");

    const connection = await fixture.db.query.oauthConnections.findFirst({
      where: eq(oauthConnections.providerSubject, "apple-sub-1"),
    });
    expect(connection?.provider).toBe("apple");
  });

  it("rejects an id_token signed by the wrong key", async () => {
    fetchHandler = async (url) => {
      if (url.includes("appleid.apple.com/auth/token")) {
        return json({ id_token: appleIdToken(appleClaims, evilPrivateKey) });
      }
      throw new Error(`unexpected outbound fetch: ${url}`);
    };

    const { state } = await start("apple");
    const res = await callback(
      "apple",
      { code: "apple-code-bad", state },
      `pos_oauth=${state}`,
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${APP_URL}/login?error=oauth_failed`);

    const created = await fixture.db
      .select()
      .from(users)
      .where(eq(users.email, "steve@example.com"));
    const connections = await fixture.db
      .select()
      .from(oauthConnections)
      .where(eq(oauthConnections.providerSubject, "apple-sub-1"));
    expect(created).toHaveLength(1);
    expect(connections).toHaveLength(1);
  });
});
