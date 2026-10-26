import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { parse as parseForm } from "node:querystring";

import { AppError } from "@personalos/api-contract";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import type { Config } from "../../config";
import type { Db } from "../../db/index";
import { toContext } from "./http";
import { createRateLimiter } from "./rate-limit";
import {
  OAUTH_STATE_TTL_MS,
  consumeAuthToken,
  createAuthToken,
  generateToken,
} from "./token-store";
import { readCookie } from "./tokens";
import type { AuthService } from "./service";

export type ProviderId = "google" | "apple" | "microsoft";

const PROVIDER_IDS: readonly ProviderId[] = ["google", "apple", "microsoft"];
const OAUTH_COOKIE = "pos_oauth";
const OAUTH_COOKIE_PATH = "/api/v1/auth/oauth";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ProviderRuntime {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  jwksUrl?: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  extraAuthorizeParams?: Record<string, string>;
}

export function buildProviders(config: Config): Record<ProviderId, ProviderRuntime> {
  return {
    google: {
      id: "google",
      label: "Google",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      extraAuthorizeParams: { prompt: "select_account" },
    },
    apple: {
      id: "apple",
      label: "Apple",
      authorizeUrl: "https://appleid.apple.com/auth/authorize",
      tokenUrl: "https://appleid.apple.com/auth/token",
      jwksUrl: "https://appleid.apple.com/auth/jwks",
      scope: "openid email name",
      clientId: config.APPLE_CLIENT_ID,
      clientSecret: config.APPLE_CLIENT_SECRET,
      extraAuthorizeParams: { response_mode: "query" },
    },
    microsoft: {
      id: "microsoft",
      label: "Microsoft",
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userinfoUrl: "https://graph.microsoft.com/oidc/userinfo",
      scope: "openid email profile",
      clientId: config.MICROSOFT_CLIENT_ID,
      clientSecret: config.MICROSOFT_CLIENT_SECRET,
    },
  };
}

export interface OAuthIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

interface Claims {
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function claimVerified(value: unknown): boolean {
  return value === true || value === "true";
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

function buildAuthorizeUrl(
  provider: ProviderRuntime,
  options: { redirectUri: string; state: string; verifier: string; nonce: string },
): string {
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scope);
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", createHash("sha256").update(options.verifier).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  if (provider.id === "apple") {
    url.searchParams.set("nonce", options.nonce);
    url.searchParams.set("response_mode", "query");
  }
  for (const [key, value] of Object.entries(provider.extraAuthorizeParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function exchangeCode(
  provider: ProviderRuntime,
  fetchFn: FetchLike,
  options: { code: string; redirectUri: string; verifier: string },
): Promise<{ accessToken: string | null; idToken: string | null }> {
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code: options.code,
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
    code_verifier: options.verifier,
  });
  const response = await fetchFn(provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Token exchange failed." });
  }
  const payload = (await response.json()) as { access_token?: string; id_token?: string };
  const accessToken = asString(payload.access_token);
  const idToken = asString(payload.id_token);
  if (!accessToken && !idToken) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Token exchange returned no token." });
  }
  return { accessToken, idToken };
}

async function fetchUserInfo(
  provider: ProviderRuntime,
  fetchFn: FetchLike,
  accessToken: string,
): Promise<Claims> {
  if (!provider.userinfoUrl) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Provider has no userinfo endpoint." });
  }
  const response = await fetchFn(provider.userinfoUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Userinfo request failed." });
  }
  return (await response.json()) as Claims;
}

interface JwkKey {
  kty: string;
  kid?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  [key: string]: unknown;
}

let jwksCache: { at: number; keys: JwkKey[] } | null = null;

async function loadJwks(
  provider: ProviderRuntime,
  fetchFn: FetchLike,
): Promise<JwkKey[]> {
  if (jwksCache && Date.now() - jwksCache.at < 5 * 60_000) {
    return jwksCache.keys;
  }
  if (!provider.jwksUrl) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Provider has no JWKS endpoint." });
  }
  const response = await fetchFn(provider.jwksUrl);
  if (!response.ok) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "JWKS request failed." });
  }
  const payload = (await response.json()) as { keys?: JwkKey[] };
  const keys = payload.keys ?? [];
  jwksCache = { at: Date.now(), keys };
  return keys;
}

