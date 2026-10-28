import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import SettingsPage from "./page";

const mock = vi.hoisted(() => {
  const profile = {
    id: "user-1",
    handle: "ada",
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    timezone: "Europe/London",
    locale: "en",
    avatarUrl: null,
    createdAt: "2025-01-01T10:00:00.000Z",
    onboardingCompleted: true,
    preferences: {
      theme: "system",
      weekStart: "monday",
      timeFormat: "24h",
      defaultPlanningView: "week",
      planningPreference: "morning",
      workingHours: {
        enabled: true,
        days: [1, 2, 3, 4, 5],
        start: "09:00",
        end: "17:00",
      },
      sleepSchedule: { bedtime: "23:00", wakeTime: "07:00" },
      ai: { tone: "balanced", proactivity: "suggest", model: "default" },
      notifications: {
        emailDigest: "daily",
        dailyBriefing: true,
        taskReminders: true,
        aiInsights: true,
        creditAlerts: true,
        quietHours: { enabled: true, start: "22:00", end: "07:00" },
      },
      primaryLifeAreaIds: [],
    },
  };

  return {
    profile,
    status: "authenticated" as "authenticated" | "offline",
    patchProfile: vi.fn(),
    refresh: vi.fn(),
    sessions: vi.fn(),
    devices: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
    revokeDevice: vi.fn(),
    changePassword: vi.fn(),
    requestEmailVerification: vi.fn(),
    requestPasswordReset: vi.fn(),
  };
});

vi.mock("@/lib/api", () => ({
  accountApi: {
    profile: () => Promise.resolve(mock.profile),
    patchProfile: (patch: unknown) => mock.patchProfile(patch),
    sessions: () => mock.sessions(),
    devices: () => mock.devices(),
    revokeSession: (id: string) => mock.revokeSession(id),
    revokeOtherSessions: () => mock.revokeOtherSessions(),
    revokeDevice: (id: string) => mock.revokeDevice(id),
    changePassword: (input: unknown) => mock.changePassword(input),
    requestEmailVerification: () => mock.requestEmailVerification(),
    requestPasswordReset: (identifier: string) => mock.requestPasswordReset(identifier),
  },
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : "Something went wrong."),
  fieldError: () => undefined,
}));

vi.mock("@/modules/auth/auth-context", () => ({
  useAuth: () => ({
    status: mock.status,
    profile: mock.profile,
    refresh: mock.refresh,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mock.status = "authenticated";
  mock.refresh.mockResolvedValue(undefined);
  mock.patchProfile.mockImplementation(async (patch: Record<string, unknown>) => ({
    ...mock.profile,
    ...patch,
    preferences: {
      ...mock.profile.preferences,
      ...((patch.preferences as Record<string, unknown> | undefined) ?? {}),
    },
  }));
  mock.sessions.mockResolvedValue({
    items: [
      {
        id: "session-1",
        ip: "127.0.0.1",
        userAgent: "Chrome",
        deviceName: "Chrome on Mac",
        platform: "macOS",
        createdAt: "2025-01-01T10:00:00.000Z",
        lastSeenAt: "2025-01-02T10:00:00.000Z",
        current: true,
      },
    ],
  });
  mock.devices.mockResolvedValue({
    items: [
      {
        id: "device-1",
        name: "MacBook",
        platform: "macOS",
        lastSeenAt: "2025-01-02T10:00:00.000Z",
        revokedAt: null,
        activeSessions: 1,
      },
    ],
  });
  mock.revokeSession.mockResolvedValue(undefined);
  mock.revokeOtherSessions.mockResolvedValue({ revoked: 0 });
  mock.revokeDevice.mockResolvedValue(undefined);
  mock.changePassword.mockResolvedValue(undefined);
  mock.requestEmailVerification.mockResolvedValue({ status: "accepted" });
  mock.requestPasswordReset.mockResolvedValue({ status: "accepted" });

  getOS().clearAll();
  getOS().hydrate();
  window.history.replaceState(null, "", "/settings");
});

function renderPage() {
  return render(
    <ToastProvider>
      <SettingsPage />
    </ToastProvider>,
  );
}

describe("SettingsPage", () => {
  it("deep-links to a section and keeps the tab in the URL", async () => {
    window.history.replaceState(null, "", "/settings?tab=appearance");
    renderPage();

    expect(await screen.findByRole("heading", { name: "Appearance" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Security" }));

    expect(await screen.findByRole("heading", { name: "Security" })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("security");
  });

  it("saves notification preferences optimistically and rolls back on failure", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const reminder = await screen.findByRole("switch", { name: "Task reminders" });

    fireEvent.click(reminder);
    expect(reminder.getAttribute("aria-checked")).toBe("false");
    await waitFor(() =>
      expect(mock.patchProfile).toHaveBeenCalledWith({
        preferences: expect.objectContaining({
          notifications: expect.objectContaining({ taskReminders: false }),
        }),
      }),
    );

    mock.patchProfile.mockRejectedValueOnce(new Error("Offline"));
    fireEvent.click(reminder);
    await waitFor(() => expect(reminder.getAttribute("aria-checked")).toBe("true"));
    expect((await screen.findAllByText("Offline")).length).toBeGreaterThan(0);
  });

  it("retries loading security details after a failure", async () => {
    window.history.replaceState(null, "", "/settings?tab=security");
    mock.sessions.mockRejectedValueOnce(new Error("Network down"));
    mock.devices.mockRejectedValueOnce(new Error("Network down"));

    renderPage();
    expect(await screen.findByText("Could not load security details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Chrome on Mac")).toBeTruthy();
    expect(screen.getByText(/MacBook/)).toBeTruthy();
  });

  it("confirms before clearing all local data", async () => {
    getOS().addTask({ title: "Keep me" });
    window.history.replaceState(null, "", "/settings?tab=data");
    renderPage();

    expect(await screen.findByRole("heading", { name: "Data & backups" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all data" }));

    expect(await screen.findByText("Clear all local data?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Erase everything" }));

    await waitFor(() => expect(Object.keys(getOS().getState().tasks)).toHaveLength(0));
  });

  it("saves profile changes back into local state", async () => {
    renderPage();
    const name = await screen.findByLabelText(/Display name/);
    fireEvent.change(name, { target: { value: "Ada Byron" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(getOS().getState().profile.displayName).toBe("Ada Byron"));
    expect(mock.patchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Ada Byron" }),
    );
  });

  it("shows an offline notice without hiding local data tools", async () => {
    mock.status = "offline";
    window.history.replaceState(null, "", "/settings?tab=data");
    renderPage();

    expect(await screen.findByText("Working offline")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export backup" })).toBeTruthy();
  });
});
