import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/modules/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    prefetch: () => undefined,
  }),
  usePathname: () => "/",
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
  const value = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: value as unknown as typeof window.matchMedia,
  });
}

afterEach(cleanup);

describe("AppShell", () => {
  it("renders the full shell with every consumer inside its providers", async () => {
    installMatchMedia();
    const { container } = render(
      <ToastProvider>
        <AuthProvider>
          <AppShell>
            <div data-testid="page">page content</div>
          </AppShell>
        </AuthProvider>
      </ToastProvider>,
    );

    expect(await screen.findAllByText("Today")).not.toHaveLength(0);
    expect(screen.getByTestId("page")).toBeTruthy();
    expect(container.textContent).not.toContain("must be used within");
    expect(container.textContent).not.toContain("Application error");
  });

  it("shows the same global header on every page", async () => {
    installMatchMedia();
    render(
      <ToastProvider>
        <AuthProvider>
          <AppShell>
            <div data-testid="page">page content</div>
          </AppShell>
        </AuthProvider>
      </ToastProvider>,
    );

    expect((await screen.findAllByRole("button", { name: /Search anything/i })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Capture/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Notifications/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("radiogroup", { name: "Mode" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /settings/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("navigation", { name: "Primary" })).toHaveLength(1);
    expect(screen.getByTestId("top-bar").className).toContain("pt-[env(safe-area-inset-top)]");
  });
});
