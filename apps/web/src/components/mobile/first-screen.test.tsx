import * as React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";
import { MobileWidgets } from "@/components/mobile/mobile-widgets";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";

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

describe("first screen after onboarding", () => {
  it("renders the mobile widget grid without crashing", async () => {
    installMatchMedia();
    const os = getOS();
    os.clearAll();
    os.hydrate();

    render(
      <ToastProvider>
        <MobileWidgets
          onNavigate={() => undefined}
          onCapture={() => undefined}
          onStartFocus={() => undefined}
          onOpenTask={() => undefined}
        />
      </ToastProvider>,
    );

    expect(await screen.findAllByText("Today")).not.toHaveLength(0);
    expect(document.body.textContent).not.toContain("must be used within");
  });

  it("renders the bottom navigation with quick capture in the thumb zone", () => {
    installMatchMedia();
    render(
      <ToastProvider>
        <MobileBottomNav
          onCapture={() => undefined}
          onVoiceCapture={() => undefined}
          journalTodayLabel={null}
        />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: "Quick capture" })).toBeTruthy();
    expect(screen.getByLabelText("Primary")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voice capture" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More destinations" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Voice capture" })).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Inbox" })).toBeTruthy();
  });

  it("renders even when the journal has an entry that predates the tag field", () => {
    installMatchMedia();
    const os = getOS();
    os.clearAll();
    os.hydrate();
    const entry = os.addJournalEntry({ entryDate: Date.now(), body: "Reflected today." });
    os.updateJournalEntry(entry.id, { tags: undefined as never });

    expect(() =>
      render(
        <ToastProvider>
          <MobileWidgets
            onNavigate={() => undefined}
            onCapture={() => undefined}
            onStartFocus={() => undefined}
            onOpenTask={() => undefined}
          />
        </ToastProvider>,
      ),
    ).not.toThrow();
  });
});
