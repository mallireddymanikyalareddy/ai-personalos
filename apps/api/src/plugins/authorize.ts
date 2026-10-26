import { AppError } from "@personalos/api-contract";
import { assertCan, type Action, type Actor, type Resource } from "@personalos/core/policy";
import type { FastifyInstance, FastifyRequest } from "fastify";

export interface AuthorizeOptions {
  action: Action;
  resource: (
    request: FastifyRequest,
    auth: { userId: string; sessionId: string },
  ) => Promise<Resource> | Resource;
}

declare module "fastify" {
  interface FastifyInstance {
    authorize: (
      options: AuthorizeOptions,
    ) => (request: FastifyRequest) => Promise<void>;
  }
}

export function registerAuthorize(app: FastifyInstance): void {
  app.decorate("authorize", (options: AuthorizeOptions) => {
    return async (request: FastifyRequest): Promise<void> => {
      const auth = request.auth;
      if (!auth) {
        throw new AppError("AUTH_REQUIRED", { detail: "Authentication required." });
      }
      const actor: Actor = { kind: "user", userId: auth.user.id };
      const resource = await options.resource(request, {
        userId: auth.user.id,
        sessionId: auth.session.id,
      });
      assertCan(actor, options.action, resource);
    };
  });
}

export function selfResource(userId: string, type: string): Resource {
  return { type, ownerId: userId, scope: "private" };
}
