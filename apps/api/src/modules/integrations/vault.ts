import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { TokenVault, TokenVaultEntry } from "@personalos/core";

const VAULT_VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

function decodeKey(raw: string): Buffer {
  try {
    const buffer = Buffer.from(raw, "base64");
    if (buffer.length === KEY_BYTES) return buffer;
  } catch {
    /* fall through to the zero-padded key */
  }
  const derived = Buffer.allocUnsafe(KEY_BYTES);
  const source = Buffer.from(raw, "utf8");
  source.copy(derived, 0, 0, Math.min(source.length, KEY_BYTES));
  return derived;
}

export interface EncryptedTokenVaultOptions {
  key: string;
}

export class EncryptedTokenVault implements TokenVault {
  private readonly key: Buffer;
  private readonly records = new Map<string, string>();

  constructor(options: EncryptedTokenVaultOptions) {
    this.key = decodeKey(options.key);
  }

  put(ref: string, entry: TokenVaultEntry): void {
    this.records.set(ref, this.encrypt(entry));
  }

  get(ref: string): TokenVaultEntry | null {
    const encoded = this.records.get(ref);
    if (encoded == null) return null;
    try {
      return this.decrypt(encoded);
    } catch {
      this.records.delete(ref);
      return null;
    }
  }

  delete(ref: string): void {
    this.records.delete(ref);
  }

  list(): string[] {
    return [...this.records.keys()];
  }

  serialize(ref: string): string | null {
    return this.records.get(ref) ?? null;
  }

  load(ref: string, encoded: string): void {
    this.records.set(ref, encoded);
  }

  rotate(): void {
    const entries: Array<[string, TokenVaultEntry]> = [];
    for (const [ref, encoded] of this.records) {
      try {
        entries.push([ref, this.decrypt(encoded)]);
      } catch {
        /* drop unreadable records */
      }
    }
    this.records.clear();
    for (const [ref, entry] of entries) {
      this.put(ref, entry);
    }
  }

  private encrypt(entry: TokenVaultEntry): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(entry), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const body = Buffer.concat([iv, tag, ciphertext]);
    return `${VAULT_VERSION}.${body.toString("base64url")}`;
  }

  private decrypt(encoded: string): TokenVaultEntry {
    const separator = encoded.indexOf(".");
    if (separator < 0) throw new Error("Malformed vault record.");
    if (encoded.slice(0, separator) !== VAULT_VERSION) throw new Error("Unsupported vault record version.");
    const body = Buffer.from(encoded.slice(separator + 1), "base64url");
    if (body.length < IV_BYTES + TAG_BYTES) throw new Error("Truncated vault record.");
    const iv = body.subarray(0, IV_BYTES);
    const tag = body.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = body.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as TokenVaultEntry;
  }
}

export function createTokenVault(key: string): TokenVault {
  return new EncryptedTokenVault({ key });
}
