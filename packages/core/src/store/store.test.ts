import { describe, expect, it } from "vitest";
import {
  BACKUP_KEY_PREFIX,
  PERSIST_KEY,
  createMemoryStorage,
  loadState,
} from "./persistence";
import { Store } from "./store";
import { createMemoryMoment } from "../types/memory-moment";
import { createTask } from "../types/task";

describe("Store", () => {
  it("notifies subscribers when state changes", () => {
    const store = new Store({ storage: null });
    let seen = 0;
    const unsubscribe = store.subscribe(() => {
      seen += 1;
    });
    store.insert("tasks", createTask({ title: "Test" }));
    expect(seen).toBe(1);
    unsubscribe();
    store.insert("tasks", createTask({ title: "Ignored" }));
    expect(seen).toBe(1);
  });

  it("updates entities immutably", () => {
    const store = new Store({ storage: null });
    const task = createTask({ title: "First" });
    store.insert("tasks", task);
    const before = store.getState();
    store.update("tasks", task.id, { title: "Second" });
    const after = store.getState();
    expect(before).not.toBe(after);
    expect(before.tasks[task.id].title).toBe("First");
    expect(after.tasks[task.id].title).toBe("Second");
    expect(after.tasks[task.id].updatedAt).toBeGreaterThanOrEqual(after.tasks[task.id].createdAt);
  });

  it("returns null when updating a missing entity", () => {
    const store = new Store({ storage: null });
    expect(store.update("tasks", "missing", { title: "x" })).toBeNull();
  });

  it("does not persist before hydration", () => {
    const storage = createMemoryStorage();
    const store = new Store({ storage });
    store.insert("tasks", createTask({ title: "Early" }));
    store.persistNow();
    expect(storage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("persists after hydration and reloads data", () => {
    const storage = createMemoryStorage();
    const first = new Store({ storage });
    first.hydrate();
    first.insert("tasks", createTask({ title: "Persisted" }));
    first.persistNow();

    const second = new Store({ storage });
    second.hydrate();
    const tasks = Object.values(second.getState().tasks);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Persisted");
    expect(second.getState().hydrated).toBe(true);
  });

  it("hydrates to a clean state when nothing is stored", () => {
    const store = new Store({ storage: createMemoryStorage() });
    store.hydrate();
    expect(store.getState().hydrated).toBe(true);
    expect(Object.keys(store.getState().tasks)).toHaveLength(0);
  });

  it("round-trips memory moments through storage", () => {
    const storage = createMemoryStorage();
    const first = new Store({ storage });
    first.hydrate();
    first.insert(
      "memoryMoments",
      createMemoryMoment({ title: "Andaman trip", category: "travel", happenedAt: 1_700_000_000_000 }),
    );
    first.persistNow();

    const second = new Store({ storage });
    second.hydrate();
    const moments = Object.values(second.getState().memoryMoments);
    expect(moments).toHaveLength(1);
    expect(moments[0]!.title).toBe("Andaman trip");
    expect(moments[0]!.category).toBe("travel");
    expect(moments[0]!.searchVector).toContain("andaman");
  });
});

describe("loadState", () => {
  it("backs up corrupted data instead of losing it", () => {
    const storage = createMemoryStorage({ [PERSIST_KEY]: "{not valid json" });
    const result = loadState(storage, PERSIST_KEY);
    expect(result.state).toBeNull();
    expect(result.backupKey).toBeTruthy();
    expect(result.backupKey?.startsWith(BACKUP_KEY_PREFIX)).toBe(true);
    expect(storage.getItem(result.backupKey as string)).toBe("{not valid json");
  });

  it("rejects backups from a newer schema version", () => {
    const future = JSON.stringify({ version: 99, savedAt: Date.now(), state: { tasks: {} } });
    const storage = createMemoryStorage({ [PERSIST_KEY]: future });
    const result = loadState(storage, PERSIST_KEY);
    expect(result.state).toBeNull();
    expect(result.backupKey).toBeTruthy();
  });

  it("round-trips a serialized envelope", () => {
    const storage = createMemoryStorage();
    const store = new Store({ storage });
    store.hydrate();
    store.insert("tasks", createTask({ title: "Round trip" }));
    store.persistNow();

    const result = loadState(storage, PERSIST_KEY);
    expect(result.state).not.toBeNull();
    expect(Object.values(result.state?.tasks ?? {})[0]?.title).toBe("Round trip");
    expect(result.backupKey).toBeNull();
  });
});
