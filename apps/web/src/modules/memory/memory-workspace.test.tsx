import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { MemoryCategory } from "@personalos/core";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import { MemoryModule } from "./memory-module";

const DAY = 86_400_000;

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

function renderWorkspace() {
  return render(
    <ToastProvider>
      <MemoryModule />
    </ToastProvider>,
  );
}

interface SeedOverrides {
  category?: MemoryCategory;
  kind?: "trip" | "meal" | "book" | "activity" | "milestone" | "note";
  favorite?: boolean;
  place?: { name: string; latitude: number | null; longitude: number | null };
  people?: string[];
  tags?: string[];
  bookAuthor?: string;
  attachmentIds?: string[];
}

function addMoment(title: string, daysAgo: number, overrides: SeedOverrides = {}) {
  return os.addMemoryMoment({ title, happenedAt: Date.now() - daysAgo * DAY, ...overrides });
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  installMatchMedia();
});

afterEach(cleanup);

describe("every mockup section renders by default", () => {
  it("shows categories, questions, filters, timeline, glance, map, recurring and quick actions", () => {
    renderWorkspace();

    expect(screen.getByTestId("memory-categories")).toBeDefined();
    expect(screen.getByTestId("memory-questions")).toBeDefined();
    expect(screen.getByTestId("memory-filters")).toBeDefined();
    expect(screen.getByTestId("memory-timeline-empty")).toBeDefined();
    expect(screen.getByTestId("memory-right-rail")).toBeDefined();
    expect(screen.getByTestId("memory-glance")).toBeDefined();
    expect(screen.getByTestId("memory-map")).toBeDefined();
    expect(screen.getByTestId("memory-recurring")).toBeDefined();
    expect(screen.getByTestId("memory-quick-actions")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Memory insights" })).toBeDefined();
  });

  it("renders a helpful empty state for each panel when nothing is recorded", () => {
    renderWorkspace();

    expect(screen.getByText("No memories match")).toBeDefined();
    expect(
      screen.getByText("No places recorded yet. Add a place to a memory to see it here."),
    ).toBeDefined();
    expect(screen.getByText(/Nothing repeats yet/)).toBeDefined();
  });
});

describe("memory categories", () => {
  it("counts the total and each populated category", () => {
    addMoment("Trip", 3, { category: "travel", kind: "trip" });
    addMoment("Dinner", 5, { category: "food", kind: "meal" });

    renderWorkspace();
    const bar = screen.getByTestId("memory-categories");
    expect(within(bar).getByText("All Memories")).toBeDefined();
    expect(within(bar).getByText("Travel")).toBeDefined();
    expect(within(bar).getByText("Food & Drinks")).toBeDefined();
    expect(within(bar).getAllByText("1")).toHaveLength(2);
  });

  it("hides categories that have no memories", () => {
    addMoment("Trip", 3, { category: "travel", kind: "trip" });
    renderWorkspace();
    expect(within(screen.getByTestId("memory-categories")).queryByText("Finance & Investments")).toBeNull();
  });

  it("filters the timeline by category", () => {
    addMoment("Andaman trip", 3, { category: "travel", kind: "trip" });
    addMoment("Dinner", 5, { category: "food", kind: "meal" });

    renderWorkspace();
    fireEvent.click(within(screen.getByTestId("memory-categories")).getByRole("button", { name: /Travel/ }));

    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Andaman trip")).toBeDefined();
    expect(within(timeline).queryByText("Dinner")).toBeNull();
  });

  it("clears the category filter when the same tile is clicked twice", () => {
    addMoment("Andaman trip", 3, { category: "travel", kind: "trip" });
    addMoment("Dinner", 5, { category: "food", kind: "meal" });

    renderWorkspace();
    const tile = within(screen.getByTestId("memory-categories")).getByRole("button", { name: /Travel/ });
    fireEvent.click(tile);
    fireEvent.click(tile);

    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Andaman trip")).toBeDefined();
    expect(within(timeline).getByText("Dinner")).toBeDefined();
  });
});

describe("search", () => {
  it("filters the timeline by free text", () => {
    addMoment("Andaman trip", 3, { category: "travel", kind: "trip" });
    addMoment("Gym workout", 5, { category: "health", kind: "activity" });

    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Search your memories"), { target: { value: "andaman" } });

    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Andaman trip")).toBeDefined();
    expect(within(timeline).queryByText("Gym workout")).toBeNull();
  });
});

describe("quick filters", () => {
  it("applies the favourites filter", () => {
    addMoment("Favourite one", 2, { favorite: true, category: "travel", kind: "trip" });
    addMoment("Plain one", 2, { category: "travel", kind: "trip" });

    renderWorkspace();
    fireEvent.click(
      within(screen.getByTestId("memory-filters")).getByRole("button", { name: /Favourites/ }),
    );

    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Favourite one")).toBeDefined();
    expect(within(timeline).queryByText("Plain one")).toBeNull();
  });

  it("applies the with-photos filter", () => {
    addMoment("Has photo", 2, { category: "travel", kind: "trip", attachmentIds: ["a1"] });
    addMoment("No photo", 2, { category: "travel", kind: "trip" });

    renderWorkspace();
    fireEvent.click(
      within(screen.getByTestId("memory-filters")).getByRole("button", { name: /With Photos/ }),
    );

    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Has photo")).toBeDefined();
    expect(within(timeline).queryByText("No photo")).toBeNull();
  });

  it("applies the this-year filter", () => {
    addMoment("Recent", 10, { category: "travel", kind: "trip" });
    addMoment("Ancient", 800, { category: "travel", kind: "trip" });

    renderWorkspace();
    fireEvent.click(
      within(screen.getByTestId("memory-filters")).getByRole("button", { name: /This Year/ }),
    );

    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Recent")).toBeDefined();
    expect(within(timeline).queryByText("Ancient")).toBeNull();
  });

  it("lists each populated memory type with its count", () => {
    addMoment("Trip", 3, { category: "travel", kind: "trip" });
    addMoment("Dinner", 4, { category: "food", kind: "meal" });

    renderWorkspace();
    const rail = screen.getByTestId("memory-filters");
    expect(within(rail).getByRole("button", { name: /Travel/ })).toBeDefined();
    expect(within(rail).getByRole("button", { name: /Food & Drinks/ })).toBeDefined();
  });
});

describe("asking life questions", () => {
  it("answers when did I last play cricket", () => {
    addMoment("Cricket practice", 5, { category: "activities", kind: "activity" });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "When did I last play cricket?" }));

    expect(screen.getByTestId("memory-answer").textContent).toContain("Cricket practice");
  });

  it("answers a typed vacation question", () => {
    addMoment("Goa vacation", 30, { category: "travel", kind: "trip" });

    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Ask your life questions"), {
      target: { value: "When did I last go on a vacation?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("memory-answer").textContent).toContain("Goa vacation");
  });

  it("counts visited places", () => {
    addMoment("Trip A", 3, {
      category: "travel",
      kind: "trip",
      place: { name: "Goa", latitude: null, longitude: null },
    });
    addMoment("Trip B", 9, {
      category: "travel",
      kind: "trip",
      place: { name: "Paris", latitude: null, longitude: null },
    });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "How many countries have I visited?" }));

    expect(screen.getByTestId("memory-answer").textContent).toContain("2 places");
  });

  it("answers when did I last read a book", () => {
    addMoment("Atomic Habits", 20, {
      category: "learning",
      kind: "book",
      bookAuthor: "James Clear",
    });

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "When did I last read a book?" }));

    const answer = screen.getByTestId("memory-answer").textContent ?? "";
    expect(answer).toContain("Atomic Habits");
    expect(answer).toContain("James Clear");
  });

  it("explains when nothing matches instead of failing silently", () => {
    addMoment("Something else", 3, { category: "travel", kind: "trip" });

    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Ask your life questions"), {
      target: { value: "When did I last fly a plane?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByTestId("memory-answer").textContent).toContain("could not find");
  });
});

