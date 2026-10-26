import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "./errors";
import { idParamSchema, limitQuerySchema, parseOrThrow } from "./schemas";

describe("idParamSchema", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(idParamSchema.safeParse("3f0c9a1e-1b2c-4d5e-8f90-abcdef012345").success).toBe(true);
    expect(idParamSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(idParamSchema.safeParse("").success).toBe(false);
  });
});

describe("limitQuerySchema", () => {
  it("coerces query strings and applies bounds with a default", () => {
    expect(limitQuerySchema.parse("25")).toBe(25);
    expect(limitQuerySchema.parse(undefined)).toBe(50);
    expect(limitQuerySchema.safeParse("0").success).toBe(false);
    expect(limitQuerySchema.safeParse("201").success).toBe(false);
    expect(limitQuerySchema.safeParse("1.5").success).toBe(false);
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    expect(parseOrThrow(limitQuerySchema, "10")).toBe(10);
  });

  it("throws VALIDATION_FAILED with field-level issues", () => {
    const schema = z.object({ name: z.string().min(3) });
    try {
      parseOrThrow(schema, { name: "ab" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("VALIDATION_FAILED");
      expect(appError.status).toBe(400);
      expect(appError.errors).toHaveLength(1);
      expect(appError.errors?.[0]?.field).toBe("name");
      expect(appError.errors?.[0]?.issue.length).toBeGreaterThan(0);
    }
  });

  it("labels root-level issues", () => {
    try {
      parseOrThrow(z.string(), 42);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).errors?.[0]?.field).toBe("(root)");
    }
  });

  it("supports a custom detail", () => {
    try {
      parseOrThrow(z.string(), 42, { detail: "bad body" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).detail).toBe("bad body");
    }
  });
});
