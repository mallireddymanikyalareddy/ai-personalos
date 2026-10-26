import { describe, expect, it } from "vitest";

import {
  burnPasswordVerify,
  hashPassword,
  verifyPassword,
} from "./password";

const PASSWORD = "correct horse battery staple";

describe("password hashing", () => {
  it("produces a scrypt-encoded string with parameters", async () => {
    const encoded = await hashPassword(PASSWORD);
    const parts = encoded.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(16384);
    expect(parts).toHaveLength(6);
  });

  it("verifies the correct password", async () => {
    const encoded = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD, encoded)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const encoded = await hashPassword(PASSWORD);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(false);
  });

  it("salts every hash independently", async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).not.toBe(b);
    await expect(verifyPassword(PASSWORD, b)).resolves.toBe(true);
  });

  it("rejects malformed or tampered encodings", async () => {
    for (const bad of [
      "",
      "plaintext",
      "bcrypt$16384$8$1$abc$def",
      "scrypt$16384$8$1$deadbeef",
      "scrypt$abc$8$1$deadbeef$cafe",
      "scrypt$16384$8$1$$",
      "scrypt$99999999$8$1$deadbeef$cafe",
    ]) {
      await expect(verifyPassword(PASSWORD, bad)).resolves.toBe(false);
    }
  });

  it("burns verification against a dummy hash without matching", async () => {
    await expect(burnPasswordVerify(PASSWORD)).resolves.toBeUndefined();
  });
});
