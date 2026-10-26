import { describe, expect, it } from "vitest";
import { AppError } from "@personalos/api-contract/errors";

import {
  ACTIONS,
  assertCan,
  can,
  isAllowed,
  type Action,
  type Actor,
  type Resource,
  type Scope,
  type WorkspaceRole,
} from "./policy";

const USER_A = "user-a";
const USER_B = "user-b";

function user(role?: WorkspaceRole, userId = USER_A): Actor {
  return { kind: "user", userId, workspaceRole: role };
}

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: "res-1",
    type: "tasks",
    ownerId: USER_A,
    workspaceId: "ws-1",
    scope: "workspace",
    ...overrides,
  };
}

function rules(actor: Actor, res: Resource): Record<Action, string> {
  const out = {} as Record<Action, string>;
  for (const action of ACTIONS) {
    out[action] = can(actor, action, res).rule;
  }
  return out;
}

describe("system and support actors", () => {
  it("system is allowed everything", () => {
    const actor: Actor = { kind: "system" };
    for (const action of ACTIONS) {
      expect(can(actor, action, resource({ scope: "private" }))).toEqual({
        allowed: true,
        rule: "system",
      });
    }
  });

  it("support is read-only", () => {
    const actor: Actor = { kind: "support" };
    expect(can(actor, "read", resource()).allowed).toBe(true);
    for (const action of ACTIONS.filter((a) => a !== "read")) {
      expect(can(actor, action, resource())).toEqual({
        allowed: false,
        rule: "support-read-only",
      });
    }
  });
});

describe("workspace owner and admin", () => {
  it("owner allows every action on any scope", () => {
    const owner = user("owner");
    const scopes: Scope[] = ["private", "workspace", "team", "link"];
    for (const scope of scopes) {
      const res = resource({ scope, ownerId: USER_B });
      for (const action of ACTIONS) {
        expect(can(owner, action, res)).toEqual({ allowed: true, rule: "workspace-owner" });
      }
    }
  });

  it("admin reads, creates, updates, shares, exports anywhere", () => {
    const admin = user("admin");
    const foreign = resource({ ownerId: USER_B, scope: "private" });
    expect(rules(admin, foreign)).toMatchObject({
      read: "workspace-admin",
      create: "workspace-admin",
      update: "workspace-admin",
      share: "workspace-admin",
      export: "workspace-admin",
    });
  });

  it("admin cannot delete or restore foreign content", () => {
    const admin = user("admin");
    const foreign = resource({ ownerId: USER_B });
    expect(can(admin, "delete", foreign)).toEqual({
      allowed: false,
      rule: "admin-foreign-content",
    });
    expect(can(admin, "restore", foreign).allowed).toBe(false);
    const own = resource({ ownerId: USER_A });
    expect(can(admin, "delete", own)).toEqual({
      allowed: true,
      rule: "admin-own-content",
    });
  });
});

describe("member matrix", () => {
  const member = user("member");

  it("reads own everything plus any non-private scope", () => {
    expect(can(member, "read", resource({ scope: "private", ownerId: USER_A })).allowed).toBe(
      true,
    );
    for (const scope of ["workspace", "team", "link"] as Scope[]) {
      expect(
        can(member, "read", resource({ scope, ownerId: USER_B })).allowed,
      ).toBe(true);
    }
  });

  it("never reads foreign private", () => {
    expect(can(member, "read", resource({ scope: "private", ownerId: USER_B }))).toEqual({
      allowed: false,
      rule: "member-foreign-private",
    });
  });

  it("creates anywhere in the workspace but only edits own content", () => {
    const own = resource({ ownerId: USER_A });
    const foreign = resource({ ownerId: USER_B });
    expect(can(member, "create", foreign).allowed).toBe(true);
    for (const action of ["update", "delete", "restore"] as Action[]) {
      expect(can(member, action, own)).toEqual({
        allowed: true,
        rule: "member-own-content",
      });
      expect(can(member, action, foreign)).toEqual({
        allowed: false,
        rule: "member-foreign-content",
      });
    }
  });

  it("never shares or exports at the resource level", () => {
    expect(can(member, "share", resource({ ownerId: USER_A }))).toEqual({
      allowed: false,
      rule: "member-no-share",
    });
    expect(can(member, "export", resource({ ownerId: USER_A }))).toEqual({
      allowed: false,
      rule: "member-no-export",
    });
  });
});

