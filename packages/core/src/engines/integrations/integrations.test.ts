import { describe, expect, it } from "vitest";
import { PersonalOS } from "../../os";
import { createMemoryStorage } from "../../store/persistence";
import { INTEGRATION_PROVIDERS, PROVIDER_BY_ID, createIntegration, createSyncLog } from "../../types/integration";
import { supportsDirection } from "./adapter";

function makeOS(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

describe("Integrations: provider registry", () => {
  it("ships calendar and file providers as live, others as preparing", () => {
    const live = INTEGRATION_PROVIDERS.filter((p) => p.status === "live").map((p) => p.id);
    const preparing = INTEGRATION_PROVIDERS.filter((p) => p.status === "preparing").map((p) => p.id);

    expect(live).toEqual(["google_calendar", "outlook_calendar", "google_drive"]);
    expect(preparing).toContain("icloud_calendar");
    expect(preparing).toContain("dropbox");
    expect(preparing).toContain("onedrive");
    expect(preparing).toContain("notion");
    expect(preparing).toContain("slack");
  });

  it("never declares a password-based auth type", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      expect(provider.authType).not.toBe("api_key" as never);
      expect(["oauth2", "oauth2_pkce"]).toContain(provider.authType);
    }
  });

  it("every live provider declares its OAuth endpoints", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      if (provider.status === "live") {
        expect(provider.oauth?.authorizeUrl).toBeTruthy();
        expect(provider.oauth?.tokenUrl).toBeTruthy();
      }
    }
  });

  it("preparing providers list only unsupported capabilities", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      if (provider.status === "preparing") {
        expect(provider.capabilities.every((capability) => !capability.supported)).toBe(true);
      }
    }
  });

  it("live providers list at least one supported capability", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      if (provider.status === "live") {
        expect(provider.capabilities.some((capability) => capability.supported)).toBe(true);
      }
    }
  });
});

describe("Integrations: connect, disconnect, reauthorize", () => {
  it("connects with a vault reference instead of a token", () => {
    const os = makeOS();
    const integration = os.connectIntegration({
      provider: "google_calendar",
      credentialRef: "vault/local/google_calendar/nonce-1",
      externalAccountId: "ext-1",
    })!;

    expect(integration.status).toBe("connected");
    expect(integration.credentialRef).toBe("vault/local/google_calendar/nonce-1");
    expect(integration.kind).toBe("calendar");
    expect(integration.connectedAt).not.toBeNull();

    const stored = os.integrationFor("google_calendar")!;
    expect(stored.credentialRef).toBe("vault/local/google_calendar/nonce-1");
    expect("accessToken" in stored).toBe(false);
  });

  it("refuses unknown providers", () => {
    const os = makeOS();
    expect(os.connectIntegration({ provider: "nope", credentialRef: "x" })).toBeNull();
    expect(os.getProvider("nope")).toBeNull();
  });

  it("disconnect keeps the record but drops credentials", () => {
    const os = makeOS();
    const integration = os.connectIntegration({
      provider: "google_calendar",
      credentialRef: "vault/ref",
    })!;

    os.disconnectIntegration(integration.id);

    const updated = os.getIntegration(integration.id)!;
    expect(updated.status).toBe("disconnected");
    expect(updated.credentialRef).toBeNull();
    expect(updated.connectedAt).toBeNull();
    expect(os.integrationFor("google_calendar")).not.toBeNull();
  });

  it("replacing a connection reuses the same record", () => {
    const os = makeOS();
    const first = os.connectIntegration({ provider: "outlook_calendar", credentialRef: "a" })!;
    const second = os.connectIntegration({ provider: "outlook_calendar", credentialRef: "b" })!;

    expect(second.id).toBe(first.id);
    expect(os.integrations().filter((i) => i.provider === "outlook_calendar")).toHaveLength(1);
    expect(second.credentialRef).toBe("b");
  });

  it("reauthorize marks the record for reconnection", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_drive", credentialRef: "r" })!;
    os.reauthorizeIntegration(integration.id);
    expect(os.getIntegration(integration.id)!.status).toBe("reauthorizing");
  });

  it("pause and resume flip the status", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_drive", credentialRef: "r" })!;

    os.pauseIntegration(integration.id);
    expect(os.getIntegration(integration.id)!.status).toBe("paused");

    os.resumeIntegration(integration.id);
    expect(os.getIntegration(integration.id)!.status).toBe("connected");
  });
});

