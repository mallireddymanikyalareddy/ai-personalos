import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { ModeSwitcher, modeNavigation } from "./mode-switcher";

let os: ReturnType<typeof getOS>;

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  window.history.replaceState(null, "", "/today");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSwitcher() {
  return render(
    <ToastProvider>
      <ModeSwitcher />
    </ToastProvider>,
  );
}

describe("ModeSwitcher", () => {
  it("switches to Work mode and opens Work Mode", () => {
    const go = vi.spyOn(modeNavigation, "go").mockImplementation(() => undefined);
    renderSwitcher();

    fireEvent.click(screen.getByRole("radio", { name: "Work mode" }));

    expect(os.activeMode()).toBe("work");
    expect(go).toHaveBeenCalledWith("/workmode");
  });

  it("switches to Personal mode and opens Today", () => {
    window.history.replaceState(null, "", "/workmode");
    os.setActiveMode("work");
    const go = vi.spyOn(modeNavigation, "go").mockImplementation(() => undefined);
    renderSwitcher();

    fireEvent.click(screen.getByRole("radio", { name: "Personal mode" }));

    expect(os.activeMode()).toBe("personal");
    expect(go).toHaveBeenCalledWith("/today");
  });

  it("does not navigate when already on the mode home", () => {
    const go = vi.spyOn(modeNavigation, "go").mockImplementation(() => undefined);
    renderSwitcher();

    fireEvent.click(screen.getByRole("radio", { name: "Personal mode" }));

    expect(os.activeMode()).toBe("personal");
    expect(go).not.toHaveBeenCalled();
  });
});
