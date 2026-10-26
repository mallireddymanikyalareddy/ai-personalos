import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { JournalWorkspace } from "./journal-workspace";

const NOW = new Date(2026, 4, 12, 9, 0, 0, 0).getTime();

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
});

afterEach(cleanup);

function seed() {
  const os = getOS();
  const older = os.addJournalEntry(
    { entryDate: NOW - 86_400_000, title: "Cricket practice", body: "Good session.", mood: "calm" },
    NOW - 86_400_000,
  );
  const today = os.addJournalEntry(
    { entryDate: NOW, title: "A productive day", body: "Shipped docs.", mood: "happy", energy: 8 },
    NOW,
  );
  return { os, older, today };
}

function renderWorkspace() {
  const { os, today } = seed();
  const view = render(
    <ToastProvider>
      <JournalWorkspace
        os={os}
        entry={today}
        entries={os.journalEntries()}
        selectedDate={NOW}
        saveState="saved"
        attachments={os.journalAttachments(today.id)}
        onSelectDate={() => undefined}
        onPatch={(patch) => os.updateJournalEntry(today.id, patch)}
        onSaveState={() => undefined}
        onAddFiles={() => undefined}
        onShowAll={() => undefined}
      />
    </ToastProvider>,
  );
  return { os, today, view };
}

describe("JournalWorkspace layout", () => {
  it("renders the three panels", () => {
    renderWorkspace();
    expect(screen.getByTestId("journal-left-panel")).toBeTruthy();
    expect(screen.getByTestId("journal-center-panel")).toBeTruthy();
    expect(screen.getByTestId("journal-right-panel")).toBeTruthy();
  });

  it("shows the calendar, recent entries, editor, scales and insights", () => {
    renderWorkspace();
    expect(screen.getByText("Recent entries")).toBeTruthy();
    expect(screen.getByTestId("journal-scales")).toBeTruthy();
    expect(screen.getByTestId("journal-reflection-grid")).toBeTruthy();
    expect(screen.getByTestId("journal-side-insights")).toBeTruthy();
  });

it("shows the selected day heading and word count", () => {
    renderWorkspace();
    const heading = screen.getByTestId("journal-day-heading");
    expect(heading.textContent).toMatch(/12/);
    expect(heading.textContent).toMatch(/2026/);
    expect(screen.getByText("2 words")).toBeTruthy();
  });

  it("prompts instead of editing when no entry exists for the day", () => {
    const os = getOS();
    render(
      <ToastProvider>
        <JournalWorkspace
          os={os}
          entry={null}
          entries={[]}
          selectedDate={NOW}
          saveState="saved"
          attachments={[]}
          onSelectDate={() => undefined}
          onPatch={() => undefined}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );
    expect(screen.getByText("Nothing written for this day")).toBeTruthy();
    expect(screen.queryByTestId("journal-reflection-grid")).toBeNull();
  });
});

describe("JournalWorkspace recent entries", () => {
  it("lists recent entries and flags the active day", () => {
    const { today } = seed();
    render(
      <ToastProvider>
        <JournalWorkspace
          os={getOS()}
          entry={today}
          entries={getOS().journalEntries()}
          selectedDate={NOW}
          saveState="saved"
          attachments={[]}
          onSelectDate={() => undefined}
          onPatch={() => undefined}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );

    const list = screen.getByTestId("journal-recent");
    expect(within(list).getByText("A productive day")).toBeTruthy();
    expect(within(list).getByText("Cricket practice")).toBeTruthy();
    expect(screen.getByTestId(`journal-recent-${today.id}`).getAttribute("aria-current")).toBe("date");
  });

  it("navigates to another day when a recent entry is clicked", () => {
    const os = getOS();
    const { older } = seed();
    let picked = 0;
    render(
      <ToastProvider>
        <JournalWorkspace
          os={os}
          entry={older}
          entries={os.journalEntries()}
          selectedDate={older.entryDate}
          saveState="saved"
          attachments={[]}
          onSelectDate={(date) => {
            picked = date;
          }}
          onPatch={() => undefined}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );

    const other = os.journalEntries().find((entry) => entry.title === "A productive day")!;
    fireEvent.click(screen.getByTestId(`journal-recent-${other.id}`));
    expect(picked).toBe(other.entryDate);
  });

  it("explains itself when there are no entries yet", () => {
    const os = getOS();
    render(
      <ToastProvider>
        <JournalWorkspace
          os={os}
          entry={null}
          entries={[]}
          selectedDate={NOW}
          saveState="saved"
          attachments={[]}
          onSelectDate={() => undefined}
          onPatch={() => undefined}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );
    expect(screen.getByText("Nothing written yet. Pick a day in the calendar to start your first entry.")).toBeTruthy();
  });
});

