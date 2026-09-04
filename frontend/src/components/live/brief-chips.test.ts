import { describe, expect, test } from "bun:test";
import { BRIEF_CHIPS } from "./brief-chips";
import { titleFromBrief } from "./copy-relay";

const every = Object.values(BRIEF_CHIPS).flat();

describe("the briefs offered under the box", () => {
  test("each is a brief the drafting endpoints take", () => {
    for (const chip of every) expect(chip.trim()).not.toBe("");
    expect(new Set(every).size).toBe(every.length);
  });

  test("a relay chip names the relay it plans", () => {
    for (const chip of BRIEF_CHIPS.relay) {
      const title = titleFromBrief(chip);
      expect(title).not.toBe("New relay");
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(200);
    }
  });
});
