import { describe, expect, it } from "vitest";

import { DEFAULT_SWIPE_CONFIG } from "@personalos/core";

import { decideSwipe } from "@personalos/core";

describe("swipe decision engine", () => {
  it("commits a left drag past the threshold", () => {
    expect(decideSwipe({ dx: -90, dy: 6, durationMs: 240 })).toBe("commit-left");
  });

  it("commits a right drag past the threshold", () => {
    expect(decideSwipe({ dx: 80, dy: 0, durationMs: 200 })).toBe("commit-right");
  });

  it("commits a fast flick", () => {
    expect(decideSwipe({ dx: -55, dy: 3, durationMs: 40 })).toBe("commit-left");
  });

  it("stays pending for a small drag", () => {
    expect(decideSwipe({ dx: -20, dy: 2, durationMs: 200 })).toBe("pending-left");
  });

  it("ignores vertical drags", () => {
    expect(decideSwipe({ dx: 0, dy: 120, durationMs: 200 })).toBe("none");
  });

  it("does nothing when disabled", () => {
    expect(
      decideSwipe({ dx: -200, dy: 0, durationMs: 100 }, { ...DEFAULT_SWIPE_CONFIG, enabled: false }),
    ).toBe("none");
  });

  it("rejects a zero-length gesture", () => {
    expect(decideSwipe({ dx: 0, dy: 0, durationMs: 0 })).toBe("none");
  });
});