describe("timeline", () => {
  it("orders newest first", () => {
    addMoment("Older moment", 20, { category: "travel", kind: "trip" });
    addMoment("Newer moment", 2, { category: "travel", kind: "trip" });

    renderWorkspace();
    const text = screen.getByTestId("memory-timeline").textContent ?? "";
    expect(text.indexOf("Newer moment")).toBeLessThan(text.indexOf("Older moment"));
  });

  it("shows the category badge, place and favourite marker", () => {
    addMoment("Andaman trip", 4, {
      category: "travel",
      kind: "trip",
      favorite: true,
      place: { name: "Havelock Island", latitude: 11.68, longitude: 92.28 },
    });

    renderWorkspace();
    const timeline = screen.getByTestId("memory-timeline");
    expect(within(timeline).getByText("Travel")).toBeDefined();
    expect(within(timeline).getByText("Havelock Island")).toBeDefined();
    expect(within(timeline).getByLabelText("Favourite")).toBeDefined();
  });

  it("uses the first photo as the cover and the rest as a strip", () => {
    const moment = addMoment("Trip with photos", 3, { category: "travel", kind: "trip" });
    for (const url of ["blob:one", "blob:two", "blob:three"]) {
      const attachment = os.addAttachment({
        ownerType: "memory_moment",
        ownerId: moment.id,
        name: "photo.png",
        mimeType: "image/png",
        sizeBytes: 100,
        url,
      });
      os.updateAttachment(attachment.id, {});
    }
    const ids = Object.values(os.getState().attachments)
      .filter((attachment) => attachment.ownerId === moment.id)
      .map((attachment) => attachment.id);
    os.updateMemoryMoment(moment.id, { attachmentIds: ids });

    renderWorkspace();
    const images = Array.from(
      screen.getByTestId("memory-timeline").querySelectorAll("img"),
    ) as HTMLImageElement[];
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "blob:one",
      "blob:two",
      "blob:three",
    ]);
  });

  it("shows a category placeholder when a memory has no photos", () => {
    addMoment("No photo trip", 3, { category: "travel", kind: "trip" });
    renderWorkspace();
    expect(screen.getByTestId("memory-timeline").querySelectorAll("img")).toHaveLength(0);
  });

  it("reacts to a memory added after the panel mounted", () => {
    renderWorkspace();
    expect(screen.getByTestId("memory-timeline-empty")).toBeDefined();

    act(() => {
      addMoment("Brand new memory", 1, { category: "travel", kind: "trip" });
    });

    expect(screen.queryByTestId("memory-timeline-empty")).toBeNull();
    expect(within(screen.getByTestId("memory-timeline")).getByText("Brand new memory")).toBeDefined();
  });
});