describe("member without a workspace role", () => {
  const stranger = user(undefined, USER_B);

  it("defaults to deny except for own content", () => {
    expect(rules(stranger, resource({ ownerId: USER_B }))).toEqual({
      read: "owner-without-role",
      create: "no-membership",
      update: "owner-without-role",
      delete: "owner-without-role",
      restore: "owner-without-role",
      share: "no-membership",
      export: "no-membership",
    });
    expect(stranger.userId).toBeDefined();
    expect(can(stranger, "read", resource({ ownerId: USER_A })).allowed).toBe(false);
    expect(can(stranger, "create", resource({ ownerId: USER_A })).allowed).toBe(false);
  });
});

describe("ai actor", () => {
  const ai: Actor = { kind: "ai", contextRefIds: ["note-42"] };

  it("reads only entities in its explicit refs", () => {
    expect(can(ai, "read", resource({ id: "note-42" }))).toEqual({
      allowed: true,
      rule: "ai-ref-read",
    });
    expect(can(ai, "read", resource({ id: "note-43" }))).toEqual({
      allowed: false,
      rule: "ai-refs-only",
    });
    expect(can(ai, "read", resource({ id: undefined })).allowed).toBe(false);
  });

  it("writes only AI-owned types", () => {
    expect(can(ai, "create", resource({ type: "aiInsights", id: undefined })).allowed).toBe(
      true,
    );
    expect(can(ai, "update", resource({ type: "aiMessages" })).allowed).toBe(true);
    expect(can(ai, "create", resource({ type: "tasks", id: undefined }))).toEqual({
      allowed: false,
      rule: "ai-writable-type",
    });
    expect(can(ai, "update", resource({ type: "tasks" })).allowed).toBe(false);
  });

  it("never deletes, shares, restores, or exports", () => {
    for (const action of ["delete", "restore", "share", "export"] as Action[]) {
      expect(can(ai, action, resource({ type: "aiMessages" })).allowed).toBe(false);
    }
  });
});

describe("guest actor", () => {
  const guest: Actor = { kind: "guest" };

  it("reads link-scoped resources only", () => {
    expect(can(guest, "read", resource({ scope: "link" }))).toEqual({
      allowed: true,
      rule: "guest-link-read",
    });
    expect(can(guest, "read", resource({ scope: "workspace" })).allowed).toBe(false);
  });

  it("is read-only", () => {
    for (const action of ACTIONS.filter((a) => a !== "read")) {
      expect(can(guest, action, resource({ scope: "link" }))).toEqual({
        allowed: false,
        rule: "guest-read-only",
      });
    }
  });
});

describe("assertCan", () => {
  it("returns the decision when allowed", () => {
    const decision = assertCan(user("owner"), "delete", resource());
    expect(decision.allowed).toBe(true);
  });

  it("throws a 403 POLICY_DENIED AppError when denied", () => {
    try {
      assertCan(user("member"), "share", resource());
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("POLICY_DENIED");
      expect(appError.status).toBe(403);
      expect(appError.detail).toContain("member-no-share");
    }
  });
});

describe("decision helpers", () => {
  it("isAllowed mirrors allowed", () => {
    expect(isAllowed(can({ kind: "system" }, "read", resource()))).toBe(true);
    expect(isAllowed(can({ kind: "guest" }, "read", resource()))).toBe(false);
  });

  it("every actor and action yields a decision with a stable rule", () => {
    const actors: Actor[] = [
      { kind: "system" },
      { kind: "support" },
      { kind: "ai" },
      { kind: "guest" },
      user("owner"),
      user("admin"),
      user("member"),
      user(undefined, USER_B),
    ];
    const scopes: Scope[] = ["private", "workspace", "team", "link"];
    for (const actor of actors) {
      for (const scope of scopes) {
        for (const action of ACTIONS) {
          const decision = can(actor, action, resource({ scope, ownerId: USER_B }));
          expect(decision.rule).toBeTypeOf("string");
          expect(decision.rule.length).toBeGreaterThan(0);
          expect(typeof decision.allowed).toBe("boolean");
        }
      }
    }
  });
});
