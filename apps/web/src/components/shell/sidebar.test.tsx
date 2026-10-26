import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { CaptureProvider } from "@/modules/capture/capture-context";
import { getOS } from "@/store/os";
import {
  SIDEBAR_COLLAPSE_BREAKPOINT,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  applySidebarDensity,
  isSidebarCollapsed,
  persistSidebarDensity,
} from "@/lib/sidebar-pref";

import { PRIMARY_NAV, SIDEBAR_SECTIONS, isActivePath } from "./nav";
import { Sidebar } from "./sidebar";

let currentPath = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

function renderSidebar() {
  return render(
    <ToastProvider>
      <CaptureProvider>
        <Sidebar />
      </CaptureProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-sidebar");
  document.documentElement.style.removeProperty("--sidebar-w");
  getOS().clearAll();
  getOS().hydrate();
  currentPath = "/";
});

afterEach(() => {
  cleanup();
});

describe("sidebar sections", () => {
  it("keeps the IA primary tier pinned and in order", () => {
    const primary = SIDEBAR_SECTIONS[0]!;
    expect(primary.label).toBe("Primary");
    expect(primary.items.map((item) => item.href)).toEqual(PRIMARY_NAV.map((item) => item.href));
    expect(primary.items[0]!.href).toBe("/today");
  });

  it("surfaces every secondary area in grouped sections instead of a flyout", () => {
    const grouped = SIDEBAR_SECTIONS.slice(1);
    expect(grouped.map((section) => section.label)).toEqual([
      "Execute",
      "Remember",
      "Create",
      "System",
    ]);
    const hrefs = grouped.flatMap((section) => section.items.map((item) => item.href));
    for (const item of PRIMARY_NAV) {
      expect(hrefs).not.toContain(item.href);
    }
    expect(hrefs).toContain("/notebook");
    expect(hrefs).toContain("/journal");
    expect(hrefs).toContain("/integrations");
    expect(hrefs).toContain("/inbox");
  });

  it("covers every primary and secondary area exactly once", () => {
    const hrefs = SIDEBAR_SECTIONS.flatMap((section) => section.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(PRIMARY_NAV.length + 15);
  });
});

describe("Sidebar rendering", () => {
  it("renders every section heading", () => {
    renderSidebar();
    for (const label of ["Primary", "Execute", "Remember", "Create", "System"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it("shows labels for secondary areas that used to be hidden", () => {
    renderSidebar();
    expect(screen.getAllByText("Digital Notebook").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Journal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Integrations").length).toBeGreaterThan(0);
  });

  it("marks the current page with aria-current", () => {
    currentPath = "/notebook";
    renderSidebar();
    const link = screen.getAllByTitle("Digital Notebook")[0]!;
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("treats nested notebook routes as active", () => {
    currentPath = "/notebook/nb1/p1";
    renderSidebar();
    const link = screen.getAllByTitle("Digital Notebook")[0]!;
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark the root active on a nested path", () => {
    expect(isActivePath("/tasks", "/")).toBe(false);
    expect(isActivePath("/today", "/today")).toBe(true);
    expect(isActivePath("/tasks/abc", "/tasks")).toBe(true);
  });
});

describe("Sidebar density", () => {
  it("expands by default when no preference is stored", () => {
    renderSidebar();
    expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("false");
    expect(document.documentElement.dataset.sidebar).toBe("expanded");
  });

  it("toggles to collapsed and records the choice", () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId("sidebar-collapse"));

    expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("true");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("1");
    expect(document.documentElement.style.getPropertyValue("--sidebar-w")).toBe(
      SIDEBAR_WIDTH_COLLAPSED,
    );
  });

  it("toggles with the keyboard shortcut", () => {
    renderSidebar();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("true");
  });

  it("restores the collapsed preference on the next visit", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    renderSidebar();
    expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("true");
  });

  it("restores the expanded preference on the next visit", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "0");
    renderSidebar();
    expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("false");
  });

  it("keeps every area reachable when collapsed", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(PRIMARY_NAV.length + 15);
    expect(links.every((link) => link.getAttribute("title"))).toBe(true);
  });

  it("hides the section headings when collapsed", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    renderSidebar();
    expect(screen.queryByText("Execute")).toBeNull();
  });

  it("does not duplicate the label in the accessible name when expanded", () => {
    renderSidebar();
    const link = screen.getAllByTitle("Today")[0]!;
    expect(link.textContent).toBe("Today");
    expect(link.textContent?.match(/Today/g)).toHaveLength(1);
  });

  it("announces the label once when collapsed", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    renderSidebar();
    const link = screen.getAllByTitle("Today")[0]!;
    expect(link.textContent).toBe("Today");
  });
});

describe("sidebar preference helpers", () => {
  it("defaults to expanded on wide viewports", () => {
    expect(isSidebarCollapsed()).toBe(false);
  });

  it("defaults to collapsed on narrow viewports", () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: SIDEBAR_COLLAPSE_BREAKPOINT - 200,
    });
    expect(isSidebarCollapsed()).toBe(true);
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it("writes the width variable and data attribute", () => {
    applySidebarDensity(true);
    expect(document.documentElement.dataset.sidebar).toBe("collapsed");
    expect(document.documentElement.style.getPropertyValue("--sidebar-w")).toBe(
      SIDEBAR_WIDTH_COLLAPSED,
    );

    applySidebarDensity(false);
    expect(document.documentElement.dataset.sidebar).toBe("expanded");
    expect(document.documentElement.style.getPropertyValue("--sidebar-w")).toBe(
      SIDEBAR_WIDTH_EXPANDED,
    );
  });

  it("persists without throwing when storage is unavailable", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => persistSidebarDensity(true)).not.toThrow();
    setItem.mockRestore();
  });
});