describe("life at a glance", () => {
  it("counts trips, people, foods and books", () => {
    addMoment("Trip one", 10, { category: "travel", kind: "trip", people: ["Priya"] });
    addMoment("Trip two", 20, { category: "travel", kind: "trip", people: ["Rahul"] });
    addMoment("Biryani", 5, { category: "food", kind: "meal" });
    addMoment("Atomic Habits", 8, { category: "learning", kind: "book" });

    renderWorkspace();
    const glance = screen.getByTestId("memory-glance");
    expect(within(glance).getByText("Trips")).toBeDefined();
    expect(within(glance).getByText("New people")).toBeDefined();
    expect(within(glance).getByText("New foods")).toBeDefined();
    expect(within(glance).getByText("Books read")).toBeDefined();
    expect(within(glance).getAllByText("2")).toHaveLength(2);
    expect(within(glance).getAllByText("1")).toHaveLength(2);
  });

  it("updates after a memory is added while mounted", () => {
    renderWorkspace();
    const before = within(screen.getByTestId("memory-glance")).getAllByText("0").length;

    act(() => {
      addMoment("New trip", 1, { category: "travel", kind: "trip" });
    });

    const after = within(screen.getByTestId("memory-glance")).getAllByText("0").length;
    expect(after).toBeLessThan(before);
  });
});

