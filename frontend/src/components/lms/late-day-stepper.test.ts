import { describe, expect, test } from "bun:test";
import { coverLabel } from "./late-day-stepper";

describe("coverLabel", () => {
  test("names the total when no days are on the assignment", () => {
    expect(coverLabel({ days: 0, daysNeeded: 2 })).toBe("Use 2 late days");
    expect(coverLabel({ days: 0, daysNeeded: 1 })).toBe("Use 1 late day");
  });

  test("names the days it adds when some are on already", () => {
    expect(coverLabel({ days: 1, daysNeeded: 2 })).toBe("Use 1 more late day");
    expect(coverLabel({ days: 1, daysNeeded: 4 })).toBe("Use 3 more late days");
  });
});
