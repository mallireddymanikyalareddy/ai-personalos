import { describe, expect, it } from "vitest";

import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig({});
    expect(config.NODE_ENV).toBe("development");
    expect(config.HOST).toBe("0.0.0.0");
    expect(config.PORT).toBe(8080);
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.APP_VERSION).toBe("0.1.0");
    expect(config.DATABASE_URL).toBeUndefined();
  });

  it("coerces port and keeps valid overrides", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      PORT: "3100",
      LOG_LEVEL: "warn",
      DATABASE_URL: "postgres://user:pass@localhost:5432/os",
    });
    expect(config.PORT).toBe(3100);
    expect(config.NODE_ENV).toBe("production");
    expect(config.LOG_LEVEL).toBe("warn");
    expect(config.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/os");
  });

  it("is frozen against mutation", () => {
    const config = loadConfig({});
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("fails fast with actionable messages", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow(/PORT: must be at least 1/);
    expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
    expect(() => loadConfig({ DATABASE_URL: "not-a-url" })).toThrow(/DATABASE_URL/);
  });
});
