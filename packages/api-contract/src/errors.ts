export interface ErrorSpec {
  status: number;
  title: string;
}

export const ERROR_CATALOG = {
  VALIDATION_FAILED: { status: 400, title: "Validation failed" },
  VALIDATION_SEMANTIC: { status: 422, title: "Semantic validation failed" },
  AUTH_REQUIRED: { status: 401, title: "Authentication required" },
  AUTH_INVALID_CREDENTIALS: { status: 401, title: "Invalid credentials" },
  AUTH_TOKEN_EXPIRED: { status: 401, title: "Token expired" },
  AUTH_SESSION_REVOKED: { status: 401, title: "Session revoked" },
  AUTH_OAUTH_FAILED: { status: 401, title: "OAuth sign-in failed" },
  AUTH_OAUTH_STATE_INVALID: { status: 400, title: "OAuth state invalid" },
  FORBIDDEN: { status: 403, title: "Forbidden" },
  POLICY_DENIED: { status: 403, title: "Policy denied" },
  NOT_FOUND: { status: 404, title: "Not found" },
  CONFLICT_VERSION: { status: 409, title: "Version conflict" },
  CONFLICT_ALREADY_EXISTS: { status: 409, title: "Already exists" },
  CONFLICT_SERVER_AUTHORITATIVE: { status: 409, title: "Server-authoritative resource" },
  PAYLOAD_TOO_LARGE: { status: 413, title: "Payload too large" },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, title: "Unsupported media type" },
  RATE_LIMITED: { status: 429, title: "Rate limited" },
  AI_BUDGET_EXCEEDED: { status: 429, title: "AI budget exceeded" },
  INTERNAL: { status: 500, title: "Internal error" },
  NOT_IMPLEMENTED: { status: 501, title: "Not implemented" },
  INTEGRATION_UPSTREAM: { status: 502, title: "Upstream integration error" },
  INTEGRATION_NOT_CONNECTED: { status: 409, title: "Integration not connected" },
  INTEGRATION_PROVIDER_NOT_CONFIGURED: { status: 503, title: "Integration provider not configured" },
  INTEGRATION_PROVIDER_UNAVAILABLE: { status: 501, title: "Integration provider unavailable" },
  SERVICE_UNAVAILABLE: { status: 503, title: "Service unavailable" },
  AI_UNAVAILABLE: { status: 503, title: "AI provider unavailable" },
} as const satisfies Record<string, ErrorSpec>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export const PROBLEM_BASE_URL = "https://api.personalos.dev/problems";

export function problemTypeFor(code: ErrorCode): string {
  const slug = code
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
  return `${PROBLEM_BASE_URL}/${slug}`;
}

export interface FieldError {
  field: string;
  issue: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: FieldError[];
}

export interface AppErrorOptions {
  detail?: string;
  errors?: FieldError[];
  instance?: string;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: string;
  readonly errors?: FieldError[];
  readonly instance?: string;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.detail ?? ERROR_CATALOG[code].title, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CATALOG[code].status;
    this.detail = options.detail;
    this.errors = options.errors;
    this.instance = options.instance;
  }

  toProblem(context: { requestId?: string; instance?: string } = {}): Problem {
    const problem: Problem = {
      type: problemTypeFor(this.code),
      title: ERROR_CATALOG[this.code].title,
      status: this.status,
      code: this.code,
    };
    if (this.detail !== undefined) problem.detail = this.detail;
    const instance = this.instance ?? context.instance;
    if (instance !== undefined) problem.instance = instance;
    if (context.requestId !== undefined) problem.requestId = context.requestId;
    if (this.errors !== undefined && this.errors.length > 0) problem.errors = this.errors;
    return problem;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export interface UnknownErrorResult {
  problem: Problem;
  status: number;
}

export function problemFromUnknown(
  value: unknown,
  context: { requestId?: string; instance?: string } = {},
): UnknownErrorResult {
  if (isAppError(value)) {
    return { problem: value.toProblem(context), status: value.status };
  }
  const problem: Problem = {
    type: problemTypeFor("INTERNAL"),
    title: ERROR_CATALOG.INTERNAL.title,
    status: 500,
    code: "INTERNAL",
  };
  if (context.requestId !== undefined) problem.requestId = context.requestId;
  if (context.instance !== undefined) problem.instance = context.instance;
  return { problem, status: 500 };
}
