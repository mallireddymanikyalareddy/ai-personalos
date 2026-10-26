import { AppError } from "@personalos/api-contract";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { toContext, validationProblem } from "./http";
import { type AuthService, type AuthenticatedSession } from "./service";
import { createRateLimiter } from "./rate-limit";
import {
  SESSION_COOKIE_NAME,
  clearedSessionCookie,
  readBearer,
  readCookie,
  sessionCookie,
} from "./tokens";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthenticatedSession | null;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

const registerSchema = z.object({
  handle: z.string().min(3).max(32).toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,31}$/),
  email: z.email().optional(),
  password: z.string().min(10).max(200),
  displayName: z.string().min(1).max(64),
});

const loginSchema = z.object({
  identifier: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

function extractToken(request: FastifyRequest): string | null {
  const bearer = readBearer(request.headers.authorization);
  if (bearer) return bearer;
  return readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
}

export function createAuthenticator(
  service: AuthService,
): (request: FastifyRequest) => Promise<void> {
  return async (request: FastifyRequest): Promise<void> => {
    const token = extractToken(request);
    if (!token) {
      request.auth = null;
      throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
    }
    request.auth = await service.resolveSession(token);
  };
}

export const authRoutes: FastifyPluginAsync<{
  service: AuthService;
  secureCookies: boolean;
}> = async (app, options) => {
  const { service } = options;
  const loginLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
  const registerLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });

  app.post("/api/v1/auth/register", async (request, reply) => {
    registerLimiter.check(`register:${request.ip}`);
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationProblem(parsed.error.issues, "Registration failed schema validation.");
    }
    const issued = await service.register(parsed.data, toContext(request));
    reply
      .header("set-cookie", sessionCookie(issued.token, options.secureCookies))
      .status(201);
    return {
      user: {
        id: issued.user.id,
        handle: issued.user.handle,
        displayName: issued.user.displayName,
        email: issued.user.email,
      },
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      ...(issued.devEmailToken ? { devEmailToken: issued.devEmailToken } : {}),
    };
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationProblem(parsed.error.issues, "Login failed schema validation.");
    }
    const identifier = parsed.data.identifier.trim().toLowerCase();
    loginLimiter.check(`login:${identifier}:${request.ip}`);
    const issued = await service.login(parsed.data, toContext(request));
    reply.header("set-cookie", sessionCookie(issued.token, options.secureCookies));
    return {
      user: {
        id: issued.user.id,
        handle: issued.user.handle,
        displayName: issued.user.displayName,
        email: issued.user.email,
      },
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
    };
  });

  app.post(
    "/api/v1/auth/logout",
    { preHandler: (request) => app.authenticate(request) },
    async (request, reply) => {
      const auth = request.auth;
      if (auth) {
        await service.logout(auth.session, toContext(request));
      }
      reply.header("set-cookie", clearedSessionCookie(options.secureCookies));
      reply.status(204);
      return null;
    },
  );

  app.get(
    "/api/v1/auth/me",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const auth = request.auth;
      if (!auth) return { user: null };
      return {
        user: {
          id: auth.user.id,
          handle: auth.user.handle,
          displayName: auth.user.displayName,
          email: auth.user.email,
        },
        session: {
          id: auth.session.id,
          expiresAt: auth.session.expiresAt.toISOString(),
        },
      };
    },
  );
};
