import type {
  DeviceInfo,
  OnboardingInput,
  OnboardingState,
  ProfilePatch,
  ProfileResponse,
  SessionInfo,
} from "@personalos/api-contract/account";

export interface ApiFieldError {
  field?: string;
  issue: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiFieldError[];

  constructor(status: number, code: string, message: string, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface AuthUser {
  id: string;
  handle: string;
  displayName: string;
  email: string | null;
}

export interface AuthSessionResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
  devEmailToken?: string;
}

export interface AuthMeResponse {
  user: AuthUser | null;
  session?: { id: string; expiresAt: string };
}

export interface OAuthProvidersResponse {
  items: Array<{ id: string; label: string; enabled: boolean }>;
}

export interface TokenResponse {
  status: "accepted";
  devToken?: string;
}

export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 0;
  return error instanceof TypeError;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiTimeoutError extends ApiError {
  constructor(timeoutMs: number) {
    super(
      0,
      "REQUEST_TIMEOUT",
      `The server did not respond in time. Check that the API is running, then try again. (timed out after ${Math.round(timeoutMs / 1000)}s)`,
    );
    this.name = "ApiTimeoutError";
  }
}

export class ApiOfflineError extends ApiError {
  constructor(cause: unknown) {
    super(
      0,
      "NETWORK_UNREACHABLE",
      "Could not reach the server. Check your connection and make sure the API is running, then try again.",
    );
    this.name = "ApiOfflineError";
    this.cause = cause;
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new ApiTimeoutError(timeoutMs);
    }
    throw new ApiOfflineError(cause);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const problem = (data ?? {}) as {
      code?: string;
      detail?: string;
      errors?: Array<{ field?: string; issue?: string }>;
    };
    const fieldErrors = (problem.errors ?? []).map((entry) => ({
      ...(entry.field !== undefined ? { field: entry.field } : {}),
      issue: entry.issue ?? "invalid",
    }));
    throw new ApiError(
      res.status,
      problem.code ?? "UNKNOWN_ERROR",
      problem.detail ?? `Request failed with status ${res.status}.`,
      fieldErrors,
    );
  }

  return data as T;
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

export const authApi = {
  me(): Promise<AuthMeResponse> {
    return apiFetch<AuthMeResponse>("/api/v1/auth/me");
  },
  register(input: {
    handle: string;
    displayName: string;
    password: string;
    email?: string;
  }): Promise<AuthSessionResponse> {
    return apiFetch<AuthSessionResponse>("/api/v1/auth/register", jsonInit("POST", input));
  },
  login(input: { identifier: string; password: string }): Promise<AuthSessionResponse> {
    return apiFetch<AuthSessionResponse>("/api/v1/auth/login", jsonInit("POST", input));
  },
  logout(): Promise<void> {
    return apiFetch<void>("/api/v1/auth/logout", jsonInit("POST"));
  },
};

export const accountApi = {
  profile(): Promise<ProfileResponse> {
    return apiFetch<ProfileResponse>("/api/v1/users/me");
  },
  patchProfile(patch: ProfilePatch): Promise<ProfileResponse> {
    return apiFetch<ProfileResponse>("/api/v1/users/me", jsonInit("PATCH", patch));
  },
  onboardingState(): Promise<OnboardingState> {
    return apiFetch<OnboardingState>("/api/v1/users/me/onboarding");
  },
  completeOnboarding(input: OnboardingInput): Promise<ProfileResponse> {
    return apiFetch<ProfileResponse>("/api/v1/users/me/onboarding", jsonInit("POST", input));
  },
  sessions(): Promise<{ items: SessionInfo[] }> {
    return apiFetch<{ items: SessionInfo[] }>("/api/v1/auth/sessions");
  },
  revokeSession(id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/auth/sessions/${id}`, jsonInit("DELETE"));
  },
  revokeOtherSessions(): Promise<{ revoked: number }> {
    return apiFetch<{ revoked: number }>(
      "/api/v1/auth/sessions/revoke-others",
      jsonInit("POST"),
    );
  },
  devices(): Promise<{ items: DeviceInfo[] }> {
    return apiFetch<{ items: DeviceInfo[] }>("/api/v1/auth/devices");
  },
  revokeDevice(id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/auth/devices/${id}`, jsonInit("DELETE"));
  },
  requestPasswordReset(identifier: string): Promise<TokenResponse> {
    return apiFetch<TokenResponse>(
      "/api/v1/auth/password-reset/request",
      jsonInit("POST", { identifier }),
    );
  },
  confirmPasswordReset(input: { token: string; password: string }): Promise<void> {
    return apiFetch<void>("/api/v1/auth/password-reset/confirm", jsonInit("POST", input));
  },
  changePassword(input: { currentPassword: string; password: string }): Promise<void> {
    return apiFetch<void>("/api/v1/auth/password", jsonInit("POST", input));
  },
  requestEmailVerification(): Promise<TokenResponse> {
    return apiFetch<TokenResponse>("/api/v1/auth/verify-email/request", jsonInit("POST"));
  },
  confirmEmailVerification(token: string): Promise<ProfileResponse> {
    return apiFetch<ProfileResponse>(
      "/api/v1/auth/verify-email/confirm",
      jsonInit("POST", { token }),
    );
  },
};

