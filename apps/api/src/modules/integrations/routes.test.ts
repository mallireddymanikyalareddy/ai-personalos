import { describe, expect, it } from "vitest";

import { buildApp } from "../../app";
import { loadConfig } from "../../config";
import type { FetchLike } from "../auth/oauth";
import { EncryptedTokenVault } from "./vault";

const BASE = "http://localhost:3000";
const DEV_EMAIL = "dev@personalos.local";
const DEV_PASSWORD = "DevPassword123!";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function buildTestApp(options: { google?: boolean; onRequest?: (url: string, init?: RequestInit) => void }) {
  const config = loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    APP_URL: BASE,
    GOOGLE_CLIENT_ID: options.google === false ? "" : "google-client-id",
    GOOGLE_CLIENT_SECRET: options.google === false ? "" : "google-secret",
  });

  const fetchFn: FetchLike = async (input, init) => {
    const url = String(input);
    options.onRequest?.(url, init);
    if (url.includes("/token")) {
      return jsonResponse({
        access_token: "issued-access-token",
        refresh_token: "issued-refresh-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/calendar.events",
        token_type: "Bearer",
      });
    }
    if (url.includes("googleapis.com/calendar")) {
      return jsonResponse({
        items: [{ id: "ext-1", summary: "Dentist", start: { dateTime: "2026-10-16T09:00:00Z" }, end: { dateTime: "2026-10-16T10:00:00Z" } }],
      });
    }
    if (url.includes("googleapis.com/drive")) {
      return jsonResponse({ files: [{ id: "f1", name: "Plan.pdf", mimeType: "application/pdf", size: 512 }] });
    }
    return jsonResponse({}, 404);
  };

  const vault = new EncryptedTokenVault({ key: Buffer.alloc(32, 3).toString("base64") });
  const app = await buildApp({ config, integrationFetch: fetchFn, tokenVault: vault });
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { identifier: DEV_EMAIL, password: DEV_PASSWORD },
  });
  if (login.statusCode !== 200) {
    throw new Error(`dev login failed: ${login.statusCode} ${login.body}`);
  }
  const token = login.json().token as string;
  return { app, fetchFn, vault, token };
}


