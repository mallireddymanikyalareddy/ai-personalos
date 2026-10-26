import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PROVIDER_BY_ID, buildVaultRef } from "@personalos/core";
import type { FetchLike } from "../auth/oauth";
import {
  authorizeUrlFor,
  exchangeCode,
  refreshRequestBodyFor,
  toVaultEntry,
  tokenRequestBodyFor,
} from "./adapters";
import { PendingConnectionStore } from "./pending";
import { EncryptedTokenVault } from "./vault";

const KEY = Buffer.alloc(32, 7).toString("base64");

function vaultEntry() {
  return {
    accessToken: "access-token-value",
    refreshToken: "refresh-token-value",
    expiresAt: Date.now() + 3_600_000,
    scope: "https://www.googleapis.com/auth/calendar.events",
    tokenType: "Bearer",
    externalAccountId: null,
  };
}

describe("integration vault", () => {
  it("stores tokens encrypted, never in plaintext", () => {
    const vault = new EncryptedTokenVault({ key: KEY });
    vault.put("vault/user/google_calendar/nonce", vaultEntry());

    expect(vault.get("vault/user/google_calendar/nonce")!.accessToken).toBe("access-token-value");
    expect(vault.list()).toEqual(["vault/user/google_calendar/nonce"]);
  });

  it("produces different ciphertexts for identical payloads", () => {
    const vault = new EncryptedTokenVault({ key: KEY });
    vault.put("ref", vaultEntry());
    const first = vault.serialize("ref");
    vault.put("ref2", vaultEntry());
    const second = vault.serialize("ref2");
    expect(first).not.toBe(second);
    expect(first).not.toContain("access-token-value");
    expect(second).not.toContain("access-token-value");
  });

  it("drops records that cannot be decrypted", () => {
    const vault = new EncryptedTokenVault({ key: KEY });
    vault.put("ref", vaultEntry());
    vault.load("ref", "v1.not-a-real-record");
    expect(vault.get("ref")).toBeNull();
    expect(vault.list()).toEqual([]);
  });

  it("deletes and re-keyes without losing data", () => {
    const vault = new EncryptedTokenVault({ key: KEY });
    vault.put("a", vaultEntry());
    vault.put("b", vaultEntry());
    vault.delete("a");
    expect(vault.list()).toEqual(["b"]);

    const rotated = new EncryptedTokenVault({ key: Buffer.alloc(32, 9).toString("base64") });
    rotated.rotate();
    expect(rotated.list()).toEqual([]);
  });

  it("rebuilds entries after a rotate on the same key", () => {
    const vault = new EncryptedTokenVault({ key: KEY });
    vault.put("a", vaultEntry());
    vault.rotate();
    expect(vault.get("a")!.accessToken).toBe("access-token-value");
  });

  it("accepts any 32 byte key", () => {
    const vault = new EncryptedTokenVault({ key: "short" });
    vault.put("a", vaultEntry());
    expect(vault.get("a")!.accessToken).toBe("access-token-value");
  });
});

describe("integration oauth requests", () => {
  it("substitutes the real client id into the authorize URL", () => {
    const provider = PROVIDER_BY_ID.google_calendar!;
    const verifier = "verifier-value";
    const url = new URL(
      authorizeUrlFor({
        providerId: provider.id,
        clientId: "real-client-id",
        redirectUri: "https://app.example.com/api/v1/integrations/oauth/google_calendar/callback",
        state: "state-value",
        codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
        codeVerifier: verifier,
      }),
    );

    expect(url.searchParams.get("client_id")).toBe("real-client-id");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.toString()).not.toContain("CLIENT_ID");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("refuses providers it cannot authorise", () => {
    expect(() =>
      authorizeUrlFor({
        providerId: "notion",
        clientId: "id",
        redirectUri: "https://app.example.com/callback",
        state: "s",
        codeChallenge: "c",
        codeVerifier: "v",
      }),
    ).toThrow(/no OAuth configuration/);
  });

  it("posts the PKCE exchange body", () => {
    const body = new URLSearchParams(
      tokenRequestBodyFor({
        clientId: "client",
        clientSecret: "secret",
        code: "auth-code",
        codeVerifier: "verifier",
        redirectUri: "https://app.example.com/callback",
      }),
    );
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("client_id")).toBe("client");
  });

  it("posts a refresh body without an auth code", () => {
    const body = new URLSearchParams(
      refreshRequestBodyFor({
        clientId: "client",
        clientSecret: "secret",
        refreshToken: "refresh-value",
      }),
    );
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-value");
    expect(body.get("code_verifier")).toBeNull();
  });

  it("exchanges an authorization code through the transport", async () => {
    let seenUrl = "";
    let seenBody = "";
    const fetchFn: FetchLike = async (input, init) => {
      seenUrl = String(input);
      seenBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
          scope: "cal.events",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const tokens = await exchangeCode(
      "google_calendar",
      fetchFn,
      {
        body: tokenRequestBodyFor({
          clientId: "client",
          clientSecret: "secret",
          code: "auth-code",
          codeVerifier: "verifier",
          redirectUri: "https://app.example.com/callback",
        }),
      },
      1_000_000,
    );

    expect(seenUrl).toBe(PROVIDER_BY_ID.google_calendar!.oauth!.tokenUrl);
    expect(seenBody).toContain("grant_type=authorization_code");
    expect(tokens.accessToken).toBe("new-access");
    expect(tokens.expiresAt).toBe(1_000_000 + 3_600_000);
    expect(toVaultEntry(tokens, "ext-1").externalAccountId).toBe("ext-1");
  });

  it("surfaces a provider error instead of a partial token", async () => {
    const fetchFn: FetchLike = async () => new Response("nope", { status: 400 });
    await expect(
      exchangeCode("google_calendar", fetchFn, { body: "code=auth-code" }, 1000),
    ).rejects.toThrow(/status 400/);
  });

  it("refuses to store a response without an access token", async () => {
    const fetchFn: FetchLike = async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 200 });
    await expect(exchangeCode("google_calendar", fetchFn, { body: "code=x" }, 1000)).rejects.toThrow(
      /access_token/,
    );
  });
});

describe("integration pending connections", () => {
  const nonce = randomBytes(9).toString("base64url");

  it("round-trips a pending connection", () => {
    const store = new PendingConnectionStore();
    const state = store.create({
      providerId: "google_calendar",
      userId: "user-1",
      codeVerifier: "verifier",
      codeChallenge: "challenge",
      redirectUri: "https://app.example.com/callback",
      returnTo: "/integrations",
    });

    expect(store.size()).toBe(1);
    const consumed = store.consume(state);
    expect(consumed?.providerId).toBe("google_calendar");
    expect(consumed?.userId).toBe("user-1");
    expect(store.consume(state)).toBeNull();
  });

  it("expires stale connections", () => {
    const store = new PendingConnectionStore();
    const state = store.create(
      {
        providerId: "google_calendar",
        userId: "user-1",
        codeVerifier: "verifier",
        codeChallenge: "challenge",
        redirectUri: "https://app.example.com/callback",
        returnTo: "/integrations",
      },
      1_000,
    );
    expect(store.consume(state, 1_000 + 11 * 60_000)).toBeNull();
  });

  it("keeps connection refs provider scoped and opaque", () => {
    const first = buildVaultRef("google_calendar", "user-1", nonce);
    const second = buildVaultRef("outlook_calendar", "user-1", nonce);
    expect(first).not.toBe(second);
    expect(first).not.toContain("access");
    expect(first.startsWith("vault/user-1/google_calendar/")).toBe(true);
  });
});
