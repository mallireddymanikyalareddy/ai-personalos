import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalEntry } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { JournalEditor, blocksToBody, parseBlocks } from "./journal-editor";
import { JournalModule } from "./journal-module";
import { JournalReflectionGrid } from "./journal-reflection-grid";
import { JournalScales } from "./journal-scales";
import { JournalTimeline } from "./journal-timeline";
import { JournalTodayCard } from "./journal-today-card";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  getOS().clearAll();
  getOS().hydrate();
  window.history.replaceState(null, "", "/journal");
});

const NOW = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();

function entry(
  overrides: Partial<Parameters<ReturnType<typeof getOS>["addJournalEntry"]>[0]> = {},
): JournalEntry {
  const os = getOS();
  const created = os.addJournalEntry({ entryDate: NOW, body: "Today was productive.", ...overrides }, NOW);
  return os.getJournalEntry(created.id)!;
}

function renderWithToast(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

describe("JournalEditor", () => {
  it("autosaves and shows the saved state", async () => {
    const os = getOS();
    const target = entry();
    const onChange = vi.fn((patch) => os.updateJournalEntry(target.id, patch));

    renderWithToast(<JournalEditor entry={target} onChange={onChange} onSaveStateChange={() => undefined} />);

    fireEvent.change(screen.getByLabelText("Journal entry"), { target: { value: "A longer reflection." } });

    expect(onChange).toHaveBeenCalled();
    expect(os.getJournalEntry(target.id)!.body).toBe("A longer reflection.");
    await waitFor(() => expect(screen.getByText("Saved just now")).toBeTruthy());
  });

  it("never discards text while a save is in flight", () => {
    const os = getOS();
    const target = entry();
    renderWithToast(
      <JournalEditor
        entry={target}
        onChange={(patch) => os.updateJournalEntry(target.id, patch)}
        onSaveStateChange={() => undefined}
      />,
    );

    const area = screen.getByLabelText("Journal entry") as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "First line\nSecond line" } });

    expect(area.value).toContain("Second line");
    expect(os.getJournalEntry(target.id)!.body).toContain("Second line");
  });

  it("adopts an external change such as an AI edit", async () => {
    const os = getOS();
    const target = entry({ body: "original" });
    const view = renderWithToast(
      <JournalEditor entry={target} onChange={() => undefined} onSaveStateChange={() => undefined} />,
    );

    const updated = os.updateJournalEntry(target.id, { body: "tidied up" });
    view.rerender(
      <ToastProvider>
        <JournalEditor entry={updated!} onChange={() => undefined} onSaveStateChange={() => undefined} />
      </ToastProvider>,
    );

    await waitFor(() =>
      expect((screen.getByLabelText("Journal entry") as HTMLTextAreaElement).value).toBe("tidied up"),
    );
  });

  it("applies bold to the selected text", () => {
    const os = getOS();
    const target = entry({ body: "hello world" });
    renderWithToast(
      <JournalEditor
        entry={target}
        onChange={(patch) => os.updateJournalEntry(target.id, patch)}
        onSaveStateChange={() => undefined}
      />,
    );

    const area = screen.getByLabelText("Journal entry") as HTMLTextAreaElement;
    area.focus();
    area.setSelectionRange(0, 5);
    fireEvent.click(screen.getByLabelText("Bold"));

    expect(os.getJournalEntry(target.id)!.body).toContain("**hello**");
  });

  it("applies checklist formatting", () => {
    const os = getOS();
    const target = entry({ body: "" });
    renderWithToast(
      <JournalEditor
        entry={target}
        onChange={(patch) => os.updateJournalEntry(target.id, patch)}
        onSaveStateChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByLabelText("Checklist"));
    expect(os.getJournalEntry(target.id)!.body).toContain("- [ ]");
  });

  it("saves on Ctrl+S", async () => {
    const target = entry();
    const onSaveStateChange = vi.fn();
    renderWithToast(
      <JournalEditor entry={target} onChange={() => undefined} onSaveStateChange={onSaveStateChange} />,
    );

    fireEvent.keyDown(screen.getByLabelText("Journal entry"), { key: "s", ctrlKey: true });
    expect(onSaveStateChange).toHaveBeenCalledWith("saving");
    await waitFor(() => expect(onSaveStateChange).toHaveBeenCalledWith("saved"));
  });

  it("round-trips markdown through blocks", () => {
    const body = "# Heading\n\nA paragraph\n\n- one\n- two\n\n> quote\n\n---";
    const blocks = parseBlocks(body);
    expect(blocks.map((block) => block.type)).toContain("heading");
    expect(blocks.map((block) => block.type)).toContain("bulletList");
    expect(blocks.map((block) => block.type)).toContain("blockquote");
    expect(blocksToBody(blocks)).toContain("# Heading");
  });
});

