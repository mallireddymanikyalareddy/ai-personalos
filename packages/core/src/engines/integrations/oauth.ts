import type { ProviderAuthType, ProviderDefinition, SyncDirection } from "../../types/integration";

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  scope: string;
  tokenType: string;
}

export interface OAuthExchangeRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthHttpClient {
  postForm(url: string, body: Record<string, string>): Promise<OAuthTokenSet>;
  fetchJson<T>(url: string, accessToken: string): Promise<T>;
  fetchJsonWithHeaders<T>(url: string, headers: Record<string, string>, body?: string): Promise<T>;
}

export interface OAuthAuthorizeRequest {
  provider: ProviderDefinition;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeVerifier: string;
}

export function buildAuthorizeUrl(request: OAuthAuthorizeRequest): string {
  const { provider, redirectUri, state, codeChallenge, codeVerifier } = request;
  const url = new URL(provider.oauth!.authorizeUrl);
  url.searchParams.set("client_id", "CLIENT_ID");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(provider.oauth?.scopeSeparator ?? " "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider.authType === "oauth2") {
    url.searchParams.set("response_mode", "query");
  }
  for (const [key, value] of Object.entries(provider.oauth?.extraAuthorizeParams ?? {})) {
    url.searchParams.set(key, value);
  }
  void codeVerifier;
  return url.toString();
}

export function buildTokenRequestBody(
  request: OAuthExchangeRequest,
  options: { clientId: string; clientSecret: string; grantType?: string },
): string {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code: request.code,
    redirect_uri: request.redirectUri,
    grant_type: options.grantType ?? "authorization_code",
    code_verifier: request.codeVerifier,
  });
  return body.toString();
}

export function buildRefreshedTokenRequestBody(
  refreshToken: string,
  options: { clientId: string; clientSecret: string },
): string {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return body.toString();
}

export function parseTokenResponse(payload: Record<string, unknown>, now: number): OAuthTokenSet {
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : null;
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";

  if (!accessToken) {
    throw new Error("Token response contained no access_token.");
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn != null ? now + expiresIn * 1000 : null,
    scope,
    tokenType,
  };
}

export function isRefreshableAuth(authType: ProviderAuthType): boolean {
  return authType === "oauth2" || authType === "oauth2_pkce";
}

export interface TokenVaultEntry {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  scope: string;
  tokenType: string;
  externalAccountId: string | null;
}

export interface TokenVault {
  put(ref: string, entry: TokenVaultEntry): void;
  get(ref: string): TokenVaultEntry | null;
  delete(ref: string): void;
  list(): string[];
  rotate(): void;
}

export interface IntegrationConnectionState {
  status: "never_connected" | "connected" | "expired" | "revoked";
  lastConnectedAt: number | null;
  expiresAt: number | null;
}

export function connectionState(vault: TokenVault, ref: string | null, now = Date.now()): IntegrationConnectionState {
  if (!ref) return { status: "never_connected", lastConnectedAt: null, expiresAt: null };
  const entry = vault.get(ref);
  if (!entry) return { status: "never_connected", lastConnectedAt: null, expiresAt: null };
  if (!entry.accessToken) return { status: "revoked", lastConnectedAt: null, expiresAt: entry.expiresAt };
  return { status: "connected", lastConnectedAt: entry.expiresAt, expiresAt: entry.expiresAt };
}

export function buildVaultRef(provider: string, workspaceId: string, nonce: string): string {
  return `vault/${workspaceId}/${provider}/${nonce}`;
}

export const DIRECTION_LABELS: Record<SyncDirection, string> = {
  inbound: "Inbound only",
  outbound: "Outbound only",
  bidirectional: "Two-way",
};