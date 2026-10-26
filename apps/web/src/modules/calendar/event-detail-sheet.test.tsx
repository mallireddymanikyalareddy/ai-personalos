import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach } from "vitest";

import { startOfDay, addDays } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { EventDetailSheet, type EventSheet } from "./event-detail-sheet";

afterEach(cleanup);

const HOUR_MS = 3_600_000;

function renderSheet(sheet: EventSheet | null, onClose: () => void) {
  return render(
    <ToastProvider>
      <EventDetailSheet sheet={sheet} onClose={onClose} />
    </ToastProvider>,
  );
}

describe("EventDetailSheet", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
  });

  it("renders nothing when closed", () => {
    renderSheet(null, () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates an event from a draft", async () => {
    const day = startOfDay(addDays(Date.now(), 1));
    renderSheet({ draft: { title: "", startsAt: day + 9 * HOUR_MS, endsAt: day + 10 * HOUR_MS } }, () => {});

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Event title"), {
      target: { value: "Team sync" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add event" }));

    const events = Object.values(getOS().getState().events);
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe("Team sync");
    expect(events[0]!.startsAt).toBe(day + 9 * HOUR_MS);
  });

  it("edits an existing event", async () => {
    const os = getOS();
    const event = os.addEvent({
      title: "Old title",
      startsAt: 1_700_000_000_000,
      endsAt: 1_700_000_003_600,
    });

    renderSheet({ eventId: event.id }, () => {});
    const dialog = await screen.findByRole("dialog");

    const titleInput = within(dialog).getByLabelText("Event title");
    expect((titleInput as HTMLInputElement).value).toBe("Old title");

    fireEvent.change(titleInput, { target: { value: "Renamed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(getOS().getState().events[event.id]!.title).toBe("Renamed");
  });

  it("warns about overlapping events before saving", async () => {
    const os = getOS();
    const day = Date.now();
    os.addEvent({ title: "Standup", startsAt: day + 9 * HOUR_MS, endsAt: day + 10 * HOUR_MS });

    renderSheet(
      { draft: { startsAt: day + 9.5 * HOUR_MS, endsAt: day + 10.5 * HOUR_MS } },
      () => {},
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Overlaps 1 other event/)).toBeTruthy();
  });
});