describe("integration routes", () => {
  it("publishes the provider catalog with live and preparing states", async () => {
    const { app } = await buildTestApp({});
    const response = await app.inject({ method: "GET", url: "/api/v1/integrations/catalog" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const byId = new Map(body.items.map((item: { id: string }) => [item.id, item] as const));
    expect(byId.has("google_calendar")).toBe(true);
    expect((byId.get("google_calendar") as { status: string }).status).toBe("live");
    expect((byId.get("notion") as { status: string }).status).toBe("preparing");
    expect((byId.get("notion") as { connectUrl: string }).connectUrl).toContain("/api/v1/integrations/notion/begin");
    await app.close();
  });

  it("requires a session to begin a connection", async () => {
    const { app } = await buildTestApp({});
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google_calendar/begin",
      payload: { returnTo: "/integrations" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("begins a connection, exchanges the code, and hands back a vault ref", async () => {
    const seen: string[] = [];
    const { app, token } = await buildTestApp({ onRequest: (url) => seen.push(url) });

    const begin = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google_calendar/begin",
      headers: { authorization: `Bearer ${token}` },
      payload: { returnTo: "/integrations" },
    });
    expect(begin.statusCode).toBe(200);
    const { authorizeUrl, state } = begin.json();
    expect(authorizeUrl).toContain("accounts.google.com");
    expect(authorizeUrl).toContain("client_id=google-client-id");
    expect(authorizeUrl).not.toContain("CLIENT_ID=");
    expect(authorizeUrl).toContain(`state=${state}`);
    expect(String(new URL(authorizeUrl).searchParams.get("redirect_uri"))).toContain(
      "/api/v1/integrations/oauth/google_calendar/callback",
    );

    const callback = await app.inject({
      method: "GET",
      url: `/api/v1/integrations/oauth/google_calendar/callback?code=the-code&state=${state}`,
    });
    expect(callback.statusCode).toBe(302);
    const location = String(callback.headers.location);
    expect(location.startsWith("/integrations?")).toBe(true);
    const params = new URLSearchParams(location.slice(location.indexOf("?") + 1));
    expect(params.get("connection")).toBe("connected");
    expect(params.get("provider")).toBe("google_calendar");
    const ref = params.get("ref");
    expect(ref).toBeTruthy();
    expect(ref!.startsWith("vault/")).toBe(true);

    const pull = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/pull",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { providerId: "google_calendar", credentialRef: ref },
    });
    expect(pull.statusCode).toBe(200);
    const pulled = pull.json();
    expect(pulled.items).toHaveLength(1);
    expect(pulled.items[0].payload.title).toBe("Dentist");
    expect(seen.some((url) => url.includes("accounts.google.com"))).toBe(false);
    await app.close();
  });

  it("rejects a callback with a mismatched state", async () => {
    const { app } = await buildTestApp({});
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/oauth/google_calendar/callback?code=x&state=bogus",
    });
    expect(response.statusCode).toBe(302);
    expect(String(response.headers.location)).toBe("/integrations?connection=failed");
    await app.close();
  });

  it("refuses to connect a provider that is still preparing", async () => {
    const { app, token } = await buildTestApp({});
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/notion/begin",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(response.statusCode).toBe(501);
    await app.close();
  });

  it("reports a provider that is not configured on the server", async () => {
    const { app, token } = await buildTestApp({ google: false });
    const status = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/google_calendar/status",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(status.json().connectable).toBe(false);

    const begin = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google_calendar/begin",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(begin.statusCode).toBe(503);
    await app.close();
  });

  it("pulls Drive files for the files provider", async () => {
    const { app, token } = await buildTestApp({});
    const begin = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google_drive/begin",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const { state } = begin.json();
    const callback = await app.inject({
      method: "GET",
      url: `/api/v1/integrations/oauth/google_drive/callback?code=x&state=${state}`,
    });
    const location = String(callback.headers.location);
    const params = new URLSearchParams(location.slice(location.indexOf("?") + 1));
    const ref = params.get("ref")!;

    const pull = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/pull",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { providerId: "google_drive", credentialRef: ref },
    });
    expect(pull.statusCode).toBe(200);
    expect(pull.json().items[0].payload.title).toBe("Plan.pdf");
    await app.close();
  });

  it("refuses to pull when the credential was never stored", async () => {
    const { app, token } = await buildTestApp({});
    const pull = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/pull",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { providerId: "google_calendar", credentialRef: "vault/unknown" },
    });
    expect(pull.statusCode).toBe(409);
    await app.close();
  });

  it("revokes and forgets the credential on disconnect", async () => {
    const seen: Array<{ url: string; body?: string | null }> = [];
      const { app, token } = await buildTestApp({
      onRequest: (url, init) => seen.push({ url, body: String(init?.body ?? "") }),
    });
    const begin = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google_calendar/begin",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const { state } = begin.json();
    const callback = await app.inject({
      method: "GET",
      url: `/api/v1/integrations/oauth/google_calendar/callback?code=x&state=${state}`,
    });
    const location = String(callback.headers.location);
    const params = new URLSearchParams(location.slice(location.indexOf("?") + 1));
    const ref = params.get("ref")!;

    const disconnect = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/disconnect",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { providerId: "google_calendar", credentialRef: ref },
    });
    expect(disconnect.statusCode).toBe(200);
    expect(seen.some((entry) => entry.url.includes("/revoke"))).toBe(true);

    const after = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/pull",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { providerId: "google_calendar", credentialRef: ref },
    });
    expect(after.statusCode).toBe(409);
    await app.close();
  });
});
