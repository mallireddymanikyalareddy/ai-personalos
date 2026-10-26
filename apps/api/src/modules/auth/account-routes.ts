import { AppError } from "@personalos/api-contract";
import {
  passwordChangeSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  verifyEmailConfirmSchema,
  type OnboardingInput,
  type ProfilePatch,
} from "@personalos/api-contract/account";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { toContext, validationProblem } from "./http";
import { createRateLimiter } from "./rate-limit";
import { toProfileResponse, type ProfileService } from "./profile";
import type { AuthService } from "./service";
import type { SessionService } from "./sessions";

export interface AccountRoutesDeps {
  auth: AuthService;
  profile: ProfileService;
  sessions: SessionService;
}

const idParamsSchema = z.object({ id: z.string().uuid() });

function requireAuth(request: FastifyRequest): {
  userId: string;
  sessionId: string;
} {
  const auth = request.auth;
  if (!auth) {
    throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
  }
  return { userId: auth.user.id, sessionId: auth.session.id };
}

export const accountRoutes: FastifyPluginAsync<AccountRoutesDeps> = async (app, deps) => {
  const { auth, profile, sessions } = deps;
  const resetRequestLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
  const resetConfirmLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });
  const verifyLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
  const passwordChangeLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

  app.get(
    "/api/v1/users/me",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const { userId } = requireAuth(request);
      return profile.getProfile(userId);
    },
  );

  app.patch(
    "/api/v1/users/me",
    {
      preHandler: [
        (request) => app.authenticate(request),
        app.authorize({
          action: "update",
          resource: (_request, session) => ({
            type: "user_profile",
            ownerId: session.userId,
            scope: "private",
          }),
        }),
      ],
    },
    async (request) => {
      const { userId } = requireAuth(request);
      const user = await auth.getUser(userId);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
      }
      const body = (request.body ?? {}) as Record<string, unknown>;
      return profile.patchProfile(user, body as ProfilePatch, toContext(request));
    },
  );

  app.get(
    "/api/v1/users/me/onboarding",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const { userId } = requireAuth(request);
      const user = await auth.getUser(userId);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
      }
      return profile.onboardingState(user);
    },
  );

  app.post(
    "/api/v1/users/me/onboarding",
    {
      preHandler: [
        (request) => app.authenticate(request),
        app.authorize({
          action: "update",
          resource: (_request, session) => ({
            type: "user_profile",
            ownerId: session.userId,
            scope: "private",
          }),
        }),
      ],
    },
    async (request) => {
      const { userId } = requireAuth(request);
      const user = await auth.getUser(userId);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
      }
      const body = (request.body ?? {}) as Record<string, unknown>;
      return profile.completeOnboarding(user, body as OnboardingInput, toContext(request));
    },
  );

  app.post("/api/v1/auth/password-reset/request", async (request, reply) => {
    const parsed = passwordResetRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationProblem(parsed.error.issues, "Password reset failed schema validation.");
    }
    const identifier = parsed.data.identifier.trim().toLowerCase();
    resetRequestLimiter.check(`pwreset:${identifier}:${request.ip}`);
    const result = await auth.requestPasswordReset(identifier, toContext(request));
    reply.status(202);
    return { status: "accepted", ...(result.devToken ? { devToken: result.devToken } : {}) };
  });

  app.post("/api/v1/auth/password-reset/confirm", async (request, reply) => {
    resetConfirmLimiter.check(`pwreset-confirm:${request.ip}`);
    const parsed = passwordResetConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationProblem(parsed.error.issues, "Password reset failed schema validation.");
    }
    await auth.confirmPasswordReset(parsed.data.token, parsed.data.password, toContext(request));
    reply.status(204);
    return null;
  });

  app.post(
    "/api/v1/auth/verify-email/request",
    { preHandler: (request) => app.authenticate(request) },
    async (request, reply) => {
      const { userId } = requireAuth(request);
      verifyLimiter.check(`verify:${userId}`);
      const result = await auth.requestEmailVerification(userId, toContext(request));
      reply.status(202);
      return { status: "accepted", ...(result.devToken ? { devToken: result.devToken } : {}) };
    },
  );

  app.post("/api/v1/auth/verify-email/confirm", async (request) => {
    verifyLimiter.check(`verify-confirm:${request.ip}`);
    const parsed = verifyEmailConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationProblem(parsed.error.issues, "Verification failed schema validation.");
    }
    const user = await auth.confirmEmailVerification(parsed.data.token, toContext(request));
    return toProfileResponse(user);
  });

  app.post(
    "/api/v1/auth/password",
    { preHandler: (request) => app.authenticate(request) },
    async (request, reply) => {
      const { userId, sessionId } = requireAuth(request);
      passwordChangeLimiter.check(`pwchange:${userId}`);
      const parsed = passwordChangeSchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationProblem(parsed.error.issues, "Password change failed schema validation.");
      }
      await auth.changePassword(userId, parsed.data, { keepSessionId: sessionId }, toContext(request));
      reply.status(204);
      return null;
    },
  );

  app.get(
    "/api/v1/auth/sessions",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const { userId, sessionId } = requireAuth(request);
      return { items: await sessions.listSessions(userId, sessionId) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/auth/sessions/:id",
    {
      preHandler: [
        (request) => app.authenticate(request),
        app.authorize({
          action: "delete",
          resource: async (request) => {
            const params = request.params as { id: string };
            const parsed = idParamsSchema.safeParse(params);
            if (!parsed.success) {
              throw new AppError("NOT_FOUND", { detail: "Session not found." });
            }
            const ownership = await sessions.getSessionOwnership(parsed.data.id);
            if (!ownership) {
              throw new AppError("NOT_FOUND", { detail: "Session not found." });
            }
            return { type: "session", ownerId: ownership.ownerId, scope: "private" };
          },
        }),
      ],
    },
    async (request, reply) => {
      const { userId } = requireAuth(request);
      await sessions.revokeSession(userId, request.params.id, toContext(request));
      reply.status(204);
      return null;
    },
  );

  app.post(
    "/api/v1/auth/sessions/revoke-others",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const { userId, sessionId } = requireAuth(request);
      return sessions.revokeOtherSessions(userId, sessionId, toContext(request));
    },
  );

  app.get(
    "/api/v1/auth/devices",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const { userId } = requireAuth(request);
      return { items: await sessions.listDevices(userId) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/auth/devices/:id",
    {
      preHandler: [
        (request) => app.authenticate(request),
        app.authorize({
          action: "delete",
          resource: async (request) => {
            const params = request.params as { id: string };
            const parsed = idParamsSchema.safeParse(params);
            if (!parsed.success) {
              throw new AppError("NOT_FOUND", { detail: "Device not found." });
            }
            const ownership = await sessions.getDeviceOwnership(parsed.data.id);
            if (!ownership) {
              throw new AppError("NOT_FOUND", { detail: "Device not found." });
            }
            return { type: "device", ownerId: ownership.ownerId, scope: "private" };
          },
        }),
      ],
    },
    async (request, reply) => {
      const { userId } = requireAuth(request);
      await sessions.revokeDevice(userId, request.params.id, toContext(request));
      reply.status(204);
      return null;
    },
  );
};
