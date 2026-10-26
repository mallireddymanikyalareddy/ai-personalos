import { createHash, randomBytes } from "node:crypto";

import { AppError, type ErrorCode } from "@personalos/api-contract";
import {
  INTEGRATION_PROVIDERS,
  PROVIDER_BY_ID,
  buildVaultRef,
  parseTokenResponse,
  type IntegrationKind,
  type ProviderDefinition,
} from "@personalos/core";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import type { Config } from "../../config";
import type { FetchLike } from "../auth/oauth";
import { createRateLimiter } from "../auth/rate-limit";
import {
  authorizeUrlFor,
  calendarPullUrl,
  cleanString,
  drivePullUrl,
  exchangeCode,
  parseProviderPayload,
  pullWindow,
  refreshRequestBodyFor,
  toVaultEntry,
  tokenRequestBodyFor,
  type IntegrationProviderId,
} from "./adapters";
import { PendingConnectionStore } from "./pending";
import { EncryptedTokenVault } from "./vault";

export interface IntegrationRoutesDeps {
  config: Config;
  vault?: EncryptedTokenVault;
  fetchFn?: FetchLike;
}

const PROVIDER_ENV_CLIENT: Record<IntegrationProviderId, { clientId: keyof Config; clientSecret: keyof Config }> = {
  google_calendar: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
  outlook_calendar: { clientId: "MICROSOFT_CLIENT_ID", clientSecret: "MICROSOFT_CLIENT_SECRET" },
  google_drive: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
};

const INTEGRATIONS_PATH = "/integrations";

function clientFor(config: Config, providerId: string): { clientId: string; clientSecret: string } | null {
  const keys = PROVIDER_ENV_CLIENT[providerId as IntegrationProviderId];
  if (!keys) return null;
  const clientId = String(config[keys.clientId] ?? "");
  const clientSecret = String(config[keys.clientSecret] ?? "");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const fail: (code: ErrorCode, detail: string) => never = (code, detail) => {
  throw new AppError(code, { detail });
};

function requireUserId(request: FastifyRequest): string {
  const auth = request.auth;
  if (!auth) fail("AUTH_REQUIRED", "Authentication required.");
  return auth.user.id;
}

function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== "string") return INTEGRATIONS_PATH;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return INTEGRATIONS_PATH;
  }
  return value;
}

function toCatalogEntry(provider: ProviderDefinition, basePath: string) {
  return {
    id: provider.id,
    kind: provider.kind as IntegrationKind,
    label: provider.label,
    detail: provider.detail,
    authType: provider.authType,
    status: provider.status,
    scopes: provider.scopes,
    connectUrl: `${basePath}/api/v1/integrations/${provider.id}/begin`,
    docsUrl: provider.docsUrl ?? null,
    capabilities: provider.capabilities.map((capability) => ({
      id: capability.id,
      label: capability.label,
      detail: capability.detail,
      supported: capability.supported,
    })),
  };
}