describe("Integrations: sync status and mappings", () => {
  it("records external id mappings for both directions", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "r" })!;
    os.registerExternalEntity(integration.id, "ext-evt-1", "local-evt-1");

    expect(os.externalIdFor(integration.id, "local-evt-1")).toBe("ext-evt-1");
    expect(os.externalIdFor(integration.id, "local-evt-2")).toBeNull();
  });

  it("tracks last sync time", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "r" })!;
    expect(integration.lastSyncAt).toBeNull();

    os.updateIntegrationSync(integration.id, NOW, null);
    expect(os.getIntegration(integration.id)!.lastSyncAt).toBe(NOW);
  });

  it("records an error and moves to needs attention", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "r" })!;
    os.recordIntegrationError(integration.id, "Token expired");

    const updated = os.getIntegration(integration.id)!;
    expect(updated.status).toBe("error");
    expect(updated.lastError).toBe("Token expired");
    expect(updated.lastErrorAt).not.toBeNull();
  });

  it("settings round-trip through the manager", () => {
    const os = makeOS();
    const integration = os.connectIntegration({
      provider: "google_calendar",
      credentialRef: "r",
      direction: "bidirectional",
    })!;

    expect(integration.direction).toBe("bidirectional");
    expect(integration.settings.conflictStrategy).toBe("manual");

    os.updateIntegrationSettings(integration.id, {
      conflictStrategy: "newer_wins",
      pushBack: true,
    });
    const updated = os.getIntegration(integration.id)!;
    expect(updated.settings.conflictStrategy).toBe("newer_wins");
    expect(updated.settings.pushBack).toBe(true);
  });
});

describe("Integrations: conflicts", () => {
  it("creates and resolves a sync conflict", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "r" })!;

    const conflict = os.addSyncConflict({
      integrationId: integration.id,
      entityType: "event",
      entityId: "local-evt-1",
      externalId: "ext-1",
      kind: "event_time",
      localValue: { startsAt: 900 },
      remoteValue: { startsAt: 1200 },
      reason: "Both sides changed the start time.",
    });

    expect(os.syncConflicts(integration.id)).toHaveLength(1);

    os.resolveSyncConflict(conflict.id, "remote_wins", NOW);
    expect(os.syncConflicts(integration.id)).toHaveLength(0);
    expect(os.getState().syncConflicts[conflict.id]!.status).toBe("resolved");
  });

  it("filters conflicts by integration", () => {
    const os = makeOS();
    const a = os.connectIntegration({ provider: "google_calendar", credentialRef: "r" })!;
    const b = os.connectIntegration({ provider: "outlook_calendar", credentialRef: "r2" })!;

    os.addSyncConflict({
      integrationId: a.id,
      entityType: "event",
      entityId: "e1",
      externalId: "x1",
      kind: "event_time",
      localValue: {},
      remoteValue: {},
      reason: "Conflict A",
    });
    os.addSyncConflict({
      integrationId: b.id,
      entityType: "event",
      entityId: "e2",
      externalId: "x2",
      kind: "event_time",
      localValue: {},
      remoteValue: {},
      reason: "Conflict B",
    });

    expect(os.syncConflicts(a.id)).toHaveLength(1);
    expect(os.syncConflicts(b.id)).toHaveLength(1);
    expect(os.syncConflicts()).toHaveLength(2);
  });

  it("keeps a sync log history", () => {
    const os = makeOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "r" })!;

    const log = os.addSyncLog(
      createSyncLog(
        {
          integrationId: integration.id,
          status: "success",
          direction: "inbound",
          itemsCreated: 4,
          itemsUpdated: 1,
          itemsDeleted: 0,
          conflictsFound: 0,
          durationMs: 300,
        },
        NOW,
      ),
    );

    expect(os.syncLogs(integration.id)).toHaveLength(1);
    expect(log.status).toBe("success");
  });

  it("summarises manager state for the UI", () => {
    const os = makeOS();
    os.connectIntegration({ provider: "google_calendar", credentialRef: "r" });
    os.recordIntegrationError(os.integrationFor("google_calendar")!.id, "Token expired");
    os.addSyncConflict({
      integrationId: os.integrationFor("google_calendar")!.id,
      entityType: "event",
      entityId: "e",
      externalId: "x",
      kind: "event_time",
      localValue: {},
      remoteValue: {},
      reason: "Clash",
    });

    const summary = os.integrationSummary();
    expect(summary.connected).toBe(0);
    expect(summary.errors).toBe(1);
    expect(summary.pendingConflicts).toBe(1);
    expect(summary.providers).toHaveLength(INTEGRATION_PROVIDERS.length);
    expect(summary.providers.find((p) => p.id === "google_drive")!.status).toBe("disconnected");
  });
});

describe("Integrations: token vault abstraction", () => {
  it("the integration record never carries tokens", () => {
    const os = makeOS();
    const integration = os.connectIntegration({
      provider: "google_calendar",
      credentialRef: "vault/ref",
      scopes: ["cal.events"],
    })!;

    const serialised = JSON.stringify(integration);
    expect(serialised).not.toContain("accessToken");
    expect(serialised).not.toContain("access_token");
    expect(serialised).not.toContain("refresh_token");
    expect(serialised).toContain("credentialRef");
  });

  it("supports inbound sync for live providers and defers writes", () => {
    const google = PROVIDER_BY_ID.google_calendar!;
    const drive = PROVIDER_BY_ID.google_drive!;
    expect(supportsDirection(google, "inbound")).toBe(true);
    expect(supportsDirection(google, "outbound")).toBe(false);
    expect(supportsDirection(google, "bidirectional")).toBe(false);
    expect(supportsDirection(drive, "inbound")).toBe(true);
    expect(supportsDirection(drive, "outbound")).toBe(false);

    const notion = PROVIDER_BY_ID.notion!;
    expect(supportsDirection(notion, "inbound")).toBe(false);
    expect(supportsDirection(notion, "bidirectional")).toBe(false);
  });
});