import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { getOS } from "@/store/os";

import TemplatesPage from "@/app/(app)/templates/page";
import { TemplatesModule } from "./templates-module";

const NOW = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();

let os: ReturnType<typeof getOS>;

function renderModule() {
  return render(
    <ToastProvider>
      <TemplatesModule />
    </ToastProvider>,
  );
}

function loadDefaults() {
  fireEvent.click(screen.getByRole("button", { name: "Templates options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Load default data" }));
}

beforeEach(() => {
  os = getOS();
  os.clearAll();
  os.hydrate();
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("every section renders", () => {
  it("shows the header, categories, featured, popular and library", () => {
    renderModule();

    expect(screen.getByRole("heading", { name: "Templates" })).toBeDefined();
    expect(screen.getByTestId("templates-categories")).toBeDefined();
    expect(screen.getByTestId("templates-featured")).toBeDefined();
    expect(screen.getByTestId("templates-popular")).toBeDefined();
    expect(screen.getByTestId("templates-library")).toBeDefined();
    expect(screen.getByTestId("templates-create-panel")).toBeDefined();
    expect(screen.getByTestId("templates-mine")).toBeDefined();
    expect(screen.getByTestId("templates-recent")).toBeDefined();
  });

  it("lists every category from the mockup", () => {
    renderModule();

    for (const key of [
      "all",
      "work",
      "personal",
      "planning",
      "finance",
      "health",
      "learning",
      "productivity",
      "projects",
    ]) {
      expect(screen.getByTestId(`templates-category-${key}`)).toBeDefined();
    }
  });

  it("shows the four create options", () => {
    renderModule();

    for (const key of ["blank", "existing", "ai", "import"]) {
      expect(screen.getByTestId(`templates-create-${key}`)).toBeDefined();
    }
  });

  it("seeds the catalog so the page is never empty", () => {
    renderModule();

    expect(screen.getAllByTestId("templates-popular-card").length).toBe(6);
    expect(screen.getAllByTestId("templates-library-card").length).toBeGreaterThan(6);
    expect(screen.getAllByTestId("templates-featured-card").length).toBe(2);
  });
});

describe("filtering and sorting", () => {
  it("filters the library by category", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("templates-category-filter"), { target: { value: "finance" } });

    const cards = screen.getAllByTestId("templates-library-card");
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.getByText("Budget Planner")).toBeDefined();
    expect(screen.queryByText("Meal Plan")).toBeNull();
  });

  it("filters the library by search text", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("templates-search"), { target: { value: "budget" } });

    expect(screen.getAllByTestId("templates-library-card").length).toBe(2);
    expect(screen.getByText("Budget Planner")).toBeDefined();
    expect(screen.queryByText("Meeting Notes")).toBeNull();
  });

  it("sorts the library by name", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("templates-sort"), { target: { value: "name" } });

    const names = screen
      .getAllByTestId("templates-library-card")
      .map((card) => card.textContent ?? "");
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("shows an honest empty state and clears the filters", () => {
    renderModule();

    fireEvent.change(screen.getByTestId("templates-search"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No templates match/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByTestId("templates-library-card").length).toBeGreaterThan(0);
  });

  it("filters by the category chips", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("templates-category-health"));

    expect(screen.getByTestId("templates-category-health").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Meal Plan")).toBeDefined();
  });
});

