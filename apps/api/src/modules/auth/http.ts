import { AppError } from "@personalos/api-contract";
import type { FastifyRequest } from "fastify";

export interface AuthRequestContextLike {
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export function toContext(request: FastifyRequest): AuthRequestContextLike {
  return {
    requestId: String(request.id),
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null,
  };
}

export function validationProblem(
  issues: { path: PropertyKey[]; message: string }[],
  detail: string,
): AppError {
  return new AppError("VALIDATION_FAILED", {
    detail,
    errors: issues.map((issue) => ({
      field: issue.path.join("."),
      issue: issue.message,
    })),
  });
}
