import { randomBytes } from "node:crypto";

export interface PendingConnection {
  providerId: string;
  userId: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  returnTo: string;
  createdAt: number;
}

const TTL_MS = 10 * 60_000;

export class PendingConnectionStore {
  private readonly pending = new Map<string, PendingConnection>();

  create(entry: Omit<PendingConnection, "createdAt">, now = Date.now()): string {
    const state = randomBytes(32).toString("base64url");
    this.pending.set(state, { ...entry, createdAt: now });
    for (const [key, value] of this.pending) {
      if (now - value.createdAt > TTL_MS) this.pending.delete(key);
    }
    return state;
  }

  consume(state: string, now = Date.now()): PendingConnection | null {
    const entry = this.pending.get(state);
    if (!entry) return null;
    this.pending.delete(state);
    if (now - entry.createdAt > TTL_MS) return null;
    return entry;
  }

  size(): number {
    return this.pending.size;
  }
}