describe("map view", () => {
  it("explains when no place has been recorded", () => {
    addMoment("No place", 1, { category: "travel", kind: "trip" });
    renderWorkspace();
    expect(
      screen.getByText("No places recorded yet. Add a place to a memory to see it here."),
    ).toBeDefined();
  });

  it("plots a pin for a place with coordinates", () => {
    addMoment("Andaman trip", 4, {
      category: "travel",
      kind: "trip",
      place: { name: "Havelock", latitude: 11.68, longitude: 92.28 },
    });

    renderWorkspace();
    expect(screen.getByTestId("memory-map-pin-Havelock")).toBeDefined();
  });

  it("lists each place with its visit count", () => {
    addMoment("First visit", 40, {
      category: "travel",
      kind: "trip",
      place: { name: "Goa", latitude: 15.3, longitude: 74 },
    });
    addMoment("Second visit", 5, {
      category: "travel",
      kind: "trip",
      place: { name: "Goa", latitude: 15.3, longitude: 74 },
    });

    renderWorkspace();
    const map = screen.getByTestId("memory-map");
    expect(within(map).getByText("Goa")).toBeDefined();
    expect(within(map).getByText(/2 ·/)).toBeDefined();
  });

  it("asks for coordinates when a place has none", () => {
    addMoment("Somewhere", 3, {
      category: "travel",
      kind: "trip",
      place: { name: "Somewhere", latitude: null, longitude: null },
    });
    renderWorkspace();
    expect(screen.getByText(/Add coordinates to a place to plot it on the map/)).toBeDefined();
  });
});

describe("recurring activity tracker", () => {
  it("prompts when nothing repeats", () => {
    addMoment("One off", 2, { category: "health", kind: "activity" });
    renderWorkspace();
    expect(screen.getByText(/Nothing repeats yet/)).toBeDefined();
  });

  it("lists a repeated activity with its count", () => {
    addMoment("Gym workout", 3, { category: "health", kind: "activity" });
    addMoment("Gym workout", 10, { category: "health", kind: "activity" });

    renderWorkspace();
    const tracker = screen.getByTestId("memory-recurring");
    expect(within(tracker).getByText("Gym workout")).toBeDefined();
    expect(within(tracker).getByText(/2×/)).toBeDefined();
  });
});

describe("quick actions", () => {
  it("offers all eight mockup actions", () => {
    renderWorkspace();
    const actions = screen.getByTestId("memory-quick-actions");
    for (const label of [
      "Add Photo",
      "Add Note",
      "Add Place",
      "Add People",
      "Add Activity",
      "Add Food",
      "Add Book",
      "Add Idea",
    ]) {
      expect(within(actions).getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("opens the capture dialog pre-filled for the chosen action", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Add Food" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("What happened?")).toBeDefined();
    expect((within(dialog).getByLabelText("Category") as HTMLSelectElement).value).toBe("food");
    expect(Object.keys(os.getState().memoryMoments)).toHaveLength(0);
  });

  it("opens a blank dialog for New memory", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /New memory/ }));

    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("What happened?") as HTMLInputElement).value).toBe("");
    expect((within(dialog).getByLabelText("Category") as HTMLSelectElement).value).toBe("other");
  });
});