export const integrationRoutes: FastifyPluginAsync<IntegrationRoutesDeps> = async (app, deps) => {
  const { config } = deps;
  const fetchFn: FetchLike = deps.fetchFn ?? ((input, init) => fetch(input, init));
  const vault = deps.vault ?? new EncryptedTokenVault({ key: randomBytes(32).toString("base64") });
  const pending = new PendingConnectionStore();
  const beginLimiter = createRateLimiter({ max: 30, windowMs: 15 * 60_000 });
  const pullLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });
  const connectLimiter = createRateLimiter({ max: 30, windowMs: 15 * 60_000 });

  app.get("/api/v1/integrations/catalog", async (request) => {
    const base = `${request.protocol}://${request.host}`;
    return { items: INTEGRATION_PROVIDERS.map((provider) => toCatalogEntry(provider, base)) };
  });

  app.get<{ Params: { provider: string } }>(
    "/api/v1/integrations/:provider/status",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      requireUserId(request);
      const provider = PROVIDER_BY_ID[request.params.provider];
      if (!provider) fail("NOT_FOUND", "Unknown provider.");
      const credentials = clientFor(config, provider.id);
      return {
        providerId: provider.id,
        status: provider.status,
        configured: credentials != null,
        connectable: provider.status === "live" && credentials != null,
      };
    },
  );

  function redirectHome(reply: FastifyReply, params: Record<string, string>): void {
    const path = sanitizeReturnTo(params.returnTo);
    const search = new URLSearchParams(params);
    search.delete("returnTo");
    const query = search.toString();
    reply.redirect(query ? `${path}?${query}` : path, 302);
  }

  app.post<{ Params: { provider: string }; Body: { returnTo?: string } }>(
    "/api/v1/integrations/:provider/begin",
    { preHandler: (request) => app.authenticate(request) },
    async (request, reply) => {
      const userId = requireUserId(request);
      const provider = PROVIDER_BY_ID[request.params.provider];
      if (!provider) fail("NOT_FOUND", "Unknown provider.");
      if (provider.status !== "live") {
        fail("INTEGRATION_PROVIDER_UNAVAILABLE", `${provider.label} is still preparing for connections.`);
      }
      const credentials = clientFor(config, provider.id);
      if (!credentials) {
        fail("INTEGRATION_PROVIDER_NOT_CONFIGURED", `${provider.label} is not configured on this server.`);
      }
      beginLimiter.check(`integration-begin:${request.ip}:${userId}`);

      const verifier = randomBytes(48).toString("base64url");
      const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
      const redirectUri = `${request.protocol}://${request.host}/api/v1/integrations/oauth/${provider.id}/callback`;
      const state = pending.create({
        providerId: provider.id,
        userId,
        codeVerifier: verifier,
        codeChallenge,
        redirectUri,
        returnTo: sanitizeReturnTo(request.body?.returnTo),
      });

      reply.header("cache-control", "no-store");
      return {
        authorizeUrl: authorizeUrlFor({
          providerId: provider.id,
          clientId: credentials.clientId,
          redirectUri,
          state,
          codeChallenge,
          codeVerifier: verifier,
        }),
        state,
      };
    },
  );

  async function handleCallback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const providerId = (request.params as { provider: string }).provider;
    const provider = PROVIDER_BY_ID[providerId];
    if (!provider || provider.status !== "live") {
      redirectHome(reply, { connection: "failed" });
      return;
    }
    const query = (request.query ?? {}) as Record<string, unknown>;
    const state = cleanString(query.state);
    if (!state) {
      redirectHome(reply, { connection: "failed" });
      return;
    }
    const entry = pending.consume(state);
    if (!entry || entry.providerId !== provider.id) {
      redirectHome(reply, { connection: "failed" });
      return;
    }
    const code = cleanString(query.code);
    if (!code) {
      redirectHome(reply, { returnTo: entry.returnTo, connection: "failed" });
      return;
    }
    const credentials = clientFor(config, provider.id);
    if (!credentials) {
      redirectHome(reply, { returnTo: entry.returnTo, connection: "failed" });
      return;
    }

    try {
      const tokens = await exchangeCode(
        provider.id,
        fetchFn,
        {
          body: tokenRequestBodyFor({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            code,
            codeVerifier: entry.codeVerifier,
            redirectUri: entry.redirectUri,
          }),
        },
      );
      const ref = buildVaultRef(provider.id, entry.userId, randomBytes(9).toString("base64url"));
      vault.put(ref, toVaultEntry(tokens, null));
      redirectHome(reply, {
        returnTo: entry.returnTo,
        connection: "connected",
        provider: provider.id,
        ref,
      });
    } catch {
      redirectHome(reply, { returnTo: entry.returnTo, connection: "failed" });
    }
  }

  app.get<{ Params: { provider: string } }>(
    "/api/v1/integrations/oauth/:provider/callback",
    async (request, reply) => {
      await handleCallback(request, reply);
    },
  );

  app.post<{ Params: { provider: string } }>(
    "/api/v1/integrations/oauth/:provider/callback",
    async (request, reply) => {
      await handleCallback(request, reply);
    },
  );

  app.post<{
    Body: { providerId: string; credentialRef: string; importRangeDays?: number };
  }>(
    "/api/v1/integrations/pull",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const userId = requireUserId(request);
      pullLimiter.check(`integration-pull:${request.ip}:${userId}`);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const providerId = cleanString(body.providerId);
      const credentialRef = cleanString(body.credentialRef);
      if (!providerId || !credentialRef) {
        fail("VALIDATION_FAILED", "providerId and credentialRef are required.");
      }
      const provider = PROVIDER_BY_ID[providerId];
      if (!provider || provider.status !== "live") {
        fail("INTEGRATION_PROVIDER_UNAVAILABLE", `${providerId} is not available for sync.`);
      }
      const entry = vault.get(credentialRef);
      if (!entry) {
        fail("INTEGRATION_NOT_CONNECTED", "This connection has no stored credential. Reconnect it.");
      }

      const window = pullWindow(Date.now(), typeof body.importRangeDays === "number" ? body.importRangeDays : 90);
      const url = providerId === "google_drive"
        ? drivePullUrl()
        : calendarPullUrl(providerId as "google_calendar" | "outlook_calendar", window);

      const response = await fetchFn(url, { headers: { authorization: `Bearer ${entry.accessToken}` } });
      if (!response.ok) {
        fail("INTEGRATION_UPSTREAM", `${provider.label} responded with ${response.status}.`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const items = parseProviderPayload(providerId as IntegrationProviderId, payload);
      return { providerId, items, nextSyncToken: null, window };
    },
  );

  app.post<{ Body: { providerId: string; credentialRef: string } }>(
    "/api/v1/integrations/refresh",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const userId = requireUserId(request);
      connectLimiter.check(`integration-refresh:${request.ip}:${userId}`);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const providerId = cleanString(body.providerId);
      const credentialRef = cleanString(body.credentialRef);
      const provider = PROVIDER_BY_ID[providerId ?? ""];
      const credentials = clientFor(config, providerId ?? "");
      if (!providerId || !credentialRef || !provider || !credentials) {
        fail("NOT_FOUND", "Unknown provider.");
      }
      const entry = vault.get(credentialRef);
      if (!entry) {
        fail("INTEGRATION_NOT_CONNECTED", "This connection has no stored credential.");
      }
      if (!entry.refreshToken) {
        fail("INTEGRATION_NOT_CONNECTED", "This connection cannot be refreshed. Reconnect it.");
      }

      const response = await fetchFn(provider.oauth!.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: refreshRequestBodyFor({
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          refreshToken: entry.refreshToken,
        }),
      });
      if (!response.ok) {
        fail("INTEGRATION_UPSTREAM", `${provider.label} rejected the refresh attempt.`);
      }
      const tokens = parseTokenResponse((await response.json()) as Record<string, unknown>, Date.now());
      vault.put(credentialRef, toVaultEntry(tokens, entry.externalAccountId));
      const refreshed = vault.get(credentialRef);
      return { providerId, credentialRef, expiresAt: refreshed?.expiresAt ?? null };
    },
  );

  app.post<{ Body: { providerId: string; credentialRef: string } }>(
    "/api/v1/integrations/disconnect",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const userId = requireUserId(request);
      connectLimiter.check(`integration-disconnect:${request.ip}:${userId}`);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const providerId = cleanString(body.providerId);
      const credentialRef = cleanString(body.credentialRef);
      if (!providerId || !credentialRef) {
        fail("VALIDATION_FAILED", "providerId and credentialRef are required.");
      }
      const provider = PROVIDER_BY_ID[providerId];
      const credentials = clientFor(config, providerId);
      const entry = vault.get(credentialRef);
      if (provider?.oauth?.revokeUrl && entry && credentials) {
        try {
          const revoke = new URLSearchParams({ token: entry.accessToken, client_id: credentials.clientId });
          await fetchFn(provider.oauth.revokeUrl, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: revoke.toString(),
          });
        } catch {
          /* the local disconnect still succeeds */
        }
      }
      vault.delete(credentialRef);
      return { ok: true };
    },
  );
};
