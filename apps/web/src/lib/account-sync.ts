import { getOS } from "@/store/os";

const OWNER_KEY = "personalos:owner";
const PUSH_DELAY_MS = 1500;

interface RemoteState {
  envelope: unknown | null;
  version: number;
}

let activeUser: string | null = null;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;
let knownVersion = 0;

export type SyncStatus = "off" | "syncing" | "saved" | "offline" | "error";
let syncStatus: SyncStatus = "off";
const statusListeners = new Set<() => void>();

function setStatus(next: SyncStatus): void {
  syncStatus = next;
  for (const listener of Array.from(statusListeners)) listener();
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

async function pull(): Promise<RemoteState> {
  const res = await fetch("/api/v1/state", { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`state pull failed (${res.status})`);
  return (await res.json()) as RemoteState;
}

type Envelope = { version: number; savedAt: number; state: Record<string, unknown> };

function isEntityMap(value: unknown): value is Record<string, { updatedAt?: number }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const first = Object.values(value)[0] as { id?: unknown; updatedAt?: unknown } | undefined;
  return first == null || (typeof first === "object" && "id" in first && "updatedAt" in first);
}

function mergeEnvelopes(local: Envelope, remote: Envelope): Envelope {
  const state: Record<string, unknown> = { ...remote.state, ...local.state };
  for (const [key, remoteValue] of Object.entries(remote.state)) {
    const localValue = local.state[key];
    if (!isEntityMap(remoteValue) || !isEntityMap(localValue)) continue;
    const merged = { ...remoteValue };
    for (const [id, entity] of Object.entries(localValue)) {
      const other = merged[id];
      if (!other || (entity.updatedAt ?? 0) >= (other.updatedAt ?? 0)) merged[id] = entity;
    }
    state[key] = merged;
  }
  return { ...local, state };
}

async function put(envelope: Envelope): Promise<Response> {
  return fetch("/api/v1/state", {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ envelope, baseVersion: knownVersion }),
  });
}

async function push(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  setStatus("syncing");
  try {
    await pushOnce();
    setStatus("saved");
  } catch {
    setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    timer = setTimeout(() => void push(), 15000);
  }
}

async function pushOnce(): Promise<void> {
  let envelope = JSON.parse(getOS().exportData()) as Envelope;
  let res = await put(envelope);
  if (res.status === 409) {
    const remote = await pull();
    if (remote.envelope) {
      envelope = mergeEnvelopes(envelope, remote.envelope as Envelope);
      applyRemote({ envelope, version: remote.version });
    }
    res = await put(envelope);
  }
  if (!res.ok) throw new Error(`state push failed (${res.status})`);
  knownVersion = ((await res.json()) as { version: number }).version;
}

function applyRemote(remote: RemoteState): void {
  applyingRemote = true;
  try {
    getOS().importData(JSON.stringify(remote.envelope));
  } finally {
    applyingRemote = false;
  }
  knownVersion = remote.version;
}

async function refreshFromServer(): Promise<void> {
  if (!activeUser || timer) return;
  const remote = await pull().catch(() => null);
  if (remote?.envelope && remote.version > knownVersion) applyRemote(remote);
}

function onVisible(): void {
  if (document.visibilityState === "visible") void refreshFromServer();
}

export async function startAccountSync(userId: string, displayName: string): Promise<void> {
  if (activeUser === userId) return;
  stopAccountSync();
  const os = getOS();
  os.hydrate();
  const previousOwner = window.localStorage.getItem(OWNER_KEY);
  const remote = await pull();
  if (remote.envelope) {
    applyRemote(remote);
  } else {
    if (previousOwner && previousOwner !== userId) os.clearAll();
    knownVersion = 0;
  }
  window.localStorage.setItem(OWNER_KEY, userId);
  if (displayName && os.getState().profile.displayName !== displayName) os.updateProfile({ displayName });
  activeUser = userId;
  if (!remote.envelope) await push();
  else setStatus("saved");
  unsubscribe = os.subscribe(() => {
    if (applyingRemote) return;
    if (timer) clearTimeout(timer);
    setStatus("syncing");
    timer = setTimeout(() => void push(), PUSH_DELAY_MS);
  });
  document.addEventListener("visibilitychange", onVisible);
}

export function stopAccountSync(): void {
  unsubscribe?.();
  unsubscribe = null;
  if (timer) clearTimeout(timer);
  timer = null;
  activeUser = null;
  setStatus("off");
  document.removeEventListener("visibilitychange", onVisible);
}

export async function endAccountSession(): Promise<void> {
  if (activeUser && timer) await push().catch(() => undefined);
  stopAccountSync();
  getOS().clearAll();
  window.localStorage.removeItem(OWNER_KEY);
}
