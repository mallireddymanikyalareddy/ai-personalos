import type { ID } from "../types/common";
import { loadState, serializeState, PERSIST_KEY, type StorageAdapter } from "./persistence";
import {
  SCHEMA_VERSION,
  createInitialState,
  type AppState,
  type CollectionName,
  type EntityMap,
} from "./state";

export type StoreListener = (state: AppState) => void;

export interface StoreOptions {
  storage?: StorageAdapter | null;
  persistKey?: string;
  persistDelayMs?: number;
}

export class Store {
  private state: AppState;
  private listeners = new Set<StoreListener>();
  private storage: StorageAdapter | null;
  private persistKey: string;
  private persistDelayMs: number;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private flushListenersAttached = false;

  constructor(options: StoreOptions = {}) {
    this.state = createInitialState();
    this.storage = options.storage ?? null;
    this.persistKey = options.persistKey ?? PERSIST_KEY;
    this.persistDelayMs = options.persistDelayMs ?? 120;
  }

  getState = (): AppState => {
    return this.state;
  };

  subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  hydrate(): void {
    if (this.state.hydrated) return;

    let next = this.state;
    if (this.storage) {
      const { state } = loadState(this.storage, this.persistKey);
      if (state) {
        next = {
          ...createInitialState(),
          ...state,
          version: SCHEMA_VERSION,
          hydrated: true,
        };
      }
      this.attachFlushListeners();
    }
    this.commit({ ...next, hydrated: true });
  }

  insert<K extends CollectionName>(name: K, entity: EntityMap[K]): void {
    const collection = this.state[name] as Record<ID, EntityMap[K]>;
    this.commit({
      ...this.state,
      [name]: { ...collection, [entity.id]: entity },
    } as AppState);
  }

  update<K extends CollectionName>(
    name: K,
    id: ID,
    patch: Partial<EntityMap[K]>,
  ): EntityMap[K] | null {
    const collection = this.state[name] as Record<ID, EntityMap[K]>;
    const existing = collection[id];
    if (!existing) return null;
    const updated = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    } as EntityMap[K];
    this.commit({
      ...this.state,
      [name]: { ...collection, [id]: updated },
    } as AppState);
    return updated;
  }

  remove(name: CollectionName, id: ID): boolean {
    const collection = this.state[name] as Record<ID, unknown>;
    if (!(id in collection)) return false;
    const next = { ...collection };
    delete next[id];
    this.commit({ ...this.state, [name]: next } as AppState);
    return true;
  }

  patchState(patch: Partial<AppState>): void {
    this.commit({ ...this.state, ...patch });
  }

  replaceAll(next: AppState): void {
    this.commit(next);
  }

  persistNow(): void {
    if (!this.storage || !this.state.hydrated) return;
    try {
      this.storage.setItem(this.persistKey, serializeState(this.state));
    } catch {
      // storage may be full or unavailable; the app continues in memory
    }
  }

  private commit(next: AppState): void {
    this.state = next;
    this.schedulePersist();
    for (const listener of Array.from(this.listeners)) {
      listener(next);
    }
  }

  private schedulePersist(): void {
    if (!this.storage || !this.state.hydrated) return;
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, this.persistDelayMs);
  }

  private attachFlushListeners(): void {
    if (this.flushListenersAttached || typeof window === "undefined") return;
    this.flushListenersAttached = true;
    window.addEventListener("pagehide", () => this.persistNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.persistNow();
    });
  }
}
