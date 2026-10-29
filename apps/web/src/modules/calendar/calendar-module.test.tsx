import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { CalendarModule } from "./calendar-module";


let os: ReturnType<typeof getOS>;
let now: number;

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

function renderCalendar() {
  return render(
    <ToastProvider>
      <CalendarModule />
    </ToastProvider>,
  );
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  installMatchMedia();
  now = new Date(2026, 9, 8, 10, 0, 0, 0).getTime();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/v1/credits")
        ? { available: 10, reserved: 0, aiAllowed: true }
        : { lowCreditThreshold: 3, flags: {} };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the header, views, grid, insights and the tool rail", () => {
    renderCalendar();

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeDefined();
    expect(screen.getByTestId("calendar-header")).toBeDefined();
    expect(screen.getByTestId("calendar-mini-month")).toBeDefined();
    expect(screen.getByTestId("calendar-my-calendars")).toBeDefined();
    expect(screen.getByTestId("calendar-upcoming")).toBeDefined();
    expect(screen.getByTestId("calendar-assistant")).toBeDefined();
    expect(screen.getByTestId("calendar-week-insights")).toBeDefined();
  });

  it("renders every view tab", () => {
    renderCalendar();

    for (const view of ["day", "week", "month", "agenda", "timeline"]) {
      expect(screen.getByTestId(`calendar-view-${view}`)).toBeDefined();
    }
  });
});

describe("load default data", () => {
  it("seeds calendars and events from the overflow menu", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Calendar options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(os.calendars().length).toBeGreaterThan(3);
    expect(Object.keys(os.getState().events).length).toBeGreaterThan(10);
    expect(screen.getAllByText("Morning Routine").length).toBeGreaterThan(0);
  }, 40_000);

  it("does not duplicate the default data when loaded twice", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Calendar options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));
    const first = Object.keys(os.getState().events).length;

    fireEvent.click(screen.getByRole("button", { name: "Calendar options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    expect(Object.keys(os.getState().events).length).toBe(first);
  }, 40_000);
});

describe("calendar list and filters", () => {
  it("lists the seeded calendars with a toggle", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Calendar options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    const calendars = within(screen.getByTestId("calendar-my-calendars"));
    expect(calendars.getByText("Work")).toBeDefined();
    expect(calendars.getByText("Personal")).toBeDefined();
    expect(calendars.getByRole("checkbox", { name: /Show Work/ })).toBeDefined();
  }, 40_000);

  it("lists upcoming events for the next seven days", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Calendar options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    const upcoming = within(screen.getByTestId("calendar-upcoming"));
    expect(upcoming.getAllByTestId("calendar-upcoming-row").length).toBeGreaterThan(0);
  }, 40_000);
});

describe("week insights", () => {
  it("reports the event, meeting, focus and task counts for the week", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Calendar options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));

    const insights = within(screen.getByTestId("calendar-week-insights"));
    expect(insights.getByText("Total Events")).toBeDefined();
    expect(insights.getByText("Focus Time")).toBeDefined();
    expect(insights.getByText("Tasks Due")).toBeDefined();
  }, 40_000);
});

describe("AI calendar assistant", () => {
  it("plans the week from real numbers", () => {
    renderCalendar();

    fireEvent.click(screen.getByTestId("calendar-assistant-plan"));
    expect(screen.getByTestId("calendar-assistant-answer").textContent).toContain("events");
  }, 15_000);

  it("finds a matching event", () => {
    renderCalendar();

    fireEvent.change(screen.getByLabelText("Ask the calendar assistant"), {
      target: { value: "standup" },
    });
    fireEvent.click(screen.getByTestId("calendar-assistant-plan"));
    fireEvent.click(screen.getByRole("button", { name: "Send to the calendar assistant" }));

    expect(screen.getByTestId("calendar-assistant-answer").textContent).toContain("standup");
  });
});

describe("view switching", () => {
  it("switches between week, day, month, agenda and timeline", () => {
    renderCalendar();

    fireEvent.click(screen.getByTestId("calendar-view-month"));
    expect(screen.getByTestId("calendar-range").textContent).toContain("2026");

    fireEvent.click(screen.getByTestId("calendar-view-timeline"));
    expect(screen.getByTestId("calendar-timeline")).toBeDefined();

    fireEvent.click(screen.getByTestId("calendar-view-day"));
    expect(screen.getByTestId("calendar-day")).toBeDefined();
  });

  it("navigates to the previous and next period", () => {
    renderCalendar();

    const before = screen.getByTestId("calendar-range").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(screen.getByTestId("calendar-range").textContent).not.toBe(before);
  });
});

describe("creating events", () => {
  it("opens the new event sheet from the header", () => {
    renderCalendar();

    fireEvent.click(screen.getByTestId("calendar-new-event"));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByLabelText("Event title")).toBeDefined();
  });
});