describe("JournalScales", () => {
  it("records a mood", () => {
    const os = getOS();
    const target = entry();
    renderWithToast(<JournalScales entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />);

    fireEvent.change(screen.getByLabelText("Mood"), { target: { value: "happy" } });
    expect(os.getJournalEntry(target.id)!.mood).toBe("happy");
  });

  it("clears the mood when set back to empty", () => {
    const os = getOS();
    const target = os.addJournalEntry({ entryDate: NOW, body: "x", mood: "happy" }, NOW);
    renderWithToast(<JournalScales entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />);

    fireEvent.change(screen.getByLabelText("Mood"), { target: { value: "" } });
    expect(os.getJournalEntry(target.id)!.mood).toBeNull();
  });

  it("records energy and productivity on a 1-10 scale", () => {
    const os = getOS();
    const target = entry();
    renderWithToast(<JournalScales entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />);

    fireEvent.click(screen.getByTestId("energy-7"));
    fireEvent.click(screen.getByTestId("productivity-4"));

    const updated = os.getJournalEntry(target.id)!;
    expect(updated.energy).toBe(7);
    expect(updated.productivity).toBe(4);
  });

  it("marks only the chosen step as current", () => {
    const os = getOS();
    const target = os.addJournalEntry({ entryDate: NOW, body: "x", energy: 3 }, NOW);
    renderWithToast(<JournalScales entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />);

    expect(screen.getByTestId("energy-3").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("energy-4").getAttribute("aria-checked")).toBe("false");
  });

  it("toggles a score back to unrecorded", () => {
    const os = getOS();
    const target = os.addJournalEntry({ entryDate: NOW, body: "x", energy: 5 }, NOW);
    renderWithToast(<JournalScales entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />);

    fireEvent.click(screen.getByTestId("energy-5"));
    expect(os.getJournalEntry(target.id)!.energy).toBeNull();
  });
});