describe("using a template", () => {
  it("creates real items when a template is used", () => {
    renderModule();

    const before = Object.keys(os.getState().tasks).length;
    fireEvent.click(screen.getAllByTestId("templates-use")[0]!);

    expect(Object.keys(os.getState().tasks).length).toBeGreaterThan(before);
    expect(os.recentlyUsedTemplates(NOW).length).toBeGreaterThan(0);
  });

  it("marks a template as a favourite and keeps it", () => {
    renderModule();

    const star = screen.getAllByTestId("templates-favorite")[0]!;
    fireEvent.click(star);

    expect(os.templates().some((template) => template.favorite)).toBe(true);
    expect(screen.getAllByTestId("templates-favorite")[0]!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("creating templates", () => {
  it("creates a blank template", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("templates-create-blank"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My own template" } });
    fireEvent.click(screen.getByTestId("template-editor-save"));

    expect(os.templates().some((template) => template.name === "My own template")).toBe(true);
  });

  it("duplicates an existing template into My Templates", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("templates-create-existing"));
    fireEvent.click(screen.getByTestId("templates-dialog-duplicate"));

    expect(os.templates().some((template) => template.name.endsWith("copy"))).toBe(true);
  });

  it("generates a template from a prompt", () => {
    renderModule();

    fireEvent.click(screen.getByTestId("templates-create-ai"));
    fireEvent.change(screen.getByTestId("templates-prompt-input"), {
      target: { value: "a monthly budget tracker" },
    });
    fireEvent.click(screen.getByTestId("templates-dialog-generate"));

    const generated = os.templates().find((template) => template.source === "ai");
    expect(generated).toBeDefined();
    expect(generated?.category).toBe("finance");
  });

  it("asks for a name before creating a blank template", () => {
    renderModule();

    const before = os.templates().length;
    fireEvent.click(screen.getByTestId("templates-create-blank"));
    fireEvent.click(screen.getByTestId("template-editor-save"));

    expect(screen.getByTestId("template-editor-error")).toBeDefined();
    expect(os.templates()).toHaveLength(before);
  });
});

describe("load default data", () => {
  it("adds custom templates and a usage history", () => {
    renderModule();

    loadDefaults();

    expect(os.templateCounts().work).toBe(4);
    expect(os.templateCounts().personal).toBe(3);
    expect(os.templateCounts().projects).toBe(2);
    expect(os.templateCounts().planning).toBe(3);
    expect(screen.getAllByTestId("templates-recent-row").length).toBe(4);
    expect(within(screen.getByTestId("templates-mine")).getByText(/My Templates \(12\)/)).toBeDefined();
  }, 20_000);

  it("does not duplicate the default data when loaded twice", () => {
    renderModule();

    loadDefaults();
    const total = os.templates().length;

    loadDefaults();

    expect(os.templates().length).toBe(total);
  }, 20_000);
});

describe("route", () => {
  it("renders the page inside the Templates route", () => {
    render(
      <ToastProvider>
        <TemplatesPage />
      </ToastProvider>,
    );

    expect(screen.getByRole("heading", { name: "Templates" })).toBeDefined();
    expect(screen.getByTestId("templates-library")).toBeDefined();
  });
});

describe("template management", () => {
  function addCustom(name = "Custom plan") {
    return os.addTemplate({
      name,
      target: "task",
      title: name,
      description: "A custom template",
      category: "work",
      templateKind: "planner",
      builtin: false,
      source: "custom",
      items: [
        {
          kind: "task",
          title: "Do the thing",
          detail: "",
          cadence: null,
          tags: [],
          priority: 2,
          sections: [],
          group: "",
        },
      ],
    });
  }

  function openLibraryMenu(name: string) {
    const library = screen.getByTestId("templates-library");
    fireEvent.click(within(library).getByRole("button", { name: `${name} options` }));
  }

  it("previews a template before using it", () => {
    addCustom("Preview plan");
    renderModule();

    openLibraryMenu("Preview plan");
    fireEvent.click(screen.getByRole("menuitem", { name: "Preview" }));

    expect(screen.getByText("Do the thing")).toBeDefined();
    fireEvent.click(screen.getByTestId("template-preview-use"));

    expect(Object.values(os.getState().tasks).some((task) => task.title === "Do the thing")).toBe(
      true,
    );
  });

  it("edits a custom template and its items", () => {
    const template = addCustom("Editable plan");
    renderModule();

    openLibraryMenu("Editable plan");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit template" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renamed plan" } });
    fireEvent.click(screen.getByTestId("template-editor-add-item"));
    fireEvent.change(screen.getByLabelText("Item 2 title"), { target: { value: "Second task" } });
    fireEvent.click(screen.getByTestId("template-editor-save"));

    const updated = os.templateById(template.id)!;
    expect(updated.name).toBe("Renamed plan");
    expect(updated.items.map((item) => item.title)).toEqual(["Do the thing", "Second task"]);
  });

  it("duplicates, exports and deletes a template from its menu", () => {
    const template = addCustom("Manage me");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderModule();

    openLibraryMenu("Manage me");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(os.templates().some((entry) => entry.name === "Manage me copy")).toBe(true);

    openLibraryMenu("Manage me");
    fireEvent.click(screen.getByRole("menuitem", { name: "Export JSON" }));
    expect(screen.getByText("Template exported")).toBeDefined();

    openLibraryMenu("Manage me");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(os.templateById(template.id)).toBeNull();
  }, 15_000);

  it("keeps planner plan templates out of the template library", () => {
    os.savePlanTemplate({ name: "Planner week", from: NOW, to: NOW + 7 * 86_400_000 });

    renderModule();
    fireEvent.change(screen.getByTestId("templates-search"), {
      target: { value: "Planner week" },
    });

    expect(screen.queryByTestId("templates-library-card")).toBeNull();
  });
});
describe("favourites filter", () => {
  it("shows only favourite templates", () => {
    renderModule();

    const library = screen.getByTestId("templates-library");
    const firstCard = within(library).getAllByTestId("templates-library-card")[0]!;
    fireEvent.click(within(firstCard).getByTestId("templates-favorite"));
    fireEvent.click(screen.getByTestId("templates-category-favorites"));

    const cards = screen.getAllByTestId("templates-library-card");
    expect(cards).toHaveLength(1);
    expect(
      within(cards[0]!).getByTestId("templates-favorite").getAttribute("aria-pressed"),
    ).toBe("true");
  });
});