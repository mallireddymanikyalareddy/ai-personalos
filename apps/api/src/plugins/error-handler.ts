import { AppError, type ErrorCode } from "@personalos/api-contract";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

const STATUS_CODE_MAP: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "AUTH_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT_VERSION",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "RATE_LIMITED",
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("VALIDATION_FAILED", {
      detail: error.issues[0]?.message ?? "Request failed schema validation.",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        issue: issue.message,
      })),
      cause: error,
    });
  }
  const candidate = error as Partial<FastifyError> & { statusCode?: number };
  const status = typeof candidate.statusCode === "number" ? candidate.statusCode : 500;
  const code = STATUS_CODE_MAP[status];
  if (status >= 400 && status < 500 && code) {
    return new AppError(code, {
      detail: typeof candidate.message === "string" ? candidate.message : undefined,
      cause: error,
    });
  }
  return new AppError("INTERNAL", { cause: error });
}

export function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
): FastifyReply {
  const appError = toAppError(error);
  const problem = appError.toProblem({
    requestId: String(request.id),
    instance: request.url.split("?")[0],
  });
  if (appError.status >= 500) {
    request.log.error({ err: error, code: appError.code }, "unhandled error");
  } else {
    request.log.info({ code: appError.code }, "request rejected");
  }
  return reply
    .code(appError.status)
    .type("application/problem+json")
    .send(problem);
}
