import { describe, expect, it } from "vitest";

import { PersonalOS } from "../../os";

describe("polite task prefixes", () => {
  it("strips 'can you' and trailing question mark", () => {
    const os = new PersonalOS();
    const result = os.aiRun("Can you remind me to buy milk?", { now: Date.now() });
    expect(result.proposals[0]?.title?.toLowerCase()).toContain("buy milk");
    expect(result.proposals[0]?.title?.toLowerCase()).not.toContain("can you");
  });
});
