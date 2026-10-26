import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { MemoryModule } from "./memory-module";

afterEach(cleanup);

function renderModule() {
  return render(
    <ToastProvider>
      <MemoryModule />
    </ToastProvider>,
  );
}

function renderTrackers() {
  const result = renderModule();
  fireEvent.click(screen.getByRole("radio", { name: "Trackers" }));
  return result;
}

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

describe("MemoryModule", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the empty state with no memories", () => {
    renderTrackers();
    expect(screen.getByText("Nothing here yet")).toBeDefined();
  });

  it("answers \"when did I last\" instantly from history", () => {
    const os = getOS();
    const item = os.addLifeMemoryItem({ title: "Service car" });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 90 * DAY, note: "Oil and filters" });

    renderTrackers();
    fireEvent.change(screen.getByLabelText("Ask about your history"), {
      target: { value: "when did I last service my car" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByText(/90 days ago/)).toBeDefined();
  });

  it("creates a memory with a target interval", () => {
    const os = getOS();
    renderTrackers();

    fireEvent.click(screen.getByRole("button", { name: /new memory/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("What do you want to remember?"), {
      target: { value: "Clean water tank" },
    });
    fireEvent.change(within(dialog).getByLabelText("Expected interval (days)"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add memory" }));

    const items = os.lifeMemoryItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Clean water tank");
    expect(items[0]!.targetIntervalDays).toBe(120);
  });

  it("records a completion from a card and updates the forecast", () => {
    const os = getOS();
    const item = os.addLifeMemoryItem({ title: "Service car" });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 200 * DAY });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 100 * DAY });

    renderTrackers();
    const before = os.lifeMemoryStats(item.id, NOW)!;
    expect(before.effectiveIntervalDays).toBe(100);

    fireEvent.click(screen.getAllByText("Record")[0]!);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record" }));

    const after = os.lifeMemoryStats(item.id, NOW)!;
    expect(after.completionCount).toBe(3);
    expect(after.lastCompletedAt).toBe(NOW);
  });

  it("opens the detail sheet with history and interval stats", async () => {
    const os = getOS();
    const item = os.addLifeMemoryItem({ title: "Service car" });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 200 * DAY, note: "Oil" });
    os.recordLifeMemoryCompletion(item.id, { completedAt: NOW - 100 * DAY, note: "Filters" });

    renderTrackers();
    fireEvent.click(screen.getByText("Service car"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("History (2)")).toBeDefined();
    expect(within(dialog).getByText("Oil")).toBeDefined();
    expect(within(dialog).getByText(/median 100 d/)).toBeDefined();
    expect(within(dialog).getByText(/^62%$/)).toBeDefined();
  });

  it("filters to overdue items", () => {
    const os = getOS();
    const overdue = os.addLifeMemoryItem({ title: "Overdue thing" });
    os.recordLifeMemoryCompletion(overdue.id, { completedAt: NOW - 250 * DAY });
    os.recordLifeMemoryCompletion(overdue.id, { completedAt: NOW - 150 * DAY });

    const fine = os.addLifeMemoryItem({ title: "Healthy thing" });
    os.recordLifeMemoryCompletion(fine.id, { completedAt: NOW - 200 * DAY });
    os.recordLifeMemoryCompletion(fine.id, { completedAt: NOW - 10 * DAY });

    renderTrackers();
    fireEvent.click(screen.getByRole("radio", { name: "Overdue" }));

    expect(screen.getByText("Overdue thing")).toBeDefined();
    expect(screen.queryByText("Healthy thing")).toBeNull();
  });

  it("soft-deletes to trash and restores", () => {
    const os = getOS();
    const item = os.addLifeMemoryItem({ title: "Clean gutters" });

    renderTrackers();
    fireEvent.click(screen.getByText("Clean gutters"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Archive/ }));

    expect(os.getLifeMemoryItem(item.id)?.status).toBe("archived");
  });
});
describe("MemoryModule: archives, trash and filters", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides archived memories from trackers and restores them", () => {
    const os = getOS();
    const item = os.addLifeMemoryItem({ title: "Archived thing" });
    os.archiveLifeMemoryItem(item.id);

    renderTrackers();
    expect(screen.queryByText("Archived thing")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Archived" }));
    expect(screen.getByText("Archived thing")).toBeDefined();

    fireEvent.click(screen.getByText("Archived thing"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Restore/ }));
    expect(os.getLifeMemoryItem(item.id)?.status).toBe("active");
  });

  it("lists deleted memories in trash and deletes them forever", () => {
    const os = getOS();
    const item = os.addLifeMemoryItem({ title: "Gone thing" });
    os.deleteLifeMemoryItem(item.id);

    renderTrackers();
    fireEvent.click(screen.getByRole("radio", { name: "Trash" }));
    expect(screen.getByText("Gone thing")).toBeDefined();

    fireEvent.click(screen.getByText("Gone thing"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByTestId("memory-delete"));
    expect(os.getLifeMemoryItem(item.id)).not.toBeNull();

    fireEvent.click(within(dialog).getByTestId("memory-delete"));
    expect(os.getLifeMemoryItem(item.id)).toBeNull();
  });

  it("searches and filters by category", () => {
    const os = getOS();
    os.addLifeMemoryItem({ title: "Service car", category: "vehicle" });
    os.addLifeMemoryItem({ title: "Water plants", category: "garden" });

    renderTrackers();
    fireEvent.change(screen.getByLabelText("Search memories"), { target: { value: "car" } });
    expect(screen.getByText("Service car")).toBeDefined();
    expect(screen.queryByText("Water plants")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search memories"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "garden" } });
    expect(screen.getByText("Water plants")).toBeDefined();
    expect(screen.queryByText("Service car")).toBeNull();
  });

  it("shows overdue and never-recorded counts in the summary tiles", () => {
    const os = getOS();
    const overdue = os.addLifeMemoryItem({ title: "Late thing" });
    os.recordLifeMemoryCompletion(overdue.id, { completedAt: NOW - 250 * DAY });
    os.recordLifeMemoryCompletion(overdue.id, { completedAt: NOW - 150 * DAY });
    os.addLifeMemoryItem({ title: "Never thing" });

    renderTrackers();

    expect(within(screen.getByTestId("memory-stat-overdue")).getByText("1")).toBeDefined();
    expect(within(screen.getByTestId("memory-stat-never")).getByText("1")).toBeDefined();
  });

  it("exports the current tracker view", () => {
    const os = getOS();
    os.addLifeMemoryItem({ title: "Export me" });

    renderTrackers();
    fireEvent.click(screen.getByTestId("memory-export"));

    expect(screen.getByText("Memory report downloaded")).toBeDefined();
  });
});