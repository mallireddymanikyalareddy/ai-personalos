import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { IntegrationsModule, integrationNavigation } from "./integrations-module";

const catalog = vi.fn(() =>
  Promise.resolve({
    items: [
      {
        id: "google_calendar",
        kind: "calendar",
        label: "Google Calendar",
        detail: "Two-way sync of events.",
        authType: "oauth2_pkce",
        status: "live" as const,
        scopes: [],
        connectUrl: "/api/v1/integrations/google_calendar/begin",
        docsUrl: null,
        capabilities: [
          { id: "calendar_events_read", label: "Read events", detail: "Pull events.", supported: true },
          { id: "calendar_events_write", label: "Create and update events", detail: "Push.", supported: false },
        ],
      },
      {
        id: "google_drive",
        kind: "files",
        label: "Google Drive",
        detail: "Read files.",
        authType: "oauth2_pkce",
        status: "live" as const,
        scopes: [],
        connectUrl: "/api/v1/integrations/google_drive/begin",
        docsUrl: null,
        capabilities: [{ id: "files_read", label: "Read files", detail: "Import.", supported: true }],
      },
      {
        id: "notion",
        kind: "notes",
        label: "Notion",
        detail: "Bring pages in.",
        authType: "oauth2",
        status: "preparing" as const,
        scopes: [],
        connectUrl: "/api/v1/integrations/notion/begin",
        docsUrl: null,
        capabilities: [{ id: "pages_read", label: "Read pages", detail: "Import.", supported: false }],
      },
    ],
  }),
);

const begin = vi.fn((providerId: string, returnTo: string) =>
  Promise.resolve({
    providerId,
    returnTo,
    authorizeUrl: "https://provider.example.com/authorize",
    state: "state-1",
  }),
);

const pull = vi.fn((providerId: string, credentialRef: string, importRangeDays: number) =>
  Promise.resolve({
    providerId,
    credentialRef,
    importRangeDays,
    nextSyncToken: null,
    items: [
      {
        externalId: "ext-1",
        etag: null,
        lastModified: 1_700_000_000_000,
        payload: {
          title: "Dentist",
          startsAt: 1_700_000_100_000,
          endsAt: 1_700_000_280_000,
          allDay: false,
          notes: "",
          location: "Clinic",
          attendees: ["friend@example.com"],
        },
        deleted: false,
      },
    ],
  }),
);

const disconnect = vi.fn((providerId: string, credentialRef: string) =>
  Promise.resolve({ ok: true, providerId, credentialRef }),
);

vi.mock("@/lib/api", () => ({
  integrationApi: {
    catalog: () => catalog(),
    begin: (providerId: string, returnTo: string) => begin(providerId, returnTo),
    pull: (providerId: string, credentialRef: string, importRangeDays: number) =>
      pull(providerId, credentialRef, importRangeDays),
    refresh: () => Promise.resolve({ providerId: "google_calendar", credentialRef: "r", expiresAt: null }),
    disconnect: (providerId: string, credentialRef: string) => disconnect(providerId, credentialRef),
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
  window.history.replaceState(null, "", "/integrations");
});

function renderModule() {
  return render(
    <ToastProvider>
      <IntegrationsModule />
    </ToastProvider>,
  );
}

async function googleCard(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: "Google Calendar" });
  return heading.closest("section") as HTMLElement;
}

