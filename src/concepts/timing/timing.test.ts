import { describe, expect, test } from "vite-plus/test";
import { TimingConcept } from "./timing.ts";

describe("Timing", () => {
  test("answers with the provided current moment", () => {
    const at = new Date("2026-07-15T12:00:00Z");
    const timing = new TimingConcept(() => at);
    expect(timing.capture({})).toEqual({ at });
    expect(timing._now()).toEqual({ at });
  });
});
