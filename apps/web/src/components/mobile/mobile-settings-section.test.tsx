import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { MobileSettingsSection } from "./mobile-settings-section";

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
});

afterEach(() => {
  cleanup();
});

function renderSection() {
  return render(
    <ToastProvider>
      <MobileSettingsSection />
    </ToastProvider>,
  );
}

describe("MobileSettingsSection", () => {
  it("persists device reminder preferences and quiet hours", () => {
    renderSection();
    const os = getOS();

    const engine = screen.getByRole("switch", { name: "Reminder engine" });
    fireEvent.click(engine);
    expect(os.mobilePreferences().notifications.enabled).toBe(true);

    fireEvent.click(screen.getByRole("switch", { name: "Morning journal" }));
    expect(os.mobilePreferences().notifications.morningJournal).toBe(false);

    fireEvent.change(screen.getByLabelText("Quiet from"), { target: { value: "23" } });
    expect(os.mobilePreferences().notifications.quietHoursStart).toBe(23);
  });

  it("resets mobile preferences to defaults", () => {
    getOS().setOneHandedMode(true, "left");
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Reset mobile" }));

    expect(getOS().mobilePreferences().oneHanded).toBe(false);
    expect(getOS().mobilePreferences().handedness).toBe("right");
  });
});
