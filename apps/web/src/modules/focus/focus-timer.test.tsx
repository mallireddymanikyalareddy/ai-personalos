import * as React from "react";
import { cleanup, fireEvent, render, screen, within, act } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { FocusTimer } from "./focus-timer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, prefetch: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderTimer() {
  return render(
    <ToastProvider>
      <FocusTimer />
    </ToastProvider>,
  );
}

const MINUTE = 60_000;
const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

describe("FocusTimer", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  });

  it("offers all four timer modes", () => {
    renderTimer();
    const group = screen.getByRole("radiogroup", { name: "Timer mode" });
    for (const label of ["Stopwatch", "Countdown", "Pomodoro", "Interval"]) {
      expect(within(group).getByRole("radio", { name: label })).toBeDefined();
    }
  });

  it("starts a pomodoro session and links it to the OS", () => {
    const os = getOS();
    renderTimer();

    fireEvent.click(screen.getByRole("button", { name: /Start Focus/ }));

    const session = os.activeFocusSession();
    expect(session).not.toBeNull();
    expect(session!.mode).toBe("pomodoro");
    expect(session!.rounds).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Complete/ })).toBeDefined();
  });

  it("counts down a countdown session", () => {
    const os = getOS();
    renderTimer();

    fireEvent.click(screen.getByRole("radio", { name: "Countdown" }));
    fireEvent.click(screen.getByRole("button", { name: /Start Focus/ }));

    const startedAt = os.activeFocusSession()!.startedAt;
    expect(startedAt).toBe(NOW);

    act(() => {
      vi.advanceTimersByTime(10 * MINUTE);
    });

    expect(screen.getByText("35:00")).toBeDefined();
  });

  it("runs Task → Start Focus → Complete Task → Record Session", () => {
    const os = getOS();
    const task = os.addTask({ title: "Review the pull request", estimateMin: 45 });

    renderTimer();
    fireEvent.click(screen.getByRole("button", { name: "Start with a task" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Review the pull request"));

    const session = os.activeFocusSession();
    expect(session!.taskId).toBe(task.id);
    expect(os.getTask(task.id)?.status).toBe("in_progress");
    expect(os.getTask(task.id)?.startedAt).toBe(NOW);
    expect(screen.getByText(/Working on/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Complete/ }));

    expect(os.activeFocusSession()).toBeNull();
    expect(os.getFocusSession(session!.id)?.status).toBe("completed");
  });

  it("pauses and resumes, and only counts active time", () => {
    const os = getOS();
    renderTimer();
    fireEvent.click(screen.getByRole("radio", { name: "Countdown" }));
    fireEvent.click(screen.getByRole("button", { name: /Start Focus/ }));

    act(() => vi.advanceTimersByTime(10 * MINUTE));
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    act(() => vi.advanceTimersByTime(30 * MINUTE));
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    act(() => vi.advanceTimersByTime(5 * MINUTE));
    fireEvent.click(screen.getByRole("button", { name: /Complete/ }));

    const session = os.getFocusSession(os.getState().focusSessions[Object.keys(os.getState().focusSessions)[0]!]!.id)!;
    expect(session.pausedMs).toBe(30 * MINUTE);
    expect(session.activeMs).toBe(15 * MINUTE);
  });

  it("logs a distraction and resumes from it", () => {
    const os = getOS();
    renderTimer();
    fireEvent.click(screen.getByRole("radio", { name: "Countdown" }));
    fireEvent.click(screen.getByRole("button", { name: /Start Focus/ }));

    act(() => vi.advanceTimersByTime(5 * MINUTE));
    fireEvent.click(screen.getByRole("button", { name: /I got distracted/ }));
    expect(screen.getByRole("button", { name: /Back to focus/ })).toBeDefined();

    act(() => vi.advanceTimersByTime(3 * MINUTE));
    fireEvent.click(screen.getByRole("button", { name: /Back to focus/ }));
    fireEvent.click(screen.getByRole("button", { name: /Complete/ }));

    const session = os.getFocusSession(Object.keys(os.getState().focusSessions)[0]!)!;
    expect(session.distractionCount).toBe(1);
    expect(session.distractions[0]!.durationMs).toBe(3 * MINUTE);
  });
});
describe("FocusTimer completion and rounds", () => {
  it("asks for feedback after completing and stores rating and note", () => {
    const os = getOS();
    renderTimer();

    fireEvent.click(screen.getByRole("button", { name: /Start Focus/ }));
    const session = os.activeFocusSession()!;
    fireEvent.click(screen.getByRole("button", { name: /Complete/ }));

    expect(os.activeFocusSession()).toBeNull();
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByRole("radio", { name: "4 out of 5" }));
    fireEvent.change(screen.getByLabelText("Session note"), { target: { value: "Good flow" } });
    fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));

    const stored = os.getFocusSession(session.id)!;
    expect(stored.rating).toBe(4);
    expect(stored.note).toBe("Good flow");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("skips to a break with the break duration", () => {
    getOS();
    renderTimer();
    fireEvent.click(screen.getByRole("radio", { name: "Pomodoro" }));
    fireEvent.click(screen.getByRole("button", { name: /Start Focus/ }));

    fireEvent.click(screen.getByRole("button", { name: "Skip to next round" }));

    expect(screen.getByText("Break")).toBeDefined();
    expect(screen.getByText("remaining in this block")).toBeDefined();

    const running = getOS().activeFocusSession();
    if (running) getOS().abortFocusSession(running.id);
  });

  it("includes review tasks in the task picker", () => {
    const os = getOS();
    os.addTask({ title: "Awaiting review", status: "review" });
    renderTimer();

    fireEvent.click(screen.getByRole("button", { name: "Start with a task" }));
    expect(screen.getByText("Awaiting review")).toBeDefined();
  });
});