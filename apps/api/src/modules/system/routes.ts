import type { FastifyPluginAsync } from "fastify";
import { register } from "prom-client";
import { z } from "zod";

import { AppError, parseOrThrow } from "@personalos/api-contract";

import type { Config } from "../../config";

export interface ReadinessCheck {
  name: string;
  run: () => void | Promise<void>;
}

export interface SystemRouteOptions {
  config: Config;
  checks: ReadinessCheck[];
}

const infoQuerySchema = z.object({
  verbose: z.enum(["true", "false"]).default("false"),
});

export const systemRoutes: FastifyPluginAsync<SystemRouteOptions> = async (
  app,
  options,
) => {
  const { config, checks } = options;

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => {
    const results: Array<{ name: string; ok: boolean }> = [];
    for (const check of checks) {
      try {
        await check.run();
        results.push({ name: check.name, ok: true });
      } catch (error) {
        app.log.warn({ check: check.name, err: error }, "readiness check failed");
        results.push({ name: check.name, ok: false });
      }
    }
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      throw new AppError("SERVICE_UNAVAILABLE", {
        detail: `Readiness checks failed: ${failed
          .map((result) => result.name)
          .join(", ")}`,
      });
    }
    return { status: "ready", checks: results };
  });

  app.get("/api/v1/system/info", async (request) => {
    const query = parseOrThrow(infoQuerySchema, request.query ?? {});
    const base = {
      name: "personalos-api",
      version: config.APP_VERSION,
      env: config.NODE_ENV,
      time: new Date().toISOString(),
    };
    if (query.verbose === "true") {
      return { ...base, uptimeSec: Math.round(process.uptime()), node: process.version };
    }
    return base;
  });

  app.get("/metrics", async (_request, reply) => {
    const body = await register.metrics();
    return reply.type(register.contentType).send(body);
  });
};