export const oauthApi = {
  providers(): Promise<OAuthProvidersResponse> {
    return apiFetch<OAuthProvidersResponse>("/api/v1/auth/oauth/providers");
  },
  startUrl(provider: string, redirect?: string): string {
    const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    return `/api/v1/auth/oauth/${provider}/start${query}`;
  },
};

export interface IntegrationCapability {
  id: string;
  label: string;
  detail: string;
  supported: boolean;
}

export interface IntegrationProviderInfo {
  id: string;
  kind: string;
  label: string;
  detail: string;
  authType: string;
  status: "live" | "preparing";
  scopes: string[];
  connectUrl: string;
  docsUrl: string | null;
  capabilities: IntegrationCapability[];
}

export interface IntegrationCatalogResponse {
  items: IntegrationProviderInfo[];
}

export interface IntegrationStatusResponse {
  providerId: string;
  status: "live" | "preparing";
  configured: boolean;
  connectable: boolean;
}

export interface IntegrationPullResponse {
  providerId: string;
  items: Array<{
    externalId: string;
    etag: string | null;
    lastModified: number | null;
    payload: Record<string, unknown>;
    deleted: boolean;
  }>;
  nextSyncToken: string | null;
}

export interface IntegrationRefreshResponse {
  providerId: string;
  credentialRef: string;
  expiresAt: number | null;
}

export const integrationApi = {
  catalog(): Promise<IntegrationCatalogResponse> {
    return apiFetch<IntegrationCatalogResponse>("/api/v1/integrations/catalog");
  },
  begin(providerId: string, returnTo: string): Promise<{ authorizeUrl: string; state: string }> {
    return apiFetch<{ authorizeUrl: string; state: string }>(
      `/api/v1/integrations/${providerId}/begin`,
      jsonInit("POST", { returnTo }),
    );
  },
  status(providerId: string): Promise<IntegrationStatusResponse> {
    return apiFetch<IntegrationStatusResponse>(`/api/v1/integrations/${providerId}/status`);
  },
  pull(
    providerId: string,
    credentialRef: string,
    importRangeDays = 90,
  ): Promise<IntegrationPullResponse> {
    return apiFetch<IntegrationPullResponse>("/api/v1/integrations/pull", jsonInit("POST", {
      providerId,
      credentialRef,
      importRangeDays,
    }));
  },
  refresh(providerId: string, credentialRef: string): Promise<IntegrationRefreshResponse> {
    return apiFetch<IntegrationRefreshResponse>("/api/v1/integrations/refresh", jsonInit("POST", {
      providerId,
      credentialRef,
    }));
  },
  disconnect(providerId: string, credentialRef: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/v1/integrations/disconnect", jsonInit("POST", {
      providerId,
      credentialRef,
    }));
  },
};

export function errorMessage(error: unknown): string {  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.fieldErrors.find((entry) => entry.field === field)?.issue;
}
