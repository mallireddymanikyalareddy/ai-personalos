import { describe, expect, it } from "vitest";

import { PersonalOS } from "../os";
import { PERSIST_KEY, createMemoryStorage, loadState, serializeState } from "./persistence";

function osWithFreshState(): PersonalOS {
  const os = new PersonalOS({ storage: createMemoryStorage() });
  os.hydrate();
  return os;
}

function stripMobile(parsed: { state: Record<string, unknown> }): {
  state: Record<string, unknown>;
} {
  const settings = { ...(parsed.state.settings as Record<string, unknown>) };
  delete settings.mobile;
  return { state: { ...parsed.state, settings } };
}

describe("persisted state upgrade", () => {
  it("keeps settings.mobile available for a profile saved before schema 14", () => {
    const previous = osWithFreshState();
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const legacy = { version: 13, ...stripMobile(parsed) };
    const storage = createMemoryStorage({ [PERSIST_KEY]: JSON.stringify(legacy) });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    expect(loaded.state!.settings.mobile).toBeDefined();
    expect(loaded.state!.settings.mobile.oneHanded).toBe(false);
    expect(loaded.state!.settings.mobile.swipe.enabled).toBe(true);
    expect(loaded.state!.settings.mobile.notifications.enabled).toBe(false);
  });

  it("runs the journal migration so entries gain the new fields", () => {
    const previous = osWithFreshState();
    previous.addJournalEntry({ entryDate: Date.now(), body: "Legacy entry" });
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const entries = parsed.state.journalEntries as Record<string, Record<string, unknown>>;
    const degraded = Object.fromEntries(
      Object.values(entries).map((entry) => [
        String(entry.id),
        { ...entry, dateKey: undefined, productivity: undefined, tags: undefined },
      ]),
    );

    const legacy = {
      version: 12,
      state: { ...parsed.state, journalEntries: degraded },
    };
    const storage = createMemoryStorage({ [PERSIST_KEY]: JSON.stringify(legacy) });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    const entry = Object.values(loaded.state!.journalEntries)[0]!;
    expect(entry.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.productivity).toBeNull();
    expect(entry.tags).toEqual([]);
  });

  it("does not lose data when the stored version is 1", () => {
    const previous = osWithFreshState();
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const storage = createMemoryStorage({
      [PERSIST_KEY]: JSON.stringify({ version: 1, state: parsed.state }),
    });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    expect(loaded.state!.settings.mobile).toBeDefined();
  });

  it("does not discard data when a migration step is missing", () => {
    const previous = osWithFreshState();
    previous.addTask({ title: "Important task" });
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const storage = createMemoryStorage({
      [PERSIST_KEY]: JSON.stringify({ version: 0, state: parsed.state }),
    });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    expect(Object.values(loaded.state!.tasks)).toHaveLength(1);
    expect(Object.values(loaded.state!.tasks)[0]!.title).toBe("Important task");
    expect(loaded.state!.settings.mobile).toBeDefined();
  });

  it("backfills habit description and priority for a profile saved before schema 16", () => {
    const previous = osWithFreshState();
    previous.addHabit({ title: "Legacy habit" }, Date.now());
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const habits = Object.values(
      (parsed.state.habits as Record<string, Record<string, unknown>>) ?? {},
    );
    for (const habit of habits) {
      delete habit.description;
      delete habit.priority;
    }

    const legacy = {
      version: 15,
      state: { ...parsed.state, habits: Object.fromEntries(habits.map((h, i) => [String(i), h])) },
    };
    const storage = createMemoryStorage({ [PERSIST_KEY]: JSON.stringify(legacy) });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    const upgraded = Object.values(loaded.state!.habits);
    expect(upgraded).toHaveLength(1);
    expect(upgraded[0]!.description).toBeNull();
    expect(upgraded[0]!.priority).toBe("medium");
  });

  it("backfills note icon and taskIds for a profile saved before schema 17", () => {
    const previous = osWithFreshState();
    previous.addNote({ title: "Legacy note" }, Date.now());
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const notes = Object.values(
      (parsed.state.notes as Record<string, Record<string, unknown>>) ?? {},
    );
    for (const note of notes) {
      delete note.icon;
      delete note.taskIds;
    }

    const legacy = {
      version: 16,
      state: { ...parsed.state, notes: Object.fromEntries(notes.map((n, i) => [String(i), n])) },
    };
    const storage = createMemoryStorage({ [PERSIST_KEY]: JSON.stringify(legacy) });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    const upgraded = Object.values(loaded.state!.notes);
    expect(upgraded).toHaveLength(1);
    expect(upgraded[0]!.icon).toBeNull();
    expect(upgraded[0]!.taskIds).toEqual([]);
  });

  it("backfills template fields for a profile saved before schema 19", () => {
    const previous = osWithFreshState();
    previous.addTemplate({ name: "Legacy template", target: "task" });
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const templates = Object.values(
      (parsed.state.templates as Record<string, Record<string, unknown>>) ?? {},
    );
    for (const template of templates) {
      delete template.description;
      delete template.category;
      delete template.templateKind;
      delete template.items;
      delete template.popularity;
      delete template.useCount;
      delete template.favorite;
      delete template.lastUsedAt;
      delete template.source;
    }

    const legacy = {
      version: 18,
      state: { ...parsed.state, templates: Object.fromEntries(templates.map((t, i) => [String(i), t])) },
    };
    const storage = createMemoryStorage({ [PERSIST_KEY]: JSON.stringify(legacy) });
    const loaded = loadState(storage, PERSIST_KEY);

    expect(loaded.state).not.toBeNull();
    const upgraded = Object.values(loaded.state!.templates);
    expect(upgraded).toHaveLength(1);
    expect(upgraded[0]!.description).toBe("");
    expect(upgraded[0]!.category).toBe("productivity");
    expect(upgraded[0]!.templateKind).toBe("planner");
    expect(upgraded[0]!.items).toEqual([]);
    expect(upgraded[0]!.popularity).toBe(0);
    expect(upgraded[0]!.useCount).toBe(0);
    expect(upgraded[0]!.favorite).toBe(false);
    expect(upgraded[0]!.lastUsedAt).toBeNull();
    expect(upgraded[0]!.source).toBe("custom");
  });

  it("hydrates an OS loaded from an upgraded profile", () => {
    const previous = osWithFreshState();
    const parsed = JSON.parse(serializeState(previous.getState())) as {
      state: Record<string, unknown>;
    };

    const legacy = { version: 13, ...stripMobile(parsed) };
    const storage = createMemoryStorage({ [PERSIST_KEY]: JSON.stringify(legacy) });
    const os = new PersonalOS({ storage });
    os.hydrate();

    expect(os.getState().hydrated).toBe(true);
    expect(os.mobilePreferences()).toBeDefined();
    expect(os.mobilePreferences().oneHanded).toBe(false);
    expect(() => os.journalStreak(Date.now())).not.toThrow();
    expect(() => os.dueReminders(Date.now())).not.toThrow();
  });
});
