import { describe, expect, it } from "vitest";

import { ApiError, ApiOfflineError, ApiTimeoutError, isNetworkFailure } from "@/lib/api";

describe("api client", () => {
  it("reports a network failure distinctly from an API error", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("boom"))).toBe(false);
    expect(isNetworkFailure(new ApiError(500, "INTERNAL", "nope"))).toBe(false);
    expect(isNetworkFailure("string")).toBe(false);
  });

  it("turns a raw fetch failure into an actionable offline error", () => {
    const error = new ApiOfflineError(new TypeError("Failed to fetch"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_UNREACHABLE");
    expect(error.message).toContain("Could not reach the server");
    expect(isNetworkFailure(error)).toBe(true);
  });

  it("treats a request timeout as a network failure rather than a logout", () => {
    const error = new ApiTimeoutError(15_000);
    expect(error.status).toBe(0);
    expect(error.code).toBe("REQUEST_TIMEOUT");
    expect(error.message).toContain("did not respond in time");
    expect(isNetworkFailure(error)).toBe(true);
  });

  it("keeps server problems as ApiError so status codes survive", () => {
    const error = new ApiError(401, "AUTH_REQUIRED", "Authentication required.");
    expect(isNetworkFailure(error)).toBe(false);
    expect(error.status).toBe(401);
  });
});