async function verifyAppleIdToken(
  provider: ProviderRuntime,
  fetchFn: FetchLike,
  idToken: string,
): Promise<Claims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Malformed id_token." });
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeBase64UrlJson(headerPart) as { alg?: string; kid?: string };
  if (header.alg !== "RS256") {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Unexpected id_token algorithm." });
  }
  const keys = await loadJwks(provider, fetchFn);
  const jwk = header.kid ? keys.find((key) => key.kid === header.kid) : keys[0];
  if (!jwk) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "No matching signing key." });
  }
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const valid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    publicKey,
    Buffer.from(signaturePart, "base64url"),
  );
  if (!valid) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "id_token signature invalid." });
  }
  const claims = decodeBase64UrlJson(payloadPart) as Claims;
  if (claims.iss !== "https://appleid.apple.com") {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Unexpected issuer." });
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(provider.clientId)) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Unexpected audience." });
  }
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "id_token expired." });
  }
  return claims;
}

function toIdentity(provider: ProviderId, claims: Claims): OAuthIdentity {
  const subject = asString(claims.sub);
  if (!subject) {
    throw new AppError("AUTH_OAUTH_FAILED", { detail: "Provider returned no subject." });
  }
  return {
    subject,
    email: asString(claims.email)?.toLowerCase() ?? null,
    emailVerified: claimVerified(claims.email_verified),
    name: asString(claims.name),
    picture: asString(claims.picture),
  };
}

function oauthFailRedirect(reply: FastifyReply, appUrl: string): FastifyReply {
  return reply.redirect(`${appUrl}/login?error=oauth_failed`, 302);
}

function sanitizeRedirect(redirect: unknown): string {
  if (typeof redirect !== "string") return "/";
  if (!redirect.startsWith("/") || redirect.startsWith("//") || redirect.includes("\\")) {
    return "/";
  }
  return redirect;
}

export interface OAuthRoutesDeps {
  auth: AuthService;
  config: Config;
  db: Db;
  fetchFn?: FetchLike;
}