describe("JournalWorkspace quick add", () => {
  it("adds a tag through the quick add control", () => {
    const { os, today } = renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Add a tag to this entry" }));
    fireEvent.change(screen.getByLabelText("Add a tag to this entry"), { target: { value: "reflect" } });
    fireEvent.keyDown(screen.getByLabelText("Add a tag to this entry"), { key: "Enter" });

    expect(os.getJournalEntry(today.id)!.tags).toContain("reflect");
  });

  it("adds a person through the quick add control", () => {
    const { os, today } = renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Add a person to this entry" }));
    fireEvent.change(screen.getByLabelText("Add a person to this entry"), { target: { value: "Priya" } });
    fireEvent.keyDown(screen.getByLabelText("Add a person to this entry"), { key: "Enter" });

    expect(os.getJournalEntry(today.id)!.people.map((person) => person.name)).toContain("Priya");
  });

  it("adds an activity through the quick add control", () => {
    const { os, today } = renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Add an activity to this entry" }));
    fireEvent.change(screen.getByLabelText("Add an activity to this entry"), { target: { value: "running" } });
    fireEvent.keyDown(screen.getByLabelText("Add an activity to this entry"), { key: "Enter" });

    expect(os.getJournalEntry(today.id)!.activities).toContain("running");
  });

  it("ignores a duplicate tag", () => {
    const os = getOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "x", tags: ["work"] }, NOW);
    render(
      <ToastProvider>
        <JournalWorkspace
          os={os}
          entry={entry}
          entries={os.journalEntries()}
          selectedDate={NOW}
          saveState="saved"
          attachments={[]}
          onSelectDate={() => undefined}
          onPatch={(patch) => os.updateJournalEntry(entry.id, patch)}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add a tag to this entry" }));
    fireEvent.change(screen.getByLabelText("Add a tag to this entry"), { target: { value: "Work" } });
    fireEvent.keyDown(screen.getByLabelText("Add a tag to this entry"), { key: "Enter" });

    expect(os.getJournalEntry(entry.id)!.tags).toEqual(["work"]);
  });
});

describe("JournalWorkspace quick capture", () => {
  it("appends a captured line to the entry body", () => {
    const { os, today } = renderWorkspace();

    fireEvent.change(screen.getByLabelText("Quick capture"), { target: { value: "Remember the parking spot" } });
    fireEvent.click(screen.getByRole("button", { name: "Save quick capture" }));

    expect(os.getJournalEntry(today.id)!.body).toContain("Remember the parking spot");
  });

  it("keeps the existing body when appending", () => {
    const { os, today } = renderWorkspace();

    fireEvent.change(screen.getByLabelText("Quick capture"), { target: { value: "extra line" } });
    fireEvent.keyDown(screen.getByLabelText("Quick capture"), { key: "Enter" });

    const body = os.getJournalEntry(today.id)!.body;
    expect(body).toContain("Shipped docs.");
    expect(body).toContain("extra line");
  });

  it("is disabled without an entry", () => {
    const os = getOS();
    render(
      <ToastProvider>
        <JournalWorkspace
          os={os}
          entry={null}
          entries={[]}
          selectedDate={NOW}
          saveState="saved"
          attachments={[]}
          onSelectDate={() => undefined}
          onPatch={() => undefined}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );
    expect((screen.getByLabelText("Quick capture") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("JournalWorkspace side insights", () => {
  it("reports the streak and month totals", () => {
    renderWorkspace();
    expect(screen.getByText("Journal streak")).toBeTruthy();
    expect(screen.getByText("This month")).toBeTruthy();
    expect(screen.getByText("Entries")).toBeTruthy();
    expect(screen.getByText("Photos")).toBeTruthy();
  });

  it("prompts for mood data before any mood is recorded", () => {
    const os = getOS();
    const entry = os.addJournalEntry({ entryDate: NOW, body: "no mood here" }, NOW);
    render(
      <ToastProvider>
        <JournalWorkspace
          os={os}
          entry={entry}
          entries={os.journalEntries()}
          selectedDate={NOW}
          saveState="saved"
          attachments={[]}
          onSelectDate={() => undefined}
          onPatch={(patch) => os.updateJournalEntry(entry.id, patch)}
          onSaveState={() => undefined}
          onAddFiles={() => undefined}
          onShowAll={() => undefined}
        />
      </ToastProvider>,
    );
    expect(screen.getByText("Record a mood on a few days and your patterns will appear here.")).toBeTruthy();
  });

  it("shows the mood distribution once moods exist", () => {
    renderWorkspace();
    const os = getOS();
    os.addJournalEntry({ entryDate: NOW - 172_800_000, body: "calm day", mood: "calm" }, NOW);
    expect(screen.getByText("Mood insights")).toBeTruthy();
  });
});
