import { randomUUID } from "node:crypto";

import { AppError } from "@personalos/api-contract";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { Histogram, collectDefaultMetrics } from "prom-client";

import type { Config } from "./config";
import type { Db } from "./db/index";
import { registerAuthorize } from "./plugins/authorize";
import { accountRoutes } from "./modules/auth/account-routes";
import { oauthRoutes, type FetchLike } from "./modules/auth/oauth";
import { createProfileService } from "./modules/auth/profile";
import { authRoutes, createAuthenticator } from "./modules/auth/routes";
import { createAuthService } from "./modules/auth/service";
import { createDevProfileService, createDevSessionService } from "./modules/auth/dev-account";
import { createDevAuthService } from "./modules/auth/dev-auth";
import { integrationRoutes } from "./modules/integrations/routes";
import { EncryptedTokenVault } from "./modules/integrations/vault";
import { createSessionService } from "./modules/auth/sessions";
import { auditRoutes } from "./modules/audit/routes";
import { stateRoutes } from "./modules/state/routes";
import { systemRoutes, type ReadinessCheck } from "./modules/system/routes";
import { sendProblem } from "./plugins/error-handler";

export type { ReadinessCheck } from "./modules/system/routes";

export interface BuildAppOptions {
  config: Config;
  checks?: ReadinessCheck[];
  logger?: FastifyServerOptions["logger"];
  db?: Db;
  oauthFetch?: FetchLike;
  integrationFetch?: FetchLike;
  tokenVault?: EncryptedTokenVault;
}

let defaultMetricsStarted = false;

const httpDuration = new Histogram({
  name: "personalos_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config } = options;

  if (!defaultMetricsStarted) {
    collectDefaultMetrics({ prefix: "personalos_" });
    defaultMetricsStarted = true;
  }

  const app = Fastify({
    trustProxy: true,
    logger:
      options.logger ?? {
        level: config.LOG_LEVEL,
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie"],
          censor: "[redacted]",
        },
      },
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      if (typeof incoming === "string" && /^[\w.:-]{1,128}$/.test(incoming)) {
        return incoming;
      }
      return randomUUID();
    },
  });

  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", String(request.id));
    const pathname = request.url.split("?")[0];
    if (pathname.startsWith("/api/v1") || pathname === "/healthz" || pathname === "/readyz") {
      reply.header("cache-control", "no-store");
    }
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    httpDuration.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? "unknown",
        status: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    sendProblem(request, reply, error);
  });

  app.setNotFoundHandler((request, reply) => {
    sendProblem(
      request,
      reply,
      new AppError("NOT_FOUND", {
        detail: `Route ${request.method} ${request.url.split("?")[0]} not found.`,
      }),
    );
  });

  await app.register(systemRoutes, {
    config,
    checks: options.checks ?? [],
  });

  if (options.db) {
    const db = options.db;
    const secureCookies = config.NODE_ENV === "production";
    const authService = createAuthService({ db, config });
    const profileService = createProfileService({ db, config });
    const sessionService = createSessionService({ db });
    app.decorateRequest("auth", null);
    app.decorate("authenticate", createAuthenticator(authService));
    registerAuthorize(app);
    await app.register(authRoutes, { service: authService, secureCookies });
    await app.register(accountRoutes, {
      auth: authService,
      profile: profileService,
      sessions: sessionService,
    });
    await app.register(oauthRoutes, {
      auth: authService,
      config,
      db,
      ...(options.oauthFetch ? { fetchFn: options.oauthFetch } : {}),
    });
    await app.register(auditRoutes, { db });
    await app.register(stateRoutes, { db });
    await app.register(integrationRoutes, {
      config,
      ...(options.integrationFetch ? { fetchFn: options.integrationFetch } : {}),
      ...(options.tokenVault ? { vault: options.tokenVault } : {}),
    });
  } else {
    const devAuth = createDevAuthService(config);
    app.decorateRequest("auth", null);
    app.decorate("authenticate", createAuthenticator(devAuth));
    registerAuthorize(app);
    await app.register(authRoutes, { service: devAuth, secureCookies: false });
    await app.register(accountRoutes, {
      auth: devAuth,
      profile: createDevProfileService(),
      sessions: createDevSessionService(),
    });
    await app.register(integrationRoutes, {
      config,
      ...(options.integrationFetch ? { fetchFn: options.integrationFetch } : {}),
      ...(options.tokenVault ? { vault: options.tokenVault } : {}),
    });
  }

  return app;
}
