import { describe, expect, it } from "vitest";

import {
  AppError,
  ERROR_CATALOG,
  isAppError,
  problemFromUnknown,
  problemTypeFor,
  type ErrorCode,
} from "./errors";

describe("error catalog", () => {
  it("declares a valid status and title for every code", () => {
    const codes = Object.keys(ERROR_CATALOG) as ErrorCode[];
    expect(codes.length).toBeGreaterThanOrEqual(20);
    for (const code of codes) {
      const spec = ERROR_CATALOG[code];
      expect(spec.status).toBeGreaterThanOrEqual(400);
      expect(spec.status).toBeLessThan(600);
      expect(spec.title.length).toBeGreaterThan(0);
    }
  });

  it("builds kebab-case problem type URIs", () => {
    expect(problemTypeFor("VALIDATION_FAILED")).toBe(
      "https://api.personalos.dev/problems/validation-failed",
    );
    expect(problemTypeFor("CONFLICT_SERVER_AUTHORITATIVE")).toBe(
      "https://api.personalos.dev/problems/conflict-server-authoritative",
    );
    expect(problemTypeFor("NOT_FOUND")).toBe(
      "https://api.personalos.dev/problems/not-found",
    );
  });
});

describe("AppError", () => {
  it("carries status from the catalog", () => {
    const error = new AppError("CONFLICT_VERSION", { detail: "stale version" });
    expect(error.status).toBe(409);
    expect(error.message).toBe("stale version");
    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("falls back to the catalog title as the message", () => {
    expect(new AppError("RATE_LIMITED").message).toBe("Rate limited");
  });

  it("maps to an RFC 9457 problem with context", () => {
    const error = new AppError("VALIDATION_FAILED", {
      detail: "bad query",
      errors: [{ field: "limit", issue: "must be at least 1" }],
    });
    const problem = error.toProblem({ requestId: "req_1", instance: "/api/v1/tasks" });
    expect(problem).toEqual({
      type: "https://api.personalos.dev/problems/validation-failed",
      title: "Validation failed",
      status: 400,
      code: "VALIDATION_FAILED",
      detail: "bad query",
      instance: "/api/v1/tasks",
      requestId: "req_1",
      errors: [{ field: "limit", issue: "must be at least 1" }],
    });
  });

  it("omits optional members when absent", () => {
    const problem = new AppError("NOT_FOUND").toProblem();
    expect(problem.detail).toBeUndefined();
    expect(problem.instance).toBeUndefined();
    expect(problem.requestId).toBeUndefined();
    expect(problem.errors).toBeUndefined();
  });
});

describe("problemFromUnknown", () => {
  it("passes AppError through with context", () => {
    const { problem, status } = problemFromUnknown(new AppError("FORBIDDEN"), {
      requestId: "req_2",
    });
    expect(status).toBe(403);
    expect(problem.code).toBe("FORBIDDEN");
    expect(problem.requestId).toBe("req_2");
  });

  it("never leaks internals from unexpected errors", () => {
    const secret = new Error("SELECT * FROM users WHERE token = 'hunter2'");
    const { problem, status } = problemFromUnknown(secret, { requestId: "req_3" });
    expect(status).toBe(500);
    expect(problem.code).toBe("INTERNAL");
    expect(JSON.stringify(problem)).not.toContain("hunter2");
    expect(problem.requestId).toBe("req_3");
  });

  it("handles non-error values", () => {
    const { status } = problemFromUnknown("string failure");
    expect(status).toBe(500);
  });
});
