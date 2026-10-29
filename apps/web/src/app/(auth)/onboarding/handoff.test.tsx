import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/modules/auth/auth-context";

import AppGroupLayout from "../../(app)/layout";
import OnboardingPage from "./page";

const replace = vi.fn();
const stableRouter = { replace, push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
let currentPath = "/onboarding";

vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => currentPath,
}));

vi.mock("@/components/shell/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

let onboardingCompleted = false;

function fakeProfile() {
  return {
    id: "user-1",
    handle: "ada",
    displayName: "Ada",
    email: null,
    timezone: "UTC",
    locale: "en",
    onboardingCompleted,
    preferences: {
      theme: "system",
      timeFormat: "24h",
      weekStart: "monday",
      planningPreference: "balanced",
      defaultPlanningView: "week",
      lifeAreaNames: ["Work"],
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
    },
    onboardingSkipped: false,
    lifeAreas: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function installFakeServer(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/users/me/onboarding") && method === "GET") {
      return json({
        completed: onboardingCompleted,
        profile: fakeProfile(),
        lifeAreaCatalog: [
          { name: "Work", color: "#4f46e5", icon: "briefcase", description: "Career and projects" },
        ],
      });
    }
    if (url.endsWith("/api/v1/users/me/onboarding")) {
      onboardingCompleted = true;
      return json(fakeProfile());
    }
    if (url.endsWith("/api/v1/users/me")) {
      return json(fakeProfile());
    }
    return json({});
  }) as unknown as typeof fetch;
}

function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function Harness(): React.ReactElement {
  return (
    <AuthProvider>
      {currentPath === "/onboarding" ? (
        <OnboardingPage />
      ) : (
        <AppGroupLayout>
          <p>Home screen</p>
        </AppGroupLayout>
      )}
    </AuthProvider>
  );
}

beforeEach(() => {
  cleanup();
  replace.mockClear();
  currentPath = "/onboarding";
  onboardingCompleted = false;
  installMatchMedia();
  installFakeServer();
});

afterEach(() => {
  cleanup();
});

describe("onboarding handoff to the home screen", () => {
  it("lands on the home screen without bouncing back to onboarding", async () => {
    const view = render(<Harness />);

    await screen.findByLabelText(/What should we call you/);
    fireEvent.change(screen.getByLabelText(/What should we call you/), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.click(screen.getByRole("button", { name: /Work/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open my OS" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/today"));
    expect(onboardingCompleted).toBe(true);

    replace.mockClear();
    currentPath = "/";
    view.rerender(<Harness />);

    await screen.findByText("Home screen");
    expect(replace).not.toHaveBeenCalledWith("/onboarding");
    expect(screen.getByTestId("app-shell")).toBeTruthy();
  }, 30000);

  it("does not spin forever when the completion request never responds", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/v1/users/me/onboarding") && method === "GET") {
        return json({
          completed: false,
          profile: fakeProfile(),
          lifeAreaCatalog: [
            { name: "Work", color: "#4f46e5", icon: "briefcase", description: "Career and projects" },
          ],
        });
      }
      if (url.endsWith("/api/v1/users/me/onboarding")) {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }
      if (url.endsWith("/api/v1/users/me")) {
        return json(fakeProfile());
      }
      return json({});
    }) as unknown as typeof fetch;

    render(<Harness />);

    await screen.findByLabelText(/What should we call you/);
    fireEvent.change(screen.getByLabelText(/What should we call you/), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: /Work/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open my OS" }));

    const alert = await screen.findByRole("alert", {}, { timeout: 25000 });
    expect(alert.textContent ?? "").toMatch(/did not respond in time/i);
    expect(replace).not.toHaveBeenCalledWith("/today");

    const retryable = await screen.findByRole("button", { name: /Open my OS/i });
    expect(retryable.hasAttribute("disabled")).toBe(false);
  }, 40000);
});