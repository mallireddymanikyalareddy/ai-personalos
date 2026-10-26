import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOS } from "@/store/os";

import { LandingPage } from "./landing-page";

const auth = vi.hoisted(() => ({
  profile: {
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
    preferences: {},
  },
}));

vi.mock("@/modules/auth/auth-context", () => ({
  useAuth: () => ({
    status: "authenticated",
    profile: auth.profile,
    refresh: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/components/shell/top-bar", () => ({
  ThemeToggle: () => null,
}));

vi.mock("next/link", async () => {
  const ReactMod = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href?: unknown;
      children?: React.ReactNode;
    } & Record<string, unknown>) =>
      ReactMod.createElement(
        "a",
        { ...rest, href: typeof href === "string" ? href : "#" },
        children,
      ),
  };
});

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

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
  installMatchMedia();
});

afterEach(cleanup);

describe("LandingPage", () => {
  it("renders the pricing and resources anchors used by the navigation", () => {
    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: /Simple pricing/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Resources to/i })).toBeDefined();
    expect(document.getElementById("pricing")).not.toBeNull();
    expect(document.getElementById("resources")).not.toBeNull();
  });

  it("uses a working feature link and opens the app when signed in", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: "Explore Features" }).getAttribute("href")).toBe("#features");
    expect(screen.getAllByRole("link", { name: /Open LifeOS/i }).length).toBeGreaterThan(0);
  });
});
