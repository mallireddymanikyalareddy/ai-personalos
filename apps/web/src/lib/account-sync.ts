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

async function pull(): Promise<RemoteState> {
  const res = await fetch("/api/v1/state", { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`state pull failed (${res.status})`);
  return (await res.json()) as RemoteState;
}

async function push(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const res = await fetch("/api/v1/state", {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ envelope: JSON.parse(getOS().exportData()) }),
    keepalive: false,
  });
  if (res.ok) knownVersion = ((await res.json()) as { version: number }).version;
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
  unsubscribe = os.subscribe(() => {
    if (applyingRemote) return;
    if (timer) clearTimeout(timer);
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
  document.removeEventListener("visibilitychange", onVisible);
}

export async function endAccountSession(): Promise<void> {
  if (activeUser && timer) await push().catch(() => undefined);
  stopAccountSync();
  getOS().clearAll();
  window.localStorage.removeItem(OWNER_KEY);
}