describe("JournalReflectionGrid", () => {
  it("renders all six reflection cards", () => {
    renderWithToast(<JournalReflectionGrid entry={entry()} onChange={() => undefined} />);
    expect(screen.getByTestId("journal-reflection-grid")).toBeTruthy();
    for (const title of [
      "Today's highlights",
      "Challenges",
      "Gratitude",
      "What did I learn today?",
      "What could I have done better?",
      "Tomorrow",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it("adds and removes highlights", () => {
    const os = getOS();
    const target = entry();
    const view = renderWithToast(
      <JournalReflectionGrid entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />,
    );

    fireEvent.change(screen.getByLabelText("New Today's highlights"), {
      target: { value: "Completed important project" },
    });
    fireEvent.click(screen.getByLabelText("Add to Today's highlights", { selector: "button" }));

    const updated = os.getJournalEntry(target.id)!;
    expect(updated.highlights).toContain("Completed important project");

    view.rerender(
      <ToastProvider>
        <JournalReflectionGrid entry={updated} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Completed important project" }));
    expect(os.getJournalEntry(target.id)!.highlights).not.toContain("Completed important project");
  });

  it("caps gratitude at five items", () => {
    const os = getOS();
    const target = os.addJournalEntry(
      {
        entryDate: NOW,
        body: "x",
        gratitude: ["a", "b", "c", "d", "e"],
      },
      NOW,
    );
    renderWithToast(
      <JournalReflectionGrid entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />,
    );

    expect(screen.getByLabelText("Add to Gratitude", { selector: "button" }).hasAttribute("disabled")).toBe(true);
  });

  it("stores free-form lessons and improvements", () => {
    const os = getOS();
    const target = entry();
    renderWithToast(
      <JournalReflectionGrid entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />,
    );

    fireEvent.change(screen.getByLabelText("What did I learn today?"), { target: { value: "Meetings run long" } });
    fireEvent.change(screen.getByLabelText("What could I have done better?"), {
      target: { value: "Started too late" },
    });

    const updated = os.getJournalEntry(target.id)!;
    expect(updated.lessons).toBe("Meetings run long");
    expect(updated.improvements).toBe("Started too late");
  });

  it("adds and removes tomorrow priorities", () => {
    const os = getOS();
    const target = entry();
    const view = renderWithToast(
      <JournalReflectionGrid entry={target} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />,
    );

    fireEvent.change(screen.getByLabelText("New Tomorrow priority"), { target: { value: "Ship the docs" } });
    fireEvent.click(screen.getByLabelText("Add to Tomorrow", { selector: "button" }));
    expect(os.getJournalEntry(target.id)!.tomorrow.priorities).toContain("Ship the docs");

    const updated = os.getJournalEntry(target.id)!;
    view.rerender(
      <ToastProvider>
        <JournalReflectionGrid entry={updated} onChange={(patch) => os.updateJournalEntry(target.id, patch)} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Ship the docs" }));
    expect(os.getJournalEntry(target.id)!.tomorrow.priorities).not.toContain("Ship the docs");
  });
});

describe("JournalTimeline", () => {
  it("shows entries with mood and tags", () => {
    const os = getOS();
    os.addJournalEntry(
      {
        entryDate: NOW,
        title: "A productive day",
        body: "Completed support work and exercised.",
        mood: "happy",
        tags: ["work", "health"],
        activities: ["Cricket"],
      },
      NOW,
    );

    renderWithToast(
      <JournalTimeline
        os={os}
        entries={os.journalEntries()}
        onSelect={() => undefined}
        hasMore={false}
        onLoadMore={() => undefined}
        query=""
      />,
    );

    expect(screen.getByText("A productive day")).toBeTruthy();
    expect(screen.getByText("#work")).toBeTruthy();
    expect(screen.getByText("Cricket")).toBeTruthy();
  });

  it("shows an empty state with no entries", () => {
    const os = getOS();
    renderWithToast(
      <JournalTimeline os={os} entries={[]} onSelect={() => undefined} hasMore={false} onLoadMore={() => undefined} query="" />,
    );
    expect(screen.getByText("No entries to show")).toBeTruthy();
  });
});

describe("JournalTodayCard", () => {
  it("prompts when nothing is written today", () => {
    renderWithToast(<JournalTodayCard />);
    expect(screen.getByText("You haven't written today's journal yet.")).toBeTruthy();
    expect(screen.getByRole("link")).toBeTruthy();
  });

  it("confirms once today's reflection exists", async () => {
    const os = getOS();
    os.addJournalEntry({ entryDate: Date.now(), body: "Reflected today." }, Date.now());

    renderWithToast(<JournalTodayCard />);
    await waitFor(() => expect(screen.getByText("Today's reflection completed")).toBeTruthy());
  });
});

describe("JournalModule trash, templates and export", () => {
  beforeEach(() => {
    getOS().clearAll();
    getOS().hydrate();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderModule() {
    return render(
      <ToastProvider>
        <JournalModule />
      </ToastProvider>,
    );
  }

  it("moves an entry to trash and deletes it forever", () => {
    const os = getOS();
    const target = os.openJournalFor(NOW, NOW);
    os.updateJournalEntry(target.id, { title: "Trash me", body: "Temporary" }, NOW);

    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Move entry to trash" }));
    expect(os.getJournalEntry(target.id)?.status).toBe("trashed");

    fireEvent.click(screen.getByRole("radio", { name: "Trash" }));
    expect(screen.getByText("Trash me")).toBeTruthy();

    fireEvent.click(screen.getByTestId("journal-delete-forever"));
    expect(os.getJournalEntry(target.id)).not.toBeNull();
    fireEvent.click(screen.getByTestId("journal-delete-forever"));
    expect(os.getJournalEntry(target.id)).toBeNull();
  });

  it("applies a template's prompts to the entry body", async () => {
    const os = getOS();
    const target = os.openJournalFor(NOW, NOW);

    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(await screen.findByRole("button", { name: /Daily Reflection/ }));

    expect(os.getJournalEntry(target.id)?.body).toContain("How was my day?");
    expect(os.getJournalEntry(target.id)?.templateId).not.toBeNull();
  });

  it("collects photos from every entry in the gallery", () => {
    const os = getOS();
    const first = os.openJournalFor(NOW, NOW);
    const second = os.addJournalEntry({ entryDate: NOW - 86_400_000, body: "Yesterday" }, NOW);
    for (const [entry, name] of [
      [first, "first.png"],
      [second, "second.png"],
    ] as const) {
      const attachment = os.addAttachment({
        ownerType: "journal_entry",
        ownerId: entry.id,
        name,
        mimeType: "image/png",
        sizeBytes: 100,
        url: `blob:${name}`,
      });
      os.updateJournalEntry(entry.id, { attachmentIds: [attachment.id] }, NOW);
    }

    renderModule();
    fireEvent.click(screen.getByRole("radio", { name: "Gallery" }));

    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(2);
  });

  it("exports the current journal", () => {
    const os = getOS();
    os.addJournalEntry({ entryDate: NOW, title: "Export me", body: "Body" }, NOW);

    renderModule();
    fireEvent.click(screen.getByTestId("journal-export"));

    expect(screen.getByText("Journal exported")).toBeTruthy();
  });
});