describe("capturing a memory", () => {
  function openDialog(action: string) {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: action }));
    return screen.getByRole("dialog");
  }

  it("saves the title, date, category and description", () => {
    const dialog = openDialog("Add Note");

    fireEvent.change(within(dialog).getByLabelText("What happened?"), {
      target: { value: "Learnt to surf" },
    });
    fireEvent.change(within(dialog).getByLabelText("Details"), {
      target: { value: "Two hours at Kovalam" },
    });
    fireEvent.change(within(dialog).getByLabelText("When"), { target: { value: "2026-05-04" } });
    fireEvent.change(within(dialog).getByLabelText("Category"), { target: { value: "activities" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add memory" }));

    const moments = Object.values(os.getState().memoryMoments);
    expect(moments).toHaveLength(1);
    expect(moments[0]!.title).toBe("Learnt to surf");
    expect(moments[0]!.description).toBe("Two hours at Kovalam");
    expect(moments[0]!.category).toBe("activities");
    expect(moments[0]!.kind).toBe("activity");
    expect(new Date(moments[0]!.happenedAt).getFullYear()).toBe(2026);
    expect(screen.getByTestId("memory-timeline")).toBeDefined();
  });

  it("saves a place with coordinates so it plots on the map", () => {
    const dialog = openDialog("Add Place");

    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Beach day" } });
    fireEvent.change(within(dialog).getByLabelText("Place"), { target: { value: "Havelock" } });
    fireEvent.change(within(dialog).getByLabelText("Latitude"), { target: { value: "11.68" } });
    fireEvent.change(within(dialog).getByLabelText("Longitude"), { target: { value: "92.28" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add memory" }));

    const created = Object.values(os.getState().memoryMoments)[0]!;
    expect(created.place?.name).toBe("Havelock");
    expect(created.place?.latitude).toBeCloseTo(11.68, 2);

    expect(screen.getByTestId("memory-map-pin-Havelock")).toBeDefined();
  });

  it("saves people, tags, author and favourite", () => {
    const dialog = openDialog("Add Book");

    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Atomic Habits" } });
    fireEvent.change(within(dialog).getByLabelText("People"), { target: { value: "Priya, Rahul" } });
    fireEvent.change(within(dialog).getByLabelText("Tags"), { target: { value: "habits, work" } });
    fireEvent.change(within(dialog).getByLabelText("Book author (optional)"), {
      target: { value: "James Clear" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Favourite" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add memory" }));

    const created = Object.values(os.getState().memoryMoments)[0]!;
    expect(created.people).toEqual(["Priya", "Rahul"]);
    expect(created.tags).toEqual(["habits", "work"]);
    expect(created.bookAuthor).toBe("James Clear");
    expect(created.favorite).toBe(true);
    expect(created.kind).toBe("book");
  });

  it("keeps save disabled until there is a title", () => {
    const dialog = openDialog("New memory");
    expect(within(dialog).getByRole("button", { name: "Add memory" })).toHaveProperty("disabled", true);

    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Now valid" } });
    expect(within(dialog).getByRole("button", { name: "Add memory" })).toHaveProperty("disabled", false);
  });

  it("blocks save on out-of-range coordinates", () => {
    const dialog = openDialog("Add Place");
    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Bad coords" } });
    fireEvent.change(within(dialog).getByLabelText("Latitude"), { target: { value: "999" } });
    fireEvent.change(within(dialog).getByLabelText("Longitude"), { target: { value: "999" } });

    expect(within(dialog).getByRole("button", { name: "Add memory" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/Latitude must be -90 to 90/)).toBeDefined();
  });

  it("saves a place without coordinates but keeps it off the map", () => {
    const dialog = openDialog("Add Place");
    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Somewhere" } });
    fireEvent.change(within(dialog).getByLabelText("Place"), { target: { value: "Somewhere" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add memory" }));

    const created = Object.values(os.getState().memoryMoments)[0]!;
    expect(created.place?.name).toBe("Somewhere");
    expect(created.place?.latitude).toBeNull();
    expect(screen.getByText(/Add coordinates to a place to plot it on the map/)).toBeDefined();
  });

  it("does not save when cancelled", () => {
    const dialog = openDialog("Add Note");
    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Discarded" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(Object.keys(os.getState().memoryMoments)).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("editing a memory from the timeline", () => {
  function openCardMenu(title: string) {
    fireEvent.click(screen.getByRole("button", { name: `Actions for ${title}` }));
    return screen.getByRole("menu");
  }

  it("opens the dialog pre-filled and saves changes", () => {
    const created = addMoment("Andaman trip", 3, { category: "travel", kind: "trip" });
    renderWorkspace();

    fireEvent.click(within(openCardMenu("Andaman trip")).getByRole("menuitem", { name: /Edit memory/ }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("What happened?") as HTMLInputElement).value).toBe("Andaman trip");

    fireEvent.change(within(dialog).getByLabelText("What happened?"), { target: { value: "Andaman diving trip" } });
    fireEvent.change(within(dialog).getByLabelText("Place"), { target: { value: "Havelock" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(os.getMemoryMoment(created.id)?.title).toBe("Andaman diving trip");
    expect(os.getMemoryMoment(created.id)?.place?.name).toBe("Havelock");
    expect(screen.getByText("Andaman diving trip")).toBeDefined();
  });

  it("toggles favourite straight from the card menu", () => {
    const created = addMoment("Trip", 3, { category: "travel", kind: "trip" });
    renderWorkspace();

    fireEvent.click(within(openCardMenu("Trip")).getByRole("menuitem", { name: /Add to favourites/ }));
    expect(os.getMemoryMoment(created.id)?.favorite).toBe(true);
  });

  it("moves a memory to trash from the card menu", () => {
    const created = addMoment("Trip", 3, { category: "travel", kind: "trip" });
    renderWorkspace();

    fireEvent.click(within(openCardMenu("Trip")).getByRole("menuitem", { name: /Move to trash/ }));

    expect(os.getMemoryMoment(created.id)?.status).toBe("trashed");
    expect(screen.getByTestId("memory-timeline-empty")).toBeDefined();
  });

  it("trashes a memory from the dialog", () => {
    const created = addMoment("Trip", 3, { category: "travel", kind: "trip" });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: `Actions for Trip` }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /Edit memory/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Trash" }));

    expect(os.getMemoryMoment(created.id)?.status).toBe("trashed");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("memory view switch", () => {
  it("keeps the maintenance tracker reachable", () => {
    renderWorkspace();
    expect(screen.getByTestId("memory-timeline-empty")).toBeDefined();

    fireEvent.click(screen.getByRole("radio", { name: "Trackers" }));
    expect(screen.queryByTestId("memory-timeline-empty")).toBeNull();
    expect(screen.getByText("Nothing here yet")).toBeDefined();

    fireEvent.click(screen.getByRole("radio", { name: "Timeline" }));
    expect(screen.getByTestId("memory-timeline-empty")).toBeDefined();
  });
});
describe("memory trash", () => {
  it("restores a trashed moment", () => {
    const moment = addMoment("Gone trip", 2, { category: "travel", kind: "trip" });
    os.deleteMemoryMoment(moment.id);

    renderWorkspace();
    fireEvent.click(
      within(screen.getByTestId("memory-filters")).getByRole("button", { name: /Trash/ }),
    );

    expect(screen.getByTestId("memory-trash")).toBeDefined();
    expect(screen.getByText("Gone trip")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(os.getMemoryMoment(moment.id)?.status).toBe("active");
  });

  it("permanently deletes a trashed moment after confirmation", () => {
    const moment = addMoment("Delete me", 2, { category: "travel", kind: "trip" });
    os.deleteMemoryMoment(moment.id);

    renderWorkspace();
    fireEvent.click(
      within(screen.getByTestId("memory-filters")).getByRole("button", { name: /Trash/ }),
    );

    fireEvent.click(screen.getByTestId("memory-delete-forever"));
    expect(os.getMemoryMoment(moment.id)?.status).toBe("trashed");

    fireEvent.click(screen.getByTestId("memory-delete-forever"));
    expect(os.getMemoryMoment(moment.id)).toBeNull();
  });
});