import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { FocusWorkspace } from "./focus-workspace";
import { FocusModule } from "./focus-module";

let os: ReturnType<typeof getOS>;

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

function workspace() {
  return (
    <ToastProvider>
      <FocusWorkspace presetId="pomodoro" onPresetIdChange={() => undefined} />
    </ToastProvider>
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  // Pin the clock to midday: these cases look back 30-45 minutes, which would
  // fall on the previous day when the suite runs just after midnight.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 22, 12, 0, 0, 0).getTime());
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("focus panels stay live", () => {
  it("shows nothing before any session", () => {
    render(workspace());
    expect(screen.getByText("No focus time logged today yet.")).toBeDefined();
    expect(screen.getByText("No focus time recorded in this window yet.")).toBeDefined();
    expect(screen.getByText("Start a session today to begin")).toBeDefined();
  });

  it("counts a running session without waiting for it to be persisted", () => {
    os.startFocusSession({ startedAt: Date.now() - 30 * 60_000, plannedMin: 25 });

    render(workspace());

    expect(
      within(screen.getByTestId("today-focus")).getAllByText("30 min").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("No focus time logged today yet.")).toBeNull();
  });

  it("counts a paused session up to the pause point", () => {
    const started = os.startFocusSession({ startedAt: Date.now() - 30 * 60_000, plannedMin: 25 });
    os.store.update("focusSessions", started.id, {
      status: "paused",
      pausedAt: Date.now() - 10 * 60_000,
      pausedMs: 10 * 60_000,
    });

    render(workspace());

    expect(
      within(screen.getByTestId("today-focus")).getAllByText("20 min").length,
    ).toBeGreaterThan(0);
  });

  it("updates the streak the moment a session starts", () => {
    os.startFocusSession({ startedAt: Date.now() - 30 * 60_000, plannedMin: 25 });

    render(workspace());

    expect(within(screen.getByTestId("focus-streak")).getByText("Today is logged")).toBeDefined();
    expect(screen.queryByText("Start a session today to begin")).toBeNull();
  });

  it("updates focus stats once a session is running", () => {
    os.startFocusSession({ startedAt: Date.now() - 45 * 60_000, plannedMin: 45 });

    render(workspace());

    expect(screen.queryByText("No focus time recorded in this window yet.")).toBeNull();
    expect(screen.getByText("45 min total")).toBeDefined();
  });

  it("keeps counting up as the running session ages", () => {
    os.startFocusSession({ startedAt: Date.now() - 30 * 60_000, plannedMin: 25 });

    const view = render(workspace());
    expect(
      within(screen.getByTestId("today-focus")).getAllByText("30 min").length,
    ).toBeGreaterThan(0);

    os.store.update("focusSessions", os.activeFocusSession()!.id, {
      startedAt: Date.now() - 50 * 60_000,
    });
    view.rerender(workspace());

    expect(
      within(screen.getByTestId("today-focus")).getAllByText("50 min").length,
    ).toBeGreaterThan(0);
  });

  it("settles on the final duration once a session completes", () => {
    const started = os.startFocusSession({ startedAt: Date.now() - 30 * 60_000, plannedMin: 25 });
    os.completeFocusSession(started.id, {}, Date.now());

    render(workspace());

    expect(
      within(screen.getByTestId("today-focus")).getAllByText("30 min").length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId("focus-streak")).getAllByText("1").length,
    ).toBeGreaterThan(0);
  });

  it("ignores an aborted session", () => {
    const started = os.startFocusSession({ startedAt: Date.now() - 30 * 60_000, plannedMin: 25 });
    os.abortFocusSession(started.id, Date.now());

    render(workspace());

    expect(screen.getByText("No focus time logged today yet.")).toBeDefined();
    expect(screen.getByText("Start a session today to begin")).toBeDefined();
  });
});
describe("FocusModule stats and stale sessions", () => {
  it("refreshes history when a session completes", () => {
    const osMod = getOS();
    const task = osMod.addTask({ title: "Refresh me" });
    const session = osMod.startFocusSession({ startedAt: Date.now(), taskId: task.id, plannedMin: 25 }, Date.now());
    osMod.completeFocusSession(session.id, {}, Date.now() + 5 * 60_000);

    render(
      <ToastProvider>
        <FocusModule />
      </ToastProvider>,
    );

    expect(screen.getAllByText("Refresh me").length).toBeGreaterThan(0);
  });

  it("aborts sessions left running for more than 12 hours", () => {
    const osMod = getOS();
    const stale = osMod.startFocusSession(
      { startedAt: Date.now() - 13 * 3_600_000, plannedMin: 25 },
      Date.now() - 13 * 3_600_000,
    );

    render(
      <ToastProvider>
        <FocusModule />
      </ToastProvider>,
    );

    expect(osMod.getFocusSession(stale.id)?.status).toBe("aborted");
  });

  it("offers to end a session from the history list", () => {
    const osMod = getOS();
    osMod.startFocusSession({ startedAt: Date.now() - 60_000, plannedMin: 25 }, Date.now() - 60_000);

    render(
      <ToastProvider>
        <FocusModule />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(osMod.activeFocusSession()).toBeNull();
  });
});