export const oauthRoutes: FastifyPluginAsync<OAuthRoutesDeps> = async (app, deps) => {
  const { auth, config, db } = deps;
  const fetchFn: FetchLike = deps.fetchFn ?? ((input, init) => fetch(input, init));
  const providers = buildProviders(config);
  const startLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
  const callbackLimiter = createRateLimiter({ max: 40, windowMs: 60 * 60 * 1000 });

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, parseForm(String(body)));
    },
  );

  async function optionalAuth(request: FastifyRequest): Promise<string | null> {
    const header = request.headers.authorization;
    if (!header?.toLowerCase().startsWith("bearer ")) return null;
    const token = header.slice(7).trim();
    if (!token) return null;
    try {
      const session = await auth.resolveSession(token);
      return session.user.id;
    } catch {
      return null;
    }
  }

  app.get("/api/v1/auth/oauth/providers", async () => ({
    items: PROVIDER_IDS.map((id) => ({
      id,
      label: providers[id].label,
      enabled: Boolean(providers[id].clientId && providers[id].clientSecret),
    })),
  }));

  app.get<{ Params: { provider: string } }>(
    "/api/v1/auth/oauth/:provider/start",
    async (request, reply) => {
      const provider = providers[request.params.provider as ProviderId];
      if (!provider || !provider.clientId || !provider.clientSecret) {
        throw new AppError("NOT_FOUND", { detail: "Unknown provider." });
      }
      startLimiter.check(`oauth-start:${request.ip}`);

      const verifier = generateToken(64);
      const nonce = generateToken(16);
      const linkUserId = await optionalAuth(request);
      const redirect = sanitizeRedirect(
        (request.query as Record<string, unknown>).redirect,
      );
      const created = await createAuthToken(db, {
        userId: linkUserId,
        kind: "oauth_state",
        ttlMs: OAUTH_STATE_TTL_MS,
        payload: {
          provider: provider.id,
          verifier,
          nonce,
          redirect,
          linkUserId,
        },
      });
      const state = created.token;

      const redirectUri = `${request.protocol}://${request.host}/api/v1/auth/oauth/${provider.id}/callback`;
      reply.header(
        "set-cookie",
        [
          `${OAUTH_COOKIE}=${encodeURIComponent(state)}`,
          `Path=${OAUTH_COOKIE_PATH}`,
          "HttpOnly",
          "SameSite=Lax",
          `Max-Age=${Math.floor(OAUTH_STATE_TTL_MS / 1000)}`,
          ...(config.NODE_ENV === "production" ? ["Secure"] : []),
        ].join("; "),
      );
      return reply.redirect(
        buildAuthorizeUrl(provider, { redirectUri, state, verifier, nonce }),
        302,
      );
    },
  );

  async function handleCallback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const providerId = request.params as { provider: string };
    const provider = providers[providerId.provider as ProviderId];
    if (!provider || !provider.clientId || !provider.clientSecret) {
      oauthFailRedirect(reply, config.APP_URL);
      return;
    }
    callbackLimiter.check(`oauth-callback:${request.ip}`);

    const query = (request.query ?? {}) as Record<string, unknown>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const state = asString(query.state) ?? asString(body.state);
    const cookieState = readCookie(request.headers.cookie, OAUTH_COOKIE);
    reply.header(
      "set-cookie",
      `${OAUTH_COOKIE}=; Path=${OAUTH_COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=0${
        config.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );

    if (!state || !cookieState || state !== cookieState) {
      oauthFailRedirect(reply, config.APP_URL);
      return;
    }
    const consumed = await consumeAuthToken(db, "oauth_state", state);
    if (!consumed || consumed.payload?.provider !== provider.id) {
      oauthFailRedirect(reply, config.APP_URL);
      return;
    }
    const code = asString(query.code) ?? asString(body.code);
    if (!code) {
      oauthFailRedirect(reply, config.APP_URL);
      return;
    }

    try {
      const verifier = String(consumed.payload.verifier ?? "");
      const redirectUri = `${request.protocol}://${request.host}/api/v1/auth/oauth/${provider.id}/callback`;
      const tokens = await exchangeCode(provider, fetchFn, {
        code,
        redirectUri,
        verifier,
      });

      let claims: Claims;
      if (provider.id === "apple") {
        if (!tokens.idToken) {
          throw new AppError("AUTH_OAUTH_FAILED", { detail: "Missing id_token." });
        }
        claims = await verifyAppleIdToken(provider, fetchFn, tokens.idToken);
      } else {
        if (!tokens.accessToken) {
          throw new AppError("AUTH_OAUTH_FAILED", { detail: "Missing access_token." });
        }
        claims = await fetchUserInfo(provider, fetchFn, tokens.accessToken);
      }

      const identity = toIdentity(provider.id, claims);
      const linkUserId = asString(consumed.payload.linkUserId);
      const redirect = sanitizeRedirect(consumed.payload.redirect);
      const result = await auth.completeOAuthIdentity(
        {
          provider: provider.id,
          subject: identity.subject,
          email: identity.email,
          emailVerified: identity.emailVerified,
          name: identity.name,
          picture: identity.picture,
        },
        { linkUserId },
        toContext(request),
      );

      if (result.linked) {
        reply.redirect(`${config.APP_URL}${redirect}?linked=1`, 302);
        return;
      }
      if (!result.issued) {
        oauthFailRedirect(reply, config.APP_URL);
        return;
      }
      reply.header(
        "set-cookie",
        [
          `pos_session=${encodeURIComponent(result.issued.token)}`,
          "Path=/",
          "HttpOnly",
          "SameSite=Lax",
          `Max-Age=${Math.floor((result.issued.expiresAt.getTime() - Date.now()) / 1000)}`,
          ...(config.NODE_ENV === "production" ? ["Secure"] : []),
        ].join("; "),
      );
      if (result.isNewUser || !result.onboardingCompleted) {
        reply.redirect(`${config.APP_URL}/onboarding?auth=1`, 302);
        return;
      }
      reply.redirect(`${config.APP_URL}${redirect}?auth=1`, 302);
    } catch (error) {
      request.log.error({ err: error }, "oauth callback failed");
      oauthFailRedirect(reply, config.APP_URL);
    }
  }

  app.get<{ Params: { provider: string } }>(
    "/api/v1/auth/oauth/:provider/callback",
    async (request, reply) => {
      await handleCallback(request, reply);
    },
  );

  app.post<{ Params: { provider: string } }>(
    "/api/v1/auth/oauth/:provider/callback",
    async (request, reply) => {
      await handleCallback(request, reply);
    },
  );
};

export function generateStateToken(bytes = 32): string {
  return generateToken(bytes);
}

export { buildAuthorizeUrl as __buildAuthorizeUrl, sanitizeRedirect as __sanitizeRedirect, toIdentity as __toIdentity };
