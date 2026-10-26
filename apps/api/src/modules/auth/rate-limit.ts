import { AppError } from "@personalos/api-contract";

export interface RateLimiterOptions {
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>();
  const now = (): number => Date.now();

  return {
    check(key: string): void {
      const current = now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= current) {
        buckets.set(key, { count: 1, resetAt: current + options.windowMs });
        if (buckets.size > 10_000) {
          for (const [entryKey, entry] of buckets) {
            if (entry.resetAt <= current) buckets.delete(entryKey);
          }
        }
        return;
      }
      bucket.count += 1;
      if (bucket.count > options.max) {
        throw new AppError("RATE_LIMITED", {
          detail: `Too many attempts. Retry after ${Math.ceil(
            (bucket.resetAt - current) / 1000,
          )}s.`,
        });
      }
    },
    reset(key?: string): void {
      if (key === undefined) buckets.clear();
      else buckets.delete(key);
    },
  };
}
