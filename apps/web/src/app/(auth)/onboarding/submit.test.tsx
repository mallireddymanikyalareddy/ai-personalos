import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPage from "./page";

const replace = vi.fn();
const push = vi.fn();
const stableRouter = { replace, push, back: vi.fn(), prefetch: vi.fn() };
const refresh = vi.fn(() => Promise.resolve());

let onboardingCompleted = false;
let completeOnboardingImpl: () => Promise<unknown> = () => Promise.resolve({ onboardingCompleted: true });

vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
}));

vi.mock("@/modules/auth/auth-context", () => ({
  useAuth: () => ({ status: "authenticated", profile: null, refresh }),
}));

vi.mock("@/lib/api", () => ({
  accountApi: {
    onboardingState: () =>
      Promise.resolve({
        completed: onboardingCompleted,
        profile: { displayName: "", timezone: "UTC", locale: "en" },
        lifeAreaCatalog: [
          { name: "Work", color: "#4f46e5", icon: "briefcase", description: "Career and projects" },
          { name: "Health", color: "#e11d48", icon: "heart-pulse", description: "Fitness and sleep" },
        ],
      }),
    completeOnboarding: () => completeOnboardingImpl(),
  },
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : "Something went wrong."),
  isNetworkFailure: () => false,
}));

function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia,
  });
}

async function fillSteps() {
  await screen.findByLabelText(/What should we call you/);
  fireEvent.change(screen.getByLabelText(/What should we call you/), { target: { value: "Ada" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  fireEvent.click(screen.getByRole("button", { name: /Work/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findByRole("button", { name: "Open my OS" });
}

beforeEach(() => {
  cleanup();
  replace.mockClear();
  refresh.mockClear();
  onboardingCompleted = false;
  completeOnboardingImpl = () => Promise.resolve({ onboardingCompleted: true });
  installMatchMedia();
  window.history.replaceState(null, "", "/onboarding");
});

afterEach(() => {
  cleanup();
});

describe("onboarding completion", () => {
  it("shows the last step with the Open my OS action", async () => {
    render(<OnboardingPage />);
    await fillSteps();
    expect(screen.getByRole("button", { name: "Open my OS" })).toBeTruthy();
  });

  it("moves to the home screen when Open my OS is clicked", async () => {
    const completeSpy = vi.fn(() => Promise.resolve({ onboardingCompleted: true }));
    completeOnboardingImpl = completeSpy;
    render(<OnboardingPage />);
    await fillSteps();

    fireEvent.click(screen.getByRole("button", { name: "Open my OS" }));

    await waitFor(() => expect(completeSpy).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/today"));
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces a failure instead of hanging forever", async () => {
    completeOnboardingImpl = () => Promise.reject(new Error("Onboarding failed."));
    render(<OnboardingPage />);
    await fillSteps();

    fireEvent.click(screen.getByRole("button", { name: "Open my OS" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(replace).not.toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Open my OS" })).toBeTruthy();
  });
});