describe("IntegrationsModule", () => {
  it("shows the provider registry from the API catalog", async () => {
    renderModule();

    expect(await screen.findByRole("heading", { name: "Google Calendar" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Notion" })).toBeTruthy();
    expect(screen.getByText(/Two-way sync of events/)).toBeTruthy();
  });

  it("offers connect for live providers only", async () => {
    renderModule();
    const google = await googleCard();
    const notion = screen.getByRole("heading", { name: "Notion" }).closest("section") as HTMLElement;

    expect(within(google).getByRole("button", { name: "Connect" })).toBeTruthy();
    const preparing = within(notion).getByRole("button", { name: "Preparing" }) as HTMLButtonElement;
    expect(preparing.disabled).toBe(true);
  });

  it("marks unsupported capabilities so nothing is implied", async () => {
    renderModule();
    const google = await googleCard();

    expect(within(google).getByText("Read events")).toBeTruthy();
    expect(within(google).getByText("Create and update events")).toBeTruthy();
  });

  it("starts the OAuth flow when connecting", async () => {
    const go = vi.spyOn(integrationNavigation, "go").mockImplementation(() => {});

    renderModule();
    const google = await googleCard();
    fireEvent.click(within(google).getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(begin).toHaveBeenCalledWith("google_calendar", "/integrations"));
    expect(go).toHaveBeenCalledWith("https://provider.example.com/authorize");
  });

  it("finishes a connection from the OAuth redirect and cleans the URL", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    window.history.replaceState(
      null,
      "",
      "/integrations?connection=connected&provider=google_calendar&ref=vault%2Fconn-1",
    );

    renderModule();
    await waitFor(() => {
      expect(getOS().integrationFor("google_calendar")).not.toBeNull();
    });

    const integration = getOS().integrationFor("google_calendar")!;
    expect(integration.status).toBe("connected");
    expect(integration.credentialRef).toBe("vault/conn-1");
    expect(JSON.stringify(integration)).not.toContain("access_token");
    expect(replaceState).toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("imports events, maps them locally, and logs the sync", async () => {
    const os = getOS();
    os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" });

    renderModule();
    const google = await googleCard();
    fireEvent.click(within(google).getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(Object.keys(os.getState().events)).toHaveLength(1));
    const event = Object.values(os.getState().events)[0]!;
    expect(event.title).toBe("Dentist");
    expect(event.source).toBe("integration");
    expect(event.location).toBe("Clinic");
    expect(event.attendees.map((attendee) => attendee.email)).toEqual(["friend@example.com"]);

    const integration = os.integrationFor("google_calendar")!;
    expect(os.externalIdFor(integration.id, event.id)).toBe("ext-1");
    expect(os.getIntegration(integration.id)!.lastSyncAt).not.toBeNull();
    expect(os.syncLogs(integration.id)).toHaveLength(1);
    expect(await screen.findByText("Sync activity")).toBeTruthy();
    expect(await screen.findByText("Success")).toBeTruthy();
  });

  it("updates imported notes through the note store, not the event store", async () => {
    const os = getOS();
    const integration = os.connectIntegration({ provider: "google_drive", credentialRef: "vault/drive" })!;
    const note = os.addNote({ title: "Old brief", body: "Draft" });
    os.registerExternalEntity(integration.id, "file-1", note.id);
    pull.mockImplementationOnce(() =>
      Promise.resolve({
        providerId: "google_drive",

        credentialRef: "vault/drive",
        importRangeDays: 30,
        nextSyncToken: null,
        items: [
          {
            externalId: "file-1",
            etag: null,
            lastModified: Date.now() + 60_000,
            deleted: false,
            payload: {
              title: "New brief",
              mimeType: "application/pdf",
              size: 2048,
              webViewLink: "https://drive.google.com/file/d/file-1",
            },
          },
        ],
      }) as never,
    );

    renderModule();
    const drive = (await screen.findByRole("heading", { name: "Google Drive" })).closest("section") as HTMLElement;
    fireEvent.click(within(drive).getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(os.getState().notes[note.id]?.title).toBe("New brief"));
    expect(os.getState().events[note.id]).toBeUndefined();
  });

  it("keeps local data intact when the sync fails", async () => {
    const os = getOS();
    os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" });
    pull.mockImplementationOnce(() => Promise.reject(new Error("Provider offline")));

    renderModule();
    const google = await googleCard();
    fireEvent.click(within(google).getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(Object.keys(os.getState().syncLogs)).toHaveLength(1));
    expect(Object.keys(os.getState().events)).toHaveLength(0);
    const integration = os.integrationFor("google_calendar")!;
    expect(integration.status).toBe("error");
    expect(integration.lastError).toBe("Provider offline");
  });

  it("applies the provider version when taking theirs", async () => {
    const os = getOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" })!;
    const event = os.addEvent({ title: "Dentist", startsAt: 1_700_000_100_000, endsAt: 1_700_000_280_000 });
    os.registerExternalEntity(integration.id, "ext-9", event.id);
    os.addSyncConflict({
      integrationId: integration.id,
      entityType: "event",
      entityId: event.id,
      externalId: "ext-9",
      kind: "event_time",
      localValue: { title: "Dentist", startsAt: 1_700_000_100_000 },
      remoteValue: { title: "Dentist (moved)", startsAt: 1_700_000_400_000 },
      reason: "Both copies changed since the last sync.",
    });

    renderModule();
    fireEvent.click((await screen.findAllByRole("button", { name: "Take theirs" }))[0]!);

    await waitFor(() => expect(os.getState().events[event.id]?.title).toBe("Dentist (moved)"));
  });

  it("does not surface conflicts for a disconnected provider", async () => {
    const os = getOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" })!;
    const event = os.addEvent({ title: "Dentist", startsAt: 1_700_000_100_000, endsAt: 1_700_000_280_000 });
    os.registerExternalEntity(integration.id, "ext-9", event.id);
    os.addSyncConflict({
      integrationId: integration.id,
      entityType: "event",
      entityId: event.id,
      externalId: "ext-9",
      kind: "event_time",
      localValue: { title: "Dentist" },
      remoteValue: { title: "Dentist", startsAt: 1_700_000_400_000 },
      reason: "Both copies changed since the last sync.",
    });
    os.disconnectIntegration(integration.id);

    renderModule();
    await googleCard();

    expect(screen.queryByText("Changes to resolve")).toBeNull();
    expect(screen.queryByRole("button", { name: "Keep mine" })).toBeNull();
  });

  it("offers reconnect and saves target and auto-sync settings", async () => {
    const os = getOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" })!;
    const calendar = os.addCalendar({ name: "Work" });
    os.recordIntegrationError(integration.id, "Token expired");

    renderModule();
    const google = await googleCard();

    expect(within(google).getByRole("button", { name: "Reconnect" })).toBeTruthy();
    expect(within(google).getByText("Token expired")).toBeTruthy();

    fireEvent.change(within(google).getByLabelText("Target calendar"), { target: { value: calendar.id } });
    expect(os.getIntegration(integration.id)!.settings.targetCalendarId).toBe(calendar.id);

    const autoSync = within(google).getByRole("switch", { name: "Auto-sync" });
    fireEvent.click(autoSync);
    expect(os.getIntegration(integration.id)!.settings.autoSync).toBe(false);
  });

  it("disconnects locally once the server revokes the credential", async () => {
    const os = getOS();
    os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" });

    renderModule();
    const google = await googleCard();
    fireEvent.click(within(google).getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(disconnect).toHaveBeenCalledWith("google_calendar", "vault/conn-1"));
    const integration = os.integrationFor("google_calendar")!;
    expect(integration.status).toBe("disconnected");
    expect(integration.credentialRef).toBeNull();
  });

  it("resolves a pending conflict from the conflict list", async () => {
    const os = getOS();
    const integration = os.connectIntegration({ provider: "google_calendar", credentialRef: "vault/conn-1" })!;
    const event = os.addEvent({ title: "Dentist", startsAt: 1_700_000_100_000, endsAt: 1_700_000_280_000 });
    os.registerExternalEntity(integration.id, "ext-9", event.id);
    os.addSyncConflict({
      integrationId: integration.id,
      entityType: "event",
      entityId: event.id,
      externalId: "ext-9",
      kind: "event_time",
      localValue: { title: "Dentist", startsAt: 1_700_000_100_000 },
      remoteValue: { title: "Dentist", startsAt: 1_700_000_400_000 },
      reason: "Both copies changed since the last sync.",
    });

    renderModule();
    const keepMine = (await screen.findAllByRole("button", { name: "Keep mine" }))[0]!;
    fireEvent.click(keepMine);

    await waitFor(() =>
      expect(Object.values(os.getState().syncConflicts).every((conflict) => conflict.status === "resolved")).toBe(true),
    );
  });
});
