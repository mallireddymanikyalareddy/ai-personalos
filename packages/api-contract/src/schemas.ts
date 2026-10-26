import { z } from "zod";

import { AppError } from "./errors";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idParamSchema = z.string().regex(UUID_PATTERN, "must be a UUID");

export const limitQuerySchema = z.coerce
  .number()
  .int("must be an integer")
  .min(1, "must be at least 1")
  .max(200, "must be at most 200")
  .default(50);

export const cursorQuerySchema = z
  .string()
  .min(1, "must not be empty")
  .max(512, "must be at most 512 characters");

export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  options: { detail?: string } = {},
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AppError("VALIDATION_FAILED", {
    detail: options.detail ?? "Request failed schema validation.",
    errors: result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
      issue: issue.message,
    })),
  });
}
