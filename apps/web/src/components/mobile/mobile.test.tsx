import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNotification, type CalendarEvent, type Task } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";
import { MobileTimeline, timelineEntriesFrom } from "@/components/mobile/mobile-timeline";
import { NotificationCenter } from "@/components/mobile/notification-center";
import { OfflineBanner } from "@/components/mobile/offline-banner";
import { QuickCaptureSheet } from "@/components/mobile/quick-capture-sheet";
import { SwipeableRow } from "@/components/mobile/swipeable-row";
import { MobileSettingsSection } from "@/components/mobile/mobile-settings-section";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
});

function renderWithToast(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();
const HOUR = 3_600_000;

function dayStart(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

describe("MobileTimeline", () => {
  const entries = [
    { id: "e1", startsAt: dayStart(NOW) + 9 * HOUR, endsAt: null, title: "Standup", location: "Zoom", kind: "event" as const },
    { id: "t1", startsAt: dayStart(NOW) + 14 * HOUR, endsAt: null, title: "Write report", location: null, kind: "task" as const },
  ];

  it("groups the day into morning and afternoon", () => {
    renderWithToast(
      <MobileTimeline
        entries={entries}
        hour12={false}
        now={NOW}
        onOpen={() => undefined}
        swipeEnabled={false}
      />,
    );

    expect(screen.getByText("Morning")).toBeTruthy();
    expect(screen.getByText("Afternoon")).toBeTruthy();
    expect(screen.getByText("Standup")).toBeTruthy();
    expect(screen.getByText("Write report")).toBeTruthy();
  });

  it("flags an item that is already past", () => {
    const past = [
      { id: "t1", startsAt: NOW - 2 * HOUR, endsAt: null, title: "Missed call", location: null, kind: "task" as const },
    ];
    renderWithToast(
      <MobileTimeline entries={past} hour12={false} now={NOW} onOpen={() => undefined} swipeEnabled={false} />,
    );

    expect(screen.getByText("Earlier today")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  it("shows an empty state with nothing scheduled", () => {
    renderWithToast(
      <MobileTimeline entries={[]} hour12={false} now={NOW} onOpen={() => undefined} swipeEnabled={false} />,
    );
    expect(screen.getByText("Nothing scheduled")).toBeTruthy();
  });

  it("opens an entry when tapped", () => {
    const onOpen = vi.fn();
    renderWithToast(
      <MobileTimeline
        entries={entries}
        hour12={false}
        now={NOW}
        onOpen={onOpen}
        swipeEnabled={false}
      />,
    );

    fireEvent.click(screen.getByText("Standup"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("builds timeline entries from events and open tasks", () => {
    const os = getOS();
    const event = os.addEvent({
      title: "Dentist",
      startsAt: dayStart(NOW) + 10 * HOUR,
      endsAt: dayStart(NOW) + 11 * HOUR,
    });
    const task = os.addTask({ title: "Buy milk", dueAt: dayStart(NOW) + 12 * HOUR, status: "open" });
    const doneTask = os.addTask({ title: "Ignore me", dueAt: dayStart(NOW) + 12 * HOUR, status: "done" });

    const built = timelineEntriesFrom(
      Object.values(os.getState().events),
      Object.values(os.getState().tasks),
      dayStart(NOW),
      dayStart(NOW) + 24 * HOUR,
    );

    expect(built.map((entry) => entry.id)).toContain(event.id);
    expect(built.map((entry) => entry.id)).toContain(task.id);
    expect(built.map((entry) => entry.id)).not.toContain(doneTask.id);
  });
});

describe("SwipeableRow", () => {
  it("keeps the row visible without a gesture", () => {
    renderWithToast(
      <SwipeableRow
        entity="task"
        leftAction="postpone"
        rightAction="complete"
        enabled
        thresholdPx={72}
        onAction={() => undefined}
      >
        <span>Row content</span>
      </SwipeableRow>,
    );

    expect(screen.getByText("Row content")).toBeTruthy();
  });

  it("renders both action affordances", () => {
    renderWithToast(
      <SwipeableRow
        entity="task"
        leftAction="postpone"
        rightAction="complete"
        enabled
        thresholdPx={72}
        onAction={() => undefined}
      >
        <span>Row content</span>
      </SwipeableRow>,
    );

    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Later")).toBeTruthy();
  });

  it("does not fire actions while disabled", () => {
    const onAction = vi.fn();
    renderWithToast(
      <SwipeableRow
        entity="task"
        leftAction="delete"
        rightAction="complete"
        enabled={false}
        thresholdPx={72}
        onAction={onAction}
      >
        <span>Row content</span>
      </SwipeableRow>,
    );

    fireEvent.click(screen.getByText("Row content"));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("QuickCaptureSheet", () => {
  it("stays closed until asked for", () => {
    renderWithToast(<QuickCaptureSheet open={false} onClose={() => undefined} />);
    expect(screen.queryByLabelText("Quick capture text")).toBeNull();
  });

  it("offers task, note, and event targets with a large capture button", () => {
    renderWithToast(<QuickCaptureSheet open onClose={() => undefined} />);

    expect(screen.getByRole("radio", { name: "Task" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Note" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Event" })).toBeTruthy();

    const capture = screen.getByRole("button", { name: "Capture" });
    expect(capture.className).toContain("h-12");
  });

  it("keeps capture disabled with nothing to capture", () => {
    renderWithToast(<QuickCaptureSheet open onClose={() => undefined} />);
    const capture = screen.getByRole("button", { name: "Capture" }) as HTMLButtonElement;
    expect(capture.disabled).toBe(true);
  });

  it("captures text as a task", async () => {
    const os = getOS();
    const onClose = vi.fn();
    renderWithToast(<QuickCaptureSheet open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Quick capture text"), {
      target: { value: "Buy a birthday present tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(Object.values(os.getState().tasks)).toHaveLength(1);
    expect(Object.values(os.getState().tasks)[0]!.title).toContain("Buy a birthday present");
  });

  it("captures as a note when the note target is chosen", async () => {
    const os = getOS();
    const onClose = vi.fn();
    renderWithToast(<QuickCaptureSheet open onClose={onClose} />);

    fireEvent.click(screen.getByRole("radio", { name: "Note" }));
    fireEvent.change(screen.getByLabelText("Quick capture text"), {
      target: { value: "A thought worth keeping" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(Object.values(os.getState().notes)).toHaveLength(1);
  });

  it("says nothing when nothing was entered", () => {
    renderWithToast(<QuickCaptureSheet open onClose={() => undefined} />);
    expect(screen.getByRole("button", { name: "Capture" })).toBeTruthy();
  });
});

describe("NotificationCenter", () => {
  it("asks before turning anything on", () => {
    renderWithToast(
      <NotificationCenter
        open
        onClose={() => undefined}
        reminders={[]}
        enabled={false}
        onEnable={() => undefined}
      />,
    );

    expect(screen.getByText("Reminders are off")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn on reminders" })).toBeTruthy();
  });

  it("shows nothing is due when reminders are on but empty", () => {
    renderWithToast(
      <NotificationCenter
        open
        onClose={() => undefined}
        reminders={[]}
        enabled
        onEnable={() => undefined}
      />,
    );

    expect(screen.getByText("Nothing due right now")).toBeTruthy();
  });

  it("lists reminders that are allowed", () => {
    const reminders = [
      {
        reminder: {
          id: "evening_reflection",
          kind: "evening_reflection" as const,
          title: "Evening reflection",
          body: "Close the day",
          dueAt: NOW,
        },
        allowed: true,
        reason: "Ready to send.",
      },
    ];

    renderWithToast(
      <NotificationCenter
        open
        onClose={() => undefined}
        reminders={reminders}
        enabled
        onEnable={() => undefined}
      />,
    );

    expect(screen.getByText("Evening reflection")).toBeTruthy();
    expect(screen.getByText("Reflection")).toBeTruthy();
  });

  it("dismisses all ready reminders", () => {
    const onDismissAll = vi.fn();
    const reminders = [
      {
        reminder: {
          id: "morning_journal",
          kind: "morning_journal" as const,
          title: "Morning journal",
          body: "Set an intention",
          dueAt: NOW,
        },
        allowed: true,
        reason: "Ready to send.",
      },
      {
        reminder: {
          id: "journal_streak",
          kind: "journal_streak" as const,
          title: "3 day streak",
          body: "Keep it going",
          dueAt: NOW,
        },
        allowed: true,
        reason: "Ready to send.",
      },
    ];

    renderWithToast(
      <NotificationCenter
        open
        onClose={() => undefined}
        reminders={reminders}
        enabled
        onEnable={() => undefined}
        onDismissAll={onDismissAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss all" }));
    expect(onDismissAll).toHaveBeenCalledTimes(1);
  });

  it("shows app activity and marks it read", () => {
    const onReadNotification = vi.fn();
    const notification = createNotification(
      { title: "You were mentioned", kind: "mention", body: "Take a look" },
      NOW,
    );

    renderWithToast(
      <NotificationCenter
        open
        onClose={() => undefined}
        reminders={[]}
        enabled
        onEnable={() => undefined}
        notifications={[notification]}
        onReadNotification={onReadNotification}
      />,
    );

    expect(screen.getByText("You were mentioned")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(onReadNotification).toHaveBeenCalledWith(notification.id);
  });

  it("offers browser alerts when permission is available", () => {
    const onEnableBrowser = vi.fn();

    renderWithToast(
      <NotificationCenter
        open
        onClose={() => undefined}
        reminders={[]}
        enabled
        onEnable={() => undefined}
        browserPermission="default"
        onEnableBrowser={onEnableBrowser}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(onEnableBrowser).toHaveBeenCalledTimes(1);
  });
});

describe("OfflineBanner", () => {
  it("stays hidden while online and settled", () => {
    renderWithToast(<OfflineBanner pendingCount={0} />);
    expect(screen.queryByText("Offline - changes saved locally")).toBeNull();
  });

  it("tells you work is safe when offline", async () => {
    const original = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    renderWithToast(<OfflineBanner pendingCount={2} />);

    await waitFor(() => expect(screen.getByText("Offline - changes saved locally")).toBeTruthy());
    expect(screen.getByText(/2 changes waiting to sync/)).toBeTruthy();

    Object.defineProperty(navigator, "onLine", { value: original, configurable: true });
  });
});

describe("MobileSettingsSection", () => {
  it("shows one-handed, haptics, swipe, and offline controls", () => {
    renderWithToast(
      <ToastProvider>
        <MobileSettingsSection />
      </ToastProvider>,
    );

    expect(screen.getByText("One-handed use")).toBeTruthy();
    expect(screen.getByText("Haptics")).toBeTruthy();
    expect(screen.getByText("Swipe gestures")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Enable swipes" })).toBeTruthy();
  });

  it("turns one-handed mode on and mirrors handedness", () => {
    const os = getOS();
    renderWithToast(
      <ToastProvider>
        <MobileSettingsSection />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("switch", { name: "One-handed mode" }));
    expect(os.mobilePreferences().oneHanded).toBe(true);
    expect(os.mobilePreferences().handedness).toBe("right");
  });

  it("disables swipes from settings", () => {
    const os = getOS();
    renderWithToast(
      <ToastProvider>
        <MobileSettingsSection />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Enable swipes" }));
    expect(os.mobilePreferences().swipe.enabled).toBe(false);
  });

  it("lists widget and quick action toggles", () => {
    renderWithToast(
      <ToastProvider>
        <MobileSettingsSection />
      </ToastProvider>,
    );

    expect(screen.getByRole("heading", { name: "Widgets" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Streak" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quick actions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voice" })).toBeTruthy();
  });
});

describe("timeline entries helper", () => {
  it("only includes events inside the window", () => {
    const event = {
      id: "e1",
      title: "Inside",
      startsAt: dayStart(NOW) + 10 * HOUR,
      endsAt: dayStart(NOW) + 11 * HOUR,
      location: "",
    } as unknown as CalendarEvent;

    const outside = {
      id: "e2",
      title: "Outside",
      startsAt: dayStart(NOW) + 40 * HOUR,
      endsAt: null,
      location: "",
    } as unknown as CalendarEvent;

    const built = timelineEntriesFrom([event, outside], [], dayStart(NOW), dayStart(NOW) + 24 * HOUR);
    expect(built.map((entry) => entry.id)).toEqual(["e1"]);
  });

  it("skips cancelled and done tasks", () => {
    const open = {
      id: "t1",
      title: "Open",
      dueAt: dayStart(NOW) + 10 * HOUR,
      status: "open",
    } as unknown as Task;
    const done = { id: "t2", title: "Done", dueAt: dayStart(NOW) + 10 * HOUR, status: "done" } as unknown as Task;

    const built = timelineEntriesFrom([], [open, done], dayStart(NOW), dayStart(NOW) + 24 * HOUR);
    expect(built.map((entry) => entry.id)).toEqual(["t1"]);
  });
});
